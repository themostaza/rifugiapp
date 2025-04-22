'use client'

import React, { useState, useEffect, ReactElement } from 'react';
import { ChevronLeft, ChevronRight, Lock, List, BarChart2 } from 'lucide-react';
import BookingActions from './components/actionButtons';
import DaySheet from './components/daySheet';
import TimelineView from './components/timelineView';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Room {
  id: number;
  description: string;
}

interface Reservation {
  id: number;
  dayFrom: string;
  dayTo: string;
  name: string;
  surname: string;
  guestCount: number;
  guestName?: string;
  checkIn: string;
  checkOut: string;
  rooms: Room[];
  RoomReservation: {
    id: number;
    RoomReservationSpec: {
      id: number;
      RoomLinkBed: {
        id: number;
        name: string;
        Room: {
          id: number;
          description: string;
        };
      };
    }[];
  }[];
}

interface CalendarDay {
  date: string;
  isBlocked: boolean;
}

interface ApiResponse {
  reservations: Reservation[];
  calendarDays: CalendarDay[];
  error?: string;
}

interface DayData {
  date: Date;
  isBlocked: boolean;
  reservationCount: number;
}

const ReservationCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  const fetchReservations = async (month: number, year: number): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/lista_mensile_prenotazioni?month=${month + 1}&year=${year}`);
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
    } catch (error) {
      setError('Failed to fetch reservations');
      setReservations([]);
      setCalendarDays([]);
      console.log(error)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations(currentDate.getMonth(), currentDate.getFullYear());
  }, [currentDate]);

  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const refreshBlockedDays = async () => {
    await fetchReservations(currentDate.getMonth(), currentDate.getFullYear());
  };

  const months = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  const previousMonth = (): void => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = (): void => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const getDaysData = (): DayData[] => {
    const daysInMonth = getDaysInMonth(currentDate);
    const daysData: DayData[] = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      
      // Check if day is blocked
      const isBlocked = calendarDays.some(
        calDay => new Date(calDay.date).getDate() === day && calDay.isBlocked
      );
      
      // Count reservations for this day
      const reservationCount = reservations.filter(res => {
        const checkIn = new Date(res.checkIn);
        const checkOut = new Date(res.checkOut);
        return currentDay >= checkIn && currentDay < checkOut;
      }).length;
      
      daysData.push({
        date: currentDay,
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

  return (
    <div className="max-w-6xl mx-auto p-4">
      <BookingActions onActionCompleted={refreshBlockedDays} />
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">
            {months[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          
          <div className="flex gap-2">
            <button
              onClick={previousMonth}
              className="p-2 rounded hover:bg-gray-100"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextMonth}
              className="p-2 rounded hover:bg-gray-100"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <Tabs defaultValue="list" onValueChange={(value) => setViewMode(value as 'list' | 'timeline')}>
          <TabsList>
            <TabsTrigger value="list">
              <List className="w-4 h-4 mr-2" />
              Lista giorni
            </TabsTrigger>
            <TabsTrigger value="timeline">
              <BarChart2 className="w-4 h-4 mr-2" />
              Timeline
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="mb-4">
        {viewMode === 'list' ? (
          loading ? (
            <div className="h-96 flex items-center justify-center">
              Loading...
            </div>
          ) : (
            renderDaysList()
          )
        ) : (
          loading ? (
            <div className="h-96 flex items-center justify-center">
              Loading...
            </div>
          ) : (
            <TimelineView 
              currentDate={currentDate} 
              reservations={reservations} 
              calendarDays={calendarDays}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setIsSheetOpen(true);
              }}
            />
          )
        )}
      </div>
      
      {selectedDate && (
        <DaySheet
          isOpen={isSheetOpen}
          onClose={() => {
            setIsSheetOpen(false);
            setSelectedDate(null);
          }}
          date={selectedDate}
          reservations={reservations.filter(res => {
            if (!selectedDate) return false;
            
            const checkIn = new Date(res.dayFrom || res.checkIn);
            const checkOut = new Date(res.dayTo || res.checkOut);
            
            // Normalizza la data selezionata ignorando l'ora
            const normalizedSelectedDate = new Date(
              selectedDate.getFullYear(),
              selectedDate.getMonth(),
              selectedDate.getDate()
            );
            
            // Normalizza anche le date di check-in e check-out
            const normalizedCheckIn = new Date(
              checkIn.getFullYear(),
              checkIn.getMonth(),
              checkIn.getDate()
            );
            
            const normalizedCheckOut = new Date(
              checkOut.getFullYear(),
              checkOut.getMonth(),
              checkOut.getDate()
            );
            
            // La prenotazione è valida se il check-in è prima o uguale al giorno selezionato
            // e il check-out è dopo il giorno selezionato
            return (
              normalizedCheckIn <= normalizedSelectedDate &&
              normalizedCheckOut > normalizedSelectedDate
            );
          }).map(res => {
            // Aggiungiamo un log per vedere i dati che stiamo passando a DaySheet
            console.log(`[CALENDAR] Passing reservation #${res.id} to DaySheet:`, {
              id: res.id,
              name: res.name,
              guestCount: res.guestCount,
              checkIn: res.checkIn || res.dayFrom,
              checkOut: res.checkOut || res.dayTo
            });
            return res;
          })}
          isBlocked={calendarDays.some(
            day => {
              if (!selectedDate) return false;
              
              const blockDate = new Date(day.date);
              
              return (
                blockDate.getDate() === selectedDate.getDate() &&
                blockDate.getMonth() === selectedDate.getMonth() &&
                blockDate.getFullYear() === selectedDate.getFullYear() &&
                day.isBlocked
              );
            }
          )}
          onDayBlockToggle={refreshBlockedDays}
        />
      )}
    </div>
  );
};

export default ReservationCalendar;