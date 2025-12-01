import { supabase } from '@/lib/supabase';
import { sendPaymentSuccessEmail, sendPaymentFailedEmail } from '@/utils/emailService';
import { toNexiCodTrans } from '@/lib/payment/nexi-client';
import { createHash } from 'crypto';
import { nexiConfig } from '@/lib/payment/config';

/**
 * API per confermare il pagamento Nexi dal redirect.
 * 
 * Quando il webhook non arriva (ambiente test, firewall, etc.),
 * possiamo usare i parametri del redirect per confermare il pagamento.
 */

interface NexiRedirectParams {
  esito?: string;
  codiceEsito?: string;
  messaggio?: string;
  codAut?: string;
  importo?: string;
  divisa?: string;
  codTrans?: string;
  data?: string;
  orario?: string;
  mac?: string;
  pan?: string;
  brand?: string;
  mail?: string;
  nome?: string;
  cognome?: string;
}

/**
 * Calcola il MAC atteso per verificare la risposta Nexi
 */
function calculateExpectedMAC(
  codTrans: string,
  esito: string,
  importo: string,
  divisa: string,
  data: string,
  orario: string,
  codAut: string
): string {
  const stringToSign = `codTrans=${codTrans}esito=${esito}importo=${importo}divisa=${divisa}data=${data}orario=${orario}codAut=${codAut}${nexiConfig.apiKey}`;
  return createHash('sha1').update(stringToSign, 'utf8').digest('hex');
}

