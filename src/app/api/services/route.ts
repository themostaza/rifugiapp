import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';



export async function GET() {
  try {
    console.log('🔍 Fetching services...');
    
    const { data, error } = await supabase
      .from('Service')
      .select('*')
      .order('id');

    if (error) {
      console.error('❌ Error fetching services:', error);
      return NextResponse.json(
        { error: 'Error fetching services', details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ Successfully fetched ${data.length} services`);
    return NextResponse.json(data, { status: 200 });
    
  } catch (error) {
    console.error('💥 Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}