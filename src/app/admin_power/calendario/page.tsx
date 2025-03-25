'use client'

import React, { useState, useEffect, ReactElement } from 'react';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import BookingActions from './components/actionButtons';
import DaySheet from './components/daySheet';

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
  guestName?: string; // Added this as it's used in renderReservations
  checkIn: string; // Added these as they're used in code
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

interface ReservationSegment {
  startCol: number;
  endCol: number;
  week: number;
}

interface ProcessedReservation {
  reservation: Reservation;
  row: number;
  segments: ReservationSegment[];
}

interface ApiResponse {
  reservations: Reservation[];
  calendarDays: CalendarDay[];
  error?: string; // Added error property to fix the build error
}

const ReservationCalendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

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

  const getFirstDayOfMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const refreshBlockedDays = async () => {
    await fetchReservations(currentDate.getMonth(), currentDate.getFullYear());
  };

  const processReservations = (): ProcessedReservation[] => {
    if (!reservations.length) return [];

    const daysInMonth = getDaysInMonth(currentDate);
    const firstDayOfMonth = getFirstDayOfMonth(currentDate);
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

    const sortedReservations = [...reservations]
      .filter(r => r.checkIn && r.checkOut)
      .sort((a, b) => {
        const aStart = new Date(a.checkIn);
        const bStart = new Date(b.checkIn);
        if (aStart < monthStart && bStart < monthStart) {
          return new Date(a.checkOut).getTime() - new Date(b.checkOut).getTime();
        }
        return aStart.getTime() - bStart.getTime();
      });

    const processedReservations: ProcessedReservation[] = [];
    const occupiedPositions: { [key: string]: number } = {};

    for (const reservation of sortedReservations) {
      const checkIn = new Date(reservation.checkIn);
      const checkOut = new Date(reservation.checkOut);

      if (checkIn >= monthEnd || checkOut <= monthStart) continue;

      const startDay = checkIn < monthStart ? 1 : checkIn.getDate();
      const endDay = checkOut > monthEnd ? daysInMonth : checkOut.getDate() - 1;

      const segments: ReservationSegment[] = [];
      let currentDay = startDay;
      
      while (currentDay <= endDay) {
        const absoluteIndex = firstDayOfMonth + currentDay - 1;
        const currentWeek = Math.floor(absoluteIndex / 7);
        const startCol = absoluteIndex % 7;
        const daysLeftInWeek = 7 - startCol;
        const daysLeftInReservation = endDay - currentDay + 1;
        const segmentLength = Math.min(daysLeftInWeek, daysLeftInReservation);
        
        segments.push({
          startCol,
          endCol: startCol + segmentLength - 1,
          week: currentWeek
        });
        
        currentDay += segmentLength;
      }

      let row = 0;
      let positionFound = false;
      
      while (!positionFound) {
        positionFound = true;
        for (const segment of segments) {
          for (let col = segment.startCol; col <= segment.endCol; col++) {
            const key = `${segment.week}-${col}`;
            if (occupiedPositions[key] && occupiedPositions[key] > row) {
              row = occupiedPositions[key];
              positionFound = false;
              break;
            }
          }
          if (!positionFound) break;
        }
        row++;
      }

      segments.forEach(segment => {
        for (let col = segment.startCol; col <= segment.endCol; col++) {
          const key = `${segment.week}-${col}`;
          occupiedPositions[key] = row;
        }
      });

      processedReservations.push({
        reservation,
        row: row - 1,
        segments
      });
    }

    return processedReservations;
  };

  const renderReservations = (processedReservations: ProcessedReservation[], weekHeights: number[]):  ReactElement[] => {
    return processedReservations.flatMap(({ reservation, row, segments }) =>
      segments.map((segment, index) => {
        const width = ((segment.endCol - segment.startCol + 1) * (100/7));
        const left = (segment.startCol * (100/7));
        const topOffset = weekHeights.slice(0, segment.week).reduce((sum, height) => sum + height, 0);
        const top = topOffset + (row * 24) + 70; 

        // Using name and surname if guestName is not available
        const displayName = reservation.guestName || `${reservation.name} ${reservation.surname}`;

        return (
          <div
            key={`${reservation.id}-${index}`}
            className="absolute h-6 bg-gray-400 text-white text-[12px] rounded overflow-hidden whitespace-nowrap z-10 border-2 border-white"
            style={{
              top: `${top}px`,
              left: `${left}%`,
              width: `${width}%`,
            }}
          >
            <div className="px-1 py-0.5 truncate">
              {displayName} ({reservation.guestCount})
            </div>
          </div>
        );
      })
    );
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

  const renderCalendarGrid = (): ReactElement => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const processedReservations = processReservations();
    const totalWeeks = Math.ceil((firstDay + daysInMonth) / 7);
    
    const maxRowsByWeek = new Array(totalWeeks).fill(0);
    processedReservations.forEach(({ row, segments }) => {
      segments.forEach(segment => {
        maxRowsByWeek[segment.week] = Math.max(maxRowsByWeek[segment.week], row + 1);
      });
    });
    
    const weekHeights = maxRowsByWeek.map(rows => {
      const minHeight = 50;
      const heightPerRow = 24;
      const headerHeight = 28;
      return Math.max(minHeight, headerHeight + (rows * heightPerRow));
    });

    return (
      <div className="relative">
        <div className="grid grid-cols-7 gap-px">
          {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map(day => (
            <div key={day} className="text-center p-2 bg-gray-100 font-semibold">
              {day}
            </div>
          ))}

          {Array.from({ length: totalWeeks * 7 }).map((_, index) => {
            const dayNumber = index - firstDay + 1;
            const isValidDay = dayNumber > 0 && dayNumber <= daysInMonth;
            const weekIndex = Math.floor(index / 7);
            const cellHeight = weekHeights[weekIndex];

            // Check if the day is blocked
            const dayDate = new Date(
              currentDate.getFullYear(),
              currentDate.getMonth(),
              dayNumber
            );
            const isBlocked = calendarDays.some(
              day => new Date(day.date).getDate() === dayNumber && day.isBlocked
            );

            return (
              <div
                key={index}
                className={`border border-gray-100 ${!isValidDay ? 'bg-gray-50' : ''} ${
                  isValidDay && isBlocked ? 'bg-orange-100' : ''
                }`}
                style={{ height: `${cellHeight}px` }}
              >
                {isValidDay && (
                    <div className="p-1 text-sm border-b bg-white flex items-center gap-1">
                        <button
                        onClick={() => {
                            setSelectedDate(dayDate);
                            setIsSheetOpen(true);
                        }}
                        className="hover:bg-gray-100 p-1 rounded"
                        >
                        {dayNumber}
                        </button>
                        {isBlocked && <Lock className="w-4 h-4 text-orange-500" />}
                    </div>
                    )}
              </div>
            );
          })}
        </div>

        {renderReservations(processedReservations, weekHeights)}
      </div>
    );
    
  };


  return (
    <div className="max-w-6xl mx-auto p-4">
        <BookingActions />
      <div className="flex items-center justify-between mb-4">
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

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-96 flex items-center justify-center">
          Loading...
        </div>
      ) : (
        renderCalendarGrid()
      )}
      {selectedDate && (
        <DaySheet
          isOpen={isSheetOpen}
          onClose={() => {
            setIsSheetOpen(false);
            setSelectedDate(null);
          }}
          date={selectedDate}
          reservations={reservations.filter(res => {
            const checkIn = new Date(res.dayFrom || res.checkIn);
            const checkOut = new Date(res.dayTo || res.checkOut);
            const targetMonth = selectedDate.getMonth();
            const targetYear = selectedDate.getFullYear();
            
            return (
              checkIn <= selectedDate &&
              checkOut > selectedDate &&
              checkIn.getMonth() === targetMonth &&
              checkIn.getFullYear() === targetYear
            );
          })}
          isBlocked={calendarDays.some(
            day => 
              new Date(day.date).getDate() === selectedDate.getDate() && 
              day.isBlocked
          )}
          onDayBlockToggle={refreshBlockedDays}
        />
      )}
    </div>
  );
};

export default ReservationCalendar;