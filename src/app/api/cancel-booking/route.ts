import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia'
});

export async function POST(request: Request) {
  try {
    const { external_id } = await request.json();

    if (!external_id) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('Basket')
      .select('*')
      .eq('external_id', external_id)
      .single();

    if (bookingError) {
      console.error('Error fetching booking:', bookingError);
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

    if (!booking.isPaid || !booking.paymentIntentId) {
      return NextResponse.json(
        { error: 'Booking is not paid or missing payment information' },
        { status: 400 }
      );
    }

    // Convert dates to Italian timezone
    const now = new Date();
    const checkInDate = new Date(booking.dayFrom);
    
    // Set check-in time to midnight (00:00) in Italian timezone
    checkInDate.setHours(0, 0, 0, 0);
    
    // Calculate days until check-in
    const daysUntilCheckIn = Math.ceil((checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Determine refund amount based on cancellation policy
    let refundAmount: number | null = null;
    let refundReason: string = '';

    if (daysUntilCheckIn > 7) {
      // Full refund if more than 7 days before check-in
      refundAmount = booking.totalPrice;
      refundReason = 'Cancellation more than 7 days before check-in';
    } else if (daysUntilCheckIn > 1) {
      // 70% refund if between 7 days and 24 hours before check-in
      refundAmount = booking.totalPrice * 0.7;
      refundReason = 'Cancellation between 7 days and 24 hours before check-in';
    } else {
      // No refund if less than 24 hours before check-in
      refundReason = 'Cancellation less than 24 hours before check-in';
    }

    // Process refund if applicable
    if (refundAmount) {
      try {
        await stripe.refunds.create({
          payment_intent: booking.paymentIntentId,
          amount: Math.round(refundAmount * 100), // Convert to cents
          reason: 'requested_by_customer' as const
        });
      } catch (refundError) {
        console.error('Error processing refund:', refundError);
        return NextResponse.json(
          { error: 'Failed to process refund' },
          { status: 500 }
        );
      }
    }

    // Update booking status to cancelled
    const { error: updateError } = await supabase
      .from('Basket')
      .update({
        isCancelled: true,
        updatedAt: new Date().toISOString()
      })
      .eq('external_id', external_id);

    if (updateError) {
      console.error('Error updating booking status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update booking status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      refundAmount,
      refundReason
    });

  } catch (error) {
    console.error('Error in cancel-booking route:', error);
    return NextResponse.json(
      { error: 'Failed to cancel booking' },
      { status: 500 }
    );
  }
} 