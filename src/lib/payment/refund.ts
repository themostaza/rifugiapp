/**
 * Payment Refund Functions
 * 
 * Funzioni per processare rimborsi con Stripe o Nexi.
 * Usate da /api/cancel-booking e /api/remove-beds
 */

import Stripe from 'stripe';
import { createNexiRefund } from './nexi-client';

// ============================================================================
// TYPES
// ============================================================================

export interface RefundParams {
  amount: number; // In euro
  reason?: string;
  // Stripe fields
  paymentIntentId?: string | null;
  // Nexi fields  
  nexiOrderId?: string | null;  // Il codTrans usato nel pagamento originale
}

export interface RefundResult {
  success: boolean;
  provider: 'stripe' | 'nexi' | 'none';
  refundId?: string;
  error?: string;
}

// ============================================================================
// STRIPE REFUND
// ============================================================================

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia'
});

async function processStripeRefund(params: RefundParams): Promise<RefundResult> {
  if (!params.paymentIntentId) {
    return { success: false, provider: 'stripe', error: 'Missing paymentIntentId' };
  }

  try {
    const refund = await stripe.refunds.create({
      payment_intent: params.paymentIntentId,
      amount: Math.round(params.amount * 100), // Stripe vuole centesimi
      reason: 'requested_by_customer' as const
    });

    return {
      success: true,
      provider: 'stripe',
      refundId: refund.id,
    };
  } catch (error) {
    console.error('[Refund] Stripe refund error:', error);
    return {
      success: false,
      provider: 'stripe',
      error: error instanceof Error ? error.message : 'Unknown Stripe error',
    };
  }
}

// ============================================================================
// NEXI REFUND
// ============================================================================

async function processNexiRefund(params: RefundParams): Promise<RefundResult> {
  if (!params.nexiOrderId) {
    return { success: false, provider: 'nexi', error: 'Missing nexiOrderId (codiceTransazione)' };
  }

  try {
    const result = await createNexiRefund({
      codiceTransazione: params.nexiOrderId,  // Il codTrans usato nel pagamento
      amount: params.amount,
      description: params.reason || 'Refund requested by customer',
    });

    return {
      success: true,
      provider: 'nexi',
      refundId: result.idOperazione,
    };
  } catch (error) {
    console.error('[Refund] Nexi refund error:', error);
    return {
      success: false,
      provider: 'nexi',
      error: error instanceof Error ? error.message : 'Unknown Nexi error',
    };
  }
}

// ============================================================================
// MAIN REFUND FUNCTION
// ============================================================================

/**
 * Processa un rimborso usando il provider appropriato.
 * Determina automaticamente quale provider usare basandosi sui campi presenti.
 * 
 * Priorità:
 * 1. Se nexiOrderId è presente → usa Nexi
 * 2. Se paymentIntentId è presente → usa Stripe
 * 3. Altrimenti → nessun rimborso possibile
 */
export async function processRefund(params: RefundParams): Promise<RefundResult> {
  console.log('[Refund] Processing refund:', {
    amount: params.amount,
    hasPaymentIntentId: !!params.paymentIntentId,
    hasNexiOrderId: !!params.nexiOrderId,
  });

  // Determina il provider basandosi sui campi presenti
  // Nexi ha priorità se entrambi sono presenti (caso improbabile ma gestiamolo)
  if (params.nexiOrderId) {
    console.log('[Refund] Using Nexi provider');
    return processNexiRefund(params);
  }

  if (params.paymentIntentId) {
    console.log('[Refund] Using Stripe provider');
    return processStripeRefund(params);
  }

  console.log('[Refund] No payment provider info found, cannot process refund');
  return {
    success: false,
    provider: 'none',
    error: 'No payment information available for refund',
  };
}




