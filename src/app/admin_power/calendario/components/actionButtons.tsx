import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { Calendar } from '@/components/ui/calendar';
import { X} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface BookingActionsProps {
  onActionCompleted?: () => void;
}

const BookingActions: React.FC<BookingActionsProps> = ({ onActionCompleted }) => {
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isSingleBlockDialogOpen, setIsSingleBlockDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [singleDate, setSingleDate] = useState<Date | undefined>(undefined);
  const [reportDate, setReportDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Funzione per formattare la data nel formato YYYY-MM-DD senza problemi di timezone
  const formatDateToYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleMultiBlockConfirm = async () => {
    if (!startDate || !endDate) return;
    
    setIsSubmitting(true);
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Ensure dates are properly formatted for comparison
      start.setHours(12, 0, 0, 0); // Imposto mezzogiorno per evitare problemi di timezone
      end.setHours(12, 0, 0, 0);
      
      if (start > end) {
        console.error("La data di inizio deve essere precedente o uguale alla data di fine");
        return;
      }

      const dates = [];
      
      // Generate all dates between start and end (inclusive)
      const current = new Date(start);
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      
      // Format dates for the query (YYYY-MM-DD)
      const formattedDates = dates.map(date => formatDateToYYYYMMDD(date));

      // Check for existing blocked days to avoid duplicates
      const { data: existingBlockedDays } = await supabase
        .from('day_blocked')
        .select('day_blocked')
        .in('day_blocked', formattedDates);
      
      // Filter out dates that are already blocked
      const existingDatesSet = new Set(
        (existingBlockedDays || []).map(item => {
          // Gestisce anche il caso in cui la data arriva come timestamp
          const dateStr = typeof item.day_blocked === 'string' ? item.day_blocked : new Date(item.day_blocked).toISOString();
          return dateStr.split('T')[0];
        })
      );
      
      const newDatesToBlock = dates.filter(date => 
        !existingDatesSet.has(formatDateToYYYYMMDD(date))
      );
      
      if (newDatesToBlock.length === 0) {
        console.log("Tutte le date selezionate sono già bloccate");
        setIsBlockDialogOpen(false);
        setStartDate('');
        setEndDate('');
        return;
      }

      // Create the records array for bulk insert
      const records = newDatesToBlock.map(date => ({
        day_blocked: formatDateToYYYYMMDD(date),
      }));

      console.log("Blocco le seguenti date:", records.map(r => r.day_blocked));

      // Bulk insert into day_blocked table
      const { error } = await supabase
        .from('day_blocked')
        .insert(records);

      if (error) throw error;
      
      console.log(`${newDatesToBlock.length} giorni sono stati bloccati con successo`);
      
      setIsBlockDialogOpen(false);
      // Reset form
      setStartDate('');
      setEndDate('');
      
      // Trigger refresh
      if (onActionCompleted) {
        onActionCompleted();
      }
    } catch (error) {
      console.error('Failed to block dates:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSingleBlockConfirm = async () => {
    if (!singleDate) return;
    
    setIsSubmitting(true);
    try {
      const dateToBlock = new Date(singleDate);
      dateToBlock.setHours(12, 0, 0, 0); // Imposto mezzogiorno per evitare problemi di timezone
      
      const formattedDate = formatDateToYYYYMMDD(dateToBlock);
      
      console.log("Tentativo di bloccare la data:", formattedDate);
      
      // Check if the date is already blocked
      const { data: existingDay } = await supabase
        .from('day_blocked')
        .select('*')
        .eq('day_blocked', formattedDate);
      
      if (existingDay && existingDay.length > 0) {
        console.log("Questa data è già bloccata");
        setIsSingleBlockDialogOpen(false);
        setSingleDate(undefined);
        return;
      }
      
      // Insert the new blocked day
      const { error, data } = await supabase
        .from('day_blocked')
        .insert([{ day_blocked: formattedDate }])
        .select();

      if (error) throw error;
      
      console.log(`${format(dateToBlock, 'dd MMMM yyyy', { locale: it })} è stato bloccato con successo`);
      console.log("Data inserita in DB:", data);
      
      setIsSingleBlockDialogOpen(false);
      setSingleDate(undefined);
      
      // Trigger refresh
      if (onActionCompleted) {
        onActionCompleted();
      }
    } catch (error) {
      console.error('Failed to block date:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeSingleBlockDialog = () => {
    setIsSingleBlockDialogOpen(false);
    setSingleDate(undefined);
  };

  const closeReportDialog = () => {
    setIsReportDialogOpen(false);
    setReportDate(undefined);
  };

  // Funzione per aprire una nuova prenotazione come admin
  const handleNewAdminBooking = () => {
    // Apre la pagina principale in una nuova tab con un parametro che indica che è una prenotazione admin
    window.open('/?admin_booking=true', '_blank');
  };

  // Funzione per generare il prospetto
  const handleGenerateReport = async () => {
    if (!reportDate) return;
    
    setIsGeneratingReport(true);
    try {
      const formattedDate = formatDateToYYYYMMDD(reportDate);
      
      // Genera il PDF e scaricalo
      const response = await fetch(`/api/genera-prospetto?date=${formattedDate}`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error('Errore nella generazione del prospetto');
      }
      
      // Crea un blob dall'oggetto response
      const blob = await response.blob();
      
      // Crea un URL per il download
      const url = window.URL.createObjectURL(blob);
      
      // Crea un elemento 'a' per il download
      const a = document.createElement('a');
      a.href = url;
      a.download = `prospetto-${formattedDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Pulisci
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setIsReportDialogOpen(false);
      setReportDate(undefined);
    } catch (error) {
      console.error('Errore nella generazione del prospetto:', error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <>
      <div className="flex gap-2 mb-4">
        <Button 
          variant="outline" 
          onClick={() => setIsBlockDialogOpen(true)}
        >
          Blocco multiplo
        </Button>
        <Button 
          variant="outline"
          onClick={() => setIsSingleBlockDialogOpen(true)}
        >
          Blocca prenotazioni
        </Button>
        <Button 
          variant="outline"
          onClick={() => setIsReportDialogOpen(true)}
        >
          Genera prospetto
        </Button>
        <Button 
          variant="default"
          onClick={handleNewAdminBooking}
        >
          Nuova prenotazione come Admin
        </Button>
      </div>

      {/* Dialog for blocking multiple days */}
      <Dialog open={isBlockDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsBlockDialogOpen(false);
          setStartDate('');
          setEndDate('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Blocco multiplo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="startDate">Da:</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="endDate">A:</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="mt-4 text-sm">
              Questa azione bloccherà tutte le date nel range selezionato, estremi compresi.
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsBlockDialogOpen(false)}
                disabled={isSubmitting}
              >
                Annulla
              </Button>
              <Button
                onClick={handleMultiBlockConfirm}
                disabled={isSubmitting || !startDate || !endDate}
              >
                {isSubmitting ? 'Salvataggio...' : 'Conferma'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog for blocking a single day with calendar */}
      <Dialog open={isSingleBlockDialogOpen} onOpenChange={(open) => {
        // Previene la chiusura del dialog quando si clicca sul calendario
        if (!open) {
          closeSingleBlockDialog();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Blocca giorno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="singleDate">Seleziona la data da bloccare:</Label>
              <div className="border rounded-md p-2">
                {singleDate && (
                  <div className="flex items-center justify-between mb-3 p-2 bg-gray-100 rounded">
                    <span className="font-medium">
                      {format(singleDate, "PPP", { locale: it })}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSingleDate(undefined)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <Calendar
                  mode="single"
                  selected={singleDate}
                  onSelect={setSingleDate}
                  locale={it}
                  className="mx-auto"
                />
              </div>
            </div>
            <div className="mt-4 text-sm">
              Questa azione bloccherà il giorno selezionato.
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={closeSingleBlockDialog}
                disabled={isSubmitting}
              >
                Annulla
              </Button>
              <Button
                onClick={handleSingleBlockConfirm}
                disabled={isSubmitting || !singleDate}
              >
                {isSubmitting ? 'Salvataggio...' : 'Conferma'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog for generating report with date selector */}
      <Dialog open={isReportDialogOpen} onOpenChange={(open) => {
        if (!open) {
          closeReportDialog();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Genera prospetto giornaliero</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reportDate">Seleziona la data per il prospetto:</Label>
              <div className="border rounded-md p-2">
                {reportDate && (
                  <div className="flex items-center justify-between mb-3 p-2 bg-gray-100 rounded">
                    <span className="font-medium">
                      {format(reportDate, "PPP", { locale: it })}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setReportDate(undefined)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <Calendar
                  mode="single"
                  selected={reportDate}
                  onSelect={setReportDate}
                  locale={it}
                  className="mx-auto"
                />
              </div>
            </div>
            <div className="mt-4 text-sm">
              Verrà generato un prospetto con l&apos;occupazione delle camere per la data selezionata.
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={closeReportDialog}
                disabled={isGeneratingReport}
              >
                Annulla
              </Button>
              <Button
                onClick={handleGenerateReport}
                disabled={isGeneratingReport || !reportDate}
              >
                {isGeneratingReport ? 'Generazione...' : 'Genera PDF'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BookingActions;