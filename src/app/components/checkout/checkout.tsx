'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Info } from 'lucide-react';
import { calculateCartTotal } from '@/app/utils/pricing';
import { Room } from '@/app/utils/pricing';
import { loadStripe } from '@stripe/stripe-js';
import { formatDateForAPI } from '@/app/utils/dateUtils';

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
    detailedBlockedBeds: { [roomId: number]: { [date: string]: number[] } };
  };
  language: string;
  onLanguageChange: (lang: string) => void;
  countdown: number | null;
  onBackToRooms: () => void;
  onServicesChange: (totalServicesCost: number) => void;
  isAdminBooking?: boolean;
  t: (key: string, vars?: Record<string, unknown>) => string;
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

// Import new components
import NotesSection from './NotesSection';
import ContactInfoSection, { ContactDetails } from './ContactInfoSection';

const CheckoutPage: React.FC<CheckoutPageProps> = ({
  bookingDetails,
  onBackToRooms,
  onServicesChange,
  isAdminBooking = false,
  t
}) => {
  // States for services
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  
  // States for final notes and contact details
  const [finalNotes, setFinalNotes] = useState('');
  const [contactDetails, setContactDetails] = useState<ContactDetails | null>(null);
  
  // State for overall form validity
  const [formValid, setFormValid] = useState(false);
  
  // Payment related states
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [stripeCheckoutUrl, setStripeCheckoutUrl] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Fetch services on component mount
  useEffect(() => {
    const fetchServices = async () => {
      setServicesLoading(true); // Set loading true at the start
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

  // Update overall form validity based on contact details from child component
  useEffect(() => {
    setFormValid(contactDetails?.isValid || false);
  }, [contactDetails]);

  // Calculate total services cost (memoized)
  const totalServicesCost = useMemo(() => {
    return selectedServices.reduce((total, service) => total + service.totalPrice, 0);
  }, [selectedServices]);
  
  // Effect to notify parent about service cost changes
  useEffect(() => {
    onServicesChange(totalServicesCost);
  }, [totalServicesCost, onServicesChange]); // Depend on memoized value

  // Memoized handlers
  const handleServiceChange = useCallback((service: Service, checked: boolean, quantity: number = 1) => {
    setSelectedServices(prev => {
      if (checked) {
        return [...prev, {
          id: service.id,
          description: service.description,
          price: service.price,
          quantity,
          totalPrice: service.price * quantity
        }];
      } else {
        return prev.filter(item => item.id !== service.id);
      }
    });
  }, []); // Empty dependency array if it doesn't depend on component state/props outside the function scope

  const handleQuantityChange = useCallback((serviceId: number, quantity: number) => {
    setSelectedServices(prev => prev.map(service => 
      service.id === serviceId 
        ? { ...service, quantity, totalPrice: service.price * quantity } 
        : service
    ));
  }, []); // Empty dependency array

  const handleGoBack = useCallback(() => {
    onBackToRooms();
  }, [onBackToRooms]); // Dependency: onBackToRooms

  // Calculate total price including services (memoized)
  const cartTotals = useMemo(() => {
    return calculateCartTotal(
      bookingDetails.rooms,
      bookingDetails.assignedGuests,
      bookingDetails.pensionType,
      bookingDetails.guestTypes,
      totalServicesCost, // Use memoized value
      bookingDetails.roomPrivacyCosts,
      bookingDetails.checkIn,
      bookingDetails.checkOut
    );
  }, [
    bookingDetails.rooms,
    bookingDetails.assignedGuests,
    bookingDetails.pensionType,
    bookingDetails.guestTypes,
    totalServicesCost, // Dependency
    bookingDetails.roomPrivacyCosts,
    bookingDetails.checkIn,
    bookingDetails.checkOut
  ]);

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
      alert(t('checkout.paymentCancelled'));
    }
  }, [t]);

  // Memoized payment handlers
  const handleProceedToPayment = useCallback(async () => {
    if (!contactDetails?.isValid) return; // Guard clause

    try {
      setIsProcessingPayment(true);
      
      const checkInFormatted = formatDateForAPI(bookingDetails.checkIn);
      const checkOutFormatted = formatDateForAPI(bookingDetails.checkOut);

      if (!checkInFormatted || !checkOutFormatted) {
        console.error("Error formatting check-in/check-out dates.");
        alert(t('checkout.internalError'));
        setIsProcessingPayment(false);
        return;
      }

      const response = await fetch('/api/create-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checkIn: checkInFormatted,
          checkOut: checkOutFormatted,
          pensionType: bookingDetails.pensionType,
          rooms: bookingDetails.rooms,
          assignedGuests: bookingDetails.assignedGuests,
          roomPrivacyCosts: bookingDetails.roomPrivacyCosts,
          guestTypes: bookingDetails.guestTypes,
          detailedBlockedBeds: bookingDetails.detailedBlockedBeds,
          customerName: contactDetails.customerName,
          customerPhone: contactDetails.customerPhone,
          customerEmail: contactDetails.customerEmail,
          selectedCountry: contactDetails.selectedCountry,
          countryName: contactDetails.countryName,
          selectedRegion: contactDetails.selectedRegion,
          notes: finalNotes,
          additionalServicesCost: totalServicesCost,
          totalAmount: cartTotals.total,
          selectedServices: selectedServices,
        }),
      });

      if (!response.ok) {
        // Attempt to read error message from response body
        let errorMessage = 'Failed to create booking';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch { /* Ignore parsing error */ }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // ====================================================================
      // NEXI: redirect diretto alla hosted page
      // ====================================================================
      if (data.provider === 'nexi' && data.redirectUrl) {
        console.log('Redirecting to Nexi hosted payment page');
        window.location.href = data.redirectUrl;
        return;
      }

      // ====================================================================
      // STRIPE: usa loadStripe e redirectToCheckout (codice originale)
      // ====================================================================
      const { sessionId } = data;

      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }

      const result = await stripe.redirectToCheckout({ sessionId });

      if (result.error) {
        throw result.error; // Use Stripe's error object
      }

      // Redirect happens automatically, but handle potential URL return (though less common now)
      if ('url' in result && typeof result.url === 'string') {
         setStripeCheckoutUrl(result.url);
         setShowPaymentDialog(true);
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert(`${t('checkout.paymentError')}: ${error instanceof Error ? error.message : String(error)}. ${t('checkout.tryAgainLater')}`);
    } finally {
      setIsProcessingPayment(false);
    }
  }, [
    bookingDetails, 
    contactDetails, // Use aggregated contact details
    finalNotes,     // Use final notes
    totalServicesCost, 
    cartTotals,
    selectedServices,
    t
  ]);

  const handleOpenStripeCheckout = useCallback(() => {
    if (stripeCheckoutUrl) {
      window.open(stripeCheckoutUrl, '_blank', 'noopener,noreferrer');
      setShowPaymentDialog(false);
    }
  }, [stripeCheckoutUrl]);

  const handleAdminBookingSubmit = useCallback(async () => {
    if (!contactDetails?.isValid) return; // Guard clause

    try {
      setIsProcessingPayment(true);
      
      const checkInFormatted = formatDateForAPI(bookingDetails.checkIn);
      const checkOutFormatted = formatDateForAPI(bookingDetails.checkOut);

      if (!checkInFormatted || !checkOutFormatted) {
        console.error("Error formatting check-in/check-out dates.");
        alert(t('checkout.internalError'));
        setIsProcessingPayment(false);
        return;
      }

      const response = await fetch('/api/create-admin-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checkIn: checkInFormatted,
          checkOut: checkOutFormatted,
          pensionType: bookingDetails.pensionType,
          rooms: bookingDetails.rooms,
          assignedGuests: bookingDetails.assignedGuests,
          roomPrivacyCosts: bookingDetails.roomPrivacyCosts,
          guestTypes: bookingDetails.guestTypes,
          detailedBlockedBeds: bookingDetails.detailedBlockedBeds,
          customerName: contactDetails.customerName,
          customerPhone: contactDetails.customerPhone,
          customerEmail: contactDetails.customerEmail,
          selectedCountry: contactDetails.selectedCountry,
          countryName: contactDetails.countryName,
          selectedRegion: contactDetails.selectedRegion,
          notes: finalNotes,
          additionalServicesCost: totalServicesCost,
          totalAmount: cartTotals.total,
          selectedServices: selectedServices,
        }),
      });

      if (!response.ok) {
         // Attempt to read error message from response body
         let errorMessage = 'Failed to create admin booking';
         try {
           const errorData = await response.json();
           errorMessage = errorData.message || errorMessage;
         } catch { /* Ignore parsing error */ }
         throw new Error(errorMessage);
      }

      const { bookingId } = await response.json();
      
      // Redirect to confirmation page directly
      window.location.href = `/cart/${bookingId}?payment_status=success&admin_booking=true`;
      
    } catch (error) {
      console.error('Admin booking error:', error);
      alert(`${t('checkout.adminBookingError')}: ${error instanceof Error ? error.message : String(error)}. ${t('checkout.tryAgainLater')}`);
    } finally {
      setIsProcessingPayment(false);
    }
  }, [
    bookingDetails, 
    contactDetails, // Use aggregated contact details
    finalNotes,     // Use final notes
    totalServicesCost, 
    cartTotals,
    selectedServices,
    t
  ]);

  // Callback handlers for child components
  const handleNotesChange = useCallback((newNotes: string) => {
    setFinalNotes(newNotes);
  }, []);

  const handleContactInfoChange = useCallback((newDetails: ContactDetails) => {
    setContactDetails(newDetails);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="flex-grow container mx-auto sm:px-4 py-8 space-y-8">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            className="mb-6 text-gray-600 hover:text-gray-900"
            onClick={handleGoBack}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            {t('checkout.backToRooms')}
          </Button>

          <div className="space-y-8">
            <Card className="p-1 sm:p-6 sm:shadow-md sm:border">
              {/* Additional Services Section */}
              <section>
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 bg-gray-900 text-white rounded-full font-bold text-lg">3</div>
                  <h2 className="text-xl font-semibold">{t('checkout.additionalServicesTitle')}</h2>
                </div>
                <p className="text-gray-600 mt-4 mb-4">
                  {t('checkout.additionalServicesDescription')}
                </p>
                
                {servicesLoading ? (
                  <div className="py-4 text-center">{t('checkout.loadingServices')}</div>
                ) : services.length === 0 ? (
                  <div className="py-4 text-center">{t('checkout.noServicesAvailable')}</div>
                ) : (
                  <div className="space-y-4">
                    {services.map(service => (
                      <div key={service.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            id={`service-${service.id}`}
                            checked={selectedServices.some(s => s.id === service.id)}
                            onCheckedChange={(checked: boolean) => 
                              handleServiceChange(service, checked)
                            }
                          />
                          <label htmlFor={`service-${service.id}`}>{service.description}</label>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {service.requestQuantity && selectedServices.some(s => s.id === service.id) && (
                            <Select 
                              value={selectedServices.find(s => s.id === service.id)?.quantity.toString() || "1"}
                              onValueChange={(value: string) => handleQuantityChange(service.id, parseInt(value))}
                            >
                              <SelectTrigger className="w-20">
                                <SelectValue placeholder={t('checkout.quantityPlaceholder')} />
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
                    {t('checkout.totalAdditionalServices')}: €{totalServicesCost.toFixed(2)}
                  </div>
                )}
              </section>
            </Card>

            <Card className="p-1 sm:p-6 sm:shadow-md sm:border">
              {/* Use NotesSection component */}
              <NotesSection 
                initialNotes={finalNotes} 
                onNotesChange={handleNotesChange}
                t={t}
              />
            </Card>

            <Card className="p-1 sm:p-6 sm:shadow-md sm:border">
              {/* Use ContactInfoSection component */}
              <ContactInfoSection 
                onContactInfoChange={handleContactInfoChange}
                t={t}
              />
            </Card>

            <Card className="p-1 sm:p-6 sm:shadow-md sm:border">
              {/* Booking Summary */}
              <section>
                <h2 className="text-xl font-semibold mb-4">{t('checkout.bookingSummary')}</h2>
                
                {bookingDetails.rooms.map((room) => {
                  const roomGuests = bookingDetails.assignedGuests.filter(guest => guest.roomId === room.roomId);
                  
                  if (roomGuests.length === 0) return null;
                  
                  const accommodationType = bookingDetails.pensionType === 'bb' ? t('common.bb') : t('common.hb');
                  
                  return (
                    <div key={room.roomId} className="space-y-4 mb-6">
                      <h3 className="font-semibold">{room.description}</h3>
                      <div className="space-y-2 text-gray-600">
                        <p>{t('checkout.stay')}: {formatDate(bookingDetails.checkIn)} - {formatDate(bookingDetails.checkOut)}</p>
                        <p>{t('checkout.numGuests')}: {roomGuests.length} ({
                          [
                            `${roomGuests.filter(g => g.type === 'adult').length} ${t('booking.adults')}`,
                            roomGuests.filter(g => g.type === 'child').length > 0 ? `${roomGuests.filter(g => g.type === 'child').length} ${t('booking.children')}` : null,
                            roomGuests.filter(g => g.type === 'infant').length > 0 ? `${roomGuests.filter(g => g.type === 'infant').length} ${t('booking.infants')}` : null
                          ].filter(Boolean).join(', ')
                        })</p>
                        <p>{t('checkout.accommodation')}: {accommodationType}</p>
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
                                <span>{t(`room.${guest.type}Label`)} - {bed.name}</span>
                                <span>€{finalPrice.toFixed(2)}</span>
                              </div>
                            );
                          })}
                        
                        {bookingDetails.roomPrivacyCosts[room.roomId] > 0 && (
                          <div className="flex justify-between">
                            <span>{t('cart.privacySupplement')}</span>
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
                      <span>{t('cart.additionalServices')}</span>
                      <span>€{totalServicesCost.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <div className="flex items-center gap-1">
                      <span>{t('cart.tax')}</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-4 h-4 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('confirmation.cityTaxInfo')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <span>€{cartTotals.cityTaxTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Cancellation Policy */}
                <div className="mt-6 space-y-4">
                  <p className="text-gray-600">{t('checkout.completeBookingInstruction')}</p>
                  <div className="bg-gray-50  rounded-lg">
                    <p className="font-semibold mb-2">{t('checkout.cancellationTitle')}:</p>
                    <p className="text-sm">{t('checkout.cancellationInstructions')}</p>
                    <p className="text-sm">{t('checkout.groupBookingWarning')}</p>
                  </div>
                  <div>
                    <p className="font-semibold">{t('checkout.refundPolicyTitle')}:</p>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>{t('checkout.refundPolicy7Days')}</li>
                      <li>{t('checkout.refundPolicyLess7Days')}</li>
                      <li>{t('checkout.refundPolicySameDay')}</li>
                    </ul>
                  </div>
                </div>

                {/* Total and Submit */}
                <div className="mt-6 border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold">{t('cart.total')}</span>
                    <span className="font-semibold text-xl">€{cartTotals.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-end">
                    <Button 
                      className="bg-gray-600 hover:bg-gray-700 text-white"
                      onClick={isAdminBooking ? handleAdminBookingSubmit : handleProceedToPayment}
                      disabled={!formValid || isProcessingPayment}
                    >
                      {isProcessingPayment ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t('checkout.processing')}
                        </>
                      ) : (
                        isAdminBooking ? t('checkout.confirmBooking') : t('checkout.goToPayment')
                      )}
                    </Button>
                  </div>
                </div>
              </section>
            </Card>
          </div>
        </div>
      </main>

      {/* Payment Instructions Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('checkout.proceedWithPayment')}</DialogTitle>
            <DialogDescription>
              <p className="mt-4">
                {t('checkout.paymentWindowDescription')}
              </p>
              <ol className="list-decimal list-inside mt-4 space-y-2">
                <li>{t('checkout.paymentStep1')}</li>
                <li>{t('checkout.paymentStep2')}</li>
                <li>{t('checkout.paymentStep3')}</li>
              </ol>
              <p className="mt-4 text-sm text-gray-500">
                {t('checkout.paymentTroubleshooting')}
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setShowPaymentDialog(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleOpenStripeCheckout}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              {t('checkout.openPaymentPage')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheckoutPage;