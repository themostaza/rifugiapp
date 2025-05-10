import React from "react";
import { ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface MinimalReservation {
  id: number;
  dayFrom: string;
  dayTo: string;
  name: string;
  external_id: string;
  guestCount: number;
}

interface CalendarDay {
  date: string;
  isBlocked: boolean;
}

interface FullMonthCalendarProps {
  currentDate: Date;
  reservations: MinimalReservation[];
  calendarDays: CalendarDay[];
  onMonthChange: (date: Date) => void;
}

const weekDays = [
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
  "Domenica",
];

const months = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

const COLORS = [
  "#60a5fa", // blue
  "#f59e42", // orange
  "#10b981", // green
  "#f43f5e", // red
  "#a78bfa", // purple
  "#fbbf24", // yellow
  "#34d399", // teal
  "#6366f1", // indigo
  "#f87171", // pink
  "#f472b6", // magenta
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  // 0 = Sunday, 1 = Monday, ...
  const day = new Date(year, month, 1).getDay();
  // Convert to Monday=0, Sunday=6
  return (day + 6) % 7;
}

function getReservationColor(res: MinimalReservation) {
  // Use check-in day for color assignment (or fallback to id)
  const day = new Date(res.dayFrom).getDate();
  return COLORS[day % COLORS.length];
}

function getTextColor(bg: string) {
  // Simple contrast: use black for light backgrounds, white for dark
  // (very basic, for 10-color palette is enough)
  const lightColors = ["#fbbf24", "#f59e42", "#34d399"];
  return lightColors.includes(bg) ? "black" : "white";
}

const FullMonthCalendar: React.FC<FullMonthCalendarProps> = ({
  currentDate,
  reservations,
  calendarDays,
  onMonthChange,
}) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfWeek(year, month); // 0 = Monday

  // Crea una mappa rapida per i giorni bloccati e delle prenotazioni per giorno (tutto in un unico useMemo)
  const { blockedMap, reservationsByDay } = React.useMemo(() => {
    const blockedMap: Record<string, boolean> = {};
    calendarDays.forEach(day => { blockedMap[day.date] = day.isBlocked; });

    const reservationsByDay: Record<string, MinimalReservation[]> = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = format(new Date(year, month, day), "yyyy-MM-dd");
      reservationsByDay[dateStr] = [];
    }
    reservations.forEach(res => {
      const from = new Date(res.dayFrom);
      const to = new Date(res.dayTo);
      for (
        let d = new Date(Math.max(from.getTime(), new Date(year, month, 1).getTime()));
        d <= to && d.getMonth() === month && d.getFullYear() === year;
        d.setDate(d.getDate() + 1)
      ) {
        const dateStr = format(new Date(d), "yyyy-MM-dd");
        if (reservationsByDay[dateStr]) reservationsByDay[dateStr].push(res);
      }
    });
    return { blockedMap, reservationsByDay };
  }, [calendarDays, reservations, year, month, daysInMonth]);

  // Navigazione mesi
  const handlePrevMonth = () => {
    const prev = new Date(year, month - 1, 1);
    onMonthChange(prev);
  };
  const handleNextMonth = () => {
    const next = new Date(year, month + 1, 1);
    onMonthChange(next);
  };

  // Costruisci la griglia del mese (6 settimane, 7 giorni)
  const weeks: (number | null)[][] = [];
  let day = 1 - firstDayOfWeek;
  for (let w = 0; w < 6; w++) {
    const week: (number | null)[] = [];
    for (let d = 0; d < 7; d++) {
      if (day < 1 || day > daysInMonth) {
        week.push(null);
      } else {
        week.push(day);
      }
      day++;
    }
    weeks.push(week);
  }

  return (
    <div className="bg-white rounded shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={handlePrevMonth} className="p-2 rounded hover:bg-gray-100">
          &#8592;
        </button>
        <span className="font-semibold text-lg">
          {months[month]} {year}
        </span>
        <button onClick={handleNextMonth} className="p-2 rounded hover:bg-gray-100">
          &#8594;
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 mb-2">
        {weekDays.map((wd, i) => (
          <div key={i} className="text-center font-bold text-gray-600 py-1">
            {wd}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((dayNum, idx) => {
          if (!dayNum) {
            return <div key={idx} className="bg-gray-50 min-h-[90px] h-full rounded" />;
          }
          const dateObj = new Date(year, month, dayNum);
          const dateStr = format(dateObj, "yyyy-MM-dd");
          const isBlocked = blockedMap[dateStr];
          const dayReservations = reservationsByDay[dateStr] || [];
          return (
            <div
              key={idx}
              className={`relative min-h-[90px] h-full py-1 border ${isBlocked ? "bg-orange-100 border-orange-300" : "bg-green-50 border-green-200"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm px-2">{dayNum}</span>
                {isBlocked && <span className="text-orange-500 text-xs font-semibold px-2">Bloccato</span>}
              </div>
              <div className="flex flex-col gap-1">
                {dayReservations.length === 0 ? (
                  <span className="text-xs text-gray-400 px-2">Nessuna prenotazione</span>
                ) : (
                  dayReservations.map(res => {
                    const bg = getReservationColor(res);
                    const textColor = getTextColor(bg);
                    return (
                      <div
                        key={res.id}
                        className="text-xs w-full px-2 py-1 flex items-center justify-between shadow"
                        style={{ background: bg, color: textColor, border: `1px solid ${bg}` }}
                        title={`Prenotazione #${res.id}`}
                      >
                        <span className="truncate">#{res.id} {res.name}</span>
                        <button
                          className="ml-1 p-0.5 rounded hover:bg-black/20"
                          title="Apri dettaglio carrello in nuova tab"
                          onClick={e => {
                            e.stopPropagation();
                            window.open(`/cart/${res.external_id}`, '_blank');
                          }}
                          style={{ lineHeight: 0, verticalAlign: 'middle' }}
                        >
                          <ExternalLink className="w-3 h-3" style={{ color: textColor }} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FullMonthCalendar; 