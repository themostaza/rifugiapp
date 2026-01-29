import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Clock, Info, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";

interface GuestType {
  id: number;
  description: string;
  ageFrom: number;
  ageTo: number;
  salePercent: number;
  title: string;
  cityTax: boolean;
  cityTaxPrice: number;
}

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
  countdown: number | null;
  bookingDetails: {
    checkIn: string;
    checkOut: string;
    accommodation: string;
    rooms: Array<{
      name: string;
      guests: string;
      beds: Array<{
        description: string;
        price: number;
        guestType?: "adult" | "child" | "infant";
        originalPrice?: number;
      }>;
      privacy: number;
    }>;
    additionalServices: number;
    cityTax: number;
  };
  guestTypes?: GuestType[];
  onProceedToCheckout: () => void;
  onTimeUp?: () => void;
}

const CartItem = ({
  title,
  subtitle,
  price,
  originalPrice,
  discount = 0,
}: {
  title: string;
  subtitle?: string;
  price: string | number;
  originalPrice?: number;
  editable?: boolean;
  discount?: number;
}) => (
  <div className="flex justify-between items-start py-2">
    <div className="space-y-1">
      <h3 className="font-medium text-gray-900">{title}</h3>
      {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
    </div>
    <div className="flex items-center gap-2">
      <div className="text-right">
        {/* Conditionally render price and currency symbol */}
        {price !== "" && (
          <span className="font-medium">
            €{typeof price === "number" ? price.toFixed(2) : price}
          </span>
        )}

        {discount > 0 && originalPrice && (
          <div className="text-sm text-green-600">
            Sconto {discount}%{" "}
            <span className="line-through text-gray-400">
              €{originalPrice.toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  </div>
);

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const Cart: React.FC<CartProps> = ({
  isOpen,
  onClose,
  countdown,
  bookingDetails,
  guestTypes,
  // onProceedToCheckout,
  onTimeUp,
}) => {
  const router = useRouter();
  const [showTimeUpDialog, setShowTimeUpDialog] = useState(false);

  // Monitora il countdown
  useEffect(() => {
    if (countdown === 0 && !showTimeUpDialog) {
      setShowTimeUpDialog(true);
      onTimeUp?.();
    }
  }, [countdown, showTimeUpDialog, onTimeUp]);

  const handleReloadPage = () => {
    window.location.href = "/";
  };

  // Calculate subtotal (beds + privacy)
  const subtotal = bookingDetails.rooms.reduce(
    (acc, room) =>
      acc + room.beds.reduce((sum, bed) => sum + bed.price, 0) + room.privacy,
    0,
  );

  // Total with additional services and city tax
  const total =
    subtotal + bookingDetails.additionalServices + bookingDetails.cityTax;

  // This component needs to be updated to receive the latest additionalServices value
  // from the CheckoutPage component. Currently, it's not re-rendering when services change
  // in the CheckoutPage because the bookingDetails.additionalServices value isn't being updated.

  // To fix this:
  // 1. Make sure the CheckoutPage updates the bookingDetails.additionalServices when services change
  // 2. Pass the updated bookingDetails to this Cart component
  // 3. Ensure this component re-renders when the props change

  return (
    <>
      {/* Dark overlay */}
      <div
        className={`fixed inset-0 bg-black/70 transition-opacity ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        } z-40`}
        onClick={onClose}
      />

      {/* Cart panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-md transform ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } transition-transform duration-300 ease-in-out bg-white shadow-lg z-50`}
      >
        <div className="absolute top-4 right-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-full overflow-y-auto pb-20">
          <Card className="border-0 shadow-none h-full">
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Carrello</h2>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span className="text-base">
                    {countdown ? formatTime(countdown) : "--:--"} per completare
                    l&apos;acquisto
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="">
                  <h3 className="font-medium">
                    {bookingDetails.checkIn} - {bookingDetails.checkOut}
                  </h3>
                  <p className="text-gray-600">
                    {bookingDetails.accommodation}
                  </p>
                </div>

                {bookingDetails.rooms.map((room, index) => (
                  <div key={index} className="space-y-2 mt-4">
                    <CartItem
                      title={room.name}
                      subtitle={`Ospiti: ${room.guests}`}
                      price=""
                    />

                    {room.beds.map((bed, bedIndex) => {
                      // Determine discount percentage based on bed guest type
                      let discountPercent = 0;
                      if (bed.guestType && guestTypes) {
                        const guestTypeInfo = guestTypes.find((type) => {
                          if (bed.guestType === "adult")
                            return type.title === "Adulti";
                          if (bed.guestType === "child")
                            return type.title === "Bambini";
                          if (bed.guestType === "infant")
                            return type.title === "Neonati";
                          return false;
                        });

                        discountPercent = guestTypeInfo?.salePercent || 0;
                      }

                      return (
                        <CartItem
                          key={bedIndex}
                          title={bed.description}
                          price={bed.price}
                          originalPrice={bed.originalPrice}
                          discount={discountPercent}
                          editable={false}
                        />
                      );
                    })}

                    {room.privacy > 0 && (
                      <CartItem
                        title="Supplemento privacy"
                        subtitle="Blocco letti per maggiore privacy"
                        price={room.privacy}
                        editable={false}
                      />
                    )}
                  </div>
                ))}

                <div className="space-y-2 mt-6">
                  <Separator className="my-4" />

                  <CartItem
                    title="Subtotale"
                    price={subtotal}
                    editable={false}
                  />

                  {bookingDetails.additionalServices > 0 && (
                    <CartItem
                      title="Servizi aggiuntivi"
                      subtitle=""
                      price={bookingDetails.additionalServices}
                      editable={false}
                    />
                  )}

                  {bookingDetails.cityTax > 0 && (
                    <div className="flex justify-between items-center py-2">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Tassa di soggiorno</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="w-4 h-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Tassa di soggiorno applicata per legge</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <span className="font-medium">
                        €{bookingDetails.cityTax.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center font-semibold">
                <span>Totale (IVA incl.)</span>
                <span>€{total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Time Up Dialog */}
      <Dialog open={showTimeUpDialog} onOpenChange={setShowTimeUpDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tempo scaduto</DialogTitle>
            <DialogDescription>
              Il tempo a disposizione per completare la prenotazione è scaduto.
              La pagina verrà ricaricata per permetterti di effettuare una nuova
              ricerca.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleReloadPage}>Ricarica pagina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Cart;
