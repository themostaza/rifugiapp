import React, { useState, useEffect, useCallback } from 'react';
import { Lock, ChevronRight, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from '@/lib/supabase';

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

interface BedBlockingProps {
  roomId: number;
  nightAvailability: NightAvailability[];
  selectedGuests: Guest[];
  onPrivacyCostChange: (roomId: number, cost: number) => void;
  checkIn?: Date;
  checkOut?: Date;
  onBlockedBedsChange: (roomId: number, blockedBedsData: { [date: string]: number[] }) => void;
  t: (key: string, vars?: Record<string, unknown>) => string;
}

interface BedBlockPricing {
  id: number;
  description: string;
  price: number;
}

const BedBlocking: React.FC<BedBlockingProps> = ({
  roomId,
  nightAvailability,
  selectedGuests,
  onPrivacyCostChange,
  checkIn,
  checkOut,
  onBlockedBedsChange,
  t
}) => {
  const [blockedBeds, setBlockedBeds] = useState<{[date: string]: number[]}>({});
  const [pricingData, setPricingData] = useState<BedBlockPricing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
//   // Log props for debugging
//   console.log("BedBlocking props:", {
//     roomId,
//     nightAvailabilityLength: nightAvailability?.length || 0,
//     selectedGuests: selectedGuests?.length || 0,
//     checkIn,
//     checkOut
//   });

  // Fetch bed blocking pricing from Supabase
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('BedBlock')
          .select('*')
          .order('price', { ascending: true });

        if (error) throw error;
        console.log("Fetched pricing data:", data);
        setPricingData(data || []);
      } catch (err) {
        console.error('Error fetching bed block pricing:', err);
        setError('Impossibile caricare i prezzi per il blocco letti');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPricing();
  }, []);

  // Filter availability to only include dates between checkIn and checkOut
  const filteredAvailability = nightAvailability?.filter(night => {
    if (!checkIn || !checkOut) return true;
    
    const nightDate = new Date(night.date);
    return nightDate >= checkIn && nightDate < checkOut;
  }) || [];

  // Get beds that can be blocked for a specific night (available but not assigned to guests)
  const getBlockableBeds = (date: string) => {
    // Find this room's availability for this night
    const nightData = filteredAvailability.find(night => night.date === date);
    if (!nightData) return [];

    const roomAvailability = nightData.rooms.find(room => room.roomId === roomId);
    if (!roomAvailability) return [];
    
    // Get beds that are available for this night
    const availableBedIds = roomAvailability.availableBeds.map(bed => bed.id);
    
    // Get beds that are already assigned to guests for this room
    const assignedBedIds = selectedGuests
      .filter(guest => guest.roomId === roomId && guest.bedId)
      .map(guest => Number(guest.bedId));
    
    // Return beds that are available but not assigned to guests
    return roomAvailability.allBeds
      .filter(bed => 
        bed.isAvailable && 
        availableBedIds.includes(bed.id) && 
        !assignedBedIds.includes(bed.id)
      );
  };

  // Handle bed selection in dialog
  const handleBedSelection = (date: string, bedId: number, isChecked: boolean) => {
    setBlockedBeds(prev => {
      const currentBlocked = [...(prev[date] || [])];
      
      if (isChecked) {
        // Add bed to blocked list if not already there
        if (!currentBlocked.includes(bedId)) {
          return { ...prev, [date]: [...currentBlocked, bedId] };
        }
      } else {
        // Remove bed from blocked list
        return { 
          ...prev, 
          [date]: currentBlocked.filter(id => id !== bedId) 
        };
      }
      
      return prev;
    });
  };

  // Calculate price for blocking beds using progressive pricing
  const calculateBlockingPrice = (date: string) => {
    const blockedBedsForDate = blockedBeds[date] || [];
    if (blockedBedsForDate.length === 0 || pricingData.length === 0) return 0;
    
    let totalPrice = 0;
    
    // Apply progressive pricing from the pricing table
    // Each blocked bed gets the corresponding price from the pricing table
    // in order of increasing price
    for (let i = 0; i < blockedBedsForDate.length; i++) {
      // Get the appropriate price tier, using the last one if we exceed the number of pricing tiers
      const priceTier = i < pricingData.length 
        ? pricingData[i].price 
        : pricingData[pricingData.length - 1].price;
      
      totalPrice += priceTier;
    }
    
    return totalPrice;
  };

  // Calculate total privacy cost
  const calculateTotalPrivacyCost = useCallback(() => {
    if (!pricingData.length) return 0;
    
    return Object.keys(blockedBeds).reduce(
      (total, date) => total + calculateBlockingPrice(date), 
      0
    );
  }, [blockedBeds, pricingData]);

  // Update parent component with privacy cost and detailed blocked beds
  useEffect(() => {
    const cost = calculateTotalPrivacyCost();
    onPrivacyCostChange(roomId, cost);
    // Chiama il nuovo callback con i dati dettagliati
    onBlockedBedsChange(roomId, blockedBeds);
  }, [blockedBeds, roomId, onPrivacyCostChange, calculateTotalPrivacyCost, onBlockedBedsChange]);

  // Format date for display (e.g., "26/06")
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  // Get description of blocked beds for a date
  const getBlockedBedsDescription = (date: string) => {
    const blockedBedsForDate = blockedBeds[date] || [];
    const count = blockedBedsForDate.length;
    if (count === 0) return t('bedBlocking.noneBlocked');
    if (count === 1) return t('bedBlocking.oneBlocked');
    return t('bedBlocking.manyBlocked', { count });
  }

  if (isLoading) {
    return <div className="py-2 text-gray-500">{t('bedBlocking.loading')}</div>;
  }

  if (error) {
    return <div className="py-2 text-red-500">{t('bedBlocking.error')}</div>;
  }

  if (filteredAvailability.length === 0) {
    return <div className="py-2 text-gray-500">{t('bedBlocking.noAvailability')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Lock className="h-4 w-4 text-gray-700" />
        <h3 className="font-medium text-sm sm:text-base">{t('bedBlocking.privacySupplement')}</h3>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1">
                <Info className="h-4 w-4 text-gray-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-sm">
              <p>{t('bedBlocking.tooltip')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
        <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
          {t('bedBlocking.paragraph')}
        </p>

        <div className="space-y-2">
          {filteredAvailability.map(night => {
            const date = night.date;
            const blockableBeds = getBlockableBeds(date);
            const blockedBedsForDate = blockedBeds[date] || [];
            const nightPrice = calculateBlockingPrice(date);
            
            return (
              <div 
                key={date} 
                className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 bg-white rounded-lg border hover:border-gray-300 gap-2 sm:gap-0"
              >
                <div className="font-medium text-sm sm:text-base">
                  {t('bedBlocking.nightOf', { date: formatDate(date) })}
                </div>
                
                <Dialog onOpenChange={() => {
                 
                }}>
                  <DialogTrigger asChild>
                    <Button 
                      variant={blockedBedsForDate.length > 0 ? "secondary" : "outline"} 
                      size="sm"
                      className={`flex items-center justify-between w-full sm:w-auto min-w-40 text-sm ${
                        blockedBedsForDate.length > 0 ? "bg-gray-50 text-gray-600 hover:bg-blue-100" : ""
                      }`}
                    >
                      <span>{getBlockedBedsDescription(date)}</span>
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-lg sm:text-xl">{t('bedBlocking.blockBedsNight', { date: formatDate(date) })}</DialogTitle>
                    </DialogHeader>
                    
                    {blockableBeds.length > 0 ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-2 sm:gap-3 max-h-[60vh] overflow-y-auto">
                          {blockableBeds.map(bed => {
                            const isBlocked = blockedBedsForDate.includes(bed.id);
                            
                            const position = isBlocked 
                              ? blockedBedsForDate.indexOf(bed.id)
                              : blockedBedsForDate.length;
                            
                            const priceTier = position < pricingData.length 
                              ? pricingData[position] 
                              : pricingData[pricingData.length - 1];
                            
                            const bedPrice = priceTier?.price || 0;
                            
                            return (
                              <div 
                                key={bed.id} 
                                className={`
                                  p-2 sm:p-3 rounded-lg border flex items-center justify-between
                                  ${isBlocked ? 'bg-blue-50 border-gray-200' : 'bg-white'}
                                  hover:border-blue-300 cursor-pointer transition-colors
                                `}
                                onClick={() => handleBedSelection(date, bed.id, !isBlocked)}
                              >
                                <div className="flex items-center gap-2">
                                  <Checkbox 
                                    checked={isBlocked}
                                    onCheckedChange={(checked: boolean) => {
                                      handleBedSelection(date, bed.id, checked === true);
                                    }}
                                    id={`bed-${date}-${bed.id}`}
                                  />
                                  <label 
                                    htmlFor={`bed-${date}-${bed.id}`}
                                    className="cursor-pointer text-sm sm:text-base"
                                  >
                                    {bed.name}
                                  </label>
                                </div>
                                <span className="text-xs sm:text-sm font-medium">€{bedPrice.toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                        
                        <div className="flex justify-between pt-3 border-t">
                          <span className="font-medium text-sm sm:text-base">{t('bedBlocking.totalForNight')}</span>
                          <span className="font-bold text-sm sm:text-base">€{nightPrice.toFixed(2)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 sm:p-4 bg-yellow-50 rounded-lg text-yellow-800 text-sm sm:text-base">
                        {t('bedBlocking.noBedsToBlock')}
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
                
                <div className="font-medium text-sm sm:text-base text-right">
                  {nightPrice > 0 && `€${nightPrice.toFixed(2)}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BedBlocking;