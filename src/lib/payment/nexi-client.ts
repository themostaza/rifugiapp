/**
 * Nexi XPay Client
 * 
 * Client per interagire con le API Nexi XPay.
 * Usa la Hosted Payment Page (HPP) per il checkout - stesso approccio di Stripe Checkout.
 * 
 * Documentazione: https://developer.nexi.it
 */

import { nexiConfig } from './config';

// ============================================================================
// TYPES
// ============================================================================

export interface NexiOrderRequest {
  order: {
    orderId: string;
    amount: string; // In centesimi come stringa (es: "5000" per €50.00)
    currency: string; // "EUR"
    description?: string;
    customField?: string; // Metadati custom (es: bookingId)
  };
  paymentSession: {
    amount: string;
    actionType: 'PAY'; // Per pagamento diretto
    recurrence?: {
      action: 'NO_RECURRING';
    };
    language: string; // 'ITA', 'ENG', etc.
    resultUrl: string; // URL di ritorno dopo pagamento (success/cancel)
    cancelUrl: string; // URL se l'utente annulla
    notificationUrl: string; // Webhook URL per notifiche server-to-server
    expirationTime?: string; // ISO timestamp scadenza sessione
  };
  card?: {
    billingAddress?: {
      name?: string;
      email?: string;
    };
  };
}

export interface NexiOrderResponse {
  hostedPage: string; // URL della pagina di pagamento hosted
  securityToken: string;
  operation: {
    orderId: string;
    operationId: string;
    operationType: string;
    operationResult: string;
    operationTime: string;
    paymentMethod: string;
    paymentCircuit: string;
    paymentEndToEndId: string;
    cancelledOperationId: string;
    operationAmount: string;
    operationCurrency: string;
  };
  errors?: Array<{
    code: string;
    description: string;
  }>;
}

export interface NexiRefundRequest {
  amount: string; // In centesimi come stringa
  currency: string;
  description?: string;
}

export interface NexiRefundResponse {
  operationId: string;
  operationResult: string;
  operationTime: string;
  paymentMethod: string;
  paymentCircuit: string;
  errors?: Array<{
    code: string;
    description: string;
  }>;
}

export interface NexiWebhookPayload {
  securityToken: string;
  operation: {
    orderId: string;
    operationId: string;
    operationType: string; // 'AUTHORIZATION', 'CAPTURE', 'VOID', 'REFUND'
    operationResult: string; // 'AUTHORIZED', 'EXECUTED', 'DECLINED', 'CANCELLED', etc.
    operationTime: string;
    paymentMethod: string;
    paymentCircuit: string;
    paymentEndToEndId: string;
    cancelledOperationId: string;
    operationAmount: string;
    operationCurrency: string;
    customerInfo?: {
      cardHolderName?: string;
      cardHolderEmail?: string;
    };
  };
  errors?: Array<{
    code: string;
    description: string;
  }>;
}

// ============================================================================
// CLIENT METHODS
// ============================================================================

/**
 * Headers comuni per tutte le chiamate API Nexi
 */
function getHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Api-Key': nexiConfig.apiKey,
  };
}

/**
 * Crea un ordine e ottiene l'URL della Hosted Payment Page
 * Equivalente a stripe.checkout.sessions.create()
 */
