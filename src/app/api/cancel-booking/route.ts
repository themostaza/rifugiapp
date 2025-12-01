import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Stripe from 'stripe';
import { createNexiRefund } from '@/lib/payment/nexi-client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia'
});

const APP_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.rifugiodibona.com'; // Fallback if not set
const ADMIN_EMAIL = 'paolo@larin.it';

// Basic type for booking data used in logging or partial contexts
interface BookingContextData {
  id?: number;
  external_id?: string | null;
  mail?: string | null;
  name?: string | null;
  isPaid?: boolean;
  paymentIntentId?: string | null;
  isCreatedByAdmin?: boolean;
  dayFrom?: string; // Added for refund logic context
  totalPrice?: number; // Added for refund logic context
  isCancelled?: boolean;
  // Nexi fields
  nexiOperationId?: string | null;
  nexiOrderId?: string | null;
  nexiSecurityToken?: string | null;
  nexiPaymentCircuit?: string | null;
  // Allow other properties for flexibility in logging diverse states
  [key: string]: unknown; // Changed from any to unknown
}

// Type for general error objects passed around for logging
interface ErrorLogDetails {
  message: string;
  name?: string;
  stack?: string;
  [key: string]: unknown; // Changed from any to unknown
}

// Helper function to convert simple HTML to plain text
function htmlToPlainText(html: string): string {
  if (!html) return '';
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, ' ');
  // Decode HTML entities
  text = text.replace(/&nbsp;/gi, ' ')
             .replace(/&amp;/gi, '&')
             .replace(/&quot;/gi, '"')
             .replace(/&lt;/gi, '<')
             .replace(/&gt;/gi, '>')
             .replace(/&apos;/gi, "'");
  // Normalize whitespace (multiple spaces/newlines to single space/newline)
  text = text.replace(/\s\s+/g, ' ').trim();
  text = text.replace(/\n\s*\n/g, '\n\n'); // Keep double newlines for paragraphs
  return text;
}

// Updated helper function to send emails
async function sendNotificationEmail(
  to: string,
  subject: string,
  htmlBody: string,
  plainTextBody: string,
  contextForAdminError?: { 
    type: string; 
    bookingData?: BookingContextData; 
    errorDetails?: ErrorLogDetails 
  }
) {
  if (!to) {
    console.warn('No recipient email address provided. Skipping email.');
    if (contextForAdminError) {
        await sendAdminErrorEmail(
            `Tentativo di invio email fallito: Destinatario mancante`,
            "Corpo HTML:\n" + htmlBody + "\n\nCorpo Testo:\n" + plainTextBody,
            contextForAdminError.bookingData || { note: "Nessun dettaglio booking disponibile al momento dell'errore 'destinatario mancante'." },
            {
              ...(contextForAdminError.errorDetails || { message: 'Error details missing for recipient missing error', name: 'MissingContextError'}),
              reason: `Recipient email was null or empty for context: ${contextForAdminError.type}` 
            }
        );
    }
    return false;
  }
  const apiPath = '/api/send-email';
  try {
    const fetchUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}${apiPath}` : apiPath;
    console.log('[cancel-booking:sendNotificationEmail] Attempting to call send-email API at URL:', fetchUrl);

    const emailPayload = { to, subject, html: htmlBody, text: plainTextBody };
    const emailResponse = await fetch(fetchUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(emailPayload) });

    if (!emailResponse.ok) {
      const errorDataJson = await emailResponse.json().catch(() => ({ message: 'Failed to parse error response from send-email API', name: 'ParseError' }));
      const errorData: ErrorLogDetails = typeof errorDataJson === 'object' && errorDataJson !== null ? errorDataJson as ErrorLogDetails : { message: 'Malformed error response from send-email API', name:'MalformedResponseError'};
      
      console.error(`Failed to send email to ${to} via ${apiPath}. Status: ${emailResponse.status}`, errorData);
      if (to !== ADMIN_EMAIL && contextForAdminError) {
        await sendAdminErrorEmail(
          `Fallimento invio email a utente (${contextForAdminError.type})`,
          "Corpo HTML:\n" + htmlBody + "\n\nCorpo Testo:\n" + plainTextBody,
          contextForAdminError.bookingData || { note: "Booking data not available in context for user email failure" },
          { ...errorData, emailApiStatus: emailResponse.status }
        );
      }
      return false;
    }
    console.log(`Email sent successfully to ${to} with subject: ${subject}`);
    return true;
  } catch (emailError: unknown) {
    console.error(`Exception while sending email to ${to} via ${apiPath}:`, emailError);
    const errDetails: ErrorLogDetails = { message: 'Unknown error during email sending' };
    if (emailError instanceof Error) {
      errDetails.message = emailError.message;
      errDetails.name = emailError.name;
      errDetails.stack = emailError.stack;
    } else if (typeof emailError === 'object' && emailError !== null && 'message' in emailError) {
      errDetails.message = String((emailError as {message: string}).message);
    }
    if (to !== ADMIN_EMAIL && contextForAdminError) {
      await sendAdminErrorEmail(
        `Eccezione durante invio email a utente (${contextForAdminError.type})`,
        "Corpo HTML:\n" + htmlBody + "\n\nCorpo Testo:\n" + plainTextBody,
        contextForAdminError.bookingData || { note: "Booking data not available for user email exception" },
        { ...(contextForAdminError.errorDetails || { message: 'No specific error details from context', name:'ContextError' }), emailException: errDetails }
      );
    }
    return false;
  }
}

// Updated helper function to send error notifications to the admin
async function sendAdminErrorEmail(
  contextMessage: string, 
  emailContentAttempt: string, 
  bookingAttemptData: BookingContextData | Record<string, unknown>, 
  errorDetailsInput: ErrorLogDetails | Record<string, unknown>
) {
  const subject = "Errore in piattaforma RifugioDibona: eliminazione prenotazione in errore";
  
  const safeErrorDetails: ErrorLogDetails = 
    (typeof errorDetailsInput === 'object' && errorDetailsInput !== null && 'message' in errorDetailsInput && typeof errorDetailsInput.message === 'string')
    ? errorDetailsInput as ErrorLogDetails 
    : { message: 'Provided errorDetails was not in expected format', name: 'ErrorFormatIssue', originalError: errorDetailsInput };

  const htmlAdminBody = `
    <h1>Errore durante il processo di cancellazione prenotazione</h1>
    <p><strong>Contesto dell'errore:</strong> ${contextMessage}</p>
    <p><strong>Data e Ora Errore:</strong> ${new Date().toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'long' })}</p>
    <p><strong>Contenuto Email Tentato (se applicabile):</strong></p>
    <pre>${emailContentAttempt.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c))}</pre>
    <p><strong>Dettagli Prenotazione Coinvolta (o tentativo):</strong></p>
    <pre>${JSON.stringify(bookingAttemptData, null, 2)}</pre>
    <p><strong>Dettagli Errore:</strong></p>
    <pre>${JSON.stringify(safeErrorDetails, null, 2)}</pre>
    <p>Si prega di investigare.</p>
  `;
  const plainTextAdminBody = htmlToPlainText(htmlAdminBody);
  
  // Determine bookingData and errorDetails for the contextForAdminError when calling sendNotificationEmail for the admin himself
  let effectiveBookingDataForAdminContext: BookingContextData | Record<string, unknown>;
  if (typeof bookingAttemptData === 'object' && bookingAttemptData !== null && ('id' in bookingAttemptData || 'external_id' in bookingAttemptData) ) {
    effectiveBookingDataForAdminContext = bookingAttemptData as BookingContextData;
  } else {
    effectiveBookingDataForAdminContext = { note: "Booking data for context was not a BookingContextData instance or was minimal." , originalData: bookingAttemptData };
  }

  await sendNotificationEmail(ADMIN_EMAIL, subject, htmlAdminBody, plainTextAdminBody, {
    type: 'Admin Error Notification Failed SelfSend', // Different type to avoid loops on this specific path
    bookingData: effectiveBookingDataForAdminContext,
    errorDetails: safeErrorDetails
  });
}

export async function POST(request: Request) {
  let external_id_from_request: string | null = null;
  let parsedRequestBody: { external_id?: string; [key: string]: unknown } = {};
  let requestBodyText: string = '';
  let latestBookingDataForAdminError: BookingContextData | Record<string, unknown> = { note: 'Initial state' };

  try {
    const requestCloneForBodyText = request.clone();
    requestBodyText = await requestCloneForBodyText.text().catch(() => 'Could not read request body');
    latestBookingDataForAdminError = { raw_body_on_error: requestBodyText };

    try {
      parsedRequestBody = await request.json();
      external_id_from_request = parsedRequestBody.external_id || null;
      latestBookingDataForAdminError = { ...latestBookingDataForAdminError, parsed_body: parsedRequestBody };
    } catch (parseError: unknown) {
      console.error('Failed to parse request JSON:', parseError);
      const errDetails: ErrorLogDetails = { message: 'Failed to parse request JSON' };
      if (parseError instanceof Error) { 
        errDetails.message = parseError.message; 
        errDetails.name = parseError.name; 
        errDetails.stack = parseError.stack; 
      }
      await sendAdminErrorEmail(
        "Fallimento parsing JSON richiesta cancellazione",
        "N/A - Errore parsing body richiesta",
        latestBookingDataForAdminError,
        errDetails
      );
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const external_id = external_id_from_request;
    latestBookingDataForAdminError = { ...latestBookingDataForAdminError, external_id_from_request: external_id };

    if (!external_id) {
      await sendAdminErrorEmail(
        "ID Esterno mancante nella richiesta di cancellazione",
        "N/A - ID Esterno mancante",
        latestBookingDataForAdminError,
        { message: "external_id was missing or null", name: "ValidationError" }
      );
      return NextResponse.json(
        { error: 'Booking ID (external_id) is required' },
        { status: 400 }
      );
    }

    const { data: booking, error: bookingError } = await supabase
      .from('Basket')
      .select('*')
      .eq('external_id', external_id)
      .single<BookingContextData>();
    
    latestBookingDataForAdminError = booking || { ...latestBookingDataForAdminError, external_id_searched: external_id };

    if (bookingError || !booking) {
      console.error('Error fetching booking or booking not found:', bookingError);
      const errDetails: ErrorLogDetails = { 
        message: bookingError?.message || "Booking data was null after fetch",
        name: 'FetchBookingError',
        ...(bookingError && { supabaseError: bookingError }) // Add full Supabase error if present
      };
      await sendAdminErrorEmail(
        "Prenotazione non trovata o errore nel fetch",
        "N/A - Errore fetch booking",
        latestBookingDataForAdminError,
        errDetails
      );
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    if (booking.isCancelled) {
      return NextResponse.json(
        { error: 'Booking is already cancelled' },
        { status: 400 }
      );
    }

    const cancellationTimestampISO = new Date().toISOString();
    const formattedCancellationDateTime = new Date(cancellationTimestampISO).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' });

    if (booking.isCreatedByAdmin) {
      const { error: updateError } = await supabase
        .from('Basket')
        .update({ isCancelled: true, updatedAt: cancellationTimestampISO, isCancelledAtTime: cancellationTimestampISO })
        .eq('external_id', external_id);

      if (updateError) {
        console.error('Error updating admin booking status:', updateError);
        const errDetails: ErrorLogDetails = {
          message: updateError.message,
          name: "AdminBookingUpdateError",
          supabaseError: updateError
        };
        await sendAdminErrorEmail(
          "Fallimento aggiornamento DB per cancellazione prenotazione Admin",
          "N/A - Errore DB update",
          booking,
          errDetails
        );
        return NextResponse.json(
          { error: 'Failed to update booking status for admin booking' },
          { status: 500 }
        );
      }

      if (booking.mail) {
        const emailSubject = "Conferma Cancellazione Prenotazione (Admin) - Rifugio Dibona";
        const emailHtmlBody = 
          `<p>Gentile ${booking.name || 'Admin'},</p>
          <p>La prenotazione #${booking.id} (ID Esterno: ${booking.external_id}) da lei creata come amministratore presso il Rifugio Angelo Dibona è stata cancellata come da richiesta.</p>
          <p>Data e ora della cancellazione: ${formattedCancellationDateTime}.</p>
          <p>Trattandosi di una prenotazione creata dall'amministratore, non sono previsti rimborsi tramite questo processo.</p>
          <p>Può visualizzare i dettagli della prenotazione cancellata tramite i sistemi di amministrazione.</p>
          <p>Cordiali saluti,</p><p>Il Team del Rifugio Angelo Dibona</p>`;
        const emailPlainTextBody = htmlToPlainText(emailHtmlBody);
        await sendNotificationEmail(
            booking.mail, 
            emailSubject, 
            emailHtmlBody,
            emailPlainTextBody,
            { type: 'Admin Booking Cancellation User Email', bookingData: { id: booking.id, external_id: booking.external_id, user_email: booking.mail } }
        );
      }
      return NextResponse.json({ success: true, isAdminBooking: true, message: 'Prenotazione creata dall\'amministratore è stata cancellata.'});
    }

    // Check: la prenotazione deve essere pagata e avere info di pagamento (Stripe O Nexi)
    const hasPaymentInfo = booking.paymentIntentId || booking.nexiOrderId;
    if (!booking.isPaid || !hasPaymentInfo) {
       await sendAdminErrorEmail(
        "Tentativo cancellazione prenotazione non pagata o senza info pagamento",
        "N/A - Booking not paid/no payment info",
        booking,
        { message: "Booking not paid or missing payment information", name: "PaymentValidationError", isPaid: booking.isPaid, paymentIntentId: booking.paymentIntentId, nexiOrderId: booking.nexiOrderId }
      );
      return NextResponse.json(
        { error: 'Booking is not paid or missing payment information for refund processing' },
        { status: 400 }
      );
    }

    let refundAmount = 0;
    let refundPercentage = 0;
    const checkInDate = new Date(booking.dayFrom!); // Added non-null assertion, ensure dayFrom is present
    checkInDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const timeDifference = checkInDate.getTime() - today.getTime();
    const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));

    if (daysDifference >= 7) refundPercentage = 1;
    else if (daysDifference >= 1) refundPercentage = 0.7;
    else refundPercentage = 0;

    // ========================================================================
    // NEXI REFUND FLOW
    // ========================================================================
    if (refundPercentage > 0 && booking.nexiOrderId) {
      try {
        refundAmount = booking.totalPrice! * refundPercentage;
        await createNexiRefund({
          codiceTransazione: booking.nexiOrderId,  // Il codTrans usato nel pagamento
          amount: refundAmount,
          description: 'Refund - Cancellazione prenotazione'
        });
        console.log(`Nexi refund processed: ${refundAmount}€ for booking ${booking.external_id}`);
      } catch (refundError: unknown) {
        console.error('Error processing Nexi refund:', refundError);
        const errDetails: ErrorLogDetails = { message: "Failed to process Nexi refund" };
        if (refundError instanceof Error) { 
            errDetails.message = refundError.message; 
            errDetails.name = refundError.name; 
            errDetails.stack = refundError.stack; 
        } else if (typeof refundError === 'object' && refundError !== null && 'message' in refundError) {
            errDetails.message = String((refundError as {message: string}).message);
        }
        if (!(refundError instanceof Error)) errDetails.nexiError = refundError;

        await sendAdminErrorEmail(
          "Fallimento elaborazione rimborso Nexi",
          "N/A - Nexi refund error",
          booking,
          errDetails
        );
        return NextResponse.json({ error: 'Failed to process refund via Nexi. Please contact support.' }, { status: 500 });
      }
    }
    // ========================================================================
    // STRIPE REFUND FLOW (codice originale INVARIATO)
    // ========================================================================
    else if (refundPercentage > 0 && booking.paymentIntentId) {
      try {
        refundAmount = booking.totalPrice! * refundPercentage; // Added non-null assertion
        await stripe.refunds.create({ payment_intent: booking.paymentIntentId, amount: Math.round(refundAmount * 100), reason: 'requested_by_customer' as const });
      } catch (refundError: unknown) {
        console.error('Error processing Stripe refund:', refundError);
        const errDetails: ErrorLogDetails = { message: "Failed to process Stripe refund" };
        if (refundError instanceof Error) { 
            errDetails.message = refundError.message; 
            errDetails.name = refundError.name; 
            errDetails.stack = refundError.stack; 
        } else if (typeof refundError === 'object' && refundError !== null && 'message' in refundError) {
            errDetails.message = String((refundError as {message: string}).message);
        }
        // If Stripe error has specific structure, extract more details
        // For now, log the whole refundError object if it's not a standard Error instance.
        if (!(refundError instanceof Error)) errDetails.stripeError = refundError;

        await sendAdminErrorEmail(
          "Fallimento elaborazione rimborso Stripe",
          "N/A - Stripe refund error",
          booking,
          errDetails
        );
        return NextResponse.json({ error: 'Failed to process refund via Stripe. Please contact support.' }, { status: 500 });
      }
    }

    const { error: updateError } = await supabase
      .from('Basket')
      .update({ isCancelled: true, updatedAt: cancellationTimestampISO, isCancelledAtTime: cancellationTimestampISO })
      .eq('external_id', external_id);

    if (updateError) {
      console.error('Error updating user booking status:', updateError);
      const errDetails: ErrorLogDetails = {
        message: updateError.message,
        name: "UserBookingUpdateError",
        supabaseError: updateError
      };
      await sendAdminErrorEmail(
        "Fallimento aggiornamento DB per cancellazione prenotazione Utente",
        "N/A - DB update error",
        booking,
        errDetails
      );
      return NextResponse.json({ error: 'Failed to update booking status' }, { status: 500 });
    }

    if (booking.mail) {
      let refundMessageForEmail = "Secondo le nostre politiche di cancellazione, non è previsto alcun rimborso per questa prenotazione.";
      if (refundAmount > 0) {
        refundMessageForEmail = `Riceverai un rimborso di €${refundAmount.toFixed(2)} secondo le nostre politiche. L'accredito avverrà nei tempi tecnici previsti dal tuo istituto bancario.`;
      } else if (refundPercentage > 0 && refundAmount === 0) {
        refundMessageForEmail = "La tua prenotazione è idonea per un rimborso, ma l'importo calcolato è zero. Contatta l'assistenza se ritieni sia un errore.";
      }

      const emailSubject = "Conferma Cancellazione Prenotazione - Rifugio Dibona";
      const emailHtmlBody = 
