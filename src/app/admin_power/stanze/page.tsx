'use client'

import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from '@/lib/supabase';

// Importa i componenti delle tab
import BedBlockManagement from './components/bedBlocks';
import RoomManagement from './components/rooms';
import BuildingManagement from './components/buildings';
import ServiceManagement from './components/services';
import GuestDivisionManagement from './components/guestAndDiscounts';
import BedManagement from './components/bed';
import { Bed, Room, Building, Service, GuestDivision, BedBlock, EntityType } from '@/app/types';

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

  // Form states per ogni tipo di entità
  const [bedForm, setBedForm] = useState<Omit<Bed, 'id' | 'createdAt' | 'updatedAt'>>({
    description: '',
    priceMP: 0,
    priceBandB: 0,
    peopleCount: 0,
    langTrasn: [{ de: '', en: '', es: '', fr: '' }]
  });

  const [roomForm, setRoomForm] = useState<Omit<Room, 'id' | 'createdAt' | 'updatedAt'>>({
    description: '',
    bedCount: 0,
    langTrasn: [{ de: '', en: '', es: '', fr: '' }]
  });

  const [buildingForm, setBuildingForm] = useState<Omit<Building, 'id' | 'createdAt' | 'updatedAt'>>({
    buildingName: '',
    roomIds: []
  });

  const [serviceForm, setServiceForm] = useState<Omit<Service, 'id' | 'createdAt' | 'updatedAt'>>({
    description: '',
    price: 0,
    requestQuantity: false,
    langTrasn: [{ de: '', en: '', es: '', fr: '' }]
  });

  const [guestDivisionForm, setGuestDivisionForm] = useState<Omit<GuestDivision, 'id' | 'createdAt' | 'updatedAt'>>({
    description: '',
    title: '',
    ageFrom: 0,
    ageTo: 0,
    salePercent: 0,
    cityTax: false,
    cityTaxPrice: 0,
    langTrasn: [{ de: '', en: '', es: '', fr: '' }]
  });

  const [bedBlockForm, setBedBlockForm] = useState<Omit<BedBlock, 'id' | 'createdAt' | 'updatedAt'>>({
    description: '',
    price: 0
  });

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
  }, []);

  return (
    <div className="flex h-screen bg-gray-100">
      <main className="flex-1 p-8">
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
      </main>
    </div>
  );
};

export default HotelManagement;