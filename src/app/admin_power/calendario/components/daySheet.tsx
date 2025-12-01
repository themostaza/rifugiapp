'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Lock, Unlock, Calendar, Users, ExternalLink, Loader2, AlertTriangle, LogIn, CalendarPlus, Eye, Bed, UserCheck, Ban} from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { toggleBlockDay } from "@/utils/blockDays"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import BedDetailPdfGenerator from "./BedDetailPdfGenerator"
import ReservationListPdfGenerator from "./ReservationListPdfGenerator"

// --- Copied Manual Type Definitions (from API route) ---
interface Room {
  id: number;
  description: string | null;
  RoomLinkBed: { count: number }[] | null; 
}

interface RoomLinkBed {
  id: number;
  name: string | null;
  Room: Room | null;
}

interface GuestDivision {
  id: number;
  title: string | null;
  description: string | null;
}

interface RoomReservationSpec {
  id: number;
  GuestDivision: GuestDivision | null;
  RoomLinkBed: RoomLinkBed | null;
}

interface RoomReservation {
  id: number;
  RoomReservationSpec: RoomReservationSpec[] | null;
}
// --- End Copied Definitions ---

// Interface matching the structure returned by the new API
// Includes guestBreakdown, blockedBedDetails, roomBedDetails
interface DetailedReservation {
  id: number;
  dayFrom: string;
  dayTo: string;
  name: string | null;
  surname: string | null;
  mail: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  reservationType: string | null;
  totalPrice: number | null;
  isPaid: boolean | null;
  note: string | null;
  isCreatedByAdmin: boolean | null;
  stripeId: string | null;
  paymentIntentId: string | null;
  // Campi Nexi
  nexiOrderId?: string | null;
  nexiOperationId?: string | null;
  nexiPaymentCircuit?: string | null;
  external_id: string | null;
  RoomReservation: RoomReservation[] | null; // Use the copied interface
  guestBreakdown: {
    adults: number;
    children: number;
    infants: number;
  };
}

// Interface for the API response
interface DayDetailsResponse {
    detailedReservations: DetailedReservation[];
    blockedBedsByRoom: { [roomId: number]: number };
    availableBeds: number | null;
    totalBlockedBeds: number | null;
    blockedBedDetails: { bedId: number; roomReservationId: number }[];
    roomBedDetails: { id: number; name: string; roomId: number }[];
}

interface DaySheetProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  // removed reservations prop
  isBlocked: boolean;
  onDayBlockToggle: () => void;
}

// Helper type for bed details in the dialog
interface BedStatus {
    id: number;
    name: string;
    roomId: number;
    status: 'free' | 'blocked' | 'booked';
    bookedBy?: { // Details if status is 'booked'
        reservationId: number;
        name: string | null;
        surname: string | null;
        guestType: string | null;
        phone: string | null;
    };
    blockedByReservationId?: number; // Added: ID of the reservation that blocked this bed
}

