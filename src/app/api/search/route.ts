import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { parse } from 'cookie';

// Types for better code organization
type DateRange = {
  checkIn: string;
  checkOut: string;
};

type GuestType = 'adult' | 'child' | 'infant';

type SearchParams = DateRange & {
  guests: { type: GuestType; count: number }[];
};

type BlockedDay = {
  day_blocked: string;
};

type BookingOnHold = {
  id: number;
  check_in: string;
  check_out: string;
  time_is_up_at: string;
  still_on_hold: boolean;
  entered_payment: string | null;
  session_id?: string;
};

// Define proper types for the bed structure
interface RoomImage {
  id: number;
  url: string;
}

interface RoomDetails {
  id: number;
  description: string;
  RoomImage?: RoomImage[];
  createdAt: string;
}

interface BedPricing {
  id: number;
  priceBandB: number;
  priceMP: number;
  peopleCount: number;
}

interface Bed {
  id: number;
  roomId: number;
  bedId: number;
  name: string;
  Bed: BedPricing;
  Room: RoomDetails;
  pricing?: {
    bb: number;
    mp: number;
  };
}
interface RoomReservationSpec {
  id: number;
  roomLinkBedId: number;
}

interface ReservationLinkBedBlock {
  id: number;
  day: string;
  roomLinkBedId: number[];
}

interface RoomReservation {
  id: number;
  RoomReservationSpec?: RoomReservationSpec[];
  ReservationLinkBedBlock?: ReservationLinkBedBlock[];
}

interface Reservation {
  id: number;
  dayFrom: string;
  dayTo: string;
  RoomReservation?: RoomReservation[];
}

