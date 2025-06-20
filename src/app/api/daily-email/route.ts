import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from '@react-pdf/renderer';
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import React from 'react';
import QRCode from 'qrcode';
import { SupabaseClient } from '@supabase/supabase-js';

// --- Type Definitions (copied from calendario_giorno_dettagli API) ---
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
  extraServices?: { description: string; quantity: number }[];
}

interface RoomReservation {
  id: number;
  RoomReservationSpec: RoomReservationSpec[] | null;
}

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
  external_id: string | null;
  RoomReservation: RoomReservation[] | null;
  guestBreakdown: {
    adults: number;
    children: number;
    infants: number;
  };
}

interface BedStatus {
  id: number;
  name: string;
  roomId: number;
  status: 'free' | 'blocked' | 'booked';
  bookedBy?: {
    reservationId: number;
    name: string | null;
    surname: string | null;
    guestType: string | null;
    phone: string | null;
  };
  blockedByReservationId?: number;
}

interface DayDetailsResponse {
  detailedReservations: DetailedReservation[];
  blockedBedsByRoom: { [roomId: number]: number };
  availableBeds: number | null;
  totalBlockedBeds: number | null;
  blockedBedDetails: { bedId: number; roomReservationId: number }[];
  roomBedDetails: { id: number; name: string; roomId: number }[];
}
// --- End Type Definitions ---

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY || process.env.RESEND);

// PDF Styles for @react-pdf/renderer
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 20,
    fontSize: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 10,
  },
  subtitle: {
    fontSize: 12,
    color: '#666666',
  },
  noData: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666666',
    marginTop: 50,
  },
  reservationItem: {
    marginBottom: 5,
    padding: 8,
    border: '1px solid #cccccc',
    flexDirection: 'column',
  },
  reservationHeader: {
    fontSize: 10,
    fontWeight: 'normal',
    marginBottom: 3,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  detailLeft: {
    fontSize: 9,
    width: '50%',
  },
  detailRight: {
    fontSize: 9,
    width: '50%',
  },
  detail: {
    fontSize: 9,
    marginBottom: 1,
  },
  compactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  compactItem: {
    fontSize: 9,
    flex: 1,
  },
  // Bed details styles
  compactHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 15,
    padding: 6,
    backgroundColor: '#f5f5f5',
  },
  compactHeaderText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  tableContainer: {
    marginTop: 20,
  },
  table: {
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableColHeader: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    backgroundColor: '#f2f2f2',
    padding: 4,
  },
  tableCol: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 4,
  },
  roomCol: {
    width: '25%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 4,
    backgroundColor: '#fafafa',
  },
  bedCol: {
    width: '35%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 4,
  },
  statusCol: {
    width: '40%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 4,
  },
  tableCellHeader: {
    margin: 'auto',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tableCell: {
    margin: 'auto',
    fontSize: 9,
  },
  roomInfo: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  roomDetails: {
    fontSize: 8,
    color: '#666666',
  },
  bedItem: {
    fontSize: 9,
    fontWeight: 'normal',
  },
  prenText: {
    fontSize: 8,
    color: '#0066cc',
    fontWeight: 'bold',
  },
  bloccatoText: {
    fontSize: 8,
    color: '#ff8800',
    fontWeight: 'bold',
  },
  statusDetail: {
    fontSize: 7,
    color: '#333333',
  },
  freeText: {
    fontSize: 8,
    color: '#008000',
    fontWeight: 'bold',
  },
});

// --- UTILITY FUNCTIONS ---

// Helper functions for date and price formatting
const monthsShort = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic"
];

const formatDateForPdf = (date: Date | string | undefined | null) => {
  if (!date) return "N/A";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Invalid Date";
  return `${d.getDate()} ${monthsShort[d.getMonth()]} ${d.getFullYear()}`;
};

const formatPriceForPdf = (price: number | undefined | null) => {
  if (price === undefined || price === null) return "N/A";
  return `${price.toFixed(2)} €`;
};

