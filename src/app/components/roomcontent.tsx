import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, Info } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import BedMap from './bedMap'
import BedBlocking from './bedblockingcomponent'
import { calculateBedPrice } from '../utils/pricing'

interface Guest {
  type: 'adult' | 'child' | 'infant';
  roomId: number | null;
  bedId: string | null;
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
    availableBeds: Array<{
      id: number;
      name: string;
    }>;
  }>;
}

interface RoomContentProps {
  room: {
    id: number;
    description: string;
    images: string[];
    availableBeds: number;
    price: {
      bb: number;
      hb: number;
    };
    allBeds?: Array<{ 
      id: number; 
      name: string;
      pricing?: {
        bb: number;
        mp: number;
      };
    }>;
    availableBedIds?: Array<{ 
      id: number; 
      name: string;
      pricing?: {
        bb: number;
        mp: number;
      };
    }>;
  };
  onSelect: (roomId: number) => void;
  unassignedGuests: {
    adults: number;
    children: number;
    infants: number;
  };
  assignedGuests: Guest[];
  onGuestAssignment: (guests: Guest[]) => void;
  pensionType: 'bb' | 'hb';
  availabilityByNight?: NightAvailability[];
  checkIn?: Date;
  checkOut?: Date;
  onPrivacyCostChange?: (roomId: number, cost: number) => void;
  guestTypes?: Array<{
    id: number;
    description: string;
    ageFrom: number;
    ageTo: number;
    salePercent: number;
    title: string;
    cityTax: boolean;
    cityTaxPrice: number;
  }>;
  onBlockedBedsChange?: (roomId: number, blockedBedsData: { [date: string]: number[] }) => void;
  blockedBedsForRoom?: { [date: string]: number[] };
  t: (key: string, vars?: Record<string, unknown>) => string;
}

const ImageCarousel = ({ images }: { images: string[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0)

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }

  const previousImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  return (
    <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
      {images.length > 0 ? (
        <img
          src={images[currentIndex]}
          alt={`Room image ${currentIndex + 1}`}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          No images available
        </div>
      )}
      {images.length > 1 && (
        <>
          <div className="absolute inset-0 flex items-center justify-between p-4">
            <Button
              variant="outline"
              size="icon"
              onClick={previousImage}
              className="bg-white/80 hover:bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={nextImage}
              className="bg-white/80 hover:bg-white"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
            {images.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === currentIndex ? 'bg-white' : 'bg-white/50'
                }`}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const BedSelection = ({ 
  guestType,
  availableCount,
  onAddGuest,
  isDisabled
}: { 
  guestType: 'adult' | 'child' | 'infant';
  availableCount: number;
  onAddGuest: () => void;
  isDisabled: boolean;
}) => {
  const labels = {
    adult: 'Adulto',
    child: 'Bambino',
    infant: 'Neonato'
  }

  return (
    <Button
      variant="outline"
      className="flex items-center gap-2"
      onClick={onAddGuest}
      disabled={isDisabled || availableCount === 0}
    >
      <Plus className="h-4 w-4" />
      Aggiungi {labels[guestType].toLowerCase()}
      {availableCount > 0 && <span className="text-sm text-gray-500">({availableCount} disponibili)</span>}
    </Button>
  )
}

const BedAssignment = ({
  guestType,
  onBedSelect,
  onDelete,
  selectedBedId,
  availableBeds,
  allBedsWithPricing,
  pensionType,
  guestTypes
}: {
  guestType: 'adult' | 'child' | 'infant';
  onBedSelect: (bedId: string) => void;
  onDelete: () => void;
  selectedBedId: string | null;
  availableBeds: string[];
  allBedsWithPricing: Array<{ 
    id: number; 
    name: string;
    pricing?: { 
      bb: number; 
      mp: number; 
    } 
  }>;
  pensionType: 'bb' | 'hb';
  guestTypes?: Array<{
    id: number;
    description: string;
    ageFrom: number;
    ageTo: number;
    salePercent: number;
    title: string;
    cityTax: boolean;
    cityTaxPrice: number;
  }>;
}) => {
  const labels = {
    adult: 'Adulto',
    child: 'Bambino',
    infant: 'Neonato'
  }

  // Use the pricing utility function
  const getPriceDetails = () => {
    if (!selectedBedId || !guestTypes) return { basePrice: 0, discountedPrice: 0, discount: 0 };
    
    const bed = allBedsWithPricing.find(bed => bed.id.toString() === selectedBedId);
    if (!bed || !bed.pricing) return { basePrice: 0, discountedPrice: 0, discount: 0 };
    
    // Convert the bed to the format expected by our utility
    const bedForCalculation = {
      id: bed.id,
      name: bed.name,
      pricing: {
        bb: bed.pricing.bb,
        mp: bed.pricing.mp
      }
    };
    
    // Use our utility to calculate the price
    const { basePrice, discountedPrice, discount } = calculateBedPrice(
      bedForCalculation,
      guestType,
      pensionType,
      guestTypes,
      1 // Just calculating for one night here for display purposes
    );
    
    return { basePrice, discountedPrice, discount };
  };
  
  const { basePrice, discountedPrice, discount } = getPriceDetails();
  const hasDiscount = discount > 0;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 py-2">
      <span className="min-w-24">{labels[guestType]}</span>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        
        <Select value={selectedBedId || ''} onValueChange={onBedSelect}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Seleziona letto" />
          </SelectTrigger>
          <SelectContent>
            {availableBeds.map((bedId) => {
              const bed = allBedsWithPricing.find(b => b.id.toString() === bedId);
              return (
                <SelectItem key={bedId} value={bedId}>
                  {bed ? bed.name : `Letto ${bedId}`}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="text-gray-500 hover:text-red-600 sm:hidden"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="text-gray-500 hover:text-red-600 hidden sm:block"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      
      {selectedBedId && (
        <div className="flex flex-col w-full sm:w-auto">
          <span className="text-gray-700 font-medium">
            €{discountedPrice.toFixed(2)} per notte
          </span>
          
          {hasDiscount && (
            <span className="text-sm text-green-600">
              Sconto {(discount * 100).toFixed(0)}% (da €{basePrice.toFixed(2)})
            </span>
          )}
        </div>
      )}
      
      
    </div>
  )
}

const RoomContent = ({ 
  room, 
  unassignedGuests,
  assignedGuests,
  onGuestAssignment,
  pensionType,
  availabilityByNight = [],
  checkIn,
  checkOut,
  onPrivacyCostChange,
  guestTypes,
  onBlockedBedsChange,
  blockedBedsForRoom = {},
  t
}: RoomContentProps) => {
  // State per tracciare i letti bloccati dall'utente per migliorare la privacy
  const allBedIds = room.availableBedIds?.map(bed => bed.id.toString()) || [];
  
  // Get currently used bed IDs in this room
  const usedBedIds = assignedGuests
    .filter(guest => guest.bedId)
    .map(guest => guest.bedId);

  // Ottieni tutti i letti bloccati per almeno una notte
  const blockedBedIds = Object.values(blockedBedsForRoom)
    .flat()
    .map(id => id.toString());

  // Calcola availableBedIds escludendo sia quelli assegnati che quelli bloccati
  const availableBedIds = allBedIds.filter(
    bedId => !usedBedIds.includes(bedId) && !blockedBedIds.includes(bedId)
  );

  const handleAddGuest = (guestType: 'adult' | 'child' | 'infant') => {
    const newGuest: Guest = {
      type: guestType,
      roomId: room.id,
      bedId: null
    };
    onGuestAssignment([...assignedGuests, newGuest]);
  };

  const handleBedSelect = (guestIndex: number, bedId: string) => {
    const updatedGuests = [...assignedGuests];
    updatedGuests[guestIndex] = {
      ...updatedGuests[guestIndex],
      bedId: bedId.toString()
    };
    onGuestAssignment(updatedGuests);

    // --- Sincronizza: se il letto era bloccato, rimuovilo dai blocchi ---
    if (onBlockedBedsChange && blockedBedsForRoom) {
      const updatedBlockedBeds = { ...blockedBedsForRoom };
      let changed = false;
      for (const date in updatedBlockedBeds) {
        if (updatedBlockedBeds[date]?.includes(Number(bedId))) {
          updatedBlockedBeds[date] = updatedBlockedBeds[date].filter(id => id !== Number(bedId));
          changed = true;
        }
      }
      if (changed) {
        onBlockedBedsChange(room.id, updatedBlockedBeds);
      }
    }
  };

  const handleDeleteGuest = (guestIndex: number) => {
    const updatedGuests = assignedGuests.filter((_, index) => index !== guestIndex);
    onGuestAssignment(updatedGuests);
  };

  const isRoomFull = assignedGuests.length >= room.availableBeds;

  return (
    <div className="space-y-6">
      <ImageCarousel images={room.images} />
      
      <div className="space-y-4">
        {/* Mappa dei letti */}
        <div className="bg-white rounded-lg sm:border">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between sm:mb-4 p-2 sm:p-4 gap-2">
            <h3 className="text-lg font-medium">Mappa dei letti</h3>
            
            {availabilityByNight.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2 w-full sm:w-auto">
                      <Info className="h-4 w-4" />
                      <span>Informazioni</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Puoi visualizzare la disponibilità per ogni notte. I letti che non sono occupati
                      possono essere bloccati per migliorare la tua privacy (costo aggiuntivo).
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          <BedMap 
            roomId={room.id} 
            allBeds={room.allBeds || []} 
            availableBeds={room.availableBedIds || []}
            availabilityByNight={availabilityByNight}
            t={t}
          />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <BedSelection 
            guestType="adult"
            availableCount={unassignedGuests.adults}
            onAddGuest={() => handleAddGuest('adult')}
            isDisabled={isRoomFull}
          />
          <BedSelection 
            guestType="child"
            availableCount={unassignedGuests.children}
            onAddGuest={() => handleAddGuest('child')}
            isDisabled={isRoomFull}
          />
          <BedSelection 
            guestType="infant"
            availableCount={unassignedGuests.infants}
            onAddGuest={() => handleAddGuest('infant')}
            isDisabled={isRoomFull}
          />
        </div>

        {assignedGuests.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium mb-2">Ospiti assegnati a questa stanza:</h4>
            <div className="space-y-3">
              {assignedGuests.map((guest, index) => (
                <BedAssignment
                  key={index}
                  guestType={guest.type}
                  selectedBedId={guest.bedId}
                  onBedSelect={(bedId) => handleBedSelect(index, bedId)}
                  onDelete={() => handleDeleteGuest(index)}
                  availableBeds={availableBedIds.concat(guest.bedId ? [guest.bedId] : [])}
                  allBedsWithPricing={room.availableBedIds || []}
                  pensionType={pensionType}
                  guestTypes={guestTypes}
                />
              ))}
            </div>
          </div>
        )}

        {/* Componente per il blocco dei letti */}
        <div className="bg-white p-4 rounded-lg border">
          <BedBlocking 
            roomId={room.id}
            nightAvailability={availabilityByNight}
            selectedGuests={assignedGuests}
            onPrivacyCostChange={onPrivacyCostChange || (() => {})}
            checkIn={checkIn}
            checkOut={checkOut}
            onBlockedBedsChange={onBlockedBedsChange || (() => {})}
            t={t}
          />
        </div>

      </div>

      {isRoomFull && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <p className="text-yellow-800">
            Non c&apos;è disponibilità di altri letti continuativi nelle date selezionate
          </p>
        </div>
      )}
    </div>
  )
}

export default RoomContent