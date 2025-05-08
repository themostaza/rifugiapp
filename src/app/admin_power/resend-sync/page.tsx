'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal, Loader2, PlusCircle, XCircle, RefreshCw, AlertTriangle, Info } from 'lucide-react';

// Definizione tipo per le entry delle email inviate (deve corrispondere a quella dell'API)
interface SentEmailEntry {
  id: number;
  created_at: string; 
  subject: string | null;
  to: string | null; 
  mail_body: string | null;
  sent_time: string | null; 
  status: string | null;
}

// API response structure from /api/sent-emails
interface ApiSentEmailsResponse {
  data: SentEmailEntry[];
  count: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Filter Structures (come in db_prenotazioni, adattato)
interface FilterableField {
  value: keyof SentEmailEntry;
  label: string;
  type: 'text' | 'date' | 'select'; // Semplificato per ora, 'select' per status
  operators: string[];
  options?: { value: string; label: string }[]; // Per i campi di tipo 'select'
}

interface FilterCondition {
  id: string; 
  field: keyof SentEmailEntry | '';
  operator: string;
  value: unknown; 
}

const ResendSyncPage = () => {
  const [data, setData] = useState<SentEmailEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<SentEmailEntry | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25); // Default più basso per email
  const [totalItems, setTotalItems] = useState(0);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  // Filter State
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<FilterCondition[]>([]);

  // Sorting State
  const [sortColumn, setSortColumn] = useState<keyof SentEmailEntry>('sent_time'); // Ordina per data invio
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const availableFields: FilterableField[] = [
    { value: 'id', label: 'ID DB', type: 'text', operators: ['eq', 'neq'] }, // text perché è un numero grande
    { value: 'subject', label: 'Oggetto', type: 'text', operators: ['ilike', 'eq', 'neq'] },
    { value: 'to', label: 'Destinatario', type: 'text', operators: ['ilike', 'eq', 'neq'] },
    { value: 'status', label: 'Stato Resend', type: 'select', operators: ['eq', 'neq'], 
      options: [
        { value: 'sent', label: 'Inviata' },
        { value: 'delivered', label: 'Consegnata' },
        { value: 'bounced', label: 'Rimbalzata' },
        { value: 'complained', label: 'Reclamata' },
        // Aggiungi altri stati di Resend se necessario
      ]
    },
    { value: 'sent_time', label: 'Data Invio', type: 'date', operators: ['eq', 'neq', 'gte', 'lte'] },
    { value: 'created_at', label: 'Data Creazione DB', type: 'date', operators: ['eq', 'neq', 'gte', 'lte'] },
  ];

  const sortableFields: { value: keyof SentEmailEntry; label: string }[] = [
    { value: 'id', label: 'ID DB' },
    { value: 'subject', label: 'Oggetto' },
    { value: 'to', label: 'Destinatario' },
    { value: 'status', label: 'Stato Resend' },
    { value: 'sent_time', label: 'Data Invio' },
    { value: 'created_at', label: 'Data Creazione DB' },
  ];

  const operatorLabels: Record<string, string> = {
    'eq': 'Uguale a',
    'neq': 'Diverso da',
    'gt': 'Maggiore di',
    'lt': 'Minore di',
    'gte': 'Maggiore o uguale a',
    'lte': 'Minore o uguale a',
    'ilike': 'Contiene (case-insensitive)',
  };

