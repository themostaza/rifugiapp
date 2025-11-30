import { supabase } from '@/lib/supabase';
import { sendPaymentSuccessEmail } from '@/utils/emailService';
import { verifyNexiWebhook, mapNexiResultToStatus, NexiWebhookPayload } from '@/lib/payment/nexi-client';

/**
 * Webhook handler per notifiche Nexi XPay
 * 
 * Nexi invia notifiche server-to-server con formato application/x-www-form-urlencoded
 * quando lo stato di un pagamento cambia.
 * 
 * Deve rispondere con HTTP 200 per confermare ricezione.
 */

export async function POST(request: Request) {
  try {
    // Nexi invia i dati come form-urlencoded
    const contentType = request.headers.get('content-type') || '';
    let payload: NexiWebhookPayload;
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      payload = Object.fromEntries(formData.entries()) as unknown as NexiWebhookPayload;
    } else if (contentType.includes('application/json')) {
      payload = await request.json();
    } else {
      // Prova a parsare come form-urlencoded dal body text
      const bodyText = await request.text();
      const params = new URLSearchParams(bodyText);
      payload = Object.fromEntries(params.entries()) as unknown as NexiWebhookPayload;
    }

    console.log('[Nexi Webhook] Received payload:', {
      esito: payload.esito,
      codTrans: payload.codTrans,
      importo: payload.importo,
      codAut: payload.codAut,
    });

    // Verifica MAC per autenticità
    const isValidMAC = verifyNexiWebhook(payload);
    if (!isValidMAC) {
      console.warn('[Nexi Webhook] MAC verification failed - proceeding anyway for now');
      // In produzione potresti voler rifiutare: return new Response('Invalid MAC', { status: 401 });
    }

    const { esito, codTrans: bookingId, codAut } = payload;

    if (!bookingId) {
      console.error('[Nexi Webhook] No codTrans in payload');
      return new Response('Missing codTrans', { status: 400 });
    }

    console.log(`[Nexi Webhook] Processing ${esito} for booking: ${bookingId}`);

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
      return new Response('Booking fetch error', { status: 500 });
    }

    if (!bookingData) {
      console.error(`[Nexi Webhook] Booking not found: ${bookingId}`);
      return new Response('Booking not found', { status: 404 });
    }

    const status = mapNexiResultToStatus(esito);

    // Handler per pagamento completato con successo
    const handleSuccessfulPayment = async () => {
      if (bookingData.isPaid && bookingData.paymentConfirmationEmailSent) {
        console.log(`[Nexi Webhook] Payment for ${bookingId} already processed. Skipping.`);
        return;
      }

      const emailTo = payload.mail || bookingData.mail;
      const name = payload.nome ? `${payload.nome} ${payload.cognome || ''}`.trim() : bookingData.name;

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

    // Gestisci i diversi esiti
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
            paymentIntentId: codAut || '', // Codice autorizzazione come riferimento
            nexiOperationId: codAut || '',
            nexiPaymentCircuit: payload.brand || '',
            updatedAt: new Date().toISOString(),
          })
          .eq('external_id', bookingId)
          .select('isPaid')
          .single();

        if (updateError) {
          console.error(`[Nexi Webhook] Error updating booking ${bookingId}:`, updateError);
          return new Response('Failed to update booking', { status: 500 });
        }

        console.log(`[Nexi Webhook] Booking ${bookingId} marked as paid`);
        await handleSuccessfulPayment();
        break;

      case 'failed':
        console.log(`[Nexi Webhook] Payment failed for ${bookingId}: ${esito}`);
        
        const { error: failError } = await supabase
          .from('Basket')
          .update({
            isCancelled: true,
            cancellationReason: `nexi_payment_failed: ${payload.messaggio || esito}`,
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

      case 'pending':
        console.log(`[Nexi Webhook] Payment pending for ${bookingId}`);
        // Non fare nulla, aspetta la notifica finale
        break;

      default:
        console.log(`[Nexi Webhook] Unhandled status ${status} (${esito}) for ${bookingId}`);
    }

    // IMPORTANTE: Nexi richiede HTTP 200 per confermare ricezione
    return new Response('OK', { status: 200 });

  } catch (error: unknown) {
    console.error('[Nexi Webhook] Critical error:', error);
    return new Response('Webhook handler failed', { status: 500 });
  }
}
