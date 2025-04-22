'use client'

import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from 'lucide-react';

// Importa i componenti delle tab
import BedBlockManagement from './components/bedBlocks';
import RoomManagement from './components/rooms';
import BuildingManagement from './components/buildings';
import ServiceManagement from './components/services';
import GuestDivisionManagement from './components/guestAndDiscounts';
import BedManagement from './components/bed';
import { Bed, Room, Building, Service, GuestDivision, BedBlock, EntityType, Language } from '@/app/types';

const HotelManagement = () => {
  // State per ogni tipo di entità
  const [beds, setBeds] = useState<Bed[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [guestDivisions, setGuestDivisions] = useState<GuestDivision[]>([]);
  const [bedBlocks, setBedBlocks] = useState<BedBlock[]>([]);

  // Stati comuni per il dialog
  const [showDialog, setShowDialog] = useState(false);
  const [currentEntity, setCurrentEntity] = useState<Bed | Room | Building | Service | GuestDivision | BedBlock | null>(null);
  const [currentTable, setCurrentTable] = useState<EntityType>('Bed');
  const [editMode, setEditMode] = useState(false);

  // Stati per la gestione delle lingue
  const [showLanguageManager, setShowLanguageManager] = useState(false);
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>([]);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(false);
  const [languageForm, setLanguageForm] = useState({ code: '', name: '' });

  // Form states per ogni tipo di entità
  const [bedForm, setBedForm] = useState<Omit<Bed, 'id' | 'createdAt' | 'updatedAt'>>({
    description: '',
    priceMP: 0,
    priceBandB: 0,
    peopleCount: 0,
    langTrasn: [{}]
  });

  const [roomForm, setRoomForm] = useState<Omit<Room, 'id' | 'createdAt' | 'updatedAt'>>({
    description: '',
    bedCount: 0,
    langTrasn: [{}]
  });

  const [buildingForm, setBuildingForm] = useState<Omit<Building, 'id' | 'createdAt' | 'updatedAt'>>({
    buildingName: '',
    roomIds: []
  });

  const [serviceForm, setServiceForm] = useState<Omit<Service, 'id' | 'createdAt' | 'updatedAt'>>({
    description: '',
    price: 0,
    requestQuantity: false,
    langTrasn: [{}]
  });

  const [guestDivisionForm, setGuestDivisionForm] = useState<Omit<GuestDivision, 'id' | 'createdAt' | 'updatedAt'>>({
    description: '',
    title: '',
    ageFrom: 0,
    ageTo: 0,
    salePercent: 0,
    cityTax: false,
    cityTaxPrice: 0,
    langTrasn: [{}]
  });

  const [bedBlockForm, setBedBlockForm] = useState<Omit<BedBlock, 'id' | 'createdAt' | 'updatedAt'>>({
    description: '',
    price: 0
  });

  // Funzioni per gestire le lingue
  const fetchLanguages = async () => {
    setIsLoadingLanguages(true);
    try {
      const response = await fetch('/api/languages');
      if (!response.ok) {
        throw new Error('Failed to fetch languages');
      }
      const data = await response.json();
      setAvailableLanguages(data);
    } catch (error) {
      console.error('Error fetching languages:', error);
      alert('Failed to load languages');
    } finally {
      setIsLoadingLanguages(false);
    }
  };

  const addLanguageToDb = async () => {
    if (!languageForm.code || !languageForm.name) {
      alert('Language code and name are required');
      return;
    }

    try {
      const response = await fetch('/api/languages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: languageForm.code.toLowerCase(),
          name: languageForm.name
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add language');
      }

      await fetchLanguages();
      setLanguageForm({ code: '', name: '' });
      alert('Language added successfully');
    } catch (error) {
      console.error('Error adding language:', error);
      alert(error instanceof Error ? error.message : 'Failed to add language');
    }
  };

  const deleteLanguageFromDb = async (id: number) => {
    if (!confirm('Are you sure you want to delete this language? This might affect existing translations.')) {
      return;
    }

    try {
      const response = await fetch(`/api/languages?id=${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete language');
      }

      await fetchLanguages();
      alert('Language deleted successfully');
    } catch (error) {
      console.error('Error deleting language:', error);
      alert('Failed to delete language');
    }
  };

  // Funzioni fetch
  const fetchBeds = async () => {
    const { data, error } = await supabase
      .from('Bed')
      .select('*')
      .order('createdAt', { ascending: false });
    if (!error && data) setBeds(data);
  };

  const fetchRooms = async () => {
    const { data, error } = await supabase
      .from('Room')
      .select('*')
      .order('createdAt', { ascending: false });
    if (!error && data) setRooms(data);
  };

  const fetchBuildings = async () => {
    const { data, error } = await supabase
      .from('BuildingRegistration')
      .select('*')
      .order('createdAt', { ascending: false });
    if (!error && data) setBuildings(data);
  };

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('Service')
      .select('*')
      .order('createdAt', { ascending: false });
    if (!error && data) setServices(data);
  };

  const fetchGuestDivisions = async () => {
    const { data, error } = await supabase
      .from('GuestDivision')
      .select('*')
      .order('createdAt', { ascending: false });
    if (!error && data) setGuestDivisions(data);
  };

  const fetchBedBlocks = async () => {
    const { data, error } = await supabase
      .from('BedBlock')
      .select('*')
      .order('createdAt', { ascending: false });
    if (!error && data) setBedBlocks(data);
  };

  // Funzione di salvataggio generica
  const handleSave = async () => {
    let form;
    const table = currentTable;
    
    switch (currentTable) {
      case 'Bed':
        form = bedForm;
        break;
      case 'Room':
        form = roomForm;
        break;
      case 'BuildingRegistration':
        form = buildingForm;
        break;
      case 'Service':
        form = serviceForm;
        break;
      case 'GuestDivision':
        form = guestDivisionForm;
        break;
      case 'BedBlock':
        form = bedBlockForm;
        break;
      default:
        return;
    }

    if (editMode && currentEntity) {
      const { error } = await supabase
        .from(table)
        .update(form)
        .eq('id', currentEntity.id);
      
      if (!error) {
        refreshCurrentTable();
        setShowDialog(false);
      }
    } else {
      const { error } = await supabase
        .from(table)
        .insert([form]);
      
      if (!error) {
        refreshCurrentTable();
        setShowDialog(false);
      }
    }
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase
      .from(currentTable)
      .delete()
      .eq('id', id);
    
    if (!error) {
      refreshCurrentTable();
    }
  };

  const refreshCurrentTable = () => {
    switch (currentTable) {
      case 'Bed':
        fetchBeds();
        break;
      case 'Room':
        fetchRooms();
        break;
      case 'BuildingRegistration':
        fetchBuildings();
        break;
      case 'Service':
        fetchServices();
        break;
      case 'GuestDivision':
        fetchGuestDivisions();
        break;
      case 'BedBlock':
        fetchBedBlocks();
        break;
    }
  };

  useEffect(() => {
    fetchBeds();
    fetchRooms();
    fetchBuildings();
    fetchServices();
    fetchGuestDivisions();
    fetchBedBlocks();
    fetchLanguages();
  }, []);

  return (
    <div className="flex h-screen bg-gray-100">
      <main className="flex-1 p-8">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold">Stanze</h1>
          <Button 
            variant="outline" 
            onClick={() => setShowLanguageManager(true)}
            title="Manage Languages"
          >
            <Settings className="h-4 w-4 mr-2" /> Lingue
          </Button>
        </div>

        <Tabs defaultValue="beds">
          <TabsList>
            <TabsTrigger value="beds">Letti</TabsTrigger>
            <TabsTrigger value="rooms">Camere</TabsTrigger>
            <TabsTrigger value="buildings">Edifici</TabsTrigger>
            <TabsTrigger value="services">Servizi</TabsTrigger>
            <TabsTrigger value="guestDivisions">Ospiti e scontistiche</TabsTrigger>
            <TabsTrigger value="bedBlocks">Blocco letti</TabsTrigger>
          </TabsList>

          {/* Componenti delle tab */}
          <BedManagement 
            beds={beds}
            currentTable={currentTable}
            showDialog={showDialog}
            setShowDialog={setShowDialog}
            editMode={editMode}
            setEditMode={setEditMode}
            setCurrentTable={setCurrentTable}
            setCurrentEntity={setCurrentEntity}
            bedForm={bedForm}
            setBedForm={setBedForm}
            handleSave={handleSave}
            handleDelete={handleDelete}
            availableLanguages={availableLanguages}
            isLoadingLanguages={isLoadingLanguages}
          />

          <RoomManagement 
            rooms={rooms}
            currentTable={currentTable}
            showDialog={showDialog}
            setShowDialog={setShowDialog}
            editMode={editMode}
            setEditMode={setEditMode}
            setCurrentTable={setCurrentTable}
            setCurrentEntity={setCurrentEntity}
            roomForm={roomForm}
            setRoomForm={setRoomForm}
            handleSave={handleSave}
            handleDelete={handleDelete}
            availableLanguages={availableLanguages}
            isLoadingLanguages={isLoadingLanguages}
          />

          <BuildingManagement 
            buildings={buildings}
            rooms={rooms}
            currentTable={currentTable}
            showDialog={showDialog}
            setShowDialog={setShowDialog}
            editMode={editMode}
            setEditMode={setEditMode}
            setCurrentTable={setCurrentTable}
            setCurrentEntity={setCurrentEntity}
            buildingForm={buildingForm}
            setBuildingForm={setBuildingForm}
            handleSave={handleSave}
            handleDelete={handleDelete}
          />

          <ServiceManagement 
            services={services}
            currentTable={currentTable}
            showDialog={showDialog}
            setShowDialog={setShowDialog}
            editMode={editMode}
            setEditMode={setEditMode}
            setCurrentTable={setCurrentTable}
            setCurrentEntity={setCurrentEntity}
            serviceForm={serviceForm}
            setServiceForm={setServiceForm}
            handleSave={handleSave}
            handleDelete={handleDelete}
            availableLanguages={availableLanguages}
            isLoadingLanguages={isLoadingLanguages}
          />

          <GuestDivisionManagement 
            guestDivisions={guestDivisions}
            currentTable={currentTable}
            showDialog={showDialog}
            setShowDialog={setShowDialog}
            editMode={editMode}
            setEditMode={setEditMode}
            setCurrentTable={setCurrentTable}
            setCurrentEntity={setCurrentEntity}
            guestDivisionForm={guestDivisionForm}
            setGuestDivisionForm={setGuestDivisionForm}
            handleSave={handleSave}
            handleDelete={handleDelete}
            availableLanguages={availableLanguages}
            isLoadingLanguages={isLoadingLanguages}
          />

          <BedBlockManagement 
            bedBlocks={bedBlocks}
            currentTable={currentTable}
            showDialog={showDialog}
            setShowDialog={setShowDialog}
            editMode={editMode}
            setEditMode={setEditMode}
            setCurrentTable={setCurrentTable}
            setCurrentEntity={setCurrentEntity}
            bedBlockForm={bedBlockForm}
            setBedBlockForm={setBedBlockForm}
            handleSave={handleSave}
            handleDelete={handleDelete}
          />
        </Tabs>

        {/* Dialog per gestire le lingue */}
        <Dialog open={showLanguageManager} onOpenChange={setShowLanguageManager}>
          <DialogContent className="max-h-[90vh] overflow-y-auto min-w-[60vw]">
            <DialogHeader>
              <DialogTitle>Manage Languages</DialogTitle>
              <DialogDescription>
                Add, edit or remove languages for translations.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="languageCode">Language Code (e.g. it, en)</Label>
                  <Input 
                    id="languageCode"
                    value={languageForm.code}
                    onChange={(e) => setLanguageForm({...languageForm, code: e.target.value})}
                    placeholder="it"
                    maxLength={5}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="languageName">Language Name</Label>
                  <Input 
                    id="languageName"
                    value={languageForm.name}
                    onChange={(e) => setLanguageForm({...languageForm, name: e.target.value})}
                    placeholder="Italiano"
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={addLanguageToDb} 
                    disabled={!languageForm.code || !languageForm.name}
                  >
                    Add
                  </Button>
                </div>
              </div>

              <div className="border rounded-md max-h-[50vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableLanguages.map((language) => (
                      <TableRow key={language.id}>
                        <TableCell>{language.code}</TableCell>
                        <TableCell>{language.name}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteLanguageFromDb(language.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {availableLanguages.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                          No languages available. Add one above.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowLanguageManager(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default HotelManagement;