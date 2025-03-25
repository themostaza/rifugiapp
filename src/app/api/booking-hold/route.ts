import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

async function cancelExpiredBookings() {
  const now = new Date();
  const { data: expiredBookings, error } = await supabase
    .from('booking_on_hold')
    .select('*')
    .or(`time_is_up_at.lt.${now.toISOString()},updated_at.lt.${new Date(now.getTime() - 30000).toISOString()}`)
    .eq('still_on_hold', true);

  if (error) {
    console.error('Error checking expired bookings:', error);
    return;
  }

  if (expiredBookings && expiredBookings.length > 0) {
    const { error: updateError } = await supabase
      .from('booking_on_hold')
      .update({ still_on_hold: false })
      .in('id', expiredBookings.map(b => b.id));

    if (updateError) {
      console.error('Error updating expired bookings:', updateError);
    }
  }
}

export async function POST(request: Request) {
  try {
    const { checkIn, checkOut } = await request.json();
    
    // Prima controlla se ci sono prenotazioni in corso
    const { error: searchError } = await supabase
      .from('booking_on_hold')
      .select('*')
      .eq('still_on_hold', true)
      .or(`check_in.lte.${checkOut},check_out.gte.${checkIn}`);

    if (searchError) throw searchError;

    // Cancella le prenotazioni scadute
    await cancelExpiredBookings();

    // Ricontrolla le prenotazioni dopo la cancellazione
    const { data: validBookings, error: recheckError } = await supabase
      .from('booking_on_hold')
      .select('*')
      .eq('still_on_hold', true)
      .or(`check_in.lte.${checkOut},check_out.gte.${checkIn}`);

    if (recheckError) throw recheckError;

    if (validBookings && validBookings.length > 0) {
      return NextResponse.json({ 
        available: false, 
        reason: 'BOOKING_IN_PROGRESS' 
      });
    }

    // Se non ci sono prenotazioni valide, crea una nuova
    const timeIsUpAt = new Date();
    timeIsUpAt.setMinutes(timeIsUpAt.getMinutes() + 15); // 15 minuti di tempo

    const { data: newBooking, error: insertError } = await supabase
      .from('booking_on_hold')
      .insert({
        check_in: checkIn,
        check_out: checkOut,
        still_on_hold: true,
        time_is_up_at: timeIsUpAt.toISOString()
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ 
      available: true, 
      bookingId: newBooking.id 
    });
  } catch (error) {
    console.error('Error in booking hold:', error);
    return NextResponse.json({ 
      available: false, 
      reason: 'ERROR' 
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    // Prima controlla e cancella i booking scaduti
    await cancelExpiredBookings();

    const { data: booking, error } = await supabase
      .from('booking_on_hold')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error) throw error;

    if (!booking || !booking.still_on_hold) {
      return NextResponse.json({ 
        valid: false,
        reason: 'BOOKING_EXPIRED'
      });
    }

    // Aggiorna l'ultimo heartbeat
    const { error: updateError } = await supabase
      .from('booking_on_hold')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', bookingId);

    if (updateError) throw updateError;

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Error in booking hold heartbeat:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    let bookingId: string | null = null;
    let action: string | null = null;

    // Controlla il content type
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      // Gestisci JSON
      const body = await request.json();
      bookingId = body.bookingId;
      action = body.action;
    } else if (contentType?.includes('application/x-www-form-urlencoded')) {
      // Gestisci FormData
      const formData = await request.formData();
      bookingId = formData.get('bookingId') as string;
      action = formData.get('action') as string;
    }

    if (!bookingId || !action) {
      return NextResponse.json(
        { error: 'Booking ID and action are required' },
        { status: 400 }
      );
    }

    let updateData = {};

    switch (action) {
      case 'ENTER_PAYMENT':
        updateData = {
          entered_payment: new Date().toISOString(),
          still_on_hold: true,
          updated_at: new Date().toISOString()
        };
        break;
      case 'CANCEL':
        updateData = {
          still_on_hold: false,
          updated_at: new Date().toISOString()
        };
        break;
      case 'HEARTBEAT':
        updateData = {
          updated_at: new Date().toISOString()
        };
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    const { error } = await supabase
      .from('booking_on_hold')
      .update(updateData)
      .eq('id', bookingId);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating booking hold:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 