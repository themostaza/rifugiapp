import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Recupera tutte le lingue dal database
    const { data: languages, error } = await supabase
      .from('languages')
      .select('*')
      .order('id');
    
    if (error) {
      console.error('Error fetching languages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch languages' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(languages);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const { code, name } = body;
    
    if (!code || !name) {
      return NextResponse.json(
        { error: 'Language code and name are required' },
        { status: 400 }
      );
    }
    
    // Verifica se la lingua esiste già
    const { data: existingLanguage } = await supabase
      .from('languages')
      .select('*')
      .eq('code', code)
      .single();
      
    if (existingLanguage) {
      return NextResponse.json(
        { error: 'Language with this code already exists' },
        { status: 409 }
      );
    }
    
    // Inserisci la nuova lingua
    const { data, error } = await supabase
      .from('languages')
      .insert([{ code, name }])
      .select();
      
    if (error) {
      console.error('Error adding language:', error);
      return NextResponse.json(
        { error: 'Failed to add language' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data[0]);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Language ID is required' },
        { status: 400 }
      );
    }
    
    const { error } = await supabase
      .from('languages')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting language:', error);
      return NextResponse.json(
        { error: 'Failed to delete language' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 