export async function createNexiOrder(params: {
  orderId: string; // external_id della prenotazione
  amount: number; // In euro (es: 150.50)
  description: string;
  customerEmail?: string;
  customerName?: string;
  successUrl: string;
  cancelUrl: string;
  webhookUrl: string;
  language?: string;
  expiresInMinutes?: number;
}): Promise<{ hostedPageUrl: string; securityToken: string; operationId: string }> {
  
  const amountInCents = Math.round(params.amount * 100).toString();
  
  // Calcola expiration time (default 30 minuti, come Stripe)
  const expirationTime = new Date(
    Date.now() + (params.expiresInMinutes || 30) * 60 * 1000
  ).toISOString();

  const requestBody: NexiOrderRequest = {
    order: {
      orderId: params.orderId,
      amount: amountInCents,
      currency: 'EUR',
      description: params.description,
      customField: params.orderId, // Usiamo per passare bookingId come metadata
    },
    paymentSession: {
      amount: amountInCents,
      actionType: 'PAY',
      recurrence: {
        action: 'NO_RECURRING',
      },
      language: mapLanguageToNexi(params.language || 'it'),
      resultUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
      notificationUrl: params.webhookUrl,
      expirationTime: expirationTime,
    },
    card: params.customerEmail ? {
      billingAddress: {
        name: params.customerName,
        email: params.customerEmail,
      },
    } : undefined,
  };

  const response = await fetch(`${nexiConfig.baseUrl}/orders/hpp`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Nexi] Error creating order:', errorData);
    throw new Error(`Nexi API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data: NexiOrderResponse = await response.json();

  if (data.errors && data.errors.length > 0) {
    console.error('[Nexi] Order creation errors:', data.errors);
    throw new Error(`Nexi error: ${data.errors.map(e => e.description).join(', ')}`);
  }

  return {
    hostedPageUrl: data.hostedPage,
    securityToken: data.securityToken,
    operationId: data.operation?.operationId || '',
  };
}

/**
 * Esegue un rimborso
 * Equivalente a stripe.refunds.create()
 */
export async function createNexiRefund(params: {
  operationId: string; // ID dell'operazione originale da rimborsare
  amount: number; // In euro
  description?: string;
}): Promise<{ operationId: string; result: string }> {

  const amountInCents = Math.round(params.amount * 100).toString();

  const requestBody: NexiRefundRequest = {
    amount: amountInCents,
    currency: 'EUR',
    description: params.description || 'Refund',
  };

  const response = await fetch(`${nexiConfig.baseUrl}/operations/${params.operationId}/refunds`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Nexi] Error creating refund:', errorData);
    throw new Error(`Nexi refund error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data: NexiRefundResponse = await response.json();

  if (data.errors && data.errors.length > 0) {
    console.error('[Nexi] Refund errors:', data.errors);
    throw new Error(`Nexi refund error: ${data.errors.map(e => e.description).join(', ')}`);
  }

  return {
    operationId: data.operationId,
    result: data.operationResult,
  };
}

/**
 * Recupera i dettagli di un ordine
 */
export async function getNexiOrderDetails(orderId: string): Promise<{
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  operationId?: string;
}> {
  const response = await fetch(`${nexiConfig.baseUrl}/orders/${orderId}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Nexi] Error fetching order:', errorData);
    throw new Error(`Nexi API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    orderId: data.order?.orderId,
    amount: parseInt(data.order?.amount || '0') / 100,
    currency: data.order?.currency,
    status: data.orderStatus?.lastOperationResult || 'unknown',
    operationId: data.orderStatus?.lastOperationId,
  };
}

/**
 * Valida la firma del webhook Nexi
 */
export function validateNexiWebhook(
  payload: NexiWebhookPayload,
  receivedToken: string
): boolean {
  // Nexi usa un securityToken per validare i webhook
  // Il token viene generato durante la creazione dell'ordine e deve matchare
  if (!nexiConfig.webhookSecret) {
    console.warn('[Nexi] Webhook secret not configured, skipping validation');
    return true; // In dev senza secret, accetta tutto
  }
  
  // La validazione dipende dalla configurazione specifica di Nexi
  // In produzione, confronta il securityToken con quello salvato durante la creazione
  return payload.securityToken === receivedToken;
}

/**
 * Mappa il codice lingua al formato Nexi
 */
function mapLanguageToNexi(lang: string): string {
  const langMap: Record<string, string> = {
    'it': 'ITA',
    'en': 'ENG',
    'de': 'DEU',
    'fr': 'FRA',
    'es': 'SPA',
  };
  return langMap[lang.toLowerCase()] || 'ITA';
}

/**
 * Mappa il risultato operazione Nexi a stato semplificato
 */
export function mapNexiResultToStatus(operationResult: string): 'success' | 'failed' | 'pending' | 'cancelled' {
  const successResults = ['AUTHORIZED', 'EXECUTED', 'CAPTURED'];
  const failedResults = ['DECLINED', 'DENIED', 'FAILED', 'ERROR'];
  const cancelledResults = ['CANCELLED', 'VOIDED'];
  
  if (successResults.includes(operationResult.toUpperCase())) return 'success';
  if (failedResults.includes(operationResult.toUpperCase())) return 'failed';
  if (cancelledResults.includes(operationResult.toUpperCase())) return 'cancelled';
  return 'pending';
}




