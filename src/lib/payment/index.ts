/**
 * Payment Module
 * 
 * Esporta tutte le funzionalità di pagamento.
 * Supporta Stripe e Nexi con switch via variabile PAYMENT_PROVIDER.
 */

// Configurazione
export { 
  PAYMENT_PROVIDER, 
  isStripe, 
  isNexi, 
  nexiConfig,
  logPaymentConfig,
  type PaymentProviderType 
} from './config';

// Client Nexi
export { 
  createNexiOrder,
  createNexiPaymentForm,
  createNexiRefund, 
  verifyNexiWebhook,
  mapNexiResultToStatus,
  type NexiPaymentParams,
  type NexiPaymentResult,
  type NexiWebhookPayload,
  type NexiRefundRequest
} from './nexi-client';

// Session creation (abstraction layer)
export {
  createPaymentSession,
  createStripeSession,
  createNexiSession,
  type CreateSessionParams,
  type CreateSessionResult
} from './create-session';

// Refund processing
export {
  processRefund,
  type RefundParams,
  type RefundResult
} from './refund';




