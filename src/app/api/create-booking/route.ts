import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia'
});

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received booking request body:', body);
    
    const {
      checkIn,
      checkOut,
      pensionType,
      rooms,
      assignedGuests,
      roomPrivacyCosts,
      guestTypes,
      customerName,
      customerPhone,
      customerEmail,
      selectedRegion,
      notes,
      totalAmount,
      countryName
    } = body;

    // Convert dates to UTC and format them properly
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    console.log('Creating basket with data:', {
      checkIn: checkInDate.toISOString(),
      checkOut: checkOutDate.toISOString(),
      customerName,
      customerEmail,
      totalAmount,
      countryName
    });

    // Start a Supabase transaction
    const { data: basket, error: basketError } = await supabase
      .from('Basket')
      .insert({
        dayFrom: checkInDate.toISOString(),
        dayTo: checkOutDate.toISOString(),
        note: notes || '',
        name: customerName,
        surname: '',
        mail: customerEmail,
        phone: customerPhone,
        city: countryName,
        region: selectedRegion || '',
        reservationType: pensionType,
        totalPrice: totalAmount,
        isPaid: false,
        stripeId: '',
        paymentIntentId: '',
        isCancelled: false,
        isCreatedByAdmin: false
      })
      .select()
      .single();

    if (basketError) {
      console.error('Error creating basket:', basketError);
      throw basketError;
    }
    console.log('Basket created successfully:', basket);

    // Create room reservations
    for (const room of rooms) {
      console.log('Processing room:', room);
      const roomGuests = assignedGuests.filter((guest: Guest) => guest.roomId === room.roomId);
      console.log('Guests for this room:', roomGuests);
      
      if (roomGuests.length === 0) continue;

      // Create RoomReservation
      const { data: roomReservation, error: roomReservationError } = await supabase
        .from('RoomReservation')
        .insert({
          basketId: basket.id,
          bedBlockPriceTotal: roomPrivacyCosts[room.roomId] || 0,
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
      for (const guest of roomGuests as Guest[]) {
        if (!guest.bedId) continue;

        const room = rooms.find((r: Room) => r.roomId === guest.roomId);
        if (!room) continue;

        const bed = room.availableBeds.find((b: Bed) => b.id.toString() === guest.bedId);
        if (!bed) continue;

        const guestType = guestTypes.find((type: GuestType) => {
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

    console.log('Creating Stripe checkout session for basket:', basket.id);
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Check-in: ${new Date(checkIn).toLocaleDateString()} Check-out: ${new Date(checkOut).toLocaleDateString()}`,
            },
            unit_amount: Math.round(totalAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cart/${basket.id.toString()}?payment_status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?step=checkout`,
      metadata: {
        bookingId: basket.id.toString()
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_creation: 'always',
      expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
      locale: 'it'
    });
    console.log('Stripe session created:', session.id);

    // Update basket with Stripe session ID
    const { error: updateError } = await supabase
      .from('Basket')
      .update({
        stripeId: session.id,
        paymentIntentId: session.payment_intent as string
      })
      .eq('id', basket.id);

    if (updateError) {
      console.error('Error updating basket with Stripe info:', updateError);
      throw updateError;
    }
    console.log('Basket updated with Stripe information');

    return NextResponse.json({ 
      success: true, 
      sessionId: session.id,
      basketId: basket.id
    });

  } catch (error) {
    console.error('Error in create-booking route:', error);
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }
} 