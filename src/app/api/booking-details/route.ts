import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// Types for the response
interface RoomDetails {
  id: number;
  description: string;
}

interface BedDetails {
  id: number;
  name: string;
  Room: RoomDetails;
}

interface RoomReservationSpec {
  id: number;
  RoomLinkBed: BedDetails;
}

interface RoomReservation {
  id: number;
  RoomReservationSpec: RoomReservationSpec[];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('id');

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    // Fetch booking details with all related data
    const { data: booking, error } = await supabase
      .from('Basket')
      .select(`
        id,
        dayFrom,
        dayTo,
        name,
        surname,
        mail,
        phone,
        region,
        reservationType,
        totalPrice,
        isPaid,
        isCancelled,
        createdAt,
        stripeId,
        RoomReservation (
          id,
          RoomReservationSpec (
            id,
            RoomLinkBed (
              id,
              name,
              Room (
                id,
                description
              )
            )
          )
        )
      `)
      .eq('id', bookingId)
      .single();

    if (error) {
      console.error('Error fetching booking details:', error);
      return NextResponse.json(
        { error: 'Failed to fetch booking details' },
        { status: 500 }
      );
    }

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Format the response
    const formattedBooking = {
      id: booking.id,
      checkIn: booking.dayFrom,
      checkOut: booking.dayTo,
      guestName: `${booking.name} ${booking.surname}`.trim(),
      guestEmail: booking.mail,
      guestPhone: booking.phone,
      guestRegion: booking.region,
      reservationType: booking.reservationType,
      totalPrice: booking.totalPrice,
      isPaid: booking.isPaid,
      isCancelled: booking.isCancelled,
      createdAt: booking.createdAt,
      stripeId: booking.stripeId,
      rooms: ((booking.RoomReservation || []) as unknown as RoomReservation[]).map((rr) => {
        // Get unique rooms from the reservation specs
        const uniqueRooms = new Set<{ id: number; description: string }>();
        (rr.RoomReservationSpec || []).forEach(spec => {
          if (spec.RoomLinkBed?.Room) {
            uniqueRooms.add({
              id: spec.RoomLinkBed.Room.id,
              description: spec.RoomLinkBed.Room.description
            });
          }
        });

        return {
          id: rr.id,
          beds: (rr.RoomReservationSpec || []).map(spec => ({
            id: spec.RoomLinkBed.id,
            name: spec.RoomLinkBed.name
          })),
          rooms: Array.from(uniqueRooms)
        };
      })
    };

    return NextResponse.json(formattedBooking);

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Endpoint to cancel a booking
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('id');

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    // Update the booking to mark it as cancelled
    const { error } = await supabase
      .from('Basket')
      .update({ isCancelled: true })
      .eq('id', bookingId);

    if (error) {
      console.error('Error cancelling booking:', error);
      return NextResponse.json(
        { error: 'Failed to cancel booking' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 