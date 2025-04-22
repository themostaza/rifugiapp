import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import jsPDF from 'jspdf';
import autoTable, { CellHookData } from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

interface GuestData {
  fullName: string;
  phone: string;
  reservationType: string;
}

interface OccupancyData {
  totalBeds: number;
  occupiedBeds: number;
  freeBeds: number;
  totalGuests: number;
  roomsOccupancy: {
    roomId: number;
    roomName: string;
    beds: {
      bedId: string;
      bedName: string;
      isOccupied: boolean;
      guest: GuestData | null;
    }[];
  }[];
}

// Mappa per i tipi di pensione
const reservationTypeMap: { [key: string]: string } = {
  'bb': 'Camera con colazione',
  'hb': 'Mezza pensione',
  'fb': 'Pensione completa',
  // Aggiungi altri tipi di prenotazione se necessario
};

export async function GET(request: Request) {
  try {
    // Recupera la data dalla query string
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    if (!dateParam) {
      return NextResponse.json(
        { error: 'Il parametro date è obbligatorio' },
        { status: 400 }
      );
    }

    // Parse della data nel formato YYYY-MM-DD
    const selectedDate = parseISO(dateParam);
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    
    // 1. Recupera tutte le camere e i letti
    const { data: rooms, error: roomsError } = await supabase
      .from('Room')
      .select(`
        id,
        description
      `);

    if (roomsError) {
      console.error('Errore nel recupero delle camere:', roomsError);
      return NextResponse.json(
        { error: 'Errore nel recupero delle camere dal database' },
        { status: 500 }
      );
    }

    // 2. Recupera tutti i letti associati alle camere
    const { data: beds, error: bedsError } = await supabase
      .from('RoomLinkBed')
      .select(`
        id,
        name,
        roomId,
        Room (
          id,
          description
        )
      `);

    if (bedsError) {
      console.error('Errore nel recupero dei letti:', bedsError);
      return NextResponse.json(
        { error: 'Errore nel recupero dei letti dal database' },
        { status: 500 }
      );
    }

    // 3. Recupera le prenotazioni per la data selezionata
    const { data: reservations, error: reservationsError } = await supabase
      .from('Basket')
      .select(`
        id,
        name,
        surname,
        phone,
        dayFrom,
        dayTo,
        reservationType,
        RoomReservation (
          id,
          RoomReservationSpec (
            id,
            roomLinkBedId
          )
        )
      `)
      .lte('dayFrom', formattedDate) // La prenotazione inizia prima o durante la data selezionata
      .gte('dayTo', formattedDate)   // La prenotazione finisce dopo o durante la data selezionata
      .eq('isCancelled', false);

    if (reservationsError) {
      console.error('Errore nel recupero delle prenotazioni:', reservationsError);
      return NextResponse.json(
        { error: 'Errore nel recupero delle prenotazioni dal database' },
        { status: 500 }
      );
    }

    console.log('Prenotazioni trovate:', reservations?.length || 0);
    
    // Stampa i dettagli di ciascuna prenotazione per debug
    if (reservations) {
      reservations.forEach(res => {
        console.log(`Prenotazione ID=${res.id}, Nome=${res.name} ${res.surname}, Dal=${res.dayFrom} Al=${res.dayTo}, Tipo=${res.reservationType}`);
        if (res.RoomReservation) {
          console.log(`  Camera prenotata: ${res.RoomReservation.length} RoomReservation`);
          res.RoomReservation.forEach(rr => {
            if (rr.RoomReservationSpec) {
              console.log(`    Letti prenotati: ${rr.RoomReservationSpec.length} letti`);
              rr.RoomReservationSpec.forEach(spec => {
                console.log(`      Letto ID: ${spec.roomLinkBedId}`);
              });
            }
          });
        }
      });
    }

    // Prepara i dati per l'occupazione delle camere
    const totalBeds = beds?.length || 0;
    const occupiedBedIds = new Set<string>();
    const guestsByBedId = new Map<string, GuestData>();

    // Elabora le prenotazioni per trovare i letti occupati
    if (reservations && reservations.length > 0) {
      for (const reservation of reservations) {
        console.log(`Elaboro prenotazione ID ${reservation.id}: ${reservation.name} ${reservation.surname}`);
        
        // Verifica se la prenotazione include RoomReservation
        if (reservation.RoomReservation && reservation.RoomReservation.length > 0) {
          for (const roomRes of reservation.RoomReservation) {
            // Verifica se la RoomReservation include RoomReservationSpec
            if (roomRes.RoomReservationSpec && roomRes.RoomReservationSpec.length > 0) {
              for (const spec of roomRes.RoomReservationSpec) {
                if (spec.roomLinkBedId) {
                  const bedId = spec.roomLinkBedId.toString();
                  console.log(`  - Letto occupato: ${bedId}`);
                  
                  // Segna il letto come occupato
                  occupiedBedIds.add(bedId);
                  
                  // Formatta il tipo di prenotazione
                  const reservationType = reservation.reservationType || '';
                  const formattedType = reservationTypeMap[reservationType.toLowerCase()] || reservationType;
                  
                  // Registra i dettagli dell'ospite
                  guestsByBedId.set(bedId, {
                    fullName: `${reservation.name} ${reservation.surname}`,
                    phone: reservation.phone || '',
                    reservationType: formattedType
                  });
                }
              }
            }
          }
        }
      }
    }

    // Prepara la struttura dati per l'occupazione delle camere
    const roomsOccupancy = rooms?.map(room => {
      const roomBeds = beds?.filter(bed => bed.roomId === room.id) || [];
      
      return {
        roomId: room.id,
        roomName: room.description,
        beds: roomBeds.map(bed => {
          const bedId = bed.id.toString();
          const isOccupied = occupiedBedIds.has(bedId);
          
          return {
            bedId,
            bedName: bed.name,
            isOccupied,
            guest: isOccupied ? guestsByBedId.get(bedId) || null : null
          };
        })
      };
    }) || [];

    // Statistiche finali
    const occupiedBeds = occupiedBedIds.size;
    const freeBeds = totalBeds - occupiedBeds;
    const totalGuests = occupiedBeds; // Assumiamo un ospite per letto

    const occupancyData: OccupancyData = {
      totalBeds,
      occupiedBeds,
      freeBeds,
      totalGuests,
      roomsOccupancy
    };

    console.log(`Statistiche: Letti totali=${totalBeds}, Occupati=${occupiedBeds}, Liberi=${freeBeds}, Ospiti=${totalGuests}`);

    // Genera il PDF
    const pdf = new jsPDF();
    
    // Titolo con la data
    const title = format(selectedDate, "EEEE d MMMM yyyy", { locale: it });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    const titleWidth = pdf.getStringUnitWidth(title) * 18 / pdf.internal.scaleFactor;
    const pageWidth = pdf.internal.pageSize.getWidth();
    pdf.text(title, (pageWidth - titleWidth) / 2, 20);

    // Riepilogo dell'occupazione
    pdf.setFontSize(12);
    const summaryText = `Posti letto totali: ${totalBeds}    Letti liberi: ${freeBeds}    Letti occupati: ${occupiedBeds}    Totale ospiti: ${totalGuests}`;
    const summaryWidth = pdf.getStringUnitWidth(summaryText) * 12 / pdf.internal.scaleFactor;
    pdf.text(summaryText, (pageWidth - summaryWidth) / 2, 30);

    // Crea la tabella
    const tableData: (string | number)[][] = [];
    
    // Aggiungi le righe della tabella per ogni camera e letto
    for (const room of occupancyData.roomsOccupancy) {
      let isFirstBedInRoom = true;
      
      for (const bed of room.beds) {
        const row = [
          isFirstBedInRoom ? room.roomName : '',
          `Letto ${bed.bedName}`,
          bed.isOccupied ? (bed.guest?.fullName || '') : '',
          bed.isOccupied ? (bed.guest?.phone || '') : '',
          bed.isOccupied ? (bed.guest?.reservationType || '') : ''
        ];
        
        tableData.push(row);
        isFirstBedInRoom = false;
      }
    }

    // Usa autoTable come funzione esterna
    autoTable(pdf, {
      startY: 40,
      head: [['Camere', 'Letti', 'Dettagli dell\'utente', 'telefono', 'Servizi']],
      body: tableData,
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 30 },
        2: { cellWidth: 60 },
        3: { cellWidth: 30 },
        4: { cellWidth: 40 }
      },
      headStyles: {
        fillColor: [66, 66, 66],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      didDrawCell: (data: CellHookData) => {
        // Colora lo sfondo per le righe con il nome della camera
        if (data.column.index === 0 && data.cell.text.length > 0) {
          try {
            // Accediamo solo alla cella corrente siccome data.row.cells non è un array
            const x = data.cell.x;
            const y = data.cell.y;
            const width = data.cell.width;
            const height = data.cell.height;
            
            // Coloriamo lo sfondo
            pdf.setFillColor(240, 240, 240);
            pdf.rect(x, y, width, height, 'F');
            
            // Ridisegniamo il testo
            pdf.setTextColor(0, 0, 0);
            pdf.text(String(data.cell.text), x + data.cell.padding('left'), y + data.cell.padding('top') + 5);
          } catch (error) {
            console.error('Errore nel disegnare la cella:', error);
          }
        }
      }
    });

    // Converte il PDF in un ArrayBuffer
    const pdfBytes = pdf.output('arraybuffer');
    
    // Restituisci il PDF
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="prospetto-${formattedDate}.pdf"`
      },
    });
    
  } catch (error) {
    console.error('Errore nella generazione del prospetto:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
} 