/**
 * Nexi XPay Client
 * 
 * Client per interagire con Nexi XPay.
 * XPay usa un FORM SUBMISSION per redirect alla pagina di pagamento,
 * NON una chiamata API REST come Stripe.
 * 
 * Documentazione: https://developer.nexi.it
 */

import { createHash } from 'crypto';
import { nexiConfig } from './config';

// ============================================================================
// TYPES
// ============================================================================

export interface NexiPaymentParams {
  codTrans: string;      // Codice transazione univoco (es: external_id)
  importo: number;       // Importo in EURO (es: 153.00)
  descrizione?: string;  // Descrizione ordine
  mail?: string;         // Email cliente
  nome?: string;         // Nome cliente
  cognome?: string;      // Cognome cliente
  urlSuccess: string;    // URL ritorno success/failure
  urlBack: string;       // URL annullamento
  urlPost?: string;      // Webhook server-to-server (opzionale)
  languageId?: string;   // Lingua (ITA, ENG, etc.)
}

export interface NexiPaymentResult {
  formAction: string;    // URL del form (endpoint Nexi)
  formFields: Record<string, string>;  // Campi del form da inviare
}

export interface NexiWebhookPayload {
  esito: 'OK' | 'KO' | 'ANNULLO' | 'ERRORE' | 'PEN';
  codiceEsito?: string;
  messaggio?: string;
  codAut?: string;
  alias: string;
  importo: string;
  divisa: string;
  codTrans: string;
  data?: string;
  orario?: string;
  mac: string;
  pan?: string;
  scadenza_pan?: string;
  brand?: string;
  nazionalita?: string;
  mail?: string;
  nome?: string;
  cognome?: string;
}

export interface NexiRefundRequest {
  codTrans: string;      // Codice transazione originale
  importo: number;       // Importo da rimborsare in EURO
  divisa?: string;       // Divisa (default EUR)
}

// ============================================================================
// MAC CALCULATION
// ============================================================================

/**
 * Calcola il MAC per l'avvio pagamento
 * Formula: SHA1(codTrans=<val>divisa=<val>importo=<val><chiaveSegreta>)
 */
function calculatePaymentMAC(codTrans: string, divisa: string, importo: string): string {
  const stringToSign = `codTrans=${codTrans}divisa=${divisa}importo=${importo}${nexiConfig.apiKey}`;
  console.log('[Nexi] MAC string to sign:', stringToSign.replace(nexiConfig.apiKey, '***SECRET***'));
  
  const mac = createHash('sha1').update(stringToSign, 'utf8').digest('hex');
  console.log('[Nexi] Calculated MAC:', mac);
  return mac;
}

/**
 * Calcola il MAC per verificare l'esito
 * Formula: SHA1(codTrans=<val>esito=<val>importo=<val>divisa=<val>data=<val>orario=<val>codAut=<val><chiaveSegreta>)
 */
function calculateResponseMAC(
  codTrans: string, 
  esito: string, 
  importo: string, 
  divisa: string, 
  data: string, 
  orario: string, 
  codAut: string
): string {
  const stringToSign = `codTrans=${codTrans}esito=${esito}importo=${importo}divisa=${divisa}data=${data}orario=${orario}codAut=${codAut}${nexiConfig.apiKey}`;
  return createHash('sha1').update(stringToSign, 'utf8').digest('hex');
}

// ============================================================================
// PAYMENT FUNCTIONS
// ============================================================================

/**
 * Genera i dati per il form di pagamento Nexi
 * Il frontend dovrà creare un form e fare submit, oppure redirect con POST
 */
export function createNexiPaymentForm(params: NexiPaymentParams): NexiPaymentResult {
  // Converti importo in centesimi (stringa senza separatori)
  const importoInCentesimi = Math.round(params.importo * 100).toString();
  const divisa = 'EUR';
  
  // Calcola MAC
  const mac = calculatePaymentMAC(params.codTrans, divisa, importoInCentesimi);
  
  // URL endpoint
  const formAction = `${nexiConfig.baseUrl}/ecomm/ecomm/DispatcherServlet`;
  
  // Campi del form
  const formFields: Record<string, string> = {
    alias: nexiConfig.terminalId,
    importo: importoInCentesimi,
    divisa: divisa,
    codTrans: params.codTrans,
    url: params.urlSuccess,
    url_back: params.urlBack,
    mac: mac,
  };
  
  // Campi opzionali
  if (params.urlPost) {
    formFields.urlpost = params.urlPost;
  }
  if (params.mail) {
    formFields.mail = params.mail;
  }
  if (params.nome) {
    formFields.nome = params.nome;
  }
  if (params.cognome) {
    formFields.cognome = params.cognome;
  }
  if (params.descrizione) {
    formFields.descrizione = params.descrizione;
  }
  if (params.languageId) {
    formFields.languageId = params.languageId;
  }
  
  console.log('[Nexi] Payment form created:', {
    formAction,
    alias: formFields.alias,
    importo: formFields.importo,
    codTrans: formFields.codTrans,
    url: formFields.url,
    url_back: formFields.url_back,
  });
  
  return {
    formAction,
    formFields,
  };
}

