import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies as getCookies } from 'next/headers';


interface ReservationReportRow {
  checkIn: string;
  checkOut: string;
  numberOfNight: number;
  reservationType: string;
  totalOfGuest: number;
  totalOfAdults: number;
  totalOfChild: number;
  totalOfBabay: number;
  name: string;
  country: string; // city
  region: number | string; // id regione italiana
}

function calculateNights(from: string, to: string) {
  const d1 = new Date(from);
  const d2 = new Date(to);
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

interface RoomReservationSpec {
  id: number;
  guestDivisionId: number;
  GuestDivision: { title: string } | null;
}
interface RoomReservation {
  id: number;
  RoomReservationSpec: RoomReservationSpec[];
}
interface BasketWithGuests {
  id: number;
  dayFrom: string;
  dayTo: string;
  reservationType: string;
  name: string;
  region: string | number;
  city: string;
  isCancelled: boolean;
  RoomReservation?: RoomReservation[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  console.log('[API report-past-reservations] Params:', { from, to });

  if (!from || !to) {
    console.log('[API report-past-reservations] Missing from or to');
    return NextResponse.json({ error: 'Missing from or to parameter' }, { status: 400 });
  }

  try {
    const cookiesList = getCookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookiesList });

    console.log('[API report-past-reservations] Querying Basket...');
    const { data: baskets, error } = await supabase
      .from('Basket')
      .select(`
        id, dayFrom, dayTo, reservationType, name, region, city, isCancelled, booking_details,
        RoomReservation (
          id,
          RoomReservationSpec (
            id,
            guestDivisionId,
            GuestDivision (title)
          )
        )
      `)
      .gte('dayFrom', from)
      .lte('dayFrom', to)
      .eq('isCancelled', false);

    if (error) {
      console.error('[API report-past-reservations] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!baskets) {
      console.log('[API report-past-reservations] No baskets found');
      return NextResponse.json([], { status: 200 });
    }

    console.log(`[API report-past-reservations] Found ${baskets.length} baskets`);

    // Calcola breakdown ospiti da RoomReservationSpec/GuestDivision
    const rows: ReservationReportRow[] = (baskets as BasketWithGuests[]).map((b) => {
      let adults = 0, children = 0, infants = 0;
      if (b.RoomReservation) {
        for (const rr of b.RoomReservation) {
          if (rr.RoomReservationSpec) {
            for (const spec of rr.RoomReservationSpec) {
              const title = spec.GuestDivision?.title?.toLowerCase() || '';
              if (title.includes('adulti')) adults++;
              else if (title.includes('bambin')) children++;
              else if (title.includes('neonat')) infants++;
            }
          }
        }
      }
      const total = adults + children + infants;
      return {
        checkIn: b.dayFrom,
        checkOut: b.dayTo,
        numberOfNight: calculateNights(b.dayFrom, b.dayTo),
        reservationType: b.reservationType === 'hb' ? 'Mezza Pensione' : b.reservationType === 'bb' ? 'B&B' : b.reservationType,
        totalOfGuest: total,
        totalOfAdults: adults,
        totalOfChild: children,
        totalOfBabay: infants,
        name: b.name,
        country: b.city || '', // city come country
        region: b.region ?? '', // id regione italiana
      };
    });

    console.log('[API report-past-reservations] Returning rows:', rows.length);
    return NextResponse.json(rows, { status: 200 });
  } catch (err) {
    console.error('[API report-past-reservations] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 