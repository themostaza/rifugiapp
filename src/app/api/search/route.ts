import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// Types for better code organization
type DateRange = {
  checkIn: Date;
  checkOut: Date;
};

type GuestType = 'adult' | 'child' | 'infant';

type SearchParams = DateRange & {
  guests: { type: GuestType; count: number }[];
};

type BlockedDay = {
  day_blocked: string;
};

type BookingOnHold = {
  check_in: string;
  check_out: string;
  time_is_up_at: string;
  still_on_hold: boolean;
  entered_payment: string;
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
    console.log('📌 Raw search parameters:', Object.fromEntries(searchParams));
    
    const params = validateAndParseParams(searchParams);
    console.log('✅ Validated parameters:', {
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      guests: params.guests
    });
    
    // Step 1: Check for blocked days
    console.log('🚫 Checking blocked days...');
    const blockedDays = await checkBlockedDays(params);
    console.log(`Found ${blockedDays.length} blocked days:`, blockedDays);
    
    if (blockedDays.length > 0) {
      console.log('❌ Request blocked due to blocked days');
      return NextResponse.json({
        available: false,
        reason: 'BLOCKED_DAYS',
        blockedDays: blockedDays.map(day => day.day_blocked)
      }, { status: 200 });
    }

    // Step 2: Check for ongoing bookings
    console.log('🔄 Checking ongoing bookings...');
    const hasOngoingBookings = await checkOngoingBookings(params);
    console.log('Ongoing bookings status:', hasOngoingBookings);
    
    if (hasOngoingBookings) {
      console.log('❌ Request blocked due to ongoing bookings');
      return NextResponse.json({
        available: false,
        reason: 'BOOKING_IN_PROGRESS'
      }, { status: 200 });
    }

    // Step 3: Check bed availability
    console.log('🛏️ Checking bed availability...');
    const availabilityResult = await checkBedAvailability(params);
    console.log('Availability result:', availabilityResult);
    
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
  console.log('🔍 Validating and parsing parameters...');
  
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

  const params = {
    checkIn: new Date(checkIn),
    checkOut: new Date(checkOut),
    guests
  };
  console.log('✅ Parsed parameters:', params);
  return params;
}

async function checkBlockedDays({ checkIn, checkOut }: DateRange): Promise<BlockedDay[]> {
  // Note: we exclude checkOut date as it's not a night of stay
  const effectiveCheckOut = new Date(checkOut);
  effectiveCheckOut.setDate(effectiveCheckOut.getDate() - 1);
  
  console.log('🔍 Checking blocked days for range:', { 
    checkIn, 
    effectiveCheckOut,
    message: '(excluding checkout date)'
  });


  
  const { data: blockedDays, error } = await supabase
    .from('day_blocked')
    .select('day_blocked')
    .gte('day_blocked', checkIn.toISOString())
    .lte('day_blocked', effectiveCheckOut.toISOString());

  if (error) {
    console.error('❌ Error checking blocked days:', error);
    throw error;
  }
  
  console.log(`✅ Found ${blockedDays?.length || 0} blocked days:`, blockedDays);
  return blockedDays || [];
}

async function checkOngoingBookings({ checkIn, checkOut }: DateRange): Promise<boolean> {
  // Note: we exclude checkOut date as it's not a night of stay
  const effectiveCheckOut = new Date(checkOut);
  effectiveCheckOut.setDate(effectiveCheckOut.getDate() - 1);
  
  console.log('🔍 Checking ongoing bookings for range:', { 
    checkIn, 
    effectiveCheckOut,
    message: '(excluding checkout date)'
  });
  
  const nowCET = new Date(new Date().toLocaleString('en-US', { timeZone: 'CET' }));
  console.log('Current CET time:', nowCET);
  
  const { data: ongoingBookings, error } = await supabase
    .from('booking_on_hold')
    .select('*')
    .or(`check_in.gte.${checkIn.toISOString()},check_out.lte.${effectiveCheckOut.toISOString()}`);

  if (error) {
    console.error('❌ Error checking ongoing bookings:', error);
    throw error;
  }

  console.log('📊 Found ongoing bookings:', ongoingBookings);

  const hasOngoing = (ongoingBookings || []).some((booking: BookingOnHold) => {
    const timeIsUpAt = new Date(booking.time_is_up_at);
    const enteredPayment = new Date(booking.entered_payment);
    const paymentTimeLimit = new Date(enteredPayment.getTime() + 7 * 60 * 1000); // +7 minutes

    const isOngoing = booking.still_on_hold &&
      (timeIsUpAt > nowCET || (booking.entered_payment && paymentTimeLimit > nowCET));
    
    console.log('Booking status check:', {
      bookingId: booking.check_in,
      timeIsUpAt,
      enteredPayment,
      paymentTimeLimit,
      isOngoing
    });

    return isOngoing;
  });

  console.log('✅ Ongoing bookings check result:', hasOngoing);
  return hasOngoing;
}

