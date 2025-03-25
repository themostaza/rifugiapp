'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Calendar, ChevronDown, Users, Plus, Minus, Search, ShoppingCart } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import RoomContent from './components/roomcontent'
import Cart from './components/cart'
import Footer from '@/components/footer/footer'
import Header from '@/components/header/header'
// Import the pricing utility functions
import { 
  calculateRoomBedsPrice, 
  calculateCartTotal,
  formatRoomForCart
} from '@/app/utils/pricing';
import CheckoutPage from './components/checkout/checkout'


// Types
interface Guest {
  type: 'adult' | 'child' | 'infant';
  roomId: number | null;
  bedId: string | null;
}

interface RoomCartItem {
  name: string;
  guests: string;
  beds: Array<{description: string, price: number}>;
  privacy: number;
}

interface Room {
  roomId: number;
  description: string;
  images: string[];
  allBeds: {
    id: number;
    name: string;
    pricing?: {
      bb: number;
      mp: number;
    };
  }[];
  availableBeds: {
    id: number;
    name: string;
    pricing?: {
      bb: number;
      mp: number;
    };
  }[];
}

interface GuestType {
  id: number;
  description: string;
  ageFrom: number;
  ageTo: number;
  salePercent: number;
  createdAt: string;
  updatedAt: string;
  title: string;
  cityTax: boolean;
  cityTaxPrice: number;
  langTrasn?: string
}

interface SearchResponse {
  status?: string;
  rooms?: Room[];
  available?: boolean;
  reason?: 'BLOCKED_DAYS' | 'BOOKING_IN_PROGRESS';
  blockedDays?: string[];
  availabilityByNight?: Array<{
    date: string;
    rooms: Array<{
      roomId: number;
      description: string;
      allBeds: Array<{
        id: number;
        name: string;
        isAvailable: boolean;
      }>;
      availableBeds: Array<{
        id: number;
        name: string;
      }>;
    }>;
  }>;
  guestTypes?: GuestType[];
}

interface RoomListProps {
  rooms: Room[];
  onSelect: (roomId: number) => void;
  totalGuests: {
    adults: number;
    children: number;
    infants: number;
  };
  assignedGuests: Guest[];
  onGuestAssignment: (guests: Guest[]) => void;
  onPrivacyCostChange?: (roomId: number, cost: number) => void;
  pensionType: 'bb' | 'hb';
  checkIn?: Date;
  checkOut?: Date;
  availabilityByNight?: SearchResponse['availabilityByNight'];
  guestTypes: Array<{
    id: number;
    description: string;
    ageFrom: number;
    ageTo: number;
    salePercent: number;
    title: string;
    cityTax: boolean;
    cityTaxPrice: number;
  }>;
  onProceedToCheckout: () => void;
}

