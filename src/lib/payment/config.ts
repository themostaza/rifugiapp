/**
 * Payment Provider Configuration
 * 
 * Questo file definisce quale provider di pagamento è attivo.
 * Cambiando PAYMENT_PROVIDER in .env, si può switchare tra Stripe e Nexi
 * SENZA modificare alcun altro codice.
 * 
 * Valori possibili:
 * - 'stripe' (default) - usa l'integrazione Stripe esistente
 * - 'nexi' - usa l'integrazione Nexi XPay
 */

export type PaymentProviderType = 'stripe' | 'nexi';

export const PAYMENT_PROVIDER: PaymentProviderType = 
  (process.env.PAYMENT_PROVIDER as PaymentProviderType) || 'stripe';

export const isStripe = () => PAYMENT_PROVIDER === 'stripe';
export const isNexi = () => PAYMENT_PROVIDER === 'nexi';

/**
 * Configurazione Nexi XPay
 * Variabili ambiente richieste quando PAYMENT_PROVIDER=nexi:
 * - NEXI_API_KEY: Chiave API (X-Api-Key header)
 * - NEXI_TERMINAL_ID: ID terminale esercente (Alias)
 * - NEXI_ENVIRONMENT: 'sandbox' | 'production'
 * - NEXI_WEBHOOK_SECRET: Secret per validare webhook (opzionale ma consigliato)
 */
export const nexiConfig = {
  apiKey: process.env.NEXI_API_KEY || '',
  terminalId: process.env.NEXI_TERMINAL_ID || '', // Alias in Nexi
  environment: (process.env.NEXI_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
  webhookSecret: process.env.NEXI_WEBHOOK_SECRET || '',
  
  // Base URL API - XPay
  get baseUrl() {
    return this.environment === 'production' 
      ? 'https://ecommerce.nexi.it'
      : 'https://int-ecommerce.nexi.it';
  }
};

/**
 * Log della configurazione attiva (solo per debug, non logga secrets)
 */
export const logPaymentConfig = () => {
  console.log(`[Payment Config] Provider attivo: ${PAYMENT_PROVIDER}`);
  if (isNexi()) {
    console.log(`[Payment Config] Nexi environment: ${nexiConfig.environment}`);
    console.log(`[Payment Config] Nexi terminal: ${nexiConfig.terminalId ? '***configured***' : 'NOT SET'}`);
  }
};




