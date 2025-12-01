'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal, Loader2, PlusCircle, XCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';

// Data type from Supabase Basket table
interface BasketEntry {
  id: number;
  dayFrom: string;
  dayTo: string;
  name: string | null;
  surname: string | null;
  mail: string | null;
  phone: string | null;
  reservationType: string;
  totalPrice: number;
  isPaid: boolean;
  isCreatedByAdmin: boolean;
  note?: string | null;
  city?: string | null;
  region?: string | null;
  stripeId?: string | null;
  paymentIntentId?: string | null;
  // Campi Nexi
  nexiOrderId?: string | null;
  nexiOperationId?: string | null;
  nexiPaymentCircuit?: string | null;
  isCancelled?: boolean | null;
  external_id?: string | null;
  booking_details?: unknown | null; // Changed from any to unknown
  createdAt: string;
  updatedAt: string;
  isCancelledAtTime?: string | null;
}

// API response structure from /api/basket
interface ApiBasketResponse {
  data: BasketEntry[];
  count: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Filter Structures
interface FilterableField {
  value: keyof BasketEntry; // The actual field name
  label: string;            // User-friendly label
  type: 'text' | 'number' | 'date' | 'boolean';
  operators: string[];      // Available operators for this field type
}

interface FilterCondition {
  id: string; // Unique ID for React key prop
  field: keyof BasketEntry | '';
  operator: string;
  value: unknown; // Changed from any to unknown
}

const DBPrenotazioniPage = () => {
  const [data, setData] = useState<BasketEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<BasketEntry | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  
  // Payment provider per condizionare UI
  const paymentProvider = process.env.NEXT_PUBLIC_PAYMENT_PROVIDER || 'stripe';

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [totalItems, setTotalItems] = useState(0);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  // Filter State
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<FilterCondition[]>([]);

  // Sorting State
  const [sortColumn, setSortColumn] = useState<keyof BasketEntry>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const availableFields: FilterableField[] = [
    { value: 'id', label: 'ID Prenotazione', type: 'number', operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'] },
    { value: 'name', label: 'Nome', type: 'text', operators: ['ilike', 'eq', 'neq'] },
    { value: 'surname', label: 'Cognome', type: 'text', operators: ['ilike', 'eq', 'neq'] },
    { value: 'mail', label: 'Email', type: 'text', operators: ['ilike', 'eq', 'neq'] },
    { value: 'phone', label: 'Telefono', type: 'text', operators: ['ilike', 'eq', 'neq'] },
    { value: 'city', label: 'Stato', type: 'text', operators: ['ilike', 'eq', 'neq'] },
    { value: 'dayFrom', label: 'Check-in', type: 'date', operators: ['eq', 'neq', 'gte', 'lte'] },
    { value: 'dayTo', label: 'Check-out', type: 'date', operators: ['eq', 'neq', 'gte', 'lte'] },
    { value: 'totalPrice', label: 'Prezzo Totale', type: 'number', operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'] },
    { value: 'isPaid', label: 'Pagata', type: 'boolean', operators: ['is'] },
    { value: 'isCreatedByAdmin', label: 'Creata da Admin', type: 'boolean', operators: ['is'] },
    { value: 'isCancelled', label: 'Cancellata', type: 'boolean', operators: ['is'] },
    { value: 'reservationType', label: 'Tipo Prenotazione', type: 'text', operators: ['eq', 'neq'] },
    // Add more fields as needed
  ];

  const sortableFields: { value: keyof BasketEntry; label: string }[] = [
    { value: 'id', label: 'ID Prenotazione' },
    { value: 'dayFrom', label: 'Check-in' },
    { value: 'dayTo', label: 'Check-out' },
    { value: 'surname', label: 'Cognome Cliente' },
    { value: 'totalPrice', label: 'Prezzo Totale' },
    { value: 'createdAt', label: 'Data Creazione' },
    { value: 'updatedAt', label: 'Data Ultima Modifica' },
    // Add other fields you want to be sortable
  ];

  const operatorLabels: Record<string, string> = {
    'eq': 'Uguale a',
    'neq': 'Diverso da',
    'gt': 'Maggiore di',
    'lt': 'Minore di',
    'gte': 'Maggiore o uguale a',
    'lte': 'Minore o uguale a',
    'ilike': 'Contiene (case-insensitive)',
    'is': 'È',
  };

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); 
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: itemsPerPage.toString(),
          sortBy: sortColumn,
          sortOrder: sortOrder,
        });
        if (debouncedSearchTerm) {
          params.append('search', debouncedSearchTerm);
        }

