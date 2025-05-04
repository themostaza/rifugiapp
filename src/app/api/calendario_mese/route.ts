import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || '');
    const year = parseInt(searchParams.get('year') || '');

    if (isNaN(month) || isNaN(year)) {
      return NextResponse.json(
        { error: 'Invalid month or year parameters' },
        { status: 400 }
      );
    }

    // Calcola inizio e fine mese
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 1); // primo giorno mese successivo

    // Query ottimizzata
    const { data: reservations, error: reservationsError } = await supabase
      .from('Basket')
      .select('id, dayFrom, dayTo')
      .or('and(isPaid.eq.true,isCancelled.eq.false),and(isCreatedByAdmin.eq.true,isCancelled.eq.false)')
      .lte('dayFrom', endOfMonth.toISOString())
      .gt('dayTo', startOfMonth.toISOString());

    if (reservationsError) {
      return NextResponse.json(
        { error: 'Database query failed', details: reservationsError },
        { status: 500 }
      );
    }

    // Giorni bloccati (come prima)
    const { data: blockedDays, error: blockedDaysError } = await supabase
      .from('day_blocked')
      .select('day_blocked')
      .gte('day_blocked', startOfMonth.toISOString())
      .lt('day_blocked', endOfMonth.toISOString());

    if (blockedDaysError) {
      return NextResponse.json(
        { error: 'Failed to fetch blocked days', details: blockedDaysError },
        { status: 500 }
      );
    }

    // Crea array giorni del mese con status bloccato
    const daysInMonth = new Date(year, month, 0).getDate();
    const calendarDays = Array.from({ length: daysInMonth }, (_, index) => {
      const currentDate = new Date(year, month - 1, index + 1);
      const isBlocked = blockedDays?.some(
        blocked => new Date(blocked.day_blocked).toDateString() === currentDate.toDateString()
      ) || false;
      return {
        date: currentDate.toISOString(),
        isBlocked
      };
    });

    return NextResponse.json({
      reservations: reservations || [],
      calendarDays
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 