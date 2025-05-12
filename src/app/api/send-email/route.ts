import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
// Import specific response types from Resend for clarity and type safety
import type { CreateEmailOptions, CreateEmailResponse } from 'resend';

// Inizializza Resend con la chiave API dall'environment variable
const resend = new Resend(process.env.RESEND_API_KEY || process.env.RESEND);

// Basic shape for Resend API errors if more specific types are problematic
interface ResendApiError {
  name: string;
  message: string;
  statusCode?: number; // Making statusCode optional for broader compatibility
}

// Helper function to log email attempt - FIRE AND FORGET
async function logEmailAttempt(payload: {
  subject?: string | null;
  to?: string | null;
  mail_body?: string | null;
  status: string; // e.g., "SUCCESS", "RESEND_ERROR", "VALIDATION_ERROR", "UNEXPECTED_ERROR"
  email_id?: string | null;
  error_message?: string | null;
  error_name?: string | null;
}) {
  try {
    // Construct the full URL for the log API endpoint
    // Assuming the app runs on localhost:3000 or a similar base URL in development
    // In production, this needs to be the absolute URL of your deployment
    const logApiUrl = new URL('/api/log-email-attempt', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').toString();
    
    console.log(`[send-email] Logging attempt to: ${logApiUrl} with payload:`, payload);
    
    fetch(logApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        sent_time: new Date().toISOString(), // The log API expects sent_time
      }),
    }).catch(logError => {
      // Log errors from the fetch call itself (e.g., network error)
      console.error('[send-email] Error calling log-email-attempt API:', logError);
    });
  } catch (e: unknown) {
    console.error('[send-email] Unexpected error in logEmailAttempt function:', e);
  }
}

export async function POST(request: NextRequest) {
  console.log('[send-email] Received POST request');
  let to: string | undefined;
  let subject: string | undefined;
  let html: string | undefined;
  let text: string | undefined;

  try {
    const requestBody = await request.json();
    console.log('[send-email] Parsed request body:', requestBody);

    ({ to, subject, html, text } = requestBody as { to: string; subject: string; html?: string; text?: string });

    if (!to || !subject) {
      console.error('[send-email] Validation Error: Missing to or subject', { to, subject });
      // Fire-and-forget logging for validation error
      logEmailAttempt({
        to: to || null,
        subject: subject || null,
        mail_body: html || text || null,
        status: 'VALIDATION_ERROR',
        error_message: 'Destinatario (to) e oggetto (subject) sono obbligatori',
        error_name: 'Validation Error'
      });
      return NextResponse.json(
        { error: 'Destinatario (to) e oggetto (subject) sono obbligatori' },
        { status: 400 }
      );
    }
    if (!html && !text) {
      console.error('[send-email] Validation Error: Missing html and text body');
      // Fire-and-forget logging for validation error
      logEmailAttempt({
        to,
        subject,
        mail_body: null,
        status: 'VALIDATION_ERROR',
        error_message: 'È necessario fornire almeno un corpo del messaggio (html o text)',
        error_name: 'Validation Error'
      });
      return NextResponse.json(
        { error: 'È necessario fornire almeno un corpo del messaggio (html o text)' },
        { status: 400 }
      );
    }

    const emailPayloadBase = {
      from: 'Rifugio Di Bona <noreply@rifugiodibona.app>',
      to: [to!], // to is validated to be present here
      subject: subject!, // subject is validated to be present here
    };

    let emailPayload: CreateEmailOptions;
    // Construct payload based on whether html or text (or both) are provided
    if (html && text) {
      emailPayload = { ...emailPayloadBase, html: html, text: text };
    } else if (html) {
      emailPayload = { ...emailPayloadBase, html: html };
    } else if (text) {
      emailPayload = { ...emailPayloadBase, text: text };
    } else {
      // This case should be caught by the validation above, but as a safeguard:
      const internalErrorMsg = 'Internal Error: No email body (html or text) available after validation';
      console.error(`[send-email] ${internalErrorMsg}`);
      logEmailAttempt({
        to,
        subject,
        status: 'INTERNAL_SERVER_ERROR',
        error_message: internalErrorMsg,
        error_name: 'Internal Logic Error'
      });
      return NextResponse.json({ error: 'Internal server error: No email body for Resend' }, { status: 500 });
    }

    console.log('[send-email] Payload being sent to Resend:', JSON.stringify(emailPayload, null, 2));

    const response: CreateEmailResponse = await resend.emails.send(emailPayload);

    if (response.error) {
      const errorDetails = response.error as ResendApiError;
      console.error('[send-email] Error response from Resend SDK:', JSON.stringify(errorDetails, null, 2));
      
      let httpStatusCode = errorDetails.statusCode || 500;
      if (errorDetails.name === 'validation_error') {
        httpStatusCode = 422;
      }

      // Fire-and-forget logging for Resend error
      logEmailAttempt({
        to: emailPayload.to ? String(emailPayload.to) : null,
        subject: emailPayload.subject,
        mail_body: emailPayload.html || emailPayload.text || null,
        status: 'RESEND_ERROR',
        email_id: null, // No email_id from Resend on error
        error_message: errorDetails.message,
        error_name: errorDetails.name
      });

      return NextResponse.json(
        { error: 'Errore durante l\'invio dell\'email via Resend', details: errorDetails.message, name: errorDetails.name },
        { status: httpStatusCode }
      );
    }

    console.log('[send-email] Success response from Resend SDK:', JSON.stringify(response.data, null, 2));
    
    // Fire-and-forget logging for success
    if (response.data) {
      logEmailAttempt({
        to: emailPayload.to ? String(emailPayload.to) : null,
        subject: emailPayload.subject,
        mail_body: emailPayload.html || emailPayload.text || null,
        status: 'SUCCESS',
        email_id: response.data.id,
      });
    }

    return NextResponse.json({ success: true, data: response.data });

  } catch (unexpectedError: unknown) {
    console.error('[send-email] Unexpected error in POST handler:', unexpectedError);
    let message = 'An unexpected error occurred during email processing.';
    let errorName = 'UnknownError';
    if (unexpectedError instanceof Error) {
      message = unexpectedError.message;
      errorName = unexpectedError.name;
    }

    // Fire-and-forget logging for unexpected error
    logEmailAttempt({
      to: to || null, // Use the 'to' from the outer scope if available
      subject: subject || null, // Use the 'subject' from the outer scope if available
      mail_body: html || text || null, // Use html/text from outer scope if available
      status: 'UNEXPECTED_ERROR',
      error_message: message,
      error_name: errorName
    });

    return NextResponse.json(
      { error: 'Errore server inatteso durante l\'invio dell\'email', details: message },
      { status: 500 }
    );
  }
} 