const DaySheet = ({ isOpen, onClose, date, isBlocked, onDayBlockToggle }: DaySheetProps) => {
  const [isLoadingBlockToggle, setIsLoadingBlockToggle] = useState(false);
  const [blockState, setBlockState] = useState(isBlocked);

  // State for fetching and storing detailed reservation data
  const [detailedReservations, setDetailedReservations] = useState<DetailedReservation[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  // State for the map of blocked beds per room (for summary table)
  const [blockedBedsByRoom, setBlockedBedsByRoom] = useState<{ [roomId: number]: number }>({});
  // State for available beds (for summary)
  const [availableBeds, setAvailableBeds] = useState<number | null>(null);
  // State for total blocked beds (for summary)
  const [totalBlockedBeds, setTotalBlockedBeds] = useState<number | null>(null);
  // State for specific blocked bed details (for dialog)
  const [blockedBedDetails, setBlockedBedDetails] = useState<{ bedId: number; roomReservationId: number }[]>([]);
  // State for all bed details (for dialog)
  const [roomBedDetails, setRoomBedDetails] = useState<{ id: number; name: string; roomId: number }[]>([]);

  // State for the details dialog
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Sincronizza lo stato di blocco quando cambia la prop isBlocked
  useEffect(() => {
    setBlockState(isBlocked);
  }, [isBlocked]);

  // Fetch detailed data when the sheet opens or the date changes
  useEffect(() => {
    if (isOpen && date) {
      const fetchDetails = async () => {
        setIsLoadingDetails(true);
        setDetailError(null);
        setDetailedReservations([]); // Clear previous data
        setBlockedBedsByRoom({}); // Clear blocked beds map
        setAvailableBeds(null); // Clear available beds
        setTotalBlockedBeds(null); // Clear total blocked beds
        setBlockedBedDetails([]); // Clear new blocked details state
        setRoomBedDetails([]); // Clear bed details
        try {
          // Format date as YYYY-MM-DD reliably
          const year = date.getFullYear();
          const month = (date.getMonth() + 1).toString().padStart(2, '0'); 
          const day = date.getDate().toString().padStart(2, '0');
          const dateString = `${year}-${month}-${day}`; 

          const response = await fetch(`/api/calendario_giorno_dettagli?date=${dateString}`);
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); 
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
          }

          // Use the new interface for the response data
          const data: DayDetailsResponse = await response.json(); 

          // Check if essential data is present
          if (data.detailedReservations && data.blockedBedDetails && data.roomBedDetails) {
            setDetailedReservations(data.detailedReservations);
            setBlockedBedsByRoom(data.blockedBedsByRoom || {}); 
            setAvailableBeds(data.availableBeds !== undefined ? data.availableBeds : null);
            setTotalBlockedBeds(data.totalBlockedBeds !== undefined ? data.totalBlockedBeds : null);
            setBlockedBedDetails(data.blockedBedDetails); // Store new blocked details
            setRoomBedDetails(data.roomBedDetails); // Store all bed details
          } else {
             // Handle cases where the response might be missing fields
             // Use type assertion to safely check for a potential error property
             if ((data as unknown as { error?: string }).error) { 
                setDetailError((data as { error?: string }).error ?? 'Incomplete response with unspecified error');
             } else {
                console.warn("API response missing expected fields: detailedReservations, blockedBedDetails, or roomBedDetails", data);
                setDetailError('Invalid or incomplete response format from details API');
             }
             // Set default empty/null values for safety (updated)
             setDetailedReservations(data.detailedReservations || []);
             setBlockedBedsByRoom(data.blockedBedsByRoom || {}); 
             setAvailableBeds(data.availableBeds !== undefined ? data.availableBeds : null);
             setTotalBlockedBeds(data.totalBlockedBeds !== undefined ? data.totalBlockedBeds : null);
             setBlockedBedDetails(data.blockedBedDetails || []);
             setRoomBedDetails(data.roomBedDetails || []);
          }
        } catch (error: unknown) {
          console.error("Failed to fetch day details:", error);
          setDetailError(error instanceof Error ? error.message : 'Failed to load reservation details');
        } finally {
          setIsLoadingDetails(false);
        }
      };
      fetchDetails();
    }
  }, [isOpen, date]); // Re-fetch if date changes while open, or when opened

  // Calculate total guests and breakdown based on the detailed fetched data
  const totalBreakdown = detailedReservations.reduce(
      (totals, res) => {
          totals.adults += res.guestBreakdown.adults;
          totals.children += res.guestBreakdown.children;
          totals.infants += res.guestBreakdown.infants;
          return totals;
      },
      { adults: 0, children: 0, infants: 0 } // Initial totals
  );

  const totalGuests = totalBreakdown.adults + totalBreakdown.children + totalBreakdown.infants;
  // Create the breakdown string for display
  const totalBreakdownString = `(A:${totalBreakdown.adults}, B:${totalBreakdown.children}, N:${totalBreakdown.infants})`;

  // Calculate room occupancy summary (sorted by Room ID)
  const roomOccupancySummary = useMemo(() => {
      if (!detailedReservations) {
      return [];
    }

    const occupancy: { 
      [roomId: number]: { 
        id: number; 
        description: string; 
        bedCount: number; 
        booked: { adults: number; children: number; infants: number }; 
        totalBooked: number; 
        blockedCount: number;
      }
    } = {};

    detailedReservations.forEach(reservation => {
      reservation.RoomReservation?.forEach(rr => {
        rr.RoomReservationSpec?.forEach((spec: RoomReservationSpec) => { 
          const roomLinkBed = spec.RoomLinkBed;
          const room = roomLinkBed?.Room;
          const guestDivision = spec.GuestDivision;

          if (room && room.id) {
            if (!occupancy[room.id]) {
              const maxBeds = room.RoomLinkBed?.[0]?.count ?? 0; 
              occupancy[room.id] = {
                id: room.id,
                description: room.description || `Stanza ${room.id}`,
                              bedCount: maxBeds, 
                booked: { adults: 0, children: 0, infants: 0 },
                totalBooked: 0,
                              blockedCount: blockedBedsByRoom[room.id] || 0 
              };
            }

            const divisionTitle = guestDivision?.title?.toLowerCase() || '';
            if (divisionTitle.includes('adult')) {
              occupancy[room.id].booked.adults++;
            } else if (divisionTitle.includes('bambin')) {
              occupancy[room.id].booked.children++;
            } else if (divisionTitle.includes('neonat')) {
              occupancy[room.id].booked.infants++;
            }
            occupancy[room.id].totalBooked++;
          }
        });
      });
    });

      // Sort primarily by Room ID
      return Object.values(occupancy).sort((a, b) => a.id - b.id);

  }, [detailedReservations, blockedBedsByRoom]);

  // Calculate detailed bed statuses for the dialog (beds sorted by Bed ID)
  const bedStatusesByRoom = useMemo<{ [roomId: number]: BedStatus[] }>(() => {
    const statuses: { [roomId: number]: BedStatus[] } = {};

    // 1. Initialize all beds from roomBedDetails
    roomBedDetails.forEach(bed => {
      if (!statuses[bed.roomId]) {
        statuses[bed.roomId] = [];
      }
      statuses[bed.roomId].push({
        id: bed.id,
        name: bed.name || `Letto ${bed.id}`,
        roomId: bed.roomId,
        status: 'free',
      });
    });

    // 2. Mark blocked beds
    blockedBedDetails.forEach(blockInfo => {
        const { bedId, roomReservationId } = blockInfo;
        for (const roomId in statuses) {
            const bedIndex = statuses[roomId].findIndex(b => b.id === bedId);
            if (bedIndex !== -1) {
                statuses[roomId][bedIndex].status = 'blocked';
                statuses[roomId][bedIndex].blockedByReservationId = roomReservationId;
                break; 
            }
        }
    });

    // 3. Mark booked beds (populate phone number)
    detailedReservations.forEach(res => {
        res.RoomReservation?.forEach(rr => {
            rr.RoomReservationSpec?.forEach(spec => {
                const bedId = spec.RoomLinkBed?.id;
                const roomId = spec.RoomLinkBed?.Room?.id;
                if (bedId && roomId && statuses[roomId]) {
                    const bedIndex = statuses[roomId].findIndex(b => b.id === bedId);
                    if (bedIndex !== -1 && statuses[roomId][bedIndex].status === 'free') {
                        statuses[roomId][bedIndex].status = 'booked';
                        statuses[roomId][bedIndex].bookedBy = {
                            reservationId: res.id,
                            name: res.name,
                            surname: res.surname,
                            guestType: spec.GuestDivision?.title || 'N/A',
                            phone: res.phone,
                        };
                    }
                }
            });
        });
    });

    // 4. Sort beds within each room by Bed ID
    for (const roomId in statuses) {
        statuses[roomId].sort((a, b) => a.id - b.id); // <-- Sort by Bed ID (RoomLinkBed.id)
    }

    return statuses;
  }, [roomBedDetails, blockedBedDetails, detailedReservations]);

  // Check if any room is overbooked based on the summary
  const isAnyRoomOverbooked = useMemo(() => {
    return roomOccupancySummary.some(room => room.totalBooked + room.blockedCount > room.bedCount);
  }, [roomOccupancySummary]);

  // --- Calculate Arriving Guests and Reservations ---
  const arrivingStats = useMemo(() => {
    if (!detailedReservations || !date) {
      return { arrivingReservationsCount: 0, arrivingGuestsCount: 0 };
    }

    // Format the sheet's date to YYYY-MM-DD for comparison
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const sheetDateString = `${year}-${month}-${day}`;

    let arrivingReservationsCount = 0;
    let arrivingGuestsCount = 0;

    detailedReservations.forEach(res => {
      // Assuming dayFrom is already in YYYY-MM-DD format or similar
      // We might need to re-format res.dayFrom if it includes time/timezone
      const reservationStartDate = res.dayFrom?.split('T')[0]; // Get YYYY-MM-DD part

      if (reservationStartDate === sheetDateString) {
        arrivingReservationsCount++;
        arrivingGuestsCount += (res.guestBreakdown.adults + res.guestBreakdown.children + res.guestBreakdown.infants);
      }
    });

    return { arrivingReservationsCount, arrivingGuestsCount };

  }, [detailedReservations, date]);
  // --- End Calculation ---

  const monthsShort = [
    "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
    "Lug", "Ago", "Set", "Ott", "Nov", "Dic"
  ];

  const handleBlockToggle = async () => {
    setIsLoadingBlockToggle(true);
    try {
      const success = await toggleBlockDay(date, blockState, {
        onSuccess: () => {
          setBlockState(!blockState);
          onDayBlockToggle(); // Notify parent
        }
      });
      
      if (!success) {
        console.error('Failed to toggle block state via API');
        // Optionally revert local state or show error to user
      }
    } catch (error) {
      console.error('Error toggling day block:', error);
      // Optionally show error to user
    } finally {
      setIsLoadingBlockToggle(false);
    }
  };

  // Format date to display in a human-readable format
  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    // Check if date is valid
    if (isNaN(date.getTime())) return "Invalid Date";
    return `${date.getDate()} ${monthsShort[date.getMonth()]} ${date.getFullYear()}`;
  };
  
  // Format price to display with Euro symbol
  const formatPrice = (price: number | undefined | null) => {
    if (price === undefined || price === null) return "N/A";
    return `${price.toFixed(2)} €`;
  };

  // Renders the main content of the sheet (loading, error, or reservations list)
  const renderContent = () => {
    if (isLoadingDetails) {
      return (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          <span className="ml-2 text-gray-600">Caricamento dettagli...</span>
        </div>
      );
    }

    if (detailError) {
      return (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-3 text-sm flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          <span>Errore nel caricamento: {detailError}</span>
        </div>
      );
    }

    if (detailedReservations.length === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          Nessuna prenotazione trovata per questa data.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {detailedReservations.map(reservation => {
          const isPaid = reservation.isPaid ?? false;
          const isAdmin = reservation.isCreatedByAdmin ?? false;
          const paymentWarning = !isPaid && !isAdmin;
          const guestBreakdownString = `A:${reservation.guestBreakdown.adults}, B:${reservation.guestBreakdown.children}, N:${reservation.guestBreakdown.infants}`;
          const totalReservationGuests = reservation.guestBreakdown.adults + reservation.guestBreakdown.children + reservation.guestBreakdown.infants;

          return (
          <div key={reservation.id} className="bg-gray-50 p-4 rounded-md border border-gray-200">
            {/* Header with payment status and view button */}
            <div className="flex justify-between items-start mb-3 gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-lg">#{reservation.id}</span>
                <span className="font-semibold">
                  {reservation.name || 'N/A'} {reservation.surname || ''}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isAdmin ? (
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">
                    Admin
                  </span>
                ) : isPaid ? (
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                    Pagata
                  </span>
                ) : (
                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
                    Non Pagata
                  </span>
                )}
                
                {reservation.external_id && (
                  <Link href={`/cart/${reservation.external_id}`} target="_blank" passHref>
                    <Button variant="outline" size="sm" className="h-8">
                      <ExternalLink className="w-4 h-4 mr-1" /> Vedi
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            
            {/* Payment warning */}
            {paymentWarning && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded mb-3 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Attenzione: Questa prenotazione non risulta pagata e non è stata creata manualmente da un admin.</span>
              </div>
            )}
            
            {/* Dates */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span>
                Check-in: {formatDate(reservation.dayFrom)} - Check-out: {formatDate(reservation.dayTo)}
              </span>
            </div>
            
            {/* Guest count & Breakdown */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <Users className="h-4 w-4 flex-shrink-0" />
              <span>
                {totalReservationGuests} ospiti ({guestBreakdownString})
              </span>
            </div>
            
            {/* Reservation type & price */}
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="text-sm">
                <span className="block text-gray-500">Tipo:</span>
                <span className="font-medium">
                  {reservation.reservationType === 'hb' 
                    ? 'Mezza Pensione' 
                    : reservation.reservationType === 'bb' 
                      ? 'Bed & Breakfast' 
                      : reservation.reservationType || 'N/A'}
                </span>
              </div>
              <div className="text-sm">
                <span className="block text-gray-500">Prezzo:</span>
                <span className="font-medium">{formatPrice(reservation.totalPrice)}</span>
              </div>
            </div>
            
            {/* Contact info */}
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="text-sm">
                <span className="block text-gray-500">Email:</span>
                <span className="font-medium truncate" title={reservation.mail || ''}>{reservation.mail || 'N/A'}</span>
              </div>
              <div className="text-sm">
                <span className="block text-gray-500">Telefono:</span>
                <span className="font-medium">{reservation.phone || 'N/A'}</span>
              </div>
            </div>
            
            {/* Location */}
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="text-sm">
                <span className="block text-gray-500">Stato:</span>
                <span className="font-medium">{reservation.city || 'N/A'}</span>
              </div>
              <div className="text-sm">
                <span className="block text-gray-500">Regione:</span>
                <span className="font-medium">{reservation.region || 'N/A'}</span>
              </div>
            </div>
            
            {/* Notes if available */}
            {reservation.note && (
              <div className="mt-3 text-sm">
                <span className="block text-gray-500 mb-1">Note:</span>
                <p className="bg-white p-2 rounded border border-gray-100 text-gray-700 whitespace-pre-wrap">{reservation.note}</p>
              </div>
            )}
            
            {/* Payment details if available */}
            {(reservation.stripeId || reservation.paymentIntentId || reservation.nexiOrderId) && (
              <div className="mt-3 space-y-1 text-xs text-gray-500">
                {/* Mostra info Nexi se presente */}
                {reservation.nexiOrderId ? (
                  <>
                    <div className="flex flex-wrap items-center">
                      <span className="mr-1">ID Pagamento (Nexi):</span>
                      <span className="font-mono bg-green-100 px-1 py-0.5 rounded break-all">{reservation.nexiOrderId}</span>
                    </div>
                    {reservation.nexiOperationId && (
                      <div className="flex flex-wrap items-center">
                        <span className="mr-1">Cod. Autorizzazione:</span>
                        <span className="font-mono bg-gray-100 px-1 py-0.5 rounded break-all">{reservation.nexiOperationId}</span>
                      </div>
                    )}
                    {reservation.nexiPaymentCircuit && (
                      <div className="flex flex-wrap items-center">
                        <span className="mr-1">Circuito:</span>
                        <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">{reservation.nexiPaymentCircuit}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {reservation.stripeId && (
                      <div className="flex flex-wrap items-center">
                        <span className="mr-1">Stripe ID:</span>
                        <span className="font-mono bg-gray-100 px-1 py-0.5 rounded break-all">{reservation.stripeId}</span>
                      </div>
                    )}
                    {reservation.paymentIntentId && (
                      <div className="flex flex-wrap items-center">
                        <span className="mr-1">Payment Intent:</span>
                        <span className="font-mono bg-gray-100 px-1 py-0.5 rounded break-all">{reservation.paymentIntentId}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )})}
      </div>
    );
  };

   return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="right" 
        className="!w-[90vw] sm:!w-[70vw] md:!w-[60vw] lg:!w-[50vw] !max-w-[800px] flex flex-col"
      >
        {/* Fixed Header*/}
        <SheetHeader className="mb-1 border-b pb-4 flex-shrink-0">
          <div className="flex justify-between items-center gap-4">
            {/* Sheet Title */}
            <SheetTitle className="flex items-center gap-2 flex-wrap flex-grow"> {/* Added flex-grow */}
              <span className="text-xl">
                  {date.getDate()} {monthsShort[date.getMonth()]} {date.getFullYear()}
              </span>
                {/* Badges */} 
              {!isLoadingDetails && !detailError && roomOccupancySummary.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${ 
                        isAnyRoomOverbooked ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-800 border border-green-200'
                    }`}>
                      {isAnyRoomOverbooked ? 'Da Attenzionare!' : 'Check Positivo'}
                  </span>
                  {availableBeds !== null && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${ 
                            availableBeds === 0 ? 'bg-orange-100 text-orange-800 border border-orange-200' : 'bg-blue-100 text-blue-800 border border-blue-200' 
                        }`}>
                          {availableBeds === 0 ? 'Full!' : `Disponibili: ${availableBeds}`}
                      </span>
                  )}
                </div>
              )}
            </SheetTitle>
            
            {/* Removed Download Button from here */} 
          </div>
        </SheetHeader>

        {/* Scrollable Content Area */} 
        <div className="flex-grow overflow-y-auto pr-2 space-y-4">
          {/* Actions and Summary Area (Moved Inside Scrollable Area) */}
          <div className="flex flex-col space-y-3">
            {/* Container for the two PDF buttons */}
            <div className="flex space-x-2">
              {!isLoadingDetails && !detailError && roomOccupancySummary.length > 0 && (
                  <BedDetailPdfGenerator
                    date={date}
                    roomOccupancySummary={roomOccupancySummary}
                    bedStatusesByRoom={bedStatusesByRoom}
                    detailedReservations={detailedReservations}
                    disabled={isLoadingDetails || !!detailError || roomOccupancySummary.length === 0}
                    availableBeds={availableBeds}
                    totalBlockedBeds={totalBlockedBeds}
                    totalGuests={totalGuests}
                  />
              )}
              {!isLoadingDetails && !detailError && detailedReservations.length > 0 && (
                <ReservationListPdfGenerator
                  date={date}
                  detailedReservations={detailedReservations}
                  disabled={isLoadingDetails || !!detailError || detailedReservations.length === 0}
                />
              )}
            </div>
            <Button
              onClick={handleBlockToggle}
              disabled={isLoadingBlockToggle}
              variant={blockState ? "destructive" : "outline"}
              className="w-fit whitespace-nowrap self-start"
            >
              {isLoadingBlockToggle ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : blockState ? (
                <Unlock className="w-4 h-4 mr-2" /> 
              ) : (
                <Lock className="w-4 h-4 mr-2" />
              )}
              {blockState ? 'Sblocca Giorno' : 'Blocca Giorno'}
            </Button>
            
            {/* Summary Section */}
            {!isLoadingDetails && !detailError && (
              <div className="space-y-2">
                  {/* Guest Total */}
                  <div className="w-fit px-4 py-2 bg-blue-50 border border-blue-200 text-blue-800 rounded flex items-center gap-2 text-sm sm:text-base flex-wrap">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <span className="font-semibold whitespace-nowrap">Totale ospiti:</span>
                    <span className="font-bold text-lg mr-1">{totalGuests}</span>
                    <span className="text-xs sm:text-sm whitespace-nowrap">{totalBreakdownString}</span> 
                  </div>
                  {/* Total Blocked Beds - Added */}
                  {totalBlockedBeds !== null && totalBlockedBeds > 0 && (
                    <div className="w-fit px-3 py-1 bg-orange-50 border border-orange-100 text-orange-700 rounded flex items-center gap-2 text-sm ml-4">
                      <Lock className="w-4 h-4 flex-shrink-0" /> 
                      <span className="font-semibold whitespace-nowrap">Letti bloccati (Tot):</span>
                      <span className="font-bold">{totalBlockedBeds}</span>
                    </div>
                  )}
                  {/* Arriving Guests Count */}
                  <div className="w-fit px-3 py-1 bg-blue-50 border border-blue-100 text-blue-700 rounded flex items-center gap-2 text-sm ml-4">
                    <LogIn className="w-4 h-4 flex-shrink-0" />
                    <span className="font-semibold whitespace-nowrap">Ospiti in arrivo:</span>
                    <span className="font-bold">{arrivingStats.arrivingGuestsCount}</span>
                  </div>
                  {/* Reservation Total */}
                  <div className="w-fit px-3 py-1 bg-gray-100 border border-gray-200 text-gray-700 rounded flex items-center gap-2 text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>
                      <span className="font-semibold whitespace-nowrap">Totale prenotazioni:</span>
                      <span className="font-bold">{detailedReservations.length}</span>
                  </div>
                  {/* Arriving Reservations Count */}
                  <div className="w-fit px-3 py-1 bg-gray-100 border border-gray-100 text-gray-600 rounded flex items-center gap-2 text-sm ml-4">
                    <CalendarPlus className="w-4 h-4 flex-shrink-0" />
                    <span className="font-semibold whitespace-nowrap">Prenotazioni in arrivo:</span>
                    <span className="font-bold">{arrivingStats.arrivingReservationsCount}</span>
                  </div>
              </div>
            )}
          </div>
          
          {/* Render Loading/Error/List & Room Summary */}
          {isLoadingDetails ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                <span className="ml-2 text-gray-600">Caricamento dettagli...</span>
              </div>
            ) : detailError ? (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-3 text-sm flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Errore nel caricamento: {detailError}</span>
              </div>
            ) : (
              <>
                {/* Room Occupancy Summary Table & Bed Detail Dialog */}  
                {roomOccupancySummary.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-md font-semibold text-gray-700">Riepilogo Stanze Occupate</h4>
                        {/* --- Bed Detail Dialog Trigger --- */}
                        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 text-xs">
                                    <Eye className="w-3.5 h-3.5 mr-1" />
                                    Dettaglio Letti
                                </Button>
                            </DialogTrigger>
                            {/* --- Bed Detail Dialog Content --- */}
                            <DialogContent className="sm:max-w-[800px] min-h-[90vh]"> {/* Increased width */} 
                                <DialogHeader>
                                <DialogTitle>Dettaglio Assegnazione Letti - {date.getDate()} {monthsShort[date.getMonth()]} {date.getFullYear()}</DialogTitle>
                                <DialogDescription>
                                    Suddivisione letto per letto dello stato di occupazione per ogni stanza.
                                </DialogDescription>
                                </DialogHeader>
                                <div className="mt-4 max-h-[80vh] overflow-y-auto pr-2 space-y-4">
                                    {roomOccupancySummary.length === 0 && <p className="text-gray-500 text-center">Nessuna stanza trovata.</p>} 
                                    {/* Iterate through rooms from summary to maintain order and get description */} 
                                    {roomOccupancySummary.map((roomSummary) => {
                                        // Find the reservation details for blocked beds in this room
                                        const blockingReservationsMap = new Map<number, DetailedReservation>();
                                        if (bedStatusesByRoom[roomSummary.id]) {
                                            bedStatusesByRoom[roomSummary.id].forEach(bed => {
                                                if (bed.status === 'blocked' && bed.blockedByReservationId && !blockingReservationsMap.has(bed.blockedByReservationId)) {
                                                    const blockingRes = detailedReservations.find(res => res.id === bed.blockedByReservationId);
                                                    if (blockingRes) {
                                                        blockingReservationsMap.set(bed.blockedByReservationId, blockingRes);
                                                    }
                                                }
                                            });
                                        }
                                        
                                        return (
                                            <div key={roomSummary.id} className="border rounded-md p-3 bg-gray-50/50">
                                                {/* Room Title with Summary */}
                                                <div className="flex justify-between items-center mb-2 pb-1 border-b">
                                                    <h5 className="font-semibold text-gray-800">{roomSummary.description}</h5>
                                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                                        Prenotati: <strong className="text-blue-600">{roomSummary.totalBooked}</strong> | 
                                                        Bloccati: <strong className="text-orange-600">{roomSummary.blockedCount}</strong> | 
                                                        Max: <strong>{roomSummary.bedCount}</strong>
                                                    </span>
                                                </div>
                                                
                                                {!bedStatusesByRoom[roomSummary.id] || bedStatusesByRoom[roomSummary.id].length === 0 ? (
                                                    <p className="text-sm text-gray-400 italic">Nessun letto definito per questa stanza.</p>
                                                ) : (
                                                    <ul className="space-y-2">
                                                        {bedStatusesByRoom[roomSummary.id].map((bed: BedStatus) => {
                                                            const blockingReservation = bed.status === 'blocked' && bed.blockedByReservationId ? blockingReservationsMap.get(bed.blockedByReservationId) : undefined;
                                                            return (
                                                                <li key={bed.id} className="flex items-start justify-between border-b border-gray-200/60 py-1.5 text-sm gap-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <Bed className={`w-4 h-4 flex-shrink-0 mt-0.5 ${bed.status === 'free' ? 'text-green-500' : bed.status === 'blocked' ? 'text-orange-500' : 'text-blue-500'}`} />
                                                                        <span className="font-medium text-gray-700">{bed.name}</span>
                                                                    </div>
                                                                    <div className="text-right flex-shrink-0 max-w-[60%]">
                                                                        {bed.status === 'free' && (
                                                                            <span className="text-green-600 font-medium">Libero</span>
                                                                        )}
                                                                        {bed.status === 'blocked' && (
                                                                            <div className="text-right">
                                                                                <span className="text-orange-600 font-medium flex items-center justify-end gap-1">
                                                                                    <Ban className="w-3.5 h-3.5"/> Bloccato
                                                                                </span>
                                                                                {blockingReservation && (
                                                                                    <span className="text-xs text-gray-500 block truncate" title={`Da: #${blockingReservation.id} ${blockingReservation.name || ''} ${blockingReservation.surname || ''}`}>
                                                                                        (Da: <Link href={`/admin_power/prenotazioni?search=${blockingReservation.id}`} target="_blank" className="hover:underline">#{blockingReservation.id}</Link>)
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                        {bed.status === 'booked' && bed.bookedBy && (
                                                                            <div className="text-right">
                                                                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                                                    <span className="font-medium text-blue-700 flex items-center gap-1">
                                                                                        <UserCheck className="w-3.5 h-3.5"/>
                                                                                        <Link href={`/admin_power/prenotazioni?search=${bed.bookedBy.reservationId}`} target="_blank" className="hover:underline">
                                                                                            #{bed.bookedBy.reservationId}
                                                                                        </Link> 
                                                                                    </span>
                                                                                    <span className="text-sm text-gray-800 truncate" title={`${bed.bookedBy.name || ''} ${bed.bookedBy.surname || ''}`}>
                                                                                        {bed.bookedBy.name} {bed.bookedBy.surname || ''}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="text-xs text-gray-500 block mt-0.5">
                                                                                    <span>({bed.bookedBy.guestType || 'N/A'})</span>
                                                                                    {bed.bookedBy.phone && (
                                                                                        <span className="ml-2" title={bed.bookedBy.phone}>
                                                                                             📞 {bed.bookedBy.phone}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* <DialogClose asChild>
                                    <Button type="button" variant="secondary" className="mt-4">
                                        Chiudi
                                    </Button>
                                </DialogClose> */}
                            </DialogContent>
                        </Dialog>
                        {/* --- End Dialog --- */}
                      </div>
                      <div className="overflow-x-auto border rounded-md mt-2"> 
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 tracking-wider">Stanza</th>
                              <th scope="col" className="px-3 py-2 text-center font-medium text-gray-500 tracking-wider">Prenotati</th>
                              <th scope="col" className="px-3 py-2 text-center font-medium text-gray-500 tracking-wider">Bloccati</th>
                              <th scope="col" className="px-3 py-2 text-left font-medium text-gray-500 tracking-wider">Dettaglio (A/B/N)</th>
                              <th scope="col" className="px-3 py-2 text-center font-medium text-gray-500 tracking-wider">Max</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                            {roomOccupancySummary.map((room) => {
                              const isOverbooked = room.totalBooked + room.blockedCount > room.bedCount;
                              return (
                                <tr key={room.id}>
                                  <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">{room.description}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-center text-gray-700">{room.totalBooked}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-center text-orange-600 font-medium">{room.blockedCount > 0 ? room.blockedCount : '-'}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                                    {`A:${room.booked.adults}, B:${room.booked.children}, N:${room.booked.infants}`}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-center text-gray-700 flex items-center justify-center gap-1.5">
                                    {isOverbooked ? (
                                      <span className="text-red-500 font-bold">✗</span>
                                    ) : (
                                      <span className="text-green-500 font-bold">✓</span>
                                    )}
                                    <span>{room.bedCount}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                )}
                
                {/* Reservation Details List */}
                {renderContent()} 
              </>
          )}
        </div>

      </SheetContent>
    </Sheet>
  );
};

export default DaySheet;