import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabase } from '@/lib/supabase';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia'
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature found' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.bookingId;
    const originalBookingId = session.metadata?.originalBookingId;

    if (!bookingId) {
      return NextResponse.json(
        { error: 'No booking ID found' },
        { status: 400 }
      );
    }

    switch (event.type) {
      case 'checkout.session.completed':
        // Update booking status to paid
        const { error: updateError } = await supabase
          .from('Basket')
          .update({
            isPaid: true,
            updatedAt: new Date().toISOString()
          })
          .eq('id', bookingId);

        if (updateError) throw updateError;

        // If this was a new booking (not a payment retry), cancel the original booking hold
        if (originalBookingId) {
          await fetch('/api/booking-hold', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              bookingId: originalBookingId, 
              action: 'CANCEL' 
            })
          });
        }
        break;

      case 'checkout.session.expired':
        // Update booking status to cancelled
        const { error: cancelError } = await supabase
          .from('Basket')
          .update({
            isCancelled: true,
            updatedAt: new Date().toISOString()
          })
          .eq('id', bookingId);

        if (cancelError) throw cancelError;
        break;

      // Add other event types as needed
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
} 