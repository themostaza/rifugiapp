import React from 'react';
import { ExternalLink } from 'lucide-react';

interface MinimalReservation {
  id: number;
  dayFrom: string;
  dayTo: string;
  name: string;
  external_id: string;
}

interface CalendarDay {
  date: string;
  isBlocked: boolean;
}

interface MonthlyTimelineCalendarProps {
  currentDate: Date;
  reservations: MinimalReservation[];
  calendarDays: CalendarDay[];
  onMonthChange: (date: Date) => void;
}

function getDaysArray(year: number, month: number) {
  const numDays = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: numDays }, (_, i) => i + 1);
}

function getDateString(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const months = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

const MonthlyTimelineCalendar: React.FC<MonthlyTimelineCalendarProps> = ({
  currentDate,
  reservations,
  calendarDays,
  onMonthChange,
}) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Mappa rapida per i giorni bloccati
  const blockedMap = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    calendarDays.forEach(day => { map[day.date] = day.isBlocked; });
    return map;
  }, [calendarDays]);

  // Ordina le prenotazioni per check-in (dayFrom), poi per check-out (dayTo)
  const sortedReservations = React.useMemo(() => {
    return [...reservations].sort((a, b) => {
      const aFrom = new Date(a.dayFrom).getTime();
      const bFrom = new Date(b.dayFrom).getTime();
      if (aFrom !== bFrom) return aFrom - bFrom;
      const aTo = new Date(a.dayTo).getTime();
      const bTo = new Date(b.dayTo).getTime();
      return aTo - bTo;
    });
  }, [reservations]);

  // Calcola quanti giorni "prima" e "dopo" servono per visualizzare le barre intere
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Trova il giorno più piccolo (check-in) e più grande (check-out) tra tutte le prenotazioni
  const minDay = Math.min(
    ...sortedReservations.map(res => {
      const from = new Date(res.dayFrom);
      return from < firstDayOfMonth ? 0 : from.getDate();
    }),
    1
  );
  const maxDay = Math.max(
    ...sortedReservations.map(res => {
      const to = new Date(res.dayTo);
      // Se il check-out è dopo la fine del mese, aggiungi una colonna fittizia
      return to > lastDayOfMonth ? lastDayOfMonth.getDate() + 1 : to.getDate();
    }),
    lastDayOfMonth.getDate()
  );

  // Numero di colonne fittizie a sinistra e a destra
  const extraLeft = 1 - minDay;
  const extraRight = maxDay - lastDayOfMonth.getDate();

  // Array dei giorni (con colonne fittizie)
  const days = [
    ...Array.from({ length: extraLeft > 0 ? extraLeft : 0 }, (_, i) => -((extraLeft > 0 ? extraLeft : 0) - i)),
    ...getDaysArray(year, month),
    ...Array.from({ length: extraRight > 0 ? extraRight : 0 }, (_, i) => lastDayOfMonth.getDate() + i + 1),
  ];

  // Funzione per sapere se una colonna è fittizia
  function isFakeDay(day: number) {
    return day < 1 || day > lastDayOfMonth.getDate();
  }

  // Modifica getBarPosition per usare l'indice globale (con colonne fittizie)
  function getBarPosition(dayFrom: string, dayTo: string) {
    const from = new Date(dayFrom);
    const to = new Date(dayTo);
    // Calcola l'indice di partenza rispetto all'array days
    let startIdx = days.findIndex(d => {
      if (d < 1) return from < firstDayOfMonth;
      if (d > lastDayOfMonth.getDate()) return false;
      return from.getDate() === d && from >= firstDayOfMonth;
    });
    if (from < firstDayOfMonth) startIdx = 0;
    // L'indice di fine è il giorno di check-out (mezza cella)
    let endIdx = days.findIndex(d => {
      if (d < 1) return false;
      if (d > lastDayOfMonth.getDate()) return to > lastDayOfMonth;
      return to.getDate() === d && to <= lastDayOfMonth;
    });
    if (to > lastDayOfMonth) endIdx = days.length - 1;
    return {
      left: startIdx,
      width: Math.max(1, endIdx - startIdx), // la barra si ferma prima del giorno di check-out
      checkoutIdx: endIdx,
    };
  }

  // Navigazione mesi
  const handlePrevMonth = () => {
    const prev = new Date(year, month - 1, 1);
    onMonthChange(prev);
  };
  const handleNextMonth = () => {
    const next = new Date(year, month + 1, 1);
    onMonthChange(next);
  };

  // Calcola la larghezza totale della tabella per la barra di scorrimento
  const tableWidth = 72 * days.length + 160; // 72px per giorno + 160px per colonna prenotazione

  return (
    <table className="min-w-max border-separate border-spacing-0" style={{ width: tableWidth }}>
      <thead>
        <tr>
          <th
            className="sticky left-0 top-0 bg-white z-20 border-r px-2 py-1 text-xs font-bold text-gray-700 align-top"
            style={{ minWidth: 160, width: 160 }}
          >
            <div className="flex flex-col items-start gap-2 h-full">
              <span className="text-base font-bold mb-1">Vista calendario (Gantt)</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevMonth}
                  className="px-1 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
                  title="Mese precedente"
                  style={{ minWidth: 24 }}
                >
                  &#8592;
                </button>
                <span className="font-semibold text-sm mx-1">
                  {months[month]} {year}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="px-1 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
                  title="Mese successivo"
                  style={{ minWidth: 24 }}
                >
                  &#8594;
                </button>
              </div>
            </div>
          </th>
          {days.map(day => {
            const dateStr = getDateString(year, month, day);
            return (
              <th
                key={day}
                className={`px-2 py-1 text-xs font-bold text-center border-r-2 border-gray-300
                  ${isFakeDay(day)
                    ? 'bg-white text-gray-300'
                    : blockedMap[dateStr]
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-green-50 text-gray-700'}
                `}
                style={{ minWidth: 72 }}
              >
                {day}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sortedReservations.map(res => {
          const { left, width, checkoutIdx } = getBarPosition(res.dayFrom, res.dayTo);
          return (
            <tr key={res.id}>
              <td className="sticky left-0 bg-white z-10 border-r px-2 py-1 text-xs font-mono text-gray-700 whitespace-nowrap" style={{ minWidth: 160, width: 160 }}>
                <span>#{res.id} {res.name}</span>
                <button
                  className="ml-2 p-1 rounded hover:bg-gray-100"
                  title="Apri dettaglio carrello in nuova tab"
                  onClick={e => {
                    e.stopPropagation();
                    window.open(`/cart/${res.external_id}`, '_blank');
                  }}
                >
                  <ExternalLink className="w-3 h-3 text-black" />
                </button>
              </td>
              {days.map((day, idx) => {
                // La cella è parte della barra?
                const inBar = idx >= left && idx < left + width;
                // La cella è il giorno di check-out (mezza cella)
                const isCheckoutDay = idx === checkoutIdx;
                return (
                  <td
                    key={day}
                    className={`relative px-0 py-1 border-r-2 border-gray-300
                      ${isFakeDay(day)
                        ? 'bg-white'
                        : blockedMap[getDateString(year, month, day)]
                          ? 'bg-orange-50'
                          : 'bg-green-50'}
                    `}
                    style={{ minWidth: 72, height: 28 }}
                  >
                    {inBar && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-5 bg-blue-500 text-white text-xs flex items-center px-2 shadow"
                        style={{
                          width: 'calc(100% + 1px)',
                          zIndex: 1,
                          opacity: 1,
                        }}
                        title={`Prenotazione #${res.id}`}
                      >
                        {left === idx && (
                          <>
                            <span className="font-semibold">#{res.id}</span>
                            <button
                              className="ml-1 p-0.5 rounded hover:bg-gray-100"
                              title="Apri dettaglio carrello in nuova tab"
                              onClick={e => {
                                e.stopPropagation();
                                window.open(`/cart/${res.external_id}`, '_blank');
                              }}
                              style={{ lineHeight: 0, verticalAlign: 'middle' }}
                            >
                              <ExternalLink className="w-3 h-3 text-white" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {isCheckoutDay && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-5 bg-blue-500 text-white text-xs flex items-center px-2 shadow"
                        style={{
                          width: '50%',
                          zIndex: 2,
                          opacity: 1,
                        }}
                        title={`Check-out #${res.id}`}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default MonthlyTimelineCalendar; 