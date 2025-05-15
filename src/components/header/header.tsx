import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from 'next/navigation';

interface HeaderProps {
  language: string;
  onLanguageChange: (language: string) => void;
}

const Header: React.FC<HeaderProps> = ({ language, onLanguageChange }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [currentLanguage, setCurrentLanguage] = useState(language);

  // Determina la lingua corrente dal path
  useEffect(() => {
    const localeMatch = pathname?.match(/^\/([a-z]{2})(?:\/|$)/);
    if (localeMatch && ['it', 'en', 'de', 'fr', 'es'].includes(localeMatch[1])) {
      setCurrentLanguage(localeMatch[1]);
    }
  }, [pathname]);

  const handleLanguageChange = (newLanguage: string) => {
    // Aggiorna lo stato locale
    setCurrentLanguage(newLanguage);
    
    // Chiama la callback esterna se necessario
    onLanguageChange(newLanguage);
    
    // Se siamo in un percorso localizzato, aggiorna l'URL
    if (pathname) {
      const localeMatch = pathname.match(/^\/([a-z]{2})(?:\/|$)/);
      if (localeMatch) {
        // Sostituisci il locale corrente con quello nuovo
        const newPath = pathname.replace(/^\/[a-z]{2}/, `/${newLanguage}`);
        router.push(newPath);
      }
    }
  };

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 text-left sm:text-left">Booking - Rifugio A. Dibona</h1>
        <div className="flex items-center justify-start sm:justify-end gap-2">
          <Select value={currentLanguage} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-[120px]">
              <Languages className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Seleziona lingua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="it">Italiano</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="de">Deutsch</SelectItem>
              <SelectItem value="fr">Français</SelectItem>
              <SelectItem value="es">Español</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </header>
  );
};

export default Header;