        // Serialize and add advanced filters if they exist
        if (appliedFilters.length > 0) {
          params.append('advFilters', JSON.stringify(appliedFilters));
        }

        const response = await fetch(`/api/basket?${params.toString()}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to fetch data' }));
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        const result: ApiBasketResponse = await response.json();
        setData(result.data);
        setTotalItems(result.count);
      } catch (e: unknown) {
        console.error("Fetch error:", e);
        const message = e instanceof Error ? e.message : 'An unknown error occurred while fetching data';
        setError(message);
        setData([]);
        setTotalItems(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentPage, itemsPerPage, debouncedSearchTerm, appliedFilters, sortColumn, sortOrder]); 

  const handleRowClick = (entry: BasketEntry) => {
    setSelectedEntry(entry);
    setIsDetailDialogOpen(true);
  };

  // Filter Management Functions
  const addFilter = () => {
    setFilters([...filters, { id: Date.now().toString(), field: '', operator: '', value: '' }]);
  };

  const updateFilter = (id: string, updatedField: Partial<FilterCondition>) => {
    setFilters(filters.map(f => f.id === id ? { ...f, ...updatedField } : f));
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const handleApplyFilters = () => {
    const validFilters = filters.filter(f => f.field && f.operator && (f.value !== '' && f.value !== null && f.value !== undefined));
    setAppliedFilters(validFilters);
    // Applying filters should also apply the current sortColumn and sortOrder selections
    // The useEffect for fetchData will pick up changes to sortColumn, sortOrder, and appliedFilters
    setCurrentPage(1);
  };
  
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const renderFilterValueInput = (filter: FilterCondition) => {
    const selectedFieldConfig = availableFields.find(af => af.value === filter.field);
    if (!selectedFieldConfig) return <Input placeholder="Valore" disabled />;

    switch (selectedFieldConfig.type) {
      case 'text':
      case 'number': 
        return (
          <Input
            placeholder="Valore"
            value={String(filter.value ?? '')}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            type={selectedFieldConfig.type === 'number' ? 'number' : 'text'}
          />
        );
      case 'date':
        return (
          <Input
            type="date"
            value={String(filter.value ?? '')}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
          />
        );
      case 'boolean':
        return (
          <Select
            value={filter.value === undefined || filter.value === null ? '' : String(filter.value)}
            onValueChange={(val: string) => updateFilter(filter.id, { value: val === 'true' ? true : val === 'false' ? false : undefined })}
          >
            <SelectTrigger><SelectValue placeholder="Seleziona valore" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Vero (Sì)</SelectItem>
              <SelectItem value="false">Falso (No)</SelectItem>
            </SelectContent>
          </Select>
        );
      default:
        return <Input placeholder="Valore" disabled />;
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Database Prenotazioni</h1>
        <div></div> {/* Spacer */}
      </div>

      {/* Search and Filters Section */}
      <div className="p-4 border rounded-lg bg-gray-50 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label htmlFor="search-input" className="block text-sm font-medium text-gray-700 mb-1">Ricerca Globale</label>
            <Input
              id="search-input"
              placeholder="ID, nome, cognome, email, telefono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Filtri Avanzati</h3>
          {filters.map((filter) => {
            const selectedFieldConfig = availableFields.find(af => af.value === filter.field);
            const operatorsForField = selectedFieldConfig ? selectedFieldConfig.operators : [];

            return (
              <div key={filter.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2 p-3 border rounded-md bg-white">
                <Select
                  value={filter.field}
                  onValueChange={(value: string) => {
                    const fieldConfig = availableFields.find(f => f.value === value);
                    updateFilter(filter.id, { 
                      field: value as keyof BasketEntry, 
                      operator: '',
                      value: fieldConfig?.type === 'boolean' ? undefined : ''
                    });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Seleziona Campo" /></SelectTrigger>
                  <SelectContent>
                    {availableFields.map(field => (
                      <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filter.operator}
                  onValueChange={(value: string) => updateFilter(filter.id, { operator: value })}
                  disabled={!filter.field || operatorsForField.length === 0}
                >
                  <SelectTrigger><SelectValue placeholder="Seleziona Operatore" /></SelectTrigger>
                  <SelectContent>
                    {operatorsForField.map(op => (
                      <SelectItem key={op} value={op}>{operatorLabels[op] || op}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="md:col-span-1">
                  {renderFilterValueInput(filter)}
                </div>

                <Button variant="ghost" onClick={() => removeFilter(filter.id)} className="text-red-500 hover:text-red-700 md:col-start-4 flex items-center justify-start md:justify-center">
                  <XCircle className="mr-1 h-4 w-4" /> Rimuovi
                </Button>
              </div>
            );
          })}
          <div className="mt-3 flex gap-3 items-start flex-wrap"> {/* Use items-start and flex-wrap for better layout */}
            <Button variant="outline" onClick={addFilter} className="flex items-center">
              <PlusCircle className="mr-2 h-4 w-4" /> Aggiungi Filtro
            </Button>
            {filters.length > 0 && (
              <Button onClick={handleApplyFilters} className="flex items-center bg-blue-600 hover:bg-blue-700 text-white">
                <Filter className="mr-2 h-4 w-4" /> Applica Filtri
              </Button>
            )}
          </div>
        </div>

        {/* Sorting Controls Section */}
        <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Ordinamento</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                    <label htmlFor="sort-by-select" className="block text-sm font-medium text-gray-700 mb-1">Ordina per</label>
                    <Select
                        value={sortColumn}
                        onValueChange={(value) => setSortColumn(value as keyof BasketEntry)}
                    >
                        <SelectTrigger id="sort-by-select">
                            <SelectValue placeholder="Seleziona campo..." />
                        </SelectTrigger>
                        <SelectContent>
                            {sortableFields.map(field => (
                                <SelectItem key={field.value} value={field.value}>
                                    {field.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <label htmlFor="sort-order-select" className="block text-sm font-medium text-gray-700 mb-1">Direzione</label>
                    <Select
                        value={sortOrder}
                        onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}
                    >
                        <SelectTrigger id="sort-order-select">
                            <SelectValue placeholder="Seleziona direzione..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="desc">Discendente (più recenti/maggiori prima)</SelectItem>
                            <SelectItem value="asc">Ascendente (meno recenti/minori prima)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 {/* The "Applica Filtri" button now also applies sorting changes */}
                 {/* Consider if a separate "Applica Ordinamento" button is desired or if it's fine with "Applica Filtri" */}
            </div>
        </div>
      </div>

      {/* Data Table Section (remains largely the same) */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="ml-3 text-gray-600">Caricamento prenotazioni...</p>
        </div>
      )}
      {error && <p className="text-red-600 bg-red-50 p-3 rounded-md border border-red-200">Errore: {error}</p>}
      {!isLoading && !error && (
        <>
          <div className="border rounded-lg overflow-hidden shadow-sm mt-6">
            <Table>
              <TableHeader className="bg-gray-100">
                <TableRow>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-out</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</TableHead>
                  <TableHead className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Prezzo</TableHead>
                  <TableHead className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pagata</TableHead>
                  <TableHead className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</TableHead>
                  <TableHead className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Cancellato?</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Creazione</TableHead>
                  <TableHead className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Dettagli</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white divide-y divide-gray-200">
                {data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-gray-500 py-10">
                      {appliedFilters.length > 0 || debouncedSearchTerm ? 'Nessuna prenotazione trovata con i criteri selezionati.' : 'Nessuna prenotazione nel database.'}
                    </TableCell>
                  </TableRow>
                )}
                {data.map((entry) => {
                  const displayReservationType = (type: string) => {
                    if (type === 'hb') return 'Mezza Pensione';
                    if (type === 'bb') return 'Bed & Breakfast';
                    return type;
                  };
                  
                  // Determina il colore di sfondo della riga in base allo stato
                  let rowClassName = 'hover:bg-gray-50';
                  if (entry.isCancelled) {
                    rowClassName = 'bg-red-100 hover:bg-red-200 text-red-900';
                  } else if (!entry.isPaid && !entry.isCreatedByAdmin) {
                    rowClassName = 'bg-yellow-100 hover:bg-yellow-200 text-yellow-900';
                  }

                  return (
                    <TableRow 
                      key={entry.id} 
                      onClick={() => handleRowClick(entry)} 
                      className={`cursor-pointer transition-colors duration-150 ${rowClassName}`}>
                      <TableCell className="px-4 py-3 whitespace-nowrap font-medium">{entry.id}</TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-sm">{new Date(entry.dayFrom).toLocaleDateString('it-IT')}</TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-sm">{new Date(entry.dayTo).toLocaleDateString('it-IT')}</TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-sm">{entry.name} {entry.surname || ''}</TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-sm">{displayReservationType(entry.reservationType)}</TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-right">{entry.totalPrice.toFixed(2)} €</TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-center">
                          <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            entry.isPaid ? 'bg-green-100 text-green-800' : 
                            entry.isCancelled ? 'bg-red-200 text-red-800' : 
                            entry.isCreatedByAdmin ? 'bg-purple-100 text-purple-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                              {entry.isPaid ? 'Sì' : 'No'}
                          </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-center">
                          <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${entry.isCreatedByAdmin ? 'bg-purple-100 text-purple-800' : entry.isCancelled ? 'bg-red-200 text-red-800' : 'bg-gray-100 text-gray-700'}`}>
                              {entry.isCreatedByAdmin ? 'Sì' : 'No'}
                          </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-center font-medium">
                        {entry.isCancelled ? 'Sì' : 'No'}
                      </TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-left">
                        {new Date(entry.createdAt).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRowClick(entry); }} title="Vedi dettagli">
                          <MoreHorizontal className={`h-5 w-5 ${entry.isCancelled ? 'text-red-700' : 'text-gray-500 hover:text-blue-600'}`} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalItems > 0 && (
            <div className="flex items-center justify-between pt-6">
              <div className="text-sm text-gray-600">
                Mostrando {Math.min(itemsPerPage * (currentPage -1) + 1, totalItems)} - {Math.min(itemsPerPage * currentPage, totalItems)} di {totalItems} prenotazioni
              </div>
              <div className="flex items-center space-x-1">
                 <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value: string) => {
                        setItemsPerPage(parseInt(value, 10));
                        setCurrentPage(1); // Reset to first page
                    }}
                  >
                    <SelectTrigger className="w-[80px] h-9 text-sm">
                      <SelectValue placeholder={itemsPerPage} />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50, 100, 200].map(val => (
                        <SelectItem key={val} value={val.toString()} className="text-sm">{val}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-gray-500 mr-2">per pagina</span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="h-9 w-9 p-0"
                  title="Prima pagina"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-9 w-9 p-0"
                  title="Pagina precedente"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-3 py-1.5 border rounded-md bg-gray-50">
                  Pagina {currentPage} di {totalPages > 0 ? totalPages : 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="h-9 w-9 p-0"
                  title="Pagina successiva"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                 <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="h-9 w-9 p-0"
                  title="Ultima pagina"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="min-w-[60vw] sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[90vh] p-0 flex flex-col">
          {selectedEntry && (
            <div className="overflow-y-auto p-6 space-y-4 flex-grow">
              <DialogHeader className="pb-2 border-b">
                <DialogTitle className="text-xl">Dettaglio Prenotazione #{selectedEntry?.id}</DialogTitle>
              </DialogHeader>

              <div className="flex gap-3 flex-wrap items-center">
                {selectedEntry.external_id && (
                  <Link href={`/cart/${selectedEntry.external_id}`} target="_blank" passHref>
                    <Button variant="outline" size="sm" className="w-fit flex items-center justify-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Vedi Preventivo
                    </Button>
                  </Link>
                )}
                {/* Pulsante Stripe - solo se c'è paymentIntentId (pagamento Stripe) */}
                {selectedEntry.paymentIntentId && paymentProvider === 'stripe' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`https://dashboard.stripe.com/payments/${selectedEntry.paymentIntentId}`, '_blank')}
                    className="w-fit flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white hover:text-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M22 12H12"/><path d="m15 15-3-3 3-3"/></svg>
                    Vedi su Stripe
                  </Button>
                )}
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                  <div className="col-span-1 md:col-span-2 border-b pb-2 mb-1">
                      <p className="text-xs text-gray-500">ID Prenotazione</p>
                      <p className="font-medium text-base text-blue-600">{selectedEntry.id}</p>
                  </div>

                  <div><p className="text-xs text-gray-500">Check-in</p><p className="font-medium">{new Date(selectedEntry.dayFrom).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
                  <div><p className="text-xs text-gray-500">Check-out</p><p className="font-medium">{new Date(selectedEntry.dayTo).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
                  
                  <div><p className="text-xs text-gray-500">Nome</p><p className="font-medium">{selectedEntry.name || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Cognome</p><p className="font-medium">{selectedEntry.surname || '-'}</p></div>
                  
                  <div className="col-span-1 md:col-span-2"><p className="text-xs text-gray-500">Email</p><p className="font-medium truncate">{selectedEntry.mail || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Telefono</p><p className="font-medium">{selectedEntry.phone || '-'}</p></div>
                  
                  <div><p className="text-xs text-gray-500">Stato</p><p className="font-medium">{selectedEntry.city || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Regione</p><p className="font-medium">{selectedEntry.region || '-'}</p></div>

                  <div className="col-span-1 md:col-span-2 pt-2 border-t mt-1">
                      <p className="text-xs text-gray-500">Tipo Prenotazione</p>
                      <p className="font-medium">{selectedEntry.reservationType === 'hb' ? 'Mezza Pensione' : selectedEntry.reservationType === 'bb' ? 'Bed & Breakfast' : selectedEntry.reservationType}</p>
                  </div>
                  <div><p className="text-xs text-gray-500">Prezzo Totale</p><p className="font-medium text-lg text-green-600">{selectedEntry.totalPrice.toFixed(2)} €</p></div>
                  
                  <div><p className="text-xs text-gray-500">Pagata</p><p className={`font-semibold ${selectedEntry.isPaid ? 'text-green-700' : 'text-red-700'}`}>{selectedEntry.isPaid ? 'Sì' : 'No'}</p></div>
                  <div><p className="text-xs text-gray-500">Creata da Admin</p><p className={`font-semibold ${selectedEntry.isCreatedByAdmin ? 'text-purple-700' : 'text-gray-700'}`}>{selectedEntry.isCreatedByAdmin ? 'Sì' : 'No'}</p></div>
                  
                  <div><p className="text-xs text-gray-500">Cancellata</p><p className={`font-semibold ${selectedEntry.isCancelled ? 'text-red-700' : 'text-gray-700'}`}>{selectedEntry.isCancelled ? 'Sì' : 'No'}</p></div>
                   {selectedEntry.isCancelled && selectedEntry.isCancelledAtTime && (
                      <div><p className="text-xs text-gray-500">Cancellata il</p><p className="font-medium">{new Date(selectedEntry.isCancelledAtTime).toLocaleString('it-IT')}</p></div>
                   )}
                   {(!selectedEntry.isCancelled || !selectedEntry.isCancelledAtTime) && <div />}
                  
                  <div className="col-span-1 md:col-span-2 pt-2 border-t mt-1">
                      <p className="text-xs text-gray-500">Esterno ID</p>
                      <p className="font-mono text-xs bg-gray-100 p-1 rounded inline-block">{selectedEntry.external_id || 'N/A'}</p>
                  </div>
                  {/* Info pagamento - mostra campi rilevanti in base al provider */}
                  {selectedEntry.nexiOrderId ? (
                    <>
                      <div><p className="text-xs text-gray-500">ID Pagamento (Nexi)</p><p className="font-mono text-xs bg-green-100 p-1 rounded inline-block break-all">{selectedEntry.nexiOrderId}</p></div>
                      <div><p className="text-xs text-gray-500">Codice Autorizzazione</p><p className="font-mono text-xs bg-gray-100 p-1 rounded inline-block break-all">{selectedEntry.nexiOperationId || 'N/A'}</p></div>
                      {selectedEntry.nexiPaymentCircuit && (
                        <div><p className="text-xs text-gray-500">Circuito</p><p className="font-mono text-xs bg-gray-100 p-1 rounded inline-block">{selectedEntry.nexiPaymentCircuit}</p></div>
                      )}
                    </>
                  ) : (
                    <>
                      <div><p className="text-xs text-gray-500">Stripe ID</p><p className="font-mono text-xs bg-gray-100 p-1 rounded inline-block break-all">{selectedEntry.stripeId || 'N/A'}</p></div>
                      <div><p className="text-xs text-gray-500">Payment Intent ID</p><p className="font-mono text-xs bg-gray-100 p-1 rounded inline-block break-all">{selectedEntry.paymentIntentId || 'N/A'}</p></div>
                    </>
                  )}
                  
                  <div><p className="text-xs text-gray-500">Creata il</p><p className="font-medium">{new Date(selectedEntry.createdAt).toLocaleString('it-IT')}</p></div>
                  <div><p className="text-xs text-gray-500">Aggiornata il</p><p className="font-medium">{new Date(selectedEntry.updatedAt).toLocaleString('it-IT')}</p></div>
                </div>

                {/* Note rendering */}
                {selectedEntry && (
                  <div className="pt-3 mt-2 border-t">
                    <p className="text-xs text-gray-500 mb-0.5">Note Cliente:</p>
                    <div className="p-2.5 border rounded bg-gray-50 whitespace-pre-wrap text-gray-700 text-[13px]">
                      {(selectedEntry.note && selectedEntry.note.trim()) ? selectedEntry.note : 'Nessuna nota inserita.'}
                    </div>
                  </div>
                )}

                {/* Booking details rendering */}
                {(selectedEntry && typeof selectedEntry.booking_details === 'object' && selectedEntry.booking_details !== null) ? (
                  <div className="pt-3 mt-2 border-t">
                    <p className="text-xs text-gray-500 mb-0.5">Dettagli Booking (JSON):</p>
                    <pre className="mt-1 p-2.5 border rounded bg-gray-800 text-white text-xs overflow-x-auto">
                      {JSON.stringify(selectedEntry.booking_details, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default DBPrenotazioniPage;
