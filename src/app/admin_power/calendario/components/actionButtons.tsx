import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';

const BookingActions = () => {
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!startDate || !endDate) return;
    
    setIsSubmitting(true);
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const dates = [];
      
      // Generate all dates between start and end (inclusive)
      const current = new Date(start);
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      
      // Create the records array for bulk insert
      const records = dates.map(date => ({
        day_blocked: date.toISOString(),
        created_at: new Date().toISOString()
      }));

      // Bulk insert into day_blocked table
      const { error } = await supabase
        .from('day_blocked')
        .insert(records);

      if (error) throw error;
      
      setIsBlockDialogOpen(false);
      // Reset form
      setStartDate('');
      setEndDate('');
    } catch (error) {
      console.error('Failed to block dates:', error);
    } finally {
      setIsSubmitting(false);
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
        <Button variant="outline">
          Blocca prenotazioni
        </Button>
        <Button variant="outline">
          Genera prospetto
        </Button>
        <Button variant="default">
          Nuova prenotazione come Admin
        </Button>
      </div>

      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Blocco prenotazioni</DialogTitle>
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
              Sei sicuro di voler proseguire?
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
                onClick={handleConfirm}
                disabled={isSubmitting || !startDate || !endDate}
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