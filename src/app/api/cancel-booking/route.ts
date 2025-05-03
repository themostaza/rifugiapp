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

    // Per prenotazioni create dall'admin, ignoriamo i controlli sul pagamento
    // e non eseguiamo rimborsi
    if (booking.isCreatedByAdmin) {
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
        isAdminBooking: true,
        message: 'Prenotazione creata dall\'amministratore è stata cancellata.'
      });
    }

    // Per prenotazioni normali, verifichiamo il pagamento
    if (!booking.isPaid || !booking.paymentIntentId) {
      return NextResponse.json(
        { error: 'Booking is not paid or missing payment information' },
        { status: 400 }
      );
    }

    // Normal user bookings follow the refund policy
    // Convert dates to Italian timezone
    const checkInDate = new Date(booking.dayFrom);
    
    // Set check-in time to midnight (00:00) in Italian timezone
    checkInDate.setHours(0, 0, 0, 0);
    
  
    // Determine refund amount based on cancellation policy
    let refundAmount = 0;
    let refundPercentage = 0;

    // Calculate days difference
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const timeDifference = checkInDate.getTime() - today.getTime();
    const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));

    // Determine refund percentage based on new rules
    if (daysDifference >= 7) {
      refundPercentage = 1; // 100% refund
    } else if (daysDifference >= 1) { // Between 1 day (exclusive) and 7 days (inclusive)
      refundPercentage = 0.7; // 70% refund 
    } else {
      refundPercentage = 0; // 0% refund within 24 hours
    }

    // Process refund if applicable
    if (refundPercentage && booking.paymentIntentId) {
      try {
        refundAmount = booking.totalPrice * refundPercentage;
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
      refundPercentage
    });

  } catch (error) {
    console.error('Error in cancel-booking route:', error);
    return NextResponse.json(
      { error: 'Failed to cancel booking' },
      { status: 500 }
    );
  }
} 