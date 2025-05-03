import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { calculateNumberOfNights } from '@/app/utils/dateUtils';

// Define structure for bed info lookup
interface BedInfo {
  name: string;
  roomId: number;
  roomDescription: string;
}

// Updated Types for the response
interface RoomDetails {
  id: number;
  description: string;
}

interface GuestDivisionDetails {
  id: number;
  title: string;
  cityTax: boolean;
  cityTaxPrice: number;
}

interface ServiceDetails {
  id: number;
  description: string;
  price: number;
}

interface FormattedService {
  linkId: number;
  serviceId: number;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface FormattedGuest {
  specId: number;
  guestType: string;
  bedName: string;
  price: number;
}

interface PrivacyBlockDetail {
    day: string;
    beds: Array<{
        id: number;
        name: string;
    }>;
}

interface FormattedRoom {
  roomId: number;
  roomDescription: string;
  guests: FormattedGuest[];
  privacyBlocks: PrivacyBlockDetail[];
}

type RawService = ServiceDetails;
interface RawReservationLinkService {
    id: number;
    quantity: number;
    Service: RawService | null;
}

type RawRoom = RoomDetails;
interface RawRoomLinkBed {
    id: number;
    name: string;
    roomId: number;
    Room: RawRoom | null;
}
type RawGuestDivision = GuestDivisionDetails;
interface RawRoomReservationSpec {
    id: number;
    price: number;
    guestDivisionId: number;
    roomLinkBedId: number;
    GuestDivision: RawGuestDivision | null;
    RoomLinkBed: RawRoomLinkBed | null;
}
interface RawReservationLinkBedBlock {
    id: number;
    day: string;
    roomLinkBedId: number[] | null;
}
interface RawRoomReservation {
    id: number;
    bedBlockPriceTotal: number;
    servicePriceTotal: number;
    ReservationLinkService: RawReservationLinkService[] | null;
    RoomReservationSpec: RawRoomReservationSpec[] | null;
    ReservationLinkBedBlock: RawReservationLinkBedBlock[] | null;
}
interface RawBasket {
    id: number;
    external_id: string;
    dayFrom: string;
    dayTo: string;
    name: string | null;
    surname: string | null;
    mail: string;
    phone: string;
    region: string;
    note: string;
    reservationType: string;
    totalPrice: number;
    isPaid: boolean;
    isCancelled: boolean;
    createdAt: string;
    stripeId: string;
    isCreatedByAdmin: boolean;
    RoomReservation: RawRoomReservation[] | null;
}

interface FormattedBookingDetails {
  id: number;
  external_id: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestRegion: string;
  reservationType: string;
  totalPrice: number;
  isPaid: boolean;
  isCancelled: boolean;
  createdAt: string;
  stripeId: string;
  isCreatedByAdmin: boolean;
  cityTaxTotal: number;
  totalPrivacyCost: number;
  services: FormattedService[];
  rooms: FormattedRoom[];
  note: string;
}

interface FetchedBedDetails {
    id: number;
    name: string;
    roomId: number;
    Room: Array<{
        id: number;
        description: string;
    }> | null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const externalId = searchParams.get('external_id');

    if (!externalId) {
      return NextResponse.json(
        { error: 'External ID is required' },
        { status: 400 }
      );
    }

    // Step 1: Fetch booking details including ReservationLinkBedBlock
    const { data: booking, error: bookingError } = await supabase
      .from('Basket')
      .select(`
        id,
        external_id,
        dayFrom,
        dayTo,
        name,
        surname,
        mail,
        phone,
        region,
        note,
        reservationType,
        totalPrice,
        isPaid,
        isCancelled,
        createdAt,
        stripeId,
        isCreatedByAdmin,
        RoomReservation (
          id,
          bedBlockPriceTotal,
          servicePriceTotal,
          ReservationLinkService (
            id,
            quantity,
            Service (
              id,
              description,
              price
            )
          ),
          RoomReservationSpec (
            id,
            price,
            guestDivisionId,
            roomLinkBedId,
            GuestDivision (
              id,
              title,
              cityTax,
              cityTaxPrice
            ),
            RoomLinkBed (
              id,
              name,
              roomId,
              Room (
                id,
                description
              )
            )
          ),
          ReservationLinkBedBlock (
             id,
             day,
             roomLinkBedId
          )
        )
      `)
      .eq('external_id', externalId)
      .single<RawBasket>();

    if (bookingError) {
      console.error('Error fetching detailed booking details:', bookingError);
      return NextResponse.json(
        { error: 'Failed to fetch booking details', details: bookingError.message },
        { status: 500 }
      );
    }

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Step 2: Collect all unique RoomLinkBed IDs from bed blocks
    const allRoomReservations = booking.RoomReservation || [];
    const uniqueBlockedBedIds = new Set<number>();
    allRoomReservations.forEach(rr => {
        (rr.ReservationLinkBedBlock || []).forEach(block => {
            (block.roomLinkBedId || []).forEach(id => uniqueBlockedBedIds.add(id));
        });
    });

    // Step 3: Fetch details for the blocked beds (name, roomId, roomDescription)
    const bedIdToInfo = new Map<number, BedInfo>();
    if (uniqueBlockedBedIds.size > 0) {
        const { data: bedDetails, error: bedError } = await supabase
            .from('RoomLinkBed')
            .select(`
                id,
                name,
                roomId,
                Room (
                    id,
                    description
                )
            `)
            .in('id', Array.from(uniqueBlockedBedIds));

        if (bedError) {
            console.error('Error fetching blocked bed details:', bedError);
            // Continue processing, but privacy block details might be incomplete
        } else if (bedDetails) {
            bedDetails.forEach((bed: FetchedBedDetails) => { // Use specific type
                 const roomInfo = bed.Room ? bed.Room[0] : null; // Access the first element if array exists
                 if (roomInfo) { // Check if we got room info
                    bedIdToInfo.set(bed.id, {
                        name: bed.name,
                        roomId: bed.roomId,
                        roomDescription: roomInfo.description // Use description from roomInfo
                    });
                 }
            });
        }
    }