async function checkBedAvailability(params: SearchParams) {
  console.log('🔍 Checking bed availability for:', params);

  // Get all existing reservations for the date range
  // Note: we exclude checkOut date as it's not a night of stay
  const effectiveCheckOut = new Date(params.checkOut);
  effectiveCheckOut.setDate(effectiveCheckOut.getDate() - 1);
  
  console.log('Fetching existing reservations...', {
    from: params.checkIn,
    to: effectiveCheckOut,
    message: '(excluding checkout date)'
  });

  console.log('Fetching guest types and discount information...');
  const { data: guestTypes, error: guestTypesError } = await supabase
    .from('GuestDivision')
    .select('*');

  if (guestTypesError) {
    console.error('❌ Error fetching guest types:', guestTypesError);
    throw guestTypesError;
  }

  console.log('Guest types and discounts:', guestTypes);
  
  // First, get all available beds from RoomLinkBed
  console.log('Fetching all available beds...');
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

  const totalBeds = allBeds?.length || 0;
  console.log(`📊 Found ${totalBeds} total beds`);

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
    .gte('dayTo', params.checkIn.toISOString())
    .lte('dayFrom', effectiveCheckOut.toISOString())   
    .eq('isPaid', true)
    .eq('isCancelled', false);

  if (reservationsError) {
    console.error('❌ Error fetching reservations:', reservationsError);
    throw reservationsError;
  }

  // Cast to our typed structure
  const existingReservations = rawReservations as unknown as Reservation[];

  // Calculate occupied beds for each day
  console.log('Calculating occupied beds by day...');
  const occupiedBedsByDay = new Map<string, Set<number>>();
  
  existingReservations?.forEach(reservation => {
    const reservationDates = getDatesInRange(
      new Date(reservation.dayFrom),
      new Date(reservation.dayTo)
    );

    console.log(`Processing reservation dates for reservation ID ${reservation.id}:`, reservationDates);

    reservationDates.forEach(date => {
      const dateStr = date.toISOString().split('T')[0];
      if (!occupiedBedsByDay.has(dateStr)) {
        occupiedBedsByDay.set(dateStr, new Set());
      }

      // Add regular bed reservations
      reservation.RoomReservation?.forEach(roomRes => {
        // Add specifically reserved beds
        roomRes.RoomReservationSpec?.forEach(spec => {
          if (spec.roomLinkBedId) {
            occupiedBedsByDay.get(dateStr)?.add(spec.roomLinkBedId);
          }
        });

        // Add blocked beds
        roomRes.ReservationLinkBedBlock?.forEach(block => {
          if (block.day === dateStr && Array.isArray(block.roomLinkBedId)) {
            block.roomLinkBedId.forEach(bedId => {
              occupiedBedsByDay.get(dateStr)?.add(bedId);
            });
          }
        });
      });
    });
  });

  // Calculate dates in range
  const datesInRange = getDatesInRange(params.checkIn, effectiveCheckOut);
  
  // Log occupied beds for requested dates only
  datesInRange.forEach(date => {
    const dateStr = date.toISOString().split('T')[0];
    const occupiedBeds = occupiedBedsByDay.get(dateStr) || new Set();
    console.log(`🛏️ Occupied beds for ${dateStr}:`, Array.from(occupiedBeds).sort((a, b) => a - b));
  });

  // Calculate total required beds
  const totalRequiredBeds = params.guests.reduce((sum, guest) => sum + guest.count, 0);
  console.log('Total required beds:', totalRequiredBeds);

  // Check availability for each day
  console.log('Checking availability for dates:', datesInRange);
  
  const availabilityByDay = datesInRange.map(date => {
    const dateStr = date.toISOString().split('T')[0];
    const occupiedBeds = occupiedBedsByDay.get(dateStr)?.size || 0;
    const availableBeds = totalBeds - occupiedBeds;

    console.log('Availability for', dateStr, {
      totalBeds,
      occupiedBeds,
      availableBeds,
      required: totalRequiredBeds,
      isAvailable: availableBeds >= totalRequiredBeds
    });

    return {
      date: dateStr,
      available: availableBeds >= totalRequiredBeds,
      availableBeds,
      requiredBeds: totalRequiredBeds
    };
  });

  const isAvailable = availabilityByDay.every(day => day.available);
  console.log('Final availability result:', isAvailable);

  // Find beds available across all requested dates (for the entire stay)
  const availableBeds = allBeds?.filter(bed => {
    // Check if bed is available for all dates
    return datesInRange.every(date => {
      const dateStr = date.toISOString().split('T')[0];
      const occupiedBedsForDay = occupiedBedsByDay.get(dateStr) || new Set();
      return !occupiedBedsForDay.has(bed.id);
    });
  }) || [];

  console.log(`Found ${availableBeds.length} beds available for all dates`);

  // NUOVO: Mappa di disponibilità per ogni notte, raggruppata per stanza
  const availabilityByNightAndRoom = datesInRange.map(date => {
    const dateStr = date.toISOString().split('T')[0];
    const occupiedBedsIds = occupiedBedsByDay.get(dateStr) || new Set();
    
    // Raggruppa i letti per stanza
    const roomAvailabilityMap = new Map();
    
    allBeds?.forEach(bed => {
      if (!roomAvailabilityMap.has(bed.roomId)) {
        roomAvailabilityMap.set(bed.roomId, {
          roomId: bed.roomId,
          description: bed.Room.description,
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
  const availableRooms = Array.from(roomsMap.values())
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
    }))
  }));

  console.log('available rooms:', JSON.stringify(availableRooms, null, 2));
    
  return {
    status: "enough",
    rooms: availableRooms,
    availabilityByNight: availabilityByNightAndRoom,
    guestTypes: guestTypes
  };
}

function getDatesInRange(start: Date, end: Date): Date[] {
  console.log('Getting dates in range:', { start, end });
  const dates = [];
  const current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  console.log('Dates in range:', dates.map(d => d.toISOString().split('T')[0]));
  return dates;
}