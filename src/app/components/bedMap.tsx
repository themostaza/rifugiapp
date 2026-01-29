import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Bed {
  id: number;
  name: string;
  isAvailable: boolean;
}

interface NightAvailability {
  date: string;
  rooms: Array<{
    roomId: number;
    description: string;
    allBeds: Array<{
      id: number;
      name: string;
      isAvailable: boolean;
    }>;
  }>;
}

interface BedMapProps {
  roomId: number;
  allBeds?: Array<{ id: number; name: string }>;
  availableBeds?: Array<{ id: number; name: string }>;
  availabilityByNight?: NightAvailability[];
  t: (key: string, vars?: Record<string, unknown>) => string;
  onBedClick?: (bedId: number) => void;
  selectedBedIds?: string[];
  blockedBedIds?: string[];
}

const BedMap: React.FC<BedMapProps> = ({
  roomId,
  allBeds = [],
  availableBeds = [],
  availabilityByNight = [],
  t,
  onBedClick,
  selectedBedIds = [],
  blockedBedIds = [],
}) => {
  // Debug log
  // console.log('BedMap props:', {
  //   roomId,
  //   availabilityByNight: availabilityByNight ? availabilityByNight.length : 'undefined'
  // });

  // Stato per tenere traccia della notte selezionata
  const [selectedNightIndex, setSelectedNightIndex] = useState(0);

  // Funzione per ordinare i letti per numero
  const sortBedsByNumber = <T extends { name: string }>(beds: T[]): T[] => {
    return [...beds].sort((a, b) => {
      // Estrae il numero dal nome del letto (es. "Letto 1" -> 1)
      const numA = parseInt(a.name.match(/\d+/)?.[0] || "0");
      const numB = parseInt(b.name.match(/\d+/)?.[0] || "0");
      return numA - numB;
    });
  };

  // Se i dati non sono ancora disponibili, mostriamo un messaggio di caricamento
  if (!allBeds.length && !availableBeds.length) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-48"></div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 bg-gray-200 rounded w-32"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Se non abbiamo dati per notte o è una sola notte, usiamo la vista standard
  if (!availabilityByNight || availabilityByNight.length <= 1) {
    // Trasformiamo i dati nel formato che serve per il rendering
    const bedsWithAvailability: Bed[] = sortBedsByNumber(
      allBeds.map((bed) => {
        const isAvailable = availableBeds.some(
          (availableBed) => availableBed.id === bed.id,
        );
        return {
          id: bed.id,
          name: bed.name,
          isAvailable,
        };
      }),
    );

    if (bedsWithAvailability.length === 0) {
      return <div className="p-4 text-gray-500">{t("bedMap.noInfo")}</div>;
    }

    return (
      <div className="p-4 space-y-4">
        <div className="text-sm text-gray-600 mb-2">
          <strong>{t("bedMap.title")}</strong>{" "}
          <span className="px-3 py-1 rounded-sm border-2 text-sm bg-green-100 text-green-800 border-green-200">
            {t("bedMap.free")}
          </span>{" "}
          <span className="px-3 py-1 rounded-sm border-2 text-sm bg-blue-100 text-blue-800 border-blue-200">
            Selezionato
          </span>{" "}
          <span className="px-3 py-1 rounded-sm border-2 text-sm bg-red-100 text-red-800 border-red-200">
            {t("bedMap.occupied")}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {bedsWithAvailability.map((bed) => {
            const isSelected = selectedBedIds.includes(bed.id.toString());
            const isBlocked = blockedBedIds.includes(bed.id.toString());
            const isClickable =
              (bed.isAvailable || isSelected) && !isBlocked && onBedClick;

            return (
              <button
                key={bed.id}
                onClick={() => isClickable && onBedClick(bed.id)}
                disabled={!isClickable}
                className={`px-3 py-1 rounded-sm border-2 text-sm transition-all ${
                  isSelected
                    ? "bg-blue-100 text-blue-800 border-blue-400 ring-2 ring-blue-300 font-semibold"
                    : bed.isAvailable && !isBlocked
                      ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-200 hover:border-green-300 cursor-pointer"
                      : "bg-red-100 text-red-800 border-red-200 cursor-not-allowed"
                }`}
              >
                {bed.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Modalità navigazione tra notti
  const currentNight = availabilityByNight[selectedNightIndex];
  const currentDate = currentNight?.date
    ? new Date(currentNight.date)
    : new Date();

  // Trova la stanza corrente nei dati della notte selezionata
  const currentRoom = currentNight?.rooms.find(
    (room) => room.roomId === roomId,
  );

  // Se non troviamo la stanza, fallback alla visualizzazione standard
  if (!currentRoom) {
    const bedsWithAvailability: Bed[] = sortBedsByNumber(
      allBeds.map((bed) => {
        const isAvailable = availableBeds.some(
          (availableBed) => availableBed.id === bed.id,
        );
        return {
          id: bed.id,
          name: bed.name,
          isAvailable,
        };
      }),
    );

    if (bedsWithAvailability.length === 0) {
      return <div className="p-4 text-gray-500">{t("bedMap.noInfo")}</div>;
    }

    return (
      <div className="p-4 space-y-4">
        <div className="text-sm text-gray-600 mb-2">
          <strong>{t("bedMap.title")}</strong>{" "}
          <span className="px-3 py-1 rounded-sm border-2 text-sm bg-green-100 text-green-800 border-green-200">
            {t("bedMap.free")}
          </span>{" "}
          <span className="px-3 py-1 rounded-sm border-2 text-sm bg-blue-100 text-blue-800 border-blue-200">
            Selezionato
          </span>{" "}
          <span className="px-3 py-1 rounded-sm border-2 text-sm bg-red-100 text-red-800 border-red-200">
            {t("bedMap.occupied")}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {bedsWithAvailability.map((bed) => {
            const isSelected = selectedBedIds.includes(bed.id.toString());
            const isBlocked = blockedBedIds.includes(bed.id.toString());
            const isClickable =
              (bed.isAvailable || isSelected) && !isBlocked && onBedClick;

            return (
              <button
                key={bed.id}
                onClick={() => isClickable && onBedClick(bed.id)}
                disabled={!isClickable}
                className={`px-3 py-1 rounded-sm border-2 text-sm transition-all ${
                  isSelected
                    ? "bg-blue-100 text-blue-800 border-blue-400 ring-2 ring-blue-300"
                    : bed.isAvailable && !isBlocked
                      ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-200 hover:border-green-300 cursor-pointer"
                      : "bg-red-100 text-red-800 border-red-200 cursor-not-allowed"
                }`}
              >
                {bed.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Visualizzazione con navigazione tra notti
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedNightIndex((prev) => Math.max(0, prev - 1))}
          disabled={selectedNightIndex === 0}
          className={`${
            selectedNightIndex === 0
              ? ""
              : "bg-gray-100 hover:bg-gray-200 border-gray-300"
          }`}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="text-center">
          <span className="text-base font-semibold">
            {t("bedMap.nightOf", {
              date: format(currentDate, "d MMMM yyyy", { locale: it }),
            })}
          </span>
          <span className="text-xs text-gray-500 block">
            {t("bedMap.nightIndex", {
              current: selectedNightIndex + 1,
              total: availabilityByNight.length,
            })}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setSelectedNightIndex((prev) =>
              Math.min(availabilityByNight.length - 1, prev + 1),
            )
          }
          disabled={selectedNightIndex === availabilityByNight.length - 1}
          className={`${
            selectedNightIndex === availabilityByNight.length - 1
              ? ""
              : "bg-gray-100 hover:bg-gray-200 border-gray-300"
          }`}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="text-sm text-gray-600 mb-2">
        <strong>{t("bedMap.title")}</strong>{" "}
        <span className="px-3 py-1 rounded-sm border-2 text-sm bg-green-100 text-green-800 border-green-200">
          {t("bedMap.free")}
        </span>{" "}
        <span className="px-3 py-1 rounded-sm border-2 text-sm bg-blue-100 text-blue-800 border-blue-200">
          Selezionato
        </span>{" "}
        <span className="px-3 py-1 rounded-sm border-2 text-sm bg-red-100 text-red-800 border-red-200">
          {t("bedMap.occupied")}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {sortBedsByNumber(currentRoom.allBeds).map((bed) => {
          const isSelected = selectedBedIds.includes(bed.id.toString());
          const isBlocked = blockedBedIds.includes(bed.id.toString());
          const isClickable =
            (bed.isAvailable || isSelected) && !isBlocked && onBedClick;

          return (
            <button
              key={bed.id}
              onClick={() => isClickable && onBedClick(bed.id)}
              disabled={!isClickable}
              className={`px-3 py-1 rounded-sm border-2 text-sm transition-all ${
                isSelected
                  ? "bg-blue-100 text-blue-800 border-blue-400 ring-2 ring-blue-300"
                  : bed.isAvailable && !isBlocked
                    ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-200 hover:border-green-300 cursor-pointer"
                    : "bg-red-100 text-red-800 border-red-200 cursor-not-allowed"
              }`}
            >
              {bed.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BedMap;
