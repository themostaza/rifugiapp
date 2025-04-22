'use client'

import React, { useMemo, useState } from 'react';
import { getDaysInMonth } from 'date-fns';
import { Info } from 'lucide-react';
import { Calendar, Users, ExternalLink } from "lucide-react"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

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
  checkIn: string;
  checkOut: string;
  mail?: string;
  phone?: string;
  city?: string;
  region?: string;
  reservationType?: string;
  totalPrice?: number;
  isPaid?: boolean;
  note?: string;
  isCreatedByAdmin?: boolean;
  stripeId?: string;
  paymentIntentId?: string;
  external_id?: string;
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

interface TimelineViewProps {
  currentDate: Date;
  reservations: Reservation[];
  calendarDays: CalendarDay[];
  onSelectDate: (date: Date) => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({
  currentDate,
  reservations,
  calendarDays,
  onSelectDate
}) => {
  const [showDebug, setShowDebug] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const daysInMonth = getDaysInMonth(currentDate);
  
  // Generate days array for the month
  const days = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
      const isBlocked = calendarDays.some(calDay => {
        const calDayDate = new Date(calDay.date);
        return (
          calDayDate.getDate() === day.getDate() &&
          calDayDate.getMonth() === day.getMonth() &&
          calDayDate.getFullYear() === day.getFullYear() &&
          calDay.isBlocked
        );
      });
      
      return { day, isBlocked };
    });
  }, [currentDate, calendarDays, daysInMonth]);
  
  // Format date to display in a human-readable format
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    const monthsShort = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    return `${date.getDate()} ${monthsShort[date.getMonth()]} ${date.getFullYear()}`;
  };
  
  // Format price to display with Euro symbol
  const formatPrice = (price: number | undefined) => {
    if (price === undefined) return "N/A";
    return `${price.toFixed(2)} €`;
  };
  
  // Process reservations for timeline display
  const timelineReservations = useMemo(() => {
    // If no reservations, return empty array
    if (!reservations || reservations.length === 0) {
      return [];
    }
    
    return reservations.map(reservation => {
      // Extract check-in and check-out dates
      const checkInDate = new Date(reservation.dayFrom || reservation.checkIn);
      const checkOutDate = new Date(reservation.dayTo || reservation.checkOut);
      
      // Skip reservations that don't overlap with current month
      if (checkOutDate.getMonth() < currentDate.getMonth() && checkOutDate.getFullYear() <= currentDate.getFullYear()) {
        return null;
      }
      if (checkInDate.getMonth() > currentDate.getMonth() && checkInDate.getFullYear() >= currentDate.getFullYear()) {
        return null;
      }
      
      // Calculate visual position in the timeline
      const startDay = Math.max(
        1, 
        checkInDate.getMonth() === currentDate.getMonth() && checkInDate.getFullYear() === currentDate.getFullYear()
          ? checkInDate.getDate()
          : 1
      );
      
      const endDay = Math.min(
        daysInMonth,
        checkOutDate.getMonth() === currentDate.getMonth() && checkOutDate.getFullYear() === currentDate.getFullYear()
          ? checkOutDate.getDate()
          : daysInMonth
      );
      
      // Calculate percentage offsets for CSS positioning
      const startOffset = ((startDay - 1) / daysInMonth) * 100;
      const width = ((endDay - startDay + 1) / daysInMonth) * 100;
      
      // Extract room information for display
      const roomInfos = new Set<string>();
      
      // Try to get room info from RoomReservation first
      if (reservation.RoomReservation && reservation.RoomReservation.length > 0) {
        reservation.RoomReservation.forEach(roomRes => {
          if (roomRes.RoomReservationSpec && roomRes.RoomReservationSpec.length > 0) {
            roomRes.RoomReservationSpec.forEach(spec => {
              if (spec.RoomLinkBed?.Room) {
                roomInfos.add(spec.RoomLinkBed.Room.description);
              }
            });
          }
        });
      }
      
      // If no rooms found in RoomReservation, use the rooms array
      if (roomInfos.size === 0 && reservation.rooms && reservation.rooms.length > 0) {
        reservation.rooms.forEach(room => {
          roomInfos.add(room.description);
        });
      }
      
      // Join room descriptions for display
      const roomsDescription = Array.from(roomInfos).join(", ") || "Camera non specificata";
      
      return {
        reservation,
        startDay,
        endDay,
        startOffset,
        width,
        roomsDescription
      };
    }).filter(Boolean); // Remove null entries
  }, [reservations, currentDate, daysInMonth]);
  
  const weekDays = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  
  // Create color map for reservations to ensure consistent colors
  const reservationColors = useMemo(() => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
      'bg-orange-500', 'bg-pink-500', 'bg-indigo-500',
      'bg-yellow-500', 'bg-teal-500', 'bg-red-500'
    ];
    
    const colorMap = new Map<number, string>();
    let colorIndex = 0;
    
    reservations.forEach(res => {
      if (!colorMap.has(res.id)) {
        colorMap.set(res.id, colors[colorIndex % colors.length]);
        colorIndex++;
      }
    });
    
    return colorMap;
  }, [reservations]);
  
  // Calculate how many rows we need for the timeline
  // Each row will have non-overlapping reservations
  const { timelineRows, rowsCount } = useMemo(() => {
    if (timelineReservations.length === 0) {
      return { timelineRows: [], rowsCount: 0 };
    }
    
    // Sort reservations by start day (ascending) and duration (descending)
    const sortedReservations = [...timelineReservations]
      .sort((a, b) => {
        // Make TypeScript happy by ensuring a and b are not null
        if (!a || !b) return 0;
        
        if (a.startDay !== b.startDay) {
          return a.startDay - b.startDay;
        }
        // If start days are equal, prioritize longer reservations
        return (b.endDay - b.startDay) - (a.endDay - a.startDay);
      });
    
    const rows: typeof timelineReservations[] = [];
    
    // Place each reservation in the first row where it doesn't overlap
    sortedReservations.forEach(res => {
      // Skip if res is null (shouldn't happen due to filter, but TypeScript doesn't know)
      if (!res) return;
      
      let placed = false;
      
      // Try to place in an existing row
      for (let i = 0; i < rows.length; i++) {
        // Check if this reservation overlaps with any in this row
        const hasOverlap = rows[i].some(existingRes => {
          // Make TypeScript happy by ensuring existingRes is not null
          if (!existingRes) return false;
          
          // Check if the reservations overlap
          return !(res.endDay < existingRes.startDay || res.startDay > existingRes.endDay);
        });
        
        if (!hasOverlap) {
          rows[i].push(res);
          placed = true;
          break;
        }
      }
      
      // If we couldn't place in any existing row, create a new row
      if (!placed) {
        rows.push([res]);
      }
    });
    
    return { timelineRows: rows, rowsCount: rows.length };
  }, [timelineReservations]);
  
  if (!reservations || reservations.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        Nessuna prenotazione per questo mese
      </div>
    );
  }
  
  // Function to get guest count for reservation
  const calculateGuestsForReservation = (reservation: Reservation): number => {
    // Check if guestCount is already available
    if (reservation.guestCount !== undefined) {
      return reservation.guestCount;
    }
    
    // Otherwise, count each RoomReservationSpec as a guest
    return reservation.RoomReservation?.reduce(
      (total, roomRes) => total + (roomRes.RoomReservationSpec?.length || 0), 
      0
    ) || 0;
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button 
          onClick={() => setShowDebug(!showDebug)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <Info size={14} /> {showDebug ? 'Nascondi Debug' : 'Mostra Debug'}
        </button>
      </div>
      
      {showDebug && (
        <div className="bg-gray-50 rounded p-4 mb-4 text-xs border border-gray-200">
          <h3 className="font-bold mb-2">Informazioni di Debug</h3>
          <div className="grid grid-cols-2 gap-2">
            <div><span className="font-medium">Mese corrente:</span> {currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</div>
            <div><span className="font-medium">Giorni nel mese:</span> {daysInMonth}</div>
            <div><span className="font-medium">Prenotazioni totali:</span> {reservations.length}</div>
            <div><span className="font-medium">Prenotazioni visualizzate:</span> {timelineReservations.length}</div>
            <div><span className="font-medium">Righe Timeline:</span> {rowsCount}</div>
          </div>
          
          {reservations.length > 0 && (
            <div className="mt-3">
              <div className="font-medium mb-1">Dettagli prenotazioni:</div>
              <div className="max-h-40 overflow-auto bg-white border border-gray-200 rounded p-2">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b">
                      <th className="p-1">ID</th>
                      <th className="p-1">Nome</th>
                      <th className="p-1">Check In/Out</th>
                      <th className="p-1">Ospiti</th>
                      <th className="p-1">Camere</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.slice(0, 5).map(res => (
                      <tr key={res.id} className="border-b border-gray-100">
                        <td className="p-1">{res.id}</td>
                        <td className="p-1">{res.name} {res.surname}</td>
                        <td className="p-1 text-xs">
                          {new Date(res.dayFrom || res.checkIn).toLocaleDateString('it-IT')} →<br/>
                          {new Date(res.dayTo || res.checkOut).toLocaleDateString('it-IT')}
                        </td>
                        <td className="p-1">{res.guestCount || 'N/A'}</td>
                        <td className="p-1">
                          {res.rooms && res.rooms.length > 0 ? (
                            <span>{res.rooms.length} stanze</span>
                          ) : res.RoomReservation && res.RoomReservation.length > 0 ? (
                            <span>{res.RoomReservation.length} prenotazioni</span>
                          ) : (
                            <span className="text-red-500">Nessuna stanza</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {reservations.length > 5 && (
                      <tr>
                        <td colSpan={5} className="p-1 text-center text-gray-500">
                          ... e altre {reservations.length - 5} prenotazioni
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="overflow-x-auto pb-4">
        <div className="min-w-[800px]">
          {/* Timeline header with days */}
          <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
            <div className="w-44 min-w-44 flex-shrink-0 p-2 font-medium border-r border-gray-200">
              Prenotazioni
            </div>
            <div className="flex-grow flex">
              {days.map(({ day, isBlocked }) => {
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div 
                    key={day.getDate()} 
                    className={`flex-1 min-w-[45px] p-1 text-center border-r border-gray-100 text-xs flex flex-col items-center cursor-pointer hover:bg-gray-50 transition-colors ${
                      isBlocked ? 'bg-orange-50' : isWeekend ? 'bg-gray-50' : ''
                    }`}
                    onClick={() => onSelectDate(day)}
                  >
                    <span className="font-medium">{day.getDate()}</span>
                    <span className="text-gray-500">{weekDays[day.getDay()]}</span>
                    {isBlocked && (
                      <span className="text-orange-500 text-[9px]">Bloccato</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Timeline rows with reservations */}
          <div className="relative">
            {timelineRows.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                Nessuna prenotazione per questo mese
              </div>
            ) : (
              <div>
                {timelineRows.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex border-b border-gray-200 h-16 relative">
                    {rowIndex === 0 && (
                      <div className="w-44 min-w-44 flex-shrink-0 p-2 border-r border-gray-200">
                        <span className="text-gray-500 text-xs">Timeline</span>
                      </div>
                    )}
                    {rowIndex > 0 && (
                      <div className="w-44 min-w-44 flex-shrink-0 border-r border-gray-200"></div>
                    )}
                    <div className="flex-grow relative">
                      {/* Background grid lines */}
                      <div className="flex h-full absolute inset-0">
                        {days.map(({ day }) => (
                          <div 
                            key={day.getDate()} 
                            className="flex-1 min-w-[45px] border-r border-gray-100"
                          />
                        ))}
                      </div>
                      
                      {/* Reservation bars */}
                      {row.map((item) => {
                        // Skip if null (should never happen, but TypeScript doesn't know)
                        if (!item) return null;
                        
                        const { reservation, startOffset, width, roomsDescription } = item;
                        const color = reservationColors.get(reservation.id) || 'bg-gray-500';
                        return (
                          <div
                            key={reservation.id}
                            className={`absolute top-2 h-10 ${color} rounded-md text-white text-xs px-2 py-1 truncate overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
                            style={{
                              left: `${startOffset}%`,
                              width: `${width}%`,
                            }}
                            onClick={() => setSelectedReservation(reservation)}
                            title={`${reservation.name} ${reservation.surname} - Dal ${new Date(reservation.dayFrom || reservation.checkIn).toLocaleDateString()} al ${new Date(reservation.dayTo || reservation.checkOut).toLocaleDateString()} - ${roomsDescription}`}
                          >
                            #{reservation.id} {reservation.name} {reservation.surname}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Reservation Detail Dialog */}
      <Dialog open={!!selectedReservation} onOpenChange={(open) => !open && setSelectedReservation(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedReservation && (
            <>
              <DialogHeader>
                <DialogTitle>
                  #{selectedReservation.id} - {selectedReservation.name} {selectedReservation.surname}
                </DialogTitle>
              </DialogHeader>
              
              <div className="mt-4">
                {/* Header with payment status and view button */}
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    {/* Placeholder per eventuali elementi futuri */}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedReservation.isCreatedByAdmin ? (
                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                        Creata da Admin
                      </span>
                    ) : selectedReservation.isPaid ? (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                        Pagata
                      </span>
                    ) : (
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                        Non Pagata
                      </span>
                    )}
                    
                    {selectedReservation.external_id && (
                      <Link href={`/cart/${selectedReservation.external_id}`} target="_blank" passHref>
                        <Button variant="outline" size="sm" className="h-8">
                          <ExternalLink className="w-4 h-4 mr-1" /> Vedi Carrello
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
                
                {/* Payment warning */}
                {!selectedReservation.isPaid && !selectedReservation.isCreatedByAdmin && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded mb-3 text-sm flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                      <line x1="12" y1="9" x2="12" y2="13"></line>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span>Prenotazione non pagata!</span>
                  </div>
                )}
                
                {/* Dates */}
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Check-in: {formatDate(selectedReservation.dayFrom || selectedReservation.checkIn)} - Check-out: {formatDate(selectedReservation.dayTo || selectedReservation.checkOut)}
                  </span>
                </div>
                
                {/* Guest count */}
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <Users className="h-4 w-4" />
                  <span>
                    {calculateGuestsForReservation(selectedReservation)} ospiti
                  </span>
                </div>
                
                {/* Reservation type & price */}
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="text-sm">
                    <span className="block text-gray-500">Tipo:</span>
                    <span className="font-medium">{selectedReservation.reservationType || 'N/A'}</span>
                  </div>
                  <div className="text-sm">
                    <span className="block text-gray-500">Prezzo totale:</span>
                    <span className="font-medium">{formatPrice(selectedReservation.totalPrice)}</span>
                  </div>
                </div>
                
                {/* Contact info */}
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="text-sm">
                    <span className="block text-gray-500">Email:</span>
                    <span className="font-medium truncate">{selectedReservation.mail || 'N/A'}</span>
                  </div>
                  <div className="text-sm">
                    <span className="block text-gray-500">Telefono:</span>
                    <span className="font-medium">{selectedReservation.phone || 'N/A'}</span>
                  </div>
                </div>
                
                {/* Location */}
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="text-sm">
                    <span className="block text-gray-500">Città:</span>
                    <span className="font-medium">{selectedReservation.city || 'N/A'}</span>
                  </div>
                  <div className="text-sm">
                    <span className="block text-gray-500">Regione:</span>
                    <span className="font-medium">{selectedReservation.region || 'N/A'}</span>
                  </div>
                </div>
                
                {/* Notes if available */}
                {selectedReservation.note && (
                  <div className="mt-3 text-sm">
                    <span className="block text-gray-500">Note:</span>
                    <p className="bg-white p-2 rounded border border-gray-100 mt-1">{selectedReservation.note}</p>
                  </div>
                )}
                
                {/* Room details if available */}
                {((selectedReservation.RoomReservation && selectedReservation.RoomReservation.length > 0) || 
                  (selectedReservation.rooms && selectedReservation.rooms.length > 0)) && (
                  <div className="mt-4">
                    <span className="block text-gray-500 mb-2">Dettagli delle stanze:</span>
                    <div className="bg-gray-50 p-3 rounded border border-gray-200">
                      {selectedReservation.RoomReservation && selectedReservation.RoomReservation.map(roomRes => (
                        <div key={roomRes.id} className="mb-2 last:mb-0">
                          {roomRes.RoomReservationSpec && roomRes.RoomReservationSpec.map(spec => (
                            <div key={spec.id} className="text-sm py-1 border-b border-gray-100 last:border-0">
                              {spec.RoomLinkBed?.Room && (
                                <div>
                                  <span className="font-medium">{spec.RoomLinkBed.Room.description}</span>
                                  <span className="text-gray-500 ml-2">- Letto: {spec.RoomLinkBed.name}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                      
                      {(!selectedReservation.RoomReservation || selectedReservation.RoomReservation.length === 0) && 
                      selectedReservation.rooms && selectedReservation.rooms.map(room => (
                        <div key={room.id} className="text-sm py-1">
                          <span className="font-medium">{room.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TimelineView; 