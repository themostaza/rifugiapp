import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Stripe from 'stripe';
import { createNexiRefund } from '@/lib/payment/nexi-client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia'
});

const APP_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.rifugiodibona.com';
const ADMIN_EMAIL = 'paolo@larin.it';

// Interface for bed removal request
interface RemoveBedsRequest {
  external_id: string;
  bedsToRemove: number[]; // Array of RoomReservationSpec IDs to remove
}

// Interface for bed specifications with relations
interface BedSpecWithRelations {
  id: number;
  price: number;
  roomLinkBedId: number;
  RoomLinkBed: {
    id: number;
    name: string;
    Room: {
      id: number;
      description: string;
    };
  };
  GuestDivision: {
    id: number;
    title: string;
  };
}

// Basic type for booking data
interface BookingContextData {
  id?: number;
  external_id?: string | null;
  mail?: string | null;
  name?: string | null;
  isPaid?: boolean;
  paymentIntentId?: string | null;
  isCreatedByAdmin?: boolean;
  dayFrom?: string;
  totalPrice?: number;
  isCancelled?: boolean;
  // Nexi fields
  nexiOperationId?: string | null;
  nexiOrderId?: string | null;
  nexiSecurityToken?: string | null;
  nexiPaymentCircuit?: string | null;
  [key: string]: unknown;
}

// Type for error objects
interface ErrorLogDetails {
  message: string;
  name?: string;
  stack?: string;
  [key: string]: unknown;
}

// Helper function to convert HTML to plain text
function htmlToPlainText(html: string): string {
  if (!html) return '';
  let text = html.replace(/<[^>]*>/g, ' ');
  text = text.replace(/&nbsp;/gi, ' ')
             .replace(/&amp;/gi, '&')
             .replace(/&quot;/gi, '"')
             .replace(/&lt;/gi, '<')
             .replace(/&gt;/gi, '>')
             .replace(/&apos;/gi, "'");
  text = text.replace(/\s\s+/g, ' ').trim();
  text = text.replace(/\n\s*\n/g, '\n\n');
  return text;
}

// Helper function to send emails
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
        contextForAdminError.bookingData || { note: "Nessun dettaglio booking disponibile" },
        {
          ...(contextForAdminError.errorDetails || { message: 'Error details missing', name: 'MissingContextError'}),
          reason: `Recipient email was null or empty for context: ${contextForAdminError.type}` 
        }
      );
    }
    return false;
  }

  const apiPath = '/api/send-email';
  try {
    const fetchUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}${apiPath}` : apiPath;
    
    const emailPayload = { to, subject, html: htmlBody, text: plainTextBody };
    const emailResponse = await fetch(fetchUrl, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(emailPayload) 
    });

    if (!emailResponse.ok) {
      const errorDataJson = await emailResponse.json().catch(() => ({ 
        message: 'Failed to parse error response from send-email API', 
        name: 'ParseError' 
      }));
      const errorData: ErrorLogDetails = typeof errorDataJson === 'object' && errorDataJson !== null 
        ? errorDataJson as ErrorLogDetails 
        : { message: 'Malformed error response from send-email API', name:'MalformedResponseError'};
      
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

// Helper function to send admin error emails
async function sendAdminErrorEmail(
  contextMessage: string, 
  emailContentAttempt: string, 
  bookingAttemptData: BookingContextData | Record<string, unknown>, 
  errorDetailsInput: ErrorLogDetails | Record<string, unknown>
) {
  const subject = "Errore in piattaforma RifugioDibona: rimozione letti in errore";
  
  const safeErrorDetails: ErrorLogDetails = 
    (typeof errorDetailsInput === 'object' && errorDetailsInput !== null && 'message' in errorDetailsInput && typeof errorDetailsInput.message === 'string')
    ? errorDetailsInput as ErrorLogDetails 
    : { message: 'Provided errorDetails was not in expected format', name: 'ErrorFormatIssue', originalError: errorDetailsInput };

  const htmlAdminBody = `
    <h1>Errore durante il processo di rimozione letti</h1>
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
  
  let effectiveBookingDataForAdminContext: BookingContextData | Record<string, unknown>;
  if (typeof bookingAttemptData === 'object' && bookingAttemptData !== null && ('id' in bookingAttemptData || 'external_id' in bookingAttemptData) ) {
    effectiveBookingDataForAdminContext = bookingAttemptData as BookingContextData;
  } else {
    effectiveBookingDataForAdminContext = { note: "Booking data for context was not a BookingContextData instance or was minimal." , originalData: bookingAttemptData };
  }

  await sendNotificationEmail(ADMIN_EMAIL, subject, htmlAdminBody, plainTextAdminBody, {
    type: 'Admin Error Notification Failed SelfSend',
    bookingData: effectiveBookingDataForAdminContext,
    errorDetails: safeErrorDetails
  });
}

