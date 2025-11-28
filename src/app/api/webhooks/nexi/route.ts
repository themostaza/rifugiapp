import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendPaymentSuccessEmail } from '@/utils/emailService';
import { NexiWebhookPayload, mapNexiResultToStatus } from '@/lib/payment/nexi-client';
import { nexiConfig } from '@/lib/payment/config';

/**
 * Webhook handler per notifiche Nexi XPay
 * 
 * Nexi invia notifiche server-to-server quando lo stato di un pagamento cambia.
 * Questo handler è l'equivalente di /api/webhooks/stripe/route.ts
 * 
 * Eventi gestiti:
 * - Pagamento completato (AUTHORIZED/EXECUTED)
 * - Pagamento fallito (DECLINED/DENIED)
 * - Pagamento annullato (CANCELLED)
 */

export async function POST(request: Request) {
  try {
    const body = await request.text();
    let payload: NexiWebhookPayload;

    try {
      payload = JSON.parse(body);
    } catch {
      console.error('[Nexi Webhook] Failed to parse request body');
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Validazione del webhook (se configurato il secret)
    if (nexiConfig.webhookSecret) {
      // Nexi può inviare il token nell'header o nel payload
      const headerToken = request.headers.get('x-security-token') || '';
      const payloadToken = payload.securityToken || '';
      
      if (headerToken !== nexiConfig.webhookSecret && payloadToken !== nexiConfig.webhookSecret) {
        console.warn('[Nexi Webhook] Security token mismatch');
        // In produzione, potresti voler rifiutare. Per ora, loggiamo solo.
        // return NextResponse.json({ error: 'Invalid security token' }, { status: 401 });
      }
    }

    const { operation } = payload;

    if (!operation || !operation.orderId) {
      console.warn('[Nexi Webhook] No orderId in payload');
      return NextResponse.json(
        { error: 'Missing orderId in webhook payload' },
        { status: 400 }
      );
    }

    const bookingId = operation.orderId; // Usiamo orderId come external_id della prenotazione
    const operationResult = operation.operationResult;
    const operationType = operation.operationType;

    console.log(`[Nexi Webhook] Processing ${operationType} - ${operationResult} for booking: ${bookingId}`);

    // Recupera la prenotazione dal DB
    const { data: bookingData, error: bookingFetchError } = await supabase
      .from('Basket')
      .select(`
        external_id,
        dayFrom,
        dayTo,
        mail, 
        name,
        isPaid, 
        paymentConfirmationEmailSent
      `)
      .eq('external_id', bookingId)
      .single();

    if (bookingFetchError) {
      console.error(`[Nexi Webhook] Error fetching booking ${bookingId}:`, bookingFetchError);
      return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 });
    }

    if (!bookingData) {
      console.error(`[Nexi Webhook] Booking not found: ${bookingId}`);
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const status = mapNexiResultToStatus(operationResult);

    // Handler per pagamento completato con successo
    const handleSuccessfulPayment = async () => {
      if (bookingData.isPaid && bookingData.paymentConfirmationEmailSent) {
        console.log(`[Nexi Webhook] Payment for ${bookingId} already processed. Skipping.`);
        return;
      }

      const emailTo = operation.customerInfo?.cardHolderEmail || bookingData.mail;
      const name = operation.customerInfo?.cardHolderName || bookingData.name;

      if (!emailTo) {
        console.error(`[Nexi Webhook] Cannot send email for ${bookingId}: no recipient email`);
        return;
      }

      if (!bookingData.dayFrom || !bookingData.dayTo) {
        console.error(`[Nexi Webhook] Cannot send email for ${bookingId}: missing dates`);
        return;
      }

      console.log(`[Nexi Webhook] Sending payment success email to ${emailTo} for ${bookingId}`);
      const emailSent = await sendPaymentSuccessEmail(emailTo, {
        name: name,
        checkIn: bookingData.dayFrom,
        checkOut: bookingData.dayTo,
        external_id: bookingData.external_id,
      });

      if (emailSent) {
        const { error: emailFlagUpdateError } = await supabase
          .from('Basket')
          .update({ paymentConfirmationEmailSent: true, updatedAt: new Date().toISOString() })
          .eq('external_id', bookingId);
        
        if (emailFlagUpdateError) {
          console.error(`[Nexi Webhook] Failed to update email flag for ${bookingId}:`, emailFlagUpdateError);
        }
      } else {
        console.warn(`[Nexi Webhook] Failed to send email for ${bookingId}`);
      }
    };

    // Gestisci i diversi risultati
    switch (status) {
      case 'success':
        console.log(`[Nexi Webhook] Payment successful for ${bookingId}`);
        
        // Controllo idempotenza
        if (bookingData.isPaid && bookingData.paymentConfirmationEmailSent) {
          console.log(`[Nexi Webhook] Booking ${bookingId} already marked as paid. Idempotency check passed.`);
          break;
        }

        // Aggiorna il DB
        const { error: updateError } = await supabase
          .from('Basket')
          .update({
            isPaid: true,
            paymentIntentId: operation.operationId, // Usiamo operationId come riferimento pagamento
            nexiOperationId: operation.operationId,
            nexiPaymentCircuit: operation.paymentCircuit,
            updatedAt: new Date().toISOString(),
          })
          .eq('external_id', bookingId)
          .select('isPaid')
          .single();

        if (updateError) {
          console.error(`[Nexi Webhook] Error updating booking ${bookingId}:`, updateError);
          return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
        }

        console.log(`[Nexi Webhook] Booking ${bookingId} marked as paid`);
        await handleSuccessfulPayment();
        break;

      case 'failed':
        console.log(`[Nexi Webhook] Payment failed for ${bookingId}: ${operationResult}`);
        
        const { error: failError } = await supabase
          .from('Basket')
          .update({
            isCancelled: true,
            cancellationReason: `nexi_payment_failed: ${operationResult}`,
            updatedAt: new Date().toISOString()
          })
          .eq('external_id', bookingId)
          .eq('isPaid', false);

        if (failError) {
          console.error(`[Nexi Webhook] Error updating failed booking ${bookingId}:`, failError);
        }
        break;

      case 'cancelled':
        console.log(`[Nexi Webhook] Payment cancelled for ${bookingId}`);
        
        const { error: cancelError } = await supabase
          .from('Basket')
          .update({
            isCancelled: true,
            cancellationReason: 'nexi_checkout_cancelled',
            updatedAt: new Date().toISOString()
          })
          .eq('external_id', bookingId)
          .eq('isPaid', false);

        if (cancelError) {
          console.error(`[Nexi Webhook] Error updating cancelled booking ${bookingId}:`, cancelError);
        }
        break;

      default:
        console.log(`[Nexi Webhook] Unhandled status ${status} (${operationResult}) for ${bookingId}`);
    }

    return NextResponse.json({ received: true });

  } catch (error: unknown) {
    console.error('[Nexi Webhook] Critical error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}




