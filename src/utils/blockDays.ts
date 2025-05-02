import { supabase } from '@/lib/supabase';

// Funzione per formattare la data nel formato YYYY-MM-DD
export const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Normalizza la data per evitare problemi di fuso orario
export const normalizeDate = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setHours(12, 0, 0, 0);
  return newDate;
};

interface BlockDayOptions {
  // Per gestire callback dopo l'operazione
  onSuccess?: () => void;
}

// Blocca un singolo giorno
export const blockDay = async (date: Date, options?: BlockDayOptions): Promise<boolean> => {
  try {
    const normalizedDate = normalizeDate(date);
    const formattedDate = formatDateToYYYYMMDD(normalizedDate);
    
    // Verifica se la data è già bloccata
    const { data: existingDay } = await supabase
      .from('day_blocked')
      .select('*')
      .eq('day_blocked', formattedDate);
    
    if (existingDay && existingDay.length > 0) {
      console.log("Questa data è già bloccata:", formattedDate);
      return false;
    }
    
    // Blocca la data
    const { error } = await supabase
      .from('day_blocked')
      .insert([{ day_blocked: formattedDate }]);
    
    if (error) throw error;
    
    if (options?.onSuccess) options.onSuccess();
    return true;
  } catch (error) {
    console.error('Errore nel bloccare la data:', error);
    return false;
  }
};

// Sblocca un singolo giorno
export const unblockDay = async (date: Date, options?: BlockDayOptions): Promise<boolean> => {
  try {
    const normalizedDate = normalizeDate(date);
    const formattedDate = formatDateToYYYYMMDD(normalizedDate);
    
    // Sblocca la data
    const { error } = await supabase
      .from('day_blocked')
      .delete()
      .eq('day_blocked', formattedDate);
    
    if (error) throw error;
    
    if (options?.onSuccess) options.onSuccess();
    return true;
  } catch (error) {
    console.error('Errore nello sbloccare la data:', error);
    return false;
  }
};

// Funzione per verificare se una data è bloccata
export const isDayBlocked = async (date: Date): Promise<boolean> => {
  try {
    const normalizedDate = normalizeDate(date);
    const formattedDate = formatDateToYYYYMMDD(normalizedDate);
    
    // Cerca con il nuovo formato YYYY-MM-DD
    const { data: existingDayFormatted } = await supabase
      .from('day_blocked')
      .select('*')
      .eq('day_blocked', formattedDate);
    
    // Cerca anche con il formato ISO per compatibilità con i dati esistenti
    const isoDate = date.toISOString();
    const { data: existingDayISO } = await supabase
      .from('day_blocked')
      .select('*')
      .eq('day_blocked', isoDate);
    
    return !!(
      (existingDayFormatted && existingDayFormatted.length > 0) || 
      (existingDayISO && existingDayISO.length > 0)
    );
  } catch (error) {
    console.error('Errore nel verificare se la data è bloccata:', error);
    return false;
  }
};

// Versione migliorata di toggleBlockDay che verifica il formato attuale
export const toggleBlockDay = async (date: Date, isCurrentlyBlocked: boolean, options?: BlockDayOptions): Promise<boolean> => {
  try {
    const normalizedDate = normalizeDate(date);
    const formattedDate = formatDateToYYYYMMDD(normalizedDate);
    const isoDate = date.toISOString();
    
    if (isCurrentlyBlocked) {
      // Prova a cancellare con entrambi i formati per assicurarsi di coprire tutti i casi
      const { error: errorFormatted } = await supabase
        .from('day_blocked')
        .delete()
        .eq('day_blocked', formattedDate);
      
      const { error: errorISO } = await supabase
        .from('day_blocked')
        .delete()
        .eq('day_blocked', isoDate);
      
      if (errorFormatted && errorISO) throw errorFormatted;
      
      if (options?.onSuccess) options.onSuccess();
      return true;
    } else {
      return blockDay(date, options);
    }
  } catch (error) {
    console.error('Errore nel toggle del blocco:', error);
    return false;
  }
};

// Blocca multiple date in un range
export const blockDateRange = async (startDate: Date, endDate: Date, options?: BlockDayOptions): Promise<{ blocked: number, alreadyBlocked: number }> => {
  try {
    // Normalizza le date
    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate);
    
    if (start > end) {
      console.error("La data di inizio deve essere precedente o uguale alla data di fine");
      return { blocked: 0, alreadyBlocked: 0 };
    }

    const dates = [];
    
    // Genera tutte le date tra start e end (inclusive)
    const current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    // Formatta le date per la query
    const formattedDates = dates.map(date => formatDateToYYYYMMDD(date));

    // Verifica giorni già bloccati
    const { data: existingBlockedDays } = await supabase
      .from('day_blocked')
      .select('day_blocked')
      .in('day_blocked', formattedDates);
    
    // Filtra date già bloccate
    const existingDatesSet = new Set(
      (existingBlockedDays || []).map(item => {
        const dateStr = typeof item.day_blocked === 'string' ? item.day_blocked : new Date(item.day_blocked).toISOString();
        return dateStr.split('T')[0];
      })
    );
    
    const newDatesToBlock = dates.filter(date => 
      !existingDatesSet.has(formatDateToYYYYMMDD(date))
    );
    
    if (newDatesToBlock.length === 0) {
      console.log("Tutte le date selezionate sono già bloccate");
      return { blocked: 0, alreadyBlocked: formattedDates.length };
    }

    // Crea array per l'inserimento
    const records = newDatesToBlock.map(date => ({
      day_blocked: formatDateToYYYYMMDD(date),
    }));

    // Inserimento massivo
    const { error } = await supabase
      .from('day_blocked')
      .insert(records);

    if (error) throw error;
    
    if (options?.onSuccess) options.onSuccess();
    
    return { 
      blocked: newDatesToBlock.length, 
      alreadyBlocked: formattedDates.length - newDatesToBlock.length 
    };
  } catch (error) {
    console.error('Errore nel bloccare le date:', error);
    return { blocked: 0, alreadyBlocked: 0 };
  }
}; 