// src/app/admin_power/stanze/types.ts
// Questo file contiene tutte le definizioni dei tipi per l'applicazione

// Interfaccia per le lingue supportate
export interface Language {
  id: number;
  created_at: string;
  code: string;
  name: string;
}

// Interfaccia per le traduzioni in lingua
export interface LanguageTranslation {
  [key: string]: string; // Solo index signature per supportare chiavi dinamiche
}

// Interfaccia per i letti
export interface Bed {
  id: number;
  description: string;
  priceMP: number;
  priceBandB: number;
  peopleCount: number;
  langTrasn: LanguageTranslation[];
  createdAt: string;
  updatedAt: string;
}

// Interfaccia per le camere
export interface Room {
  id: number;
  description: string;
  bedCount: number;
  langTrasn: LanguageTranslation[];
  createdAt: string;
  updatedAt: string;
}

// Interfaccia per il collegamento tra camere e letti
export interface RoomLinkBed {
  id: number;
  roomId: number;
  bedId: number;
  name: string;
  langTrasn: LanguageTranslation[];
  createdAt: string;
  updatedAt: string;
  // Proprietà opzionali per le relazioni
  Room?: Room;
  Bed?: Bed;
}

// Interfaccia per gli edifici
export interface Building {
  id: number;
  buildingName: string;
  roomIds: number[];
  createdAt: string;
  updatedAt: string;
}

// Interfaccia per i servizi
export interface Service {
  id: number;
  description: string;
  price: number;
  requestQuantity: boolean;
  langTrasn: LanguageTranslation[];
  createdAt: string;
  updatedAt: string;
}

// Interfaccia per le divisioni degli ospiti
export interface GuestDivision {
  id: number;
  description: string;
  title: string;
  ageFrom: number;
  ageTo: number;
  salePercent: number;
  cityTax: boolean;
  cityTaxPrice: number;
  langTrasn: LanguageTranslation[];
  createdAt: string;
  updatedAt: string;
}

// Interfaccia per i blocchi letto
export interface BedBlock {
  id: number;
  description: string;
  price: number;
  createdAt: string;
  updatedAt: string;
}

// Tipo per identificare il nome della tabella corrente
export type EntityType =
  | "Bed"
  | "Room"
  | "BuildingRegistration"
  | "Service"
  | "GuestDivision"
  | "BedBlock"
  | "RoomLinkBed";

// Tipi per form (opzionali, rendono il codice più pulito nei componenti)
export type BedFormType = Omit<Bed, "id" | "createdAt" | "updatedAt">;
export type RoomFormType = Omit<Room, "id" | "createdAt" | "updatedAt">;
export type BuildingFormType = Omit<Building, "id" | "createdAt" | "updatedAt">;
export type ServiceFormType = Omit<Service, "id" | "createdAt" | "updatedAt">;
export type GuestDivisionFormType = Omit<
  GuestDivision,
  "id" | "createdAt" | "updatedAt"
>;
export type BedBlockFormType = Omit<BedBlock, "id" | "createdAt" | "updatedAt">;
export type RoomLinkBedFormType = Omit<
  RoomLinkBed,
  "id" | "createdAt" | "updatedAt"
>;

// Interfaccia per le immagini delle stanze
export interface RoomImage {
  id: number;
  url: string;
  roomId: number;
  displayOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

// Interfaccia per gli eventi del calendario
export interface CalendarDay {
  date: string;
  isBlocked: boolean;
}

// Interfaccia per le prenotazioni
export interface Reservation {
  id: number;
  dayFrom: string;
  dayTo: string;
  name: string;
  surname: string;
  guestCount: number;
  guestName?: string;
  checkIn: string;
  checkOut: string;
  rooms: {
    id: number;
    description: string;
  }[];
  RoomReservation: {
    id: number;
    RoomReservationSpec: {
      id: number;
      RoomLinkBed: {
        id: number;
        name: string;
        Room: {
          id: number;
          description: string;
        };
      };
    }[];
  }[];
}
