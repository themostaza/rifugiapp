import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Tipi per le tabelle
interface BasketEntry {
  id: number;
  paymentIntentId: string | null;
}

interface StripeLogMeta {
  refunded?: boolean;
  payment_intent?: string;
  // Altri campi possibili da Stripe.Charge se necessario
}

interface StripeLogEntry {
  id: number;
  stripe_id: string;
  meta: StripeLogMeta | null;
  status: string;
  transaction_type: string;
}

// Funzione per fetchare tutti i record da una tabella Supabase con paginazione
enum Table {
  StripeLog = 'Stripe_log',
  Basket = 'Basket',
}

async function fetchAllRows<T>(table: Table, columns: string): Promise<T[]> {
  const pageSize = 1000;
  let allRows: T[] = [];
  let from = 0;
  let to = pageSize - 1;
  let more = true;

  while (more) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, to);
    if (error) throw error;
    if (data) allRows = allRows.concat(data as T[]);
    if (!data || data.length < pageSize) {
      more = false;
    } else {
      from += pageSize;
      to += pageSize;
    }
  }
  return allRows;
}

// API route: /api/stripe-sync/verify
export async function GET() {
  try {
    // Prendi tutte le transazioni Stripe_log (nessun filtro, con paginazione)
    const stripeLogs = await fetchAllRows<StripeLogEntry>(Table.StripeLog, 'id, stripe_id, meta, status, transaction_type');

    // Prendi tutti i paymentIntentId già presenti in Basket (con paginazione)
    const basketRows = await fetchAllRows<BasketEntry>(Table.Basket, 'id, paymentIntentId');

    // Set di paymentIntentId normalizzati (trim, no lowercase)
    const basketIntentIds = new Set(
      (basketRows || [])
        .map((b) => (b.paymentIntentId || '').trim())
        .filter(Boolean)
    );

    // Riepilogo per status
    const statusCount: Record<string, number> = {};
    // Riepilogo refunded
    let refundedCount = 0;
    // Riepilogo per transaction_type
    const typeCount: Record<string, number> = {};
    // Righe senza payment_intent
    const noPaymentIntent: StripeLogEntry[] = [];
    // Match/missing
    let matchCount = 0;
    let missingCount = 0;
    const matches: StripeLogEntry[] = [];
    const missing: StripeLogEntry[] = [];
    // Log di debug
    const debugLogs: string[] = [];

    // Passa in rassegna tutte le righe
    (stripeLogs || []).forEach((log) => {
      // Status
      statusCount[log.status] = (statusCount[log.status] || 0) + 1;
      // Transaction type
      typeCount[log.transaction_type] = (typeCount[log.transaction_type] || 0) + 1;
      // Refunded
      const refunded = log.meta?.refunded === true;
      if (refunded) refundedCount++;
      // Payment intent
      const paymentIntent = typeof log.meta?.payment_intent === 'string' ? log.meta.payment_intent.trim() : '';
      // Se refunded o status failed, non serve verifica
      if (refunded) {
        debugLogs.push(`[SKIP][REFUNDED] StripeID: ${log.stripe_id} payment_intent: '${paymentIntent}' status: ${log.status}`);
        return;
      }
      if (log.status === 'failed') {
        debugLogs.push(`[SKIP][FAILED] StripeID: ${log.stripe_id} payment_intent: '${paymentIntent}' status: ${log.status}`);
        return;
      }
      // Se manca payment_intent
      if (!paymentIntent) {
        noPaymentIntent.push(log);
        debugLogs.push(`[SKIP][NO_PAYMENT_INTENT] StripeID: ${log.stripe_id} status: ${log.status}`);
        return;
      }
      // Match con Basket
      if (basketIntentIds.has(paymentIntent)) {
        matchCount++;
        matches.push(log);
        // Trova la prenotazione Basket corrispondente
        const basketMatch = (basketRows || []).find(b => (b.paymentIntentId || '').trim() === paymentIntent);
        debugLogs.push(`[MATCH] StripeID: ${log.stripe_id} payment_intent: '${paymentIntent}' status: ${log.status} -> BasketID: ${basketMatch ? basketMatch.id : 'unknown'}`);
      } else {
        missingCount++;
        missing.push(log);
        debugLogs.push(`[MISSING] StripeID: ${log.stripe_id} payment_intent: '${paymentIntent}' status: ${log.status}`);
      }
    });

    // Riepilogo finale
    debugLogs.forEach((log) => console.log(log));
    return NextResponse.json({
      total: stripeLogs?.length || 0,
      statusCount,
      typeCount,
      refundedCount,
      matchCount,
      missingCount,
      noPaymentIntentCount: noPaymentIntent.length,
      matches,
      missing,
      noPaymentIntent,
      debugLogs,
    });
  } catch {
    return NextResponse.json({ error: 'Errore durante la verifica Stripe-Basket' }, { status: 500 });
  }
} 