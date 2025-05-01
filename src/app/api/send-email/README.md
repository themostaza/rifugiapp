# API per l'invio di email con Resend

Questa API permette di inviare email di testo semplice utilizzando il servizio Resend.

## Configurazione

Assicurarsi di avere configurato correttamente la variabile d'ambiente `RESEND` nel file `.env.local` con la tua chiave API Resend:

```
RESEND=re_123456789...
```

## Utilizzo

Per inviare un'email, effettua una richiesta POST all'endpoint `/api/send-email` con il seguente payload JSON:

```json
{
  "to": "destinatario@example.com",
  "subject": "Oggetto dell'email",
  "text": "Contenuto di testo dell'email"
}
```

### Esempio di utilizzo con fetch

```javascript
async function inviaEmail(destinatario, oggetto, testo) {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: destinatario,
        subject: oggetto,
        text: testo,
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Errore durante l\'invio dell\'email');
    }
    
    return result;
  } catch (error) {
    console.error('Errore:', error);
    throw error;
  }
}
```

## Considerazioni importanti

Prima di utilizzare l'API in produzione:

1. Sostituisci `noreply@yourdomain.com` nel file `route.ts` con un dominio verificato su Resend
2. Considera l'implementazione di rate limiting per prevenire abusi
3. Valuta se aggiungere verifiche di sicurezza aggiuntive per controllare chi può inviare email 