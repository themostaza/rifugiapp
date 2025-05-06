import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { X} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { blockDay, blockDateRange } from '@/utils/blockDays';
import { useRouter } from 'next/navigation';

interface BookingActionsProps {
  onActionCompleted?: () => void;
  currentYear?: number;
  currentMonth?: number;
}

const BookingActions: React.FC<BookingActionsProps> = ({ 
  onActionCompleted,
  currentYear, 
  currentMonth 
}) => {
  const router = useRouter();
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isSingleBlockDialogOpen, setIsSingleBlockDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [singleDate, setSingleDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMultiBlockConfirm = async () => {
    if (!startDate || !endDate) return;
    
    setIsSubmitting(true);
    try {
      const result = await blockDateRange(new Date(startDate), new Date(endDate), {
        onSuccess: () => {
          setIsBlockDialogOpen(false);
          setStartDate('');
          setEndDate('');
          if (onActionCompleted) onActionCompleted();
        }
      });
      
      console.log(`${result.blocked} giorni sono stati bloccati con successo. ${result.alreadyBlocked} giorni erano già bloccati.`);
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
      const success = await blockDay(singleDate, {
        onSuccess: () => {
          setIsSingleBlockDialogOpen(false);
          setSingleDate(undefined);
          if (onActionCompleted) {
            onActionCompleted();
          }
        }
      });
      
      if (!success) {
        console.log("Questa data è già bloccata");
        setIsSingleBlockDialogOpen(false);
        setSingleDate(undefined);
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

  // Funzione per aprire una nuova prenotazione come admin
  const handleNewAdminBooking = () => {
    // Apre la pagina principale in una nuova tab con un parametro che indica che è una prenotazione admin
    window.open('/?admin_booking=true', '_blank');
  };

  const handleOpenDbPrenotazioni = () => {
    let path = '/admin_power/db_prenotazioni';
    if (currentYear && currentMonth) {
      path += `?year=${currentYear}&month=${currentMonth}`
    }
    router.push(path);
  };

  return (
    <>
      <div className="flex gap-2 mb-4 justify-between items-center">
        <div className="flex gap-2">
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
            variant="default"
            onClick={handleNewAdminBooking}
          >
            Nuova prenotazione come Admin
          </Button>
        </div>
        <div>
          <Button 
            variant="outline"
            onClick={handleOpenDbPrenotazioni}
          >
            DB prenotazioni
          </Button>
        </div>
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
    </>
  );
};

export default BookingActions;