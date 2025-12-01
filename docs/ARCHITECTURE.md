# 📐 Architettura del Sistema

Documentazione dettagliata dell'architettura del sistema di prenotazione Rifugio Dibona.

## Indice

- [Overview](#overview)
- [Struttura del Progetto](#struttura-del-progetto)
- [Flussi Principali](#flussi-principali)
- [Modulo Pagamenti](#modulo-pagamenti)
- [Sistema di Internazionalizzazione](#sistema-di-internazionalizzazione)
- [Autenticazione e Autorizzazione](#autenticazione-e-autorizzazione)
- [Cron Jobs](#cron-jobs)
- [Service Worker](#service-worker)

---

## Overview

Il sistema è costruito come applicazione **Next.js 15** con **App Router**, deployata su **Vercel**.

### Principi Architetturali

1. **Server Components by Default**: Le pagine usano React Server Components dove possibile
2. **Client Components per Interattività**: Componenti con `'use client'` per stato e interazioni
3. **API Routes per Backend Logic**: Tutte le operazioni server-side via `/api/*`
4. **Separation of Concerns**: Moduli separati per pagamenti, email, database

---

## Struttura del Progetto

```
prenotazioni-rifugiodibona/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── [locale]/                 # Route dinamica per lingua
│   │   │   ├── page.tsx              # Homepage + Booking (1137 righe)
│   │   │   └── cart/
│   │   │       └── [id]/
│   │   │           └── page.tsx      # Conferma prenotazione
│   │   │
│   │   ├── admin_power/              # Area amministratore (protetta)
│   │   │   ├── calendario/           # Calendario mensile
│   │   │   │   ├── page.tsx
│   │   │   │   └── components/
│   │   │   │       ├── actionButtons.tsx
│   │   │   │       ├── daySheet.tsx
│   │   │   │       ├── BedDetailPdfGenerator.tsx
│   │   │   │       └── ReservationListPdfGenerator.tsx
│   │   │   ├── stanze/               # Gestione stanze
│   │   │   │   ├── page.tsx
│   │   │   │   └── components/
│   │   │   │       ├── bed.tsx
│   │   │   │       ├── rooms.tsx
│   │   │   │       ├── buildings.tsx
│   │   │   │       ├── services.tsx
│   │   │   │       └── guestAndDiscounts.tsx
│   │   │   ├── impostazioni/         # Impostazioni
│   │   │   ├── report/               # Report prenotazioni
│   │   │   ├── vista_calendario/     # Vista timeline
│   │   │   ├── past_calendar/        # Calendario storico
│   │   │   ├── db_prenotazioni/      # Lista prenotazioni
│   │   │   └── resend-sync/          # Sync email
│   │   │
│   │   ├── api/                      # API Routes
│   │   │   ├── search/               # Ricerca disponibilità
│   │   │   ├── booking-hold/         # Gestione blocco temporaneo
│   │   │   ├── create-booking/       # Creazione prenotazione
│   │   │   ├── create-admin-booking/ # Prenotazione da admin
│   │   │   ├── cancel-booking/       # Cancellazione + rimborso
│   │   │   ├── remove-beds/          # Rimozione letti da prenotazione
│   │   │   ├── booking-details/      # Dettagli prenotazione
│   │   │   ├── confirm-nexi-payment/ # Conferma pagamento Nexi
│   │   │   ├── cancel-nexi-checkout/ # Annullamento checkout Nexi
│   │   │   ├── webhooks/
│   │   │   │   ├── nexi/             # Webhook Nexi
│   │   │   │   └── stripe/           # Webhook Stripe (legacy)
│   │   │   ├── calendario_mese/      # Dati calendario mensile
│   │   │   ├── calendario_giorno_dettagli/ # Dettagli giorno
│   │   │   ├── daily-email/          # Cron: email giornaliera
│   │   │   ├── stripe-sync/          # Cron: sync Stripe
│   │   │   ├── cron/
│   │   │   │   └── cleanup-expired-bookings/ # Cron: pulizia
│   │   │   ├── services/             # Lista servizi
│   │   │   ├── countries/            # Lista paesi
│   │   │   ├── italyregions/         # Regioni italiane
│   │   │   ├── languages/            # Lingue disponibili
│   │   │   ├── send-email/           # Invio email
│   │   │   └── maintenance/          # Controllo manutenzione
│   │   │
│   │   ├── components/               # Componenti specifici app
│   │   │   ├── bedMap.tsx            # Mappa letti stanza
│   │   │   ├── bedblockingcomponent.tsx # Blocco privacy letti
│   │   │   ├── roomcontent.tsx       # Contenuto stanza
│   │   │   ├── cart.tsx              # Carrello laterale
│   │   │   ├── MaintenanceGate.tsx   # Gate manutenzione
│   │   │   └── checkout/
│   │   │       ├── checkout.tsx      # Pagina checkout
│   │   │       ├── ContactInfoSection.tsx
│   │   │       └── NotesSection.tsx
│   │   │
│   │   ├── utils/                    # Utilities app
│   │   │   ├── pricing.ts            # Calcolo prezzi
│   │   │   ├── dateUtils.ts          # Utility date
│   │   │   └── bookingCreation.ts    # Logica creazione booking
│   │   │
│   │   ├── types.ts                  # Tipi TypeScript comuni
│   │   ├── layout.tsx                # Root layout
│   │   ├── globals.css               # Stili globali
│   │   └── rootlayoutclient.tsx      # Client layout wrapper
│   │
│   ├── components/                   # Componenti riutilizzabili
│   │   ├── ui/                       # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── calendar.tsx
│   │   │   ├── select.tsx
│   │   │   ├── accordion.tsx
│   │   │   └── ... (altri componenti UI)
│   │   ├── header/
│   │   │   └── header.tsx            # Header con language switcher
│   │   ├── footer/
│   │   │   └── footer.tsx            # Footer
│   │   └── sidebar.tsx               # Sidebar admin
│   │
│   ├── lib/                          # Librerie e configurazioni
│   │   ├── supabase.ts               # Client Supabase
│   │   ├── utils.ts                  # Utility generiche (cn, etc.)
│   │   └── payment/                  # Modulo pagamenti
│   │       ├── index.ts              # Export principale
│   │       ├── config.ts             # Configurazione provider
│   │       ├── nexi-client.ts        # Client Nexi XPay
│   │       ├── create-session.ts     # Creazione sessione pagamento
│   │       └── refund.ts             # Gestione rimborsi
│   │
│   ├── i18n/                         # Internazionalizzazione
│   │   ├── index.ts
│   │   ├── navigation.ts
│   │   ├── request.ts
│   │   ├── routing.ts
│   │   └── types.ts
│   │
│   ├── utils/                        # Utilities globali
│   │   ├── database.ts               # Tipi TypeScript Supabase
│   │   ├── emailService.ts           # Servizio invio email
│   │   └── blockDays.ts              # Gestione giorni bloccati
│   │
│   ├── fonts/                        # Font personalizzati
│   │   └── LiberationSans-*.ttf      # Font per PDF
│   │
│   └── middleware.ts                 # Middleware Next.js
│
├── messages/                         # File traduzioni
│   ├── it.json                       # Italiano
│   ├── en.json                       # English
│   ├── fr.json                       # Français
│   ├── de.json                       # Deutsch
│   └── es.json                       # Español
│
├── public/                           # Asset statici
│   └── sw.js                         # Service Worker
│
├── supabase/
│   └── migrations/                   # Migrazioni SQL
│
└── vercel.json                       # Configurazione Vercel + Cron
```

---

## Flussi Principali

### 1. Flusso di Prenotazione Utente

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUSSO PRENOTAZIONE                               │
└─────────────────────────────────────────────────────────────────────────────┘

[1] RICERCA DISPONIBILITÀ
    │
    │  GET /api/search?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=[...]
    │
    ├─► Verifica giorni bloccati (day_blocked)
    ├─► Verifica booking_on_hold attivi
    ├─► Calcola letti disponibili per ogni notte
    │
    ▼
[2] BOOKING HOLD (15 minuti)
    │
    │  POST /api/booking-hold
    │
    ├─► Crea record in booking_on_hold
    ├─► Imposta session_id (cookie)
    ├─► Avvia timer 15 minuti
    ├─► Service Worker inizia heartbeat
    │
    ▼
[3] SELEZIONE STANZE & LETTI
    │
    │  (Frontend - stato locale)
    │
    ├─► Utente seleziona stanze
    ├─► Assegna ospiti ai letti
    ├─► Opzione: blocco letti privacy
    ├─► Calcolo prezzo in tempo reale
    │
    ▼
[4] CHECKOUT
    │
    │  PUT /api/booking-hold (action: ENTER_PAYMENT)
    │
    ├─► Raccolta dati cliente
    ├─► Selezione servizi aggiuntivi
    ├─► Calcolo totale finale
    │
    ▼
[5] PAGAMENTO
    │
    │  POST /api/create-booking
    │
    ├─► Crea Basket + RoomReservation + RoomReservationSpec
    ├─► Se Nexi: genera form redirect
    ├─► Se Stripe: crea Checkout Session
    │
    ▼
[6] CONFERMA PAGAMENTO
    │
    │  Webhook: POST /api/webhooks/nexi (o /stripe)
    │  oppure
    │  GET /api/confirm-nexi-payment
    │
    ├─► Aggiorna Basket.isPaid = true
    ├─► Invia email conferma
    ├─► Cancella booking_on_hold
    │
    ▼
[7] PAGINA CONFERMA
    │
    │  GET /[locale]/cart/[external_id]
    │
    ├─► Mostra dettagli prenotazione
    ├─► Genera PDF scaricabile
    ├─► Opzioni: cancella, rimuovi letti
```

### 2. Meccanismo Booking Hold (Dettaglio)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BOOKING HOLD - DIAGRAMMA TEMPORALE                   │
└─────────────────────────────────────────────────────────────────────────────┘

T+0:00  ─────────────────────────────────────────────────────────────────────►
        │
        │  [Utente A cerca disponibilità]
        │
        ├─► POST /api/booking-hold
        │   └─► Crea record: {
        │         check_in, check_out,
        │         session_id: "abc123",
        │         still_on_hold: true,
        │         time_is_up_at: T+15:00
        │       }
        │
        │  [Utente B cerca stesse date]
        │
        ├─► GET /api/search
        │   └─► Trova booking_on_hold attivo da altra sessione
        │   └─► Ritorna: { available: false, reason: 'BOOKING_IN_PROGRESS' }
        │
T+5:00  │  [Utente A procede al checkout]
        │
        ├─► PUT /api/booking-hold (action: ENTER_PAYMENT)
        │   └─► entered_payment: T+5:00
        │   └─► Estensione implicita: +7 minuti dal pagamento
        │
T+10:00 │  [Utente A completa pagamento]
        │
        ├─► Webhook conferma pagamento
        │   └─► Basket.isPaid = true
        │   └─► booking_on_hold.still_on_hold = false
        │
        │  [Letti ora disponibili per altri utenti]
        │
        ▼
```

### 3. Flusso Cancellazione con Rimborso

```
[1] Richiesta Cancellazione
    │
    │  POST /api/cancel-booking
    │  Body: { bookingId, reason }
    │
    ▼
[2] Calcolo Rimborso
    │
    ├─► Check: prenotazione admin? → Nessun rimborso
    ├─► Check: giorni al check-in
    │   ├─► > 7 giorni  → 100% rimborso
    │   ├─► 3-7 giorni  → 70% rimborso
    │   └─► < 3 giorni  → 0% rimborso
    │
    ▼
[3] Processo Rimborso
    │
    │  processRefund() in /lib/payment/refund.ts
    │
    ├─► Se nexiOrderId presente → createNexiRefund()
    ├─► Se paymentIntentId presente → stripe.refunds.create()
    │
    ▼
[4] Aggiornamento Database
    │
    ├─► Basket.isCancelled = true
    ├─► ReservationCancel: crea record rimborso
    │
    ▼
[5] Notifica
    │
    └─► Invia email cancellazione
```

---

## Modulo Pagamenti

Il modulo pagamenti è progettato per supportare più provider in modo intercambiabile.

### Struttura `/lib/payment/`

```typescript
// config.ts - Configurazione provider
export const PAYMENT_PROVIDER: 'stripe' | 'nexi' = 
  process.env.PAYMENT_PROVIDER || 'stripe';

export const isStripe = () => PAYMENT_PROVIDER === 'stripe';
export const isNexi = () => PAYMENT_PROVIDER === 'nexi';
```

```typescript
// index.ts - Export unificato
export { PAYMENT_PROVIDER, isStripe, isNexi } from './config';
export { createNexiOrder, createNexiRefund } from './nexi-client';
export { createPaymentSession } from './create-session';
export { processRefund } from './refund';
```

### Nexi XPay Integration

```typescript
// nexi-client.ts - Flusso principale

// 1. Creazione ordine (genera form HTML per redirect)
createNexiOrder({
  orderId: string,      // UUID della prenotazione
  amount: number,       // Importo in EUR
  description: string,  // Descrizione pagamento
  customerEmail: string,
  successUrl: string,   // Redirect dopo successo
  cancelUrl: string,    // Redirect dopo annullamento
  webhookUrl: string,   // URL notifica server-to-server
}) → {
  formAction: string,   // URL form Nexi
  formFields: {         // Campi da inviare
    alias: string,
    importo: string,    // In centesimi
    divisa: 'EUR',
    codTrans: string,   // ID transazione (max 30 char)
    mac: string,        // HMAC firma
    ...
  }
}

// 2. Rimborso
createNexiRefund({
  codiceTransazione: string,  // codTrans originale
  amount: number,             // Importo da rimborsare
  description: string,
}) → {
  idOperazione: string,       // ID rimborso Nexi
}
```

### Webhook Nexi

```
POST /api/webhooks/nexi

Payload:
{
  esito: 'OK' | 'KO' | 'ANNULLO',
  codTrans: string,
  importo: string,
  divisa: string,
  alias: string,
  // ... altri campi
}

Azioni:
- esito='OK' → Basket.isPaid=true, invia email conferma
- esito='KO' → Log errore, invia email fallimento
- esito='ANNULLO' → Cancella prenotazione
```

---

## Sistema di Internazionalizzazione

### Configurazione

```typescript
// i18n/routing.ts
export const locales = ['it', 'en', 'fr', 'de', 'es'] as const;
export const defaultLocale = 'it';

// Routing basato su [locale] segment
// /it/... /en/... /fr/... /de/... /es/...
```

### Middleware Redirect

```typescript
// middleware.ts
// Redirect automatico da / a /[locale] basato su Accept-Language header
if (pathname === '/') {
  const preferredLocale = getLocaleFromHeaders(acceptLanguage);
  return NextResponse.redirect(`/${preferredLocale}`);
}
```

### Utilizzo nei Componenti

```typescript
// In page.tsx
const pathname = usePathname();
const detectedLang = pathname?.match(/^\/([a-z]{2})(?:\/|$)/)?.[1] || 'it';

// Caricamento traduzioni
import itMessages from '../../../messages/it.json';
const messages = getMessages(language);

// Funzione t()
const t = (key: string, vars?: Record<string, unknown>): string => {
  const parts = key.split('.');
  let value = messages;
  for (const part of parts) {
    value = value[part];
  }
  // Sostituzione variabili {key}
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, String(v));
    });
  }
  return value;
};

// Uso
t('booking.title') // "Prenota il tuo soggiorno"
t('room.availableBedsDisplay', { count: 5 }) // "5 letti disponibili"
```

---

## Autenticazione e Autorizzazione

### Supabase Auth

L'autenticazione admin usa Supabase Auth con email/password.

```typescript
// middleware.ts
const supabaseAuthClient = createMiddlewareClient({ req, res });
const { data: { session } } = await supabaseAuthClient.auth.getSession();

// Protezione route admin
if (pathname.startsWith('/admin_power') && !session) {
  return NextResponse.redirect('/login');
}
```

### Flusso Login Admin

```
1. GET /login → Mostra form login
2. POST auth/signInWithPassword → Supabase Auth
3. Redirect a /admin_power/calendario
```

### Prenotazioni Admin

Gli admin possono creare prenotazioni senza pagamento:

```typescript
// URL con parametro speciale
/it?admin_booking=true

// In create-admin-booking
{
  isCreatedByAdmin: true,
  isPaid: true  // Considerata pagata
}
```

---

## Cron Jobs

Configurati in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/daily-email",
      "schedule": "0 3 * * *"        // Ogni giorno alle 3:00
    },
    {
      "path": "/api/stripe-sync",
      "schedule": "0 2 * * *"        // Ogni giorno alle 2:00
    },
    {
      "path": "/api/cron/cleanup-expired-bookings",
      "schedule": "*/15 * * * *"     // Ogni 15 minuti
    }
  ]
}
```

### Daily Email (`/api/daily-email`)

Invia email giornaliera al gestore con:
- Riepilogo arrivi del giorno
- Riepilogo partenze del giorno
- PDF allegato con dettagli

### Cleanup Expired Bookings (`/api/cron/cleanup-expired-bookings`)

```typescript
// Trova prenotazioni:
// - isPaid = false
// - isCreatedByAdmin = false
// - isCancelled = false
// - createdAt < (now - 30 minuti)

// Azioni:
// 1. Marca come cancellate
// 2. Invia email "prenotazione scaduta"
```

---

## Service Worker

Il Service Worker (`/public/sw.js`) gestisce il heartbeat per mantenere attivo il booking hold.

```javascript
// sw.js
let heartbeatInterval = null;
let currentBookingId = null;

self.addEventListener('message', (event) => {
  if (event.data.type === 'START_HEARTBEAT') {
    currentBookingId = event.data.bookingId;
    heartbeatInterval = setInterval(() => {
      fetch('/api/booking-hold', {
        method: 'PUT',
        body: JSON.stringify({ 
          bookingId: currentBookingId, 
          action: 'HEARTBEAT' 
        })
      });
    }, 60000); // Ogni 60 secondi
  }
  
  if (event.data.type === 'STOP_HEARTBEAT') {
    clearInterval(heartbeatInterval);
  }
});
```

---

## Componenti Chiave

### HomePage (`/[locale]/page.tsx`)

Componente principale (~1137 righe) che gestisce:
- Stato ricerca (date, ospiti)
- Visualizzazione risultati
- Assegnazione ospiti a letti
- Calcolo prezzi
- Navigazione a checkout

### Cart Component (`/components/cart.tsx`)

Carrello laterale sempre visibile con:
- Timer countdown (15 min)
- Riepilogo stanze selezionate
- Totale in tempo reale
- Pulsante "Prosegui"

### Checkout (`/components/checkout/checkout.tsx`)

Pagina checkout con:
- Form dati cliente
- Selezione servizi aggiuntivi
- Riepilogo prezzi
- Integrazione pagamento

### BedMap (`/components/bedMap.tsx`)

Visualizzazione mappa letti con:
- Stato per ogni notte
- Colori: libero (verde), occupato (rosso), bloccato (giallo)
- Tooltip con dettagli

---

## Performance Considerations

### Ottimizzazioni Attuali

1. **Turbopack**: Abilitato per dev (`next dev --turbopack`)
2. **React 19**: Concurrent features
3. **Parallel API Calls**: Fetch multipli in parallelo dove possibile

### Aree di Miglioramento (Legacy Bubble)

1. **Query Database**: Alcune query potrebbero essere ottimizzate con JOIN
2. **Caching**: Implementare caching per dati statici (stanze, servizi)
3. **Bundle Size**: Analizzare e ottimizzare imports

---

## Testing

> **Nota**: Al momento non ci sono test automatizzati. Considerare l'aggiunta di:
> - Unit test per `pricing.ts`
> - Integration test per API routes
> - E2E test per flusso prenotazione

---

## Deploy

### Vercel

```bash
# Deploy automatico su push a main
git push origin main

# Deploy manuale
vercel --prod
```

### Environment Variables

Configurare tutte le variabili d'ambiente nel dashboard Vercel:
- Settings → Environment Variables
- Separare Production/Preview/Development se necessario

### Functions Config

```json
// vercel.json
{
  "functions": {
    "src/app/api/daily-email/route.ts": {
      "maxDuration": 30
    }
  }
}
```

