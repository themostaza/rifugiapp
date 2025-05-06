'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, Check, Download, ArrowRight, Mail, AlertCircle, Info } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import Header from '@/components/header/header'
import Footer from '@/components/footer/footer'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"

interface FormattedGuest {
  specId: number;
  guestType: string; // e.g., 'Adulti', 'Bambini', 'Neonati'
  bedName: string;
  price: number; // Price for this guest/bed
}

interface FormattedService {
  linkId: number;
  serviceId: number;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number; // quantity * unitPrice
}

// Define structure for privacy block details from API
interface PrivacyBlockDetail {
  day: string;
  beds: Array<{
    id: number;
    name: string;
  }>;
}

interface FormattedRoom {
  roomId: number;
  roomDescription: string;
  guests: FormattedGuest[];
  privacyBlocks: PrivacyBlockDetail[]; // Added
}

interface BookingData {
  id: number; // Basket ID (Numero prenotazione)
  external_id: string; // External ID from URL
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestRegion: string;
  reservationType: string; // 'bb' or 'hb'
  totalPrice: number; // Basket total price
  isPaid: boolean;
  isCancelled: boolean;
  createdAt: string;
  stripeId: string; // Payment ID
  isCreatedByAdmin: boolean;
  cityTaxTotal: number; // Calculated total city tax from API
  totalPrivacyCost: number; // Added: Sum of bedBlockPriceTotal from RoomReservations
  services: FormattedService[]; // Added: Top-level services
  rooms: FormattedRoom[]; // Use the updated FormattedRoom structure
  note: string | null; // Guest notes
}