// Function to fetch day details (stessa logica di calendario_giorno_dettagli API)
async function fetchDayDetails(supabase: SupabaseClient, dateString: string): Promise<DayDetailsResponse | null> {
  try {
    // Query con la stessa logica dell'API dettagli
    const { data: baskets, error } = await supabase
      .from('Basket')
      .select(`
        id, name, surname, dayFrom, dayTo, mail, phone, city, region, reservationType, totalPrice, isPaid, note, isCreatedByAdmin, stripeId, paymentIntentId, external_id,
        RoomReservation (
          id,
          RoomReservationSpec (
            id,
            GuestDivision ( id, title, description ),
            RoomLinkBed (
              id, name,
              Room ( id, description, RoomLinkBed(count) )
            )
          )
        )
      `)
      .lte('dayFrom', dateString)
      .gt('dayTo', dateString)
      .or('and(isPaid.eq.true,isCancelled.eq.false),and(isCreatedByAdmin.eq.true,isCancelled.eq.false)');

    if (error) {
      console.error("Supabase query error:", error);
      return null;
    }

    if (!baskets) {
      return {
        detailedReservations: [],
        blockedBedsByRoom: {},
        availableBeds: null,
        totalBlockedBeds: null,
        blockedBedDetails: [],
        roomBedDetails: []
      };
    }

    // --- FETCH EXTRA SERVICES (ReservationLinkService + Service) ---
    // 1. RoomReservationId validi
    type BasketDB = Omit<DetailedReservation, 'RoomReservation' | 'guestBreakdown'> & {
      RoomReservation: (Omit<RoomReservation, 'RoomReservationSpec'> & {
        RoomReservationSpec: (Omit<RoomReservationSpec, 'extraServices'> & {
          GuestDivision: GuestDivision | null;
          RoomLinkBed: RoomLinkBed | null;
        })[] | null;
      })[] | null;
    };
    const validRoomReservationIds = (baskets as BasketDB[]).flatMap((basket) =>
      basket.RoomReservation?.map((rr) => rr.id) || []
    ).filter((id): id is number => typeof id === 'number');

    const extraServicesByRoomReservation: { [roomReservationId: number]: { description: string; quantity: number }[] } = {};
    if (validRoomReservationIds.length > 0) {
      const { data: services, error: servicesError } = await supabase
        .from('ReservationLinkService')
        .select('roomReservationId, quantity, Service (description)')
        .in('roomReservationId', validRoomReservationIds);
      if (servicesError) {
        console.error('Supabase query error (ReservationLinkService):', servicesError);
      } else if (services) {
        type ReservationLinkServiceRow = {
          roomReservationId: number;
          quantity: number;
          Service: { description: string } | null;
        };
        for (const s of (services as unknown as ReservationLinkServiceRow[])) {
          if (!s.roomReservationId || !s.Service) continue;
          if (!extraServicesByRoomReservation[s.roomReservationId]) {
            extraServicesByRoomReservation[s.roomReservationId] = [];
          }
          extraServicesByRoomReservation[s.roomReservationId].push({
            description: s.Service.description,
            quantity: s.quantity
          });
        }
      }
    }

    // Process data (come nell'API dettagli)
    const detailedReservations: DetailedReservation[] = (baskets as BasketDB[]).map((basket) => {
      let adults = 0;
      let children = 0;
      let infants = 0;
      const roomReservations: RoomReservation[] = basket.RoomReservation?.map((rr) => {
        const specs: RoomReservationSpec[] = rr.RoomReservationSpec?.map((spec) => {
          const divisionTitle = spec.GuestDivision?.title?.toLowerCase() || '';
          if (divisionTitle.includes('adult')) {
            adults++;
          } else if (divisionTitle.includes('bambin')) {
            children++;
          } else if (divisionTitle.includes('neonat')) {
            infants++;
          }
          return {
            ...spec,
            extraServices: extraServicesByRoomReservation[rr.id] || []
          };
        }) || [];
        return {
          ...rr,
          RoomReservationSpec: specs
        };
      }) || [];
      return {
        ...basket,
        RoomReservation: roomReservations,
        guestBreakdown: { adults, children, infants }
      };
    });

    // --- Calcolo letti bloccati (come in calendario_giorno_dettagli) ---
    let blockedBedsByRoom: { [roomId: number]: number } = {};
    let totalBlockedBeds = 0;
    let allBlockedLinkIds: number[] = [];
    let blockedBedDetails: { bedId: number; roomReservationId: number }[] = [];

    if (validRoomReservationIds.length > 0) {
      const { data: bedBlocks, error: blockError } = await supabase
        .from('ReservationLinkBedBlock')
        .select('roomLinkBedId, roomReservationId')
        .eq('day', dateString)
        .in('roomReservationId', validRoomReservationIds);

      if (blockError) {
        console.error("Supabase query error (ReservationLinkBedBlock):", blockError);
      } else if (bedBlocks && bedBlocks.length > 0) {
        const tempBlockedLinkIds: number[] = [];
        const tempBlockedDetails: { bedId: number; roomReservationId: number }[] = [];
        for (const block of bedBlocks as { roomLinkBedId: number[]; roomReservationId: number }[]) {
          if (block.roomLinkBedId && block.roomReservationId) {
            block.roomLinkBedId.forEach((id) => {
              if (typeof id === 'number' && !isNaN(id)) {
                tempBlockedLinkIds.push(id);
                tempBlockedDetails.push({ bedId: id, roomReservationId: block.roomReservationId });
              }
            });
          }
        }
        allBlockedLinkIds = tempBlockedLinkIds;
        blockedBedDetails = tempBlockedDetails;
        if (allBlockedLinkIds.length > 0) {
          const { data: roomLinks, error: linkError } = await supabase
            .from('RoomLinkBed')
            .select('id, roomId')
            .in('id', allBlockedLinkIds);
          if (linkError) {
            console.error("Supabase query error (RoomLinkBed):", linkError);
          } else if (roomLinks) {
            blockedBedsByRoom = (roomLinks as { id: number; roomId: number }[]).reduce((acc, link) => {
              if (link.roomId) {
                acc[link.roomId] = (acc[link.roomId] || 0) + 1;
              }
              return acc;
            }, {} as { [roomId: number]: number });
            totalBlockedBeds = roomLinks.length;
          }
        }
      }
    }
    // --- Fine calcolo letti bloccati ---

    // Get all bed details
    const { data: allBeds } = await supabase
      .from('RoomLinkBed')
      .select('id, name, roomId');
    const roomBedDetails = allBeds || [];

    // Calcolo availableBeds (come prima)
    const { data: roomsData } = await supabase
      .from('Room')
      .select('id, RoomLinkBed(count)');
    let totalCapacity = 0;
    if (roomsData) {
      totalCapacity = (roomsData as { RoomLinkBed: { count: number }[] }[]).reduce((sum: number, room) => {
        const count = Array.isArray(room.RoomLinkBed) && room.RoomLinkBed[0]?.count ? room.RoomLinkBed[0].count : 0;
        return sum + count;
      }, 0);
    }
    const totalBookedBeds = detailedReservations.reduce((sum: number, res: DetailedReservation) => {
      return sum + res.guestBreakdown.adults + res.guestBreakdown.children + res.guestBreakdown.infants;
    }, 0);
    const availableBeds = Math.max(0, totalCapacity - totalBookedBeds - totalBlockedBeds);

    return {
      detailedReservations,
      blockedBedsByRoom,
      availableBeds,
      totalBlockedBeds,
      blockedBedDetails,
      roomBedDetails
    };
  } catch (error) {
    console.error("Error fetching day details:", error);
    return null;
  }
}

