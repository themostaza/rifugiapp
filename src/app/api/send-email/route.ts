import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
// Import specific response types from Resend for clarity and type safety
import type { CreateEmailOptions, CreateEmailResponse } from 'resend';

// Inizializza Resend con la chiave API dall'environment variable
const resend = new Resend(process.env.RESEND);

// Basic shape for Resend API errors if more specific types are problematic
interface ResendApiError {
  name: string;
  message: string;
  statusCode?: number; // Making statusCode optional for broader compatibility
}

export async function POST(request: NextRequest) {
  console.log('[send-email] Received POST request');
  try {
    const requestBody = await request.json();
    console.log('[send-email] Parsed request body:', requestBody);

    const { to, subject, html, text } = requestBody as { to: string; subject: string; html?: string; text?: string };

    if (!to || !subject) {
      console.error('[send-email] Validation Error: Missing to or subject', { to, subject });
      return NextResponse.json(
        { error: 'Destinatario (to) e oggetto (subject) sono obbligatori' },
        { status: 400 }
      );
    }
    if (!html && !text) {
      console.error('[send-email] Validation Error: Missing html and text body');
      return NextResponse.json(
        { error: 'È necessario fornire almeno un corpo del messaggio (html o text)' },
        { status: 400 }
      );
    }

    const emailPayloadBase = {
      from: 'Rifugio Di Bona <noreply@rifugiodibona.app>',
      to: [to],
      subject: subject,
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
      // This case should be caught by the validation above
      console.error('[send-email] Internal Error: No email body (html or text) available after validation for Resend payload');
      return NextResponse.json({ error: 'Internal server error: No email body for Resend' }, { status: 500 });
    }

    console.log('[send-email] Payload being sent to Resend:', JSON.stringify(emailPayload, null, 2));

    const response: CreateEmailResponse = await resend.emails.send(emailPayload);

    if (response.error) {
      // Assert to a known basic error shape for accessing properties
      const errorDetails = response.error as ResendApiError;
      console.error('[send-email] Error response from Resend SDK:', JSON.stringify(errorDetails, null, 2));
      
      let httpStatusCode = errorDetails.statusCode || 500;
      if (errorDetails.name === 'validation_error') {
        httpStatusCode = 422;
      }

      return NextResponse.json(
        { error: 'Errore durante l\'invio dell\'email via Resend', details: errorDetails.message, name: errorDetails.name },
        { status: httpStatusCode }
      );
    }

    console.log('[send-email] Success response from Resend SDK:', JSON.stringify(response.data, null, 2));
    return NextResponse.json({ success: true, data: response.data });

  } catch (unexpectedError: unknown) {
    console.error('[send-email] Unexpected error in POST handler:', unexpectedError);
    let message = 'An unexpected error occurred during email processing.';
    if (unexpectedError instanceof Error) {
      message = unexpectedError.message;
    }
    return NextResponse.json(
      { error: 'Errore server inatteso durante l\'invio dell\'email', details: message },
      { status: 500 }
    );
  }
} 