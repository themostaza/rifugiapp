import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { external_id, name } = body;

    if (!external_id || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Update the name field in the Basket table
    const { data: updatedBasket, error } = await supabase
      .from('Basket')
      .update({ name: name.trim() })
      .eq('external_id', external_id)
      .select('id, name, external_id')
      .single();

    if (error) {
      console.error('Error updating guest name:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!updatedBasket) {
      return NextResponse.json({ error: 'Prenotazione non trovata' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      updatedBasket 
    });
  } catch (error) {
    console.error('Error updating guest name:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 