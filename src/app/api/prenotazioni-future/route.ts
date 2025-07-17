import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Image } from '@react-pdf/renderer';
import React from 'react';
import QRCode from 'qrcode';
import { SupabaseClient } from '@supabase/supabase-js';

// --- Type Definitions (copied from daily-email API) ---
interface Room {
  id: number;
  description: string | null;
  RoomLinkBed: { count: number }[] | null;
  order?: number | null;
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

// PDF Styles for @react-pdf/renderer
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 0,
    fontSize: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    flexWrap: 'wrap',
    gap: 6,
  },
  title: {
    fontSize: 8,
    fontWeight: 'bold',
    marginRight: 10,
  },
  subtitle: {
    fontSize: 8,
    color: '#666666',
  },
  noData: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666666',
    marginTop: 50,
  },
  sectionHeader: {
    backgroundColor: '#e3f2fd',
    padding: 3,
    marginBottom: 2,
    marginTop: 2,
    borderRadius: 1,
    border: '1px solid #2196f3',
  },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#1976d2',
    textAlign: 'center',
  },
});

// --- UTILITY FUNCTIONS ---
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

// Function to fetch future reservations in date range
async function fetchFutureReservations(supabase: SupabaseClient, fromDate: string, toDate: string): Promise<DetailedReservation[] | null> {
  try {
    console.log(`[future-reservations] Fetching reservations from ${fromDate} to ${toDate}`);

    // Query reservations that have check-in within the specified range
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
              Room ( id, description, RoomLinkBed(count), "order" )
            )
          )
        )
      `)
      .gte('dayFrom', fromDate)
      .lte('dayFrom', toDate + 'T23:59:59.999Z') // Include full day
      .or('and(isPaid.eq.true,isCancelled.eq.false),and(isCreatedByAdmin.eq.true,isCancelled.eq.false)')
      .order('dayFrom', { ascending: true });

    if (error) {
      console.error("Supabase query error:", error);
      return null;
    }

    if (!baskets) {
      return [];
    }

    // Fetch extra services
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

    // Process data
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

    console.log(`[future-reservations] Found ${detailedReservations.length} reservations`);
    return detailedReservations;
  } catch (error) {
    console.error("Error fetching future reservations:", error);
    return null;
  }
}

// Generate Future Reservations PDF grouped by check-in date
async function generateFutureReservationsPdf(fromDate: string, toDate: string, reservations: DetailedReservation[]): Promise<Buffer> {
  try {
    console.log('[future-reservations] Creating PDF with @react-pdf/renderer...');
    const elaborationDate = new Date().toLocaleDateString('it-IT');

    // Group reservations by check-in date
    const reservationsByDate: { [date: string]: DetailedReservation[] } = {};
    
    reservations.forEach(reservation => {
      const checkInDate = reservation.dayFrom?.split('T')[0] || '';
      if (!reservationsByDate[checkInDate]) {
        reservationsByDate[checkInDate] = [];
      }
      reservationsByDate[checkInDate].push(reservation);
    });

    // Sort dates
    const sortedDates = Object.keys(reservationsByDate).sort();

    // Helper to generate QR code as data URL
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

    // Pre-generate all QR codes
    const qrCodes: (string | null)[] = await Promise.all(
      reservations.map(res => getQrDataUrl(res.external_id || null))
    );

    // Create QR mapping by reservation ID for easy lookup
    const qrCodesByReservationId: { [id: number]: string | null } = {};
    reservations.forEach((res, index) => {
      qrCodesByReservationId[res.id] = qrCodes[index];
    });

    // Create PDF document
    const FutureReservationsDocument = React.createElement(Document, {},
      React.createElement(Page, { size: 'A4', style: styles.page },
        // Header
        React.createElement(View, { style: styles.header },
          React.createElement(Text, { style: styles.title }, 'Prenotazioni Future'),
          React.createElement(Text, { style: styles.subtitle }, `Elaborazione: ${elaborationDate}`),
          React.createElement(Text, { style: styles.subtitle }, `Dal: ${formatDateForPdf(fromDate)} - Al: ${formatDateForPdf(toDate)}`)
        ),
        // Content
        reservations.length === 0
          ? React.createElement(Text, { style: styles.noData }, 'Nessuna prenotazione trovata per il periodo selezionato.')
          : React.createElement(View, {},
              // Group by check-in date
              ...sortedDates.map(dateString => {
                const dateReservations = reservationsByDate[dateString];
                const formattedDate = formatDateForPdf(dateString);
                
                return [
                  // Date section header
                  React.createElement(View, { key: `header-${dateString}`, style: styles.sectionHeader },
                    React.createElement(Text, { style: styles.sectionTitle }, 
                      `CHECK-IN ${formattedDate} (${dateReservations.length} prenotazione${dateReservations.length === 1 ? '' : 'i'})`
                    )
                  ),
                  // Reservations for this date
                  ...dateReservations.map((reservation) => {
                    const totalGuests = reservation.guestBreakdown.adults + reservation.guestBreakdown.children + reservation.guestBreakdown.infants;
                    const guestBreakdown = `A:${reservation.guestBreakdown.adults}, B:${reservation.guestBreakdown.children}, N:${reservation.guestBreakdown.infants}`;
                    const paymentStatus = reservation.isCreatedByAdmin ? 'admin' : reservation.isPaid ? 'paid' : 'notpaid';
                    const reservationType = reservation.reservationType === 'hb' ? 'Mezza Pensione' : reservation.reservationType === 'bb' ? 'Bed & Breakfast' : reservation.reservationType || 'N/A';
                    const qrDataUrl = qrCodesByReservationId[reservation.id];

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
                        // Extra services box
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
                ].flat();
              }).flat()
            )
      )
    );

    const pdfBuffer = await renderToBuffer(FutureReservationsDocument);
    console.log('[future-reservations] PDF generated, size:', pdfBuffer.length);
    return pdfBuffer;
  } catch (error) {
    console.error('[future-reservations] Error in generateFutureReservationsPdf:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[future-reservations] Starting future reservations PDF generation');

    // Parse request body to get date range
    const body = await request.json();
    const { fromDate, toDate } = body;

    if (!fromDate || !toDate) {
      return NextResponse.json({ 
        error: 'Missing required parameters: fromDate and toDate' 
      }, { status: 400 });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(fromDate) || !dateRegex.test(toDate)) {
      return NextResponse.json({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      }, { status: 400 });
    }

    // Validate date range
    if (fromDate > toDate) {
      return NextResponse.json({ 
        error: 'fromDate cannot be after toDate' 
      }, { status: 400 });
    }

    console.log(`[future-reservations] Date range: ${fromDate} to ${toDate}`);

    // Initialize Supabase client
    const supabase = createRouteHandlerClient({ cookies });

    // Fetch future reservations
    const reservations = await fetchFutureReservations(supabase, fromDate, toDate);
    
    if (reservations === null) {
      console.error('[future-reservations] Failed to fetch reservations');
      return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 });
    }

    console.log(`[future-reservations] Found ${reservations.length} reservations`);

    // Generate PDF
    const pdfBuffer = await generateFutureReservationsPdf(fromDate, toDate, reservations);
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      console.error('[future-reservations] Failed to generate PDF');
      return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }

    // Verify PDF header
    const pdfHeader = pdfBuffer.subarray(0, 4);
    const expectedHeader = Buffer.from('%PDF');
    
    if (!expectedHeader.equals(pdfHeader)) {
      console.error('[future-reservations] Invalid PDF header');
      return NextResponse.json({ error: 'Generated PDF is not valid' }, { status: 500 });
    }

    console.log('[future-reservations] PDF generated successfully, size:', pdfBuffer.length);

    // Return PDF as download
    const filename = `Prenotazioni_Future_${fromDate}_${toDate}.pdf`;
    
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('[future-reservations] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 