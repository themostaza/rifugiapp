'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Calendar, Check, Download, ArrowRight, Mail, AlertCircle, Info, Clock, Copy } from 'lucide-react'
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
  const params = useParams();
  const locale = (params.locale as string) || 'it';
  const bookingExternalId = params.id as string;
  
  const [language, setLanguage] = useState(locale);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [refundMessage, setRefundMessage] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Bed removal states
  const [showBedRemovalDialog, setShowBedRemovalDialog] = useState(false);
  const [selectedBedsToRemove, setSelectedBedsToRemove] = useState<number[]>([]);
  const [bedRemovalMessage, setBedRemovalMessage] = useState('');
  const [showBedRemovalResultDialog, setShowBedRemovalResultDialog] = useState(false);
  
  // Traduzioni principali
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [translations, setTranslations] = useState<Record<string, any>>({});
  
  // Carica le traduzioni dalla cartella messages
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const confirmationTranslations = await import(`../../../../../messages/${language}.json`)
          .then(module => module.default.confirmation);
        const commonTranslations = await import(`../../../../../messages/${language}.json`)
          .then(module => module.default.common);
        const cartTranslations = await import(`../../../../../messages/${language}.json`)
          .then(module => module.default.cart);
        const pdfTranslations = await import(`../../../../../messages/${language}.json`)
          .then(module => module.default.pdf);
          
        setTranslations({
          ...confirmationTranslations,
          ...commonTranslations,
          cart: cartTranslations,
          pdf: pdfTranslations,
          pendingPayment: 'Prenotazione in attesa di pagamento',
          pendingPaymentMessage: 'La tua prenotazione è stata registrata ma è in attesa di pagamento. Completa il pagamento per confermare la prenotazione.',
          completePayment: 'Completa pagamento'
        });
      } catch (error) {
        console.error("Failed to load translations:", error);
        // Fallback a italiano se c'è un errore
        const fallbackTranslations = await import(`../../../../../messages/it.json`)
          .then(module => module.default);
        setTranslations({
          ...fallbackTranslations.confirmation,
          ...fallbackTranslations.common,
          cart: fallbackTranslations.cart,
          pdf: fallbackTranslations.pdf,
          pendingPayment: 'Prenotazione in attesa di pagamento',
          pendingPaymentMessage: 'La tua prenotazione è stata registrata ma è in attesa di pagamento. Completa il pagamento per confermare la prenotazione.',
          completePayment: 'Completa pagamento'
        });
      }
    };
    
    loadTranslations();
  }, [language]);

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
        let message = translations.bookingCancelledSuccess || 'La prenotazione è stata cancellata con successo.\n\n';
        
        if (data.refundAmount) {
          message += (translations.refundAmount || 'Riceverai un rimborso di €{amount}.\n').replace('{amount}', data.refundAmount.toFixed(2));
          message += translations.refundEmailSent || 'Ti abbiamo inviato una email con i dettagli del rimborso.\n';
        } else {
          message += translations.noRefundPolicy || 'Non è previsto alcun rimborso secondo la nostra politica di cancellazione.\n';
        }
        
        message += '\n' + (translations.confirmationEmailSent || 'Ti abbiamo inviato una email di conferma con tutti i dettagli.');
        
        setRefundMessage(message);
        setShowRefundDialog(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (translations.failedToCancel || 'Failed to cancel booking'));
    }
  }

  const formatDate = (dateString: string) => {
    // Estrai la parte della data dalla stringa ISO (YYYY-MM-DD)
    const datePart = dateString.split('T')[0];
    // Dividi in anno, mese, giorno
    const [year, month, day] = datePart.split('-');
    // Formatta nel formato italiano (DD/MM/YYYY)
    return `${day}/${month}/${year}`;
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
            <title>${translations.pdf?.title || 'Rifugio A. Dibona'} - ${translations.pdf?.bookingNumber || 'Prenotazione'} ${bookingData.id}</title>
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
              <h1>${translations.pdf?.title || 'Rifugio Angelo Dibona'}</h1>
              <h2>${translations.pdf?.subtitle || 'Conferma Prenotazione'}</h2>
            </div>
            
            <div class="section">
              <h3>${translations.pdf?.details || 'Dettagli della prenotazione'}</h3>
              <div class="grid">
                <div>
                  <div class="label">${translations.pdf?.bookingNumber || 'Numero prenotazione'}</div>
                  <div class="value">${bookingData.id}</div>
                </div>
                <div>
                  <div class="label">${translations.pdf?.paymentId || 'ID Pagamento (Stripe)'}</div>
                  <div class="value">${bookingData.stripeId || 'N/A'}</div>
                </div>
                <div>
                  <div class="label">${translations.pdf?.checkIn || 'Check-in'}</div>
                  <div class="value">${formatDate(bookingData.checkIn)}</div>
                </div>
                <div>
                  <div class="label">${translations.pdf?.checkOut || 'Check-out'}</div>
                  <div class="value">${formatDate(bookingData.checkOut)}</div>
                </div>
                 <div>
                  <div class="label">${translations.pdf?.guestType || 'Tipo Pernottamento'}</div>
                  <div class="value">${getAccommodationType(bookingData.reservationType)}</div>
                </div>
                <div>
                  <div class="label">${translations.pdf?.guestName || 'Nome ospite'}</div>
                  <div class="value">${bookingData.guestName}</div>
                </div>
                <div>
                  <div class="label">${translations.pdf?.email || 'Email'}</div>
                  <div class="value">${bookingData.guestEmail}</div>
                </div>
                <div>
                  <div class="label">${translations.pdf?.phone || 'Telefono'}</div>
                  <div class="value">${bookingData.guestPhone}</div>
                </div>
              </div>
            </div>

            ${ /* Add Notes section if available */
              (bookingData.note && bookingData.note.trim() !== '') ? `
              <div class="section">
                <h3>${translations.pdf?.notes || 'Note'}</h3>
                <p style="white-space: pre-line; font-size: 12px; color: #333;">${bookingData.note}</p>
              </div>
              ` : ''
            }

            <div class="section footer-notes">
              <h3>${translations.pdf?.contactNotesTitle || 'Contatti e Note'}</h3>
              <p>${translations.contactInfo || 'Per qualsiasi informazione o richiesta, puoi contattare il gestore al numero +39 0436 860294 / +39 333 143 4408 oppure inviando una mail a rifugiodibona@gmail.com'}</p>
              <p>${translations.pdf?.notLegalDocument || 'Il presente documento non ha valore ai fini fiscali.'}</p>
              <p>${translations.pdf?.checkInOutTimes || 'Orario check-in: dalle 15:00 alle 19:00. Orario check-out: entro le 09:00.'}</p>
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
                  <th>${translations.pdf?.guest || 'Ospite / Letto'}</th>
                  <th>${translations.pdf?.price || 'Prezzo'}</th>
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
            <h4 style="font-size: 13px; margin-top: 10px; margin-bottom: 5px;">${translations.pdf?.blockedBedsTitle || 'Letti Bloccati per Privacy'}:</h4>
            <table class="details-table">
              <thead>
                <tr>
                  <th>${translations.pdf?.day || 'Giorno'}</th>
                  <th>${translations.pdf?.blockedBeds || 'Letti Bloccati'}</th>
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
            <h3>${translations.pdf?.additionalServices || 'Servizi Aggiuntivi'}</h3>
            <table class="details-table">
              <thead>
                <tr>
                  <th>${translations.pdf?.service || 'Servizio'}</th>
                  <th>${translations.pdf?.quantity || 'Quantità'}</th>
                  <th>${translations.pdf?.unitPrice || 'Prezzo Unitario'}</th>
                  <th>${translations.pdf?.total || 'Totale'}</th>
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
          <h2>${translations.pdf?.summaryCosts || 'Riepilogo Costi'}</h2>
          <table class="details-table">
            <tbody>
              <tr>
                <td>${translations.pdf?.roomsSubtotal || 'Subtotale Camere/Ospiti'}</td>
                <td>€${totalRoomSubtotal.toFixed(2)}</td>
              </tr>
              ${bookingData.totalPrivacyCost > 0 ? `
              <tr>
                <td>${translations.pdf?.privacySupplement || 'Supplemento Privacy'}</td>
                <td>€${bookingData.totalPrivacyCost.toFixed(2)}</td>
              </tr>
              ` : ''}
              ${servicesSubtotal > 0 ? `
              <tr>
                <td>${translations.pdf?.additionalServices || 'Servizi Aggiuntivi'}</td>
                <td>€${servicesSubtotal.toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr>
                <td>${translations.pdf?.cityTax || 'Tassa di Soggiorno'}</td>
                <td>€${bookingData.cityTaxTotal.toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td>${translations.pdf?.bookingTotal || 'Totale Prenotazione (IVA Incl.)'}</td>
                <td>€${bookingData.totalPrice.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

      htmlContent += `
        <div class="footer-notes">
          <p>${translations.pdf?.thankYou || 'Grazie per aver scelto il Rifugio Angelo Dibona.'}</p>
          <p>${translations.pdf?.address || 'Indirizzo: Località Val Ampezzo - 32043 Cortina d\'Ampezzo (BL)'}</p>
          <p>${translations.pdf?.email || 'Email'}: rifugiodibona@gmail.com</p>
          <p>${translations.pdf?.phone || 'Telefono'}: +39 0436 860294 / +39 333 143 4408</p>
          <p>${translations.pdf?.website || 'Website'}: www.rifugiodibona.com</p>
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
      alert(translations.printWindowError || 'Impossibile aprire la finestra di stampa. Controlla le impostazioni del tuo browser (popup blocker).');
    }
  }

  // Helper to get accommodation type description
  const getAccommodationType = (type: string) => {
    if (type === 'bb') {
      return translations.bb || 'Bed & Breakfast';
    } else if (type === 'hb') {
      return translations.hb || 'Mezza Pensione';
    } else {
      return translations.unknown || 'Sconosciuto';
    }
  };

  const handleNameEdit = () => {
    if (!bookingData) return;
    setNewName(bookingData.guestName);
    setEditingName(true);
    // Focus on the input after it becomes visible
    setTimeout(() => {
      if (nameInputRef.current) {
        nameInputRef.current.focus();
      }
    }, 50);
  };

  const handleNameSave = async () => {
    if (!bookingData || !newName.trim()) {
      setEditingName(false);
      return;
    }

    try {
      const response = await fetch('/api/update-guest-name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          external_id: bookingExternalId,
          name: newName.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update name');
      }

      // Update local state with new name
      setBookingData({
        ...bookingData,
        guestName: newName.trim()
      });
      
      setEditingName(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update name');
      setEditingName(false);
    }
  };

  const handleNameCancel = () => {
    setEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      handleNameCancel();
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback method
      const textArea = document.createElement('textarea');
      textArea.value = window.location.href;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleBedRemoval = async () => {
    if (!bookingData || selectedBedsToRemove.length === 0) {
      setError(translations.noBedSelected || 'Seleziona almeno un letto da rimuovere');
      return;
    }

    try {
      const response = await fetch('/api/remove-beds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          external_id: bookingExternalId,
          bedsToRemove: selectedBedsToRemove
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove beds');
      }

      const data = await response.json();
      
      // Refresh booking data after bed removal
      const updatedResponse = await fetch(`/api/booking-details?external_id=${bookingExternalId}`);
      const updatedData = await updatedResponse.json();
      setBookingData(updatedData);

      // Prepare bed removal message
      let message = translations.bedsRemovedSuccess || 'I letti selezionati sono stati rimossi con successo dalla tua prenotazione.\n\n';
      
      if (data.refundAmount && data.refundAmount > 0) {
        message += (translations.partialRefundAmount || 'Riceverai un rimborso parziale di €{amount}.\n').replace('{amount}', data.refundAmount.toFixed(2));
        message += translations.bedRemovalRefundEmailSent || 'Ti abbiamo inviato una email con i dettagli del rimborso parziale.\n';
      } else if (data.isAdminBooking) {
        message += translations.noBedRemovalRefund || 'Questa prenotazione è stata creata dall\'amministratore. La rimozione dei letti non comporterà rimborsi.\n';
      } else {
        message += translations.noRefundPolicy || 'Non è previsto alcun rimborso secondo la nostra politica di cancellazione.\n';
      }
      
      message += '\n' + (translations.confirmationEmailSent || 'Ti abbiamo inviato una email di conferma con tutti i dettagli.');
      
      setBedRemovalMessage(message);
      setShowBedRemovalDialog(false);
      setShowBedRemovalResultDialog(true);
      setSelectedBedsToRemove([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : (translations.failedToRemoveBeds || 'Impossibile rimuovere i letti selezionati'));
    }
  };

  const calculatePartialRefund = () => {
    if (!bookingData || selectedBedsToRemove.length === 0) return 0;
    
    let totalBedAmount = 0;
    bookingData.rooms.forEach(room => {
      room.guests.forEach(guest => {
        if (selectedBedsToRemove.includes(guest.specId)) {
          totalBedAmount += guest.price;
        }
      });
    });

    // Apply same refund policy as booking cancellation
    if (bookingData.isCreatedByAdmin) return 0;
    
    const checkInDate = new Date(bookingData.checkIn);
    checkInDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const timeDifference = checkInDate.getTime() - today.getTime();
    const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));

    let refundPercentage = 0;
    if (daysDifference >= 7) refundPercentage = 1;
    else if (daysDifference >= 1) refundPercentage = 0.7;
    else refundPercentage = 0;

    return totalBedAmount * refundPercentage;
  };

  const toggleBedSelection = (specId: number) => {
    setSelectedBedsToRemove(prev => {
      if (prev.includes(specId)) {
        return prev.filter(id => id !== specId);
      } else {
        return [...prev, specId];
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header language={language} onLanguageChange={setLanguage} />
        <main className="flex-grow container mx-auto px-4 py-8">
          <Card className="p-6 max-w-4xl mx-auto">
            <div className="text-center">{translations.loading || 'Loading...'}</div>
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
                {error || (translations.bookingNotFound || 'Booking not found')}
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
        <Card className="sm:p-6 max-w-4xl mx-auto border-green-100 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3 mb-4">
              <div className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full ${
                bookingData.isCancelled ? 'bg-red-100' : 
                (bookingData.isPaid || bookingData.isCreatedByAdmin ? 'bg-green-100' : 'bg-yellow-100')
              }`}>
                {bookingData.isCancelled ? (
                  <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                ) : (
                  bookingData.isPaid || bookingData.isCreatedByAdmin ? (
                    <Check className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                  ) : (
                    <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
                  )
                )}
              </div>
              <CardTitle className={`text-xl sm:text-2xl font-bold ${
                bookingData.isCancelled ? 'text-red-700' : 
                (bookingData.isPaid || bookingData.isCreatedByAdmin ? 'text-green-700' : 'text-yellow-700')
              }`}>
                {bookingData.isCancelled 
                  ? (translations.cancelled || 'Prenotazione cancellata') 
                  : (bookingData.isPaid || bookingData.isCreatedByAdmin
                    ? (translations.confirmed || 'Prenotazione confermata!') 
                    : (translations.pendingPayment || 'Prenotazione in attesa di pagamento')
                  )
                }
              </CardTitle>
            </div>
            <CardDescription className="text-sm sm:text-base">
              {bookingData.isCancelled 
                ? (translations.bookingCancelledMessage || 'La tua prenotazione presso Rifugio Angelo Dibona è stata cancellata.')
                : (bookingData.isPaid || bookingData.isCreatedByAdmin
                  ? (translations.bookingConfirmedMessage || 'La tua prenotazione presso Rifugio Angelo Dibona è stata confermata con successo. Un\'email di conferma è stata inviata al tuo indirizzo email.')
                  : (translations.pendingPaymentMessage || 'La tua prenotazione è stata registrata ma è in attesa di pagamento. Completa il pagamento per confermare la prenotazione.')
                )
              }
            </CardDescription>
            
            {/* Save Link Banner */}
            <div className="mt-4 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2 sm:gap-3">
                <Info className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm sm:text-base text-blue-800 mb-1">
                    {translations.saveLinkTitle || 'Salva questo link'}
                  </p>
                  <p className="text-xs sm:text-sm text-blue-700 mb-2">
                    {translations.saveLinkMessage || 'Salva questo link per accedere alla tua prenotazione in futuro, anche se ti è stata inviata una mail riepilogativa'}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCopyLink}
                    className="h-7 sm:h-8 text-xs sm:text-sm border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    <Copy className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    {linkCopied ? (translations.linkCopied || 'Link copiato!') : (translations.copyLink || 'Copia link')}
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 sm:space-y-6 pt-4">
            {/* Dettagli prenotazione - General Info Section */} 
            <div className="bg-gray-50 sm:p-5 rounded-lg border border-gray-100">
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">{translations.bookingDetails || 'Dettagli della prenotazione'}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-gray-500">{translations.bookingNumber || 'Numero prenotazione'}</p>
                  <p className="font-medium break-all">{bookingData.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{translations.paymentId || 'ID Pagamento (Stripe)'}</p>
                  <p className="font-medium break-all">{bookingData.stripeId || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{translations.checkIn || 'Check-in'}</p>
                  <p className="font-medium flex items-center">
                    <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                    {formatDate(bookingData.checkIn)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{translations.checkOut || 'Check-out'}</p>
                  <p className="font-medium flex items-center">
                    <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                    {formatDate(bookingData.checkOut)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{translations.accomodationType || 'Tipo Pernottamento'}</p>
                  <p className="font-medium">{getAccommodationType(bookingData.reservationType)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{translations.guestName || 'Nome ospite'}</p>
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={handleNameKeyDown}
                        className="border-b border-gray-500 bg-transparent py-1 font-medium w-full focus:outline-none"
                        autoFocus
                      />
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={handleNameSave}
                        className="h-7 px-2"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <p 
                      className="font-medium cursor-pointer hover:underline flex items-center gap-1" 
                      onClick={handleNameEdit}
                    >
                      {bookingData.guestName}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500">{translations.email || 'Email'}</p>
                  <p className="font-medium break-all">{bookingData.guestEmail}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{translations.phone || 'Telefono'}</p>
                  <p className="font-medium">{bookingData.guestPhone}</p>
                </div>
              </div>
            </div>

            {/* Guest Notes Section */}
            {bookingData.note && bookingData.note.trim() !== '' && (
              <div className="p-3 sm:p-5 rounded-lg border border-gray-100 mb-4 sm:mb-6 bg-gray-50">
                <h2 className="text-base sm:text-lg font-semibold mb-2">{translations.notes || 'Note'}</h2>
                <p className="text-sm sm:text-base text-gray-700 whitespace-pre-line">{bookingData.note}</p>
              </div>
            )}

            {/* =================================== */}
            {/* Detailed Booking Summary (Receipt) */}
            {/* =================================== */}
            <div className="bg-white sm:p-5 rounded-lg border border-gray-200 shadow-sm">
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">{translations.cart?.summary || 'Riepilogo Costi'}</h2>
              
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
                        <p className="font-medium text-gray-600 mb-1">{translations.blockedBeds || 'Letti bloccati (Privacy)'}:</p>
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
                    <h3 className="font-semibold text-sm sm:text-base mb-2">{translations.cart?.additionalServices || 'Servizi Aggiuntivi'}</h3>
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
                  <span>{translations.cart?.tax || 'Tassa di soggiorno'}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                         <Info className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{translations.cityTaxInfo || 'Tassa di soggiorno applicata per legge'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span>€{bookingData.cityTaxTotal.toFixed(2)}</span>
              </div>

              {/* Display Total Privacy Cost if applicable */} 
              {bookingData.totalPrivacyCost > 0 && (
                <div className="flex justify-between text-xs sm:text-sm mb-2 text-gray-600">
                    <span>{translations.cart?.privacySupplement || 'Supplemento privacy totale'}</span>
                    <span>€{bookingData.totalPrivacyCost.toFixed(2)}</span>
                </div>
              )}

              {/* Total Price */} 
              <div className="flex justify-between font-semibold text-sm sm:text-base pt-3 border-t">
                <span>{translations.cart?.total || 'Totale (IVA inclusa)'}</span>
                <span>€{bookingData.totalPrice.toFixed(2)}</span>
              </div>
            </div>

            {/* Contatti - always visible */}
            <div className="bg-gray-100 sm:p-5 rounded-lg">
              <h2 className="text-base sm:text-lg font-semibold mb-2">{translations.questions || 'Hai domande?'}</h2>
              <p className="text-xs sm:text-sm text-gray-600">
                {translations.contactInfo || 'Per qualsiasi informazione o richiesta, puoi contattare il gestore al numero +39 0436 860294 / +39 333 143 4408 oppure inviando una mail a '} 
                <a href="mailto:rifugiodibona@gmail.com" className="text-blue-600 hover:underline">rifugiodibona@gmail.com</a>.
              </p>
            </div>

            {!bookingData.isCancelled && (
              <>
                {/* Cosa fare ora - only for active bookings */}
                <div className="bg-blue-50 p-2 sm:p-5 rounded-lg border border-blue-100 space-y-3 sm:space-y-4">
                  <h2 className="text-base sm:text-lg font-semibold text-blue-800">{translations.whatNext || 'Cosa fare ora?'}</h2>
                  
                  {bookingData.isPaid || bookingData.isCreatedByAdmin ? (
                    <>
                      <div className="flex items-start gap-2 sm:gap-3">
                        <Download className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm sm:text-base text-blue-800">{translations.downloadConfirmation || 'Scarica la conferma della prenotazione'}</p>
                          <p className="text-xs sm:text-sm text-blue-700">{translations.showOnArrival || 'Potrai mostrarla al tuo arrivo al rifugio.'}</p>
                          <Button 
                            variant="link" 
                            className="h-7 sm:h-8 px-0 text-blue-600 hover:text-blue-800 text-sm sm:text-base"
                            onClick={handleDownloadPDF}
                          >
                            {translations.downloadPDF || 'Scarica PDF'}
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 sm:gap-3">
                        <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm sm:text-base text-blue-800">{translations.checkEmail || 'Controlla la tua email'}</p>
                          <p className="text-xs sm:text-sm text-blue-700">
                            {translations.emailSentMessage || 'Ti abbiamo inviato un\'email di conferma con tutti i dettagli della tua prenotazione.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 sm:gap-3">
                        <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm sm:text-base text-blue-800">{translations.prepareForStay || 'Preparati per il tuo soggiorno'}</p>
                          <p className="text-xs sm:text-sm text-blue-700">
                            {translations.refugeInfo || 'Il Rifugio Angelo Dibona si trova a 2083m s.l.m. Ti consigliamo di portare abbigliamento adeguato alla montagna.'}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start gap-2 sm:gap-3">
                      <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm sm:text-base text-yellow-800">
                          {translations.pendingPayment || 'Completa il pagamento per confermare la prenotazione'}
                        </p>
                        <p className="text-xs sm:text-sm text-yellow-700 mb-2">
                          {translations.pendingPaymentMessage || 'La tua prenotazione non è ancora confermata. Completa il pagamento per confermarla.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 pt-4">
                  <Button 
                    className="bg-gray-900 hover:bg-gray-700 w-full sm:w-auto px-8"
                    asChild
                  >
                    <Link href="/">
                      {translations.backToHome || 'Torna alla home'}
                    </Link>
                  </Button>

                  {/* Pulsante di modifica per rimuovere letti - SOLO per prenotazioni PAGATE o ADMIN */}
                  {isBeforeCheckIn() && (bookingData.isPaid || bookingData.isCreatedByAdmin) ? (
                    <Button 
                      variant="outline" 
                      className="w-full sm:w-auto px-8 border-blue-300 text-blue-700 hover:bg-blue-50"
                      onClick={() => setShowBedRemovalDialog(true)}
                    >
                      {translations.editBooking || 'Modifica prenotazione'}
                    </Button>
                  ) : null}

                  {/* Mostra il pulsante di cancellazione SOLO per prenotazioni PAGATE o ADMIN */}
                  {isBeforeCheckIn() && (bookingData.isPaid || bookingData.isCreatedByAdmin) ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full sm:w-auto px-8">
                          {translations.delete || 'Elimina prenotazione'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="w-[90%] sm:w-full max-w-md mx-auto">
                        <AlertDialogHeader>
                          <AlertDialogTitle>{translations.confirmCancellation || 'Vuoi davvero cancellare la prenotazione?'}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {bookingData.isCreatedByAdmin 
                              ? (translations.adminBookingCancelMessage || 'Questa prenotazione è stata creata dall\'amministratore. La cancellazione non comporterà rimborsi.')
                              : (translations.cancellationWarning || 'Questa azione non può essere annullata. La tua prenotazione verrà cancellata e riceverai un rimborso in base alle nostre politiche di rimborso.')}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{translations.cancel || 'Annulla'}</AlertDialogCancel>
                          <AlertDialogAction onClick={handleCancelBooking} className="bg-red-600 hover:bg-red-700">
                            {translations.confirmCancellationButton || 'Conferma cancellazione'}
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
                    {translations.backToHome || 'Torna alla home'}
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
            <AlertDialogTitle>{translations.cancellationCompleted || 'Cancellazione Completata'}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {refundMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowRefundDialog(false)} className="bg-gray-900 hover:bg-gray-700">
              {translations.understand || 'Ho capito'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bed Removal Selection Dialog */}
      <AlertDialog open={showBedRemovalDialog} onOpenChange={setShowBedRemovalDialog}>
        <AlertDialogContent className="w-full sm:w-[90%] sm:max-w-2xl mx-0 sm:mx-auto max-h-[80vh] overflow-y-auto p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle>{translations.selectBedsToRemove || 'Seleziona i letti da rimuovere'}</AlertDialogTitle>
            <AlertDialogDescription>
              {translations.selectBedsToRemoveMessage || 'Seleziona i letti che vuoi rimuovere dalla tua prenotazione. Riceverai un rimborso parziale in base alle nostre politiche di rimborso.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="max-h-60 overflow-y-auto space-y-3 sm:space-y-4">
            {bookingData && bookingData.rooms.map((room) => (
              <div key={room.roomId} className="border rounded-lg p-2 sm:p-3">
                <h4 className="font-semibold text-sm mb-2">{room.roomDescription}</h4>
                <div className="space-y-1 sm:space-y-2">
                  {room.guests.map((guest) => (
                    <label key={guest.specId} className="flex items-center space-x-2 cursor-pointer p-1.5 sm:p-2 rounded hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedBedsToRemove.includes(guest.specId)}
                        onChange={() => toggleBedSelection(guest.specId)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 flex justify-between items-center">
                        <span className="text-xs sm:text-sm">
                          {guest.guestType} - {guest.bedName}
                        </span>
                        <span className="text-xs sm:text-sm font-medium">
                          €{guest.price.toFixed(2)}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {selectedBedsToRemove.length > 0 && (
            <div className="bg-blue-50 p-2 sm:p-3 rounded-lg border border-blue-200 mt-3 sm:mt-4">
              <h5 className="font-medium text-blue-800 mb-1 text-sm sm:text-base">
                {translations.partialRefundAmount ? translations.partialRefundAmount.replace('{amount}', calculatePartialRefund().toFixed(2)) : `Rimborso parziale stimato: €${calculatePartialRefund().toFixed(2)}`}
              </h5>
              <p className="text-xs text-blue-700">
                {bookingData?.isCreatedByAdmin 
                  ? (translations.noBedRemovalRefund || 'Questa prenotazione è stata creata dall\'amministratore. La rimozione dei letti non comporterà rimborsi.')
                  : 'Calcolato secondo le nostre politiche di rimborso in base alla data del check-in.'
                }
              </p>
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSelectedBedsToRemove([]);
              setShowBedRemovalDialog(false);
            }}>
              {translations.cancel || 'Annulla'}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBedRemoval}
              disabled={selectedBedsToRemove.length === 0}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300"
            >
              {translations.confirmBedRemovalButton || 'Conferma rimozione'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bed Removal Result Dialog */}
      <AlertDialog open={showBedRemovalResultDialog} onOpenChange={setShowBedRemovalResultDialog}>
        <AlertDialogContent className="w-[90%] sm:w-full max-w-md mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{translations.bedRemovalCompleted || 'Rimozione Completata'}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {bedRemovalMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowBedRemovalResultDialog(false)} className="bg-gray-900 hover:bg-gray-700">
              {translations.understand || 'Ho capito'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  )
}