export default function ConfirmationPage() {
  const [language, setLanguage] = useState('it')
  const [bookingData, setBookingData] = useState<BookingData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showRefundDialog, setShowRefundDialog] = useState(false)
  const [refundMessage, setRefundMessage] = useState('')
  const params = useParams()
  const bookingExternalId = params.id as string


  useEffect(() => {
    const fetchBookingDetails = async () => {
      try {
        const response = await fetch(`/api/booking-details?external_id=${bookingExternalId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch booking details')
        }
        const data = await response.json()
        setBookingData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchBookingDetails()
  }, [bookingExternalId])

  const handleCancelBooking = async () => {
    try {
      const response = await fetch('/api/cancel-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          external_id: bookingExternalId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel booking');
      }

      const data = await response.json();
      
      // Refresh booking data after cancellation
      const updatedResponse = await fetch(`/api/booking-details?external_id=${bookingExternalId}`);
      const updatedData = await updatedResponse.json();
      setBookingData(updatedData);

      // Solo per le prenotazioni normali (non admin) mostriamo il popup di conferma
      if (!data.isAdminBooking) {
        // Prepare refund message
        let message = 'La prenotazione è stata cancellata con successo.\n\n';
        
        if (data.refundAmount) {
          message += `Riceverai un rimborso di €${data.refundAmount.toFixed(2)}.\n`;
          message += 'Ti abbiamo inviato una email con i dettagli del rimborso.\n';
        } else {
          message += 'Non è previsto alcun rimborso secondo la nostra politica di cancellazione.\n';
        }
        
        message += '\nTi abbiamo inviato una email di conferma con tutti i dettagli.';
        
        setRefundMessage(message);
        setShowRefundDialog(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel booking');
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    })
  }

  const isBeforeCheckIn = () => {
    if (!bookingData) return false;
    const currentDate = new Date();
    const checkInDate = new Date(bookingData.checkIn);
    return currentDate < checkInDate;
  }

  const handleDownloadPDF = () => {
    if (!bookingData) return;

    // Create a new window with the print content
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      let htmlContent = `
        <html>
          <head>
            <title>Rifugio A. Dibona - Prenotazione ${bookingData.id}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
              h1, h2, h3 { margin-bottom: 10px; }
              h1 { font-size: 20px; }
              h2 { font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 20px; }
              h3 { font-size: 14px; font-weight: bold; margin-top: 15px; }
              .header { text-align: center; margin-bottom: 30px; }
              .section { margin-bottom: 20px; }
              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; margin-bottom: 15px; }
              .details-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              .details-table th, .details-table td { border: 1px solid #eee; padding: 6px; text-align: left; }
              .details-table th { background-color: #f8f8f8; font-weight: bold; }
              .details-table td:last-child { text-align: right; }
              .total-row td { font-weight: bold; border-top: 2px solid #aaa; }
              .label { color: #555; font-size: 11px; display: block; margin-bottom: 2px; }
              .value { font-weight: bold; }
              .footer-notes { margin-top: 30px; font-size: 10px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Rifugio Angelo Dibona</h1>
              <h2>Conferma Prenotazione</h2>
            </div>
            
            <div class="section">
              <h3>Dettagli della prenotazione</h3>
              <div class="grid">
                <div>
                  <div class="label">Numero prenotazione</div>
                  <div class="value">${bookingData.id}</div>
                </div>
                <div>
                  <div class="label">ID Pagamento (Stripe)</div>
                  <div class="value">${bookingData.stripeId || 'N/A'}</div>
                </div>
                <div>
                  <div class="label">Check-in</div>
                  <div class="value">${formatDate(bookingData.checkIn)}</div>
                </div>
                <div>
                  <div class="label">Check-out</div>
                  <div class="value">${formatDate(bookingData.checkOut)}</div>
                </div>
                 <div>
                  <div class="label">Tipo Pernottamento</div>
                  <div class="value">${getAccommodationType(bookingData.reservationType)}</div>
                </div>
                <div>
                  <div class="label">Nome ospite</div>
                  <div class="value">${bookingData.guestName}</div>
                </div>
                <div>
                  <div class="label">Email</div>
                  <div class="value">${bookingData.guestEmail}</div>
                </div>
                <div>
                  <div class="label">Telefono</div>
                  <div class="value">${bookingData.guestPhone}</div>
                </div>
              </div>
            </div>

            ${ /* Add Notes section if available */
              (bookingData.note && bookingData.note.trim() !== '') ? `
              <div class="section">
                <h3>Note</h3>
                <p style="white-space: pre-line; font-size: 12px; color: #333;">${bookingData.note}</p>
              </div>
              ` : ''
            }

            <div class="section footer-notes">
              <h3>Contatti e Note</h3>
              <p>Per qualsiasi informazione o richiesta, puoi contattare il gestore al numero +39 0436 860294 / +39 333 143 4408 
              oppure inviando una mail a rifugiodibona@gmail.com</p>
              <p>Il presente documento non ha valore ai fini fiscali.</p>
              <p>Orario check-in: dalle 15:00 alle 19:00. Orario check-out: entro le 09:00.</p>
            </div>
          </body>
        </html>
      `;

      let totalRoomSubtotal = 0; // Declare totalRoomSubtotal here
      // Start iterating through rooms
      bookingData.rooms.forEach(room => {
        let roomSubtotal = 0;
        htmlContent += `
          <div class="section">
            <h3>${room.roomDescription}</h3>
            <table class="details-table">
              <thead>
                <tr>
                  <th>Ospite / Letto</th>
                  <th>Prezzo</th>
                </tr>
              </thead>
              <tbody>
        `;
        // Guests/Beds for the room
        room.guests.forEach(guest => {
          htmlContent += `
            <tr>
              <td>${guest.guestType} - ${guest.bedName}</td>
              <td>€${guest.price.toFixed(2)}</td>
            </tr>
          `;
          roomSubtotal += guest.price;
        });
        htmlContent += `
              </tbody>
            </table>

            ${room.privacyBlocks.length > 0 ? `
            <h4 style="font-size: 13px; margin-top: 10px; margin-bottom: 5px;">Letti Bloccati per Privacy:</h4>
            <table class="details-table">
              <thead>
                <tr>
                  <th>Giorno</th>
                  <th>Letti Bloccati</th>
                </tr>
              </thead>
              <tbody>
                ${room.privacyBlocks.map(block => `
                  <tr>
                    <td>${formatDate(block.day)}</td>
                    <td>${block.beds.map(b => b.name).join(', ')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ` : ''}
          </div>
        `;
        totalRoomSubtotal += roomSubtotal;
      });

      // Services
      let servicesSubtotal = 0;
      if (bookingData.services && bookingData.services.length > 0) {
        htmlContent += `
          <div class="section">
            <h3>Servizi Aggiuntivi</h3>
            <table class="details-table">
              <thead>
                <tr>
                  <th>Servizio</th>
                  <th>Quantità</th>
                  <th>Prezzo Unitario</th>
                  <th>Totale</th>
                </tr>
              </thead>
              <tbody>
        `;
        bookingData.services.forEach(service => {
          htmlContent += `
            <tr>
              <td>${service.description}</td>
              <td>${service.quantity}</td>
              <td>€${service.unitPrice.toFixed(2)}</td>
              <td>€${service.totalPrice.toFixed(2)}</td>
            </tr>
          `;
          servicesSubtotal += service.totalPrice;
        });
        htmlContent += `
              </tbody>
            </table>
          </div>
        `;
      }



      // Summary
      htmlContent += `
        <div class="section">
          <h2>Riepilogo Costi</h2>
          <table class="details-table">
            <tbody>
              <tr>
                <td>Subtotale Camere/Ospiti</td>
                <td>€${totalRoomSubtotal.toFixed(2)}</td>
              </tr>
              ${bookingData.totalPrivacyCost > 0 ? `
              <tr>
                <td>Supplemento Privacy</td>
                <td>€${bookingData.totalPrivacyCost.toFixed(2)}</td>
              </tr>
              ` : ''}
              ${servicesSubtotal > 0 ? `
              <tr>
                <td>Servizi Aggiuntivi</td>
                <td>€${servicesSubtotal.toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr>
                <td>Tassa di Soggiorno</td>
                <td>€${bookingData.cityTaxTotal.toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td>Totale Prenotazione (IVA Incl.)</td>
                <td>€${bookingData.totalPrice.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

      htmlContent += `
        <div class="footer-notes">
          <p>Grazie per aver scelto il Rifugio Angelo Dibona.</p>
          <p>Indirizzo: Località Val Ampezzo - 32043 Cortina d'Ampezzo (BL)</p>
          <p>Email: rifugiodibona@gmail.com</p>
          <p>Telefono: +39 0436 860294 / +39 333 143 4408</p>
          <p>Website: www.rifugiodibona.com</p>
        </div>
      `;

      htmlContent += `
          </body>
        </html>
      `;
          
      printWindow.document.write(htmlContent);
      printWindow.document.close(); // Needed for some browsers
      printWindow.focus(); // Needed for some browsers
      
      // Give the browser a moment to load content before printing
      setTimeout(() => {
          printWindow.print();
          // Optional: close the window after printing
          // printWindow.close(); 
      }, 500); // Adjust delay if needed
    } else {
      alert('Impossibile aprire la finestra di stampa. Controlla le impostazioni del tuo browser (popup blocker).');
    }
  }

  // Helper to get accommodation type description
  const getAccommodationType = (type: string) => {
    return type === 'bb' ? 'Bed & Breakfast' : type === 'hb' ? 'Mezza Pensione' : 'Sconosciuto';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header language={language} onLanguageChange={setLanguage} />
        <main className="flex-grow container mx-auto px-4 py-8">
          <Card className="p-6 max-w-4xl mx-auto">
            <div className="text-center">Loading...</div>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !bookingData) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header language={language} onLanguageChange={setLanguage} />
        <main className="flex-grow container mx-auto px-4 py-8">
          <Card className="p-6 max-w-4xl mx-auto">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error || 'Booking not found'}
              </AlertDescription>
            </Alert>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header 
        language={language}
        onLanguageChange={setLanguage}
      />

      <main className="flex-grow container mx-auto sm:px-4 py-4 sm:py-8">
        <Card className=" sm:p-6 max-w-4xl mx-auto border-green-100 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3 mb-4">
              <div className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full ${bookingData.isCancelled ? 'bg-red-100' : 'bg-green-100'}`}>
                {bookingData.isCancelled ? (
                  <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                ) : (
                  <Check className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                )}
              </div>
              <CardTitle className={`text-xl sm:text-2xl font-bold ${bookingData.isCancelled ? 'text-red-700' : 'text-green-700'}`}>
                {bookingData.isCancelled ? 'Prenotazione cancellata' : 'Prenotazione confermata!'}
              </CardTitle>
            </div>
            <CardDescription className="text-sm sm:text-base">
              {bookingData.isCancelled 
                ? 'La tua prenotazione presso Rifugio Angelo Dibona è stata cancellata.'
                : 'La tua prenotazione presso Rifugio Angelo Dibona è stata confermata con successo. Un\'email di conferma è stata inviata al tuo indirizzo email.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 sm:space-y-6 pt-4">
            {/* Dettagli prenotazione - General Info Section */} 
            <div className="bg-gray-50 sm:p-5 rounded-lg border border-gray-100">
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Dettagli della prenotazione</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-gray-500">Numero prenotazione</p>
                  <p className="font-medium break-all">{bookingData.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">ID Pagamento (Stripe)</p>
                  <p className="font-medium break-all">{bookingData.stripeId || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Check-in</p>
                  <p className="font-medium flex items-center">
                    <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                    {formatDate(bookingData.checkIn)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Check-out</p>
                  <p className="font-medium flex items-center">
                    <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                    {formatDate(bookingData.checkOut)}
                  </p>
                </div>
                 <div>
                  <p className="text-sm text-gray-500">Tipo Pernottamento</p>
                  <p className="font-medium">{getAccommodationType(bookingData.reservationType)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Nome ospite</p>
                  <p className="font-medium">{bookingData.guestName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium break-all">{bookingData.guestEmail}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Telefono</p>
                  <p className="font-medium">{bookingData.guestPhone}</p>
                </div>
                {/* Region might be useful for admin? 
                <div>
                  <p className="text-sm text-gray-500">Regione/Nazione</p>
                  <p className="font-medium">{bookingData.guestRegion}</p>
                </div>
                */}
              </div>
            </div>

            {/* Guest Notes Section */}
            {bookingData.note && bookingData.note.trim() !== '' && (
              <div className="p-3 sm:p-5 rounded-lg border border-gray-100 mb-4 sm:mb-6 bg-gray-50">
                <h2 className="text-base sm:text-lg font-semibold mb-2">Note</h2>
                <p className="text-sm sm:text-base text-gray-700 whitespace-pre-line">{bookingData.note}</p>
              </div>
            )}

            {/* =================================== */}
            {/* Detailed Booking Summary (Receipt) */}
            {/* =================================== */}
            <div className="bg-white sm:p-5 rounded-lg border border-gray-200 shadow-sm">
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Riepilogo Costi</h2>
              
              {/* Iterate through rooms */} 
              {bookingData.rooms.map((room) => (
                <div key={room.roomId} className="mb-4 pb-4 border-b last:border-b-0">
                  <h3 className="font-semibold text-sm sm:text-base mb-2">{room.roomDescription}</h3>
                  <div className="space-y-1 text-xs sm:text-sm">
                    {/* Iterate through guests in the room */} 
                    {room.guests.map((guest) => (
                      <div key={guest.specId} className="flex justify-between">
                        <span>{guest.guestType} - {guest.bedName}</span>
                        <span>€{guest.price.toFixed(2)}</span>
                      </div>
                    ))}
                    
                    {/* Show detailed privacy blocks if available */}
                    {room.privacyBlocks && room.privacyBlocks.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-dashed border-gray-200 text-xs text-gray-500">
                        <p className="font-medium text-gray-600 mb-1">Letti bloccati (Privacy):</p>
                        {room.privacyBlocks.map((block, index) => (
                          <div key={index} className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="font-medium">{formatDate(block.day)}:</span>
                            {block.beds.map(b => (
                              <Badge key={b.id} variant="secondary" className="text-xs px-1.5 py-0.5">{b.name}</Badge>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Services Section (only if top-level services exist) */} 
              {bookingData.services && bookingData.services.length > 0 && (
                  <div className="mb-4 pb-4 border-b">
                    <h3 className="font-semibold text-sm sm:text-base mb-2">Servizi Aggiuntivi</h3>
                    <div className="space-y-1 text-xs sm:text-sm">
                        {bookingData.services.map((service) => (
                            <div key={service.linkId} className="flex justify-between">
                                <span>{service.description} (x{service.quantity})</span>
                                <span>€{service.totalPrice.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                  </div>
              )}

              {/* City Tax */} 
              <div className="flex justify-between text-xs sm:text-sm mb-2 text-gray-600">
                <div className="flex items-center gap-1">
                  <span>Tassa di soggiorno</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                         <Info className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Tassa di soggiorno applicata per legge ({/* We might need more details here like price/person/night */})</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span>€{bookingData.cityTaxTotal.toFixed(2)}</span>
              </div>

              {/* Display Total Privacy Cost if applicable */} 
              {bookingData.totalPrivacyCost > 0 && (
                <div className="flex justify-between text-xs sm:text-sm mb-2 text-gray-600">
                    <span>Supplemento privacy totale</span>
                    <span>€{bookingData.totalPrivacyCost.toFixed(2)}</span>
                </div>
              )}

              {/* Total Price */} 
              <div className="flex justify-between font-semibold text-sm sm:text-base pt-3 border-t">
                <span>Totale (IVA inclusa)</span>
                <span>€{bookingData.totalPrice.toFixed(2)}</span>
              </div>
            </div>

            {/* Contatti - always visible */}
            <div className="bg-gray-100 sm:p-5 rounded-lg">
              <h2 className="text-base sm:text-lg font-semibold mb-2">Hai domande?</h2>
              <p className="text-xs sm:text-sm text-gray-600">
                Per qualsiasi informazione o richiesta, puoi contattare il gestore al numero +39 0436 860294 / +39 333 143 4408 
                oppure inviando una mail a <a href="mailto:rifugiodibona@gmail.com" className="text-blue-600 hover:underline">rifugiodibona@gmail.com</a>.
              </p>
            </div>

            {!bookingData.isCancelled && (
              <>
                {/* Cosa fare ora - only for active bookings */}
                <div className="bg-blue-50 p-2 sm:p-5 rounded-lg border border-blue-100 space-y-3 sm:space-y-4">
                  <h2 className="text-base sm:text-lg font-semibold text-blue-800">Cosa fare ora?</h2>
                  
                  <div className="flex items-start gap-2 sm:gap-3">
                    <Download className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm sm:text-base text-blue-800">Scarica la conferma della prenotazione</p>
                      <p className="text-xs sm:text-sm text-blue-700">Potrai mostrarla al tuo arrivo al rifugio.</p>
                      <Button 
                        variant="link" 
                        className="h-7 sm:h-8 px-0 text-blue-600 hover:text-blue-800 text-sm sm:text-base"
                        onClick={handleDownloadPDF}
                      >
                        Scarica PDF
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 sm:gap-3">
                    <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm sm:text-base text-blue-800">Controlla la tua email</p>
                      <p className="text-xs sm:text-sm text-blue-700">
                        Ti abbiamo inviato un&apos;email di conferma con tutti i dettagli della tua prenotazione.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 sm:gap-3">
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm sm:text-base text-blue-800">Preparati per il tuo soggiorno</p>
                      <p className="text-xs sm:text-sm text-blue-700">
                        Il Rifugio Angelo Dibona si trova a 2083m s.l.m. Ti consigliamo di portare abbigliamento adeguato alla montagna.
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 pt-4">
                  <Button 
                    className="bg-gray-900 hover:bg-gray-700 w-full sm:w-auto px-8"
                    asChild
                  >
                    <Link href="/">
                      Torna alla home
                    </Link>
                  </Button>

                  {/* Mostra il pulsante di cancellazione per tutte le prenotazioni non cancellate, 
                      indipendentemente dal fatto che siano create dall\'admin o meno */}
                  {isBeforeCheckIn() ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full sm:w-auto px-8">
                          Elimina prenotazione
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="w-[90%] sm:w-full max-w-md mx-auto">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Vuoi davvero cancellare la prenotazione?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {bookingData.isCreatedByAdmin 
                              ? 'Questa prenotazione è stata creata dall\'amministratore. La cancellazione non comporterà rimborsi.'
                              : 'Questa azione non può essere annullata. La tua prenotazione verrà cancellata e riceverai un rimborso in base alle nostre politiche di rimborso.'}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={handleCancelBooking} className="bg-red-600 hover:bg-red-700">
                            Conferma cancellazione
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </div>
              </>
            )}

            {bookingData.isCancelled && (
              <div className="flex justify-center pt-4">
                <Button 
                  className="bg-gray-900 hover:bg-gray-700 w-full sm:w-auto px-8"
                  asChild
                >
                  <Link href="/">
                    Torna alla home
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Refund Information Dialog */}
      <AlertDialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <AlertDialogContent className="w-[90%] sm:w-full max-w-md mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancellazione Completata</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {refundMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowRefundDialog(false)} className="bg-gray-900 hover:bg-gray-700">
              Ho capito
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  )
}