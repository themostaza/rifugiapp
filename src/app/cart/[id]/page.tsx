'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, Check, Download, ArrowRight, Mail, AlertCircle } from 'lucide-react'
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

interface BookingData {
  id: number;
  external_id: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestRegion: string;
  reservationType: string;
  totalPrice: number;
  isPaid: boolean;
  isCancelled: boolean;
  createdAt: string;
  stripeId: string;
  rooms: {
    id: number;
    beds: {
      id: number;
      name: string;
    }[];
    rooms: {
      id: number;
      description: string;
    }[];
  }[];
}

export default function ConfirmationPage() {
  const [language, setLanguage] = useState('it')
  const [bookingData, setBookingData] = useState<BookingData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
      const response = await fetch(`/api/booking-details?external_id=${bookingExternalId}`, {
        method: 'POST'
      })
      if (!response.ok) {
        throw new Error('Failed to cancel booking')
      }
      // Refresh booking data after cancellation
      const updatedResponse = await fetch(`/api/booking-details?external_id=${bookingExternalId}`)
      const updatedData = await updatedResponse.json()
      setBookingData(updatedData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel booking')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    })
  }

  const handleDownloadPDF = () => {
    if (!bookingData) return;

    // Create a new window with the print content
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Rifugio A. Dibona - Prenotazione ${bookingData.id}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .section { margin-bottom: 20px; }
              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
              .label { color: #666; font-size: 14px; }
              .value { font-weight: bold; }
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
                  <div class="label">ID Pagamento Stripe</div>
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
                  <div class="label">Totale pagato</div>
                  <div class="value">€${bookingData.totalPrice.toFixed(2)}</div>
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

            <div class="section">
              <h3>Camere prenotate</h3>
              ${bookingData.rooms.map(room => `
                <div style="margin-bottom: 10px;">
                  <div class="value">${room.rooms[0]?.description}</div>
                  <div class="label">Letti: ${room.beds.map(bed => bed.name).join(', ')}</div>
                </div>
              `).join('')}
            </div>

            <div class="section">
              <h3>Contatti</h3>
              <p>Per qualsiasi informazione o richiesta, puoi contattare il gestore al numero +39 0436 860294 / +39 333 143 4408 
              oppure inviando una mail a rifugiodibona@gmail.com</p>
              <p>Il presente documento non ha valore ai fini fiscali.</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      
      // Wait for content to load before printing
      printWindow.onload = () => {
        printWindow.print();
        // Close the window after printing (optional)
        // printWindow.close();
      };
    }
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
            {/* Dettagli prenotazione - always visible */}
            <div className="bg-gray-50 sm:p-5 rounded-lg border border-gray-100">
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Dettagli della prenotazione</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-gray-500">Numero prenotazione</p>
                  <p className="font-medium break-all">{bookingData.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">ID Stripe</p>
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
                  <p className="text-sm text-gray-500">Totale pagato</p>
                  <p className="font-medium">€{bookingData.totalPrice.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Nome ospite</p>
                  <p className="font-medium">{bookingData.guestName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{bookingData.guestEmail}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Telefono</p>
                  <p className="font-medium">{bookingData.guestPhone}</p>
                </div>
              </div>

              {/* Room details */}
              <div className="mt-3 sm:mt-4">
                <h3 className="text-sm sm:text-md font-semibold mb-2">Camere prenotate:</h3>
                {bookingData.rooms.map((room) => (
                  <div key={room.id} className="mb-2">
                    <p className="font-medium text-sm sm:text-base">{room.rooms[0]?.description}</p>
                    <p className="text-xs sm:text-sm text-gray-600">
                      Letti: {room.beds.map(bed => bed.name).join(', ')}
                    </p>
                  </div>
                ))}
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

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full sm:w-auto px-8">
                        Elimina prenotazione
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[90%] sm:w-full max-w-md mx-auto">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Davvero?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Questa azione non può essere annullata. La tua prenotazione verrà cancellata e riceverai un rimborso in base alle nostre politiche di rimborso.
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

      <Footer />
    </div>
  )
}