    // Step 4: Initialize processing variables
    const roomsMap = new Map<number, FormattedRoom>();
    let totalCityTax = 0;
    const allServicesList: FormattedService[] = [];
    let totalPrivacyCostFromRR = 0;
    const numNights = calculateNumberOfNights(booking.dayFrom, booking.dayTo);

    // Step 5: Process fetched data
    for (const rr of allRoomReservations) {
        totalPrivacyCostFromRR += rr.bedBlockPriceTotal || 0;

        // 5a: Process Specs -> Group guests & calculate tax
        for (const spec of rr.RoomReservationSpec || []) {
            const roomLinkBed = spec.RoomLinkBed;
            const room = roomLinkBed?.Room;
            const guestDivision = spec.GuestDivision;

            if (!room || !roomLinkBed || !guestDivision) continue; // Need all parts

            const roomId = room.id;

            // Ensure room exists in map
            if (!roomsMap.has(roomId)) {
                roomsMap.set(roomId, {
                    roomId: roomId,
                    roomDescription: room.description || 'Camera non specificata',
                    guests: [],
                    privacyBlocks: []
                });
            }
            const roomData = roomsMap.get(roomId)!; // Assert non-null as we just set it

            // Add guest
            roomData.guests.push({
                specId: spec.id,
                guestType: guestDivision.title || 'Sconosciuto',
                bedName: roomLinkBed.name || 'Letto non specificato',
                price: spec.price || 0
            });

            // Calculate city tax
            if (guestDivision.cityTax && numNights > 0) {
                totalCityTax += (guestDivision.cityTaxPrice * numNights);
            }
        }

        // 5b: Collect Services
        for (const rs of rr.ReservationLinkService || []) {
             if (rs.Service) {
                 allServicesList.push({
                    linkId: rs.id,
                    serviceId: rs.Service.id,
                    description: rs.Service.description || 'Servizio sconosciuto',
                    quantity: rs.quantity || 0,
                    unitPrice: rs.Service.price || 0,
                    totalPrice: (rs.quantity || 0) * (rs.Service.price || 0)
                 });
             }
        }

        // 5c: Process Bed Blocks -> Assign details to correct room
        for (const block of rr.ReservationLinkBedBlock || []) {
            const blockDay = block.day;
            // Group beds in this block by their actual room
            const bedsByRoom = new Map<number, Array<{ id: number, name: string }>>();

            for (const bedId of block.roomLinkBedId || []) {
                const bedInfo = bedIdToInfo.get(bedId);
                if (bedInfo) {
                    const roomId = bedInfo.roomId;
                    if (!bedsByRoom.has(roomId)) {
                        bedsByRoom.set(roomId, []);
                    }
                    bedsByRoom.get(roomId)!.push({ id: bedId, name: bedInfo.name });
                }
            }

            // Add the grouped block details to the corresponding room in roomsMap
            for (const [roomId, beds] of bedsByRoom.entries()) {
                 const bedInfoForRoom = bedIdToInfo.get(beds[0]?.id); // Get info for room desc if needed

                 // Ensure room exists in map (might be a room with only blocked beds)
                 if (!roomsMap.has(roomId)) {
                     if (bedInfoForRoom) {
                         roomsMap.set(roomId, {
                             roomId: roomId,
                             roomDescription: bedInfoForRoom.roomDescription || 'Camera non specificata',
                             guests: [],
                             privacyBlocks: []
                         });
                     } else {
                         // Cannot determine room description if bed info lookup failed AND no guests are in this room
                         // Create a placeholder room entry
                          roomsMap.set(roomId, {
                             roomId: roomId,
                             roomDescription: `Camera ID ${roomId} (Solo Letti Bloccati)`,
                             guests: [],
                             privacyBlocks: []
                         });
                     }
                 }
                 const roomData = roomsMap.get(roomId)!;

                 // Add privacy block details
                 roomData.privacyBlocks.push({
                     day: blockDay,
                     beds: beds
                 });
            }
        }
    }


    // Step 6: Format the final response
    const formattedBooking: FormattedBookingDetails = {
      id: booking.id,
      external_id: booking.external_id, // Include external_id
      checkIn: booking.dayFrom,
      checkOut: booking.dayTo,
      guestName: `${booking.name || ''} ${booking.surname || ''}`.trim(),
      guestEmail: booking.mail,
      guestPhone: booking.phone,
      guestRegion: booking.region,
      reservationType: booking.reservationType,
      totalPrice: booking.totalPrice,
      isPaid: booking.isPaid,
      isCancelled: booking.isCancelled || false, // Ensure boolean
      createdAt: booking.createdAt,
      stripeId: booking.stripeId || '', // Ensure string
      isCreatedByAdmin: booking.isCreatedByAdmin,
      cityTaxTotal: totalCityTax,
      totalPrivacyCost: totalPrivacyCostFromRR, // Using the summed cost from RRs
      services: allServicesList, // Use the collected services list
      rooms: Array.from(roomsMap.values()), // Convert map values to array
      note: booking.note || '' // Ensure string
    };

    return NextResponse.json(formattedBooking);

  } catch (error) {
    console.error('Unexpected error in GET /api/booking-details:', error);
    const message = error instanceof Error ? error.message : 'An internal server error occurred';
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    );
  }
}

// Endpoint to cancel a booking
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('external_id');

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
      .eq('external_id', bookingId);

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