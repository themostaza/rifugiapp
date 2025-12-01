/**
 * Cron Job: Cleanup Expired Bookings
 * 
 * Eseguito ogni 15 minuti, cancella le prenotazioni "pending" 
 * (non pagate, non admin) create da più di 30 minuti.
 * 
 * Questo sostituisce la funzionalità di Stripe checkout.session.expired
 * per le prenotazioni Nexi.
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendBookingExpiredEmail } from '@/utils/emailService';

// Configurazione
const EXPIRATION_MINUTES = 30;
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Identifica una prenotazione "pending" (in attesa di pagamento):
 * - isPaid = false
 * - isCreatedByAdmin = false  
 * - isCancelled = false
 * - createdAt < (now - 30 minuti)
 */

export async function GET(request: Request) {
  try {
    // Verifica autorizzazione
    const authHeader = request.headers.get('authorization');
    
    if (!CRON_SECRET) {
      console.error('[Cleanup Cron] CRON_SECRET not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Vercel Cron invia il secret nell'header Authorization: Bearer <secret>
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      console.warn('[Cleanup Cron] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cleanup Cron] Starting cleanup of expired pending bookings...');

    // Calcola il timestamp di scadenza (30 minuti fa)
    const expirationTime = new Date();
    expirationTime.setMinutes(expirationTime.getMinutes() - EXPIRATION_MINUTES);
    const expirationTimestamp = expirationTime.toISOString();

    console.log(`[Cleanup Cron] Looking for pending bookings created before: ${expirationTimestamp}`);

    // Trova le prenotazioni pending scadute
    const { data: expiredBookings, error: fetchError } = await supabase
      .from('Basket')
      .select('id, external_id, name, mail, createdAt, totalPrice, dayFrom, dayTo')
      .eq('isPaid', false)
      .eq('isCreatedByAdmin', false)
      .eq('isCancelled', false)
      .lt('createdAt', expirationTimestamp);

    if (fetchError) {
      console.error('[Cleanup Cron] Error fetching expired bookings:', fetchError);
      return NextResponse.json({ error: 'Database error', details: fetchError.message }, { status: 500 });
    }

    if (!expiredBookings || expiredBookings.length === 0) {
      console.log('[Cleanup Cron] No expired pending bookings found.');
      return NextResponse.json({ 
        success: true, 
        message: 'No expired bookings to cleanup',
        count: 0 
      });
    }

    console.log(`[Cleanup Cron] Found ${expiredBookings.length} expired pending bookings`);

    // Log dei booking da cancellare
    expiredBookings.forEach(booking => {
      console.log(`[Cleanup Cron] Will cancel: ID=${booking.id}, external_id=${booking.external_id}, name=${booking.name}, createdAt=${booking.createdAt}`);
    });

    // Estrai gli ID per l'update
    const expiredIds = expiredBookings.map(b => b.id);

    // Cancella le prenotazioni scadute
    const { error: updateError } = await supabase
      .from('Basket')
      .update({ 
        isCancelled: true,
        cancellationReason: 'payment_timeout',
        updatedAt: new Date().toISOString()
      })
      .in('id', expiredIds);

    if (updateError) {
      console.error('[Cleanup Cron] Error cancelling expired bookings:', updateError);
      return NextResponse.json({ error: 'Failed to cancel bookings', details: updateError.message }, { status: 500 });
    }

    console.log(`[Cleanup Cron] Successfully cancelled ${expiredBookings.length} expired bookings`);

    // Send expiration emails to users
    const emailResults = await Promise.allSettled(
      expiredBookings
        .filter(booking => booking.mail) // Only send to bookings with email
        .map(booking => 
          sendBookingExpiredEmail(booking.mail!, {
            name: booking.name,
            checkIn: booking.dayFrom,
            checkOut: booking.dayTo,
            external_id: booking.external_id
          })
        )
    );

    const emailsSent = emailResults.filter(r => r.status === 'fulfilled' && r.value === true).length;
    const emailsFailed = emailResults.length - emailsSent;
    console.log(`[Cleanup Cron] Sent ${emailsSent} expiration emails (${emailsFailed} failed)`);

    // Restituisci un riepilogo
    return NextResponse.json({ 
      success: true, 
      message: `Cancelled ${expiredBookings.length} expired pending bookings`,
      count: expiredBookings.length,
      emailsSent,
      emailsFailed,
      cancelledBookings: expiredBookings.map(b => ({
        id: b.id,
        external_id: b.external_id,
        createdAt: b.createdAt
      }))
    });

  } catch (error) {
    console.error('[Cleanup Cron] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