// --- LOGICA UNIFICATA: Calcolo roomOccupancySummary e bedStatusesByRoom ---
function calculateRoomOccupancySummaryAndBedStatuses(dayDetails: DayDetailsResponse) {
  const { detailedReservations, blockedBedsByRoom, blockedBedDetails, roomBedDetails } = dayDetails;

  // 1. Room Occupancy Summary
  const occupancy = {} as {
    [roomId: number]: {
      id: number;
      description: string;
      bedCount: number;
      booked: { adults: number; children: number; infants: number };
      totalBooked: number;
      blockedCount: number;
    };
  };

  detailedReservations.forEach((reservation: DetailedReservation) => {
    reservation.RoomReservation?.forEach((rr: RoomReservation) => {
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
              blockedCount: blockedBedsByRoom[room.id] || 0,
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
  const roomOccupancySummary = Object.values(occupancy).sort((a, b) => a.id - b.id);

  // 2. Bed Statuses By Room
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
  // 3. Mark booked beds
  detailedReservations.forEach((res: DetailedReservation) => {
    res.RoomReservation?.forEach((rr: RoomReservation) => {
      rr.RoomReservationSpec?.forEach((spec: RoomReservationSpec) => {
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
    statuses[roomId].sort((a, b) => a.id - b.id);
  }
  return { roomOccupancySummary, bedStatusesByRoom: statuses };
}

// Function to generate PDFs using PDFKit
async function generatePDFs(date: Date, dayDetails: DayDetailsResponse, roomOccupancySummary: ReturnType<typeof calculateRoomOccupancySummaryAndBedStatuses>["roomOccupancySummary"], bedStatusesByRoom: { [roomId: number]: BedStatus[] }, totalGuests: number): Promise<{
  reservationListPdf: Buffer;
  bedDetailsPdf: Buffer;
} | null> {
  try {
    console.log('[daily-email] Generating PDFs with PDFKit...');
    
    // Generate both PDFs
    console.log('[daily-email] Generating reservation list PDF...');
    const reservationListPdf = await generateReservationListPdf(date, dayDetails.detailedReservations);
    console.log('[daily-email] Reservation PDF generated, size:', reservationListPdf.length);
    
    console.log('[daily-email] Generating bed details PDF...');
    const bedDetailsPdf = await generateBedDetailsPdf(date, dayDetails, roomOccupancySummary, bedStatusesByRoom, totalGuests);
    console.log('[daily-email] Bed details PDF generated, size:', bedDetailsPdf.length);
    
    // Validate PDFs before returning
    if (!reservationListPdf || reservationListPdf.length === 0) {
      throw new Error('Reservation PDF is empty or null');
    }
    
    if (!bedDetailsPdf || bedDetailsPdf.length === 0) {
      throw new Error('Bed details PDF is empty or null');
    }
    
    // Check PDF headers
    const reservationHeader = reservationListPdf.subarray(0, 4);
    const bedDetailsHeader = bedDetailsPdf.subarray(0, 4);
    
    if (!Buffer.from('%PDF').equals(reservationHeader)) {
      throw new Error('Invalid reservation PDF header');
    }
    
    if (!Buffer.from('%PDF').equals(bedDetailsHeader)) {
      throw new Error('Invalid bed details PDF header');
    }
    
    console.log('[daily-email] PDF validation passed');
    
    return {
      reservationListPdf,
      bedDetailsPdf
    };
  } catch (error) {
    console.error('[daily-email] Error generating PDFs:', error);
    return null;
  }
}

// Generate Reservation List PDF using @react-pdf/renderer
async function generateReservationListPdf(date: Date, detailedReservations: DetailedReservation[]): Promise<Buffer> {
  try {
    console.log('[daily-email] Creating reservation PDF with @react-pdf/renderer...');
    const formattedDate = formatDateForPdf(date);

    // Helper to generate QR code as data URL (base64)
    async function getQrDataUrl(external_id: string | null): Promise<string | null> {
      if (!external_id) return null;
      const url = `https://rifugiodibona.app/cart/${external_id}`;
      try {
        return await QRCode.toDataURL(url, { errorCorrectionLevel: 'L', width: 32 });
      } catch (err) {
        console.error('QR Code generation failed', err);
        return null;
      }
    }

    // Pre-generate all QR codes (parallel)
    const qrCodes: (string | null)[] = await Promise.all(
      detailedReservations.map(res => getQrDataUrl(res.external_id || null))
    );

    // Create PDF document
    const ReservationListDocument = React.createElement(Document, {},
      React.createElement(Page, { size: 'A4', style: styles.page },
        // Header
        React.createElement(View, { style: styles.header },
          React.createElement(Text, { style: styles.title }, 'Elenco Prenotazioni'),
          React.createElement(Text, { style: styles.subtitle }, formattedDate)
        ),
        // Content
        detailedReservations.length === 0
          ? React.createElement(Text, { style: styles.noData }, 'Nessuna prenotazione trovata per questa data.')
          : React.createElement(View, {},
              ...detailedReservations.map((reservation, index) => {
                const totalGuests = reservation.guestBreakdown.adults + reservation.guestBreakdown.children + reservation.guestBreakdown.infants;
                const guestBreakdown = `A:${reservation.guestBreakdown.adults}, B:${reservation.guestBreakdown.children}, N:${reservation.guestBreakdown.infants}`;
                const paymentStatus = reservation.isCreatedByAdmin ? 'admin' : reservation.isPaid ? 'paid' : 'notpaid';
                const reservationType = reservation.reservationType === 'hb' ? 'Mezza Pensione' : reservation.reservationType === 'bb' ? 'Bed & Breakfast' : reservation.reservationType || 'N/A';
                const qrDataUrl = qrCodes[index];

                // Color for payment status
                let statusColor = '#ff0000'; // not paid
                if (paymentStatus === 'paid') statusColor = '#008000';
                if (paymentStatus === 'admin') statusColor = '#800080';

                return React.createElement(View, {
                  key: reservation.id,
                  style: {
                    border: '1px solid #cccccc',
                    borderRadius: 2,
                    marginBottom: 3,
                    padding: 3,
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    backgroundColor: '#f9f9f9',
                  }
                },
                  // QR code (left)
                  React.createElement(View, { style: { width: 35, height: 35, marginRight: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: 2 } },
                    qrDataUrl
                      ? React.createElement(Image, { src: qrDataUrl, style: { width: 32, height: 32 } })
                      : React.createElement(Text, { style: { fontSize: 7, color: '#888', textAlign: 'center' } }, 'N/A')
                  ),
                  // Details (right)
                  React.createElement(View, { style: { flex: 1, flexDirection: 'column' } },
                    React.createElement(Text, { style: { fontSize: 10, fontWeight: 'bold', marginBottom: 0 } }, `Pren. #${reservation.id} - ${reservation.name || 'N/A'} ${reservation.surname || ''}`),
                    // Grid of details
                    React.createElement(View, { style: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 0, marginTop: 0 } },
                      React.createElement(View, { style: { width: '50%', marginBottom: 0, marginTop: 0 } },
                        React.createElement(Text, {}, `Check-in: ${formatDateForPdf(reservation.dayFrom)}`)
                      ),
                      React.createElement(View, { style: { width: '50%', marginBottom: 0, marginTop: 0 } },
                        React.createElement(Text, {}, `Check-out: ${formatDateForPdf(reservation.dayTo)}`)
                      ),
                      React.createElement(View, { style: { width: '50%', marginBottom: 0, marginTop: 0 } },
                        React.createElement(Text, {}, `Ospiti: ${totalGuests} (${guestBreakdown})`)
                      ),
                      React.createElement(View, { style: { width: '50%', marginBottom: 0, marginTop: 0 } },
                        React.createElement(Text, {}, `Tipo: ${reservationType}`)
                      ),
                      React.createElement(View, { style: { width: '50%', marginBottom: 0, marginTop: 0 } },
                        React.createElement(Text, {}, `Prezzo: ${formatPriceForPdf(reservation.totalPrice)}`)
                      ),
                      React.createElement(View, { style: { width: '50%', marginBottom: 0, marginTop: 0, flexDirection: 'row', alignItems: 'center' } },
                        React.createElement(Text, { style: { color: statusColor, fontWeight: 'bold' } },
                          paymentStatus === 'admin' ? 'Admin' : paymentStatus === 'paid' ? 'Pagata' : 'Non Pagata'
                        )
                      ),
                      React.createElement(View, { style: { width: '50%', marginBottom: 0, marginTop: 0 } },
                        React.createElement(Text, {}, `Email: ${reservation.mail || 'N/A'}`)
                      ),
                      React.createElement(View, { style: { width: '50%', marginBottom: 0, marginTop: 0 } },
                        React.createElement(Text, {}, `Tel: ${reservation.phone || 'N/A'}`)
                      )
                    ),
                    // Note box
                    reservation.note ? React.createElement(View, { style: { marginTop: 1, padding: 2, backgroundColor: '#fff', borderRadius: 2, border: '1px dotted #000' } },
                      React.createElement(Text, { style: { fontSize: 7, color: '#000' } }, `Note: ${reservation.note}`)
                    ) : null,
                    // Extra services box (sotto le note, stile piccolo)
                    (() => {
                      const extraServices: { description: string; quantity: number }[] = [];
                      if (reservation.RoomReservation) {
                        for (const rr of reservation.RoomReservation) {
                          if (rr.RoomReservationSpec) {
                            for (const spec of rr.RoomReservationSpec) {
                              if (spec.extraServices && spec.extraServices.length > 0) {
                                extraServices.push(...spec.extraServices);
                              }
                            }
                          }
                        }
                      }
                      // Mostra ogni servizio una sola volta per descrizione (come arriva dal db)
                      const seen = new Set<string>();
                      const uniqueExtras = extraServices.filter(es => {
                        if (seen.has(es.description)) return false;
                        seen.add(es.description);
                        return true;
                      });
                      const extraString = uniqueExtras.map(es => `${es.description} x${es.quantity}`).join(', ');
                      if (extraString) {
                        return React.createElement(View, { style: { marginTop: 1, padding: 2, backgroundColor: '#fff', borderRadius: 2, border: '1px dotted #888' } },
                          React.createElement(Text, { style: { fontSize: 7, color: '#444' } }, `Extra: ${extraString}`)
                        );
                      }
                      return null;
                    })()
                  )
                );
              })
            )
      )
    );
    const pdfBuffer = await renderToBuffer(ReservationListDocument);
    console.log('[daily-email] Reservation PDF generated, size:', pdfBuffer.length);
    return pdfBuffer;
  } catch (error) {
    console.error('[daily-email] Error in generateReservationListPdf:', error);
    throw error;
  }
}

// Modifica la funzione generateBedDetailsPdf per accettare i dati reali
async function generateBedDetailsPdf(date: Date, dayDetails: DayDetailsResponse, roomOccupancySummary: ReturnType<typeof calculateRoomOccupancySummaryAndBedStatuses>["roomOccupancySummary"], bedStatusesByRoom: { [roomId: number]: BedStatus[] }, totalGuests: number): Promise<Buffer> {
  try {
    console.log('[daily-email] Creating bed details PDF with @react-pdf/renderer...');
    const formattedDate = formatDateForPdf(date);
    const totalCapacity = roomOccupancySummary.reduce((sum, room) => sum + room.bedCount, 0);
    const totalBookedBeds = roomOccupancySummary.reduce((sum, room) => sum + room.totalBooked, 0);
    const occupiedBeds = totalBookedBeds + (dayDetails.totalBlockedBeds ?? 0);
    const freeBeds = dayDetails.availableBeds ?? (totalCapacity - occupiedBeds);
    // Create PDF document
    const BedDetailsDocument = React.createElement(Document, {},
      React.createElement(Page, { size: 'A4', style: styles.page },
        // Header
        React.createElement(View, { style: styles.header },
          React.createElement(Text, { style: styles.title }, 'Dettaglio Giornaliero'),
          React.createElement(Text, { style: styles.subtitle }, formattedDate)
        ),
        // Compact Summary in header style
        React.createElement(View, { style: styles.compactHeaderRow },
          React.createElement(Text, { style: styles.compactHeaderText },
            `Tot: ${totalCapacity} | Liberi: ${freeBeds} | Occupati: ${occupiedBeds} | Ospiti: ${totalGuests}`
          )
        ),
        // Room Layout Table
        React.createElement(View, { style: styles.table },
          // Header row
          React.createElement(View, { style: styles.tableRow },
            React.createElement(View, { style: [styles.tableColHeader, { width: '25%' }] },
              React.createElement(Text, { style: styles.tableCellHeader }, 'Stanza')
            ),
            React.createElement(View, { style: [styles.tableColHeader, { width: '35%' }] },
              React.createElement(Text, { style: styles.tableCellHeader }, 'Letto')
            ),
            React.createElement(View, { style: [styles.tableColHeader, { width: '40%' }] },
              React.createElement(Text, { style: styles.tableCellHeader }, 'Stato / Dettagli')
            )
          ),
          // Generate detailed room data based on real bedStatusesByRoom
          ...roomOccupancySummary.flatMap(room => {
            const beds = bedStatusesByRoom[room.id] || [];
            if (beds.length === 0) {
              return [
                React.createElement(View, { key: `room-${room.id}-empty`, style: styles.tableRow },
                  React.createElement(View, { style: [styles.roomCol, { width: '25%' }] },
                    React.createElement(Text, { style: styles.roomInfo }, `${room.description}`),
                    React.createElement(Text, { style: styles.roomDetails }, `Max: ${room.bedCount}`)
                  ),
                  React.createElement(View, { style: [styles.bedCol, { width: '35%' }] },
                    React.createElement(Text, { style: styles.bedItem }, 'Nessun letto definito')
                  ),
                  React.createElement(View, { style: [styles.statusCol, { width: '40%' }] },
                    React.createElement(Text, { style: styles.freeText }, '-')
                  )
                )
              ];
            }
            return beds.map((bed, bedIndex) => {
              const isFirstBedOfRoom = bedIndex === 0;
              let statusNode: React.ReactElement;
              let extraServices: { description: string; quantity: number }[] = [];
              // Trova i servizi extra associati a questo letto prenotato
              if (bed.status === 'booked' && bed.bookedBy) {
                // Trova la RoomReservation corrispondente SOLO se bed.bookedBy è definito
                const reservation = dayDetails.detailedReservations.find(res => res.id === bed.bookedBy?.reservationId);
                let foundExtra: { description: string; quantity: number }[] = [];
                if (reservation && reservation.RoomReservation) {
                  for (const rr of reservation.RoomReservation) {
                    if (rr.RoomReservationSpec) {
                      for (const spec of rr.RoomReservationSpec) {
                        if (spec.RoomLinkBed && spec.RoomLinkBed.id === bed.id && spec.extraServices) {
                          foundExtra = spec.extraServices;
                          break;
                        }
                      }
                    }
                  }
                }
                extraServices = foundExtra;
              }
              if (bed.status === 'free') {
                statusNode = React.createElement(Text, { style: styles.freeText }, 'Libero');
              } else if (bed.status === 'blocked') {
                statusNode = React.createElement(View, {},
                  React.createElement(Text, { style: styles.bloccatoText }, 'Bloccato'),
                  bed.blockedByReservationId ?
                    React.createElement(Text, { style: styles.statusDetail }, ` (Da Pren. #${bed.blockedByReservationId})`) : null
                );
              } else if (bed.status === 'booked' && bed.bookedBy) {
                statusNode = React.createElement(View, {},
                  React.createElement(Text, { style: styles.prenText }, `Pren. #${bed.bookedBy.reservationId}: ${bed.bookedBy.name || ''} ${(bed.bookedBy.surname || '').substring(0, 8)}`),
                  React.createElement(Text, { style: styles.statusDetail }, `Tipo: ${bed.bookedBy.guestType || 'N/A'} Tel: ${(bed.bookedBy.phone || '').substring(0, 10)}`),
                  // Mostra extraServices se presenti
                  extraServices && extraServices.length > 0 ?
                    React.createElement(Text, { style: styles.statusDetail },
                      `Extra: ${extraServices.map(es => `${es.description} x${es.quantity}`).join(', ')}`
                    ) : null
                );
              } else {
                statusNode = React.createElement(Text, { style: styles.prenText }, 'Prenotato');
              }
              return React.createElement(View, { key: `room-${room.id}-bed-${bed.id}`, style: styles.tableRow },
                isFirstBedOfRoom ? React.createElement(View, { style: [styles.roomCol, { width: '25%' }] },
                  React.createElement(Text, { style: styles.roomInfo }, `${room.description}`),
                  React.createElement(Text, { style: styles.roomDetails }, `Pren: ${room.totalBooked} | Bloc: ${room.blockedCount} | Max: ${room.bedCount}`)
                ) : React.createElement(View, { style: [styles.roomCol, { width: '25%' }] }),
                React.createElement(View, { style: [styles.bedCol, { width: '35%' }] },
                  React.createElement(Text, { style: styles.bedItem }, bed.name)
                ),
                React.createElement(View, { style: [styles.statusCol, { width: '40%' }] }, statusNode)
              );
            });
          })
        )
      )
    );
    const pdfBuffer = await renderToBuffer(BedDetailsDocument);
    console.log('[daily-email] Bed details PDF generated, size:', pdfBuffer.length);
    return pdfBuffer;
  } catch (error) {
    console.error('[daily-email] Error in generateBedDetailsPdf:', error);
    throw error;
  }
}

// Function to generate email content
function generateDailyEmailContent(data: {
  date: Date;
  dayDetails: DayDetailsResponse;
}): { html: string; text: string } {
  const { date, dayDetails } = data;
  const dateString = date.toLocaleDateString('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const totalGuests = dayDetails.detailedReservations.reduce((sum, res) => 
    sum + res.guestBreakdown.adults + res.guestBreakdown.children + res.guestBreakdown.infants, 0
  );

  // Calculate arrivals (reservations starting today)
  const todayString = date.toISOString().split('T')[0];
  const arrivingReservations = dayDetails.detailedReservations.filter(res => 
    res.dayFrom?.split('T')[0] === todayString
  );
  const arrivingGuests = arrivingReservations.reduce((sum, res) => 
    sum + res.guestBreakdown.adults + res.guestBreakdown.children + res.guestBreakdown.infants, 0
  );

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #2c5aa0; border-bottom: 2px solid #2c5aa0; padding-bottom: 10px;">
        Report Giornaliero Rifugio Dibona
      </h1>
      
      <h2 style="color: #333;">📅 ${dateString}</h2>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #2c5aa0; margin-top: 0;">📊 Statistiche di Oggi</h3>
        <ul style="list-style-type: none; padding: 0;">
          <li style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">
            <strong>Totale prenotazioni attive:</strong> ${dayDetails.detailedReservations.length}
          </li>
          <li style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">
            <strong>Totale ospiti:</strong> ${totalGuests}
          </li>
          <li style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">
            <strong>Check-in di oggi:</strong> ${arrivingReservations.length} prenotazioni (${arrivingGuests} ospiti)
          </li>
          <li style="padding: 8px 0;">
            <strong>Letti disponibili:</strong> ${dayDetails.availableBeds || 'N/A'}
          </li>
        </ul>
      </div>

      <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 0; font-size: 14px; color: #856404;">
          📎 <strong>Allegati:</strong> In allegato trovi i PDF dettagliati con l'elenco delle prenotazioni e il dettaglio dei letti.
        </p>
      </div>

    </div>
  `;

  const text = `
REPORT GIORNALIERO RIFUGIO DIBONA
${dateString}

STATISTICHE DI OGGI:
- Totale prenotazioni attive: ${dayDetails.detailedReservations.length}
- Totale ospiti: ${totalGuests}
- Check-in di oggi: ${arrivingReservations.length} prenotazioni (${arrivingGuests} ospiti)
- Letti disponibili: ${dayDetails.availableBeds || 'N/A'}

ALLEGATI:
- Elenco_Prenotazioni_${date.toISOString().split('T')[0]}.pdf
- Dettaglio_Letti_${date.toISOString().split('T')[0]}.pdf

---
Questo è un report automatico generato alle ore 05:00 CET
Rifugio Dibona - Sistema di Gestione Prenotazioni
  `;

  return { html, text };
}

export async function GET(request: NextRequest) {
  try {
    // Verifica che la richiesta provenga da Vercel Cron (skip in sviluppo)
    const isDevelopment = process.env.NODE_ENV === 'development';
    const authHeader = request.headers.get('authorization');
    
    if (!isDevelopment && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('[daily-email] Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (isDevelopment) {
      console.log('[daily-email] Running in development mode - skipping auth check');
    }

    console.log('[daily-email] Starting daily email job at:', new Date().toISOString());

    // Usa la data corrente invece di una data fissa
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    console.log('[daily-email] Using current date:', todayString);

    // Initialize Supabase client
    const supabase = createRouteHandlerClient({ cookies });

    // Fetch detailed day data using the same logic as the API
    console.log('[daily-email] Fetching day details for:', todayString);
    const dayDetails = await fetchDayDetails(supabase, todayString);
    
    if (!dayDetails) {
      console.error('[daily-email] Failed to fetch day details');
      return NextResponse.json({ error: 'Failed to fetch day details' }, { status: 500 });
    }

    console.log('[daily-email] Day details fetched:');
    console.log('[daily-email] - Reservations found:', dayDetails.detailedReservations.length);
    console.log('[daily-email] - Available beds:', dayDetails.availableBeds);
    console.log('[daily-email] - Total blocked beds:', dayDetails.totalBlockedBeds);

    // --- Calcolo roomOccupancySummary e bedStatusesByRoom come nel client ---
    const { roomOccupancySummary, bedStatusesByRoom } = calculateRoomOccupancySummaryAndBedStatuses(dayDetails);
    const totalGuests = dayDetails.detailedReservations.reduce((sum, res) => sum + res.guestBreakdown.adults + res.guestBreakdown.children + res.guestBreakdown.infants, 0);

    console.log('[daily-email] Generating PDFs...');
    console.log('[daily-email] Will generate PDFs even if no reservations (this is intended)');
    
    // Generate PDFs
    const pdfBuffers = await generatePDFs(today, dayDetails, roomOccupancySummary, bedStatusesByRoom, totalGuests);
    
    if (!pdfBuffers) {
      console.error('[daily-email] Failed to generate PDFs');
      return NextResponse.json({ error: 'Failed to generate PDFs' }, { status: 500 });
    }

    // Verify PDFs are not empty and contain PDF headers
    if (pdfBuffers.reservationListPdf.length === 0 || pdfBuffers.bedDetailsPdf.length === 0) {
      console.error('[daily-email] One or both PDFs are empty');
      console.error('[daily-email] Reservation PDF size:', pdfBuffers.reservationListPdf.length);
      console.error('[daily-email] Bed details PDF size:', pdfBuffers.bedDetailsPdf.length);
      return NextResponse.json({ error: 'Generated PDFs are empty' }, { status: 500 });
    }

    // Verify PDFs start with valid PDF header (check byte values directly)
    const reservationFirstBytes = [
      pdfBuffers.reservationListPdf[0],
      pdfBuffers.reservationListPdf[1], 
      pdfBuffers.reservationListPdf[2],
      pdfBuffers.reservationListPdf[3]
    ];
    const bedDetailsFirstBytes = [
      pdfBuffers.bedDetailsPdf[0],
      pdfBuffers.bedDetailsPdf[1],
      pdfBuffers.bedDetailsPdf[2], 
      pdfBuffers.bedDetailsPdf[3]
    ];
    
    console.log('[daily-email] PDF headers check (byte values):');
    console.log('[daily-email] Reservation PDF first bytes:', reservationFirstBytes);
    console.log('[daily-email] Bed details PDF first bytes:', bedDetailsFirstBytes);
    
    // Check if first 4 bytes are %PDF (37, 80, 68, 70)
    const isPdfHeaderReservation = reservationFirstBytes[0] === 37 && reservationFirstBytes[1] === 80 && 
                                   reservationFirstBytes[2] === 68 && reservationFirstBytes[3] === 70;
    const isPdfHeaderBedDetails = bedDetailsFirstBytes[0] === 37 && bedDetailsFirstBytes[1] === 80 && 
                                  bedDetailsFirstBytes[2] === 68 && bedDetailsFirstBytes[3] === 70;
    
    if (!isPdfHeaderReservation || !isPdfHeaderBedDetails) {
      console.error('[daily-email] PDFs do not have valid headers');
      console.error('[daily-email] Expected [37,80,68,70] (%PDF)');
      console.error('[daily-email] Got reservation:', reservationFirstBytes);
      console.error('[daily-email] Got bed details:', bedDetailsFirstBytes);
      return NextResponse.json({ error: 'Generated PDFs are not valid' }, { status: 500 });
    }
    
    console.log('[daily-email] ✅ PDF headers are valid');

    // Save PDFs temporarily for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
      try {
        const tempDir = '/tmp';
        const reservationPath = path.join(tempDir, `debug_reservation_${todayString}.pdf`);
        const bedDetailsPath = path.join(tempDir, `debug_bed_details_${todayString}.pdf`);
        
        fs.writeFileSync(reservationPath, pdfBuffers.reservationListPdf);
        fs.writeFileSync(bedDetailsPath, pdfBuffers.bedDetailsPdf);
        
        console.log('[daily-email] 🔍 Debug PDFs saved to:');
        console.log('[daily-email] - Reservation:', reservationPath);
        console.log('[daily-email] - Bed details:', bedDetailsPath);
        console.log('[daily-email] Please test these files manually to verify they open correctly');
      } catch (debugError) {
        console.warn('[daily-email] Could not save debug PDFs:', debugError);
      }
    }

    console.log('[daily-email] PDFs generated successfully');
    console.log('[daily-email] Reservation PDF size:', pdfBuffers.reservationListPdf.length);
    console.log('[daily-email] Bed details PDF size:', pdfBuffers.bedDetailsPdf.length);
    
    // Check base64 conversion
    const base64ReservationPdf = pdfBuffers.reservationListPdf.toString('base64');
    const base64BedDetailsPdf = pdfBuffers.bedDetailsPdf.toString('base64');
    console.log('[daily-email] Base64 reservation PDF length:', base64ReservationPdf.length);
    console.log('[daily-email] Base64 bed details PDF length:', base64BedDetailsPdf.length);
    console.log('[daily-email] Base64 reservation PDF starts with:', base64ReservationPdf.substring(0, 50));
    console.log('[daily-email] Base64 bed details PDF starts with:', base64BedDetailsPdf.substring(0, 50));
    
    // Verify base64 strings are valid
    if (!base64ReservationPdf || !base64BedDetailsPdf) {
      console.error('[daily-email] Base64 conversion failed');
      return NextResponse.json({ error: 'Base64 conversion failed' }, { status: 500 });
    }

    // Prepare the email content with statistics
    const emailContent = generateDailyEmailContent({
      date: today,
      dayDetails,
    });

    // Recipients of the daily report
    const recipients = ['rifugiodibona@gmail.com', 'paolo@larin.it'];
    //const recipients = [ 'paolo@larin.it'];
    
    console.log('[daily-email] Sending emails with PDF attachments using Resend directly...');
    console.log('[daily-email] Email payload attachments:', {
      count: 2,
      files: [`Elenco_Prenotazioni_${todayString}.pdf`, `Dettaglio_Letti_${todayString}.pdf`]
    });
    
    // Validate base64 strings one more time before sending
    try {
      // Try to decode base64 to verify it's valid
      Buffer.from(base64ReservationPdf, 'base64');
      Buffer.from(base64BedDetailsPdf, 'base64');
      console.log('[daily-email] Base64 strings are valid');
    } catch (decodeError) {
      console.error('[daily-email] Base64 decode validation failed:', decodeError);
      return NextResponse.json({ error: 'Invalid base64 PDF data' }, { status: 500 });
    }
    
    // Send email to all recipients with PDF attachments using Resend directly
    const emailPromises = recipients.map(async (recipient) => {
      try {
        const response = await resend.emails.send({
          from: 'Rifugio Di Bona <noreply@rifugiodibona.app>',
          to: [recipient],
          subject: `Report Giornaliero Rifugio Dibona - ${todayString}`,
          html: emailContent.html,
          text: emailContent.text,
          attachments: [
            {
              filename: `Elenco_Prenotazioni_${todayString}.pdf`,
              content: base64ReservationPdf,
              contentType: 'application/pdf'
            },
            {
              filename: `Dettaglio_Letti_${todayString}.pdf`,
              content: base64BedDetailsPdf,
              contentType: 'application/pdf'
            }
          ]
        });

        if (response.error) {
          console.error(`[daily-email] Resend error for ${recipient}:`, response.error);
          return { recipient, success: false, error: response.error };
        }

        console.log(`[daily-email] Email sent successfully to ${recipient}:`, response.data);
        return { recipient, success: true, result: response.data };

      } catch (error) {
        console.error(`[daily-email] Exception sending to ${recipient}:`, error);
        return { recipient, success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    const emailResults = await Promise.all(emailPromises);

    // Check for email sending errors
    const failedEmails = emailResults.filter(result => !result.success);
    const successfulEmails = emailResults.filter(result => result.success);

    // If no emails were sent successfully, return error
    if (successfulEmails.length === 0) {
      return NextResponse.json({ 
        error: 'Failed to send daily email to all recipients',
        details: failedEmails
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Daily email sent successfully with PDF attachments',
      timestamp: new Date().toISOString(),
      reservationsCount: dayDetails.detailedReservations.length,
      emailsSent: successfulEmails.length,
      emailsFailed: failedEmails.length,
      recipients: recipients,
      pdfGenerated: true
    });

  } catch (error) {
    console.error('[daily-email] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 