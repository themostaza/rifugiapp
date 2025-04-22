import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { CalendarDay } from '@/app/types';

// Interface per il risultato formattato
interface FormattedReservation {
  id: number;
  checkIn: string;
  checkOut: string;
  name: string;
  surname: string;
  guestName: string;
  guestCount: number;
  mail: string;
  phone: string;
  city: string;
  region: string;
  reservationType: string;
  totalPrice: number;
  isPaid: boolean;
  note: string;
  isCreatedByAdmin: boolean;
  stripeId: string;
  paymentIntentId: string;
  external_id: string;
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
        mail,
        phone,
        city,
        region,
        reservationType,
        totalPrice,
        isPaid,
        note,
        isCreatedByAdmin,
        stripeId,
        paymentIntentId,
        external_id
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

    // Per ogni prenotazione, recuperiamo separatamente le RoomReservation e RoomReservationSpec associate
    const enhancedReservations = [];
    
    if (reservations && reservations.length > 0) {
      console.log(`===== INIZIO ELABORAZIONE ${reservations.length} PRENOTAZIONI =====`);
      
      for (const reservation of reservations) {
        console.log(`\n[BASKET #${reservation.id}] ${reservation.name} ${reservation.surname} - Elaborazione iniziata`);
        console.log(`[BASKET #${reservation.id}] Date: ${new Date(reservation.dayFrom).toLocaleDateString()} -> ${new Date(reservation.dayTo).toLocaleDateString()}`);
        
        // Fase 1: Recupera le RoomReservation associate a questo Basket
        const { data: roomReservations, error: roomResError } = await supabase
          .from('RoomReservation')
          .select('id, bedBlockPriceTotal, servicePriceTotal')
          .eq('basketId', reservation.id);
          
        if (roomResError) {
          console.error(`[BASKET #${reservation.id}] ERRORE nel recupero RoomReservation:`, roomResError);
          continue;
        }
        
        if (!roomReservations || roomReservations.length === 0) {
          console.warn(`[BASKET #${reservation.id}] ATTENZIONE: Nessuna RoomReservation trovata per basketId=${reservation.id}`);
          
          // Aggiungiamo comunque la prenotazione con conteggio ospiti zero
          enhancedReservations.push({
            ...reservation,
            guestCount: 0,
            RoomReservation: []
          });
          
          continue;
        }
        
        console.log(`[BASKET #${reservation.id}] Trovate ${roomReservations.length} RoomReservation:`);
        roomReservations.forEach(rr => {
          console.log(`  - RoomReservation #${rr.id}: bedBlockPriceTotal=${rr.bedBlockPriceTotal}, servicePriceTotal=${rr.servicePriceTotal}`);
        });
        
        const roomReservationWithSpecs = [];
        let totalGuestCount = 0;
        
        // Fase 2: Per ogni RoomReservation, recupera le RoomReservationSpec associate
        if (roomReservations && roomReservations.length > 0) {
          for (const roomRes of roomReservations) {
            console.log(`[BASKET #${reservation.id}] [ROOMRES #${roomRes.id}] Recupero RoomReservationSpec...`);
            
            const { data: roomResSpecs, error: specsError } = await supabase
              .from('RoomReservationSpec')
              .select(`
                id, 
                price,
                roomLinkBedId,
                RoomLinkBed (
                  id,
                  name,
                  Room (
                    id,
                    description
                  )
                )
              `)
              .eq('roomReservationId', roomRes.id);
              
            if (specsError) {
              console.error(`[BASKET #${reservation.id}] [ROOMRES #${roomRes.id}] ERRORE nel recupero RoomReservationSpec:`, specsError);
              continue;
            }
            
            if (!roomResSpecs || roomResSpecs.length === 0) {
              console.warn(`[BASKET #${reservation.id}] [ROOMRES #${roomRes.id}] ATTENZIONE: Nessuna RoomReservationSpec trovata`);
              continue;
            }
            
            console.log(`[BASKET #${reservation.id}] [ROOMRES #${roomRes.id}] Trovate ${roomResSpecs.length} RoomReservationSpec:`);
            roomResSpecs.forEach(spec => {
              let bedName = 'Nome letto sconosciuto';
              let roomDescription = 'Stanza sconosciuta';
              
              if (spec.RoomLinkBed && typeof spec.RoomLinkBed === 'object') {
                if ('name' in spec.RoomLinkBed) {
                  bedName = String(spec.RoomLinkBed.name);
                }
                
                if ('Room' in spec.RoomLinkBed && 
                    spec.RoomLinkBed.Room && 
                    typeof spec.RoomLinkBed.Room === 'object' && 
                    'description' in spec.RoomLinkBed.Room) {
                  roomDescription = String(spec.RoomLinkBed.Room.description);
                }
              }
              
              console.log(`  - Spec #${spec.id}: Letto ${bedName} in ${roomDescription}, prezzo=${spec.price}`);
            });
            
            // Aggiungi i dettagli a roomReservationWithSpecs
            roomReservationWithSpecs.push({
              id: roomRes.id,
              bedBlockPriceTotal: roomRes.bedBlockPriceTotal,
              servicePriceTotal: roomRes.servicePriceTotal,
              RoomReservationSpec: roomResSpecs || []
            });
            
            // Incrementa il conteggio degli ospiti
            const currentResGuests = roomResSpecs?.length || 0;
            totalGuestCount += currentResGuests;
            console.log(`[BASKET #${reservation.id}] [ROOMRES #${roomRes.id}] Aggiunta di ${currentResGuests} ospiti al conteggio`);
          }
        }
        
        // Aggiungi le informazioni alla prenotazione
        enhancedReservations.push({
          ...reservation,
          guestCount: totalGuestCount,
          RoomReservation: roomReservationWithSpecs
        });
        
        console.log(`[BASKET #${reservation.id}] RIASSUNTO: ${totalGuestCount} ospiti in ${roomReservationWithSpecs.length} RoomReservation`);
      }
      
      console.log(`\n===== FINE ELABORAZIONE PRENOTAZIONI =====\n`);
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

    // Transform the reservations data with our enhanced data that includes guest counts
    const formattedReservations = enhancedReservations.map((reservation): FormattedReservation => {
      // Get unique rooms
      const uniqueRooms = new Set<{ id: number; description: string }>();
      
      reservation.RoomReservation?.forEach(roomRes => {
        roomRes.RoomReservationSpec?.forEach(spec => {
          if (spec.RoomLinkBed && typeof spec.RoomLinkBed === 'object' && 'Room' in spec.RoomLinkBed) {
            const room = spec.RoomLinkBed.Room;
            if (room && typeof room === 'object' && 'id' in room && 'description' in room) {
              uniqueRooms.add({
                id: Number(room.id),
                description: String(room.description)
              });
            }
          }
        });
      });

      // Utilizziamo il guestCount già calcolato nella fase precedente
      console.log(`[Reservation #${reservation.id}] ${reservation.name} ${reservation.surname} - Final guest count: ${reservation.guestCount}`);

      return {
        id: reservation.id,
        checkIn: reservation.dayFrom,
        checkOut: reservation.dayTo,
        name: reservation.name,
        surname: reservation.surname,
        guestName: `${reservation.name} ${reservation.surname}`.trim(),
        guestCount: reservation.guestCount,
        mail: reservation.mail,
        phone: reservation.phone,
        city: reservation.city,
        region: reservation.region,
        reservationType: reservation.reservationType,
        totalPrice: reservation.totalPrice,
        isPaid: reservation.isPaid,
        note: reservation.note,
        isCreatedByAdmin: reservation.isCreatedByAdmin,
        stripeId: reservation.stripeId,
        paymentIntentId: reservation.paymentIntentId,
        external_id: reservation.external_id,
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