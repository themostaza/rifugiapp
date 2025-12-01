# 🏔️ Rifugio Dibona - Sistema di Prenotazione

Sistema di prenotazione online per il **Rifugio Angelo Dibona**, rifugio alpino situato a 2083m s.l.m. a Cortina d'Ampezzo (BL).

> ⚠️ **Nota**: Questo progetto è stato migrato da Bubble.io a Next.js. Alcune logiche legacy potrebbero essere presenti per retrocompatibilità.

## 📋 Indice

- [Stack Tecnologico](#-stack-tecnologico)
- [Quick Start](#-quick-start)
- [Variabili d'Ambiente](#-variabili-dambiente)
- [Architettura](#-architettura)
- [Funzionalità Principali](#-funzionalità-principali)
- [Documentazione Dettagliata](#-documentazione-dettagliata)

---

## 🛠️ Stack Tecnologico

| Categoria | Tecnologia |
|-----------|------------|
| **Framework** | Next.js 15 (App Router, Turbopack) |
| **Frontend** | React 19, Tailwind CSS, Radix UI |
| **Database** | Supabase (PostgreSQL) |
| **Autenticazione** | Supabase Auth |
| **Pagamenti** | Nexi XPay (primario), Stripe (legacy/backup) |
| **Email** | Resend |
| **PDF** | @react-pdf/renderer, jspdf |
| **Hosting** | Vercel |
| **Internazionalizzazione** | 5 lingue (IT, EN, FR, DE, ES) |

---

## 🚀 Quick Start

### Prerequisiti

- Node.js 18+
- npm/yarn/pnpm
- Account Supabase
- Account Nexi XPay (o Stripe per testing)
- Account Resend

### Installazione

```bash
# Clona il repository
git clone <repository-url>
cd prenotazioni-rifugiodibona

# Installa le dipendenze
npm install

# Copia il file di configurazione
cp .env.example .env.local

# Configura le variabili d'ambiente (vedi sezione successiva)

# Avvia in development
npm run dev
```

L'applicazione sarà disponibile su `http://localhost:3000`

### Build di Produzione

```bash
npm run build
npm run start
```

---

## 🔐 Variabili d'Ambiente

Crea un file `.env.local` con le seguenti variabili:

```env
# ============================================================================
# SUPABASE
# ============================================================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ============================================================================
# PAGAMENTI - Nexi (Provider Primario)
# ============================================================================
PAYMENT_PROVIDER=nexi                    # 'nexi' | 'stripe'
NEXT_PUBLIC_PAYMENT_PROVIDER=nexi
NEXI_API_KEY=your-nexi-api-key
NEXI_TERMINAL_ID=your-terminal-id
NEXI_ENVIRONMENT=sandbox                 # 'sandbox' | 'production'
NEXI_WEBHOOK_SECRET=optional-webhook-secret

# ============================================================================
# PAGAMENTI - Stripe (Legacy/Backup)
# ============================================================================
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# ============================================================================
# EMAIL (Resend)
# ============================================================================
RESEND=re_xxx

# ============================================================================
# APP CONFIG
# ============================================================================
NEXT_PUBLIC_BASE_URL=https://your-domain.vercel.app
NODE_ENV=development

# ============================================================================
# CRON JOBS (Vercel)
# ============================================================================
CRON_SECRET=your-secure-random-string

# ============================================================================
# MAINTENANCE MODE (Opzionale)
# ============================================================================
MAINTENANCE_MODE=false
MAINTENANCE_PASSWORD=your-password
MAINTENANCE_BYPASS_TOKEN=your-bypass-token
```

---

## 🏗️ Architettura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐│
│  │  Booking    │  │   Cart &    │  │ Confirmation│  │   Admin Panel       ││
│  │   Flow      │  │  Checkout   │  │    Page     │  │  (/admin_power)     ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘│
└────────────────────────────────────────┬────────────────────────────────────┘
                                         │
┌────────────────────────────────────────┼────────────────────────────────────┐
│                              API ROUTES                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ /search  │ │/booking- │ │ /create- │ │ /cancel- │ │ /webhooks│          │
│  │          │ │  hold    │ │ booking  │ │ booking  │ │  /nexi   │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└────────────────────────────────────────┬────────────────────────────────────┘
                                         │
     ┌───────────────────────────────────┼───────────────────────────────────┐
     │                                   │                                   │
     ▼                                   ▼                                   ▼
┌─────────────┐                   ┌─────────────┐                   ┌─────────────┐
│  SUPABASE   │                   │    NEXI     │                   │   RESEND    │
│  (Database) │                   │  (Payments) │                   │   (Email)   │
└─────────────┘                   └─────────────┘                   └─────────────┘
```

### Struttura Cartelle

```
src/
├── app/
│   ├── [locale]/              # Pagine localizzate (IT, EN, FR, DE, ES)
│   │   ├── page.tsx           # Homepage + Booking flow
│   │   └── cart/[id]/         # Pagina conferma prenotazione
│   ├── admin_power/           # Area amministratore
│   │   ├── calendario/        # Calendario prenotazioni
│   │   ├── stanze/            # Gestione stanze/letti
│   │   ├── impostazioni/      # Impostazioni
│   │   └── report/            # Report
│   ├── api/                   # API Routes
│   │   ├── search/            # Ricerca disponibilità
│   │   ├── booking-hold/      # Blocco temporaneo letti
│   │   ├── create-booking/    # Creazione prenotazione
│   │   ├── cancel-booking/    # Cancellazione
│   │   ├── webhooks/nexi/     # Webhook pagamenti Nexi
│   │   ├── daily-email/       # Email giornaliera (cron)
│   │   └── cron/              # Altri cron jobs
│   ├── components/            # Componenti specifici app
│   └── utils/                 # Utilities (pricing, dates)
├── components/
│   ├── ui/                    # Componenti UI (shadcn/ui)
│   ├── header/
│   └── footer/
├── lib/
│   ├── payment/               # Modulo pagamenti (Nexi/Stripe)
│   └── supabase.ts            # Client Supabase
├── i18n/                      # Configurazione internazionalizzazione
├── utils/
│   ├── database.ts            # Tipi TypeScript database
│   └── emailService.ts        # Servizio email
└── middleware.ts              # Middleware (auth, redirect, i18n)
```

---

## ✨ Funzionalità Principali

### 👤 Lato Utente

1. **Ricerca Disponibilità**
   - Selezione date check-in/check-out
   - Numero ospiti (Adulti 13+, Bambini 2-12, Neonati 0-2)
   - Verifica disponibilità real-time

2. **Selezione Alloggio**
   - Visualizzazione stanze disponibili
   - Mappa letti con stato (libero/occupato)
   - Due tipi di pernottamento: B&B e Mezza Pensione
   - Blocco letti per privacy (extra)

3. **Checkout**
   - Servizi aggiuntivi
   - Tassa di soggiorno automatica
   - Pagamento online (Nexi)
   - Timer 15 minuti per completare

4. **Post-Prenotazione**
   - Pagina conferma con dettagli
   - PDF scaricabile
   - Email di conferma
   - Cancellazione con politica rimborsi

### 🔧 Lato Admin (`/admin_power`)

- **Calendario**: Vista mensile prenotazioni
- **Dettaglio Giorno**: Foglio giornaliero, arrivi/partenze
- **Gestione Stanze**: Edifici, stanze, letti, prezzi
- **Servizi**: Gestione servizi aggiuntivi
- **Sconti Ospiti**: Categorie età e sconti
- **Blocco Giorni**: Chiusura date specifiche
- **Report**: Statistiche prenotazioni
- **Prenotazioni Manuali**: Creazione da admin

### ⏰ Cron Jobs (Vercel)

| Job | Schedule | Descrizione |
|-----|----------|-------------|
| `daily-email` | 03:00 | Email riepilogativa con PDF allegato |
| `stripe-sync` | 02:00 | Sincronizzazione pagamenti Stripe |
| `cleanup-expired-bookings` | */15 min | Cancella prenotazioni non pagate dopo 30 min |

---

## 📚 Documentazione Dettagliata

- [📐 Architettura](docs/ARCHITECTURE.md) - Struttura dettagliata e flussi
- [🗄️ Database](docs/DATABASE.md) - Schema e relazioni
- [🔌 API](docs/API.md) - Documentazione endpoints

---

## 🔄 Flusso di Prenotazione

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   RICERCA    │────▶│   BOOKING    │────▶│   CHECKOUT   │────▶│   CONFERMA   │
│              │     │    HOLD      │     │              │     │              │
│ • Date       │     │ • 15 min     │     │ • Dati       │     │ • PDF        │
│ • Ospiti     │     │ • Letti      │     │ • Pagamento  │     │ • Email      │
│ • Disponib.  │     │   bloccati   │     │ • Nexi       │     │ • Link       │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Meccanismo Booking Hold

Quando un utente cerca disponibilità e procede alla selezione:

1. Viene creato un record in `booking_on_hold`
2. I letti selezionati sono "bloccati" per 15 minuti
3. Altri utenti vedono quei letti come non disponibili
4. Un Service Worker invia heartbeat per mantenere il blocco attivo
5. Se il pagamento non viene completato, il blocco scade automaticamente
6. Il cron job `cleanup-expired-bookings` pulisce le prenotazioni scadute

---

## 💳 Sistema Pagamenti

Il sistema supporta due provider di pagamento, switchabili via variabile d'ambiente:

```env
PAYMENT_PROVIDER=nexi   # Provider attivo: 'nexi' | 'stripe'
```

### Nexi XPay (Primario)
- Integrazione XPay con form redirect
- Webhook per conferma pagamento
- Supporto rimborsi parziali/totali

### Stripe (Legacy/Backup)
- Checkout Session
- Webhook per eventi
- Mantenuto per eventuale rollback

> **Nota**: A Dicembre 2025 è stato completato il passaggio a Nexi. Stripe resta disponibile come backup.

---

## 🌍 Internazionalizzazione

Lingue supportate:
- 🇮🇹 Italiano (default)
- 🇬🇧 English
- 🇫🇷 Français
- 🇩🇪 Deutsch
- 🇪🇸 Español

I file di traduzione sono in `/messages/{lang}.json`

---

## 🐛 Note per gli Sviluppatori

### Legacy da Bubble.io

Il progetto è stato migrato da Bubble.io. Alcune considerazioni:

1. **Campo `bubbleBasketId`**: Presente per retrocompatibilità con vecchi link
2. **Redirect `/reservation_summary`**: Gestisce vecchi link Bubble
3. **Alcune strutture dati**: Potrebbero essere ottimizzabili per Next.js

### Politica di Rimborso

```
> 7 giorni prima: 100% rimborso
3-7 giorni prima: 70% rimborso
< 3 giorni: Nessun rimborso
```

---

## 📞 Contatti Rifugio

- **Telefono**: +39 0436 860294 / +39 333 143 4408
- **Email**: rifugiodibona@gmail.com
- **Indirizzo**: Località Val Ampezzo - 32043 Cortina d'Ampezzo (BL)
- **Altitudine**: 2083m s.l.m.

---

## 📝 License

Progetto privato - Tutti i diritti riservati.
