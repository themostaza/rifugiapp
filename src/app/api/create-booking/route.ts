import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Stripe from 'stripe';
import { createBooking } from '@/app/utils/bookingCreation';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia'
});

// Helper function to convert simple HTML to plain text (copied from cancel-booking)
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
  // Normalize whitespace
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
    checkOut:string;
    external_id: string;
  }
) {
  const subject = 'La tua prenotazione al Rifugio Di Bona è confermata!';
  const bookingUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/cart/${bookingDetails.external_id}`;
  
  const htmlBody = `
    <h1>Prenotazione Confermata!</h1>
    <p>Ciao ${bookingDetails.name || 'Ospite'},</p>
    <p>La tua prenotazione presso il Rifugio Di Bona è stata confermata con successo.</p>
    <p><strong>Dettagli della prenotazione:</strong></p>
    <ul>
      <li>Check-in: ${new Date(bookingDetails.checkIn).toLocaleDateString('it-IT')}</li>
      <li>Check-out: ${new Date(bookingDetails.checkOut).toLocaleDateString('it-IT')}</li>
    </ul>
    <p>Puoi visualizzare i dettagli della tua prenotazione e gestirla al seguente link:</p>
    <p><a href="${bookingUrl}">${bookingUrl}</a></p>
    <p>Grazie per aver scelto il Rifugio Di Bona!</p>
  `;
  const plainTextBody = htmlToPlainText(htmlBody);

  const apiPath = '/api/send-email';
  try {
    const fetchUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}${apiPath}` : apiPath;
    console.log('[create-booking:sendBookingConfirmationEmail] Attempting to call send-email API at URL:', fetchUrl);

    const emailPayload = { to, subject, html: htmlBody, text: plainTextBody };
    const emailResponse = await fetch(fetchUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(emailPayload) });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json().catch(() => ({ message: 'Failed to parse error response from send-email API' }));
      console.error(`Failed to send booking confirmation email to ${to} via ${apiPath}. Status: ${emailResponse.status}`, errorData);
      // Optionally, send an admin error email here if critical
      return false;
    }
    console.log(`Booking confirmation email sent successfully to ${to} with subject: ${subject}`);
    return true;
  } catch (emailError) {
    console.error(`Exception while sending booking confirmation email to ${to} via ${apiPath}:`, emailError);
    // Optionally, send an admin error email here
    return false;
  }
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received booking request body:', body);
    
    // Aggiungo il flag isAdmin = false (è il default, ma lo specifico per chiarezza)
    const bookingData = {
      ...body,
      isAdmin: false
    };

    // Utilizzo la funzione condivisa per creare la prenotazione
    const basket = await createBooking(supabase, bookingData);

    console.log('Creating Stripe checkout session for basket:', basket.id);
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Check-in: ${new Date(body.checkIn).toLocaleDateString()} Check-out: ${new Date(body.checkOut).toLocaleDateString()}`,
            },
            unit_amount: Math.round(body.totalAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cart/${basket.external_id}?payment_status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?step=checkout`,
      customer_email: body.customerEmail,
      metadata: {
        bookingId: basket.external_id
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_creation: 'always',
      expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
      locale: 'it'
    });
    console.log('Stripe session created:', session.id);

    // Update basket with Stripe session ID
    const { error: updateError } = await supabase
      .from('Basket')
      .update({
        stripeId: session.id,
        paymentIntentId: session.payment_intent as string
      })
      .eq('id', basket.id);

    if (updateError) {
      console.error('Error updating basket with Stripe info:', updateError);
      throw updateError;
    }
    console.log('Basket updated with Stripe information');

    // Send booking confirmation email
    try {
      await sendBookingConfirmationEmail(body.customerEmail, {
        name: body.customerName, // Assuming customerName is part of the body
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        external_id: basket.external_id
      });
    } catch (emailError) {
      console.error("Failed to send booking confirmation email:", emailError);
      // Decide if this failure should prevent the success response.
      // For now, we'll log and continue, as the booking and payment are primary.
    }

    return NextResponse.json({ 
      success: true, 
      sessionId: session.id,
      basketId: basket.id
    });

  } catch (error) {
    console.error('Error in create-booking route:', error);
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }
} 