  // Funzione per formattare le date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e: unknown) {
      console.error("Errore nel formattare la data:", e);
      return dateString; // Ritorna la stringa originale se non parsabile
    }
  };

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); 
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchData = useCallback(async () => {
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
      if (appliedFilters.length > 0) {
        params.append('advFilters', JSON.stringify(appliedFilters));
      }

      const response = await fetch(`/api/sent-emails?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Impossibile recuperare i dati delle email inviate' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const result: ApiSentEmailsResponse = await response.json();
      setData(result.data);
      setTotalItems(result.count);
    } catch (e: unknown) {
      console.error("Errore recupero dati email:", e);
      const message = e instanceof Error ? e.message : 'Errore sconosciuto durante il recupero dei dati';
      setError(message);
      setData([]);
      setTotalItems(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearchTerm, appliedFilters, sortColumn, sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSyncResend = async () => {
    setIsSyncing(true);
    setError(null);
    try {
      // Assumendo che CRON_SECRET sia gestito nelle variabili d'ambiente del server e non sia necessario passarlo dal client
      // Se invece devi passarlo, aggiungi ?CRON_SECRET=tuo_valore
      const response = await fetch('/api/cron/update-sent-emails', { method: 'GET' }); 
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Errore durante la sincronizzazione');
      }
      fetchData(); // Ricarica i dati dopo la sincronizzazione
    } catch (e: unknown) {
      console.error("Errore sincronizzazione Resend:", e);
      const message = e instanceof Error ? e.message : 'Errore sconosciuto durante la sincronizzazione';
      setError(message); // Potresti voler mostrare questo errore anche in un banner sulla pagina
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRowClick = (entry: SentEmailEntry) => {
    setSelectedEntry(entry);
    setIsDetailDialogOpen(true);
  };

  // Filter Management Functions (simili a db_prenotazioni)
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
    setCurrentPage(1);
  };
  
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const renderFilterValueInput = (filter: FilterCondition) => {
    const selectedFieldConfig = availableFields.find(af => af.value === filter.field);
    if (!selectedFieldConfig) return <Input placeholder="Valore" disabled />;

    switch (selectedFieldConfig.type) {
      case 'text':
        return (
          <Input
            placeholder="Valore"
            value={String(filter.value ?? '')}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
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
      case 'select':
        return (
          <Select
            value={filter.value === undefined || filter.value === null ? '' : String(filter.value)}
            onValueChange={(val: string) => updateFilter(filter.id, { value: val })}
          >
            <SelectTrigger><SelectValue placeholder="Seleziona valore" /></SelectTrigger>
            <SelectContent>
              {selectedFieldConfig.options?.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return <Input placeholder="Valore" disabled />;
    }
  };

  return (
    <>
      <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Anagrafica Email Inviate (Resend)</h1>
          <Button onClick={handleSyncResend} disabled={isSyncing} className="w-full sm:w-auto">
            {isSyncing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Attendere...</>
            ) : (
              <><RefreshCw className="mr-2 h-4 w-4" />Sincronizza con Resend</>
            )}
          </Button>
        </div>

        {/* Barra di ricerca e filtri */} 
        <div className="space-y-4 p-4 border rounded-md bg-gray-50">
          <Input
            placeholder="Cerca per oggetto, destinatario, corpo email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-lg"
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Filtri Avanzati</h3>
                <Button variant="outline" size="sm" onClick={addFilter} className="ml-auto">
                    <PlusCircle className="mr-2 h-4 w-4" /> Aggiungi Filtro
                </Button>
            </div>
            {filters.map((filter) => (
              <div key={filter.id} className="flex flex-col sm:flex-row gap-2 p-3 border rounded bg-white">
                <Select
                  value={filter.field}
                  onValueChange={(value) => updateFilter(filter.id, { field: value as keyof SentEmailEntry, operator: '', value: '' })}
                >
                  <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Campo" /></SelectTrigger>
                  <SelectContent>
                    {availableFields.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filter.operator}
                  onValueChange={(value) => updateFilter(filter.id, { operator: value })}
                  disabled={!filter.field}
                >
                  <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Operatore" /></SelectTrigger>
                  <SelectContent>
                    {availableFields.find(af => af.value === filter.field)?.operators.map(op => (
                      <SelectItem key={op} value={op}>{operatorLabels[op] || op}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-grow">
                    {renderFilterValueInput(filter)}
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeFilter(filter.id)}>
                  <XCircle className="h-5 w-5 text-red-500" />
                </Button>
              </div>
            ))}
            {filters.length > 0 && (
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setFilters([]); setAppliedFilters([]); setCurrentPage(1);}}>
                    Resetta Filtri
                </Button>
                <Button onClick={handleApplyFilters}>
                    <Filter className="mr-2 h-4 w-4" /> Applica Filtri
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Tabella Dati */} 
        {isLoading && <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /> <span className="ml-2">Caricamento dati...</span></div>}
        {!isLoading && error && <div className="p-4 text-red-600 bg-red-100 border border-red-300 rounded-md"><AlertTriangle className="inline mr-2" />Errore: {error}</div>}
        {!isLoading && !error && data.length === 0 && (
          <div className="p-4 text-gray-600 bg-gray-100 border border-gray-300 rounded-md text-center">
            <Info className="inline mr-2 h-5 w-5" />Nessuna email trovata con i criteri selezionati.
            {appliedFilters.length === 0 && debouncedSearchTerm === '' && (
                <p className="text-sm mt-1">Prova a sincronizzare con Resend per popolare i dati.</p>
            )}
          </div>
        )}
        {!isLoading && !error && data.length > 0 && (
          <>
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    {sortableFields.map(field => (
                      <TableHead key={field.value} 
                        className="cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                        onClick={() => {
                          if (sortColumn === field.value) {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortColumn(field.value);
                            setSortOrder('desc');
                          }
                          setCurrentPage(1);
                        }}
                      >
                        {field.label}
                        {sortColumn === field.value && (sortOrder === 'asc' ? ' ▲' : ' ▼')}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Dettagli</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-gray-50">
                      {sortableFields.map(sf => (
                        <TableCell key={`${entry.id}-${sf.value}`} className="py-2 px-3 whitespace-nowrap">
                          {sf.value === 'sent_time' || sf.value === 'created_at' 
                           ? formatDate(entry[sf.value]) 
                           : entry[sf.value] !== null && entry[sf.value] !== undefined 
                             ? String(entry[sf.value]) 
                             : '-'}
                        </TableCell>
                      ))}
                      <TableCell className="text-right py-2 px-3">
                        <Button variant="outline" size="sm" onClick={() => handleRowClick(entry)}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Paginazione */} 
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-gray-700">
                Pagina {currentPage} di {totalPages} (Totale: {totalItems} email)
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1 || isLoading}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Input 
                  type="number"
                  className="w-16 h-9 text-center"
                  value={currentPage}
                  onChange={(e) => {
                    const pageNum = Number(e.target.value);
                    if (pageNum >= 1 && pageNum <= totalPages) setCurrentPage(pageNum);
                  }}
                  min={1}
                  max={totalPages}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || isLoading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages || isLoading}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
                <Select
                    value={String(itemsPerPage)}
                    onValueChange={(value) => {
                        setItemsPerPage(Number(value));
                        setCurrentPage(1);
                    }}
                    disabled={isLoading}
                    >
                    <SelectTrigger className="w-[70px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {[10, 25, 50, 100].map(val => (
                            <SelectItem key={val} value={String(val)}>{val}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}

        {/* Dialog Dettagli Email */} 
        {selectedEntry && (
          <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
            <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Dettaglio Email ID: {selectedEntry.id}</DialogTitle>
                <DialogDescription>
                  Oggetto: {selectedEntry.subject || 'N/D'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 overflow-y-auto flex-grow">
                <div className="grid grid-cols-[150px_1fr] items-center gap-2">
                  <span className="font-semibold text-sm">ID Database:</span>
                  <span>{selectedEntry.id}</span>
                </div>
                <div className="grid grid-cols-[150px_1fr] items-center gap-2">
                  <span className="font-semibold text-sm">Oggetto:</span>
                  <span>{selectedEntry.subject || 'N/D'}</span>
                </div>
                <div className="grid grid-cols-[150px_1fr] items-center gap-2">
                  <span className="font-semibold text-sm">Destinatario/i:</span>
                  <span className="break-all">{selectedEntry.to || 'N/D'}</span>
                </div>
                <div className="grid grid-cols-[150px_1fr] items-center gap-2">
                  <span className="font-semibold text-sm">Data Invio (Resend):</span>
                  <span>{formatDate(selectedEntry.sent_time)}</span>
                </div>
                <div className="grid grid-cols-[150px_1fr] items-center gap-2">
                  <span className="font-semibold text-sm">Stato (Resend):</span>
                  <span>{selectedEntry.status || 'N/D'}</span>
                </div>
                <div className="grid grid-cols-[150px_1fr] items-center gap-2">
                  <span className="font-semibold text-sm">Data Creazione DB:</span>
                  <span>{formatDate(selectedEntry.created_at)}</span>
                </div>
                <div className="mt-2">
                  <h4 className="font-semibold text-sm mb-1">Corpo Email:</h4>
                  {selectedEntry.mail_body ? (
                    <div className="p-3 border rounded-md bg-gray-50 max-h-96 overflow-y-auto text-sm whitespace-pre-wrap break-words">
                        {selectedEntry.mail_body}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Corpo email non disponibile.</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>Chiudi</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </>
  );
};

export default ResendSyncPage; 