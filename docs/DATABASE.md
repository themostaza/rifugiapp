# 🗄️ Schema Database

Documentazione completa dello schema database Supabase per il sistema di prenotazione Rifugio Dibona.

> **Nota**: I tipi TypeScript completi sono disponibili in `/src/utils/database.ts`

## Indice

- [Diagramma ER](#diagramma-er)
- [Tabelle Principali](#tabelle-principali)
- [Tabelle di Supporto](#tabelle-di-supporto)
- [Tabelle di Sistema](#tabelle-di-sistema)
- [Relazioni](#relazioni)
- [Query Comuni](#query-comuni)

---

## Diagramma ER

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              STRUTTURA ALLOGGI                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ BuildingRegistr. │     │      Room        │     │       Bed        │
├──────────────────┤     ├──────────────────┤     ├──────────────────┤
│ id               │     │ id               │     │ id               │
│ buildingName     │     │ description      │     │ description      │
│ roomIds[]        │────▶│ bedCount         │     │ priceBandB       │
└──────────────────┘     │ langTrasn        │     │ priceMP          │
                         │ order            │     │ peopleCount      │
                         └────────┬─────────┘     └────────┬─────────┘
                                  │                        │
                                  │    ┌───────────────────┘
                                  │    │
                                  ▼    ▼
                         ┌──────────────────┐
                         │   RoomLinkBed    │
                         ├──────────────────┤
                         │ id               │
                         │ name             │◄───── "Letto 1", "Letto 2"
                         │ roomId ──────────┤
                         │ bedId ───────────┤
                         │ langTrasn        │
                         └──────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRENOTAZIONI                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐
│         Basket           │◄──────────────────── PRENOTAZIONE PRINCIPALE
├──────────────────────────┤
│ id (PK)                  │
│ external_id (UUID)       │◄──────────────────── Usato negli URL
│ dayFrom / dayTo          │
│ name / surname / mail    │
│ phone / city / region    │
│ reservationType (bb/hb)  │
│ totalPrice               │
│ isPaid                   │
│ isCancelled              │
│ isCreatedByAdmin         │
│ stripeId / paymentIntentId│◄─────────────────── Stripe (legacy)
│ nexiOrderId / nexiOperationId│◄──────────────── Nexi
│ note                     │
└────────────┬─────────────┘
             │
             │ 1:N
             ▼
┌──────────────────────────┐
│    RoomReservation       │◄──────────────────── STANZA NELLA PRENOTAZIONE
├──────────────────────────┤
│ id (PK)                  │
│ basketId (FK)            │
│ bedBlockPriceTotal       │◄──────────────────── Costo blocco privacy
│ servicePriceTotal        │
└────────────┬─────────────┘
             │
             │ 1:N                        1:N
             ├──────────────────────────────┐
             │                              │
             ▼                              ▼
┌─────────────────────────┐    ┌───────────────────────────┐
│  RoomReservationSpec    │    │  ReservationLinkBedBlock  │
├─────────────────────────┤    ├───────────────────────────┤
│ id (PK)                 │    │ id (PK)                   │
│ roomReservationId (FK)  │    │ roomReservationId (FK)    │
│ roomLinkBedId (FK)      │    │ day                       │◄── Data specifica
│ guestDivisionId (FK)    │    │ roomLinkBedId[] (Array)   │◄── Letti bloccati
│ price                   │    │ bedBlockId (FK)           │
└─────────────────────────┘    └───────────────────────────┘
         │                                  │
         │                                  │
         ▼                                  ▼
┌─────────────────────────┐    ┌───────────────────────────┐
│    GuestDivision        │    │       BedBlock            │
├─────────────────────────┤    ├───────────────────────────┤
│ id                      │    │ id                        │
│ title (Adulti/Bambini)  │    │ description               │
│ ageFrom / ageTo         │    │ price                     │◄── Prezzo blocco
│ salePercent             │    └───────────────────────────┘
│ cityTax / cityTaxPrice  │
└─────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                              SERVIZI AGGIUNTIVI                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐         ┌──────────────────────────┐
│        Service           │◄────────│  ReservationLinkService  │
├──────────────────────────┤         ├──────────────────────────┤
│ id                       │         │ id                       │
│ description              │         │ roomReservationId (FK)   │
│ price                    │         │ serviceId (FK)           │
│ requestQuantity          │         │ quantity                 │
│ langTrasn                │         └──────────────────────────┘
└──────────────────────────┘
```

---

## Tabelle Principali

### `Basket` - Prenotazioni

La tabella centrale che contiene tutte le prenotazioni.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key (auto-increment) |
| `external_id` | `string` | UUID pubblico usato negli URL |
| `dayFrom` | `string` | Data check-in (ISO 8601) |
| `dayTo` | `string` | Data check-out (ISO 8601) |
| `name` | `string?` | Nome cliente |
| `surname` | `string?` | Cognome cliente |
| `mail` | `string?` | Email cliente |
| `phone` | `string?` | Telefono cliente |
| `city` | `string?` | Paese/Città cliente |
| `region` | `string?` | Regione (se italiano) |
| `reservationType` | `string` | `'bb'` (B&B) o `'hb'` (Mezza Pensione) |
| `totalPrice` | `number` | Prezzo totale (EUR) |
| `isPaid` | `boolean` | Pagamento completato |
| `isCancelled` | `boolean?` | Prenotazione cancellata |
| `isCancelledAtTime` | `string?` | Timestamp cancellazione |
| `cancellationReason` | `string?` | Motivo cancellazione |
| `isCreatedByAdmin` | `boolean` | Creata da admin (no pagamento) |
| `note` | `string?` | Note cliente |
| `stripeId` | `string?` | Stripe Session ID (legacy) |
| `paymentIntentId` | `string?` | Stripe PaymentIntent ID |
| `nexiOrderId` | `string?` | Nexi codTrans |
| `nexiOperationId` | `string?` | Nexi ID operazione |
| `nexiPaymentCircuit` | `string?` | Circuito pagamento Nexi |
| `nexiSecurityToken` | `string?` | Token sicurezza Nexi |
| `paymentConfirmationEmailSent` | `boolean?` | Email conferma inviata |
| `bubbleBasketId` | `string?` | ID legacy da Bubble.io |
| `booking_details` | `Json?` | Dettagli prenotazione (JSON) |
| `createdAt` | `string` | Timestamp creazione |
| `updatedAt` | `string` | Timestamp ultimo update |

**Indici consigliati**:
- `external_id` (UNIQUE)
- `dayFrom`, `dayTo` (per ricerche disponibilità)
- `isPaid`, `isCancelled` (per filtri)

---

### `Room` - Stanze

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `description` | `string` | Nome stanza ("Camera 1", "Dormitorio") |
| `bedCount` | `number` | Numero posti letto |
| `langTrasn` | `Json?` | Traduzioni multilingua |
| `order` | `number?` | Ordine visualizzazione |
| `createdAt` | `string` | Timestamp creazione |
| `updatedAt` | `string` | Timestamp ultimo update |

---

### `Bed` - Tipi di Letto

Definisce i tipi di letto con relativi prezzi.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `description` | `string` | Tipo letto ("Singolo", "Matrimoniale") |
| `priceBandB` | `number` | Prezzo B&B per notte |
| `priceMP` | `number` | Prezzo Mezza Pensione per notte |
| `peopleCount` | `number` | Capacità persone |
| `langTrasn` | `Json?` | Traduzioni multilingua |
| `createdAt` | `string` | Timestamp |
| `updatedAt` | `string` | Timestamp |

---

### `RoomLinkBed` - Letti nelle Stanze

Tabella ponte che collega stanze e tipi di letto, creando i singoli posti letto.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `name` | `string` | Nome letto ("Letto 1", "Letto 2") |
| `roomId` | `number` | FK → Room.id |
| `bedId` | `number` | FK → Bed.id |
| `langTrasn` | `Json?` | Traduzioni multilingua |
| `createdAt` | `string` | Timestamp |
| `updatedAt` | `string` | Timestamp |

**Relazioni**:
- `Room` → Stanza di appartenenza
- `Bed` → Tipo di letto (e relativi prezzi)

---

### `RoomReservation` - Stanze Prenotate

Collega una prenotazione (Basket) alle stanze.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `basketId` | `number?` | FK → Basket.id |
| `bedBlockPriceTotal` | `number` | Totale costo blocco privacy |
| `servicePriceTotal` | `number` | Totale servizi aggiuntivi |
| `createdAt` | `string` | Timestamp |
| `updatedAt` | `string` | Timestamp |

---

### `RoomReservationSpec` - Ospiti/Letti Prenotati

Dettaglio degli ospiti assegnati ai letti.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `roomReservationId` | `number` | FK → RoomReservation.id |
| `roomLinkBedId` | `number` | FK → RoomLinkBed.id |
| `guestDivisionId` | `number` | FK → GuestDivision.id |
| `price` | `number` | Prezzo per questo ospite |
| `createdAt` | `string` | Timestamp |
| `updatedAt` | `string` | Timestamp |

---

### `GuestDivision` - Categorie Ospiti

Definisce le categorie di ospiti con sconti e tasse.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `title` | `string` | Nome categoria ("Adulti", "Bambini", "Neonati") |
| `description` | `string` | Descrizione |
| `ageFrom` | `number` | Età minima |
| `ageTo` | `number` | Età massima |
| `salePercent` | `number` | Percentuale sconto (0-100) |
| `cityTax` | `boolean` | Soggetto a tassa soggiorno |
| `cityTaxPrice` | `number` | Importo tassa per notte |
| `langTrasn` | `Json?` | Traduzioni |
| `createdAt` | `string` | Timestamp |
| `updatedAt` | `string` | Timestamp |

**Valori tipici**:
```
Adulti:   ageFrom=13, ageTo=999, salePercent=0, cityTax=true, cityTaxPrice=2
Bambini:  ageFrom=2, ageTo=12, salePercent=50, cityTax=false
Neonati:  ageFrom=0, ageTo=1, salePercent=100, cityTax=false
```

---

### `ReservationLinkBedBlock` - Blocco Privacy Letti

Letti bloccati per privacy (extra a pagamento).

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `roomReservationId` | `number` | FK → RoomReservation.id |
| `day` | `string` | Data specifica (YYYY-MM-DD) |
| `roomLinkBedId` | `number[]?` | Array ID letti bloccati |
| `bedBlockId` | `number?` | FK → BedBlock.id |
| `createdAt` | `string` | Timestamp |
| `updatedAt` | `string` | Timestamp |

---

### `BedBlock` - Prezzi Blocco Letti

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `description` | `string` | Descrizione |
| `price` | `number` | Prezzo per letto bloccato per notte |
| `createdAt` | `string` | Timestamp |
| `updatedAt` | `string` | Timestamp |

---

### `Service` - Servizi Aggiuntivi

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `description` | `string` | Nome servizio ("Pranzo al sacco", etc.) |
| `price` | `number` | Prezzo unitario |
| `requestQuantity` | `boolean` | Richiede quantità |
| `langTrasn` | `Json?` | Traduzioni |
| `createdAt` | `string` | Timestamp |
| `updatedAt` | `string` | Timestamp |

---

### `ReservationLinkService` - Servizi Prenotati

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `roomReservationId` | `number` | FK → RoomReservation.id |
| `serviceId` | `number` | FK → Service.id |
| `quantity` | `number` | Quantità richiesta |
| `createdAt` | `string` | Timestamp |
| `updatedAt` | `string` | Timestamp |

---

## Tabelle di Supporto

### `BuildingRegistration` - Edifici

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `buildingName` | `string` | Nome edificio |
| `roomIds` | `number[]?` | Array ID stanze |
| `createdAt` | `string` | Timestamp |
| `updatedAt` | `string` | Timestamp |

---

### `RoomImage` - Immagini Stanze

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `roomId` | `number` | FK → Room.id |
| `url` | `string` | URL immagine |
| `createdAt` | `string` | Timestamp |
| `updatedAt` | `string` | Timestamp |

---

### `day_blocked` - Giorni Bloccati

Giorni in cui il rifugio è chiuso.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `day_blocked` | `string?` | Data bloccata (YYYY-MM-DD) |
| `created_at` | `string` | Timestamp |

---

### `booking_on_hold` - Prenotazioni in Attesa

Gestisce il blocco temporaneo letti durante la prenotazione.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `check_in` | `string?` | Data check-in |
| `check_out` | `string?` | Data check-out |
| `session_id` | `string?` | ID sessione browser |
| `still_on_hold` | `boolean?` | Ancora attivo |
| `time_is_up_at` | `string?` | Timestamp scadenza |
| `entered_payment` | `string?` | Timestamp inizio pagamento |
| `created_at` | `string` | Timestamp creazione |
| `updated_at` | `string?` | Timestamp update |

---

### `ReservationCancel` - Cancellazioni e Rimborsi

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `basketId` | `number?` | FK → Basket.id |
| `reason` | `string?` | Motivo cancellazione |
| `isRefunded` | `boolean?` | Rimborso effettuato |
| `refundAmount` | `number?` | Importo rimborsato |
| `refundId` | `string?` | ID rimborso (Stripe/Nexi) |
| `refundedStatus` | `string?` | Stato rimborso |
| `refundFailerReason` | `string?` | Motivo fallimento |
| `refundDateTime` | `string?` | Timestamp rimborso |
| `createdAt` | `string` | Timestamp |
| `updatedAt` | `string` | Timestamp |

---

## Tabelle di Sistema

### `AppSettings` - Impostazioni Applicazione

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `name` | `string?` | Nome impostazione |
| `value` | `string?` | Valore |
| `enabled` | `boolean?` | Abilitato |
| `note` | `string?` | Note |

---

### `sent_email_resend` - Log Email Inviate

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `to` | `string?` | Destinatario |
| `subject` | `string?` | Oggetto |
| `mail_body` | `string?` | Corpo email |
| `email_id` | `string?` | ID Resend |
| `status` | `string?` | Stato invio |
| `error_name` | `string?` | Nome errore |
| `error_message` | `string?` | Messaggio errore |
| `sent_time` | `string?` | Timestamp invio |
| `created_at` | `string` | Timestamp |

---

### `Stripe_log` - Log Stripe

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `stripe_id` | `string?` | ID Stripe |
| `transaction_type` | `string?` | Tipo transazione |
| `status` | `string?` | Stato |
| `date` | `string?` | Data |
| `meta` | `Json?` | Metadati |
| `solved` | `boolean?` | Risolto |
| `created_at` | `string` | Timestamp |

---

### `languages` - Lingue Supportate

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `code` | `string?` | Codice lingua (it, en, etc.) |
| `name` | `string?` | Nome lingua |
| `created_at` | `string` | Timestamp |

---

### `User` - Utenti Admin

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `email` | `string` | Email (login) |
| `password` | `string?` | Password hash |
| `name` | `string?` | Nome |
| `surname` | `string?` | Cognome |
| `token` | `string?` | Token sessione |
| `createdAt` | `string` | Timestamp |
| `updatedAt` | `string` | Timestamp |

---

### `TemplateData` - Template Email

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | `number` | Primary Key |
| `templateName` | `string?` | Nome template |
| `type` | `string?` | Tipo template |
| `htmlMarkUp` | `string?` | HTML template |
| `enabled` | `boolean?` | Abilitato |
| `createdAt` | `string` | Timestamp |
| `updatedAt` | `string` | Timestamp |

---

## Relazioni

### Diagramma Relazioni

```
Basket (1) ─────────────────────────────┬──────────────────────► ReservationCancel (1)
                                        │
                                        │ (1:N)
                                        ▼
                                 RoomReservation
                                        │
                    ┌───────────────────┼───────────────────┐
                    │ (1:N)             │ (1:N)             │ (1:N)
                    ▼                   ▼                   ▼
         RoomReservationSpec   ReservationLinkBedBlock  ReservationLinkService
                    │                   │                   │
                    │                   │                   │
                    ▼                   ▼                   ▼
              ┌─────┴─────┐       ┌─────┴─────┐          Service
              │           │       │           │
         RoomLinkBed   GuestDiv  RoomLinkBed  BedBlock
              │
              │
        ┌─────┴─────┐
        │           │
       Room        Bed
```

### Foreign Keys

```sql
-- RoomLinkBed
ALTER TABLE "RoomLinkBed" ADD CONSTRAINT "RoomLinkBed_roomId_fkey" 
  FOREIGN KEY ("roomId") REFERENCES "Room"("id");
ALTER TABLE "RoomLinkBed" ADD CONSTRAINT "RoomLinkBed_bedId_fkey" 
  FOREIGN KEY ("bedId") REFERENCES "Bed"("id");

-- RoomReservation
ALTER TABLE "RoomReservation" ADD CONSTRAINT "RoomReservation_basketId_fkey" 
  FOREIGN KEY ("basketId") REFERENCES "Basket"("id");

-- RoomReservationSpec
ALTER TABLE "RoomReservationSpec" ADD CONSTRAINT "RoomReservationSpec_roomReservationId_fkey" 
  FOREIGN KEY ("roomReservationId") REFERENCES "RoomReservation"("id");
ALTER TABLE "RoomReservationSpec" ADD CONSTRAINT "RoomReservationSpec_roomLinkBedId_fkey" 
  FOREIGN KEY ("roomLinkBedId") REFERENCES "RoomLinkBed"("id");
ALTER TABLE "RoomReservationSpec" ADD CONSTRAINT "RoomReservationSpec_guestDivisionId_fkey" 
  FOREIGN KEY ("guestDivisionId") REFERENCES "GuestDivision"("id");

-- ReservationLinkBedBlock
ALTER TABLE "ReservationLinkBedBlock" ADD CONSTRAINT "ReservationLinkBedBlock_roomReservationId_fkey" 
  FOREIGN KEY ("roomReservationId") REFERENCES "RoomReservation"("id");
ALTER TABLE "ReservationLinkBedBlock" ADD CONSTRAINT "ReservationLinkBedBlock_bedBlockId_fkey" 
  FOREIGN KEY ("bedBlockId") REFERENCES "BedBlock"("id");

-- ReservationLinkService
ALTER TABLE "ReservationLinkService" ADD CONSTRAINT "ReservationLinkService_roomReservationId_fkey" 
  FOREIGN KEY ("roomReservationId") REFERENCES "RoomReservation"("id");
ALTER TABLE "ReservationLinkService" ADD CONSTRAINT "ReservationLinkService_serviceId_fkey" 
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id");

-- ReservationCancel
ALTER TABLE "ReservationCancel" ADD CONSTRAINT "ReservationCancel_basketId_fkey" 
  FOREIGN KEY ("basketId") REFERENCES "Basket"("id");

-- RoomImage
ALTER TABLE "RoomImage" ADD CONSTRAINT "RoomImage_roomId_fkey" 
  FOREIGN KEY ("roomId") REFERENCES "Room"("id");
```

---

## Query Comuni

### Ricerca Disponibilità Letti

```typescript
// Trova tutti i letti con info stanza e prezzi
const { data: beds } = await supabase
  .from('RoomLinkBed')
  .select(`
    id,
    name,
    roomId,
    bedId,
    Bed (
      id,
      priceBandB,
      priceMP,
      peopleCount
    ),
    Room (
      id,
      description,
      createdAt,
      RoomImage (
        id,
        url
      )
    )
  `);
```

### Trova Prenotazioni Sovrapposte

```typescript
// Trova prenotazioni che si sovrappongono a un periodo
const { data: reservations } = await supabase
  .from('Basket')
  .select(`
    id,
    dayFrom,
    dayTo,
    RoomReservation (
      id,
      RoomReservationSpec (
        id,
        roomLinkBedId
      ),
      ReservationLinkBedBlock (
        id,
        day,
        roomLinkBedId
      )
    )
  `)
  .lt('dayFrom', checkOut)     // dayFrom < checkOut
  .gt('dayTo', checkIn)         // dayTo > checkIn
  .eq('isCancelled', false);
```

### Dettagli Completi Prenotazione

```typescript
const { data: booking } = await supabase
  .from('Basket')
  .select(`
    *,
    RoomReservation (
      id,
      bedBlockPriceTotal,
      servicePriceTotal,
      RoomReservationSpec (
        id,
        price,
        RoomLinkBed (
          id,
          name,
          Room (
            id,
            description
          )
        ),
        GuestDivision (
          id,
          title,
          cityTaxPrice
        )
      ),
      ReservationLinkBedBlock (
        id,
        day,
        roomLinkBedId
      ),
      ReservationLinkService (
        id,
        quantity,
        Service (
          id,
          description,
          price
        )
      )
    )
  `)
  .eq('external_id', externalId)
  .single();
```

### Prenotazioni per un Giorno

```typescript
// Trova tutte le prenotazioni attive per una data specifica
const { data: reservations } = await supabase
  .from('Basket')
  .select(`
    id,
    name,
    surname,
    dayFrom,
    dayTo,
    reservationType,
    RoomReservation (
      RoomReservationSpec (
        RoomLinkBed (
          name,
          Room (
            description
          )
        ),
        GuestDivision (
          title
        )
      )
    )
  `)
  .lte('dayFrom', targetDate)  // check-in <= targetDate
  .gt('dayTo', targetDate)      // check-out > targetDate
  .eq('isCancelled', false)
  .eq('isPaid', true);
```

### Booking Hold Attivi

```typescript
// Trova booking hold ancora validi
const { data: holds } = await supabase
  .from('booking_on_hold')
  .select('*')
  .lt('check_in', checkOut)
  .gt('check_out', checkIn)
  .eq('still_on_hold', true);
```

---

## Note Implementative

### Campo `langTrasn`

Molte tabelle hanno un campo `langTrasn` di tipo JSON per le traduzioni:

```json
{
  "en": "Single bed",
  "de": "Einzelbett",
  "fr": "Lit simple",
  "es": "Cama individual"
}
```

### Campo `booking_details` in Basket

Contiene un JSON con il dettaglio completo della prenotazione al momento della creazione, utile per debugging e storico:

```json
{
  "rooms": [...],
  "guests": [...],
  "services": [...],
  "blockedBeds": {...}
}
```

### Soft Delete

Le prenotazioni usano soft delete tramite `isCancelled = true` invece di eliminazione fisica.

### Timezone

Tutte le date sono salvate in formato ISO 8601 UTC. La conversione a timezone locale avviene nel frontend.


