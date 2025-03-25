'use client'

import React, {useState} from 'react'
import { Calendar, Check, Download, ArrowRight, Mail } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import Header from '@/components/header/header'
import Footer from '@/components/footer/footer'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'

export default function ConfirmationPage() {
  const [language, setLanguage] = useState('it')
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header 
      language={language}
      onLanguageChange={setLanguage}
    />

      <main className="flex-grow container mx-auto px-4 py-8">
        <Card className="p-6 max-w-4xl mx-auto border-green-100 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-2xl font-bold text-green-700">Prenotazione confermata!</CardTitle>
            </div>
            <CardDescription className="text-base">
              La tua prenotazione presso Rifugio Angelo Dibona è stata confermata con successo.
              Un&apos;email di conferma è stata inviata al tuo indirizzo email.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-4">
            {/* Dettagli prenotazione */}
            <div className="bg-gray-50 p-5 rounded-lg border border-gray-100">
              <h2 className="text-lg font-semibold mb-4">Dettagli della prenotazione</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Numero prenotazione</p>
                  <p className="font-medium">123456</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Check-in</p>
                  <p className="font-medium flex items-center">
                    <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                    26 Giugno 2025
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Check-out</p>
                  <p className="font-medium flex items-center">
                    <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                    27 Giugno 2025
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Totale pagato</p>
                  <p className="font-medium">€146.00</p>
                </div>
              </div>
            </div>

            {/* Cosa fare ora */}
            <div className="bg-blue-50 p-5 rounded-lg border border-blue-100 space-y-4">
              <h2 className="text-lg font-semibold text-blue-800">Cosa fare ora?</h2>
              
              <div className="flex items-start gap-3">
                <Download className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">Scarica la conferma della prenotazione</p>
                  <p className="text-sm text-blue-700">Potrai mostrarla al tuo arrivo al rifugio.</p>
                  <Button variant="link" className="h-8 px-0 text-blue-600 hover:text-blue-800">
                    Scarica PDF
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">Controlla la tua email</p>
                  <p className="text-sm text-blue-700">
                    Ti abbiamo inviato un&apos;email di conferma con tutti i dettagli della tua prenotazione.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ArrowRight className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">Preparati per il tuo soggiorno</p>
                  <p className="text-sm text-blue-700">
                    Il Rifugio Angelo Dibona si trova a 2083m s.l.m. Ti consigliamo di portare abbigliamento adeguato alla montagna.
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Contatti */}
            <div className="bg-gray-100 p-5 rounded-lg">
              <h2 className="text-lg font-semibold mb-2">Hai domande?</h2>
              <p className="text-sm text-gray-600">
                Per qualsiasi informazione o richiesta, puoi contattare il gestore al numero +39 0436 860294 / +39 333 143 4408 
                oppure inviando una mail a <a href="mailto:rifugiodibona@gmail.com" className="text-blue-600 hover:underline">rifugiodibona@gmail.com</a>.
              </p>
            </div>

            <div className="flex justify-center pt-4">
              <Button 
                className="bg-gray-900 hover:bg-gray-700 px-8"
                asChild
              >
                <Link href="/">
                  Torna alla home
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  )
}