import { type NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; 

// Define the expected structure for Basket entries, similar to the frontend
interface BasketEntry {
  id: number;
  dayFrom: string; // Assuming date strings are fine, Supabase client handles conversion
  dayTo: string;
  note: string | null;
  name: string | null;
  surname: string | null;
  mail: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  reservationType: string;
  totalPrice: number;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
  stripeId: string | null;
  paymentIntentId: string | null;
  isCancelled: boolean | null;
  bubbleBasketId: string | null;
  isCreatedByAdmin: boolean;
  external_id: string | null;
  booking_details: unknown | null; // Changed from any to unknown
  isCancelledAtTime: string | null;
}

// Interface for the filter conditions received from the frontend
interface FilterCondition {
  id: string; // Unique ID from frontend, not used in backend logic directly
  field: keyof BasketEntry | string; // string for flexibility, but ideally keyof BasketEntry
  operator: string;
  value: unknown; // Changed from any to unknown
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const searchTerm = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'dayFrom'; // Default sort by dayFrom
  const sortOrder = searchParams.get('sortOrder') || 'desc'; // Default sort order descending
  const advFiltersString = searchParams.get('advFilters');

  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('Basket')
      .select('*', { count: 'exact' }); // Fetches all columns and total count

    // Apply general text search filter if searchTerm is provided
    if (searchTerm) {
      // Basic search across multiple text fields. 
      // For more complex search, consider full-text search capabilities of PostgreSQL.
      const searchConditions = [
        `name.ilike.%${searchTerm}%`,
        `surname.ilike.%${searchTerm}%`,
        `mail.ilike.%${searchTerm}%`,
        `phone.ilike.%${searchTerm}%`,
        // If ID is numeric and searchTerm is a number, try searching by ID too
        !isNaN(Number(searchTerm)) ? `id.eq.${Number(searchTerm)}` : ''
      ].filter(Boolean).join(','); // Filter out empty string for ID search if not applicable
      
      if (searchConditions) {
        query = query.or(searchConditions);
      }
    }

    // Apply advanced filters if advFiltersString is provided
    if (advFiltersString) {
      try {
        const advancedFilters = JSON.parse(advFiltersString) as FilterCondition[];
        if (Array.isArray(advancedFilters)) {
          advancedFilters.forEach(filter => {
            if (filter.field && filter.operator && filter.value !== undefined) {
              // Ensure field is a string, as Supabase client expects string column names
              const fieldName = String(filter.field);
              const filterValue = filter.value; // Changed from let to const

              // Special handling for ilike to ensure wildcards if not already present
              // Supabase ilike typically expects the pattern directly.
              // If frontend always sends just the value, we might wrap it with %.
              // For now, assuming Supabase handles `ilike` with `%value%` as intended.

              switch (filter.operator) {
                case 'eq':
                  query = query.eq(fieldName, filterValue);
                  break;
                case 'neq':
                  query = query.neq(fieldName, filterValue);
                  break;
                case 'gt':
                  query = query.gt(fieldName, filterValue);
                  break;
                case 'lt':
                  query = query.lt(fieldName, filterValue);
                  break;
                case 'gte':
                  query = query.gte(fieldName, filterValue);
                  break;
                case 'lte':
                  query = query.lte(fieldName, filterValue);
                  break;
                case 'ilike':
                  // For ilike, the pattern should be %value%. Supabase client handles this well.
                  query = query.ilike(fieldName, `%${String(filterValue)}%`); // Ensure filterValue is string for ilike
                  break;
                case 'is':
                  // 'is' operator is for true, false, or null
                  query = query.is(fieldName, filterValue);
                  break;
                // Add other operators as needed
                default:
                  console.warn(`Unsupported filter operator: ${filter.operator} for field ${fieldName}`);
              }
            }
          });
        }
      } catch (parseError) {
        console.error('Error parsing advanced filters:', parseError);
        // Optionally, you could return a 400 error if filters are malformed
        // return NextResponse.json({ message: 'Invalid advanced filters format' }, { status: 400 });
      }
    }

    // Apply sorting
    // Ensure sortBy is a valid column name to prevent errors
    // You might want to have a list of allowed sortable columns
    const validSortColumns = ['id', 'dayFrom', 'dayTo', 'name', 'surname', 'mail', 'totalPrice', 'createdAt', 'updatedAt', 'isPaid', 'isCreatedByAdmin', 'reservationType'];
    if (validSortColumns.includes(sortBy)) {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    } else {
      // Default sort if sortBy is invalid to prevent errors
      query = query.order('dayFrom', { ascending: false });
    }
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    return NextResponse.json({ 
      data: data as BasketEntry[], // Cast to ensure type safety if needed
      count: count || 0, 
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    });

  } catch (error: unknown) {
    console.error('API Error fetching basket data:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { message: 'Error fetching basket data', error: message },
      { status: 500 }
    );
  }
} 