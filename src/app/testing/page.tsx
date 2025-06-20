'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

// Type for the daily email API response
interface DailyEmailResult {
  success?: boolean;
  message?: string;
  timestamp?: string;
  reservationsCount?: number;
  emailsSent?: number;
  emailsFailed?: number;
  recipients?: string[];
  pdfGenerated?: boolean;
  error?: string;
  details?: string | { recipient: string; success: boolean; error: string }[];
}

export default function TestingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DailyEmailResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testDailyEmail = async () => {
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      console.log('Calling daily email API...');
      const response = await fetch('/api/daily-email');
      const data = await response.json();
      console.log('API Response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to call API');
      }

      setResult(data);
    } catch (err) {
      console.error('Error testing daily email:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🧪 Testing Daily Email System
          </CardTitle>
          <CardDescription>
            Testa il sistema di invio email giornaliero senza aspettare il cron job
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">📧 Destinatari:</h3>
              <ul className="text-blue-800 space-y-1">
                <li>• rifugiodibona@gmail.com</li>
                <li>• paolo@larin.it</li>
              </ul>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Nota:</h3>
              <p className="text-yellow-800 text-sm">
                Questo test invierà email reali ai destinatari configurati. 
                Usa solo per testing in sviluppo!
              </p>
            </div>

            <Button 
              onClick={testDailyEmail}
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Invio in corso...
                </>
              ) : (
                <>
                  📤 Testa Invio Email Giornaliera
                </>
              )}
            </Button>
          </div>

          {/* Risultato */}
          {result && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold text-green-800">✅ Email inviate con successo!</p>
                  <div className="text-sm text-green-700 space-y-1">
                    <p>• Timestamp: {result.timestamp ? new Date(result.timestamp).toLocaleString('it-IT') : '-'}</p>
                    <p>• Prenotazioni trovate: {result.reservationsCount}</p>
                    <p>• Email inviate: {result.emailsSent}/{result.recipients?.length || 0}</p>
                    {typeof result.emailsFailed === 'number' && result.emailsFailed > 0 && (
                      <p className="text-orange-600">• Email fallite: {result.emailsFailed}</p>
                    )}
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium text-green-800">
                      Dettagli tecnici
                    </summary>
                    <pre className="mt-2 text-xs bg-green-100 p-2 rounded overflow-auto">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </details>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Errore */}
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold text-red-800">❌ Errore nell&apos;invio:</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Informazioni di sistema */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">ℹ️ Informazioni Sistema:</h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p>• Endpoint: <code className="bg-gray-200 px-1 rounded">/api/daily-email</code></p>
              <p>• Metodo: GET</p>
              <p>• Cron Schedule: 0 3 * * * (3:00 UTC = 5:00 CET)</p>
              <p>• Ambiente: {process.env.NODE_ENV === 'development' ? 'Sviluppo' : 'Produzione'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 