"use client";
import { useState } from "react";

// Tipi per la risposta di verifica
interface StripeLogMeta {
  refunded?: boolean;
  payment_intent?: string;
  amount?: number;
  created?: number;
  billing_details?: { email?: string };
  receipt_email?: string;
  id?: string;
}

interface StripeLogEntry {
  id: number;
  stripe_id: string;
  meta: StripeLogMeta | null;
  status: string;
  transaction_type: string;
}

interface VerifyResult {
  total: number;
  statusCount: Record<string, number>;
  typeCount: Record<string, number>;
  refundedCount: number;
  matchCount: number;
  missingCount: number;
  noPaymentIntentCount: number;
  matches: StripeLogEntry[];
  missing: StripeLogEntry[];
  noPaymentIntent: StripeLogEntry[];
  debugLogs: string[];
  error?: string;
}

export default function StripeSyncPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | { success?: boolean; inserted?: number; error?: string }>(null);

  // Stato per la verifica
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/stripe-sync");
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: "Errore di rete o server" });
    } finally {
      setLoading(false);
    }
  };

  // Funzione per la verifica
  const handleVerify = async () => {
    setVerifyLoading(true);
    setVerifyResult(null);
    try {
      const res = await fetch("/api/stripe-sync/verify");
      const data = await res.json();
      setVerifyResult(data);
    } catch {
      setVerifyResult({ error: "Errore di rete o server" } as VerifyResult);
    } finally {
      setVerifyLoading(false);
    }
  };

  // Funzione di utilità per trovare il BasketID dato un payment_intent
  function getBasketId(paymentIntent: string) {
    if (!verifyResult || !verifyResult.matches) return '-';
    const match = verifyResult.matches.find((row) => (row.meta?.payment_intent || '').trim() === paymentIntent);
    if (match) {
      // Trova il BasketID dal debugLog se presente
      const debug = (verifyResult.debugLogs || []).find((log) => log.includes(`[MATCH]`) && log.includes(`payment_intent: '${paymentIntent}'`));
      if (debug) {
        const m = debug.match(/BasketID: (\d+|unknown)/);
        if (m) return m[1];
      }
    }
    // Prova anche tra i missing
    const missing = verifyResult.missing.find((row) => (row.meta?.payment_intent || '').trim() === paymentIntent);
    if (missing) return '-';
    return '-';
  }

  return (
    <div style={{ maxWidth: '100%', margin: "2rem auto", padding: 24, border: "1px solid #eee", borderRadius: 8 }}>
      <h2>Stripe Sync</h2>
      <button
        onClick={handleSync}
        disabled={loading}
        style={{ padding: "0.5rem 1.5rem", fontSize: 18, borderRadius: 6, background: "#635bff", color: "white", border: "none", cursor: loading ? "not-allowed" : "pointer" }}
      >
        {loading ? "Sincronizzazione in corso..." : "Avvia Sync Stripe"}
      </button>
      {result && (
        <div style={{ marginTop: 24 }}>
          {result.success ? (
            <div style={{ color: "green" }}>
              Sync completata!<br />
              Transazioni inserite: <b>{result.inserted}</b>
            </div>
          ) : (
            <div style={{ color: "red" }}>
              Errore: {result.error || "Errore sconosciuto"}
            </div>
          )}
        </div>
      )}

      {/* SEZIONE VERIFICA */}
      <hr style={{ margin: '32px 0' }} />
      <h2>Verifica completa Stripe_log</h2>
      <button
        onClick={handleVerify}
        disabled={verifyLoading}
        style={{ padding: "0.5rem 1.5rem", fontSize: 18, borderRadius: 6, background: "#ffb300", color: "black", border: "none", cursor: verifyLoading ? "not-allowed" : "pointer" }}
      >
        {verifyLoading ? "Verifica in corso..." : "Verifica tutte le transazioni Stripe"}
      </button>
      {verifyResult && (
        <div style={{ marginTop: 24 }}>
          {verifyResult.error ? (
            <div style={{ color: "red" }}>Errore: {verifyResult.error}</div>
          ) : (
            <div>
              <div style={{ marginBottom: 16 }}>
                <b>Totale transazioni in Stripe_log:</b> {verifyResult.total}<br />
                <b>Conteggio per status:</b> {Object.entries(verifyResult.statusCount || {}).map(([k, v]) => `${k}: ${v}`).join(' | ')}<br />
                <b>Conteggio per tipo:</b> {Object.entries(verifyResult.typeCount || {}).map(([k, v]) => `${k}: ${v}`).join(' | ')}<br />
                <b>Transazioni refunded:</b> {verifyResult.refundedCount}<br />
                <b>Con payment_intent match in Basket:</b> {verifyResult.matchCount}<br />
                <b>Con payment_intent NON in Basket:</b> {verifyResult.missingCount}<br />
                <b>Senza payment_intent:</b> {verifyResult.noPaymentIntentCount}
              </div>

              {/* Tabella dettagliata di tutte le transazioni */}
              <details style={{ marginBottom: 24 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 16 }}>Vedi tutte le transazioni Stripe_log</summary>
                <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #eee', borderRadius: 4, marginTop: 8 }}>
                  <table style={{ width: '100%', fontSize: 14 }}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Status</th>
                        <th>Tipo</th>
                        <th>Refunded</th>
                        <th>Payment Intent</th>
                        <th>Basket ID</th>
                        <th>Importo</th>
                        <th>Data</th>
                        <th>Match Basket</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verifyResult.matches && verifyResult.matches.map((row, i) => (
                        <tr key={row.id || i} style={{ background: '#e6ffe6' }}>
                          <td>{row.stripe_id || '-'}</td>
                          <td>{row.status}</td>
                          <td>{row.transaction_type}</td>
                          <td>{row.meta?.refunded ? 'SI' : 'NO'}</td>
                          <td>{row.meta?.payment_intent || '-'}</td>
                          <td>{getBasketId((row.meta?.payment_intent || '').trim())}</td>
                          <td>{row.meta?.amount ? (row.meta.amount / 100).toFixed(2) + ' €' : '-'}</td>
                          <td>{row.meta?.created ? new Date(row.meta.created * 1000).toLocaleString() : '-'}</td>
                          <td>✔️</td>
                        </tr>
                      ))}
                      {verifyResult.missing && verifyResult.missing.map((row, i) => (
                        <tr key={row.id || i} style={{ background: '#fffbe6' }}>
                          <td>{row.stripe_id || '-'}</td>
                          <td>{row.status}</td>
                          <td>{row.transaction_type}</td>
                          <td>{row.meta?.refunded ? 'SI' : 'NO'}</td>
                          <td>{row.meta?.payment_intent || '-'}</td>
                          <td>-</td>
                          <td>{row.meta?.amount ? (row.meta.amount / 100).toFixed(2) + ' €' : '-'}</td>
                          <td>{row.meta?.created ? new Date(row.meta.created * 1000).toLocaleString() : '-'}</td>
                          <td>❌</td>
                        </tr>
                      ))}
                      {verifyResult.noPaymentIntent && verifyResult.noPaymentIntent.map((row, i) => (
                        <tr key={row.id || i} style={{ background: '#ffe6e6' }}>
                          <td>{row.stripe_id || '-'}</td>
                          <td>{row.status}</td>
                          <td>{row.transaction_type}</td>
                          <td>{row.meta?.refunded ? 'SI' : 'NO'}</td>
                          <td>-</td>
                          <td>-</td>
                          <td>{row.meta?.amount ? (row.meta.amount / 100).toFixed(2) + ' €' : '-'}</td>
                          <td>{row.meta?.created ? new Date(row.meta.created * 1000).toLocaleString() : '-'}</td>
                          <td>-</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              {/* Tabella solo per le transazioni mancanti in Basket */}
              <div style={{ fontWeight: 600, fontSize: 18, margin: '12px 0' }}>
                Numero Stripe senza Basket: {verifyResult.missingCount || 0}
              </div>
              {verifyResult.missing && verifyResult.missing.length > 0 && (
                <div style={{ maxHeight: 350, overflow: 'auto', border: '1px solid #eee', borderRadius: 4 }}>
                  <table style={{ width: '100%', minWidth: 900, fontSize: 15 }}>
                    <thead>
                      <tr>
                        <th>Payment Intent ID</th>
                        <th>Mail</th>
                        <th>Ammontare</th>
                        <th>Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verifyResult.missing.map((row, i) => (
                        <tr key={row.meta?.id || i}>
                          <td>{row.meta?.payment_intent || '-'}</td>
                          <td>{row.meta?.billing_details?.email || row.meta?.receipt_email || '-'}</td>
                          <td>{row.meta?.amount ? (row.meta.amount / 100).toFixed(2) + ' €' : '-'}</td>
                          <td>{row.meta?.created ? new Date(row.meta.created * 1000).toLocaleString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
