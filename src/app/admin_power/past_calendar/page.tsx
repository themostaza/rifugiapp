"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import FullMonthCalendar from "./FullMonthCalendar";

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

interface ApiResponse {
  reservations: MinimalReservation[];
  calendarDays: CalendarDay[];
  error?: string;
}


const PastCalendarPageContent: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [reservations, setReservations] = useState<MinimalReservation[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");
    const year = yearParam ? parseInt(yearParam, 10) : NaN;
    const month = monthParam ? parseInt(monthParam, 10) : NaN;
    let needsStateUpdate = false;
    let initialDate = currentDate;
    if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
      const dateFromUrl = new Date(year, month - 1, 1);
      if (
        dateFromUrl.getFullYear() !== initialDate.getFullYear() ||
        dateFromUrl.getMonth() !== initialDate.getMonth()
      ) {
        initialDate = dateFromUrl;
        needsStateUpdate = true;
      }
    }
    if (needsStateUpdate) {
      setCurrentDate(initialDate);
    }
    setIsInitialLoad(false);
    // eslint-disable-next-line
  }, []);

  const updateUrlParams = useCallback(
    (newDate: Date) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("year", newDate.getFullYear().toString());
      params.set("month", (newDate.getMonth() + 1).toString());
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const fetchReservations = async (month: number, year: number): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/calendario_mese?month=${month + 1}&year=${year}`);
      const data: ApiResponse = await response.json();
      if (data.reservations && data.calendarDays) {
        setReservations(data.reservations);
        setCalendarDays(data.calendarDays);
      } else if (data.error) {
        setError(data.error);
        setReservations([]);
        setCalendarDays([]);
      } else {
        setError("Unexpected API response format");
        setReservations([]);
        setCalendarDays([]);
      }
    } catch (err) {
      setError("Failed to fetch reservations");
      setReservations([]);
      setCalendarDays([]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isInitialLoad) {
      fetchReservations(currentDate.getMonth(), currentDate.getFullYear());
    }
    // eslint-disable-next-line
  }, [currentDate, isInitialLoad]);

  const handleMonthChange = (date: Date) => {
    setCurrentDate(date);
    updateUrlParams(date);
  };




  if (isInitialLoad) {
    return (
      <div className="max-w-6xl mx-auto p-4 h-96 flex items-center justify-center">
        Loading initial state...
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {loading ? (
        <div className="text-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500 mx-auto mb-2" />
          Caricamento...
        </div>
      ) : error ? (
        <div className="text-center py-10 text-red-500">Errore: {error}</div>
      ) : (
        <FullMonthCalendar
          currentDate={currentDate}
          reservations={reservations}
          calendarDays={calendarDays}
          onMonthChange={handleMonthChange}
        />
      )}
    </div>
  );
};

const PastCalendarPage: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-gray-400" />
        </div>
      }
    >
      <PastCalendarPageContent />
    </Suspense>
  );
};

export default PastCalendarPage; 