"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminChangeUserPassword() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!email) {
      setError("Inserisci l'email dell'utente");
      return;
    }

    if (newPassword.length < 6) {
      setError("La password deve contenere almeno 6 caratteri");
      return;
    }

    try {
      setLoading(true);
      
      // Use the new API endpoint without authorization checks
      const response = await fetch('/api/cambia-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, newPassword }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Si è verificato un errore");
      }
      
      setSuccess(true);
      setNewPassword("");
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : "Si è verificato un errore durante il cambio password";
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-white p-6 shadow-md">
        <h1 className="text-2xl font-bold text-center">Cambia Password Utente</h1>
        <p className="text-center text-gray-500">Interfaccia amministrativa</p>
        
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert className="bg-green-50 text-green-800 border-green-200">
            <AlertDescription>Password modificata con successo!</AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email Utente
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="email@esempio.com"
            />
          </div>
          
          <div className="space-y-1">
            <label htmlFor="new-password" className="text-sm font-medium">
              Nuova Password
            </label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
          >
            {loading ? "Modificando..." : "Cambia Password"}
          </Button>
        </form>
        
        <div className="text-center text-sm">
          <button 
            onClick={() => router.push('/admin')}
            className="text-blue-600 hover:underline"
          >
            Torna al pannello Admin
          </button>
        </div>
      </div>
    </div>
  );
}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 