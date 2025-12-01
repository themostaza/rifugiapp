import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * API per cancellare una prenotazione quando l'utente annulla il checkout Nexi
 * 
 * Riceve: { codTrans: string } - l'ID transazione Nexi (nexiOrderId)
 * 
 * Questo endpoint viene chiamato quando Nexi reindirizza l'utente alla homepage
 * con esito=ANNULLO, indicando che l'utente ha cliccato "Annulla" durante il checkout.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { codTrans } = body;

    if (!codTrans) {
      return NextResponse.json(
        { error: 'codTrans is required' },
        { status: 400 }
      );
    }

    console.log('[Cancel Nexi Checkout] Processing cancellation for codTrans:', codTrans);

    const supabase = createRouteHandlerClient({ cookies });

    // Trova la prenotazione tramite nexiOrderId (che corrisponde al codTrans)
    const { data: booking, error: fetchError } = await supabase
      .from('Basket')
      .select('id, external_id, isPaid, isCancelled, isCreatedByAdmin')
      .eq('nexiOrderId', codTrans)
      .single();

    if (fetchError) {
      // Se non trova con nexiOrderId, potrebbe non essere stata ancora salvata
      // In questo caso, non è un errore critico
      if (fetchError.code === 'PGRST116') {
        console.log('[Cancel Nexi Checkout] Booking not found for codTrans:', codTrans, '- might not have been created yet');
        return NextResponse.json({ 
          success: true, 
          message: 'Booking not found - possibly not created yet',
          notFound: true 
        });
      }
      console.error('[Cancel Nexi Checkout] Error fetching booking:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch booking' },
        { status: 500 }
      );
    }

    // Se la prenotazione è già pagata o già cancellata, non fare nulla
    if (booking.isPaid) {
      console.log('[Cancel Nexi Checkout] Booking already paid, skipping cancellation:', booking.external_id);
      return NextResponse.json({ 
        success: true, 
        message: 'Booking already paid',
        alreadyPaid: true 
      });
    }

    if (booking.isCancelled) {
      console.log('[Cancel Nexi Checkout] Booking already cancelled:', booking.external_id);
      return NextResponse.json({ 
        success: true, 
        message: 'Booking already cancelled',
        alreadyCancelled: true 
      });
    }

    // Cancella la prenotazione con motivazione checkout_aborted
    const { error: updateError } = await supabase
      .from('Basket')
      .update({
        isCancelled: true,
        cancellationReason: 'checkout_aborted',
        updatedAt: new Date().toISOString(),
      })
      .eq('id', booking.id);

    if (updateError) {
      console.error('[Cancel Nexi Checkout] Error updating booking:', updateError);
      return NextResponse.json(
        { error: 'Failed to cancel booking' },
        { status: 500 }
      );
    }

    console.log('[Cancel Nexi Checkout] Booking cancelled successfully:', {
      bookingId: booking.id,
      external_id: booking.external_id,
      codTrans,
      reason: 'checkout_aborted'
    });

    return NextResponse.json({
      success: true,
      message: 'Booking cancelled due to checkout abort',
      bookingId: booking.id,
      external_id: booking.external_id
    });

  } catch (error) {
    console.error('[Cancel Nexi Checkout] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