export async function POST(request: Request) {
  try {
    const body: NexiRedirectParams & { external_id: string } = await request.json();
    
    const { external_id, esito, codiceEsito, messaggio, codAut, importo, divisa, data, orario, mac, brand, mail, nome, cognome } = body;

    console.log('[Nexi Confirm] Received params:', {
      external_id,
      esito,
      codiceEsito,
      messaggio,
      codAut,
      importo,
    });

    if (!external_id) {
      return Response.json({ error: 'Missing external_id' }, { status: 400 });
    }

    // =========================================================================
    // GESTIONE ESITO NEGATIVO (KO)
    // Se il pagamento è stato rifiutato, cancelliamo la prenotazione
    // =========================================================================
    if (esito === 'KO' || (codiceEsito && codiceEsito !== '0')) {
      console.log('[Nexi Confirm] Payment DECLINED:', { esito, codiceEsito, messaggio });
      
      // Fetch booking data to get user email before cancelling
      const { data: declinedBookingData } = await supabase
        .from('Basket')
        .select('mail, name, dayFrom, dayTo')
        .eq('external_id', external_id)
        .single();

      // Cancella la prenotazione
      const { error: cancelError } = await supabase
        .from('Basket')
        .update({ 
          isCancelled: true, 
          cancellationReason: `payment_declined: ${messaggio || esito || 'Unknown error'}`,
          updatedAt: new Date().toISOString()
        })
        .eq('external_id', external_id)
        .eq('isPaid', false); // Solo se non già pagata (sicurezza)

      if (cancelError) {
        console.error('[Nexi Confirm] Error cancelling declined booking:', cancelError);
      } else {
        console.log('[Nexi Confirm] Booking cancelled due to payment decline:', external_id);
      }

      // Send payment failed email to user
      const declinedEmailTo = mail || declinedBookingData?.mail;
      if (declinedEmailTo) {
        const guestName = (nome && cognome) ? `${nome} ${cognome}`.trim() : declinedBookingData?.name;
        await sendPaymentFailedEmail(declinedEmailTo, {
          name: guestName,
          checkIn: declinedBookingData?.dayFrom,
          checkOut: declinedBookingData?.dayTo,
          errorMessage: messaggio || 'Pagamento rifiutato dalla banca'
        });
      }

      return Response.json({ 
        success: false, 
        paymentDeclined: true,
        message: messaggio || 'Pagamento rifiutato',
        esito,
        codiceEsito 
      });
    }

    // Converti external_id in codTrans per trovare la prenotazione
    const nexiCodTrans = toNexiCodTrans(external_id);

    // =========================================================================
    // VERIFICA MAC - OBBLIGATORIA PER SICUREZZA
    // Il MAC è una firma digitale che garantisce che i dati provengano da Nexi
    // e non siano stati manipolati. Senza questa verifica, un attaccante
    // potrebbe falsificare i parametri e far risultare pagata una prenotazione.
    // =========================================================================
    
    if (!mac || !data || !orario || !importo || !divisa) {
      console.error('[Nexi Confirm] Missing required params for MAC verification:', {
        hasMac: !!mac,
        hasData: !!data,
        hasOrario: !!orario,
        hasImporto: !!importo,
        hasDivisa: !!divisa,
      });
      return Response.json({ error: 'Missing security parameters' }, { status: 400 });
    }

    const expectedMAC = calculateExpectedMAC(
      nexiCodTrans,
      esito || 'OK',
      importo,
      divisa,
      data,
      orario,
      codAut || ''
    );

    if (mac.toLowerCase() !== expectedMAC.toLowerCase()) {
      console.error('[Nexi Confirm] MAC verification FAILED - possible tampering attempt:', {
        external_id,
        received_mac: mac,
        expected_mac: expectedMAC,
        params: { codTrans: nexiCodTrans, esito, importo, divisa, data, orario, codAut }
      });
      return Response.json({ error: 'Invalid MAC signature - request rejected' }, { status: 401 });
    }

    console.log('[Nexi Confirm] MAC verified successfully for:', external_id);

    // Cerca la prenotazione per nexiOrderId (il codTrans troncato)
    const { data: bookingData, error: fetchError } = await supabase
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
      .eq('nexiOrderId', nexiCodTrans)
      .single();

    if (fetchError || !bookingData) {
      // Fallback: prova a cercare per external_id diretto
      const { data: fallbackData, error: fallbackError } = await supabase
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
        .eq('external_id', external_id)
        .single();
      
      if (fallbackError || !fallbackData) {
        console.error('[Nexi Confirm] Booking not found:', external_id, nexiCodTrans);
        return Response.json({ error: 'Booking not found' }, { status: 404 });
      }
      
      // Usa il fallback
      Object.assign(bookingData || {}, fallbackData);
    }

    // Controllo idempotenza - se già pagato, restituisci successo
    if (bookingData?.isPaid) {
      console.log('[Nexi Confirm] Booking already paid:', external_id);
      return Response.json({ 
        success: true, 
        message: 'Payment already confirmed',
        alreadyPaid: true 
      });
    }

    // Aggiorna il database
    const { error: updateError } = await supabase
      .from('Basket')
      .update({
        isPaid: true,
        paymentIntentId: codAut || '',
        nexiOperationId: codAut || '',
        nexiPaymentCircuit: brand || '',
        updatedAt: new Date().toISOString(),
      })
      .eq('external_id', external_id);

    if (updateError) {
      console.error('[Nexi Confirm] Error updating booking:', updateError);
      return Response.json({ error: 'Failed to update booking' }, { status: 500 });
    }

    console.log('[Nexi Confirm] Booking marked as paid:', external_id);

    // Invia email di conferma se non già inviata
    if (!bookingData?.paymentConfirmationEmailSent && bookingData?.dayFrom && bookingData?.dayTo) {
      const emailTo = mail || bookingData.mail;
      const guestName = (nome && cognome) ? `${nome} ${cognome}`.trim() : bookingData.name;

      if (emailTo) {
        console.log('[Nexi Confirm] Sending confirmation email to:', emailTo);
        const emailSent = await sendPaymentSuccessEmail(emailTo, {
          name: guestName,
          checkIn: bookingData.dayFrom,
          checkOut: bookingData.dayTo,
          external_id: external_id,
        });

        if (emailSent) {
          await supabase
            .from('Basket')
            .update({ paymentConfirmationEmailSent: true })
            .eq('external_id', external_id);
        }
      }
    }

    return Response.json({ 
      success: true, 
      message: 'Payment confirmed successfully' 
    });

  } catch (error) {
    console.error('[Nexi Confirm] Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

