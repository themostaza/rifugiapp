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

    // Calcola stringhe per primo e ultimo giorno del mese
    const firstDayOfMonthStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayOfMonthDate = new Date(year, month, 0); // Last day of current month
    const lastDayOfMonthStr = `${lastDayOfMonthDate.getFullYear()}-${String(lastDayOfMonthDate.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonthDate.getDate()).padStart(2, '0')}`;

    // Query ottimizzata per le prenotazioni usando stringhe di data
    const { data: reservations, error: reservationsError } = await supabase
      .from('Basket')
      .select('id, dayFrom, dayTo')
      .or('and(isPaid.eq.true,isCancelled.eq.false),and(isCreatedByAdmin.eq.true,isCancelled.eq.false)')
      .lte('dayFrom', lastDayOfMonthStr) // La prenotazione inizia entro la fine del mese
      .gte('dayTo', firstDayOfMonthStr); // La prenotazione finisce dopo l'inizio del mese

    if (reservationsError) {
      return NextResponse.json(
        { error: 'Database query failed', details: reservationsError },
        { status: 500 }
      );
    }

    // Giorni bloccati
    // Format date parts for query to ensure we are comparing date strings
    // Queste stringhe sono già definite sopra, quindi non c'è bisogno di ridefinirle qui
    // const firstDayOfMonthStr = `${year}-${String(month).padStart(2, '0')}-01`;
    // const lastDayOfMonthDate = new Date(year, month, 0); // Last day of current month
    // const lastDayOfMonthStr = `${lastDayOfMonthDate.getFullYear()}-${String(lastDayOfMonthDate.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonthDate.getDate()).padStart(2, '0')}`;

    const { data: blockedDaysData, error: blockedDaysError } = await supabase
      .from('day_blocked')
      .select('day_blocked') // Assuming this returns { day_blocked: "YYYY-MM-DD" }
      .gte('day_blocked', firstDayOfMonthStr)
      .lte('day_blocked', lastDayOfMonthStr);

    if (blockedDaysError) {
      return NextResponse.json(
        { error: 'Failed to fetch blocked days', details: blockedDaysError },
        { status: 500 }
      );
    }

    // Crea un Set di stringhe YYYY-MM-DD per i giorni bloccati per un lookup efficiente
    const blockedDateStringsSet = new Set(
      blockedDaysData?.map(b => b.day_blocked as string) || []
    );

    // Crea array giorni del mese con status bloccato
    const daysInMonth = new Date(year, month, 0).getDate();
    const calendarDays = Array.from({ length: daysInMonth }, (_, index) => {
      const dayNumber = index + 1;
      // Costruisci la stringa YYYY-MM-DD per il giorno corrente nel loop
      const currentDayString = `${year}-${String(month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
      
      const isBlocked = blockedDateStringsSet.has(currentDayString);
      
      return {
        date: currentDayString, // Invia la data come stringa YYYY-MM-DD
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