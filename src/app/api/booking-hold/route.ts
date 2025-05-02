import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { parse } from 'cookie';

// Funzione helper per parsare e formattare le date
function parseAndFormatToLocalYYYYMMDD(dateString: string): string {
    console.log(`📅 Tentativo di parsing della stringa data: "${dateString}"`);
    
    // Prova a creare un oggetto Date. new Date() gestisce sia ISO che YYYY-MM-DD.
    const date = new Date(dateString);

    // Controlla se la data è valida
    if (isNaN(date.getTime())) {
        console.error(`❌ Formato data non valido ricevuto: "${dateString}"`);
        throw new Error(`Invalid date format: ${dateString}`);
    }

    // Se la stringa originale conteneva 'T', era probabilmente ISO (es. 2025-06-01T22:00:00.000Z).
    // In questo caso, `new Date()` l'ha interpretata correttamente come UTC.
    // Vogliamo estrarre l'anno, il mese e il giorno LOCALI da questo oggetto Date.
    if (dateString.includes('T')) {
        const localYear = date.getFullYear();
        const localMonth = String(date.getMonth() + 1).padStart(2, '0'); // getMonth è 0-indexed
        const localDay = String(date.getDate()).padStart(2, '0');
        const formatted = `${localYear}-${localMonth}-${localDay}`;
        console.log(`✅ Stringa ISO "${dateString}" parsata come data locale YYYY-MM-DD: ${formatted}`);
        return formatted;
    } 
    // Se la stringa originale NON conteneva 'T' e corrisponde a YYYY-MM-DD,
    // `new Date(YYYY-MM-DD)` la interpreta come mezzanotte UTC.
    // È più sicuro usare la stringa originale direttamente.
    else if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        console.log(`✅ Stringa "${dateString}" già in formato YYYY-MM-DD. Uso diretta.`);
        return dateString;
    } 
    // Fallback nel caso di altri formati validi per new Date() ma non ISO/YYYY-MM-DD
    else {
        console.warn(`⚠️ Formato data "${dateString}" non standard, estraggo YYYY-MM-DD locali.`);
        const localYear = date.getFullYear();
        const localMonth = String(date.getMonth() + 1).padStart(2, '0');
        const localDay = String(date.getDate()).padStart(2, '0');
        const formatted = `${localYear}-${localMonth}-${localDay}`;
        console.log(`✅ Data "${dateString}" parsata come data locale YYYY-MM-DD: ${formatted}`);
        return formatted;
    }
}

async function cancelExpiredBookings() {
  const now = new Date();
  const nowISO = now.toISOString();
  const thirtySecondsAgo = new Date(now.getTime() - 30000).toISOString();
  
  console.log(`Cancelling expired bookings: now=${nowISO}, 30s ago=${thirtySecondsAgo}`);

  const { data: expiredBookings, error } = await supabase
    .from('booking_on_hold')
    .select('*')
    .or(`time_is_up_at.lt.${nowISO},updated_at.lt.${thirtySecondsAgo}`)
    .eq('still_on_hold', true);

  if (error) {
    console.error('Error checking expired bookings:', error);
    return;
  }

  console.log(`Found ${expiredBookings?.length || 0} expired bookings`);

  if (expiredBookings && expiredBookings.length > 0) {
    const { error: updateError } = await supabase
      .from('booking_on_hold')
      .update({ still_on_hold: false })
      .in('id', expiredBookings.map(b => b.id));

    if (updateError) {
      console.error('Error updating expired bookings:', updateError);
    } else {
      console.log(`Successfully cancelled ${expiredBookings.length} expired bookings`);
    }
  }
}

