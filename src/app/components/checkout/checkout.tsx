'use client'

import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Info } from 'lucide-react';
import { calculateCartTotal } from '@/app/utils/pricing';
import { Room } from '@/app/utils/pricing';
import { loadStripe } from '@stripe/stripe-js';

import { z } from 'zod';

// Types
interface Bed {
  id: number;
  name: string;
  pricing?: {
    bb: number;
    mp: number;
  };
}

interface CheckoutPageProps {
  // Booking information passed from the previous page
  bookingDetails: {
    checkIn: Date;
    checkOut: Date;
    pensionType: 'bb' | 'hb';
    rooms: Room[];
    assignedGuests: Array<{
      type: 'adult' | 'child' | 'infant';
      roomId: number | null;
      bedId: string | null;
    }>;
    roomPrivacyCosts: { [roomId: number]: number };
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
  };
  language: string;
  onLanguageChange: (lang: string) => void;
  countdown: number | null;
  onBackToRooms: () => void;
  onServicesChange: (totalServicesCost: number) => void;
}

interface Service {
  id: number;
  description: string;
  price: number;
  requestQuantity: boolean;
  langTrasn?: {
    [key: string]: string;
  } | null;
}

interface SelectedService {
  id: number;
  description: string;
  price: number;
  quantity: number;
  totalPrice: number;
}

interface Region {
  id: number;
  name: string;
}

interface Country {
  name: string;
  code: string;
  native: string;
  englishName?: string;
}

// Email validation schema
const emailSchema = z.string().email({ message: "Email non valido" });