export async function POST(request: Request) {
  let external_id_from_request: string | null = null;
  let parsedRequestBody: RemoveBedsRequest | Record<string, unknown> = {};
  let requestBodyText: string = '';
  let latestBookingDataForAdminError: BookingContextData | Record<string, unknown> = { note: 'Initial state' };

  try {
    const requestCloneForBodyText = request.clone();
    requestBodyText = await requestCloneForBodyText.text().catch(() => 'Could not read request body');
    latestBookingDataForAdminError = { raw_body_on_error: requestBodyText };

    try {
      parsedRequestBody = await request.json() as RemoveBedsRequest;
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
        "Fallimento parsing JSON richiesta rimozione letti",
        "N/A - Errore parsing body richiesta",
        latestBookingDataForAdminError,
        errDetails
      );
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const external_id = external_id_from_request;
    const bedsToRemove = (parsedRequestBody as RemoveBedsRequest).bedsToRemove;

    latestBookingDataForAdminError = { ...latestBookingDataForAdminError, external_id_from_request: external_id, bedsToRemove };

    if (!external_id) {
      await sendAdminErrorEmail(
        "ID Esterno mancante nella richiesta di rimozione letti",
        "N/A - ID Esterno mancante",
        latestBookingDataForAdminError,
        { message: "external_id was missing or null", name: "ValidationError" }
      );
      return NextResponse.json(
        { error: 'Booking ID (external_id) is required' },
        { status: 400 }
      );
    }

    if (!bedsToRemove || !Array.isArray(bedsToRemove) || bedsToRemove.length === 0) {
      await sendAdminErrorEmail(
        "Lista letti da rimuovere mancante o vuota",
        "N/A - Beds to remove missing",
        latestBookingDataForAdminError,
        { message: "bedsToRemove was missing, null, or empty", name: "ValidationError" }
      );
      return NextResponse.json(
        { error: 'Beds to remove list is required' },
        { status: 400 }
      );
    }

    // Fetch booking details
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
        ...(bookingError && { supabaseError: bookingError })
      };
      await sendAdminErrorEmail(
        "Prenotazione non trovata o errore nel fetch per rimozione letti",
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
        { error: 'Cannot remove beds from cancelled booking' },
        { status: 400 }
      );
    }

    // Fetch the bed specifications to calculate refund amount
    const { data: bedSpecs, error: bedSpecsError } = await supabase
      .from('RoomReservationSpec')
      .select(`
        id,
        price,
        roomLinkBedId,
        RoomLinkBed!inner (
          id,
          name,
          Room!inner (
            id,
            description
          )
        ),
        GuestDivision!inner (
          id,
          title
        )
      `)
      .in('id', bedsToRemove) as { data: BedSpecWithRelations[] | null, error: unknown };

    if (bedSpecsError || !bedSpecs || bedSpecs.length === 0) {
      console.error('Error fetching bed specifications:', bedSpecsError);
      const errDetails: ErrorLogDetails = {
        message: (bedSpecsError && typeof bedSpecsError === 'object' && bedSpecsError !== null && 'message' in bedSpecsError && typeof bedSpecsError.message === 'string') 
          ? bedSpecsError.message 
          : "No bed specs found for the provided IDs",
        name: 'FetchBedSpecsError'
      };
      if (bedSpecsError) {
        errDetails.supabaseError = bedSpecsError;
      }
      await sendAdminErrorEmail(
        "Specifiche letti non trovate o errore nel fetch",
        "N/A - Errore fetch bed specs",
        booking,
        errDetails
      );
      return NextResponse.json(
        { error: 'Bed specifications not found' },
        { status: 404 }
      );
    }

    // Calculate total amount to be refunded
    const totalBedAmount = bedSpecs.reduce((sum, spec) => sum + (spec.price || 0), 0);

    if (totalBedAmount <= 0) {
      return NextResponse.json(
        { error: 'No refundable amount found for selected beds' },
        { status: 400 }
      );
    }

    const removalTimestampISO = new Date().toISOString();
    const formattedRemovalDateTime = new Date(removalTimestampISO).toLocaleString('it-IT', { 
      dateStyle: 'long', 
      timeStyle: 'short' 
    });

    let refundAmount = 0;
    let refundPercentage = 0;

    // Apply the same refund policy as booking cancellation for admin bookings
    if (booking.isCreatedByAdmin) {
      // Admin bookings: no refund
      refundPercentage = 0;
    } else {
      // Regular bookings: apply same refund logic as cancellation
      // Check: deve avere info pagamento (Stripe O Nexi)
      const hasPaymentInfo = booking.paymentIntentId || booking.nexiOperationId;
      if (!booking.isPaid || !hasPaymentInfo) {
        await sendAdminErrorEmail(
          "Tentativo rimozione letti da prenotazione non pagata o senza info pagamento",
          "N/A - Booking not paid/no payment info",
          booking,
          { 
            message: "Booking not paid or missing payment information", 
            name: "PaymentValidationError", 
            isPaid: booking.isPaid, 
            paymentIntentId: booking.paymentIntentId,
            nexiOperationId: booking.nexiOperationId
          }
        );
        return NextResponse.json(
          { error: 'Booking is not paid or missing payment information for refund processing' },
          { status: 400 }
        );
      }

      // Calculate refund percentage based on check-in date
      const checkInDate = new Date(booking.dayFrom!);
      checkInDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const timeDifference = checkInDate.getTime() - today.getTime();
      const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));

      if (daysDifference >= 7) refundPercentage = 1;
      else if (daysDifference >= 1) refundPercentage = 0.7;
      else refundPercentage = 0;

      // ======================================================================
      // NEXI PARTIAL REFUND FLOW
      // ======================================================================
      if (refundPercentage > 0 && booking.nexiOperationId) {
        try {
          refundAmount = totalBedAmount * refundPercentage;
          await createNexiRefund({
            operationId: booking.nexiOperationId,
            amount: refundAmount,
            description: 'Partial refund - Rimozione letti'
          });
          console.log(`Nexi partial refund processed: ${refundAmount}€ for booking ${booking.external_id}`);
        } catch (refundError: unknown) {
          console.error('Error processing Nexi partial refund:', refundError);
          const errDetails: ErrorLogDetails = { message: "Failed to process Nexi partial refund" };
          if (refundError instanceof Error) { 
            errDetails.message = refundError.message; 
            errDetails.name = refundError.name; 
            errDetails.stack = refundError.stack; 
          } else if (typeof refundError === 'object' && refundError !== null && 'message' in refundError) {
            errDetails.message = String((refundError as {message: string}).message);
          }
          if (!(refundError instanceof Error)) errDetails.nexiError = refundError;

          await sendAdminErrorEmail(
            "Fallimento elaborazione rimborso parziale Nexi",
            "N/A - Nexi partial refund error",
            booking,
            errDetails
          );
          return NextResponse.json({ 
            error: 'Failed to process partial refund via Nexi. Please contact support.' 
          }, { status: 500 });
        }
      }
      // ======================================================================
      // STRIPE PARTIAL REFUND FLOW (codice originale INVARIATO)
      // ======================================================================
      else if (refundPercentage > 0 && booking.paymentIntentId) {
        try {
          refundAmount = totalBedAmount * refundPercentage;
          await stripe.refunds.create({ 
            payment_intent: booking.paymentIntentId, 
            amount: Math.round(refundAmount * 100), 
            reason: 'requested_by_customer' as const 
          });
        } catch (refundError: unknown) {
          console.error('Error processing Stripe partial refund:', refundError);
          const errDetails: ErrorLogDetails = { message: "Failed to process Stripe partial refund" };
          if (refundError instanceof Error) { 
            errDetails.message = refundError.message; 
            errDetails.name = refundError.name; 
            errDetails.stack = refundError.stack; 
          } else if (typeof refundError === 'object' && refundError !== null && 'message' in refundError) {
            errDetails.message = String((refundError as {message: string}).message);
          }
          if (!(refundError instanceof Error)) errDetails.stripeError = refundError;

          await sendAdminErrorEmail(
            "Fallimento elaborazione rimborso parziale Stripe",
            "N/A - Stripe partial refund error",
            booking,
            errDetails
          );
          return NextResponse.json({ 
            error: 'Failed to process partial refund via Stripe. Please contact support.' 
          }, { status: 500 });
        }
      }
    }

    // Remove the bed specifications from database
    const { error: removeSpecsError } = await supabase
      .from('RoomReservationSpec')
      .delete()
      .in('id', bedsToRemove);

    if (removeSpecsError) {
      console.error('Error removing bed specifications:', removeSpecsError);
      const errDetails: ErrorLogDetails = {
        message: removeSpecsError.message,
        name: "RemoveSpecsError",
        supabaseError: removeSpecsError
      };
      await sendAdminErrorEmail(
        "Fallimento rimozione specifiche letti dal DB",
        "N/A - DB remove specs error",
        booking,
        errDetails
      );
      return NextResponse.json(
        { error: 'Failed to remove bed specifications' },
        { status: 500 }
      );
    }

    // Update booking total price
    const newTotalPrice = (booking.totalPrice || 0) - totalBedAmount;
    const { error: updatePriceError } = await supabase
      .from('Basket')
      .update({ 
        totalPrice: newTotalPrice,
        updatedAt: removalTimestampISO
      })
      .eq('external_id', external_id);

    if (updatePriceError) {
      console.error('Error updating booking total price:', updatePriceError);
      const errDetails: ErrorLogDetails = {
        message: updatePriceError.message,
        name: "UpdatePriceError",
        supabaseError: updatePriceError
      };
      await sendAdminErrorEmail(
        "Fallimento aggiornamento prezzo totale prenotazione",
        "N/A - DB update price error",
        booking,
        errDetails
      );
      return NextResponse.json(
        { error: 'Failed to update booking price' },
        { status: 500 }
      );
    }

    // Send confirmation email
    if (booking.mail) {
      const bedsList = bedSpecs.map(spec => 
        `${spec.GuestDivision.title} - ${spec.RoomLinkBed.name} (${spec.RoomLinkBed.Room.description})`
      ).join(', ');

      let refundMessageForEmail = "Secondo le nostre politiche di cancellazione, non è previsto alcun rimborso per la rimozione di questi letti.";
      if (refundAmount > 0) {
        refundMessageForEmail = `Riceverai un rimborso parziale di €${refundAmount.toFixed(2)} secondo le nostre politiche. L'accredito avverrà nei tempi tecnici previsti dal tuo istituto bancario.`;
      } else if (refundPercentage > 0 && refundAmount === 0) {
        refundMessageForEmail = "La rimozione dei letti è idonea per un rimborso, ma l'importo calcolato è zero. Contatta l'assistenza se ritieni sia un errore.";
      }

      const emailSubject = "Conferma Rimozione Letti - Rifugio Dibona";
      const emailHtmlBody = `
        <p>Gentile ${booking.name || 'Ospite'},</p>
        <p>I seguenti letti sono stati rimossi dalla tua prenotazione #${booking.id} (ID Esterno: ${booking.external_id}) presso il Rifugio Angelo Dibona:</p>
        <p><strong>Letti rimossi:</strong> ${bedsList}</p>
        <p>Data e ora della rimozione: ${formattedRemovalDateTime}.</p>
        <p><strong>Nuovo totale prenotazione:</strong> €${newTotalPrice.toFixed(2)}</p>
        <p>${refundMessageForEmail}</p>
        <p>Puoi visualizzare i dettagli aggiornati della tua prenotazione al seguente link: <a href="${APP_BASE_URL}/cart/${booking.external_id}">Dettagli Prenotazione</a></p>
        <p>Se hai domande, non esitare a contattarci.</p>
        <p>Grazie,</p><p>Il Team del Rifugio Angelo Dibona</p>
      `;
      const emailPlainTextBody = htmlToPlainText(emailHtmlBody);
      
      await sendNotificationEmail(
        booking.mail, 
        emailSubject, 
        emailHtmlBody,
        emailPlainTextBody,
        { 
          type: 'Bed Removal Confirmation Email', 
          bookingData: { 
            id: booking.id, 
            external_id: booking.external_id, 
            user_email: booking.mail, 
            partial_refund_amount: refundAmount,
            removed_beds_count: bedsToRemove.length
          }
        }
      );
    }

    return NextResponse.json({ 
      success: true, 
      refundAmount, 
      refundPercentage,
      removedBedsCount: bedsToRemove.length,
      newTotalPrice,
      isAdminBooking: booking.isCreatedByAdmin || false
    });

  } catch (error: unknown) {
    console.error('Critical error in remove-beds route:', error);
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
      `Errore Critico rimozione letti: ${errDetails.message}`,
      `Contesto Errore: ${errDetails.message}`,
      finalErrorContext,
      errDetails
    );

    return NextResponse.json(
      { error: 'Failed to remove beds due to a critical server error.' },
      { status: 500 }
    );
  }
} 