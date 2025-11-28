/**
 * Payment Session Creation
 * 
 * Funzioni per creare sessioni di pagamento con Stripe o Nexi.
 * Chiamate dalla route /api/create-booking
 */

import Stripe from 'stripe';
import { createNexiOrder } from './nexi-client';
import { PAYMENT_PROVIDER } from './config';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateSessionParams {
  bookingId: string; // external_id della prenotazione
  amount: number; // In euro
  checkIn: string;
  checkOut: string;
  customerEmail: string;
  baseUrl: string;
  locale?: string;
}

export interface CreateSessionResult {
  provider: 'stripe' | 'nexi';
  // Per Stripe: sessionId da usare con redirectToCheckout
  sessionId?: string;
  // Per Nexi: URL diretto alla hosted page
  redirectUrl?: string;
  // ID operazione (per referenza)
  operationId?: string;
}

// ============================================================================
// STRIPE SESSION
// ============================================================================

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia'
});

export async function createStripeSession(params: CreateSessionParams): Promise<CreateSessionResult> {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Check-in: ${new Date(params.checkIn).toLocaleDateString()} Check-out: ${new Date(params.checkOut).toLocaleDateString()}`,
          },
          unit_amount: Math.round(params.amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${params.baseUrl}/cart/${params.bookingId}?payment_status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${params.baseUrl}/?step=checkout`,
    customer_email: params.customerEmail,
    metadata: {
      bookingId: params.bookingId
    },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 min
    locale: 'it'
  });

  return {
    provider: 'stripe',
    sessionId: session.id,
    operationId: session.payment_intent as string || undefined,
  };
}

// ============================================================================
// NEXI SESSION
// ============================================================================

export async function createNexiSession(params: CreateSessionParams): Promise<CreateSessionResult> {
  const description = `Check-in: ${new Date(params.checkIn).toLocaleDateString('it-IT')} Check-out: ${new Date(params.checkOut).toLocaleDateString('it-IT')}`;

  const result = await createNexiOrder({
    orderId: params.bookingId,
    amount: params.amount,
    description: description,
    customerEmail: params.customerEmail,
    successUrl: `${params.baseUrl}/cart/${params.bookingId}?payment_status=success`,
    cancelUrl: `${params.baseUrl}/?step=checkout`,
    webhookUrl: `${params.baseUrl}/api/webhooks/nexi`,
    language: params.locale || 'it',
    expiresInMinutes: 30,
  });

  return {
    provider: 'nexi',
    redirectUrl: result.hostedPageUrl,
    operationId: result.operationId,
  };
}

// ============================================================================
// MAIN FACTORY FUNCTION
// ============================================================================

/**
 * Crea una sessione di pagamento con il provider configurato
 */
export async function createPaymentSession(params: CreateSessionParams): Promise<CreateSessionResult> {
  console.log(`[Payment] Creating session with provider: ${PAYMENT_PROVIDER}`);
  
  if (PAYMENT_PROVIDER === 'nexi') {
    return createNexiSession(params);
  }
  
  // Default: Stripe
  return createStripeSession(params);
}