const CheckoutPage: React.FC<CheckoutPageProps> = ({
  bookingDetails,
  onBackToRooms,
  onServicesChange
}) => {
  // States for services
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  
  // States for booking contact information
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  
  // States for Italian regions (shown only when Italy is selected)
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [italianRegions, setItalianRegions] = useState<Region[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  
  // State for additional notes
  const [notes, setNotes] = useState('');
  
  // State for form validation
  const [formValid, setFormValid] = useState(false);
  
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [stripeCheckoutUrl, setStripeCheckoutUrl] = useState<string | null>(null);

  // Fetch services on component mount
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await fetch('/api/services');
        if (!response.ok) {
          throw new Error('Failed to fetch services');
        }
        const data = await response.json();
        setServices(data);
      } catch (error) {
        console.error('Error fetching services:', error);
      } finally {
        setServicesLoading(false);
      }
    };

    fetchServices();
  }, []);

  // Fetch countries on component mount
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await fetch('/api/countries');
        if (!response.ok) {
          throw new Error('Failed to fetch countries');
        }
        const data = await response.json();
        setCountries(data);
      } catch (error) {
        console.error('Error fetching countries:', error);
      } finally {
        setCountriesLoading(false);
      }
    };

    fetchCountries();
  }, []);

  // Fetch Italian regions when Italy is selected
  useEffect(() => {
    if (selectedCountry === 'IT') {
      const fetchItalianRegions = async () => {
        setRegionsLoading(true);
        try {
          const response = await fetch('/api/italyregions');
          if (!response.ok) {
            throw new Error('Failed to fetch Italian regions');
          }
          const data = await response.json();
          setItalianRegions(data);
        } catch (error) {
          console.error('Error fetching Italian regions:', error);
        } finally {
          setRegionsLoading(false);
        }
      };

      fetchItalianRegions();
    } else {
      setSelectedRegion('');
    }
  }, [selectedCountry]);

  // Validate form on input changes
  useEffect(() => {
    const isValid = 
      customerName.trim() !== '' && 
      customerPhone.trim() !== '' && 
      customerEmail.trim() !== '' && 
      emailError === null &&
      selectedCountry !== '' &&
      (selectedCountry !== 'IT' || selectedRegion !== '');
    
    setFormValid(isValid);
  }, [customerName, customerPhone, customerEmail, emailError, selectedCountry, selectedRegion]);

  // Handle email validation
  const validateEmail = (email: string) => {
    try {
      emailSchema.parse(email);
      setEmailError(null);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setEmailError(error.errors[0].message);
      }
    }
  };

  // Add useEffect to handle service changes
  useEffect(() => {
    onServicesChange(calculateServicesCost());
  }, [selectedServices, onServicesChange]);

  // Update handleServiceChange to not call onServicesChange directly
  const handleServiceChange = (service: Service, checked: boolean, quantity: number = 1) => {
    if (checked) {
      setSelectedServices(prev => [...prev, {
        id: service.id,
        description: service.description,
        price: service.price,
        quantity,
        totalPrice: service.price * quantity
      }]);
    } else {
      setSelectedServices(prev => prev.filter(item => item.id !== service.id));
    }
  };

  // Update handleQuantityChange to not call onServicesChange directly
  const handleQuantityChange = (serviceId: number, quantity: number) => {
    setSelectedServices(prev => prev.map(service => 
      service.id === serviceId 
        ? { ...service, quantity, totalPrice: service.price * quantity } 
        : service
    ));
  };

  // Go back to room selection
  const handleGoBack = () => {
    onBackToRooms();
  };

  // Calculate totals
  const calculateServicesCost = (services: SelectedService[] = selectedServices) => {
    return services.reduce((total, service) => total + service.totalPrice, 0);
  };

  const totalServicesCost = calculateServicesCost();

  // Calculate total price including services
  const cartTotals = calculateCartTotal(
    bookingDetails.rooms,
    bookingDetails.assignedGuests,
    bookingDetails.pensionType,
    bookingDetails.guestTypes,
    totalServicesCost,
    bookingDetails.roomPrivacyCosts,
    bookingDetails.checkIn,
    bookingDetails.checkOut
  );

  // Format date to dd/MM
  const formatDate = (date: Date) => {
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  // Add effect to handle URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment_status');
    
    if (paymentStatus === 'cancelled') {
      // Show a message to the user that the payment was cancelled
      alert('Il pagamento è stato annullato. Puoi modificare le tue informazioni e riprovare.');
    }
  }, []);

  // Modify handleProceedToPayment to store state in URL
  const handleProceedToPayment = async () => {
    try {
      // Get the selected country object
      const selectedCountryObj = countries.find(c => c.code === selectedCountry);
      
      const response = await fetch('/api/create-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checkIn: bookingDetails.checkIn,
          checkOut: bookingDetails.checkOut,
          pensionType: bookingDetails.pensionType,
          rooms: bookingDetails.rooms,
          assignedGuests: bookingDetails.assignedGuests,
          roomPrivacyCosts: bookingDetails.roomPrivacyCosts,
          guestTypes: bookingDetails.guestTypes,
          customerName,
          customerPhone,
          customerEmail,
          selectedCountry,
          countryName: selectedCountryObj?.englishName || selectedCountryObj?.native || selectedCountry,
          selectedRegion,
          notes,
          additionalServicesCost: totalServicesCost,
          totalAmount: cartTotals.total
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create booking');
      }

      const { sessionId } = await response.json();

      // Get the Stripe checkout URL
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }

      const result = await stripe.redirectToCheckout({
        sessionId,
      });

      if (result.error) {
        throw result.error;
      }

      // The URL will be available in the redirectToCheckout response
      if ('url' in result && typeof result.url === 'string') {
        setStripeCheckoutUrl(result.url);
        setShowPaymentDialog(true);
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Si è verificato un errore durante il pagamento. Riprova più tardi.');
    }
  };

  // Handle opening Stripe checkout in new tab
  const handleOpenStripeCheckout = () => {
    if (stripeCheckoutUrl) {
      window.open(stripeCheckoutUrl, '_blank', 'noopener,noreferrer');
      setShowPaymentDialog(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-8 space-y-8">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            className="mb-6 text-gray-600 hover:text-gray-900"
            onClick={handleGoBack}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Torna alle stanze
          </Button>

          <Card className="p-6 space-y-8">
            {/* Additional Services Section */}
            <section>
              <h2 className="text-xl font-semibold mb-4">4. Servizi aggiuntivi</h2>
              <p className="text-gray-600 mb-4">
                Se desideri aggiungere altri servizi, spunta la rispettiva casella e, se richiesto, inserisci la quantità desiderata.
              </p>
              
              {servicesLoading ? (
                <div className="py-4 text-center">Caricamento servizi in corso...</div>
              ) : services.length === 0 ? (
                <div className="py-4 text-center">Nessun servizio aggiuntivo disponibile</div>
              ) : (
                <div className="space-y-4">
                  {services.map(service => (
                    <div key={service.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id={`service-${service.id}`}
                          checked={selectedServices.some(s => s.id === service.id)}
                          onCheckedChange={(checked) => 
                            handleServiceChange(service, checked as boolean)
                          }
                        />
                        <Label htmlFor={`service-${service.id}`}>{service.description}</Label>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {service.requestQuantity && selectedServices.some(s => s.id === service.id) && (
                          <Select 
                            value={selectedServices.find(s => s.id === service.id)?.quantity.toString() || "1"}
                            onValueChange={(value) => handleQuantityChange(service.id, parseInt(value))}
                          >
                            <SelectTrigger className="w-20">
                              <SelectValue placeholder="Qtà" />
                            </SelectTrigger>
                            <SelectContent>
                              {[...Array(10)].map((_, i) => (
                                <SelectItem key={i + 1} value={(i + 1).toString()}>
                                  {i + 1}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <span>€{service.price.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {selectedServices.length > 0 && (
                <div className="mt-4 text-right font-medium">
                  Totale servizi aggiuntivi: €{totalServicesCost.toFixed(2)}
                </div>
              )}
            </section>

            {/* Notes Section */}
            <section>
              <h2 className="text-xl font-semibold mb-4">5. Note</h2>
              <p className="text-gray-600 mb-4">
                Aggiungi eventuali note (allergie, intolleranze, richieste particolari, ecc).
              </p>
              <Textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full min-h-32"
                placeholder="Inserisci qui le tue note..."
              />
            </section>

            {/* Contact Information Section */}
            <section>
              <h2 className="text-xl font-semibold mb-4">6. Referente della prenotazione</h2>
              <p className="text-gray-600 mb-4">
                Inserisci le informazioni di contatto del referente della prenotazione.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-name">Nome e cognome *</Label>
                  <Input 
                    id="customer-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nome e cognome"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="customer-phone">Telefono *</Label>
                  <Input 
                    id="customer-phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Telefono"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="customer-email">Indirizzo email *</Label>
                  <Input 
                    id="customer-email"
                    value={customerEmail}
                    onChange={(e) => {
                      setCustomerEmail(e.target.value);
                      if (e.target.value) validateEmail(e.target.value);
                    }}
                    onBlur={() => validateEmail(customerEmail)}
                    placeholder="Indirizzo email"
                    className={emailError ? "border-red-500" : ""}
                    required
                  />
                  {emailError && (
                    <p className="text-red-500 text-sm">{emailError}</p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-country">Il tuo paese *</Label>
                  <Select 
                    value={selectedCountry}
                    onValueChange={setSelectedCountry}
                  >
                    <SelectTrigger id="customer-country" className="w-full">
                      <SelectValue placeholder="Seleziona un paese" />
                    </SelectTrigger>
                    <SelectContent>
                      {countriesLoading ? (
                        <SelectItem value="loading" disabled>Caricamento paesi...</SelectItem>
                      ) : (
                        countries.map(country => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.native} {country.englishName && `(${country.englishName})`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedCountry === 'IT' && (
                  <div className="space-y-2">
                    <Label htmlFor="customer-region">Regione *</Label>
                    <Select 
                      value={selectedRegion}
                      onValueChange={setSelectedRegion}
                    >
                      <SelectTrigger id="customer-region" className="w-full">
                        <SelectValue placeholder="Seleziona una regione" />
                      </SelectTrigger>
                      <SelectContent>
                        {regionsLoading ? (
                          <SelectItem value="loading" disabled>Caricamento regioni...</SelectItem>
                        ) : (
                          italianRegions.map(region => (
                            <SelectItem key={region.id} value={region.id.toString()}>
                              {region.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </section>

            {/* Booking Summary */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Riepilogo della prenotazione:</h2>
              
              {bookingDetails.rooms.map((room, roomIndex) => {
                const roomGuests = bookingDetails.assignedGuests.filter(guest => guest.roomId === room.roomId);
                
                if (roomGuests.length === 0) return null;
                
                const accommodationType = bookingDetails.pensionType === 'bb' ? 'Bed & Breakfast' : 'Mezza Pensione';
                
                return (
                  <div key={room.roomId} className="space-y-4 mb-6">
                    <h3 className="font-semibold">{roomIndex + 1}. {room.description}</h3>
                    <div className="space-y-2 text-gray-600">
                      <p>Soggiorno: {formatDate(bookingDetails.checkIn)} - {formatDate(bookingDetails.checkOut)}</p>
                      <p>Num. ospiti: {roomGuests.length} ({
                        [
                          `${roomGuests.filter(g => g.type === 'adult').length} Adulti`,
                          roomGuests.filter(g => g.type === 'child').length > 0 ? `${roomGuests.filter(g => g.type === 'child').length} Bambini` : null,
                          roomGuests.filter(g => g.type === 'infant').length > 0 ? `${roomGuests.filter(g => g.type === 'infant').length} Neonati` : null
                        ].filter(Boolean).join(', ')
                      })</p>
                      <p>Pernottamento: {accommodationType}</p>
                    </div>
                    
                    <div className="space-y-2">
                      {roomGuests
                        .filter(guest => guest.bedId)
                        .map((guest, guestIndex) => {
                          const bed = room.availableBeds.find((b: Bed) => b.id.toString() === guest.bedId);
                          if (!bed) return null;
                          
                          const guestTypeInfo = bookingDetails.guestTypes.find(type => {
                            if (guest.type === 'adult') return type.title === 'Adulti';
                            if (guest.type === 'child') return type.title === 'Bambini';
                            if (guest.type === 'infant') return type.title === 'Neonati';
                            return false;
                          });
                          
                          const discount = guestTypeInfo ? guestTypeInfo.salePercent : 0;
                          const basePrice = bookingDetails.pensionType === 'bb' ? bed.pricing?.bb || 0 : bed.pricing?.mp || 0;
                          const numNights = bookingDetails.checkOut && bookingDetails.checkIn 
                                          ? Math.max(1, Math.ceil((bookingDetails.checkOut.getTime() - bookingDetails.checkIn.getTime()) / (1000 * 60 * 60 * 24)))
                                          : 0;
                          
                          const finalPrice = basePrice * (1 - (discount / 100)) * numNights;
                          
                          return (
                            <div key={guestIndex} className="flex justify-between">
                              <span>{guest.type.charAt(0).toUpperCase() + guest.type.slice(1)} - {bed.name}</span>
                              <span>€{finalPrice.toFixed(2)}</span>
                            </div>
                          );
                        })}
                      
                      {bookingDetails.roomPrivacyCosts[room.roomId] > 0 && (
                        <div className="flex justify-between">
                          <span>Supplemento privacy</span>
                          <span>€{bookingDetails.roomPrivacyCosts[room.roomId].toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              <div className="space-y-2">
                {selectedServices.length > 0 && (
                  <div className="flex justify-between">
                    <span>Servizi aggiuntivi</span>
                    <span>€{totalServicesCost.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <div className="flex items-center gap-1">
                    <span>City Tax</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-4 h-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Tassa di soggiorno applicata per legge</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <span>€{cartTotals.cityTaxTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Cancellation Policy */}
              <div className="mt-6 space-y-4">
                <p className="text-gray-600">Per concludere la prenotazione, clicca sul pulsante &apos;Vai al pagamento&apos;.</p>
                <div className="bg-gray-50  rounded-lg">
                  <p className="font-semibold mb-2">DISDETTA:</p>
                  <p className="text-sm">seguire le istruzioni contenute nella mail di conferma da <span className="text-blue-600">no-reply@rifugiodibona.it</span></p>
                  <p className="text-sm">Stai effettuando una prenotazione di gruppo, pertanto dopo la conferma non sarà possibile aggiungere/rimuovere ospiti dalla prenotazione.</p>
                </div>
                <div>
                  <p className="font-semibold">POLITICA DI RIMBORSO:</p>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li>Disdetta con <span className="font-medium">più di 7 giorni dall&apos;arrivo</span>: l&apos;intero importo verrà rimborsato</li>
                    <li>Disdetta con <span className="font-medium">meno di 7 giorni dall&apos;arrivo</span>: verrà rimborsato il 70% dell&apos;importo</li>
                    <li>Disdetta <span className="font-medium">il giorno stesso</span>: non rimborsabile</li>
                  </ul>
                </div>
              </div>

              {/* Total and Submit */}
              <div className="mt-6 border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-semibold">Totale (IVA incl.)</span>
                  <span className="font-semibold text-xl">€{cartTotals.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-end">
                  <Button 
                    className="bg-gray-600 hover:bg-gray-700 text-white"
                    onClick={handleProceedToPayment}
                    disabled={!formValid}
                  >
                    Vai al pagamento
                  </Button>
                </div>
              </div>
            </section>
          </Card>
        </div>
      </main>

      {/* Payment Instructions Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Procedi con il pagamento</DialogTitle>
            <DialogDescription>
              <p className="mt-4">
                Stiamo aprendo una nuova finestra per il pagamento sicuro. 
                Per completare la prenotazione, segui questi passaggi:
              </p>
              <ol className="list-decimal list-inside mt-4 space-y-2">
                <li>Completa il pagamento nella nuova finestra che si aprirà</li>
                <li>Attendi la conferma del pagamento</li>
                <li>Verrai reindirizzato automaticamente alla pagina di conferma</li>
              </ol>
              <p className="mt-4 text-sm text-gray-500">
                Se qualcosa non funziona correttamente, chiudi questa finestra e riprova il pagamento.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPaymentDialog(false)}
            >
              Chiudi e riprova
            </Button>
            <Button
              onClick={handleOpenStripeCheckout}
              className="bg-gray-900 hover:bg-gray-800"
            >
              Apri pagina di pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheckoutPage;