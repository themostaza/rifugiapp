import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// --- Manual Type Definitions --- 
// Based on the Supabase query and expected structure

interface Room {
  id: number;
  description: string | null;
  RoomLinkBed: { count: number }[] | null;
}

interface RoomLinkBed {
  id: number;
  name: string | null;
  Room: Room | null;
  RoomReservationSpec: (RoomReservationSpec & {
    GuestDivision: GuestDivision | null;
    RoomLinkBed: (RoomLinkBed & {
      Room: (Room & {
        RoomLinkBed?: { count: number }[] | null;
      }) | null;
    }) | null;
  })[] | null;
}

interface GuestDivision {
  id: number;
  title: string | null;
  description: string | null;
}

interface RoomReservationSpec {
  id: number;
  GuestDivision: GuestDivision | null;
  RoomLinkBed: RoomLinkBed | null;
}

interface RoomReservation {
  id: number;
  RoomReservationSpec: RoomReservationSpec[] | null;
}

// Interface for the main Basket object including nested structures from the query
interface BasketWithDetails {
  id: number;
  name: string | null;
  surname: string | null;
  dayFrom: string; 
  dayTo: string;   
  mail: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  reservationType: string | null;
  totalPrice: number | null;
  isPaid: boolean | null;
  note: string | null;
  isCreatedByAdmin: boolean | null;
  stripeId: string | null;
  paymentIntentId: string | null;
  // Campi Nexi
  nexiOrderId: string | null;
  nexiOperationId: string | null;
  nexiPaymentCircuit: string | null;
  external_id: string | null;
  RoomReservation: RoomReservation[] | null; 
}

// --- End Manual Type Definitions ---

