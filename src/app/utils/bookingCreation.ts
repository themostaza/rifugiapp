import { SupabaseClient } from '@supabase/supabase-js';

interface Guest {
  type: 'adult' | 'child' | 'infant';
  roomId: number | null;
  bedId: string | null;
}

// Updated Bed structure based on API search response (allBeds content)
interface BedDetails {
  id: number;
  name: string;
  pricing?: {
    bb: number;
    mp: number;
  };
}

// Updated Room structure based on API search response
interface Room {
  roomId: number;
  description: string; // Added description
  images?: string[]; // Optional images
  allBeds: BedDetails[]; // Contains all beds with pricing
  availableBeds: Array<{ id: number; name: string }>; // Contains only available bed IDs/names
}

interface GuestType {
  id: number;
  description: string;
  ageFrom: number;
  ageTo: number;
  salePercent: number;
  title: string;
  cityTax: boolean;
  cityTaxPrice: number;
}

// Interfaccia per i servizi selezionati nel checkout
interface SelectedService {
  id: number;
  description: string;
  price: number;
  quantity: number;
  totalPrice: number;
  detailedBlockedBeds?: { [roomId: number]: { [date: string]: number[] } };
}

// Interface for the detailed structure of a booked room saved in JSONB
interface BookedRoomDetail {
  roomId: number;
  description: string;
  privacyCost: number;
  assignedBeds: Array<{
    guestType: 'adult' | 'child' | 'infant';
    bedId: number; // ID from Bed table (as derived from original room data)
    bedName: string;
    price: number; // Calculated price for this specific assignment
  }>;
}

interface BookingData {
  checkIn: string | Date;
  checkOut: string | Date;
  pensionType: string;
  rooms: Room[];
  assignedGuests: Guest[];
  roomPrivacyCosts: { [roomId: number]: number };
  guestTypes: GuestType[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  selectedRegion: string;
  notes: string;
  totalAmount: number;
  countryName: string;
  isAdmin?: boolean;
  // Nuovi campi per dettagli aggiuntivi
  selectedServices?: SelectedService[];
  detailedBlockedBeds?: { [roomId: number]: { [date: string]: number[] } };
}

export async function createBooking(
  supabase: SupabaseClient,
  data: BookingData
) {
  if (!data.totalAmount || data.totalAmount <= 0) {
    throw new Error('Non è possibile creare una prenotazione con importo zero.');
  }

  
  console.log(`Creating ${data.isAdmin ? 'admin' : 'regular'} basket with data:`, {
    checkIn: data.checkIn, // Expecting 'YYYY-MM-DD'
    checkOut: data.checkOut, // Expecting 'YYYY-MM-DD'
    customerName: data.customerName,
    customerEmail: data.customerEmail,
    totalAmount: data.totalAmount,
    countryName: data.countryName
  });

  // Log the received data object for debugging
  console.log('[bookingCreation] Received data:', JSON.stringify(data, null, 2));

  // Prepare the specific details to save in JSONB
  const bookedRoomsDetails: BookedRoomDetail[] = []; // Use the specific type
  const usedRoomIds = new Set<number>();
  const guestPrices: { [guestKey: string]: number } = {}; // Key: "roomId-bedId-type"
  const checkInDate = new Date(data.checkIn);
  const checkOutDate = new Date(data.checkOut);
  const numNights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));

  data.assignedGuests.forEach(guest => {
    if (!guest.roomId || !guest.bedId) return;

    usedRoomIds.add(guest.roomId);

    let roomDetail = bookedRoomsDetails.find(r => r.roomId === guest.roomId);
    if (!roomDetail) {
      // Find the full room info from the original data.rooms
      const originalRoom = data.rooms.find(r => r.roomId === guest.roomId);
      if (!originalRoom) return; // Should not happen if data is consistent

      roomDetail = {
        roomId: guest.roomId,
        description: originalRoom.description, // Get room description
        privacyCost: data.roomPrivacyCosts[guest.roomId] || 0,
        assignedBeds: []
      };
      bookedRoomsDetails.push(roomDetail);
    }

    // Find the specific bed details from the original room data
    const originalRoom = data.rooms.find(r => r.roomId === guest.roomId);
    const bedDetails = originalRoom?.allBeds.find(b => b.id.toString() === guest.bedId);
    if (!bedDetails || !bedDetails.pricing) return; // Bed or pricing info missing

    // Find guest type info to calculate price
    const guestTypeInfo = data.guestTypes.find((type) => {
        if (guest.type === 'adult') return type.title === 'Adulti';
        if (guest.type === 'child') return type.title === 'Bambini';
        if (guest.type === 'infant') return type.title === 'Neonati';
        return false;
    });

    if (!guestTypeInfo) return; // Guest type info needed for price calculation

    // Calculate price for this specific bed/guest
    const basePrice = data.pensionType === 'bb' ? (bedDetails.pricing?.bb ?? 0) : (bedDetails.pricing?.mp ?? 0);
    const discount = guestTypeInfo.salePercent;
    const calculatedPrice = basePrice * (1 - (discount / 100)) * numNights;

    // Store calculated price for later use in RoomReservationSpec
    const guestKey = `${guest.roomId}-${guest.bedId}-${guest.type}`;
    guestPrices[guestKey] = calculatedPrice;

    roomDetail.assignedBeds.push({
      guestType: guest.type,
      bedId: bedDetails.id,
      bedName: bedDetails.name,
      price: calculatedPrice // Save the calculated price for this assignment in JSONB too
    });
  });

  // Genera il timestamp al momento della creazione
  const bookingTimestamp = new Date().toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Rome' // Assicurati che il timezone sia corretto per il server
  });

  const detailsToSave = {
    // Info generali essenziali
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    pensionType: data.pensionType,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerEmail: data.customerEmail,
    countryName: data.countryName,
    selectedRegion: data.selectedRegion,
    notes: data.notes,
    totalAmount: data.totalAmount, // Keep the final total calculated by frontend
    // Dettagli aggiuntivi richiesti
    bookingTimestamp: bookingTimestamp, // Timestamp creazione (server-side)
    selectedServices: data.selectedServices || [], // Lista dettagliata servizi aggiuntivi
    detailedBlockedBeds: data.detailedBlockedBeds || {}, // Dettaglio letti bloccati per privacy
    // Dettagli di cosa è stato prenotato
    bookedRooms: bookedRoomsDetails
  };

  // Log the object we are about to save to booking_details
  console.log('[bookingCreation] Attempting to save booking_details:', JSON.stringify(detailsToSave, null, 2));

  // Create basket with proper flags based on isAdmin
  const { data: basket, error: basketError } = await supabase
    .from('Basket')
    .insert({
      dayFrom: data.checkIn, // Use the date string directly
      dayTo: data.checkOut,   // Use the date string directly
      note: data.notes || '',
      name: data.customerName,
      surname: '',
      mail: data.customerEmail,
      phone: data.customerPhone,
      city: data.countryName,
      region: data.selectedRegion || '',
      reservationType: data.pensionType,
      totalPrice: data.totalAmount, // Use the final total amount
      isPaid: false, // Sempre false inizialmente, anche per prenotazioni admin
      stripeId: '', // Lasciamo vuoto per tutti
      paymentIntentId: '', // Lasciamo vuoto per tutti
      isCancelled: false,
      isCreatedByAdmin: data.isAdmin ? true : false,
      // Save the *lean* booking details
      booking_details: detailsToSave
    })
    .select()
    .single();

  if (basketError) {
    console.error(`Error creating ${data.isAdmin ? 'admin' : 'regular'} basket:`, basketError);
    throw basketError;
  }

  console.log(`${data.isAdmin ? 'Admin' : 'Regular'} basket created successfully:`, basket);

  // Calculate total services cost once
  const totalServicesCost = (data.selectedServices || []).reduce((sum, service) => sum + service.totalPrice, 0);

  // Calculate total privacy cost once
  const totalPrivacyCost = Object.values(data.roomPrivacyCosts).reduce((sum, cost) => sum + (cost || 0), 0);

  // --- Create ONE RoomReservation for the entire Basket ---
  const { data: roomReservation, error: roomReservationError } = await supabase
    .from('RoomReservation')
    .insert({
      basketId: basket.id,
      bedBlockPriceTotal: totalPrivacyCost, // Sum of all room privacy costs
      servicePriceTotal: totalServicesCost // Use the calculated total service cost
    })
    .select('id') // Select only the ID
    .single();

  if (roomReservationError) {
    console.error('Error creating the single room reservation:', roomReservationError);
    // Consider rolling back the basket insert or marking it as failed
    throw roomReservationError;
  }
  if (!roomReservation) {
     console.error('Failed to create the single room reservation or retrieve its ID.');
     throw new Error('Failed to create the single room reservation');
  }
  const roomReservationId = roomReservation.id; // Use this ID for all related items
  console.log('Single Room reservation created with ID:', roomReservationId);

  // Create room reservations and related details (now linking to the single RoomReservation)
  for (const room of data.rooms) {
    const currentRoomId = room.roomId; // Use a clear variable name
    // console.log('Processing room:', currentRoomId); // Keep logging minimal if not debugging
    const roomGuests = data.assignedGuests.filter((guest: Guest) => guest.roomId === currentRoomId);
    // console.log('Guests for this room:', roomGuests);

    if (roomGuests.length === 0) continue; // Skip room if no guests assigned

    /* RoomReservation creation moved outside the loop */

    // Create RoomReservationSpec for each guest in this room
    for (const guest of roomGuests) {
      if (!guest.bedId || !guest.roomId || guest.roomId !== currentRoomId) continue;

      const guestBedId = parseInt(guest.bedId); // This is already the RoomLinkBed ID

      // RoomLinkBed ID lookup removed
      const roomLinkBedId = guestBedId; // Use the ID directly from input
      
      /* Removed check for null roomLinkBedId as we use the input directly
      if (roomLinkBedId === null) {
        console.error(`Could not find RoomLinkBed for room ${currentRoomId} and bed ${guestBedId}. Skipping spec.`);
        // Consider more robust error handling - should this fail the whole booking?
        continue;
      }
      */

      const guestType = data.guestTypes.find((type: GuestType) => {
        if (guest.type === 'adult') return type.title === 'Adulti';
        if (guest.type === 'child') return type.title === 'Bambini';
        if (guest.type === 'infant') return type.title === 'Neonati';
        return false;
      });

      if (!guestType) {
        console.warn('No guest type info found for guest:', guest);
        continue;
      }

      // Retrieve the calculated price for this guest
      const guestKey = `${guest.roomId}-${guest.bedId}-${guest.type}`;
      const guestPrice = guestPrices[guestKey] ?? 0; // Default to 0 if not found, though it should exist


      console.log('Creating reservation spec for guest:', {
        roomReservationId: roomReservationId,
        guestDivisionId: guestType.id,
        roomLinkBedId: roomLinkBedId,
        price: guestPrice
      });

      const { error: specError } = await supabase
        .from('RoomReservationSpec')
        .insert({
          roomReservationId: roomReservationId,
          guestDivisionId: guestType.id,
          roomLinkBedId: roomLinkBedId, // Use the looked-up RoomLinkBed ID
          price: guestPrice // Use the calculated price for this guest
        });

      if (specError) {
        console.error('Error creating reservation spec:', specError);
        // Consider rollback or marking as failed
        throw specError;
      }
    }

    // Create ReservationLinkBedBlock entries for this room reservation (linked to the single RoomReservation)
    const blockedBedsForRoom = data.detailedBlockedBeds?.[currentRoomId];
    if (blockedBedsForRoom) {
      // console.log(`Processing bed blocks for room ${currentRoomId}:`, blockedBedsForRoom);
      for (const [dateStr, blockedBedIdsNum] of Object.entries(blockedBedsForRoom)) {
        if (!blockedBedIdsNum || blockedBedIdsNum.length === 0) continue;

        // RoomLinkBed IDs lookup removed - use directly from input
        const roomLinkBedIds = blockedBedIdsNum.map(id => typeof id === 'string' ? parseInt(id) : id);
        // Basic check if conversion resulted in NaN for any ID
        if (roomLinkBedIds.some(isNaN)) {
          console.error(`Invalid (non-numeric) RoomLinkBed ID found in blockedBedIdsNum for date ${dateStr}:`, blockedBedIdsNum);
          continue; // Skip this entry
        }


        if (roomLinkBedIds.length > 0) {
            console.log(`Creating ReservationLinkBedBlock for date ${dateStr} with RoomLinkBed IDs:`, roomLinkBedIds);
            const { error: bedBlockError } = await supabase
            .from('ReservationLinkBedBlock')
            .insert({
              roomReservationId: roomReservationId, // Use the single ID
              day: dateStr, // Assuming 'YYYY-MM-DD' format matches 'date' type in DB
              roomLinkBedId: roomLinkBedIds, // Array of RoomLinkBed IDs
              // bedBlockId is null as requested
            });

          if (bedBlockError) {
            console.error(`Error creating ReservationLinkBedBlock for date ${dateStr}:`, bedBlockError);
            // Consider rollback or marking as failed
            throw bedBlockError;
          }
        } else {
            // This case should not happen anymore if we directly use input array
            // console.warn(`Could not find any RoomLinkBed IDs for beds ${blockedBedIdsNum} on date ${dateStr} in room ${currentRoomId}. Skipping block entry.`);
        }
      }
    }

  } // End loop through rooms

  // Create ReservationLinkService entries for the single RoomReservation (moved outside the loop)
  if (data.selectedServices && data.selectedServices.length > 0) {
    console.log(`Processing services for the single room reservation ${roomReservationId}:`, data.selectedServices);
    const serviceInserts = data.selectedServices.map(service => ({
      roomReservationId: roomReservationId, // Use the single ID
      serviceId: service.id,
      quantity: service.quantity
    }));

    const { error: serviceLinkError } = await supabase
    .from('ReservationLinkService')
    .insert(serviceInserts);

    if (serviceLinkError) {
    console.error(`Error creating ReservationLinkService entries for the single room reservation ${roomReservationId}:`, serviceLinkError);
    // Consider rollback or marking as failed
    throw serviceLinkError;
    }
  }

  return basket;
} 