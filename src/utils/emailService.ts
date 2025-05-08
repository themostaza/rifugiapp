// Helper function to convert simple HTML to plain text
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, ' ');
  // Decode HTML entities
  text = text.replace(/&nbsp;/gi, ' ')
             .replace(/&amp;/gi, '&')
             .replace(/&quot;/gi, '"')
             .replace(/&lt;/gi, '<')
             .replace(/&gt;/gi, '>')
             .replace(/&apos;/gi, "'");
  // Normalize whitespace
  text = text.replace(/\s\s+/g, ' ').trim();
  text = text.replace(/\n\s*\n/g, '\n\n');
  return text;
}

// Helper function to send booking confirmation email AFTER successful payment
export async function sendPaymentSuccessEmail(
  to: string,
  bookingDetails: {
    name?: string;
    checkIn: string;
    checkOut: string;
    external_id: string;
    // Potremmo aggiungere altri dettagli se necessario, es. totalAmount
  }
) {
  const subject = 'Pagamento Confermato - La tua prenotazione al Rifugio Di Bona è attiva!';
  const bookingUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/cart/${bookingDetails.external_id}`;
  
  const htmlBody = `
    <h1>Pagamento Confermato e Prenotazione Attiva!</h1>
    <p>Ciao ${bookingDetails.name || 'Ospite'},</p>
    <p>Il tuo pagamento è stato ricevuto con successo e la tua prenotazione presso il Rifugio Di Bona è ora definitivamente confermata.</p>
    <p><strong>Dettagli della prenotazione:</strong></p>
    <ul>
      <li>Check-in: ${new Date(bookingDetails.checkIn).toLocaleDateString('it-IT')}</li>
      <li>Check-out: ${new Date(bookingDetails.checkOut).toLocaleDateString('it-IT')}</li>
    </ul>
    <p>Puoi visualizzare i dettagli della tua prenotazione al seguente link:</p>
    <p><a href="${bookingUrl}">${bookingUrl}</a></p>
    <p>Grazie per aver scelto il Rifugio Di Bona!</p>
  `;
  const plainTextBody = htmlToPlainText(htmlBody);

  // Idealmente, l'URL dell'API send-email dovrebbe essere una costante o variabile d'ambiente
  const sendEmailApiPath = '/api/send-email'; 
  try {
    // Assicurati che NEXT_PUBLIC_BASE_URL sia configurato correttamente in produzione e sviluppo
    const fetchUrl = process.env.NEXT_PUBLIC_BASE_URL 
      ? `${process.env.NEXT_PUBLIC_BASE_URL}${sendEmailApiPath}` 
      : sendEmailApiPath; // Fallback se NEXT_PUBLIC_BASE_URL non è definito (es. test locali senza env completo)

    console.log('[emailService:sendPaymentSuccessEmail] Attempting to call send-email API at URL:', fetchUrl);
    console.log('[emailService:sendPaymentSuccessEmail] Email payload:', { to, subject, bookingExternalId: bookingDetails.external_id });


    const emailPayload = { 
      to, 
      subject, 
      html: htmlBody, 
      text: plainTextBody 
    };
    const emailResponse = await fetch(fetchUrl, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(emailPayload) 
    });

    if (!emailResponse.ok) {
      const errorBodyText = await emailResponse.text(); // Leggi come testo per debug
      console.error(`Failed to send payment success email to ${to} via ${sendEmailApiPath}. Status: ${emailResponse.status}. Body: ${errorBodyText}`);
      // Considera un meccanismo di notifica admin più robusto qui se l'invio email è critico
      return false;
    }
    console.log(`Payment success email sent successfully to ${to} with subject: ${subject}`);
    return true;
  } catch (emailError) {
    console.error(`Exception while sending payment success email to ${to} via ${sendEmailApiPath}:`, emailError);
    return false;
  }
} 