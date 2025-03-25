import { differenceInDays } from 'date-fns';

// Types
export interface Guest {
  type: 'adult' | 'child' | 'infant';
  roomId: number | null;
  bedId: string | null;
}

export interface GuestType {
  id: number;
  description: string;
  ageFrom: number;
  ageTo: number;
  salePercent: number;
  title: string;
  cityTax: boolean;
  cityTaxPrice: number;
  langTrasn?: string;
}

export interface Bed {
  id: number;
  name: string;
  pricing?: {
    bb: number;
    mp: number;
  };
}

export interface Room {
  roomId: number;
  description: string;
  images: string[];
  allBeds: Bed[];
  availableBeds: Bed[];
}

export interface RoomCartItem {
  name: string;
  guests: string;
  beds: Array<{
    description: string;
    price: number;
    guestType?: 'adult' | 'child' | 'infant';
    originalPrice?: number;
  }>;
  privacy: number;
}

/**
 * Calculate the price for a single bed based on guest type and pension type
 */
export const calculateBedPrice = (
  bed: Bed,
  guestType: 'adult' | 'child' | 'infant',
  pensionType: 'bb' | 'hb',
  guestTypes: GuestType[],
  numNights: number
): { basePrice: number; discountedPrice: number; discount: number; totalPrice: number; cityTax: number } => {
  if (!bed.pricing) {
    return { basePrice: 0, discountedPrice: 0, discount: 0, totalPrice: 0, cityTax: 0 };
  }

  // Get base price based on pension type
  const basePrice = pensionType === 'bb' ? bed.pricing.bb : bed.pricing.mp;

  // Find guest type info to apply discount
  const guestTypeInfo = guestTypes.find(type => {
    if (guestType === 'adult') return type.title === 'Adulti';
    if (guestType === 'child') return type.title === 'Bambini';
    if (guestType === 'infant') return type.title === 'Neonati';
    return false;
  });

  // Apply discount if applicable
  const discount = guestTypeInfo ? guestTypeInfo.salePercent / 100 : 0;
  const discountedPrice = basePrice * (1 - discount);

  // Calculate city tax if applicable
  const cityTax = guestTypeInfo && guestTypeInfo.cityTax ? guestTypeInfo.cityTaxPrice * numNights : 0;

  // Calculate total price for all nights
  const totalPrice = discountedPrice * numNights;

  return { basePrice, discountedPrice, discount, totalPrice, cityTax };
};

/**
 * Calculate the total price for all beds in a room
 */
export const calculateRoomBedsPrice = (
  room: Room,
  assignedGuests: Guest[],
  pensionType: 'bb' | 'hb',
  guestTypes: GuestType[],
  checkIn?: Date,
  checkOut?: Date
): { totalPrice: number; cityTaxTotal: number } => {
  const numNights = checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0;
  const roomGuests = assignedGuests.filter(guest => guest.roomId === room.roomId);
  
  let totalPrice = 0;
  let cityTaxTotal = 0;
  
  roomGuests.forEach(guest => {
    if (guest.bedId) {
      // Find the corresponding bed
      const bed = room.availableBeds.find(bed => bed.id.toString() === guest.bedId);
      if (bed) {
        const { totalPrice: bedTotal, cityTax } = calculateBedPrice(
          bed,
          guest.type,
          pensionType,
          guestTypes,
          numNights
        );
        
        totalPrice += bedTotal;
        cityTaxTotal += cityTax;
      }
    }
  });
  
  return { totalPrice, cityTaxTotal };
};

/**
 * Calculate the total price for a room including beds and privacy costs
 */
export const calculateRoomTotalPrice = (
  room: Room,
  assignedGuests: Guest[],
  pensionType: 'bb' | 'hb',
  guestTypes: GuestType[],
  privacyCost: number,
  checkIn?: Date,
  checkOut?: Date
): { bedsPrice: number; privacyCost: number; totalPrice: number; cityTaxTotal: number } => {
  const { totalPrice: bedsPrice, cityTaxTotal } = calculateRoomBedsPrice(
    room,
    assignedGuests,
    pensionType,
    guestTypes,
    checkIn,
    checkOut
  );
  
  const totalPrice = bedsPrice + privacyCost;
  
  return { bedsPrice, privacyCost, totalPrice, cityTaxTotal };
};

/**
 * Calculate the total price for the cart
 */
export const calculateCartTotal = (
  rooms: Room[],
  assignedGuests: Guest[],
  pensionType: 'bb' | 'hb',
  guestTypes: GuestType[],
  additionalServices: number,
  roomPrivacyCosts: { [roomId: number]: number },
  checkIn?: Date,
  checkOut?: Date
): { 
  subtotal: number; 
  cityTaxTotal: number; 
  additionalServices: number; 
  total: number;
  roomTotals: { [roomId: number]: { bedsPrice: number; privacyCost: number; totalPrice: number; cityTaxTotal: number } }
} => {
  let subtotal = 0;
  let cityTaxTotal = 0;
  const roomTotals: { [roomId: number]: { bedsPrice: number; privacyCost: number; totalPrice: number; cityTaxTotal: number } } = {};
  
  // Calculate totals for each room
  rooms.forEach(room => {
    const privacyCost = roomPrivacyCosts[room.roomId] || 0;
    const roomTotal = calculateRoomTotalPrice(
      room,
      assignedGuests,
      pensionType,
      guestTypes,
      privacyCost,
      checkIn,
      checkOut
    );
    
    subtotal += roomTotal.totalPrice;
    cityTaxTotal += roomTotal.cityTaxTotal;
    roomTotals[room.roomId] = roomTotal;
  });
  
  // Calculate final total
  const total = subtotal + additionalServices + cityTaxTotal;
  
  return { subtotal, cityTaxTotal, additionalServices, total, roomTotals };
};

/**
 * Format a room for the cart display
 */
export const formatRoomForCart = (
  room: Room,
  assignedGuests: Guest[],
  pensionType: 'bb' | 'hb',
  guestTypes: GuestType[],
  privacyCost: number,
  checkIn?: Date,
  checkOut?: Date
): RoomCartItem => {
  const numNights = checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0;
  const roomGuests = assignedGuests.filter(guest => guest.roomId === room.roomId);
  
  const beds = roomGuests
    .filter(guest => guest.bedId)
    .map(guest => {
      const bed = room.availableBeds.find(b => b.id.toString() === guest.bedId);
      if (!bed || !bed.pricing) return null;
      
      // Find guest type for discount
      const guestTypeInfo = guestTypes.find(type => {
        if (guest.type === 'adult') return type.title === 'Adulti';
        if (guest.type === 'child') return type.title === 'Bambini';
        if (guest.type === 'infant') return type.title === 'Neonati';
        return false;
      });
      
      // Calculate prices
      const basePrice = pensionType === 'bb' ? bed.pricing.bb : bed.pricing.mp;
      const discount = guestTypeInfo ? guestTypeInfo.salePercent / 100 : 0;
      const discountedPrice = basePrice * (1 - discount) * numNights;
      
      return {
        description: `${bed.name} (${guest.type})`,
        price: discountedPrice,
        guestType: guest.type,
        originalPrice: discount > 0 ? basePrice * numNights : undefined
      };
    })
    .filter(Boolean) as RoomCartItem['beds'];
  
  return {
    name: room.description,
    guests: `${roomGuests.length} Ospiti`,
    beds,
    privacy: privacyCost
  };
};