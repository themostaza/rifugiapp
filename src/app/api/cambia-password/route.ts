import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const requestData = await request.json();
    const { email, newPassword } = requestData;

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: 'Email e password richiesti' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'La password deve contenere almeno 6 caratteri' },
        { status: 400 }
      );
    }

    // Initialize Supabase with server-side auth
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Configurazione server mancante' },
        { status: 500 }
      );
    }

    // Usa il client Supabase standard per query di lettura
    const supabase = createRouteHandlerClient({ cookies });

    // Client con service role per operazioni admin
    const adminClient = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Try to find user in the users table first
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    let userId = userData?.id;

    // If not found in users table, check auth.users directly
    if (userError || !userId) {
      // Ottieni tutti gli utenti e filtra per email
      const { data: authUser } = await adminClient.auth.admin.listUsers();

      // Filtra manualmente per email
      const matchingUsers = authUser?.users.filter(user => user.email === email);

      if (!matchingUsers || matchingUsers.length === 0) {
        return NextResponse.json(
          { error: 'Utente non trovato' },
          { status: 404 }
        );
      }

      userId = matchingUsers[0].id;
    }

    // Update the password
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Password update error:', updateError);
      return NextResponse.json(
        { error: 'Errore durante l\'aggiornamento della password' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Errore del server' },
      { status: 500 }
    );
  }
} 