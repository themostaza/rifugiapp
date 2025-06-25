import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export async function GET() {
  try {
    // Recupera solo le ultime 100 charge
    const charges: Stripe.ApiList<Stripe.Charge> = await stripe.charges.list({ limit: 100 });
    const allCharges = charges.data;

    if (allCharges.length !== 100) {
      return NextResponse.json({ error: `Attenzione: Stripe ha restituito solo ${allCharges.length} charge invece di 100.` }, { status: 400 });
    }

    let insertCount = 0;
    for (const charge of allCharges) {
      const { data: existing } = await supabase
        .from('Stripe_log')
        .select('id')
        .eq('stripe_id', charge.id)
        .eq('transaction_type', 'charge')
        .maybeSingle();
      if (existing) continue;

      const { error } = await supabase.from('Stripe_log').insert([
        {
          stripe_id: charge.id,
          transaction_type: 'charge',
          status: charge.status,
          date: charge.created ? new Date(charge.created * 1000).toISOString() : null,
          meta: charge,
        },
      ]);
      if (!error) insertCount++;
    }
    return NextResponse.json({ success: true, inserted: insertCount, totalFetched: allCharges.length });
  } catch (error) {
    console.error('Stripe sync error:', error);
    return NextResponse.json({ error: 'Errore durante la sync Stripe' }, { status: 500 });
  }
} 