export async function GET(request: Request) {
  try {
    console.log('🔍 New search request received:', request.url);
    const { searchParams } = new URL(request.url);
    
    const params = validateAndParseParams(searchParams);
    console.log('📅 Using date parameters:', {
      checkIn: params.checkIn,
      checkOut: params.checkOut
    });
    
    // Step 1: Check for blocked days
    const blockedDays = await checkBlockedDays(params);
    
    if (blockedDays.length > 0) {
      return NextResponse.json({
        available: false,
        reason: 'BLOCKED_DAYS',
        blockedDays: blockedDays.map(day => day.day_blocked)
      }, { status: 200 });
    }

    // Step 2: Check for ongoing bookings
    const hasOngoingBookings = await checkOngoingBookings(params, request);
    
    if (hasOngoingBookings) {
      return NextResponse.json({
        available: false,
        reason: 'BOOKING_IN_PROGRESS'
      }, { status: 200 });
    }

    // Step 3: Check bed availability
    const availabilityResult = await checkBedAvailability(params);
    
    return NextResponse.json(availabilityResult, { status: 200 });

  } catch (error) {
    console.error('💥 Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function validateAndParseParams(searchParams: URLSearchParams): SearchParams {
  console.log('🔍 Validating date parameters...');
  
  const checkIn = searchParams.get('checkIn');
  const checkOut = searchParams.get('checkOut');
  const guestsParam = searchParams.get('guests');

  if (!checkIn || !checkOut || !guestsParam) {
    console.error('❌ Missing required parameters:', { checkIn, checkOut, guestsParam });
    throw new Error('Missing required parameters');
  }

  const guests = JSON.parse(guestsParam);
  if (!Array.isArray(guests)) {
    console.error('❌ Invalid guests format:', guests);
    throw new Error('Invalid guests parameter format');
  }

  // Usiamo le stringhe originali direttamente senza convertirle in oggetti Date
  // per evitare completamente i problemi di timezone
  const params = {
    checkIn: checkIn,            // Stringa originale YYYY-MM-DD
    checkOut: checkOut,          // Stringa originale YYYY-MM-DD
    guests
  };
  
  console.log('✅ Using original date strings:', {
    checkIn: params.checkIn,
    checkOut: params.checkOut
  });
  
  return params;
}

async function checkBlockedDays({ checkIn, checkOut }: DateRange): Promise<BlockedDay[]> {
  // Nota: escludiamo la data di checkout poiché non è una notte di soggiorno.
  // La query ora usa .lt (less than) per escludere il giorno esatto del checkout.
  
  console.log('📅 Checking blocked days for date range:', { 
    checkIn, 
    checkOut,
    message: '(query excludes checkout date)' // Aggiornato messaggio log
  });
  
  const { data: blockedDays, error } = await supabase
    .from('day_blocked')
    .select('day_blocked')
    .gte('day_blocked', checkIn)
    .lt('day_blocked', checkOut); 

  if (error) {
    console.error('❌ Error checking blocked days:', error);
    throw error;
  }
  
  if (blockedDays?.length) {
    console.log(`📅 Found ${blockedDays.length} blocked days:`, blockedDays);
  }
  
  return blockedDays || [];
}

async function checkOngoingBookings({ checkIn, checkOut }: DateRange, request: Request): Promise<boolean> {
  // Leggi sessionId dai cookie della richiesta
  let currentSessionId: string | undefined = undefined;
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    try {
      const cookiesParsed = parse(cookieHeader);
      currentSessionId = cookiesParsed.sessionId;
    } catch (e) {
      console.error('Error parsing cookie header in search API:', e);
    }
  }
  console.log(`🔍 Checking ongoing bookings for session: ${currentSessionId || '(no session)'}`);

  console.log('📅 Checking ongoing bookings for date range:', { checkIn, checkOut });
  const nowCET = new Date(new Date().toLocaleString('en-US', { timeZone: 'CET' }));
  console.log('🔍 Querying for overlapping bookings on hold (any session)...');
  
  const { data: allOngoingBookings, error } = await supabase
    .from('booking_on_hold')
    .select('*')
    .lt('check_in', checkOut)
    .gt('check_out', checkIn)
    .eq('still_on_hold', true);

  if (error) {
    console.error('❌ Error checking ongoing bookings:', error);
    throw error;
  }

  // NUOVO: Filtra via i booking hold della sessione corrente
  const ongoingBookingsFromOtherSessions = (allOngoingBookings || []).filter(booking => {
    const isOwnSession = currentSessionId && booking.session_id === currentSessionId;
    if (isOwnSession) {
      console.log(`Ignoring booking hold ID ${booking.id} as it belongs to the current session.`);
    }
    return !isOwnSession; // Mantieni solo quelli NON della sessione corrente
  });

  if (ongoingBookingsFromOtherSessions.length === 0) {
    console.log('✅ No overlapping bookings found from OTHER sessions.');
    return false; // Nessun blocco da altre sessioni
  }
  
  console.log(`⚠️ Found ${ongoingBookingsFromOtherSessions.length} overlapping booking(s) from other sessions. Checking expiry...`);

  // Controlla se ALMENO UNO dei blocchi da altre sessioni è ancora valido (non scaduto)
  const hasValidOngoingBookingFromOthers = ongoingBookingsFromOtherSessions.some((booking: BookingOnHold) => {
    const timeIsUpAt = new Date(booking.time_is_up_at);
    const enteredPayment = booking.entered_payment ? new Date(booking.entered_payment) : null;
    const paymentTimeLimit = enteredPayment ? new Date(enteredPayment.getTime() + 7 * 60 * 1000) : null; // +7 minutes

    const isValid = booking.still_on_hold &&
      (timeIsUpAt > nowCET || (enteredPayment && paymentTimeLimit && paymentTimeLimit > nowCET));

    if (isValid) {
      console.log(`Blocking due to valid hold ID ${booking.id} from session ${booking.session_id || '(unknown)'}`);
    }
    return isValid;
  });

  console.log(`✅ Overlapping bookings check result (from others): ${hasValidOngoingBookingFromOthers}`);
  return hasValidOngoingBookingFromOthers;
}

async function checkBedAvailability(params: SearchParams) {
  console.log('📅 Checking bed availability for dates:', { 
    checkIn: params.checkIn,
    checkOut: params.checkOut
  });

  // Fetch guest types and discounts
  const { data: guestTypes, error: guestTypesError } = await supabase
    .from('GuestDivision')
    .select('*');

  if (guestTypesError) {
    console.error('❌ Error fetching guest types:', guestTypesError);
    throw guestTypesError;
  }
  
  // First, get all available beds from RoomLinkBed
  const { data: rawBeds, error: bedsError } = await supabase
  .from('RoomLinkBed')
  .select(`
    id,
    roomId,
    name,
    bedId,
    Bed (
      id,
      priceBandB,
      priceMP,
      peopleCount
    ),
    Room (
      id,
      description,
      createdAt,
      RoomImage (
        id,
        url
      )
    )
  `);

  if (bedsError) {
    console.error('❌ Error fetching beds:', bedsError);
    throw bedsError;
  }

  // Cast the raw beds to our typed structure
  const allBeds = rawBeds as unknown as Bed[];

  // Get existing reservations
  const { data: rawReservations, error: reservationsError } = await supabase
    .from('Basket')
    .select(`
      id,
      dayFrom,
      dayTo,
      RoomReservation (
        id,
        RoomReservationSpec (
          id,
          roomLinkBedId
        ),
        ReservationLinkBedBlock (
          id,
          day,
          roomLinkBedId
        )
      )
    `)
    // Corrected temporal overlap condition: dayFrom < checkOut AND checkIn < dayTo
    .lt('dayFrom', params.checkOut)   
    .gt('dayTo', params.checkIn)     
    // Include paid OR admin-created reservations that are not cancelled
    .or('isPaid.eq.true,isCreatedByAdmin.eq.true') 
    .eq('isCancelled', false);

  if (reservationsError) {
    console.error('❌ Error fetching reservations:', reservationsError);
    throw reservationsError;
  }

  // Cast to our typed structure
  const existingReservations = rawReservations as unknown as Reservation[];

  // LOG: Selected Basket IDs
  console.log('🛒 Relevant Basket IDs found:', existingReservations?.map(r => r.id) || []);

  // Calculate occupied beds for each day
  const occupiedBedsByDay = new Map<string, Set<number>>();
  
  existingReservations?.forEach(reservation => {
    // Convertiamo le date delle prenotazioni in array di date nel range
    const dayFrom = reservation.dayFrom.split('T')[0]; // Ottiene YYYY-MM-DD dalla data ISO
    const dayTo = reservation.dayTo.split('T')[0];     // Ottiene YYYY-MM-DD dalla data ISO
    
    // Crea array di date tra dayFrom e dayTo
    const reservationDates = getDatesArrayInRange(dayFrom, dayTo);
    
    console.log(`📅 Processing reservation dates for reservation ID ${reservation.id}:`, reservationDates);

    reservationDates.forEach(dateStr => {
      if (!occupiedBedsByDay.has(dateStr)) {
        occupiedBedsByDay.set(dateStr, new Set());
      }

      // Add regular bed reservations
      reservation.RoomReservation?.forEach(roomRes => {
        // Add specifically reserved beds
        roomRes.RoomReservationSpec?.forEach(spec => {
          if (spec.roomLinkBedId) {
            // LOG: Booked bed from RoomReservationSpec
            console.log(`  🛌 Bed booked via Spec ID ${spec.id}: roomLinkBedId=${spec.roomLinkBedId} for date ${dateStr}`);
            occupiedBedsByDay.get(dateStr)?.add(spec.roomLinkBedId);
          }
        });

        // Add blocked beds
        roomRes.ReservationLinkBedBlock?.forEach(block => {
          if (block.day === dateStr && Array.isArray(block.roomLinkBedId)) {
            // LOG: Blocked beds from ReservationLinkBedBlock
            console.log(`  🚫 Beds blocked via Block ID ${block.id} for date ${block.day}: roomLinkBedIds=[${block.roomLinkBedId.join(', ')}]`);
            block.roomLinkBedId.forEach(bedId => {
              occupiedBedsByDay.get(dateStr)?.add(bedId);
            });
          }
        });
      });
    });
  });

  // Calculate dates in range as array di stringhe YYYY-MM-DD
  const datesInRange = getDatesArrayInRange(params.checkIn, params.checkOut);
  
  // Log occupied beds for requested dates only
  datesInRange.forEach(dateStr => {
    const occupiedBeds = occupiedBedsByDay.get(dateStr) || new Set();
    console.log(`📅 Date ${dateStr}: ${Array.from(occupiedBeds).length} occupied beds`);
  });

  // Calculate total required beds
  const totalRequiredBeds = params.guests.reduce((sum, guest) => sum + guest.count, 0);

  // Find beds available across all requested dates (for the entire stay)
  const availableBeds = allBeds?.filter(bed => {
    // Check if bed is available for all dates
    return datesInRange.every(dateStr => {
      const occupiedBedsForDay = occupiedBedsByDay.get(dateStr) || new Set();
      return !occupiedBedsForDay.has(bed.id);
    });
  }) || [];

  // LOG: Final Available Bed IDs
  console.log('✅ Available beds for the entire stay (IDs):', availableBeds.map(b => b.id));

  console.log(`📅 Found ${availableBeds.length} beds available for all dates in range ${params.checkIn} to ${params.checkOut}`);

  // NUOVO: Mappa di disponibilità per ogni notte, raggruppata per stanza
  const availabilityByNightAndRoom = datesInRange.map(dateStr => {
    const occupiedBedsIds = occupiedBedsByDay.get(dateStr) || new Set();
    
    // Raggruppa i letti per stanza
    const roomAvailabilityMap = new Map();
    
    allBeds?.forEach(bed => {
      if (!roomAvailabilityMap.has(bed.roomId)) {
        roomAvailabilityMap.set(bed.roomId, {
          roomId: bed.roomId,
          description: bed.Room.description,
          images: bed.Room.RoomImage?.map(img => img.url) || [],
          createdAt: bed.Room.createdAt,
          allBeds: [],
          availableBeds: []
        });
      }
      
      const isAvailable = !occupiedBedsIds.has(bed.id);
      
      // Aggiungi il letto alla lista di tutti i letti della stanza
      roomAvailabilityMap.get(bed.roomId).allBeds.push({
        id: bed.id,
        name: bed.name,
        isAvailable
      });
      
      // Se disponibile, aggiungilo anche alla lista di letti disponibili
      if (isAvailable) {
        roomAvailabilityMap.get(bed.roomId).availableBeds.push({
          id: bed.id,
          name: bed.name
        });
      }
    });
    
    // Converti la mappa in array
    const roomsAvailability = Array.from(roomAvailabilityMap.values());
    
    return {
      date: dateStr,
      rooms: roomsAvailability
    };
  });

  // Scenario 1: No beds available (sold out)
  if (availableBeds.length === 0) {
    return {
      status: "sold_out",
      availabilityByNight: availabilityByNightAndRoom,
      guestTypes: guestTypes  
    };
  }

  // Scenario 2: Some beds available but not enough
  if (availableBeds.length < totalRequiredBeds) {
    return {
      status: `too_little_availability:${availableBeds.length}`,
      availabilityByNight: availabilityByNightAndRoom,
      guestTypes: guestTypes  
    };
  }

  // Scenario 3: Enough beds available
  // Group beds by room
  const roomsMap = new Map();
  
  // First, group all beds by room
  allBeds?.forEach(bed => {
    if (!roomsMap.has(bed.roomId)) {
      roomsMap.set(bed.roomId, {
        roomId: bed.roomId,
        description: bed.Room.description,
        images: bed.Room.RoomImage?.map(img => img.url) || [],
        createdAt: bed.Room.createdAt,
        allBeds: [],
        availableBeds: []
      });
    }
    roomsMap.get(bed.roomId).allBeds.push({
      id: bed.id,
      name: bed.name,
      pricing: {
        bb: bed.Bed?.priceBandB || 0,
        mp: bed.Bed?.priceMP || 0
      }
    });
  });

  // Then add available beds to their rooms
  availableBeds.forEach(bed => {
    const room = roomsMap.get(bed.roomId);
    if (room) {
      room.availableBeds.push({
        id: bed.id,
        name: bed.name,
        pricing: {
          bb: bed.Bed?.priceBandB || 0,
          mp: bed.Bed?.priceMP || 0
        }
      });
    }
  });

  // Filter rooms that have at least one available bed and convert to array
  let availableRooms = Array.from(roomsMap.values())
  .filter(room => room.availableBeds.length > 0)
  .map(room => ({
    roomId: room.roomId,
    description: room.description,
    images: room.images,
    allBeds: room.allBeds.map((bed: Bed) => ({
      id: bed.id,
      name: bed.name,
      pricing: {
        bb: bed.pricing?.bb || 0,
        mp: bed.pricing?.mp || 0
      }
    })),
    availableBeds: room.availableBeds.map((bed: Bed) => ({
      id: bed.id,
      name: bed.name,
      pricing: {
        bb: bed.pricing?.bb || 0,
        mp: bed.pricing?.mp || 0
      }
    })),
    createdAt: room.createdAt
  }));
  // Ordina le stanze per createdAt crescente
  availableRooms = availableRooms.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  // Stampa l'ordine delle stanze per debug
  //console.log('ORDINE STANZE API:', availableRooms.map(r => ({ id: r.roomId, description: r.description, createdAt: r.createdAt })));
    
  return {
    status: "enough",
    rooms: availableRooms,
    availabilityByNight: availabilityByNightAndRoom,
    guestTypes: guestTypes
  };
}

// Funzione per ottenere un array di date come stringhe YYYY-MM-DD
function getDatesArrayInRange(startDate: string, endDate: string): string[] {
  console.log('📅 Getting dates array from:', startDate, 'to:', endDate);
  
  // Converti le stringhe in oggetti Date
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const dates: string[] = [];
  const current = new Date(start);
  
  // Itera fino a quando la data corrente è minore o uguale alla data di fine
  while (current < end) {
    // Formatta la data come YYYY-MM-DD
    const dateStr = current.toISOString().split('T')[0];
    dates.push(dateStr);
    
    // Passa al giorno successivo
    current.setDate(current.getDate() + 1);
  }
  
  console.log('📅 Generated date range:', dates);
  return dates;
}