import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Definizione tipo per le entry delle email inviate
interface SentEmailEntry {
  id: number;
  created_at: string; 
  subject: string | null;
  to: string | null; 
  mail_body: string | null;
  sent_time: string | null; 
  status: string | null;
}

// Definizione tipo per le condizioni di filtro (simile a db_prenotazioni)
interface FilterCondition {
  field: keyof SentEmailEntry | '';
  operator: string;
  value: unknown;
}

// Inizializzazione Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.error("Errore: Variabili d'ambiente Supabase non definite per sent-emails API.");
}

export async function GET(request: Request) {
  if (!supabase) {
    return NextResponse.json({ error: "Supabase client non inizializzato." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const sortBy = searchParams.get('sortBy') as keyof SentEmailEntry || 'created_at';
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? true : false;
  const searchTerm = searchParams.get('search') || '';
  const advFiltersParam = searchParams.get('advFilters');

  const offset = (page - 1) * limit;

  let query = supabase.from('sent_email_resend').select('*', { count: 'exact' });

  // Applica ricerca globale (su subject, to, mail_body)
  if (searchTerm) {
    query = query.or(`subject.ilike.%${searchTerm}%,to.ilike.%${searchTerm}%,mail_body.ilike.%${searchTerm}%`);
  }

  // Applica filtri avanzati
  if (advFiltersParam) {
    try {
      const advancedFilters: FilterCondition[] = JSON.parse(advFiltersParam);
      advancedFilters.forEach(filter => {
        if (filter.field && filter.operator && filter.value !== undefined && filter.value !== null && filter.value !== '') {
          switch (filter.operator) {
            case 'eq':
              query = query.eq(filter.field as string, filter.value);
              break;
            case 'neq':
              query = query.neq(filter.field as string, filter.value);
              break;
            case 'gt':
              query = query.gt(filter.field as string, filter.value);
              break;
            case 'lt':
              query = query.lt(filter.field as string, filter.value);
              break;
            case 'gte':
              query = query.gte(filter.field as string, filter.value);
              break;
            case 'lte':
              query = query.lte(filter.field as string, filter.value);
              break;
            case 'ilike':
              query = query.ilike(filter.field as string, `%${filter.value}%`);
              break;
            case 'is': // Per i booleani, ma la tabella sent_email_resend non ne ha di default
              query = query.is(filter.field as string, filter.value);
              break;
            // Aggiungi altri operatori se necessario
          }
        }
      });
    } catch (e) {
      console.error("Errore nel parsing dei filtri avanzati:", e);
      return NextResponse.json({ error: "Formato filtri avanzati non valido." }, { status: 400 });
    }
  }

  // Applica ordinamento
  query = query.order(sortBy, { ascending: sortOrder });

  // Applica paginazione
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Errore query Supabase per sent_email_resend:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const totalItems = count || 0;
  const totalPages = Math.ceil(totalItems / limit);

  return NextResponse.json({
    data,
    count: totalItems,
    page,
    limit,
    totalPages,
  });
}

// Per assicurare che la route sia dinamica
export const dynamic = 'force-dynamic'; 