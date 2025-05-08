'use client'

import React from 'react';
import { Button } from "@/components/ui/button";
import { ListChecks } from "lucide-react"; // Icon for the button
import QRCode from 'qrcode';

// --- Copied Type Definitions (similar to daySheet.tsx) ---
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
  guestBreakdown: {
    adults: number;
    children: number;
    infants: number;
  };
}

// --- Component Props ---
interface ReservationListPdfGeneratorProps {
  date: Date;
  detailedReservations: DetailedReservation[];
  disabled?: boolean;
}

// --- Helper Functions (copied from daySheet.tsx for self-containment) ---
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
// --- End Helper Functions ---

const ReservationListPdfGenerator: React.FC<ReservationListPdfGeneratorProps> = ({
  date,
  detailedReservations,
  disabled = false,
}) => {

  const generateQrCodeDataURL = async (text: string): Promise<string> => {
    try {
      return await QRCode.toDataURL(text, { errorCorrectionLevel: 'L', width: 80 });
    } catch (err) {
      console.error('QR Code generation failed', err);
      return ''; // Return empty string or a placeholder image data URL
    }
  };

  const generatePdfContent = async (): Promise<string> => {
    const formattedDate = formatDateForPdf(date);
    let htmlContent = `
      <html>
        <head>
          <title>Elenco Prenotazioni - ${formattedDate}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 15px; font-size: 10px; line-height: 1.3; }
            .header { text-align: center; margin-bottom: 15px; }
            .header h1 { font-size: 18px; margin: 0; }
            .reservation-item { border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; page-break-inside: avoid; display: flex; align-items: flex-start; }
            .qr-code { margin-right: 15px; flex-shrink: 0; }
            .qr-code img { width: 80px; height: 80px; border: 1px solid #eee; }
            .details { flex-grow: 1; }
            .details h2 { font-size: 12px; margin-top: 0; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 3px;}
            .details p { margin: 2px 0; }
            .details .label { font-weight: bold; color: #333; }
            .paid { color: green; font-weight: bold; }
            .not-paid { color: red; font-weight: bold; }
            .admin-created { color: purple; font-weight: bold; }
            .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 5px 10px; }
            .note-section { margin-top: 5px; padding-top: 5px; border-top: 1px dotted #ddd; font-size: 9px; }
            .note-section .label { display: block; }
            .note-content { white-space: pre-wrap; background-color: #f9f9f9; padding: 5px; border-radius: 3px; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .reservation-item { border-color: #aaa; }
            }
          </style>
        </head>
        <body>
          
    `;

    if (detailedReservations.length === 0) {
      htmlContent += '<p style="text-align:center;">Nessuna prenotazione trovata per questa data.</p>';
    } else {
      for (const reservation of detailedReservations) {
        const guestBreakdownString = `A:${reservation.guestBreakdown.adults}, B:${reservation.guestBreakdown.children}, N:${reservation.guestBreakdown.infants}`;
        const totalReservationGuests = reservation.guestBreakdown.adults + reservation.guestBreakdown.children + reservation.guestBreakdown.infants;
        const paymentStatus = reservation.isCreatedByAdmin 
          ? '<span class="admin-created">Admin</span>' 
          : reservation.isPaid 
            ? '<span class="paid">Pagata</span>' 
            : '<span class="not-paid">Non Pagata</span>';
        
        let qrCodeImgTag = '<div class="qr-code" style="width:80px; height:80px; border:1px solid #eee; display:flex; align-items:center; justify-content:center; font-size:9px; color:#777;">N/A</div>';
        if (reservation.external_id) {
          // Assumes the app is hosted at the root. Adjust if it's in a subfolder.
          const link = `${window.location.origin}/cart/${reservation.external_id}`;
          const qrDataUrl = await generateQrCodeDataURL(link);
          if (qrDataUrl) {
            qrCodeImgTag = `<div class="qr-code"><img src="${qrDataUrl}" alt="QR Code for Reservation ${reservation.id}" /></div>`;
          }
        }

        htmlContent += `
          <div class="reservation-item">
            ${qrCodeImgTag}
            <div class="details">
              <h2>Pren. #${reservation.id} - ${reservation.name || 'N/A'} ${reservation.surname || ''}</h2>
              <div class="info-grid">
                <p><span class="label">Check-in:</span> ${formatDateForPdf(reservation.dayFrom)}</p>
                <p><span class="label">Check-out:</span> ${formatDateForPdf(reservation.dayTo)}</p>
                <p><span class="label">Ospiti:</span> ${totalReservationGuests} (${guestBreakdownString})</p>
                <p><span class="label">Tipo:</span> ${reservation.reservationType === 'hb' ? 'Mezza Pensione' : reservation.reservationType === 'bb' ? 'Bed & Breakfast' : reservation.reservationType || 'N/A'}</p>
                <p><span class="label">Prezzo:</span> ${formatPriceForPdf(reservation.totalPrice)}</p>
                <p><span class="label">Stato:</span> ${paymentStatus}</p>
                <p><span class="label">Email:</span> ${reservation.mail || 'N/A'}</p>
                <p><span class="label">Tel:</span> ${reservation.phone || 'N/A'}</p>
              </div>
              ${reservation.note ? `
                <div class="note-section">
                  <span class="label">Note:</span>
                  <div class="note-content">${reservation.note}</div>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }
    }

    htmlContent += `
        </body>
      </html>
    `;
    return htmlContent;
  };

  const handleGeneratePdf = async () => {
    if (disabled) return;

    const htmlContent = await generatePdfContent();
    const printWindow = window.open('', '_blank');

    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      // Delay print to allow QR codes and images to load if any external resources were used (though data URLs are embedded)
      setTimeout(() => {
        try {
            printWindow.print();
        } catch (e) {
            console.error("Printing failed:", e);
            printWindow.close(); // Close window on error
            alert('Errore durante l\'avvio della stampa. Potrebbe essere bloccata dal browser.');
        }
      }, 500); // 500ms might be a good starting point
    } else {
      alert('Impossibile aprire la finestra di stampa. Controlla le impostazioni del tuo browser (popup blocker).');
    }
  };

  return (
    <Button
      variant="outline"
      className="flex items-center self-start h-9 px-3" // Same styling as the other button for consistency
      onClick={handleGeneratePdf}
      title="Stampa Elenco Prenotazioni"
      disabled={disabled || detailedReservations.length === 0}
    >
      <ListChecks className="h-4 w-4 mr-2" />
      Elenco Prenotazioni
    </Button>
  );
};

export default ReservationListPdfGenerator; 