export async function POST(request: Request) {
  let sessionId: string | undefined = undefined;
  const cookieHeader = request.headers.get('cookie');

  if (cookieHeader) {
    try {
      const cookiesParsed = parse(cookieHeader);
      sessionId = cookiesParsed.sessionId;
    } catch (e) {
      console.error('Error parsing cookie header:', e);
      // Non bloccare, procedi generando un nuovo ID se necessario
    }
  }

  if (!sessionId) {
    sessionId = uuidv4();
    console.log(`✨ Generated new session ID: ${sessionId}`);
  } else {
    console.log(`Existing session ID found: ${sessionId}`);
  }

  try {
    // Estrai il body della richiesta
    const body = await request.json();
    console.log('Received raw booking request body:', body);
    
    // Ottieni le date grezze dal client
    const rawCheckIn = body.checkIn;
    const rawCheckOut = body.checkOut;
    
    if (!rawCheckIn || !rawCheckOut) {
      console.error('❌ Date grezze mancanti:', { rawCheckIn, rawCheckOut });
      throw new Error('Check-in and check-out dates are required');
    }

    // Usa la nuova funzione di parsing robusta per ottenere YYYY-MM-DD locale
    const checkIn = parseAndFormatToLocalYYYYMMDD(rawCheckIn);
    const checkOut = parseAndFormatToLocalYYYYMMDD(rawCheckOut);
    
    console.log('📅 Date parsate/formattate usate per il booking:', { checkIn, checkOut });
    
    // Validazione (ora sulle date formattate correttamente)
    if (!checkIn || !checkOut) {
       // Questo non dovrebbe succedere se parseAndFormatToLocalYYYYMMDD lancia un errore
       console.error('❌ Date non valide dopo il parsing');
       throw new Error('Date check-in/check-out non valide dopo il parsing');
    }

    // **NUOVO**: Cancella eventuali hold precedenti ATTIVI per questa sessione
    console.log(`🧹 Checking for and cancelling previous active holds for session: ${sessionId}`);
    const { error: cancelPreviousError } = await supabase
      .from('booking_on_hold')
      .update({ still_on_hold: false, updated_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('still_on_hold', true);

    if (cancelPreviousError) {
      console.error('Error cancelling previous holds for session:', cancelPreviousError);
      // Non blocchiamo necessariamente, potremmo procedere comunque
    } else {
      console.log(`Successfully cancelled previous active holds for session: ${sessionId}`);
    }
    
    // Controlla eventuali hold ATTIVI (di ALTRE sessioni) che si sovrappongono
    // (La logica di overlap è in /api/search, qui controlliamo solo per sicurezza PRIMA di inserire)
    // Questa parte potrebbe essere rimossa se ci fidiamo del controllo in /api/search,
    // ma la lasciamo per doppia sicurezza.
    const { data: overlappingHolds, error: overlapCheckError } = await supabase
      .from('booking_on_hold')
      .select('id') // Basta l'ID
      .lt('check_in', checkOut)
      .gt('check_out', checkIn)
      .eq('still_on_hold', true);
      // NON filtriamo per session_id qui, vogliamo vedere se ALTRI bloccano

    if (overlapCheckError) {
        console.error("Error checking for overlapping holds:", overlapCheckError);
        throw overlapCheckError; // Lancia errore se il check fallisce
    }

    if (overlappingHolds && overlappingHolds.length > 0) {
        console.warn(`⚠️ Found ${overlappingHolds.length} overlapping active holds from OTHER sessions. Blocking creation.`);
        return NextResponse.json({ 
            available: false, 
            reason: 'BOOKING_IN_PROGRESS' 
        });
    }

    // Se non ci sono prenotazioni valide (di altre sessioni), crea una nuova
    const timeIsUpAt = new Date();
    timeIsUpAt.setMinutes(timeIsUpAt.getMinutes() + 20); // 20 minuti di tempo

    console.log(`Creating new booking hold for session ${sessionId} with dates: check_in=${checkIn}, check_out=${checkOut}, expires_at=${timeIsUpAt.toISOString()}`); // Log migliorato

    const { data: newBooking, error: insertError } = await supabase
      .from('booking_on_hold')
      .insert({
        check_in: checkIn,       // Formato YYYY-MM-DD
        check_out: checkOut,     // Formato YYYY-MM-DD
        still_on_hold: true,
        time_is_up_at: timeIsUpAt.toISOString(),
        session_id: sessionId // <-- Salva il sessionId
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting booking hold:', insertError);
      console.error('Insert values:', { check_in: checkIn, check_out: checkOut, session_id: sessionId });
      throw insertError;
    }

    console.log('Booking hold created successfully:', newBooking);
    
    // **NUOVO**: Imposta il cookie nella risposta
    const response = NextResponse.json({ 
      available: true, 
      bookingId: newBooking.id 
    });
    response.cookies.set('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Solo HTTPS in produzione
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // Scadenza 30 giorni (in secondi)
    });
    return response;

  } catch (error) {
    console.error('Error in booking hold:', error);
    // Non impostiamo il cookie in caso di errore generale
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