import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export async function GET(request: Request) {
  try {
    // Protezione: verifica che la chiamata provenga da Vercel Cron
    const cronTimezone = request.headers.get('vercel-cron-timezone');
    const userAgent = request.headers.get('user-agent');
    
    // Verifica che provenga da Vercel Cron (solo in produzione)
    if (process.env.NODE_ENV === 'production' && !cronTimezone && !userAgent?.includes('vercel')) {
      return NextResponse.json({ error: 'Unauthorized - Only Vercel Cron allowed' }, { status: 401 });
    }

    // Recupera fino alle ultime 100 charge
    const charges: Stripe.ApiList<Stripe.Charge> = await stripe.charges.list({ limit: 100 });
    const allCharges = charges.data;

    // Se non ci sono charge, termina
    if (allCharges.length === 0) {
      return NextResponse.json({ success: true, inserted: 0, totalFetched: 0, existing: 0 });
    }

    // Batch check: recupera tutti gli stripe_id esistenti in una sola query
    const stripeIds = allCharges.map(charge => charge.id);
    const { data: existingRecords, error: selectError } = await supabase
      .from('Stripe_log')
      .select('stripe_id')
      .eq('transaction_type', 'charge')
      .in('stripe_id', stripeIds);

    if (selectError) {
      console.error('Error checking existing records:', selectError);
      return NextResponse.json({ error: 'Errore durante il controllo dei record esistenti' }, { status: 500 });
    }

    // Crea un Set per lookup veloce degli ID esistenti
    const existingIds = new Set(existingRecords?.map(record => record.stripe_id) || []);

    // Filtra solo le charge nuove
    const newCharges = allCharges.filter(charge => !existingIds.has(charge.id));

    // Se non ci sono nuove charge, termina
    if (newCharges.length === 0) {
      return NextResponse.json({ success: true, inserted: 0, totalFetched: allCharges.length });
    }

    // Prepara i dati per il batch insert
    const recordsToInsert = newCharges.map(charge => ({
      stripe_id: charge.id,
      transaction_type: 'charge',
      status: charge.status,
      date: charge.created ? new Date(charge.created * 1000).toISOString() : null,
      meta: charge,
    }));

    // Batch insert: inserisce tutte le nuove charge in una sola query
    const { error: insertError } = await supabase
      .from('Stripe_log')
      .insert(recordsToInsert);

    if (insertError) {
      console.error('Error inserting records:', insertError);
      return NextResponse.json({ error: 'Errore durante l\'inserimento dei record' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      inserted: newCharges.length, 
      totalFetched: allCharges.length,
      existing: existingIds.size
    });
  } catch (error) {
    console.error('Stripe sync error:', error);
    return NextResponse.json({ error: 'Errore durante la sync Stripe' }, { status: 500 });
  }
} 