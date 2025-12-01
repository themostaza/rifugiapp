# 🔌 Documentazione API

Documentazione completa delle API Routes del sistema di prenotazione Rifugio Dibona.

## Indice

- [Overview](#overview)
- [Autenticazione](#autenticazione)
- [API Pubbliche](#api-pubbliche)
  - [Ricerca e Prenotazione](#ricerca-e-prenotazione)
  - [Pagamenti](#pagamenti)
  - [Utilità](#utilità)
- [API Admin](#api-admin)
- [Webhooks](#webhooks)
- [Cron Jobs](#cron-jobs)
- [Codici di Errore](#codici-di-errore)

---

## Overview

Tutte le API sono implementate come Next.js Route Handlers in `/src/app/api/`.

### Base URL

```
Development: http://localhost:3000/api
Production:  https://your-domain.vercel.app/api
```

### Convenzioni

- **Formato**: JSON
- **Encoding**: UTF-8
- **Date**: ISO 8601 (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss.sssZ)
- **Valute**: EUR (numeri decimali)

### Headers Comuni

```http
Content-Type: application/json
```

---

## Autenticazione

### API Pubbliche
Le API di prenotazione sono pubbliche e non richiedono autenticazione.

### API Admin
Le API admin richiedono una sessione Supabase Auth valida. Il middleware verifica automaticamente l'autenticazione per le route `/admin_power/*`.

### Cron Jobs
I cron jobs richiedono un header `Authorization: Bearer {CRON_SECRET}`.

---

## API Pubbliche

### Ricerca e Prenotazione

---

#### `GET /api/search`

Ricerca disponibilità letti per un periodo.

**Query Parameters:**

| Parametro | Tipo | Required | Descrizione |
|-----------|------|----------|-------------|
| `checkIn` | string | ✅ | Data check-in (YYYY-MM-DD) |
| `checkOut` | string | ✅ | Data check-out (YYYY-MM-DD) |
| `guests` | string | ✅ | JSON array di ospiti |

**Formato `guests`:**
```json
[
  { "type": "adult", "count": 2 },
  { "type": "child", "count": 1 },
  { "type": "infant", "count": 0 }
]
```

**Response Success (200):**

```json
{
  "status": "enough",
  "rooms": [
    {
      "roomId": 1,
      "description": "Camera 1",
      "images": ["https://..."],
      "allBeds": [
        {
          "id": 1,
          "name": "Letto 1",
          "pricing": { "bb": 45, "mp": 65 }
        }
      ],
      "availableBeds": [
        {
          "id": 1,
          "name": "Letto 1",
          "pricing": { "bb": 45, "mp": 65 }
        }
      ]
    }
  ],
  "availabilityByNight": [
    {
      "date": "2025-06-15",
      "rooms": [
        {
          "roomId": 1,
          "description": "Camera 1",
          "allBeds": [
            { "id": 1, "name": "Letto 1", "isAvailable": true },
            { "id": 2, "name": "Letto 2", "isAvailable": false }
          ],
          "availableBeds": [
            { "id": 1, "name": "Letto 1" }
          ]
        }
      ]
    }
  ],
  "guestTypes": [
    {
      "id": 1,
      "title": "Adulti",
      "ageFrom": 13,
      "ageTo": 999,
      "salePercent": 0,
      "cityTax": true,
      "cityTaxPrice": 2
    }
  ]
}
```

**Response Not Available (200):**

```json
{
  "available": false,
  "reason": "BLOCKED_DAYS" | "BOOKING_IN_PROGRESS",
  "blockedDays": ["2025-06-16"]  // solo se reason=BLOCKED_DAYS
}
```

**Possibili `status`:**
- `enough` - Disponibilità sufficiente
- `sold_out` - Nessun letto disponibile
- `too_little_availability:N` - Solo N letti disponibili (insufficienti)

---

#### `POST /api/booking-hold`

Crea un blocco temporaneo per le date selezionate.

**Request Body:**
```json
{
  "checkIn": "2025-06-15",
  "checkOut": "2025-06-18"
}
```

**Response Success (200):**
```json
{
  "available": true,
  "bookingId": 123
}
```

**Response Not Available (200):**
```json
{
  "available": false,
  "reason": "BOOKING_IN_PROGRESS"
}
```

**Side Effects:**
- Crea record in `booking_on_hold`
- Imposta cookie `sessionId` per identificare la sessione
- Il blocco scade dopo 15 minuti

---

#### `PUT /api/booking-hold`

Aggiorna lo stato di un booking hold.

**Request Body:**
```json
{
  "bookingId": 123,
  "action": "ENTER_PAYMENT" | "HEARTBEAT" | "CANCEL"
}
```

**Actions:**
- `ENTER_PAYMENT` - L'utente è entrato nella fase di pagamento (estende il tempo)
- `HEARTBEAT` - Mantiene attivo il blocco (chiamato dal Service Worker)
- `CANCEL` - Cancella il blocco

**Response (200):**
```json
{
  "success": true
}
```

---

#### `POST /api/create-booking`

Crea una nuova prenotazione e avvia il pagamento.

**Request Body:**
```json
{
  "checkIn": "2025-06-15T00:00:00.000Z",
  "checkOut": "2025-06-18T00:00:00.000Z",
  "customerName": "Mario Rossi",
  "customerEmail": "mario@example.com",
  "customerPhone": "+39123456789",
  "customerCity": "IT",
  "customerRegion": "Veneto",
  "reservationType": "hb",
  "totalAmount": 250.00,
  "note": "Allergie: glutine",
  "rooms": [
    {
      "roomId": 1,
      "guests": [
        {
          "type": "adult",
          "bedId": 1,
          "guestDivisionId": 1,
          "price": 195
        }
      ],
      "blockedBeds": {
        "2025-06-15": [2, 3],
        "2025-06-16": [2],
        "2025-06-17": [2, 3]
      }
    }
  ],
  "services": [
    {
      "serviceId": 1,
      "quantity": 2
    }
  ]
}
```

**Response Success - Nexi (200):**
```json
{
  "success": true,
  "provider": "nexi",
  "formAction": "https://ecommerce.nexi.it/ecomm/ecomm/DispatcherServlet",
  "formFields": {
    "alias": "TERMINAL_ID",
    "importo": "25000",
    "divisa": "EUR",
    "codTrans": "uuid-troncato-30char",
    "url": "https://your-domain/cart/uuid",
    "url_back": "https://your-domain/?step=checkout",
    "mac": "hmac-signature",
    "languageId": "ITA"
  },
  "basketId": 456
}
```

**Response Success - Stripe (200):**
```json
{
  "success": true,
  "provider": "stripe",
  "sessionId": "cs_xxx",
  "basketId": 456
}
```

---

#### `POST /api/create-admin-booking`

Crea una prenotazione da admin (senza pagamento).

> ⚠️ Richiede autenticazione admin

**Request Body:**
Come `/api/create-booking`, con aggiunta:
```json
{
  "isAdmin": true
  // ... altri campi
}
```

**Response (200):**
```json
{
  "success": true,
  "basketId": 456,
  "externalId": "uuid"
}
```

---

#### `GET /api/booking-details`

Recupera i dettagli di una prenotazione.

**Query Parameters:**

| Parametro | Tipo | Required | Descrizione |
|-----------|------|----------|-------------|
| `externalId` | string | ✅ | UUID della prenotazione |

**Response (200):**
```json
{
  "id": 456,
  "external_id": "uuid",
  "checkIn": "2025-06-15",
  "checkOut": "2025-06-18",
  "guestName": "Mario Rossi",
  "guestEmail": "mario@example.com",
  "guestPhone": "+39123456789",
  "reservationType": "hb",
  "totalPrice": 250.00,
  "isPaid": true,
  "isCancelled": false,
  "isCreatedByAdmin": false,
  "paymentId": "nexi-operation-id",
  "cityTaxTotal": 6.00,
  "totalPrivacyCost": 30.00,
  "note": "Allergie: glutine",
  "rooms": [
    {
      "roomId": 1,
      "roomDescription": "Camera 1",
      "guests": [
        {
          "specId": 1,
          "guestType": "Adulti",
          "bedName": "Letto 1",
          "price": 195
        }
      ],
      "privacyBlocks": [
        {
          "day": "2025-06-15",
          "beds": [
            { "id": 2, "name": "Letto 2" }
          ]
        }
      ]
    }
  ],
  "services": [
    {
      "linkId": 1,
      "serviceId": 1,
      "description": "Pranzo al sacco",
      "quantity": 2,
      "unitPrice": 10,
      "totalPrice": 20
    }
  ]
}
```

---

#### `POST /api/cancel-booking`

Cancella una prenotazione e processa il rimborso.

**Request Body:**
```json
{
  "bookingId": "uuid",
  "reason": "customer_request"
}
```

**Response (200):**
```json
{
  "success": true,
  "refundAmount": 175.00,
  "refundPercentage": 70,
  "refundId": "re_xxx",
  "message": "Prenotazione cancellata con rimborso del 70%"
}
```

**Politica Rimborsi:**
- \> 7 giorni dal check-in: 100%
- 3-7 giorni: 70%
- < 3 giorni: 0%
- Prenotazioni admin: 0% (nessun rimborso)

---

#### `POST /api/remove-beds`

Rimuove letti da una prenotazione esistente (rimborso parziale).

**Request Body:**
```json
{
  "bookingId": "uuid",
  "specIds": [1, 2]  // ID di RoomReservationSpec da rimuovere
}
```

**Response (200):**
```json
{
  "success": true,
  "removedSpecs": 2,
  "refundAmount": 130.00,
  "newTotalPrice": 120.00
}
```

---

### Pagamenti

---

#### `GET /api/confirm-nexi-payment`

Conferma un pagamento Nexi (chiamato dopo redirect success).

**Query Parameters:**

| Parametro | Tipo | Required | Descrizione |
|-----------|------|----------|-------------|
| `codTrans` | string | ✅ | Codice transazione Nexi |
| `esito` | string | ✅ | Esito ('OK', 'KO', 'ANNULLO') |

**Response (200):**
```json
{
  "success": true,
  "basketId": 456,
  "externalId": "uuid"
}
```

---

#### `POST /api/cancel-nexi-checkout`

Cancella una prenotazione quando l'utente annulla il checkout Nexi.

**Request Body:**
```json
{
  "codTrans": "transaction-code"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Booking cancelled"
}
```

---

### Utilità

---

#### `GET /api/services`

Lista servizi aggiuntivi disponibili.

**Response (200):**
```json
{
  "services": [
    {
      "id": 1,
      "description": "Pranzo al sacco",
      "price": 10.00,
      "requestQuantity": true,
      "langTrasn": {
        "en": "Packed lunch",
        "de": "Lunchpaket"
      }
    }
  ]
}
```

---

#### `GET /api/countries`

Lista paesi per form contatto.

**Response (200):**
```json
{
  "countries": [
    { "code": "IT", "name": "Italia" },
    { "code": "DE", "name": "Germania" }
  ]
}
```

---

#### `GET /api/italyregions`

Lista regioni italiane.

**Response (200):**
```json
{
  "regions": [
    "Abruzzo",
    "Basilicata",
    "Calabria",
    // ...
  ]
}
```

---

#### `GET /api/languages`

Lista lingue supportate.

**Response (200):**
```json
{
  "languages": [
    { "code": "it", "name": "Italiano" },
    { "code": "en", "name": "English" }
  ]
}
```

---

#### `POST /api/send-email`

Invia un'email tramite Resend.

**Request Body:**
```json
{
  "to": "email@example.com",
  "subject": "Oggetto email",
  "html": "<h1>HTML content</h1>",
  "text": "Plain text fallback"
}
```

**Response (200):**
```json
{
  "success": true,
  "emailId": "resend-id"
}
```

---

#### `GET /api/maintenance/check`

Verifica se la modalità manutenzione è attiva.

**Response (200):**
```json
{
  "maintenanceMode": false
}
```

---

#### `POST /api/maintenance/verify`

Verifica la password di manutenzione.

**Request Body:**
```json
{
  "password": "maintenance-password"
}
```

**Response (200):**
```json
{
  "success": true,
  "bypassToken": "xyz123"
}
```

---

## API Admin

> ⚠️ Tutte le API admin richiedono autenticazione Supabase Auth

---

#### `GET /api/calendario_mese`

Dati calendario mensile.

**Query Parameters:**

| Parametro | Tipo | Required | Descrizione |
|-----------|------|----------|-------------|
| `month` | number | ✅ | Mese (1-12) |
| `year` | number | ✅ | Anno |

**Response (200):**
```json
{
  "reservations": [
    {
      "id": 456,
      "dayFrom": "2025-06-15",
      "dayTo": "2025-06-18",
      "name": "Mario",
      "surname": "Rossi",
      "guestCount": 3
    }
  ],
  "calendarDays": [
    {
      "date": "2025-06-16",
      "isBlocked": true
    }
  ]
}
```

---

#### `GET /api/calendario_giorno_dettagli`

Dettagli completi per un giorno specifico.

**Query Parameters:**

| Parametro | Tipo | Required | Descrizione |
|-----------|------|----------|-------------|
| `date` | string | ✅ | Data (YYYY-MM-DD) |

**Response (200):**
```json
{
  "detailedReservations": [
    {
      "id": 456,
      "dayFrom": "2025-06-15",
      "dayTo": "2025-06-18",
      "name": "Mario",
      "surname": "Rossi",
      "mail": "mario@example.com",
      "phone": "+39123456789",
      "reservationType": "hb",
      "totalPrice": 250,
      "isPaid": true,
      "RoomReservation": [...]
    }
  ],
  "blockedBedsByRoom": {
    "1": 2
  },
  "availableBeds": 10,
  "totalBlockedBeds": 2,
  "allRoomsData": [...]
}
```

---

#### `GET /api/lista_mensile_prenotazioni`

Lista prenotazioni per un mese.

**Query Parameters:**

| Parametro | Tipo | Required | Descrizione |
|-----------|------|----------|-------------|
| `month` | number | ✅ | Mese (1-12) |
| `year` | number | ✅ | Anno |

---

#### `GET /api/prenotazioni-future`

Lista tutte le prenotazioni future.

**Response (200):**
```json
{
  "reservations": [...]
}
```

---

#### `GET /api/report-past-reservations`

Report prenotazioni passate per statistiche.

**Query Parameters:**

| Parametro | Tipo | Required | Descrizione |
|-----------|------|----------|-------------|
| `startDate` | string | ✅ | Data inizio |
| `endDate` | string | ✅ | Data fine |

---

#### `POST /api/admin/change-password`

Cambia password admin.

**Request Body:**
```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

---

#### `PUT /api/update-guest-name`

Aggiorna il nome di un ospite.

**Request Body:**
```json
{
  "basketId": "uuid",
  "newName": "Nuovo Nome"
}
```

---

## Webhooks

---

#### `POST /api/webhooks/nexi`

Webhook per notifiche server-to-server da Nexi.

**Request (form-urlencoded o JSON):**
```
esito=OK
codTrans=transaction-code
importo=25000
divisa=EUR
alias=TERMINAL_ID
data=20250615
orario=143022
codAut=AUTH123
// ... altri campi
```

**Actions:**
- `esito=OK` → Conferma pagamento, invia email
- `esito=KO` → Log errore, invia email fallimento
- `esito=ANNULLO` → Cancella prenotazione

**Response (200):**
```json
{
  "success": true
}
```

---

#### `POST /api/webhooks/stripe`

Webhook per eventi Stripe (legacy).

**Headers:**
```
stripe-signature: signature
```

**Events gestiti:**
- `checkout.session.completed` → Conferma pagamento
- `checkout.session.expired` → Cancella prenotazione

---

## Cron Jobs

> ⚠️ Richiedono header `Authorization: Bearer {CRON_SECRET}`

---

#### `GET /api/daily-email`

Invia email giornaliera al gestore.

**Schedule:** `0 3 * * *` (ogni giorno alle 3:00)

**Response (200):**
```json
{
  "success": true,
  "emailsSent": 1,
  "arrivalsCount": 3,
  "departuresCount": 2
}
```

---

#### `GET /api/stripe-sync`

Sincronizza stato pagamenti con Stripe.

**Schedule:** `0 2 * * *` (ogni giorno alle 2:00)

**Response (200):**
```json
{
  "success": true,
  "synced": 5,
  "updated": 2
}
```

---

#### `GET /api/cron/cleanup-expired-bookings`

Cancella prenotazioni non pagate scadute.

**Schedule:** `*/15 * * * *` (ogni 15 minuti)

**Criteri cancellazione:**
- `isPaid = false`
- `isCreatedByAdmin = false`
- `isCancelled = false`
- `createdAt < (now - 30 minuti)`

**Response (200):**
```json
{
  "success": true,
  "count": 3,
  "emailsSent": 3,
  "emailsFailed": 0,
  "cancelledBookings": [
    {
      "id": 123,
      "external_id": "uuid",
      "createdAt": "2025-06-15T10:00:00.000Z"
    }
  ]
}
```

---

## Codici di Errore

### HTTP Status Codes

| Code | Significato |
|------|-------------|
| 200 | Successo |
| 400 | Bad Request - Parametri mancanti o invalidi |
| 401 | Unauthorized - Autenticazione richiesta |
| 404 | Not Found - Risorsa non trovata |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "error": "Descrizione errore",
  "details": "Dettagli aggiuntivi (opzionale)"
}
```

### Errori Comuni

| Errore | Descrizione |
|--------|-------------|
| `Missing required parameters` | Parametri obbligatori mancanti |
| `Invalid date format` | Formato data non valido |
| `Booking not found` | Prenotazione non trovata |
| `Payment already processed` | Pagamento già elaborato |
| `Refund failed` | Rimborso fallito |
| `Unauthorized` | Non autorizzato |

---

## Rate Limiting

Attualmente non implementato. Considerare l'aggiunta per:
- API pubbliche di ricerca
- Invio email

---

## Esempi di Integrazione

### Flusso Prenotazione Completo (JavaScript)

```javascript
// 1. Ricerca disponibilità
const searchResponse = await fetch('/api/search?' + new URLSearchParams({
  checkIn: '2025-06-15',
  checkOut: '2025-06-18',
  guests: JSON.stringify([{ type: 'adult', count: 2 }])
}));
const { status, rooms } = await searchResponse.json();

if (status !== 'enough') {
  console.log('Non disponibile');
  return;
}

// 2. Crea booking hold
const holdResponse = await fetch('/api/booking-hold', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    checkIn: '2025-06-15',
    checkOut: '2025-06-18'
  })
});
const { bookingId } = await holdResponse.json();

// 3. L'utente seleziona stanze e letti...

// 4. Crea prenotazione
const bookingResponse = await fetch('/api/create-booking', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    checkIn: '2025-06-15T00:00:00.000Z',
    checkOut: '2025-06-18T00:00:00.000Z',
    customerName: 'Mario Rossi',
    customerEmail: 'mario@example.com',
    // ... altri dati
  })
});

const { provider, formAction, formFields, sessionId } = await bookingResponse.json();

// 5. Redirect al pagamento
if (provider === 'nexi') {
  // Crea e invia form HTML
  const form = document.createElement('form');
  form.action = formAction;
  form.method = 'POST';
  Object.entries(formFields).forEach(([key, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
} else {
  // Stripe
  const stripe = Stripe(publishableKey);
  await stripe.redirectToCheckout({ sessionId });
}
```

---

## Changelog API

### v1.0.0 (Dicembre 2025)
- Migrazione completa da Bubble.io
- Aggiunta integrazione Nexi XPay
- Mantenuto supporto Stripe come backup

