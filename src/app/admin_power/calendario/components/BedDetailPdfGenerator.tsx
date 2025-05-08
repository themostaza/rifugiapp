'use client'

import React from 'react';
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

// --- Type Definitions (Copied from daySheet.tsx for self-containment) ---

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

interface RoomOccupancySummaryItem {
  id: number;
  description: string;
  bedCount: number;
  booked: { adults: number; children: number; infants: number };
  totalBooked: number;
  blockedCount: number;
}

// --- Component Props ---

interface BedDetailPdfGeneratorProps {
  date: Date;
  roomOccupancySummary: RoomOccupancySummaryItem[];
  bedStatusesByRoom: { [roomId: number]: BedStatus[] };
  detailedReservations: DetailedReservation[];
  disabled?: boolean; // Optional prop to disable the button
  availableBeds: number | null;
  totalBlockedBeds: number | null;
  totalGuests: number;
}

// --- Helper Functions ---

const monthsShort = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic"
];

const formatDateForPdf = (date: Date | string) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Invalid Date";
  return `${d.getDate()} ${monthsShort[d.getMonth()]} ${d.getFullYear()}`;
};

// --- Main Component ---

const BedDetailPdfGenerator: React.FC<BedDetailPdfGeneratorProps> = ({
  date,
  roomOccupancySummary,
  bedStatusesByRoom,
  detailedReservations,
  disabled = false,
  availableBeds,
  totalBlockedBeds,
  totalGuests,
}) => {

  const generatePdfContent = (): string => {
    // Calculate totals needed for the title
    const totalCapacity = roomOccupancySummary.reduce((sum, room) => sum + room.bedCount, 0);
    const totalBookedBeds = roomOccupancySummary.reduce((sum, room) => sum + room.totalBooked, 0);
    const occupiedBeds = totalBookedBeds + (totalBlockedBeds ?? 0);
    const freeBeds = availableBeds ?? (totalCapacity - occupiedBeds); // Use passed availableBeds or calculate

    // Construct the title string
    const titleString = [
      `${formatDateForPdf(date)}`,
      `Tot: ${totalCapacity}`,
      `Liberi: ${availableBeds !== null ? availableBeds : freeBeds}`, // Prefer passed value
      `Occupati: ${occupiedBeds}`,
      `Ospiti: ${totalGuests}`
    ].join(' | ');

    let htmlContent = `
      <html>
        <head>
          <title>${titleString}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 10px; font-size: 9px; line-height: 1.1; } /* Base styles */
            h1 { font-size: 16px; text-align: center; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; border: 1px solid #ccc; } /* Table styles */
            th, td { border: 1px solid #ddd; padding: 2px 4px; text-align: left; vertical-align: top; } /* Cell styles */
            th { background-color: #f2f2f2; font-weight: bold; font-size: 10px; } /* Header cell styles */
            td { font-size: 9px; } /* Data cell font size */
            .room-cell { font-weight: bold; background-color: #f8f8f8; font-size: 10px; } /* Room cell specific styles */
            .room-summary { display: block; font-size: 8px; font-weight: normal; color: #555; margin-top: 2px; } /* Room summary styles */
            .bed-name { font-weight: 500; }
            .bed-status-details { /* Container for status + details */ }
            .status-free { color: green; font-weight: bold; }
            .status-blocked { color: orange; font-weight: bold; display: inline; }
            .status-booked { color: blue; font-weight: bold; display: inline; }
            .details { font-size: 8px; color: #333; display: inline; margin-left: 4px; }
            .detail-label { font-weight: normal; color: #555;}
            .no-beds { font-style: italic; color: #888; }
            .print-link { color: #007bff; text-decoration: none; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .print-link { color: #000; text-decoration: none; }
              a { text-decoration: none; color: inherit; }
            }
          </style>
        </head>
        <body>
          <table>
            <thead>
              <tr>
                <th>Stanza</th>
                <th>Letto</th>
                <th>Stato / Dettagli</th>
              </tr>
            </thead>
            <tbody>
    `;

    if (roomOccupancySummary.length === 0) {
      htmlContent += '<tr><td colspan="3">Nessuna stanza con prenotazioni per questa data.</td></tr>';
    } else {
      const blockingReservationsMap = new Map<number, DetailedReservation>();
      detailedReservations.forEach(res => {
        if (res.id) { blockingReservationsMap.set(res.id, res); }
      });

      roomOccupancySummary.forEach(roomSummary => {
        const bedsInRoom = bedStatusesByRoom[roomSummary.id] || [];
        const rowSpan = bedsInRoom.length > 0 ? bedsInRoom.length : 1;

        if (bedsInRoom.length === 0) {
          // Row for room with no beds defined
          htmlContent += `
            <tr>
              <td class="room-cell" rowspan="${rowSpan}">
                ${roomSummary.description}
                <span class="room-summary">Max: ${roomSummary.bedCount}</span>
              </td>
              <td colspan="2" class="no-beds">Nessun letto definito per questa stanza.</td>
            </tr>
          `;
        } else {
          bedsInRoom.forEach((bed, bedIndex) => {
            htmlContent += `<tr>`;

            // Add room cell only for the first bed row of the room
            if (bedIndex === 0) {
              htmlContent += `
                <td class="room-cell" rowspan="${rowSpan}">
                  ${roomSummary.description}
                  <span class="room-summary">Pren: ${roomSummary.totalBooked} | Bloc: ${roomSummary.blockedCount} | Max: ${roomSummary.bedCount}</span>
                </td>
              `;
            }

            // Bed Name Cell
            htmlContent += `<td class="bed-name">${bed.name}</td>`;

            // Status/Details Cell
            htmlContent += `<td><div class="bed-status-details">`;
            switch (bed.status) {
              case 'free':
                htmlContent += `<span class="status-free">Libero</span>`;
                break;
              case 'blocked':
                const blockingRes = bed.blockedByReservationId ? blockingReservationsMap.get(bed.blockedByReservationId) : undefined;
                htmlContent += `<span class="status-blocked">Bloccato</span>`;
                if (blockingRes) {
                  const adminLink = `/admin_power/prenotazioni?search=${blockingRes.id}`;
                  htmlContent += `<span class="details">(Da Pren. <a href="${adminLink}" target="_blank" class="print-link">#${blockingRes.id}</a>)</span>`;
                } else if (bed.blockedByReservationId) {
                  htmlContent += `<span class="details">(Da Pren. #${bed.blockedByReservationId})</span>`;
                }
                break;
              case 'booked':
                if (bed.bookedBy) {
                  const { reservationId, name, surname, guestType, phone } = bed.bookedBy;
                  const adminLink = `/admin_power/prenotazioni?search=${reservationId}`;
                  htmlContent += `<span class="status-booked">Pren.</span>`;
                  htmlContent += `<span class="details">`;
                  htmlContent += `[<a href="${adminLink}" target="_blank" class="print-link">#${reservationId}</a>: ${name || ''} ${surname || ''}] `;
                  htmlContent += `<span class="detail-label">Tipo:</span> ${guestType || 'N/A'} `;
                  if (phone) {
                    htmlContent += `<span class="detail-label">Tel:</span> ${phone}`;
                  }
                  htmlContent += `</span>`; // Close details span
                } else {
                  htmlContent += `<span class="status-booked">Pren. (Dettagli mancanti)</span>`;
                }
                break;
            }
            htmlContent += `</div></td>`; // Close bed-status-details div and cell

            htmlContent += `</tr>`; // Close table row
          });
        }
      });
    }

    htmlContent += `
            </tbody>
          </table>
        </body>
      </html>
    `;
    return htmlContent;
  };

  const handleGeneratePdf = () => {
    if (disabled) return;

    const htmlContent = generatePdfContent();
    const printWindow = window.open('', '_blank');

    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        try {
            printWindow.print();
        } catch (e) {
            console.error("Printing failed:", e);
            printWindow.close();
            alert('Errore durante l\'avvio della stampa. Potrebbe essere bloccata dal browser.');
        }
      }, 500);
    } else {
      alert('Impossibile aprire la finestra di stampa. Controlla le impostazioni del tuo browser (popup blocker).');
    }
  };

  return (
    <Button
      variant="outline"
      className="flex items-center self-start h-9 px-3"
      onClick={handleGeneratePdf}
      title="Prospetto Stanze"
      disabled={disabled || roomOccupancySummary.length === 0}
    >
      <Download className="h-4 w-4 mr-2" />
      Prospetto Stanze
    </Button>
  );
};

export default BedDetailPdfGenerator; 