// Mark the route handler as dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateString = searchParams.get('date');

  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return NextResponse.json({ error: 'Valid date parameter (YYYY-MM-DD) is required' }, { status: 400 });
  }

  // Initialize Supabase client (type is inferred, but can be SupabaseClient if needed)
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // Query with explicit type assertion using the manually defined interface
    const { data: baskets, error } = await supabase
      .from('Basket')
      .select(`
        id, name, surname, dayFrom, dayTo, mail, phone, city, region, reservationType, totalPrice, isPaid, note, isCreatedByAdmin, stripeId, paymentIntentId, nexiOrderId, nexiOperationId, nexiPaymentCircuit, external_id,
        RoomReservation (
          id,
          RoomReservationSpec (
            id,
            GuestDivision ( id, title, description ),
            RoomLinkBed (
              id, name,
              Room ( id, description, RoomLinkBed(count) )
            )
          )
        )
      `)
      .lte('dayFrom', dateString)
      .gt('dayTo', dateString)
      .or('and(isPaid.eq.true,isCancelled.eq.false),and(isCreatedByAdmin.eq.true,isCancelled.eq.false)')
      .returns<BasketWithDetails[]>(); 

    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json({ error: `Supabase query failed: ${error.message}` }, { status: 500 });
    }

    if (!baskets) {
      return NextResponse.json({ detailedReservations: [] });
    }

    // Process data with explicit types from manual interfaces
    const detailedReservations = baskets.map((basket: BasketWithDetails) => {
      let adults = 0;
      let children = 0;
      let infants = 0;

      // Iterate with explicit types using the defined interfaces
      basket.RoomReservation?.forEach((rr: RoomReservation) => { 
        rr.RoomReservationSpec?.forEach((spec: RoomReservationSpec) => { 
          const divisionTitle = spec.GuestDivision?.title?.toLowerCase() || '';

          // Keyword matching (ensure these match your actual GuestDivision titles)
          if (divisionTitle.includes('adult')) {
              adults++;
          } else if (divisionTitle.includes('bambin')) {
              children++;
          } else if (divisionTitle.includes('neonat')) {
              infants++;
          } else {
              console.warn(`Unmatched GuestDivision title: "${spec.GuestDivision?.title}" for Spec ID: ${spec.id}`);
          }
        });
      });

      // Return the processed object
      // The structure matches BasketWithDetails plus the guestBreakdown
      return {
        id: basket.id,
        dayFrom: basket.dayFrom,
        dayTo: basket.dayTo,
        name: basket.name,
        surname: basket.surname,
        mail: basket.mail,
        phone: basket.phone,
        city: basket.city,
        region: basket.region,
        reservationType: basket.reservationType,
        totalPrice: basket.totalPrice,
        isPaid: basket.isPaid,
        note: basket.note,
        isCreatedByAdmin: basket.isCreatedByAdmin,
        stripeId: basket.stripeId,
        paymentIntentId: basket.paymentIntentId,
        nexiOrderId: basket.nexiOrderId,
        nexiOperationId: basket.nexiOperationId,
        nexiPaymentCircuit: basket.nexiPaymentCircuit,
        external_id: basket.external_id,
        RoomReservation: basket.RoomReservation,
        guestBreakdown: { adults, children, infants }
      };
    });

    // --- Calculate Blocked Beds (Revised Logic) ---
    let blockedBedsByRoom: { [roomId: number]: number } = {};
    let totalBlockedBeds = 0; // Initialize total blocked beds
    let allBlockedLinkIds: number[] = []; // Initialize outside the if block
    let blockedBedDetails: { bedId: number; roomReservationId: number }[] = []; // Store details

    // 1. Extract valid RoomReservation IDs from the fetched baskets
    const validRoomReservationIds = baskets.flatMap(basket => 
        basket.RoomReservation?.map(rr => rr.id) || []
    ).filter((id): id is number => typeof id === 'number'); // Ensure IDs are numbers

    // Only proceed if there are valid RoomReservation IDs to check
    if (validRoomReservationIds.length > 0) {
        // 2. Query ReservationLinkBedBlock for the given day AND valid RoomReservation IDs
        // Select roomReservationId as well
        const { data: bedBlocks, error: blockError } = await supabase
          .from('ReservationLinkBedBlock')
          .select('roomLinkBedId, roomReservationId') // <-- Select roomReservationId
          .eq('day', dateString) // Filter by day
          .in('roomReservationId', validRoomReservationIds); // Filter by valid RoomReservation IDs

        if (blockError) {
          console.error("Supabase query error (ReservationLinkBedBlock):", blockError);
          // Log and continue, totals remain 0
        } else if (bedBlocks && bedBlocks.length > 0) {
          
          // Temporary arrays to rebuild flattened lists
          const tempBlockedLinkIds: number[] = [];
          const tempBlockedDetails: { bedId: number; roomReservationId: number }[] = [];

          // 3. Process blocks to flatten IDs and create detailed mapping
          bedBlocks.forEach(block => {
              if (block.roomLinkBedId && block.roomReservationId) {
                  block.roomLinkBedId.forEach((id: unknown) => {
                      if (typeof id === 'number' && !isNaN(id)) {
                          tempBlockedLinkIds.push(id);
                          tempBlockedDetails.push({ bedId: id, roomReservationId: block.roomReservationId });
                      }
                  });
              }
          });
          
          allBlockedLinkIds = tempBlockedLinkIds;
          blockedBedDetails = tempBlockedDetails; // Assign the detailed mapping

          if (allBlockedLinkIds.length > 0) {
            // 4. Query RoomLinkBed to get the roomId for each blocked bed link ID
            const { data: roomLinks, error: linkError } = await supabase
              .from('RoomLinkBed')
              .select('id, roomId')
              .in('id', allBlockedLinkIds);

            if (linkError) {
              console.error("Supabase query error (RoomLinkBed):", linkError);
              // Log and continue
            } else if (roomLinks) {
              // 5. Aggregate counts by roomId and calculate total blocked
              blockedBedsByRoom = roomLinks.reduce((acc, link) => {
                if (link.roomId) {
                  acc[link.roomId] = (acc[link.roomId] || 0) + 1;
                }
                return acc;
              }, {} as { [roomId: number]: number });
              totalBlockedBeds = roomLinks.length; // Total count of valid blocked links found
            }
          }
        }
    }
    // --- End Calculate Blocked Beds ---

    // --- Get All Bed Details ---
    let roomBedDetails: { id: number, name: string, roomId: number }[] = [];
    const { data: allBeds, error: bedsError } = await supabase
        .from('RoomLinkBed')
        .select('id, name, roomId');

    if (bedsError) {
        console.error("Supabase query error (Fetching All Beds):", bedsError);
        // Continue without all bed details, the dialog might be less informative
    } else if (allBeds) {
        roomBedDetails = allBeds;
    }
    // --- End Get All Bed Details ---

    // --- Calculate Available Beds ---
    let totalCapacity = 0;
    let totalBookedBeds = 0;
    let availableBeds = 0;

    // 1. Get Total Capacity 
    // Query Room and sum RoomLinkBed counts. Adjust relation name if needed.
    const { data: roomsData, error: roomsError } = await supabase
      .from('Room')
      .select('id, RoomLinkBed(count)'); // Assuming RoomLinkBed relation gives bed count

    if (roomsError) {
        console.error("Supabase query error (Rooms Capacity):", roomsError);
        // Handle error - perhaps return an error response or default availability
    } else if (roomsData) {
        totalCapacity = roomsData.reduce((sum, room) => {
            // Ensure RoomLinkBed exists and is an array before accessing count
            const count = Array.isArray(room.RoomLinkBed) && room.RoomLinkBed[0]?.count ? room.RoomLinkBed[0].count : 0;
            return sum + count;
        }, 0);
    }

    // 2. Calculate Total Booked Beds
    totalBookedBeds = detailedReservations.reduce((sum, res) => {
      return sum + res.guestBreakdown.adults + res.guestBreakdown.children + res.guestBreakdown.infants;
    }, 0);

    // 3. Calculate Available Beds
    // Ensure capacity is calculated before subtracting
    if (totalCapacity > 0) {
      availableBeds = totalCapacity - totalBookedBeds - totalBlockedBeds;
    } else {
      // If capacity couldn't be determined, availability is unknown or 0
      availableBeds = 0; 
      console.warn("Total capacity could not be determined. Available beds set to 0.");
    }
    // Ensure available beds is not negative
    availableBeds = Math.max(0, availableBeds); 

    // --- End Calculate Available Beds ---

    return NextResponse.json({ 
        detailedReservations, 
        blockedBedsByRoom, 
        availableBeds, 
        totalBlockedBeds, 
        blockedBedDetails, // <-- Add the detailed blocked bed info
        roomBedDetails      
    });

  } catch (error: unknown) {
    console.error("Error fetching or processing day details:", error);
    return NextResponse.json({ error: 'An unexpected error occurred while fetching reservation details.' }, { status: 500 });
  }
} 