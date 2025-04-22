import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createBooking } from '@/app/utils/bookingCreation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received admin booking request body:', body);
    
    // Aggiungo il flag isAdmin = true
    const bookingData = {
      ...body,
      isAdmin: true
    };

    // Utilizzo la funzione condivisa per creare la prenotazione
    const basket = await createBooking(supabase, bookingData);

    // Return the booking ID for redirection to the confirmation page
    return NextResponse.json({ 
      success: true, 
      bookingId: basket.external_id
    });

  } catch (error) {
    console.error('Error in create-admin-booking route:', error);
    return NextResponse.json(
      { error: 'Failed to create admin booking' },
      { status: 500 }
    );
  }
} 