import React, { useState } from 'react';
import { Plus, Trash2, Edit, X, PlusCircle } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Bed, EntityType, LanguageTranslation, Language } from '@/app/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BedManagementProps {
  beds: Bed[];
  currentTable: string;
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;
  editMode: boolean;
  setEditMode: (edit: boolean) => void;
  setCurrentTable: (table: EntityType) => void;
  setCurrentEntity: (entity: Bed | null) => void;
  bedForm: Omit<Bed, 'id' | 'createdAt' | 'updatedAt'>;
  setBedForm: React.Dispatch<React.SetStateAction<Omit<Bed, 'id' | 'createdAt' | 'updatedAt'>>>;
  handleSave: () => Promise<void>;
  handleDelete: (id: number) => Promise<void>;
  availableLanguages: Language[];
  isLoadingLanguages: boolean;
}

const BedManagement: React.FC<BedManagementProps> = ({
  beds,
  currentTable,
  showDialog,
  setShowDialog,
  editMode,
  setEditMode,
  setCurrentTable,
  setCurrentEntity,
  bedForm,
  setBedForm,
  handleSave,
  handleDelete,
  availableLanguages,
  isLoadingLanguages
}) => {
  // State per gestire l'aggiunta di nuove lingue
  const [newLanguage, setNewLanguage] = useState<string>('');

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
    
    return Object.entries(translations)
      .filter(([value]) => value && value.trim() !== '')
      .map(([key]) => key);
  };

  // Funzione per resettare il form
  const resetForm = () => {
    // Crea un oggetto vuoto per le traduzioni
    const emptyTranslations: LanguageTranslation = {};
    availableLanguages.forEach(lang => {
      emptyTranslations[lang.code] = '';
    });

    setBedForm({
      description: '',
      priceMP: 0,
      priceBandB: 0,
      peopleCount: 0,
      langTrasn: [emptyTranslations]
    });
  };

  // Funzione per aggiungere una nuova lingua
  const addLanguage = () => {
    if (!newLanguage || !bedForm.langTrasn?.[0]) return;
    
    // Verifica se la lingua esiste già
    if (newLanguage in bedForm.langTrasn[0]) return;
    
    // Aggiungi la nuova lingua
    const newLangTrasn = [...bedForm.langTrasn];
    newLangTrasn[0] = {
      ...newLangTrasn[0],
      [newLanguage]: ''
    };
    
    setBedForm({...bedForm, langTrasn: newLangTrasn});
    setNewLanguage(''); // Reset della selezione
  };

  // Funzione per rimuovere una lingua
  const removeLanguage = (lang: string) => {
    if (!bedForm.langTrasn?.[0]) return;
    
    const newLangTrasn = [...bedForm.langTrasn];
    const updatedTranslations = { ...newLangTrasn[0] };
    
    // Rimuove la proprietà
    delete updatedTranslations[lang];
    
    newLangTrasn[0] = updatedTranslations;
    setBedForm({...bedForm, langTrasn: newLangTrasn});
  };

  // Funzione per ottenere le lingue disponibili che non sono ancora state aggiunte
  const getAvailableLanguagesToAdd = () => {
    if (!bedForm.langTrasn?.[0]) return availableLanguages;
    
    const currentLanguages = Object.keys(bedForm.langTrasn[0]);
    return availableLanguages.filter(lang => !currentLanguages.includes(lang.code));
  };

  // Funzione per ottenere il nome della lingua dal codice
  const getLanguageName = (code: string): string => {
    const language = availableLanguages.find(lang => lang.code === code);
    return language ? language.name : code;
  };

  return (
    <TabsContent value="beds">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Beds Management</h2>
          <div className="flex gap-2">
            <Button onClick={() => {
              setCurrentTable('Bed');
              setEditMode(false);
              resetForm();
              setShowDialog(true);
            }}>
              <Plus className="mr-2 h-4 w-4" /> Add Bed
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Price MP</TableHead>
              <TableHead>Price B&B</TableHead>
              <TableHead>People Count</TableHead>
              <TableHead>Languages</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {beds.map((bed) => (
              <TableRow key={bed.id}>
                <TableCell>{bed.description}</TableCell>
                <TableCell>{bed.priceMP}</TableCell>
                <TableCell>{bed.priceBandB}</TableCell>
                <TableCell>{bed.peopleCount}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {getPopulatedLanguages(bed.langTrasn).map(lang => (
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
                        setCurrentTable('Bed');
                        setCurrentEntity(bed);
                        
                        // Crea un oggetto con le traduzioni attuali
                        const currentTranslations = bed.langTrasn?.[0] || {};
                        
                        // Assicurati che ci siano campi per tutte le lingue disponibili
                        const completeTranslations: LanguageTranslation = {};
                        availableLanguages.forEach(lang => {
                          completeTranslations[lang.code] = currentTranslations[lang.code] || '';
                        });
                        
                        // Aggiungi anche eventuali traduzioni per lingue che potrebbero non essere più nell'elenco
                        Object.keys(currentTranslations).forEach(langCode => {
                          if (!(langCode in completeTranslations)) {
                            completeTranslations[langCode] = currentTranslations[langCode];
                          }
                        });
                        
                        setBedForm({
                          description: bed.description,
                          priceMP: bed.priceMP,
                          priceBandB: bed.priceBandB,
                          peopleCount: bed.peopleCount,
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
                      onClick={() => handleDelete(bed.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Form dialog per aggiunta/modifica letti */}
        {currentTable === 'Bed' && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="max-h-[90vh] overflow-y-auto min-w-[60vw] md:min-w-[60vw]">
              <DialogHeader>
                <DialogTitle>
                  {editMode ? 'Edit' : 'Add'} Bed
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 md:divide-x">
                {/* Prima colonna - Dettagli principali */}
                <div className="space-y-4 pr-0 md:pr-5">
                  <h3 className="text-sm font-medium text-gray-500">Basic Information</h3>
                  <div>
                    <Label>Description</Label>
                    <Input 
                      value={bedForm.description}
                      onChange={(e) => setBedForm({...bedForm, description: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Price MP</Label>
                    <Input 
                      type="number"
                      value={bedForm.priceMP}
                      onChange={(e) => setBedForm({...bedForm, priceMP: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <Label>Price B&B</Label>
                    <Input 
                      type="number"
                      value={bedForm.priceBandB}
                      onChange={(e) => setBedForm({...bedForm, priceBandB: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <Label>People Count</Label>
                    <Input 
                      type="number"
                      value={bedForm.peopleCount}
                      onChange={(e) => setBedForm({...bedForm, peopleCount: parseInt(e.target.value) || 0})}
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
                    {hasValidTranslations(bedForm.langTrasn) && 
                      Object.keys(bedForm.langTrasn[0]).map(lang => (
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
                            value={bedForm.langTrasn[0][lang] || ''}
                            onChange={(e) => {
                              const newLangTrasn = [...bedForm.langTrasn];
                              newLangTrasn[0] = {
                                ...newLangTrasn[0],
                                [lang]: e.target.value
                              };
                              setBedForm({...bedForm, langTrasn: newLangTrasn});
                            }}
                            placeholder={`${lang} translation`}
                          />
                        </div>
                      ))
                    }
                    {hasValidTranslations(bedForm.langTrasn) && Object.keys(bedForm.langTrasn[0]).length === 0 && (
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
      </Card>
    </TabsContent>
  );
};

export default BedManagement;