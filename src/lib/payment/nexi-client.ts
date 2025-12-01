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
  codiceTransazione: string;  // Il codTrans usato nel pagamento originale
  amount: number;             // Importo da rimborsare in EURO
  description?: string;       // Descrizione opzionale
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Converte un external_id (UUID) in un codTrans valido per Nexi
 * Nexi richiede: AN MIN 2 MAX 30 caratteri, esclusi # ' "
 * UUID standard: 36 caratteri con trattini (es: be2f45d2-6e14-4e42-942b-b094f2846656)
 * 
 * Strategia: rimuoviamo i trattini (32 char) e prendiamo i primi 30
 */
export function toNexiCodTrans(externalId: string): string {
  // Rimuovi i trattini e prendi i primi 30 caratteri
  const codTrans = externalId.replace(/-/g, '').substring(0, 30);
  console.log(`[Nexi] Converted external_id to codTrans: ${externalId} -> ${codTrans} (${codTrans.length} chars)`);
  return codTrans;
}

/**
 * Converte un codTrans Nexi indietro all'external_id originale
 * Nota: questa conversione richiede una lookup nel database poiché
 * la conversione non è reversibile (abbiamo perso 2 caratteri)
 */
export function fromNexiCodTrans(codTrans: string): string {
  // Il codTrans è l'UUID senza trattini, troncato a 30 char
  // Per trovare l'external_id originale, dobbiamo fare una lookup
  // che inizia con questo prefisso
  return codTrans;
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
  
  // Converti l'orderId (UUID) in un codTrans valido per Nexi (max 30 char)
  const codTrans = toNexiCodTrans(params.orderId);
  
  const result = createNexiPaymentForm({
    codTrans: codTrans,
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
 * Esegue uno storno/rimborso tramite API Nexi XPay
 * 
 * Documentazione: ecomm/api/bo/storna
 * - Se autorizzato → Storno Online (annullamento)
 * - Se in attesa contabilizzazione → Storno Contabile
 * - Se contabilizzato → Rimborso (riaccredito)
 * 
 * @param codiceTransazione - Il codTrans originale del pagamento (NON il codAut!)
 * @param amount - Importo da stornare in EURO
 */
export async function createNexiRefund(params: {
  codiceTransazione: string;  // Il codTrans usato nel pagamento originale
  amount: number;
  description?: string;
}): Promise<{ idOperazione: string; result: string }> {
  
  const importoInCentesimi = Math.round(params.amount * 100).toString();
  const timeStamp = Date.now().toString();
  
  // Calcola MAC per lo storno
  // Formula: SHA1(apiKey=<alias>codiceTransazione=<val>divisa=978importo=<val>timeStamp=<val><chiaveSegreta>)
  const macString = `apiKey=${nexiConfig.terminalId}codiceTransazione=${params.codiceTransazione}divisa=978importo=${importoInCentesimi}timeStamp=${timeStamp}${nexiConfig.apiKey}`;
  const mac = createHash('sha1').update(macString, 'utf8').digest('hex');
  
  console.log('[Nexi] Refund MAC string:', macString.replace(nexiConfig.apiKey, '***SECRET***'));
  
  const requestBody = {
    apiKey: nexiConfig.terminalId,  // Alias del terminale (NON la chiave segreta!)
    codiceTransazione: params.codiceTransazione,
    importo: importoInCentesimi,
    divisa: '978',  // Codice ISO numerico per EUR
    timeStamp: timeStamp,
    mac: mac,
  };
  
  console.log('[Nexi] Refund request:', {
    apiKey: nexiConfig.terminalId,
    codiceTransazione: params.codiceTransazione,
    importo: importoInCentesimi,
    divisa: '978',
    timeStamp: timeStamp,
  });
  
  const response = await fetch(`${nexiConfig.baseUrl}/ecomm/api/bo/storna`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  
  const responseText = await response.text();
  console.log('[Nexi] Refund response status:', response.status);
  console.log('[Nexi] Refund response body:', responseText);
  
  if (!response.ok) {
    console.error('[Nexi] Refund HTTP error:', response.status, responseText);
    throw new Error(`Nexi refund error: ${response.status} - ${responseText}`);
  }
  
  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`Nexi refund: invalid JSON response - ${responseText}`);
  }
  
  // Verifica esito
  if (data.esito !== 'OK') {
    const errorMsg = data.errore?.messaggio || data.messaggio || data.esito;
    console.error('[Nexi] Refund failed:', data);
    throw new Error(`Nexi refund failed: ${errorMsg}`);
  }
  
  console.log('[Nexi] Refund successful:', {
    idOperazione: data.idOperazione,
    esito: data.esito,
  });
  
  return {
    idOperazione: data.idOperazione,
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
