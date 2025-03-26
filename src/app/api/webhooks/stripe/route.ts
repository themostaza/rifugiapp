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

    if (!bookingId) {
      return NextResponse.json(
        { error: 'No booking ID found' },
        { status: 400 }
      );
    }

    // Find the booking in the database
    const { error: bookingError } = await supabase
      .from('Basket')
      .select('*')
      .eq('external_id', bookingId)
      .single();

    if (bookingError) {
      console.error('Error fetching booking:', bookingError);
      throw bookingError;
    }

    switch (event.type) {
      case 'checkout.session.completed':
        // Update booking status to paid and store payment intent ID
        const { error: updateError } = await supabase
          .from('Basket')
          .update({
            isPaid: true,
            paymentIntentId: session.payment_intent as string,
            updatedAt: new Date().toISOString()
          })
          .eq('external_id', bookingId);

        if (updateError) {
          console.error('Error updating booking payment status:', updateError);
          throw updateError;
        }
        break;

      case 'checkout.session.expired':
        // Update booking status to cancelled due to expiration
        const { error: expireError } = await supabase
          .from('Basket')
          .update({
            isCancelled: true,
            updatedAt: new Date().toISOString()
          })
          .eq('external_id', bookingId);

        if (expireError) {
          console.error('Error updating booking expiration status:', expireError);
          throw expireError;
        }
        break;

      case 'checkout.session.async_payment_failed':
        // Handle failed payment (e.g., bank transfer failed)
        const { error: failError } = await supabase
          .from('Basket')
          .update({
            isCancelled: true,
            updatedAt: new Date().toISOString()
          })
          .eq('external_id', bookingId);

        if (failError) {
          console.error('Error updating booking failed payment status:', failError);
          throw failError;
        }
        break;

      case 'checkout.session.async_payment_succeeded':
        // Handle successful async payment (e.g., bank transfer succeeded)
        const { error: asyncSuccessError } = await supabase
          .from('Basket')
          .update({
            isPaid: true,
            paymentIntentId: session.payment_intent as string,
            updatedAt: new Date().toISOString()
          })
          .eq('external_id', bookingId);

        if (asyncSuccessError) {
          console.error('Error updating booking async payment status:', asyncSuccessError);
          throw asyncSuccessError;
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
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