const RoomList: React.FC<RoomListProps> = ({ 
  rooms,
  onSelect, 
  totalGuests, 
  assignedGuests,
  onGuestAssignment,
  pensionType,
  checkIn,
  checkOut,
  availabilityByNight,
  guestTypes,
  onPrivacyCostChange,
  onProceedToCheckout 
}) => {
  

  const getUnassignedGuests = () => {
    const assigned = {
      adults: assignedGuests.filter(g => g.type === 'adult').length,
      children: assignedGuests.filter(g => g.type === 'child').length,
      infants: assignedGuests.filter(g => g.type === 'infant').length
    };


    return {
      adults: totalGuests.adults - assigned.adults,
      children: totalGuests.children - assigned.children,
      infants: totalGuests.infants - assigned.infants
    };
  };

  const getRoomGuests = (roomId: number) => {
    return assignedGuests.filter(guest => guest.roomId === roomId);
  };


  // Use the pricing utility function
  const calculateRoomPrice = (room: Room, roomId: number) => {
    return calculateRoomBedsPrice(
      room,
      assignedGuests.filter(guest => guest.roomId === roomId),
      pensionType,
      guestTypes,
      checkIn,
      checkOut
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-100 p-4 rounded-lg mb-4">
        <h3 className="font-semibold mb-2">Ospiti da assegnare:</h3>
        <div className="flex gap-4">
          <span>Adulti: {getUnassignedGuests().adults}</span>
          <span>Bambini: {getUnassignedGuests().children}</span>
          <span>Neonati: {getUnassignedGuests().infants}</span>
        </div>
      </div>
      
      <Accordion type="multiple" className="space-y-2">
        {rooms.map((room) => {
          const roomGuests = getRoomGuests(room.roomId);
          const price = calculateRoomPrice(room, room.roomId);
          
          return (
            <AccordionItem
              key={room.roomId}
              value={room.roomId.toString()}
              className="border rounded-lg overflow-hidden"
            >
              <div className="flex items-center w-full h-10 hover:bg-gray-100">
                <AccordionTrigger className="flex justify-between items-center w-full">
                  <div className="flex items-center gap-4 p-4">
                    {/* <span className="flex items-center justify-center rounded-full w-6 h-6 bg-gray-700 text-white">
                      {room.roomId}
                    </span> */}
                    <h3 className="text-lg font-semibold">
                      {room.description}
                    </h3>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-gray-600">{room.availableBeds.length} letti disponibili</p>
                    {roomGuests.length > 0 && (
                      <>
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm">
                          {roomGuests.length} ospiti assegnati
                        </span>
                        <span className="text-gray-700 font-medium">
                        €{price.totalPrice.toFixed(2)}
                        </span>
                      </>
                    )}
                  </div>
                </AccordionTrigger>
              </div>
              <AccordionContent className="p-4">
              <RoomContent 
                room={{
                  id: room.roomId,
                  description: room.description,
                  images: room.images,
                  availableBeds: room.availableBeds.length,
                  price: {
                    bb: 0, // Questo non viene più usato
                    hb: 0  // Questo non viene più usato
                  },
                  allBeds: room.allBeds,
                  availableBedIds: room.availableBeds
                }}
                onSelect={onSelect}
                unassignedGuests={getUnassignedGuests()}
                assignedGuests={roomGuests}
                onGuestAssignment={(newGuests) => {
                  const updatedGuests = [
                    ...assignedGuests.filter(g => g.roomId !== room.roomId),
                    ...newGuests.map(g => ({ ...g, roomId: room.roomId }))
                  ];
                  onGuestAssignment(updatedGuests);
                }}
                pensionType={pensionType}
                availabilityByNight={availabilityByNight}
                checkIn={checkIn} 
                checkOut={checkOut}
                guestTypes={guestTypes}
                onPrivacyCostChange={onPrivacyCostChange}
              />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      
      <div className="text-sm text-gray-600 mt-6">
        <p>Se questa soluzione funziona per te, clicca sul pulsante &apos;Prosegui l&apos;acquisto&apos;.</p>
        <p>Hai domande? Puoi contattare il gestore al numero +39 0436 860294 / +39 333 143 4408 oppure inviando una mail a rifugiodibona@gmail.com.</p>
      </div>
      
      <div className='flex justify-end items-center'>
        <Button
          className="bg-gray-900 hover:bg-gray-700"
          disabled={getUnassignedGuests().adults > 0 || 
                   getUnassignedGuests().children > 0 || 
                   getUnassignedGuests().infants > 0}
          onClick={onProceedToCheckout}
        >
          Prosegui l&apos;acquisto
        </Button>
      </div>
    </div>
  );
};

export default function BookingPage() {
  const [checkIn, setCheckIn] = useState<Date>()
  const [checkOut, setCheckOut] = useState<Date>()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [guestsOpen, setGuestsOpen] = useState(false)
  const [adults, setAdults] = useState(1)
  const [children, setChildren] = useState(0)
  const [infants, setInfants] = useState(0)
  const [language, setLanguage] = useState('it')
  const [showResults, setShowResults] = useState(false)
  const [pensionType, setPensionType] = useState<'bb' | 'hb'>('bb')
  const [countdown, setCountdown] = useState<number | null>(null)
  const intervalIdRef = useRef<number | null>(null)  
  const [assignedGuests, setAssignedGuests] = useState<Guest[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [availabilityByNight, setAvailabilityByNight] = useState<SearchResponse['availabilityByNight']>();
  const [guestTypes, setGuestTypes] = useState<GuestType[]>([]);
  // Add this state to track room privacy costs
  const [roomPrivacyCosts, setRoomPrivacyCosts] = useState<{ [roomId: number]: number }>({});
  const [currentView, setCurrentView] = useState<'search' | 'checkout'>('search')
  const [additionalServicesCost, setAdditionalServicesCost] = useState(0);
  const [currentBookingId, setCurrentBookingId] = useState<number | null>(null);
  const serviceWorkerRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
        intervalIdRef.current = null
      }
    }
  }, []) // array di dipendenze vuoto

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;

    // Create a new date object with the selected date at midnight in the local timezone
    const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(selectedDate);
      setCheckOut(undefined);
    } else {
      if (selectedDate > checkIn) {
        setCheckOut(selectedDate);
        setCalendarOpen(false);
      } else {
        setCheckIn(selectedDate);
        setCheckOut(undefined);
      }
    }
  }

  // Utility function to format date for API calls
  const formatDateForAPI = (date: Date | undefined): string | undefined => {
    if (!date) return undefined;
    // Format the date as YYYY-MM-DD to ensure consistent timezone handling
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getTotalGuests = () => {
    const total = adults + children + infants
    return `${total} ospit${total === 1 ? 'e' : 'i'}`
  }

  const handleGuestChange = (type: 'adults' | 'children' | 'infants', operation: 'add' | 'subtract') => {
    const setValue = {
      'adults': setAdults,
      'children': setChildren,
      'infants': setInfants
    }[type]

    const currentValue = {
      'adults': adults,
      'children': children,
      'infants': infants
    }[type]

    if (operation === 'add') {
      setValue(currentValue + 1)
    } else if (operation === 'subtract' && currentValue > 0) {
      setValue(currentValue - 1)
    }

    setAssignedGuests([])
  }

  // Effetto per registrare il service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          serviceWorkerRef.current = registration.active;
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  // Effetto per gestire il booking hold
  useEffect(() => {
    if (currentBookingId && serviceWorkerRef.current) {
      // Avvia il heartbeat nel service worker
      console.log ('currentBookingId', currentBookingId)
      serviceWorkerRef.current.postMessage({
        type: 'START_HEARTBEAT',
        bookingId: currentBookingId
      });
    }

    return () => {
      if (serviceWorkerRef.current) {
        // Ferma il heartbeat nel service worker
        serviceWorkerRef.current.postMessage({
          type: 'STOP_HEARTBEAT'
        });
      }
    };
  }, [currentBookingId]);

  const handleSearch = async () => {
    if (!checkIn || !checkOut) return;
  
    try {
      setSearchError(null);
      const guests = [
        { type: 'adult', count: adults },
        { type: 'child', count: children },
        { type: 'infant', count: infants }
      ].filter(g => g.count > 0);

      const searchParams = new URLSearchParams({
        checkIn: formatDateForAPI(checkIn) || '',
        checkOut: formatDateForAPI(checkOut) || '',
        guests: JSON.stringify(guests)
      });

      const response = await fetch(`/api/search?${searchParams}`);
      const data: SearchResponse = await response.json();

      if (data.guestTypes) {
        setGuestTypes(data.guestTypes);
      }
  
      if (data.available === false) {
        if (data.reason === 'BLOCKED_DAYS') {
          setSearchError('blocked_days');
        } else if (data.reason === 'BOOKING_IN_PROGRESS') {
          setSearchError('booking_in_progress');
        } else {
          setSearchError('unknown_error');
        }
        setShowResults(false);
        return;
      } 
      
      if (data.status === 'enough' && data.rooms) {
        const bookingHoldResponse = await fetch('/api/booking-hold', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkIn: checkIn.toISOString(),
            checkOut: checkOut.toISOString()
          })
        });

        const bookingHoldData = await bookingHoldResponse.json();

        if (!bookingHoldData.available) {
          setSearchError(bookingHoldData.reason);
          setShowResults(false);
          return;
        }

        setCurrentBookingId(bookingHoldData.bookingId);
        setRooms(data.rooms);
        setAvailabilityByNight(data.availabilityByNight)
        setShowResults(true);
        setAssignedGuests([]);
        
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
          intervalIdRef.current = null;
        }
        
        setCountdown(900);
        
        intervalIdRef.current = window.setInterval(() => {
          setCountdown(prev => {
            if (prev === null || prev <= 0) {
              if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else if (data.status === 'sold_out') {
        setSearchError('sold_out');
        setShowResults(false);
      } else if (data.status && data.status.startsWith('too_little_availability')) {
        setSearchError(data.status);
        setShowResults(false);
      } else {
        setSearchError('unknown_error');
        setShowResults(false);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Error during search. Please try again.');
      setShowResults(false);
    }
  };

  const handleRoomSelect = (roomId: number) => {
    console.log('Selected room:', roomId)
  }

  // Handle privacy cost changes
  const handlePrivacyCostChange = (roomId: number, cost: number) => {
    setRoomPrivacyCosts(prev => ({
      ...prev,
      [roomId]: cost
    }));
  };

  // Handle getting to checkout page
  const handleProceedToCheckout = async () => {
    if (currentBookingId) {
      // Aggiorna il booking hold per indicare che è entrato nel pagamento
      await fetch('/api/booking-hold', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bookingId: currentBookingId, 
          action: 'ENTER_PAYMENT' 
        })
      });
    }
    setCurrentView('checkout');
  }

  // Nuova funzione per tornare alla vista di ricerca/selezione
  const handleBackToRooms = () => {
    setCurrentView('search')
  }

  // Use the pricing utility function
  const calculateTotalPrice = () => {
    return calculateCartTotal(
      rooms,
      assignedGuests,
      pensionType,
      guestTypes,
      additionalServicesCost,
      roomPrivacyCosts,
      checkIn,
      checkOut
    );
  };

  const GuestCounter = ({ 
    title, 
    subtitle, 
    value, 
    type 
  }: { 
    title: string;
    subtitle: string;
    value: number;
    type: 'adults' | 'children' | 'infants';
  }) => (
    <div className="flex items-center justify-between py-4">
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-sm text-gray-500">{subtitle}</div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleGuestChange(type, 'subtract')}
          disabled={value === 0}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-8 text-center">{value}</span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleGuestChange(type, 'add')}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const totalGuests = adults + children + infants;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2">
        {countdown !== null && (
          <Button 
          variant="outline" 
          className="bg-white shadow-md hover:bg-gray-100 flex items-center gap-2"
          onClick={() => setIsCartOpen(true)}
        >
          <ShoppingCart className="h-4 w-4" /> 
          €{(calculateTotalPrice().total).toFixed(2)} | {formatTime(countdown)}
        </Button>
        )}
      </div>

      {/* Update Cart component */}
      <Cart 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)}
        countdown={countdown}
        guestTypes={guestTypes}
        bookingDetails={{
          checkIn: checkIn ? format(checkIn, 'dd/MM') : '',
          checkOut: checkOut ? format(checkOut, 'dd/MM') : '',
          accommodation: pensionType === 'bb' ? 'Bed & Breakfast' : 'Mezza Pensione',
          rooms: rooms.reduce((acc: RoomCartItem[], room) => {
            const roomGuests = assignedGuests.filter(guest => guest.roomId === room.roomId);
            if (roomGuests.length === 0) return acc;
            
            const roomData = formatRoomForCart(
              room,
              roomGuests,
              pensionType,
              guestTypes,
              roomPrivacyCosts[room.roomId] || 0,
              checkIn,
              checkOut
            );
            
            acc.push(roomData);
            return acc;
          }, []),
          additionalServices: additionalServicesCost,
          cityTax: calculateTotalPrice().cityTaxTotal
        }}
        onProceedToCheckout={handleProceedToCheckout}
        onTimeUp={() => {
          // Quando il timer scade, cancella il booking hold
          if (currentBookingId) {
            fetch('/api/booking-hold', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                bookingId: currentBookingId, 
                action: 'CANCEL' 
              })
            });
            setCurrentBookingId(null);
          }
          // Resetta lo stato
          setShowResults(false);
          setAssignedGuests([]);
          setRoomPrivacyCosts({});
          setAdditionalServicesCost(0);
        }}
      />
      
      <Header 
      language={language}
      onLanguageChange={setLanguage}
    />

    <main className="flex-grow container mx-auto px-4 py-8 space-y-8">
      {currentView === 'search' ? (
        // Vista di ricerca e selezione delle stanze
        <>
          <Card className="p-6 max-w-4xl mx-auto">
            <div className="grid md:grid-cols-4 gap-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date del soggiorno (checkin - checkout)
                </label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal border-gray-300"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {checkIn ? (
                        checkOut ? (
                          <>
                            {format(checkIn, 'd MMM yyyy', { locale: it })} - 
                            {format(checkOut, 'd MMM yyyy', { locale: it })}
                          </>
                        ) : (
                          format(checkIn, 'd MMM yyyy', { locale: it })
                        )
                      ) : (
                        "Seleziona le date"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      defaultMonth={checkIn}
                      selected={{
                        from: checkIn,
                        to: checkOut
                      }}
                      onSelect={(range) => {
                        if (range?.from) handleCalendarSelect(range.from)
                        if (range?.to) setCheckOut(range.to)
                      }}
                      numberOfMonths={2}
                      disabled={(date) => date < new Date()}
                      locale={it}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ospiti
                </label>
                <Popover open={guestsOpen} onOpenChange={setGuestsOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal border-gray-300"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      {getTotalGuests()}
                      <ChevronDown className="ml-auto h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="px-1 divide-y">
                      <GuestCounter
                        title="Adulti"
                        subtitle="13+ anni"
                        value={adults}
                        type="adults"
                      />
                      <GuestCounter
                        title="Bambini"
                        subtitle="2-12 anni"
                        value={children}
                        type="children"
                      />
                      <GuestCounter
                        title="Neonati"
                        subtitle="0-2 anni"
                        value={infants}
                        type="infants"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              <Button 
                className="w-full mt-6 bg-gray-900 hover:bg-gray-800 text-white" 
                disabled={!checkIn || !checkOut || totalGuests === 0}
                onClick={handleSearch}
              >
                <Search className="h-4 w-4 mr-2"/>
                Cerca
              </Button>
            </div>
          </Card>

          {searchError && (
            <div className="max-w-4xl mx-auto">
              {searchError === 'blocked_days' && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                  </svg>
                  <span>
                    <strong>Siamo spiacenti, nessun risultato disponibile.</strong> Hai bisogno di aiuto? Contattaci al numero +39 0436 860294 / +39 333 143 4408 oppure inviando una mail a rifugiodibona@gmail.com
                  </span>
                </div>
              )}
              {searchError === 'booking_in_progress' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
                  <p>Ci sono prenotazioni in corso per queste date. Riprova tra qualche minuto.</p>
                </div>
              )}
              {searchError === 'sold_out' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <p>Ci dispiace, non ci sono camere disponibili per le date selezionate.</p>
                </div>
              )}
              {searchError?.startsWith('too_little_availability') && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <p>Non ci sono abbastanza letti disponibili per il numero di ospiti selezionato.</p>
                </div>
              )}
              {['blocked_days', 'booking_in_progress', 'sold_out'].includes(searchError) === false && 
              !searchError?.startsWith('too_little_availability') && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <p>Si è verificato un errore durante la ricerca. Riprova più tardi.</p>
                </div>
              )}
            </div>
          )}

          {showResults && !searchError && (
            <Card className="p-6 max-w-4xl mx-auto">
              <div className="mb-4">
              <p className="mb-3 text-gray-700">
                <span>1. Seleziona la modalità di pernottamento tra le seguenti:</span><br/>
                <span className="">• <strong>Mezza Pensione</strong>: include la cena e la colazione</span><br/>
                <span className="">• <strong>Bed & Breakfast</strong>: include solo la colazione</span>
              </p>
              <Select 
                value={pensionType} 
                onValueChange={(value: string) => {
                  // Only set the state if the value is one of the expected values
                  if (value === 'bb' || value === 'hb') {
                    setPensionType(value as 'bb' | 'hb');
                  }
                }}
              >
                  <SelectTrigger className="w-auto">
                    <SelectValue placeholder="Seleziona trattamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bb">Bed & Breakfast</SelectItem>
                    <SelectItem value="hb">Mezza Pensione</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span>2. Seleziona un letto per ciascun ospite.</span>
              <RoomList 
                rooms={rooms}
                onSelect={handleRoomSelect}
                totalGuests={{
                  adults,
                  children,
                  infants
                }}
                assignedGuests={assignedGuests}
                onGuestAssignment={setAssignedGuests}
                pensionType={pensionType}
                availabilityByNight={availabilityByNight}
                checkIn={checkIn}
                checkOut={checkOut}
                guestTypes={guestTypes}
                onPrivacyCostChange={handlePrivacyCostChange}
                onProceedToCheckout={handleProceedToCheckout}
              />
            </Card>
          )}
        </>
      ) : (
        // Vista di checkout
        <CheckoutPage
          bookingDetails={{
            checkIn: checkIn || new Date(),
            checkOut: checkOut || new Date(),
            pensionType,
            rooms,
            assignedGuests,
            roomPrivacyCosts,
            guestTypes
          }}
          language={language}
          onLanguageChange={setLanguage}
          countdown={countdown}
          onBackToRooms={handleBackToRooms}
          onServicesChange={setAdditionalServicesCost}
        />
      )}
    </main>

      <Footer />
    </div>
  )
}