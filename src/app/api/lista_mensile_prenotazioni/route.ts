import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { CalendarDay } from '@/app/types';

// Definizione dei tipi basati sulla struttura delle tabelle di Supabase
interface RoomData {
  id: number;
  description: string;
}

interface RoomLinkBedData {
  id: number;
  name: string;
  Room: RoomData;
}

interface RoomReservationSpecData {
  id: number;
  RoomLinkBed: RoomLinkBedData;
}

interface RoomReservationData {
  id: number;
  RoomReservationSpec: RoomReservationSpecData[];
}

interface BasketData {
  id: number;
  dayFrom: string;
  dayTo: string;
  name: string;
  surname: string;
  RoomReservation: RoomReservationData[];
}

// Interface per il risultato formattato
interface FormattedReservation {
  id: number;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestCount: number;
  rooms: {
    id: number;
    description: string;
  }[];
}

export async function GET(request: Request) {
  try {
    console.log('API Called - Starting execution');

    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || '');
    const year = parseInt(searchParams.get('year') || '');

    console.log('Input parameters:', { month, year });

    if (isNaN(month) || isNaN(year)) {
      return NextResponse.json(
        { error: 'Invalid month or year parameters' },
        { status: 400 }
      );
    }

    // Calculate start and end dates for the month
    const startDate = new Date(year, month - 1, 1);
    // Set endDate to the last millisecond of the last day of the month
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    console.log('Date range:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    // Fetch reservations
    const { data: reservations, error: reservationsError } = await supabase
      .from('Basket')
      .select(`
        id,
        dayFrom,
        dayTo,
        name,
        surname,
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
      .gte('dayFrom', startDate.toISOString())
      .lte('dayFrom', endDate.toISOString())
      .eq('isCancelled', false);

    console.log('Full reservations data:', JSON.stringify(reservations, null, 2));

    if (reservationsError) {
      console.error('Supabase reservations query error:', {
        message: reservationsError.message,
        details: reservationsError.details,
        hint: reservationsError.hint,
        code: reservationsError.code
      });
      
      return NextResponse.json(
        { error: 'Database query failed', details: reservationsError },
        { status: 500 }
      );
    }

    // Fetch blocked days
    const { data: blockedDays, error: blockedDaysError } = await supabase
      .from('day_blocked')
      .select('day_blocked')
      .gte('day_blocked', startDate.toISOString())
      .lte('day_blocked', endDate.toISOString());

    if (blockedDaysError) {
      console.error('Supabase blocked days query error:', blockedDaysError);
      return NextResponse.json(
        { error: 'Failed to fetch blocked days', details: blockedDaysError },
        { status: 500 }
      );
    }

    // Create an array of all days in the month with their blocked status
    const daysInMonth = endDate.getDate();
    const calendarDays: CalendarDay[] = Array.from({ length: daysInMonth }, (_, index) => {
      const currentDate = new Date(year, month - 1, index + 1);
      const isBlocked = blockedDays?.some(
        blocked => new Date(blocked.day_blocked).toDateString() === currentDate.toDateString()
      ) || false;

      return {
        date: currentDate.toISOString(),
        isBlocked
      };
    });

    console.log('Query executed successfully', {
      resultCount: reservations?.length || 0,
      blockedDaysCount: blockedDays?.length || 0
    });

    if (!reservations?.length && !blockedDays?.length) {
      return NextResponse.json({
        reservations: [],
        calendarDays
      });
    }

    // Usiamo type assertion con unknown come intermediario per evitare errori di tipo
    const typedReservations = reservations as unknown as BasketData[];
    
    // Transform the reservations data
    const formattedReservations = typedReservations.map((reservation): FormattedReservation => {
      // Get unique rooms
      const uniqueRooms = new Set<{ id: number; description: string }>();
      
      reservation.RoomReservation?.forEach(roomRes => {
        roomRes.RoomReservationSpec?.forEach(spec => {
          if (spec.RoomLinkBed?.Room) {
            uniqueRooms.add({
              id: spec.RoomLinkBed.Room.id,
              description: spec.RoomLinkBed.Room.description
            });
          }
        });
      });

      // Count guests (each RoomReservationSpec represents one guest)
      const guestCount = reservation.RoomReservation?.reduce(
        (acc, rr) => acc + (rr.RoomReservationSpec?.length || 0), 
        0
      ) || 0;

      return {
        id: reservation.id,
        checkIn: reservation.dayFrom,
        checkOut: reservation.dayTo,
        guestName: `${reservation.name} ${reservation.surname}`.trim(),
        guestCount,
        rooms: Array.from(uniqueRooms)
      };
    });

    // Return combined response
    return NextResponse.json({
      reservations: formattedReservations || [],
      calendarDays
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}