'use client'

import React, { useState, useEffect, ReactElement, useCallback, Suspense } from 'react';
// Import necessari da next/navigation
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Lock, Loader2 } from 'lucide-react';
import BookingActions from './components/actionButtons';
import DaySheet from './components/daySheet';

// Interfaccia per i dati minimali scaricati inizialmente per calendario e timeline
interface MinimalReservation {
  id: number;
  dayFrom: string;
  dayTo: string;
  name: string;
  surname: string; // Aggiunto per TimelineView
  guestCount: number; // Aggiunto per TimelineView (se usato direttamente)
  // Aggiungere altri campi se strettamente necessari per la visualizzazione base della timeline
}

interface CalendarDay {
  date: string;
  isBlocked: boolean;
}

// L'API ora ritorna MinimalReservation[]
interface ApiResponse {
  reservations: MinimalReservation[];
  calendarDays: CalendarDay[];
  error?: string;
}

interface DayData {
  date: Date;
  isBlocked: boolean;
  reservationCount: number;
}

const CalendarPageContent: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Inizializza lo stato con i valori di default
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  const [reservations, setReservations] = useState<MinimalReservation[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Flag per gestire il caricamento iniziale

  // Effetto per sincronizzare lo stato dall'URL SOLO al montaggio iniziale
  useEffect(() => {
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month'); // 1-based

    const year = yearParam ? parseInt(yearParam, 10) : NaN;
    const month = monthParam ? parseInt(monthParam, 10) : NaN;

    let needsStateUpdate = false;
    let initialDate = currentDate; // Usa la data di default come base

    if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
      const dateFromUrl = new Date(year, month - 1, 1); // Mese 0-based per Date
      // Aggiorna solo se diversa dalla data di default iniziale
      if (dateFromUrl.getFullYear() !== initialDate.getFullYear() || dateFromUrl.getMonth() !== initialDate.getMonth()) {
        initialDate = dateFromUrl;
        needsStateUpdate = true;
      }
    }

    // Se abbiamo letto valori diversi dall'URL, aggiorniamo lo stato
    if (needsStateUpdate) {
      setCurrentDate(initialDate);
    } 
    // Indipendentemente dall'aggiornamento, il caricamento iniziale è completato
    setIsInitialLoad(false); 

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Eseguire solo al mount

  // Funzione per aggiornare i parametri URL
  const updateUrlParams = useCallback((newDate: Date) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', newDate.getFullYear().toString());
    params.set('month', (newDate.getMonth() + 1).toString());
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  // Effetto per caricare i dati quando currentDate cambia
  const fetchReservations = async (month: number, year: number): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/calendario_mese?month=${month + 1}&year=${year}`);
      const data: ApiResponse = await response.json();
      if (data.reservations && data.calendarDays) {
        setReservations(data.reservations);
        setCalendarDays(data.calendarDays);
      } else if (data.error) {
        setError(data.error);
        setReservations([]);
        setCalendarDays([]);
      } else {
        setError('Unexpected API response format');
        setReservations([]);
        setCalendarDays([]);
      }
    } catch (err) {
      setError('Failed to fetch reservations');
      setReservations([]);
      setCalendarDays([]);
      console.error(err); // Meglio loggare l'errore effettivo
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Non caricare i dati finché lo stato iniziale non è stato sincronizzato dall'URL
    if (!isInitialLoad) {
      fetchReservations(currentDate.getMonth(), currentDate.getFullYear());
    }
  }, [currentDate, isInitialLoad]); // Si attiva quando cambia la data o dopo il load iniziale

  // --- Funzioni Navigazione e Aggiornamento URL --- 

  const navigateMonth = (monthDelta: number): void => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + monthDelta, 1);
    setCurrentDate(newDate);
    // Aggiorna l'URL DOPO aver aggiornato lo stato
    updateUrlParams(newDate);
  };

  const previousMonth = (): void => {
    navigateMonth(-1);
  };

  const nextMonth = (): void => {
    navigateMonth(1);
  };

  // --- Resto del componente (getDaysInMonth, refreshBlockedDays, mesi, getDaysData, renderDaysList, return JSX) --- 

  const getDaysInMonth = (date: Date): number => {
      return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };
  
  const refreshBlockedDays = async () => {
      // Ricarica i dati minimali e i giorni bloccati
      await fetchReservations(currentDate.getMonth(), currentDate.getFullYear());
  };
  
  const months = [
      "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
      "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];
  
  const getDaysData = (): DayData[] => {
    const daysInMonth = getDaysInMonth(currentDate);
    const daysData: DayData[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const normalizedCurrentDayStart = new Date(currentDayDate.setHours(0, 0, 0, 0));
      
      const isBlocked = calendarDays.some(calDay => {
          const blockDate = new Date(calDay.date);
          const normalizedBlockDateStart = new Date(blockDate.setHours(0, 0, 0, 0));
          return normalizedBlockDateStart.getTime() === normalizedCurrentDayStart.getTime() && calDay.isBlocked;
      });
      
      const reservationCount = reservations.filter(res => {
        const checkIn = new Date(res.dayFrom);
        const checkOut = new Date(res.dayTo);
        const normalizedCheckIn = new Date(checkIn.setHours(0, 0, 0, 0));
        const normalizedCheckOut = new Date(checkOut.setHours(0, 0, 0, 0));
        
        return normalizedCheckIn.getTime() <= normalizedCurrentDayStart.getTime() && 
               normalizedCheckOut.getTime() > normalizedCurrentDayStart.getTime();
      }).length;
      
      daysData.push({
        date: currentDayDate,
        isBlocked,
        reservationCount
      });
    }
    return daysData;
  };
  
  const renderDaysList = (): ReactElement => {
    const daysData = getDaysData();
    const fullDaysOfWeek = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    
    return (
      <div className="bg-white rounded-md shadow overflow-hidden">
        <div className="grid grid-cols-12 bg-gray-100 p-4 font-medium">
          <div className="col-span-4">Giorno</div>
          <div className="col-span-3">Status</div>
          <div className="col-span-3">Prenotazioni</div>
          <div className="col-span-2 text-center">Dettagli</div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {daysData.map((day) => {
            const dayOfWeek = fullDaysOfWeek[day.date.getDay()];
            
            return (
              <div key={day.date.toISOString()} className="grid grid-cols-12 p-4 hover:bg-gray-50 items-center">
                <div className="col-span-4 flex items-center gap-3">
                  <span className="text-2xl font-bold">{day.date.getDate()}</span>
                  <span className="text-gray-600">{dayOfWeek}</span>
                </div>
                <div className="col-span-3 flex items-center">
                  {day.isBlocked ? (
                    <span className="flex items-center text-orange-500 gap-1">
                      <Lock className="w-4 h-4" /> Bloccato
                    </span>
                  ) : (
                    <span className="text-green-500">Disponibile</span>
                  )}
                </div>
                <div className="col-span-3">
                  {day.reservationCount > 0 ? (
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                      {day.reservationCount} prenotazion{day.reservationCount === 1 ? 'e' : 'i'}
                    </span>
                  ) : (
                    <span className="text-gray-400">Nessuna</span>
                  )}
                </div>
                <div className="col-span-2 text-center">
                  <button
                    onClick={() => {
                      setSelectedDate(day.date);
                      setIsSheetOpen(true);
                    }}
                    className="p-2 rounded-full hover:bg-blue-100 text-blue-600"
                    title="Visualizza dettagli"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M12 16v-4"></path>
                      <path d="M12 8h.01"></path>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Mostra il loading iniziale finché l'URL non è stato processato
  if (isInitialLoad) {
    return (
        <div className="max-w-6xl mx-auto p-4 h-96 flex items-center justify-center">
            Loading initial state...
        </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Calendario Prenotazioni</h1>
      <BookingActions 
        // Passa i props necessari a BookingActions
      />

      <div className="bg-white rounded-md shadow p-4 mb-4">
        <div className="flex justify-between items-center mb-4">
          <button onClick={previousMonth} className="p-2 rounded hover:bg-gray-100">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-semibold">
            {months[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button onClick={nextMonth} className="p-2 rounded hover:bg-gray-100">
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500 mx-auto mb-2" />
            Caricamento...
          </div>
        ) : error ? (
          <div className="text-center py-10 text-red-500">Errore: {error}</div>
        ) : (
          renderDaysList()
        )}
      </div>
      
      {selectedDate && (
        <DaySheet
          isOpen={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
          date={selectedDate}
          isBlocked={calendarDays.some(calDay => {
              const blockDate = new Date(calDay.date);
              const normalizedBlockDateStart = new Date(blockDate.setHours(0, 0, 0, 0));
              const normalizedSelectedDateStart = new Date(new Date(selectedDate).setHours(0, 0, 0, 0));
              return normalizedBlockDateStart.getTime() === normalizedSelectedDateStart.getTime() && calDay.isBlocked;
          })}
          onDayBlockToggle={() => {
              refreshBlockedDays(); // Ricarica i dati minimali quando lo stato di blocco cambia
          }}
        />
      )}
    </div>
  );
};

// Nuovo componente wrapper che include Suspense
const ReservationCalendarPage: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-gray-400" /> 
      </div>
    }>
      <CalendarPageContent />
    </Suspense>
  );
};

export default ReservationCalendarPage;