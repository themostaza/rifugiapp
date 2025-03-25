import { NextResponse } from 'next/server';

// Region data structure
interface Region {
  id: number;
  name: string;
}

// List of Italian regions
const italianRegions: Region[] = [
  { id: 1, name: 'Abruzzo' },
  { id: 2, name: 'Basilicata' },
  { id: 3, name: 'Calabria' },
  { id: 4, name: 'Campania' },
  { id: 5, name: 'Emilia-Romagna' },
  { id: 6, name: 'Friuli-Venezia Giulia' },
  { id: 7, name: 'Lazio' },
  { id: 8, name: 'Liguria' },
  { id: 9, name: 'Lombardia' },
  { id: 10, name: 'Marche' },
  { id: 11, name: 'Molise' },
  { id: 12, name: 'Piemonte' },
  { id: 13, name: 'Puglia' },
  { id: 14, name: 'Sardegna' },
  { id: 15, name: 'Sicilia' },
  { id: 16, name: 'Toscana' },
  { id: 17, name: 'Trentino-Alto Adige' },
  { id: 18, name: 'Umbria' },
  { id: 19, name: 'Valle d\'Aosta' },
  { id: 20, name: 'Veneto' }
];

export async function GET() {
  try {
    console.log('🔍 Fetching Italian regions...');
    console.log(`✅ Successfully fetched ${italianRegions.length} Italian regions`);
    return NextResponse.json(italianRegions, { status: 200 });
    
  } catch (error) {
    console.error('💥 Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}