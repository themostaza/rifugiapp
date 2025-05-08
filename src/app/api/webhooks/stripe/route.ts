import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabase } from '@/lib/supabase';
import Stripe from 'stripe';
import { sendPaymentSuccessEmail } from '@/utils/emailService';

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
      console.warn('Webhook received without stripe-signature header');
      return NextResponse.json(
        { error: 'No signature found' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: unknown) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.bookingId;

    if (!bookingId) {
      console.warn('Webhook received for session without bookingId in metadata:', session.id);
      return NextResponse.json(
        { error: 'No booking ID found in session metadata' },
        { status: 400 }
      );
    }
    console.log(`Processing webhook event ${event.type} for bookingId: ${bookingId}`);

    const { data: bookingData, error: bookingFetchError } = await supabase
      .from('Basket')
      .select(`
        external_id,
        checkIn,
        checkOut,
        customerEmail, 
        customerName,
        isPaid, 
        paymentConfirmationEmailSent
      `)
      .eq('external_id', bookingId)
      .single();

    if (bookingFetchError) {
      console.error(`Error fetching booking details for bookingId ${bookingId}:`, bookingFetchError);
      return NextResponse.json({ error: 'Failed to fetch booking details' }, { status: 500 });
    }

    if (!bookingData) {
      console.error(`Booking not found for bookingId ${bookingId}. Cannot process webhook.`);
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const handleSuccessfulPayment = async () => {
      if (bookingData.isPaid && bookingData.paymentConfirmationEmailSent) {
        console.log(`Payment for booking ${bookingId} already processed and confirmation email sent. Skipping.`);
        return;
      }
      if (!bookingData.isPaid) {
         console.warn(`Webhook per pagamento ${bookingId} ricevuto ma il DB non lo segna come pagato dopo l'update. Qualcosa non va.`);
      }

      const emailTo = session.customer_details?.email || bookingData.customerEmail;
      const name = session.customer_details?.name || bookingData.customerName;

      if (!emailTo) {
        console.error(`Cannot send payment success email for booking ${bookingId}: recipient email is missing.`);
        return;
      }
      if (!bookingData.checkIn || !bookingData.checkOut) {
        console.error(`Cannot send payment success email for booking ${bookingId}: checkIn/checkOut dates are missing.`);
        return;
      }

      console.log(`Attempting to send payment success email to ${emailTo} for booking ${bookingId}`);
      const emailSent = await sendPaymentSuccessEmail(emailTo, {
        name: name,
        checkIn: bookingData.checkIn,
        checkOut: bookingData.checkOut,
        external_id: bookingData.external_id,
      });

      if (emailSent) {
        const { error: emailFlagUpdateError } = await supabase
          .from('Basket')
          .update({ paymentConfirmationEmailSent: true, updatedAt: new Date().toISOString() })
          .eq('external_id', bookingId);
        if (emailFlagUpdateError) {
          console.error(`Failed to update paymentConfirmationEmailSent flag for booking ${bookingId}:`, emailFlagUpdateError);
        }
      } else {
        console.warn(`Failed to send payment success email for booking ${bookingId}. Will retry on next webhook if applicable or needs manual check.`);
      }
    };

    switch (event.type) {
      case 'checkout.session.completed':
        console.log(`Checkout session ${session.id} completed for booking ${bookingId}.`);
        if (bookingData.isPaid && bookingData.paymentConfirmationEmailSent) {
          console.log(`Booking ${bookingId} already marked as paid and email sent. Idempotency check passed.`);
          break; 
        }
        const { error: updateError } = await supabase
          .from('Basket')
          .update({
            isPaid: true,
            paymentIntentId: session.payment_intent as string,
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
            updatedAt: new Date().toISOString(),
          })
          .eq('external_id', bookingId)
          .select('isPaid')
          .single();

        if (updateError) {
          console.error(`Error updating booking ${bookingId} to paid (checkout.session.completed):`, updateError);
          return NextResponse.json({ error: 'Failed to update booking status' }, { status: 500 });
        }
        console.log(`Booking ${bookingId} successfully updated to paid.`);
        bookingData.isPaid = true; 
        await handleSuccessfulPayment(); 
        break;

      case 'checkout.session.async_payment_succeeded':
        console.log(`Checkout session ${session.id} async payment succeeded for booking ${bookingId}.`);
        if (bookingData.isPaid && bookingData.paymentConfirmationEmailSent) {
          console.log(`Booking ${bookingId} already marked as paid and email sent (async). Idempotency check passed.`);
          break;
        }
        const { error: asyncSuccessError } = await supabase
          .from('Basket')
          .update({
            isPaid: true,
            isCancelled: false,
            paymentIntentId: session.payment_intent as string,
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
            updatedAt: new Date().toISOString(),
          })
          .eq('external_id', bookingId)
          .select('isPaid')
          .single();

        if (asyncSuccessError) {
          console.error(`Error updating booking ${bookingId} to paid (async_payment_succeeded):`, asyncSuccessError);
          return NextResponse.json({ error: 'Failed to update booking status on async success' }, { status: 500 });
        }
        console.log(`Booking ${bookingId} successfully updated to paid (async).`);
        bookingData.isPaid = true;
        await handleSuccessfulPayment();
        break;

      case 'checkout.session.expired':
        console.log(`Checkout session ${session.id} expired for booking ${bookingId}.`);
        const { error: expireError } = await supabase
          .from('Basket')
          .update({
            isCancelled: true,
            cancellationReason: 'stripe_checkout_expired',
            updatedAt: new Date().toISOString()
          })
          .eq('external_id', bookingId)
          .eq('isPaid', false);

        if (expireError) {
          console.error(`Error updating booking ${bookingId} to expired:`, expireError);
        }
        break;

      case 'checkout.session.async_payment_failed':
        console.log(`Checkout session ${session.id} async payment failed for booking ${bookingId}.`);
        const { error: failError } = await supabase
          .from('Basket')
          .update({
            isCancelled: true,
            cancellationReason: 'stripe_payment_failed',
            updatedAt: new Date().toISOString()
          })
          .eq('external_id', bookingId)
          .eq('isPaid', false);

        if (failError) {
          console.error(`Error updating booking ${bookingId} to payment failed:`, failError);
        }
        break;

      default:
        console.log(`Unhandled event type in webhook: ${event.type} for bookingId: ${bookingId}`);
    }

    return NextResponse.json({ received: true });

  } catch (error: unknown) {
    console.error('Critical error in Stripe webhook handler:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed due to an unexpected error' },
      { status: 500 }
    );
  }
}