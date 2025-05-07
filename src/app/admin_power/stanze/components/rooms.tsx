import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, X, PlusCircle, Bed, Image as ImageIcon } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Room, EntityType, LanguageTranslation, Language, RoomLinkBed, Bed as BedType } from '@/app/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from '@/lib/supabase';

// Define RoomImage type
interface RoomImage {
  id: number;
  url: string;
  roomId: number;
  createdAt?: string;
  updatedAt?: string;
}

interface RoomProps {
  rooms: Room[];
  currentTable: string;
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;
  editMode: boolean;
  setEditMode: (edit: boolean) => void;
  setCurrentTable: (table: EntityType) => void;
  setCurrentEntity: (entity: Room | null) => void;
  roomForm: Omit<Room, 'id' | 'createdAt' | 'updatedAt'>;
  setRoomForm: React.Dispatch<React.SetStateAction<Omit<Room, 'id' | 'createdAt' | 'updatedAt'>>>;
  handleSave: () => Promise<void>;
  handleDelete: (id: number) => Promise<void>;
  availableLanguages?: Language[];
  isLoadingLanguages?: boolean;
}

const RoomManagement: React.FC<RoomProps> = ({
  rooms,
  currentTable,
  showDialog,
  setShowDialog,
  editMode,
  setEditMode,
  setCurrentTable,
  setCurrentEntity,
  roomForm,
  setRoomForm,
  handleSave,
  handleDelete,
  availableLanguages = [],
  isLoadingLanguages = false
}) => {
  // State per gestire l'aggiunta di nuove lingue
  const [newLanguage, setNewLanguage] = useState<string>('');

  // State for bed management
  const [showBedDialog, setShowBedDialog] = useState(false);
  const [currentRoomForBeds, setCurrentRoomForBeds] = useState<Room | null>(null);
  const [roomBeds, setRoomBeds] = useState<RoomLinkBed[]>([]);
  const [availableBeds, setAvailableBeds] = useState<BedType[]>([]);
  const [isLoadingBeds, setIsLoadingBeds] = useState(false);
  const [showAddBedDialog, setShowAddBedDialog] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState<number | null>(null);
  const [bedNameInput, setBedNameInput] = useState('');
  const [bedLangTrasn, setBedLangTrasn] = useState<LanguageTranslation[]>([{}]);
  const [editBedMode, setEditBedMode] = useState(false);
  const [currentBedForEdit, setCurrentBedForEdit] = useState<RoomLinkBed | null>(null);

  // State for image management
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [currentRoomForImages, setCurrentRoomForImages] = useState<Room | null>(null);
  const [roomImages, setRoomImages] = useState<RoomImage[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Funzione di utility per verificare se langTrasn è valido
  const hasValidTranslations = (langTrasn: LanguageTranslation[] | null | undefined): boolean => {
    return Array.isArray(langTrasn) && langTrasn.length > 0 && langTrasn[0] !== null;
  };

  // Funzione per ottenere la lista delle lingue compilate
  const getPopulatedLanguages = (langTrasn: LanguageTranslation[] | null | undefined): string[] => {
    if (!hasValidTranslations(langTrasn)) return [];
    
    // Ensure langTrasn exists and has at least one item before accessing
    const translations = langTrasn?.[0];
    if (!translations) return [];
    
    return Object.entries(translations || {})
      .filter(([value]) => value && value.trim() !== '')
      .map(([key]) => key);
  };

  // Funzione per resettare il form
  const resetForm = () => {
    // Crea un oggetto vuoto per le traduzioni
    const emptyTranslations: LanguageTranslation = {};
    
    // Se ci sono lingue disponibili, inizializza i campi vuoti per ciascuna
    if (availableLanguages && availableLanguages.length > 0) {
      availableLanguages.forEach(lang => {
        emptyTranslations[lang.code] = '';
      });
    } else {
      // Fallback a un oggetto vuoto o con lingue predefinite se necessario
      emptyTranslations['en'] = '';
    }

    setRoomForm({
      description: '',
      bedCount: 0,
      langTrasn: [emptyTranslations]
    });
  };

  // Funzione per aggiungere una nuova lingua
  const addLanguage = () => {
    if (!newLanguage || !roomForm.langTrasn?.[0]) return;
    
    // Verifica se la lingua esiste già
    if (newLanguage in roomForm.langTrasn[0]) return;
    
    // Aggiungi la nuova lingua
    const newLangTrasn = [...roomForm.langTrasn];
    newLangTrasn[0] = {
      ...newLangTrasn[0],
      [newLanguage]: ''
    };
    
    setRoomForm({...roomForm, langTrasn: newLangTrasn});
    setNewLanguage(''); // Reset della selezione
  };

  // Funzione per rimuovere una lingua
  const removeLanguage = (lang: string) => {
    if (!roomForm.langTrasn?.[0]) return;
    
    const newLangTrasn = [...roomForm.langTrasn];
    const updatedTranslations = { ...newLangTrasn[0] };
    
    // Rimuove la proprietà
    delete updatedTranslations[lang];
    
    newLangTrasn[0] = updatedTranslations;
    setRoomForm({...roomForm, langTrasn: newLangTrasn});
  };

  // Funzione per ottenere le lingue disponibili che non sono ancora state aggiunte alla stanza
  const getAvailableLanguagesToAdd = () => {
    if (!availableLanguages || availableLanguages.length === 0) return [];
    if (!roomForm.langTrasn?.[0]) return availableLanguages;
    
    const currentLanguages = Object.keys(roomForm.langTrasn[0] || {});
    return availableLanguages.filter(lang => !currentLanguages.includes(lang.code));
  };

  // Funzione per ottenere le lingue disponibili che non sono ancora state aggiunte al letto
  const getAvailableBedLanguagesToAdd = () => {
    if (!availableLanguages || availableLanguages.length === 0) return [];
    if (!bedLangTrasn?.[0]) return availableLanguages;
    
    const currentLanguages = Object.keys(bedLangTrasn[0] || {});
    return availableLanguages.filter(lang => !currentLanguages.includes(lang.code));
  };

  // Funzione per ottenere il nome della lingua dal codice
  const getLanguageName = (code: string): string => {
    if (!availableLanguages || availableLanguages.length === 0) return code;
    const language = availableLanguages.find(lang => lang.code === code);
    return language ? language.name : code;
  };

  // Funzioni per la gestione dei letti nella stanza
  const fetchRoomBeds = async (roomId: number) => {
    setIsLoadingBeds(true);
    try {
      const { data, error } = await supabase
        .from('RoomLinkBed')
        .select(`
          *,
          Bed (*)
        `)
        .eq('roomId', roomId);
      
      if (error) throw error;
      setRoomBeds(data || []);
    } catch (error) {
      console.error('Error fetching room beds:', error);
    } finally {
      setIsLoadingBeds(false);
    }
  };

  const fetchAvailableBeds = async () => {
    try {
      const { data, error } = await supabase
        .from('Bed')
        .select('*')
        .order('description', { ascending: true });
      
      if (error) throw error;
      setAvailableBeds(data || []);
    } catch (error) {
      console.error('Error fetching available beds:', error);
    }
  };

  // Reset bed form
  const resetBedForm = () => {
    setBedNameInput('');
    setSelectedBedId(null);
    
    // Reset translations
    const emptyTranslations: LanguageTranslation = {};
    
    if (availableLanguages && availableLanguages.length > 0) {
      availableLanguages.forEach(lang => {
        emptyTranslations[lang.code] = '';
      });
    } else {
      emptyTranslations['en'] = '';
    }
    
    setBedLangTrasn([emptyTranslations]);
    setEditBedMode(false);
    setCurrentBedForEdit(null);
  };

  // Add a new bed to the room
  const handleAddBed = async () => {
    if (!currentRoomForBeds || !selectedBedId) return;
    
    try {
      const newBed = {
        roomId: currentRoomForBeds.id,
        bedId: selectedBedId,
        name: bedNameInput,
        langTrasn: bedLangTrasn
      };
      
      if (editBedMode && currentBedForEdit) {
        // Update existing bed
        const { error } = await supabase
          .from('RoomLinkBed')
          .update(newBed)
          .eq('id', currentBedForEdit.id);
        
        if (error) throw error;
      } else {
        // Add new bed
        const { error } = await supabase
          .from('RoomLinkBed')
          .insert([newBed]);
        
        if (error) throw error;
      }
      
      // Refresh the bed list
      await fetchRoomBeds(currentRoomForBeds.id);
      
      // Reset the form and close dialog
      resetBedForm();
      setShowAddBedDialog(false);
    } catch (error) {
      console.error('Error saving bed:', error);
    }
  };

  // Delete a bed from the room
  const handleDeleteBed = async (id: number) => {
    if (!confirm('Are you sure you want to delete this bed from the room?')) return;
    
    try {
      const { error } = await supabase
        .from('RoomLinkBed')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Refresh the bed list
      if (currentRoomForBeds) {
        await fetchRoomBeds(currentRoomForBeds.id);
      }
    } catch (error) {
      console.error('Error deleting bed:', error);
    }
  };

  // Edit a bed
  const handleEditBed = (bed: RoomLinkBed) => {
    setEditBedMode(true);
    setCurrentBedForEdit(bed);
    setBedNameInput(bed.name || '');
    setSelectedBedId(bed.bedId);
    
    // Set translations
    if (bed.langTrasn && bed.langTrasn.length > 0) {
      setBedLangTrasn(bed.langTrasn);
    } else {
      // Default empty translations
      const emptyTranslations: LanguageTranslation = {};
      
      if (availableLanguages && availableLanguages.length > 0) {
        availableLanguages.forEach(lang => {
          emptyTranslations[lang.code] = '';
        });
      } else {
        emptyTranslations['en'] = '';
      }
      
      setBedLangTrasn([emptyTranslations]);
    }
    
    setShowAddBedDialog(true);
  };

  // Funzione per aggiungere una nuova lingua al letto
  const addBedLanguage = () => {
    if (!newLanguage || !bedLangTrasn?.[0]) return;
    
    // Verifica se la lingua esiste già
    if (newLanguage in bedLangTrasn[0]) return;
    
    // Aggiungi la nuova lingua
    const newLangTrasn = [...bedLangTrasn];
    newLangTrasn[0] = {
      ...newLangTrasn[0],
      [newLanguage]: ''
    };
    
    setBedLangTrasn(newLangTrasn);
    setNewLanguage(''); // Reset della selezione
  };

  // Functions for image management
  const fetchRoomImages = async (roomId: number) => {
    setIsLoadingImages(true);
    try {
      const { data, error } = await supabase
        .from('RoomImage')
        .select('*')
        .eq('roomId', roomId)
        .order('createdAt', { ascending: false });
      
      if (error) throw error;
      setRoomImages(data || []);
    } catch (error) {
      console.error('Error fetching room images:', error);
    } finally {
      setIsLoadingImages(false);
    }
  };

  const handleDeleteImage = async (id: number, url: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;
    
    try {
      // First delete from storage
      const path = url.split('/').pop(); // Extract filename from URL
      if (path) {
        const { error: storageError } = await supabase.storage
          .from('roomimage')
          .remove([path]);
        
        if (storageError) console.error('Error deleting from storage:', storageError);
      }
      
      // Then delete from database
      const { error } = await supabase
        .from('RoomImage')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Refresh image list
      if (currentRoomForImages) {
        await fetchRoomImages(currentRoomForImages.id);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !currentRoomForImages) return;

    setUploadingImage(true);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Create a unique filename
        const timestamp = new Date().getTime();
        const fileExt = file.name.split('.').pop();
        const fileName = `room_${currentRoomForImages.id}_${timestamp}.${fileExt}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('roomimage')
          .upload(fileName, file);
        
        if (uploadError) throw uploadError;
        
        // Get the public URL
        const { data: publicUrlData } = supabase.storage
          .from('roomimage')
          .getPublicUrl(fileName);
        
        if (!publicUrlData || !publicUrlData.publicUrl) {
          throw new Error('Failed to get public URL');
        }
        
        // Add to RoomImage table
        const { error: dbError } = await supabase
          .from('RoomImage')
          .insert([{
            url: publicUrlData.publicUrl,
            roomId: currentRoomForImages.id
          }]);
        
        if (dbError) throw dbError;
      }
      
      // Refresh image list
      await fetchRoomImages(currentRoomForImages.id);
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setUploadingImage(false);
      // Clear input
      if (event.target) event.target.value = '';
    }
  };

  // Load beds when dialog opens
  useEffect(() => {
    if (showBedDialog && currentRoomForBeds) {
      fetchRoomBeds(currentRoomForBeds.id);
      fetchAvailableBeds();
    }
  }, [showBedDialog, currentRoomForBeds]);

  // Load images when dialog opens
  useEffect(() => {
    if (showImageDialog && currentRoomForImages) {
      fetchRoomImages(currentRoomForImages.id);
    }
  }, [showImageDialog, currentRoomForImages]);

  return (
    <TabsContent value="rooms">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Rooms Management</h2>
          <Button onClick={() => {
            setCurrentTable('Room');
            setEditMode(false);
            resetForm();
            setShowDialog(true);
          }}>
            <Plus className="mr-2 h-4 w-4" /> Add Room
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Languages</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((room) => (
              <TableRow key={room.id}>
                <TableCell>{room.description}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {getPopulatedLanguages(room.langTrasn).map(lang => (
                      <span key={lang} className="px-2 py-1 bg-gray-100 rounded text-xs">
                        {lang}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setCurrentRoomForImages(room);
                        setShowImageDialog(true);
                      }}
                    >
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setCurrentRoomForBeds(room);
                        setShowBedDialog(true);
                      }}
                    >
                      <Bed className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setCurrentTable('Room');
                        setCurrentEntity(room);
                        
                        // Crea un oggetto con le traduzioni attuali
                        const currentTranslations = room.langTrasn && room.langTrasn[0] ? room.langTrasn[0] : {};
                        
                        // Assicurati che ci siano campi per tutte le lingue disponibili
                        const completeTranslations: LanguageTranslation = {};
                        if (availableLanguages && availableLanguages.length > 0) {
                          availableLanguages.forEach(lang => {
                            completeTranslations[lang.code] = currentTranslations[lang.code] || '';
                          });
                          
                          // Aggiungi anche eventuali traduzioni per lingue che potrebbero non essere più nell'elenco
                          Object.keys(currentTranslations).forEach(langCode => {
                            if (!(langCode in completeTranslations)) {
                              completeTranslations[langCode] = currentTranslations[langCode];
                            }
                          });
                        } else if (Object.keys(currentTranslations).length > 0) {
                          // Se non ci sono lingue disponibili ma ci sono traduzioni esistenti, usale direttamente
                          Object.assign(completeTranslations, currentTranslations);
                        } else {
                          // Fallback se non ci sono né lingue disponibili né traduzioni esistenti
                          completeTranslations['en'] = '';
                        }
                        
                        setRoomForm({
                          description: room.description,
                          bedCount: room.bedCount,
                          langTrasn: [completeTranslations]
                        });
                        
                        setEditMode(true);
                        setShowDialog(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(room.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Form dialog per aggiunta/modifica stanze */}
        {currentTable === 'Room' && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="max-h-[90vh] overflow-y-auto min-w-[60vw] md:min-w-[60vw]">
              <DialogHeader>
                <DialogTitle>
                  {editMode ? 'Edit' : 'Add'} Room
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 md:divide-x">
                {/* Prima colonna - Dettagli principali */}
                <div className="space-y-4 pr-0 md:pr-5">
                  <h3 className="text-sm font-medium text-gray-500">Basic Information</h3>
                  <div>
                    <Label>Description</Label>
                    <Input 
                      value={roomForm.description}
                      onChange={(e) => setRoomForm({...roomForm, description: e.target.value})}
                    />
                  </div>
                </div>

                {/* Seconda colonna - Traduzioni */}
                <div className="pl-0 md:pl-5 mt-6 md:mt-0">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-medium text-gray-500">Language Translations</h3>
                    <div className="flex items-center gap-2">
                      <Select value={newLanguage} onValueChange={setNewLanguage} disabled={isLoadingLanguages || getAvailableLanguagesToAdd().length === 0}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder={
                            isLoadingLanguages 
                              ? "Loading..." 
                              : getAvailableLanguagesToAdd().length === 0 
                                ? "No more languages" 
                                : "Add language"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableLanguagesToAdd().map((lang) => (
                            <SelectItem key={lang.id} value={lang.code}>
                              {lang.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        type="button" 
                        size="sm" 
                        onClick={addLanguage}
                        disabled={!newLanguage || isLoadingLanguages}
                      >
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                    {hasValidTranslations(roomForm.langTrasn) && 
                      Object.keys(roomForm.langTrasn[0] || {}).map(lang => (
                        <div key={lang} className="relative space-y-1 border-b pb-2 last:border-0">
                          <div className="flex justify-between items-center">
                            <Label className="text-xs uppercase">
                              {getLanguageName(lang)} ({lang})
                            </Label>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0" 
                              onClick={() => removeLanguage(lang)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <Input 
                            value={(roomForm.langTrasn?.[0]?.[lang]) || ''}
                            onChange={(e) => {
                              const newLangTrasn = [...(roomForm.langTrasn || [{}])];
                              newLangTrasn[0] = {
                                ...(newLangTrasn[0] || {}),
                                [lang]: e.target.value
                              };
                              setRoomForm({...roomForm, langTrasn: newLangTrasn});
                            }}
                            placeholder={`${lang} translation`}
                          />
                        </div>
                      ))
                    }
                    {hasValidTranslations(roomForm.langTrasn) && Object.keys(roomForm.langTrasn[0] || {}).length === 0 && (
                      <div className="text-center py-4 text-muted-foreground">
                        No languages added. Add one using the dropdown above.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => {
                  setShowDialog(false);
                  if (!editMode) {
                    resetForm();
                  }
                }}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        
        {/* Dialog di gestione letti nella stanza */}
        <Dialog open={showBedDialog} onOpenChange={setShowBedDialog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto min-w-[60vw] md:min-w-[60vw]">
            <DialogHeader>
              <DialogTitle>Gestione letti</DialogTitle>
            </DialogHeader>
            
            <div className="mt-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">
                  Letti in questa stanza {currentRoomForBeds && `(${currentRoomForBeds.description})`}
                </h3>
                <Button onClick={() => {
                  resetBedForm();
                  setShowAddBedDialog(true);
                }}>
                  <Plus className="mr-2 h-4 w-4" /> Aggiungi letto
                </Button>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome letto</TableHead>
                    <TableHead>Tipologia letto</TableHead>
                    <TableHead>Max occupanti letto</TableHead>
                    <TableHead>Traduzioni</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingBeds ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">Caricamento...</TableCell>
                    </TableRow>
                  ) : roomBeds.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">Nessun letto in questa stanza</TableCell>
                    </TableRow>
                  ) : (
                    roomBeds.map((bed) => (
                      <TableRow key={bed.id}>
                        <TableCell>
                          <div className="relative group">
                            <Input
                              value={bed.name || ''}
                              className="cursor-pointer hover:border-primary focus:border-primary transition-colors pr-8"
                              onClick={() => handleEditBed(bed)}
                              readOnly
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
                              {/* <Edit className="h-3 w-3" /> */}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="relative group">
                            <Select
                              value={bed.bedId.toString()}
                              disabled
                              onValueChange={() => {}}
                            >
                              <SelectTrigger className="cursor-pointer hover:border-primary focus:border-primary transition-colors pr-8" onClick={() => handleEditBed(bed)}>
                                <SelectValue>{bed.Bed?.description || 'N/A'}</SelectValue>
                                {/* <Edit className="h-3 w-3 ml-2" /> */}
                              </SelectTrigger>
                              <SelectContent>
                                {availableBeds.map((bedType) => (
                                  <SelectItem key={bedType.id} value={bedType.id.toString()}>
                                    {bedType.description}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {bed.Bed?.peopleCount || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 cursor-pointer hover:bg-gray-50 rounded p-1 transition-colors" onClick={() => handleEditBed(bed)}>
                            {getPopulatedLanguages(bed.langTrasn).length > 0 ? (
                              getPopulatedLanguages(bed.langTrasn).map(lang => (
                                <span key={lang} className="px-2 py-1 bg-gray-100 rounded text-xs">
                                  {lang}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Clicca per aggiungere traduzioni</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditBed(bed)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteBed(bed.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Dialog di aggiunta/modifica letto */}
        <Dialog open={showAddBedDialog} onOpenChange={setShowAddBedDialog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto min-w-[60vw] md:min-w-[60vw]">
            <DialogHeader>
              <DialogTitle>{editBedMode ? 'Modifica' : 'Aggiungi'} letto</DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 md:divide-x">
              {/* Prima colonna - Dettagli principali */}
              <div className="space-y-4 pr-0 md:pr-5">
                <h3 className="text-sm font-medium text-gray-500">Informazioni di base</h3>
                <div className="space-y-4">
                  <div>
                    <Label>Nome letto</Label>
                    <Input
                      value={bedNameInput}
                      onChange={(e) => setBedNameInput(e.target.value)}
                      placeholder="Inserisci nome del letto"
                    />
                  </div>
                  
                  <div>
                    <Label>Tipologia letto</Label>
                    <Select
                      value={selectedBedId?.toString() || ''}
                      onValueChange={(value: string) => setSelectedBedId(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona tipologia letto" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBeds.map((bed) => (
                          <SelectItem key={bed.id} value={bed.id.toString()}>
                            {bed.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              {/* Seconda colonna - Traduzioni */}
              <div className="pl-0 md:pl-5 mt-6 md:mt-0">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-medium text-gray-500">Traduzioni</h3>
                  <div className="flex items-center gap-2">
                    <Select value={newLanguage} onValueChange={setNewLanguage} disabled={isLoadingLanguages || getAvailableBedLanguagesToAdd().length === 0}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder={
                          isLoadingLanguages 
                            ? "Loading..." 
                            : getAvailableBedLanguagesToAdd().length === 0 
                              ? "No more languages" 
                              : "Add language"
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableBedLanguagesToAdd().map((lang) => (
                          <SelectItem key={lang.id} value={lang.code}>
                            {lang.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      type="button" 
                      size="sm" 
                      onClick={addBedLanguage}
                      disabled={!newLanguage || isLoadingLanguages}
                    >
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                  {hasValidTranslations(bedLangTrasn) && 
                    Object.keys(bedLangTrasn[0] || {}).map(lang => (
                      <div key={lang} className="relative space-y-1 border-b pb-2 last:border-0">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs uppercase">
                            {getLanguageName(lang)} ({lang})
                          </Label>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 w-6 p-0" 
                            onClick={() => {
                              if (!bedLangTrasn[0]) return;
                              
                              const newLangTrasn = [...bedLangTrasn];
                              const updatedTranslations = { ...newLangTrasn[0] };
                              
                              delete updatedTranslations[lang];
                              
                              newLangTrasn[0] = updatedTranslations;
                              setBedLangTrasn(newLangTrasn);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <Input 
                          value={(bedLangTrasn?.[0]?.[lang]) || ''}
                          onChange={(e) => {
                            const newLangTrasn = [...(bedLangTrasn || [{}])];
                            newLangTrasn[0] = {
                              ...(newLangTrasn[0] || {}),
                              [lang]: e.target.value
                            };
                            setBedLangTrasn(newLangTrasn);
                          }}
                          placeholder={`${lang} translation`}
                        />
                      </div>
                    ))
                  }
                  {hasValidTranslations(bedLangTrasn) && Object.keys(bedLangTrasn[0] || {}).length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      Nessuna lingua aggiunta. Aggiungine una utilizzando il menu a tendina sopra.
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => {
                setShowAddBedDialog(false);
                resetBedForm();
              }}>
                Annulla
              </Button>
              <Button 
                onClick={handleAddBed}
                disabled={!selectedBedId || !bedNameInput.trim()}
              >
                {editBedMode ? 'Aggiorna' : 'Salva'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Dialog for image management */}
        <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto min-w-[60vw] md:min-w-[60vw]">
            <DialogHeader>
              <DialogTitle>Gestione immagini</DialogTitle>
            </DialogHeader>
            
            <div className="mt-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">
                  Immagini della stanza {currentRoomForImages && `(${currentRoomForImages.description})`}
                </h3>
                <div>
                  <label htmlFor="image-upload" className={`cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <Plus className="mr-2 h-4 w-4" /> Aggiungi immagine
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                  </label>
                </div>
              </div>
              
              {isLoadingImages ? (
                <div className="text-center py-8">Caricamento immagini...</div>
              ) : roomImages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nessuna immagine disponibile per questa stanza
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {roomImages.map((image) => (
                    <div key={image.id} className="relative group border rounded-lg overflow-hidden">
                      {/* Image preview */}
                      <div className="aspect-video bg-gray-100 relative">
                        <img 
                          src={image.url} 
                          alt={`Room image ${image.id}`}
                          className="object-cover w-full h-full"
                        />
                        
                        {/* Delete button overlay */}
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteImage(image.id, image.url)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Image URL */}
                      <div className="p-2 text-xs truncate text-muted-foreground">
                        {image.url.split('/').pop()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </Card>
    </TabsContent>
  );
};

export default RoomManagement;