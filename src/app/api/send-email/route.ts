import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// Inizializza Resend con la chiave API dall'environment variable
const resend = new Resend(process.env.RESEND);

export async function POST(request: NextRequest) {
  try {
    // Estrai i dati dalla richiesta
    const { to, subject, text } = await request.json();

    // Validazione dei dati
    if (!to || !subject || !text) {
      return NextResponse.json(
        { error: 'Destinatario, oggetto e testo sono obbligatori' },
        { status: 400 }
      );
    }

    // Invia l'email
    const data = await resend.emails.send({
      from: 'Rifugio Di Bona <noreply@yourdomain.com>', // Sostituisci con il tuo dominio verificato
      to: [to],
      subject: subject,
      text: text,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Errore nell\'invio dell\'email:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'invio dell\'email' },
      { status: 500 }
    );
  }
} 