`        <p>Gentile ${booking.name || 'Ospite'},</p>
        <p>La tua prenotazione #${booking.id} (ID Esterno: ${booking.external_id}) presso il Rifugio Angelo Dibona è stata cancellata con successo come da tua richiesta.</p>
        <p>Data e ora della cancellazione: ${formattedCancellationDateTime}.</p>
        <p>${refundMessageForEmail}</p>
        <p>Puoi visualizzare i dettagli della tua prenotazione cancellata al seguente link: <a href="${APP_BASE_URL}/cart/${booking.external_id}">Dettagli Prenotazione</a></p>
        <p>Se hai domande, non esitare a contattarci.</p>
        <p>Grazie,</p><p>Il Team del Rifugio Angelo Dibona</p>`;
      const emailPlainTextBody = htmlToPlainText(emailHtmlBody);
      await sendNotificationEmail(
        booking.mail, 
        emailSubject, 
        emailHtmlBody,
        emailPlainTextBody,
        { 
          type: 'User Booking Cancellation User Email', 
          bookingData: { id: booking.id, external_id: booking.external_id, user_email: booking.mail, refund_amount: refundAmount },
          // No specific errorDetails here as this is a success path for email sending
        }
      );
    }

    return NextResponse.json({ success: true, refundAmount, refundPercentage });

  } catch (error: unknown) {
    console.error('Critical error in cancel-booking route:', error);
    const finalErrorContext = typeof latestBookingDataForAdminError === 'object' && latestBookingDataForAdminError !== null && Object.keys(latestBookingDataForAdminError).length > 0
        ? latestBookingDataForAdminError 
        : { error_context: 'Error before/during JSON parsing or external_id extraction', raw_body_on_error: requestBodyText };

    const errDetails: ErrorLogDetails = { message: 'Critical Error' };
    if (error instanceof Error) {
      errDetails.message = error.message;
      errDetails.name = error.name;
      errDetails.stack = error.stack;
    } else if (typeof error === 'object' && error !== null && 'message' in error) {
      errDetails.message = String((error as {message: string}).message);
    }

    await sendAdminErrorEmail(
      `Errore Critico: ${errDetails.message}`,
      `Contesto Errore: ${errDetails.message}`,
      finalErrorContext,
      errDetails
    );

    return NextResponse.json(
      { error: 'Failed to cancel booking due to a critical server error.' },
      { status: 500 }
    );
  }
} 