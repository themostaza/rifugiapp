import { SupabaseClient } from '@supabase/supabase-js';

interface Guest {
  type: 'adult' | 'child' | 'infant';
  roomId: number | null;
  bedId: string | null;
}

interface Bed {
  id: number;
}

interface Room {
  roomId: number;
  availableBeds: Bed[];
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
}

export async function createBooking(
  supabase: SupabaseClient,
  data: BookingData
) {
  // Convert dates to UTC and format them properly
  const checkInDate = new Date(data.checkIn);
  const checkOutDate = new Date(data.checkOut);
  
  console.log(`Creating ${data.isAdmin ? 'admin' : 'regular'} basket with data:`, {
    checkIn: checkInDate.toISOString(),
    checkOut: checkOutDate.toISOString(),
    customerName: data.customerName,
    customerEmail: data.customerEmail,
    totalAmount: data.totalAmount,
    countryName: data.countryName
  });

  // Create basket with proper flags based on isAdmin
  const { data: basket, error: basketError } = await supabase
    .from('Basket')
    .insert({
      dayFrom: checkInDate.toISOString(),
      dayTo: checkOutDate.toISOString(),
      note: data.notes || '',
      name: data.customerName,
      surname: '',
      mail: data.customerEmail,
      phone: data.customerPhone,
      city: data.countryName,
      region: data.selectedRegion || '',
      reservationType: data.pensionType,
      totalPrice: data.totalAmount,
      isPaid: false, // Sempre false inizialmente, anche per prenotazioni admin
      stripeId: '', // Lasciamo vuoto per tutti
      paymentIntentId: '', // Lasciamo vuoto per tutti
      isCancelled: false,
      isCreatedByAdmin: data.isAdmin ? true : false
    })
    .select()
    .single();

  if (basketError) {
    console.error(`Error creating ${data.isAdmin ? 'admin' : 'regular'} basket:`, basketError);
    throw basketError;
  }

  console.log(`${data.isAdmin ? 'Admin' : 'Regular'} basket created successfully:`, basket);

  // Create room reservations
  for (const room of data.rooms) {
    console.log('Processing room:', room);
    const roomGuests = data.assignedGuests.filter((guest: Guest) => guest.roomId === room.roomId);
    console.log('Guests for this room:', roomGuests);
    
    if (roomGuests.length === 0) continue;

    // Create RoomReservation
    const { data: roomReservation, error: roomReservationError } = await supabase
      .from('RoomReservation')
      .insert({
        basketId: basket.id,
        bedBlockPriceTotal: data.roomPrivacyCosts[room.roomId] || 0,
        servicePriceTotal: 0
      })
      .select()
      .single();

    if (roomReservationError) {
      console.error('Error creating room reservation:', roomReservationError);
      throw roomReservationError;
    }
    console.log('Room reservation created:', roomReservation);

    // Create RoomReservationSpec for each guest
    for (const guest of roomGuests) {
      if (!guest.bedId) continue;

      const room = data.rooms.find((r: Room) => r.roomId === guest.roomId);
      if (!room) continue;

      const bed = room.availableBeds.find((b: Bed) => b.id.toString() === guest.bedId);
      if (!bed) continue;

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

      console.log('Creating reservation spec for guest:', {
        guest,
        guestType,
        roomReservationId: roomReservation.id
      });

      const { error: specError } = await supabase
        .from('RoomReservationSpec')
        .insert({
          roomReservationId: roomReservation.id,
          guestDivisionId: guestType.id,
          roomLinkBedId: parseInt(guest.bedId),
          price: 0
        });

      if (specError) {
        console.error('Error creating reservation spec:', specError);
        throw specError;
      }
    }
  }

  return basket;
} 