import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Stripe from 'stripe';
import { createBooking } from '@/app/utils/bookingCreation';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia'
});


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
        bookingId: basket.external_id // Assicurati che questo sia l'ID univoco della prenotazione
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      // customer_creation: 'always', // Considera 'if_required' se hai già clienti Stripe
      expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
      locale: 'it'
    });
    console.log('Stripe session created:', session.id);

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

    return NextResponse.json({ 
      success: true, 
      sessionId: session.id,
      basketId: basket.id // Restituisci basket.id se serve al frontend
    });

  } catch (error) {
    console.error('Error in create-booking route:', error);
    // Aggiungi un logging più dettagliato dell'errore se possibile
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create booking', details: errorMessage },
      { status: 500 }
    );
  }
} 