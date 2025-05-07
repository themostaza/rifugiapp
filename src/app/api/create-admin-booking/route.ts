import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createBooking } from '@/app/utils/bookingCreation';

// Helper function to convert simple HTML to plain text
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

// Helper function to send booking confirmation email
async function sendBookingConfirmationEmail(
  to: string,
  bookingDetails: {
    name?: string; 
    checkIn: string;
    checkOut: string;
    external_id: string;
  }
) {
  const subject = 'La tua prenotazione al Rifugio Di Bona è confermata (Admin)!'; // Slight subject change for admin
  const bookingUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/cart/${bookingDetails.external_id}`;
  
  const htmlBody = `
    <h1>Prenotazione Creata (da Admin)!</h1>
    <p>Ciao ${bookingDetails.name || 'Ospite'},</p>
    <p>Una prenotazione a tuo nome presso il Rifugio Di Bona è stata creata dal nostro staff.</p>
    <p><strong>Dettagli della prenotazione:</strong></p>
    <ul>
      <li>Check-in: ${new Date(bookingDetails.checkIn).toLocaleDateString('it-IT')}</li>
      <li>Check-out: ${new Date(bookingDetails.checkOut).toLocaleDateString('it-IT')}</li>
    </ul>
    <p>Puoi visualizzare i dettagli della tua prenotazione al seguente link:</p>
    <p><a href="${bookingUrl}">${bookingUrl}</a></p>
    <p>Per qualsiasi domanda, non esitare a contattarci.</p>
    <p>Staff Rifugio Di Bona</p>
  `;
  const plainTextBody = htmlToPlainText(htmlBody);

  const apiPath = '/api/send-email';
  try {
    const fetchUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}${apiPath}` : apiPath;
    console.log('[create-admin-booking:sendBookingConfirmationEmail] Attempting to call send-email API at URL:', fetchUrl);

    const emailPayload = { to, subject, html: htmlBody, text: plainTextBody };
    const emailResponse = await fetch(fetchUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(emailPayload) });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json().catch(() => ({ message: 'Failed to parse error response from send-email API' }));
      console.error(`Failed to send admin booking confirmation email to ${to} via ${apiPath}. Status: ${emailResponse.status}`, errorData);
      return false;
    }
    console.log(`Admin booking confirmation email sent successfully to ${to} with subject: ${subject}`);
    return true;
  } catch (emailError) {
    console.error(`Exception while sending admin booking confirmation email to ${to} via ${apiPath}:`, emailError);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received admin booking request body:', body);
    
    // Aggiungo il flag isAdmin = true
    const bookingData = {
      ...body,
      isAdmin: true
    };

    // Utilizzo la funzione condivisa per creare la prenotazione
    const basket = await createBooking(supabase, bookingData);

    // Send booking confirmation email
    try {
      await sendBookingConfirmationEmail(body.customerEmail, { // Assuming customerEmail is in body
        name: body.customerName, // Assuming customerName is in body
        checkIn: body.checkIn,   // Assuming checkIn is in body
        checkOut: body.checkOut, // Assuming checkOut is in body
        external_id: basket.external_id
      });
    } catch (emailError) {
      console.error("Failed to send admin booking confirmation email:", emailError);
      // Log and continue, booking creation is primary.
    }

    // Return the booking ID for redirection to the confirmation page
    return NextResponse.json({ 
      success: true, 
      bookingId: basket.external_id
    });

  } catch (error) {
    console.error('Error in create-admin-booking route:', error);
    return NextResponse.json(
      { error: 'Failed to create admin booking' },
      { status: 500 }
    );
  }
} 