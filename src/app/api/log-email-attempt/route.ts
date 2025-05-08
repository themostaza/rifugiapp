import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // Import Supabase client

// TODO: Import your PostgreSQL client (e.g., pg, supabase-js, prisma) <- This can be removed
// import { Pool } from 'pg'; 
// Example for node-postgres:
// const pool = new Pool({
//   connectionString: process.env.POSTGRES_URL, 
//   // Add other configurations like SSL if needed
// });

interface LogEmailRequestBody {
  subject?: string | null;
  to?: string | null;
  mail_body?: string | null;
  sent_time?: string | null; // ISO string date
  status?: string | null;
  email_id?: string | null; // From Resend
  error_message?: string | null; // To log any error messages
  error_name?: string | null; // To log any error names/types
}

export async function POST(request: NextRequest) {
  console.log('[log-email-attempt] Received POST request');
  try {
    const body = await request.json() as LogEmailRequestBody;
    console.log('[log-email-attempt] Parsed request body:', body);

    const {
      subject,
      to: recipient, // Renaming to avoid conflict with SQL keyword 'to' in destructuring
      mail_body,
      sent_time,
      status,
      email_id,
      error_message,
      error_name
    } = body;

    // Prepare data for Supabase, ensuring sent_time is a valid timestamp
    // The 'created_at' field will be handled by database default
    const dataToInsert = {
      subject: subject,
      "to": recipient, // Use quotes for the column name "to"
      mail_body: mail_body,
      // If sent_time is provided and valid, use it, otherwise use current time.
      // Supabase client expects ISO string or can handle Date object for timestamp fields.
      sent_time: sent_time ? new Date(sent_time).toISOString() : new Date().toISOString(),
      status: status,
      email_id: email_id,
      // Assuming you might add these columns to your DB table later
      // If not, you can remove them or make them conditional
      ...(error_message && { error_message }),
      ...(error_name && { error_name }),
    };

    console.log('[log-email-attempt] Attempting to insert into Supabase:', dataToInsert);

    const { data, error: dbError } = await supabase
      .from('sent_email_resend')
      .insert([dataToInsert]) // Supabase insert expects an array of objects
      .select(); // Optionally, select to get back the inserted row(s)

    if (dbError) {
      console.error('[log-email-attempt] Supabase error inserting log:', dbError);
      // Even if DB write fails, we might not want to return an error that blocks the caller of this API
      // if it was called fire-and-forget. But logging the error is crucial.
      // For direct testing of this endpoint, returning an error is useful.
      return NextResponse.json(
        { error: 'Failed to log email attempt to Supabase', details: dbError.message },
        { status: 500 }
      );
    }

    console.log('[log-email-attempt] Successfully logged to Supabase, response:', data);

    return NextResponse.json(
      { success: true, message: 'Log attempt received and processed', data },
      { status: 201 } // 201 Created, as a resource (the log entry) was created
    );

  } catch (error: unknown) {
    console.error('[log-email-attempt] Error processing request:', error);
    // Differentiate between client-side errors (e.g., bad JSON) and others
    if (error instanceof SyntaxError) { // Example: Bad JSON from request
        return NextResponse.json(
            { error: 'Invalid request body', details: error.message },
            { status: 400 }
        );
    }
    return NextResponse.json(
      { error: 'Unexpected error processing log request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 