/**
 * Funzione legacy per compatibilità - ora genera i dati del form
 */
export async function createNexiOrder(params: {
  orderId: string;
  amount: number;
  description: string;
  customerEmail?: string;
  customerName?: string;
  successUrl: string;
  cancelUrl: string;
  webhookUrl: string;
  language?: string;
  expiresInMinutes?: number;
}): Promise<{ formAction: string; formFields: Record<string, string> }> {
  
  // Estrai nome e cognome se possibile
  const nameParts = params.customerName?.split(' ') || [];
  const nome = nameParts[0] || '';
  const cognome = nameParts.slice(1).join(' ') || '';
  
  const result = createNexiPaymentForm({
    codTrans: params.orderId,
    importo: params.amount,
    descrizione: params.description,
    mail: params.customerEmail,
    nome: nome,
    cognome: cognome,
    urlSuccess: params.successUrl,
    urlBack: params.cancelUrl,
    urlPost: params.webhookUrl,
    languageId: mapLanguageToNexi(params.language || 'it'),
  });
  
  return result;
}

/**
 * Verifica il MAC della risposta/webhook Nexi
 */
export function verifyNexiWebhook(payload: NexiWebhookPayload): boolean {
  if (!payload.mac) {
    console.warn('[Nexi] No MAC in webhook payload');
    return false;
  }
  
  const expectedMAC = calculateResponseMAC(
    payload.codTrans,
    payload.esito,
    payload.importo,
    payload.divisa,
    payload.data || '',
    payload.orario || '',
    payload.codAut || ''
  );
  
  const isValid = payload.mac.toLowerCase() === expectedMAC.toLowerCase();
  
  if (!isValid) {
    console.error('[Nexi] MAC verification failed:', {
      received: payload.mac,
      expected: expectedMAC,
    });
  }
  
  return isValid;
}

/**
 * Esegue un rimborso tramite API Nexi
 * Nota: i rimborsi in XPay si fanno tramite API separata o back office
 */
export async function createNexiRefund(params: {
  operationId: string;
  amount: number;
  description?: string;
}): Promise<{ operationId: string; result: string }> {
  // Per XPay classico, i rimborsi si gestiscono tramite:
  // 1. Back office manuale
  // 2. API di contabilizzazione/storno
  
  // Endpoint per storno: /ecomm/api/bo/storna
  const importoInCentesimi = Math.round(params.amount * 100).toString();
  
  const requestBody = {
    apiKey: nexiConfig.apiKey,
    codTrans: params.operationId,
    importo: importoInCentesimi,
    divisa: 'EUR',
  };
  
  console.log('[Nexi] Refund request:', {
    codTrans: params.operationId,
    importo: importoInCentesimi,
  });
  
  const response = await fetch(`${nexiConfig.baseUrl}/ecomm/api/bo/storna`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Nexi] Refund error:', errorText);
    throw new Error(`Nexi refund error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  if (data.esito !== 'OK') {
    throw new Error(`Nexi refund failed: ${data.messaggio || data.esito}`);
  }
  
  return {
    operationId: params.operationId,
    result: data.esito,
  };
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
 * Mappa l'esito Nexi a stato semplificato
 */
export function mapNexiResultToStatus(esito: string): 'success' | 'failed' | 'pending' | 'cancelled' {
  switch (esito.toUpperCase()) {
    case 'OK':
      return 'success';
    case 'KO':
    case 'ERRORE':
      return 'failed';
    case 'ANNULLO':
      return 'cancelled';
    case 'PEN':
      return 'pending';
    default:
      return 'failed';
  }
}

// Export types for webhook
export type { NexiWebhookPayload as NexiWebhookPayloadType };
