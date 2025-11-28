'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MaintenanceGateProps {
  children: React.ReactNode;
}

// Traduzioni multilingua
const translations = {
  it: {
    title: 'Sito in Manutenzione',
    message: 'Stiamo effettuando aggiornamenti. Torneremo online a breve.',
  },
  en: {
    title: 'Site Under Maintenance',
    message: 'We are performing updates. We will be back online shortly.',
  },
  de: {
    title: 'Seite in Wartung',
    message: 'Wir führen Aktualisierungen durch. Wir sind in Kürze wieder online.',
  },
  fr: {
    title: 'Site en Maintenance',
    message: 'Nous effectuons des mises à jour. Nous serons bientôt de retour.',
  },
  es: {
    title: 'Sitio en Mantenimiento',
    message: 'Estamos realizando actualizaciones. Volveremos pronto.',
  },
};

export default function MaintenanceGate({ children }: MaintenanceGateProps) {
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if user already has bypass cookie
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const res = await fetch('/api/maintenance/check');
        const data = await res.json();
        setIsAllowed(data.allowed);
      } catch {
        setIsAllowed(false);
      }
    };
    checkAccess();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/maintenance/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (data.success) {
        setIsAllowed(true);
      } else {
        setError('Password non corretta');
      }
    } catch {
      setError('Errore di connessione');
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isAllowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-black text-lg">...</div>
      </div>
    );
  }

  // User is allowed - render children
  if (isAllowed) {
    return <>{children}</>;
  }

  // Maintenance page - Black & White, multilingual
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="max-w-lg w-full text-center">

        {/* Multilingual messages */}
        <div className="space-y-6 mb-12">
          {Object.entries(translations).map(([lang, text]) => (
            <div key={lang} className="border-b border-gray-100 pb-4 last:border-0">
              <h1 className="text-xl font-semibold text-black tracking-tight">
                {text.title}
              </h1>
              <p className="mt-1 text-gray-600 text-sm">
                {text.message}
              </p>
            </div>
          ))}
        </div>

        {/* Rifugio name */}
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-8">
          Rifugio Angelo Dibona
        </p>

        {/* Staff access - minimal */}
        <div className="border-t border-gray-200 pt-8">
          <form onSubmit={handleSubmit} className="max-w-xs mx-auto space-y-3">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Staff"
              className="text-center border-gray-300 focus:border-black focus:ring-black"
              autoComplete="off"
            />
            
            {error && (
              <p className="text-red-500 text-xs">{error}</p>
            )}

            <Button 
              type="submit" 
              variant="outline"
              className="w-full border-black text-black hover:bg-black hover:text-white transition-colors"
              disabled={isLoading || !password}
            >
              {isLoading ? '...' : '→'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

