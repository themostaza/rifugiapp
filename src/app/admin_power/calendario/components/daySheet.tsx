'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Lock, Unlock, Calendar, Users, ExternalLink } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { toggleBlockDay } from "@/utils/blockDays"

interface Reservation {
  id: number;
  dayFrom: string;
  dayTo: string;
  name: string;
  surname: string;
  checkIn?: string;
  checkOut?: string;
  mail?: string;
  phone?: string;
  city?: string;
  region?: string;
  reservationType?: string;
  totalPrice?: number;
  isPaid?: boolean;
  note?: string;
  isCreatedByAdmin?: boolean;
  stripeId?: string;
  paymentIntentId?: string;
  external_id?: string;
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
  guestCount?: number;
}

interface DaySheetProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  reservations: Reservation[];
  isBlocked: boolean;
  onDayBlockToggle: () => void;
}

const DaySheet = ({ isOpen, onClose, date, reservations, isBlocked, onDayBlockToggle }: DaySheetProps) => {
    console.log('========================');
    console.log(`DaySheet per ${date.toLocaleDateString()} - Numero di prenotazioni ricevute: ${reservations.length}`);
    
    // Aggiungo un log per le RoomReservation per fare debugging
    reservations.forEach(res => {
      console.log(`\n[DAYSHEET] Prenotazione #${res.id}: ${res.name} ${res.surname}`);
      console.log(`[DAYSHEET] Dati completi:`, {
        id: res.id,
        name: res.name,
        surname: res.surname,
        guestCount: res.guestCount, // Verifichiamo se il guestCount è definito nei dati
        hasRoomReservation: !!res.RoomReservation,
        roomReservationCount: res.RoomReservation?.length || 0
      });
      
      if (!res.RoomReservation || res.RoomReservation.length === 0) {
        console.warn(`[DAYSHEET] ATTENZIONE: Prenotazione #${res.id} non ha RoomReservation associate!`);
        return;
      }
      
      console.log(`[DAYSHEET] ${res.RoomReservation.length} RoomReservation trovate:`);
      
      let totalSpecCount = 0;
      res.RoomReservation.forEach(rr => {
        const specCount = rr.RoomReservationSpec?.length || 0;
        totalSpecCount += specCount;
        
        console.log(`  - RoomReservation #${rr.id}: ${specCount} RoomReservationSpec`);
        
        if (rr.RoomReservationSpec && rr.RoomReservationSpec.length > 0) {
          rr.RoomReservationSpec.forEach(spec => {
            const bedInfo = spec.RoomLinkBed ? `letto: ${spec.RoomLinkBed.name || 'N/A'} in stanza: ${spec.RoomLinkBed.Room?.description || 'N/A'}` : 'info letto non disponibile';
            console.log(`    * Spec #${spec.id}: ${bedInfo}`);
          });
        }
      });
      
      console.log(`[DAYSHEET] TOTALE: Prenotazione #${res.id} ha ${totalSpecCount} ospiti (posti letto)`);
    });
  
  const [isLoading, setIsLoading] = useState(false);
  const [blockState, setBlockState] = useState(isBlocked);
  
  // Sincronizza lo stato quando cambia la prop isBlocked
  useEffect(() => {
    setBlockState(isBlocked);
  }, [isBlocked]);

  const monthsShort = [
    "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
    "Lug", "Ago", "Set", "Ott", "Nov", "Dic"
  ];

  const handleBlockToggle = async () => {
    setIsLoading(true);
    try {
      // Verifico lo stato attuale del blocco dal database, non fidandomi solo della prop
      const currentBlockState = blockState;
      
      const success = await toggleBlockDay(date, currentBlockState, {
        onSuccess: () => {
          // Aggiorno lo stato locale
          setBlockState(!currentBlockState);
          // Notifica il componente padre
          onDayBlockToggle();
        }
      });
      
      if (!success) {
        console.error('Impossibile modificare lo stato del blocco');
      }
    } catch (error) {
      console.error('Error toggling day block:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calcolo ospiti basato sul numero di RoomReservationSpec
  const calculateTotalGuests = (reservations: Reservation[]): number => {
    // Prima verifichiamo se i dati delle prenotazioni includono già il guestCount calcolato dall'API
    let sumFromDirectGuestCount = 0;
    let anyReservationHasDirectGuestCount = false;
    
    reservations.forEach(res => {
      if (res.guestCount !== undefined) {
        anyReservationHasDirectGuestCount = true;
        sumFromDirectGuestCount += res.guestCount;
      }
    });
    
    // Se abbiamo guestCount direttamente dalle prenotazioni, lo usiamo
    if (anyReservationHasDirectGuestCount) {
      console.log(`[DAYSHEET] Usando guestCount già calcolato dall'API: ${sumFromDirectGuestCount} ospiti`);
      return sumFromDirectGuestCount;
    }
    
    // Altrimenti usiamo il calcolo manuale
    console.log(`[DAYSHEET] guestCount non disponibile nei dati, eseguendo calcolo manuale`);
    
    // Mappa di controllo per tenere traccia dei posti letto contati
    const countedBeds = new Set<string>();
    let totalGuestCount = 0;
    
    // Per ogni basket (prenotazione)
    reservations.forEach(reservation => {
      let reservationGuestCount = 0;
      
      // Per ogni RoomReservation associata al basket
      reservation.RoomReservation?.forEach(roomRes => {
        // Per ogni RoomReservationSpec (= un posto letto)
        roomRes.RoomReservationSpec?.forEach(spec => {
          // Creiamo un ID univoco per questo letto in questa prenotazione
          const bedKey = `${reservation.id}-${roomRes.id}-${spec.id}`;
          
          // Contiamo questo posto letto solo se non l'abbiamo già contato
          if (!countedBeds.has(bedKey)) {
            countedBeds.add(bedKey);
            reservationGuestCount++;
          }
        });
      });
      
      console.log(`[Prenotazione #${reservation.id}] ${reservation.name} ${reservation.surname}: ${reservationGuestCount} ospiti`);
      totalGuestCount += reservationGuestCount;
    });
    
    console.log(`Numero totale di ospiti (calcolo manuale): ${totalGuestCount}`);
    return totalGuestCount;
  };

  const totalGuests = calculateTotalGuests(reservations);
  
  
  // Format date to display in a human-readable format
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return `${date.getDate()} ${monthsShort[date.getMonth()]} ${date.getFullYear()}`;
  };
  
  // Format price to display with Euro symbol
  const formatPrice = (price: number | undefined) => {
    if (price === undefined) return "N/A";
    return `${price.toFixed(2)} €`;
  };

  // Funzione per calcolare il numero di ospiti per una singola prenotazione
  const calculateGuestsForReservation = (reservation: Reservation): number => {
    // Verifichiamo prima se il guestCount è già disponibile dal server
    if (reservation.guestCount !== undefined) {
      return reservation.guestCount;
    }
    
    // Altrimenti, contiamo ogni RoomReservationSpec come un ospite
    return reservation.RoomReservation?.reduce(
      (total, roomRes) => total + (roomRes.RoomReservationSpec?.length || 0), 
      0
    ) || 0;
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="right" 
        className="!w-[80vw] !max-w-[1000px] !sm:max-w-[80vw] overflow-y-auto"
      >
        <SheetHeader className="mb-6">
          <SheetTitle>
            <span>
              {date.getDate()} {monthsShort[date.getMonth()]} {date.getFullYear()}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleBlockToggle}
              disabled={isLoading}
              variant={blockState ? "destructive" : "outline"}
              className="w-fit whitespace-nowrap self-start"
            >
              {blockState ? (
                <><Unlock className="w-4 h-4 mr-2" /> Sblocca giorno</>
              ) : (
                <><Lock className="w-4 h-4 mr-2" /> Blocca giorno</>
              )}
            </Button>
            
            <div className="w-fit px-4 py-2 bg-gray-100 rounded flex items-center gap-2">
              <span className="font-semibold">Totale ospiti attesi:</span>
              <span className="font-bold">{totalGuests}</span>
            </div>
          </div>
          
          {reservations.length > 0 && (
            <div className="mb-4">
              <h3 className="text-lg font-medium mb-2">Prenotazioni</h3>
              <div className="space-y-4">
                {reservations.map(reservation => {
                  const isPaid = reservation.isPaid ?? false;
                  const isAdmin = reservation.isCreatedByAdmin ?? false;
                  const paymentWarning = !isPaid && !isAdmin;
                  
                  return (
                  <div key={reservation.id} className="bg-gray-50 p-4 rounded-md border border-gray-200">
                    {/* Header with payment status and view button */}
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">#{reservation.id}</span>
                        <span className="font-semibold">
                          {reservation.name} {reservation.surname}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin ? (
                          <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                            Creata da Admin
                          </span>
                        ) : isPaid ? (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                            Pagata
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                            Non Pagata
                          </span>
                        )}
                        
                        {reservation.external_id && (
                          <Link href={`/cart/${reservation.external_id}`} target="_blank" passHref>
                            <Button variant="outline" size="sm" className="h-8">
                              <ExternalLink className="w-4 h-4 mr-1" /> Vedi Carrello
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                    
                    {/* Payment warning */}
                    {paymentWarning && (
                      <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded mb-3 text-sm flex items-start gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                          <line x1="12" y1="9" x2="12" y2="13"></line>
                          <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span>Prenotazione non pagata!</span>
                      </div>
                    )}
                    
                    {/* Dates */}
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Check-in: {formatDate(reservation.dayFrom || reservation.checkIn)} - Check-out: {formatDate(reservation.dayTo || reservation.checkOut)}
                      </span>
                    </div>
                    
                    {/* Guest count */}
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                      <Users className="h-4 w-4" />
                      <span>
                        {calculateGuestsForReservation(reservation)} ospiti
                      </span>
                    </div>
                    
                    {/* Reservation type & price */}
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="text-sm">
                        <span className="block text-gray-500">Tipo:</span>
                        <span className="font-medium">{reservation.reservationType || 'N/A'}</span>
                      </div>
                      <div className="text-sm">
                        <span className="block text-gray-500">Prezzo totale:</span>
                        <span className="font-medium">{formatPrice(reservation.totalPrice)}</span>
                      </div>
                    </div>
                    
                    {/* Contact info */}
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="text-sm">
                        <span className="block text-gray-500">Email:</span>
                        <span className="font-medium truncate">{reservation.mail || 'N/A'}</span>
                      </div>
                      <div className="text-sm">
                        <span className="block text-gray-500">Telefono:</span>
                        <span className="font-medium">{reservation.phone || 'N/A'}</span>
                      </div>
                    </div>
                    
                    {/* Location */}
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="text-sm">
                        <span className="block text-gray-500">Stato:</span>
                        <span className="font-medium">{reservation.city || 'N/A'}</span>
                      </div>
                      <div className="text-sm">
                        <span className="block text-gray-500">Regione:</span>
                        <span className="font-medium">{reservation.region || 'N/A'}</span>
                      </div>
                    </div>
                    
                    {/* Notes if available */}
                    {reservation.note && (
                      <div className="mt-3 text-sm">
                        <span className="block text-gray-500">Note:</span>
                        <p className="bg-white p-2 rounded border border-gray-100 mt-1">{reservation.note}</p>
                      </div>
                    )}
                    
                    {/* Payment details if available */}
                    {(reservation.stripeId || reservation.paymentIntentId) && (
                      <div className="mt-3 space-y-2 text-sm text-gray-500">
                        {reservation.stripeId && (
                          <div className="flex flex-wrap items-center">
                            <span className="mr-2">Stripe ID:</span>
                            <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded truncate max-w-full">{reservation.stripeId}</span>
                          </div>
                        )}
                        {reservation.paymentIntentId && (
                          <div className="flex flex-wrap items-center">
                            <span className="mr-2">Payment Intent:</span>
                            <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded truncate max-w-full">{reservation.paymentIntentId}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )})}
              </div>
            </div>
          )}

          {reservations.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              Nessuna prenotazione per questa data
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DaySheet;