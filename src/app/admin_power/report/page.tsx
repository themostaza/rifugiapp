'use client'

import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

async function fetchReportData(from: string, to: string) {
  const res = await fetch(`/api/report-past-reservations?from=${from}&to=${to}`);
  if (!res.ok) throw new Error('Errore nel fetch del report');
  return await res.json();
}

const REGION_MAP: Record<string | number, string> = {
  1: 'Abruzzo', 2: 'Basilicata', 3: 'Calabria', 4: 'Campania', 5: 'Emilia-Romagna',
  6: 'Friuli-Venezia Giulia', 7: 'Lazio', 8: 'Liguria', 9: 'Lombardia', 10: 'Marche',
  11: 'Molise', 12: 'Piemonte', 13: 'Puglia', 14: 'Sardegna', 15: 'Sicilia',
  16: 'Toscana', 17: 'Trentino-Alto Adige', 18: 'Umbria', 19: 'Valle d\'Aosta', 20: 'Veneto'
};

const CSV_HEADER_IT = [
  'Data check-in',
  'Data check-out',
  'Notti',
  'Tipologia',
  'Totale ospiti',
  'Adulti',
  'Bambini',
  'Neonati',
  'Nome',
  'Stato',
  'Regione',
];

// Tipo per una riga del report
interface ReservationReportRow {
  checkIn: string;
  checkOut: string;
  numberOfNight: number;
  reservationType: string;
  totalOfGuest: number;
  totalOfAdults: number;
  totalOfChild: number;
  totalOfBabay: number;
  name: string;
  country: string;
  region: string | number;
}

function toCsvIt(rows: ReservationReportRow[]) {
  if (!rows.length) return CSV_HEADER_IT.join(',') + '\r\n';
  const csv = [
    CSV_HEADER_IT.join(','),
    ...rows.map(row => [
      row.checkIn,
      row.checkOut,
      row.numberOfNight,
      row.reservationType,
      row.totalOfGuest,
      row.totalOfAdults,
      row.totalOfChild,
      row.totalOfBabay,
      row.name,
      row.country,
      REGION_MAP[row.region] || row.region || ''
    ].map(v => JSON.stringify(v ?? '')).join(','))
  ].join('\r\n');
  return csv;
}

function toLocalYMD(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const ReportsSection = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const isRangeSelected = !!dateRange?.from && !!dateRange?.to;

  const formatRange = (from?: Date, to?: Date) => {
    if (!from && !to) return "Seleziona date check-in";
    if (from && !to) return format(from, 'd MMM yyyy', { locale: it });
    if (from && to) return `${format(from, 'd MMM yyyy', { locale: it })} - ${format(to, 'd MMM yyyy', { locale: it })}`;
    return "Seleziona intervallo date";
  };

  const handleDownloadCsv = async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    const from = toLocalYMD(dateRange.from);
    const to = toLocalYMD(dateRange.to);
    const data = await fetchReportData(from, to);
    const csv = toCsvIt(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `report_prenotazioni_${from}_${to}.csv`);
  };

  const handleDownloadPdf = async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    const from = toLocalYMD(dateRange.from);
    const to = toLocalYMD(dateRange.to);
    const data: ReservationReportRow[] = await fetchReportData(from, to);
    const doc = new jsPDF();
    const rows = data.map((row) => [
      row.checkIn,
      row.checkOut,
      row.numberOfNight,
      row.reservationType,
      row.totalOfGuest,
      row.totalOfAdults,
      row.totalOfChild,
      row.totalOfBabay,
      row.name,
      row.country,
      REGION_MAP[row.region] || row.region || ''
    ]);
    autoTable(doc, {
      head: [CSV_HEADER_IT],
      body: rows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [230, 230, 230], textColor: 50 },
      margin: { top: 20 },
    });
    doc.save(`report_prenotazioni_${from}_${to}.pdf`);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      {/* Past Reservations Report */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <h2 className="font-medium mb-2">Report prenotazioni passate</h2>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full md:w-[260px] justify-start text-left font-normal border-gray-300"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatRange(dateRange?.from, dateRange?.to)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    locale={it}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-row gap-2 md:ml-8 mt-2 md:mt-0 self-end md:self-center">
              <Button
                variant="secondary"
                className="flex items-center gap-2"
                disabled={!isRangeSelected}
                onClick={handleDownloadCsv}
              >
                <Download className="h-4 w-4" />
                CSV
              </Button>
              <Button
                variant="secondary"
                className="flex items-center gap-2"
                disabled={!isRangeSelected}
                onClick={handleDownloadPdf}
              >
                <Download className="h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Future Reservations Report */}
      <Card className="p-4">
        <div className="flex justify-between items-center">
          <h2 className=" font-medium">Report prenotazioni future</h2>
          <Button 
            variant="secondary"
            className="flex items-center gap-2"
            onClick={() => {
              // API integration will go here
              console.log('Send future reservations report');
            }}
          >
            <Download className="h-4 w-4" />
            Scarica
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ReportsSection;