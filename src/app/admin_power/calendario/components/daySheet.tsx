'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Lock, Unlock } from "lucide-react"
import { useState } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { supabase } from "@/lib/supabase"

interface RoomDetail {
  roomId: number;
  description: string;
  guestCount: number;
  beds: {
    id: number;
    name: string;
  }[];
}

interface Reservation {
  id: number;
  dayFrom: string;
  dayTo: string;
  name: string;
  surname: string;
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

interface DaySheetProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  reservations: Reservation[];
  isBlocked: boolean;
  onDayBlockToggle: () => void;
}

const DaySheet = ({ isOpen, onClose, date, reservations, isBlocked, onDayBlockToggle }: DaySheetProps) => {
    console.log('DaySheet received reservations:', reservations);
  const [isLoading, setIsLoading] = useState(false);

  const monthsShort = [
    "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
    "Lug", "Ago", "Set", "Ott", "Nov", "Dic"
  ];

  const handleBlockToggle = async () => {
    setIsLoading(true);
    try {
      if (isBlocked) {
        const { error } = await supabase
          .from('day_blocked')
          .delete()
          .eq('day_blocked', date.toISOString());
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('day_blocked')
          .insert([{ day_blocked: date.toISOString() }]);
        
        if (error) throw error;
      }
      onDayBlockToggle();
    } catch (error) {
      console.error('Error toggling day block:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const processRoomDetails = (reservations: Reservation[]): RoomDetail[] => {
    const roomsMap = new Map<number, RoomDetail>();

    reservations.forEach(reservation => {
      if (!reservation.RoomReservation) return;

      reservation.RoomReservation.forEach(roomRes => {
        if (!roomRes.RoomReservationSpec) return;

        roomRes.RoomReservationSpec.forEach(spec => {
          if (!spec.RoomLinkBed?.Room) return;

          const room = spec.RoomLinkBed.Room;
          if (!roomsMap.has(room.id)) {
            roomsMap.set(room.id, {
              roomId: room.id,
              description: room.description,
              guestCount: 0,
              beds: []
            });
          }

          const roomDetail = roomsMap.get(room.id)!;
          roomDetail.guestCount++;
          roomDetail.beds.push({
            id: spec.RoomLinkBed.id,
            name: spec.RoomLinkBed.name
          });
        });
      });
    });

    return Array.from(roomsMap.values());
  };

  const totalGuests = reservations.reduce((sum, res) => {
    return sum + (res.RoomReservation?.reduce((roomSum, rr) => 
      roomSum + (rr.RoomReservationSpec?.length || 0), 0) || 0);
  }, 0);

  const roomDetails = processRoomDetails(reservations);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center justify-between">
            <span>
              {date.getDate()} {monthsShort[date.getMonth()]} {date.getFullYear()}
            </span>
            <Button
              onClick={handleBlockToggle}
              disabled={isLoading}
              variant={isBlocked ? "destructive" : "outline"}
            >
              {isBlocked ? (
                <><Unlock className="w-4 h-4 mr-2" /> Sblocca giorno</>
              ) : (
                <><Lock className="w-4 h-4 mr-2" /> Blocca giorno</>
              )}
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          <div className="flex items-center justify-between px-2 py-3 bg-gray-100 rounded">
            <span className="font-semibold">Totale ospiti attesi:</span>
            <span>{totalGuests}</span>
          </div>

          {roomDetails.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {roomDetails.map((room) => (
                <AccordionItem key={room.roomId} value={room.roomId.toString()}>
                  <AccordionTrigger className="px-2 hover:no-underline hover:bg-gray-50">
                    <div className="flex justify-between w-full">
                      <span>{room.description}</span>
                      <span className="font-normal">
                        {room.guestCount} ospit{room.guestCount === 1 ? 'e' : 'i'}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-2">
                    <ul className="space-y-2">
                      {room.beds.map((bed) => (
                        <li key={bed.id} className="flex items-center">
                          <span className="text-sm text-gray-600">{bed.name}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="text-center text-gray-500">
              Nessuna prenotazione per questa data
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DaySheet;