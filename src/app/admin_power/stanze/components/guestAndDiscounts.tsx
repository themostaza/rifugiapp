import React, { useState } from 'react';
import { Plus, Trash2, Edit, X, PlusCircle } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { GuestDivision, EntityType, LanguageTranslation, Language } from '@/app/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface GuestDivisionProps {
  guestDivisions: GuestDivision[];
  currentTable: string;
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;
  editMode: boolean;
  setEditMode: (edit: boolean) => void;
  setCurrentTable: (table: EntityType) => void;
  setCurrentEntity: (entity: GuestDivision | null) => void;
  guestDivisionForm: Omit<GuestDivision, 'id' | 'createdAt' | 'updatedAt'>;
  setGuestDivisionForm: React.Dispatch<React.SetStateAction<Omit<GuestDivision, 'id' | 'createdAt' | 'updatedAt'>>>;
  handleSave: () => Promise<void>;
  handleDelete: (id: number) => Promise<void>;
  availableLanguages: Language[];
  isLoadingLanguages: boolean;
}

const GuestDivisionManagement: React.FC<GuestDivisionProps> = ({
  guestDivisions,
  currentTable,
  showDialog,
  setShowDialog,
  editMode,
  setEditMode,
  setCurrentTable,
  setCurrentEntity,
  guestDivisionForm,
  setGuestDivisionForm,
  handleSave,
  handleDelete,
  availableLanguages,
  isLoadingLanguages
}) => {
  // State for managing new languages
  const [newLanguage, setNewLanguage] = useState<string>('');

  // Utility function to check if langTrasn is valid
  const hasValidTranslations = (langTrasn: LanguageTranslation[] | null | undefined): boolean => {
    return Array.isArray(langTrasn) && langTrasn.length > 0 && langTrasn[0] !== null;
  };

  // Function to get the list of populated languages
  const getPopulatedLanguages = (langTrasn: LanguageTranslation[] | null | undefined): string[] => {
    if (!hasValidTranslations(langTrasn)) return [];
    
    // Ensure langTrasn exists and has at least one item before accessing
    const translations = langTrasn?.[0];
    if (!translations) return [];
    
    return Object.entries(translations)
      .filter(([value]) => value && value.trim() !== '')
      .map(([key]) => key);
  };

  // Function to reset the form
  const resetForm = () => {
    // Create an empty object for translations
    const emptyTranslations: LanguageTranslation = {};
    
    // Check if availableLanguages is valid before iterating
    if (Array.isArray(availableLanguages)) {
      availableLanguages.forEach(lang => {
        emptyTranslations[lang.code] = '';
      });
    }

    setGuestDivisionForm({
      description: '',
      title: '',
      ageFrom: 0,
      ageTo: 0,
      salePercent: 0,
      cityTax: false,
      cityTaxPrice: 0,
      langTrasn: [emptyTranslations]
    });
  };

  // Function to add a new language
  const addLanguage = () => {
    if (!newLanguage || !guestDivisionForm.langTrasn?.[0]) return;
    
    // Check if the language already exists
    if (newLanguage in guestDivisionForm.langTrasn[0]) return;
    
    // Add the new language
    const newLangTrasn = [...guestDivisionForm.langTrasn];
    newLangTrasn[0] = {
      ...newLangTrasn[0],
      [newLanguage]: ''
    };
    
    setGuestDivisionForm({...guestDivisionForm, langTrasn: newLangTrasn});
    setNewLanguage(''); // Reset selection
  };

  // Function to remove a language
  const removeLanguage = (lang: string) => {
    if (!guestDivisionForm.langTrasn?.[0]) return;
    
    const newLangTrasn = [...guestDivisionForm.langTrasn];
    const updatedTranslations = { ...newLangTrasn[0] };
    
    // Remove the property
    delete updatedTranslations[lang];
    
    newLangTrasn[0] = updatedTranslations;
    setGuestDivisionForm({...guestDivisionForm, langTrasn: newLangTrasn});
  };

  // Function to get available languages that haven't been added yet
  const getAvailableLanguagesToAdd = () => {
    // Check if availableLanguages exists and is an array
    if (!Array.isArray(availableLanguages)) return [];
    if (!guestDivisionForm.langTrasn?.[0]) return availableLanguages;
    
    const currentLanguages = Object.keys(guestDivisionForm.langTrasn[0]);
    return availableLanguages.filter(lang => !currentLanguages.includes(lang.code));
  };

  // Function to get language name from code
  const getLanguageName = (code: string): string => {
    if (!Array.isArray(availableLanguages)) return code;
    const language = availableLanguages.find(lang => lang.code === code);
    return language ? language.name : code;
  };

  return (
    <TabsContent value="guestDivisions">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Guest Divisions Management</h2>
          <Button onClick={() => {
            setCurrentTable('GuestDivision');
            setEditMode(false);
            resetForm();
            setShowDialog(true);
          }}>
            <Plus className="mr-2 h-4 w-4" /> Add Guest Division
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Age Range</TableHead>
              <TableHead>Sale %</TableHead>
              <TableHead>City Tax</TableHead>
              <TableHead>Tax Price</TableHead>
              <TableHead>Languages</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {guestDivisions.map((division) => (
              <TableRow key={division.id}>
                <TableCell>{division.title}</TableCell>
                <TableCell>{division.ageFrom} - {division.ageTo}</TableCell>
                <TableCell>{division.salePercent}%</TableCell>
                <TableCell>
                  <Switch 
                    checked={division.cityTax} 
                    disabled
                  />
                </TableCell>
                <TableCell>{division.cityTaxPrice}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {getPopulatedLanguages(division.langTrasn).map(lang => (
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
                        setCurrentTable('GuestDivision');
                        setCurrentEntity(division);
                        
                        // Create an object with current translations
                        const currentTranslations = division.langTrasn?.[0] || {};
                        
                        // Make sure there are fields for all available languages
                        const completeTranslations: LanguageTranslation = {};
                        
                        // Check if availableLanguages is valid before iterating
                        if (Array.isArray(availableLanguages)) {
                          availableLanguages.forEach(lang => {
                            completeTranslations[lang.code] = currentTranslations[lang.code] || '';
                          });
                        }
                        
                        // Also add any translations for languages that might no longer be in the list
                        Object.keys(currentTranslations).forEach(langCode => {
                          if (!(langCode in completeTranslations)) {
                            completeTranslations[langCode] = currentTranslations[langCode];
                          }
                        });
                        
                        setGuestDivisionForm({
                          description: division.description,
                          title: division.title,
                          ageFrom: division.ageFrom,
                          ageTo: division.ageTo,
                          salePercent: division.salePercent,
                          cityTax: division.cityTax,
                          cityTaxPrice: division.cityTaxPrice,
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
                      onClick={() => handleDelete(division.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {currentTable === 'GuestDivision' && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="max-h-[90vh] overflow-y-auto min-w-[60vw] md:min-w-[60vw]">
              <DialogHeader>
                <DialogTitle>
                  {editMode ? 'Edit' : 'Add'} Guest Division
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 md:divide-x">
                {/* First column - Main details */}
                <div className="space-y-4 pr-0 md:pr-5">
                  <h3 className="text-sm font-medium text-gray-500">Basic Information</h3>
                  <div>
                    <Label>Title</Label>
                    <Input 
                      value={guestDivisionForm.title}
                      onChange={(e) => setGuestDivisionForm({...guestDivisionForm, title: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input 
                      value={guestDivisionForm.description}
                      onChange={(e) => setGuestDivisionForm({...guestDivisionForm, description: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Age From</Label>
                      <Input 
                        type="number"
                        value={guestDivisionForm.ageFrom}
                        onChange={(e) => setGuestDivisionForm({
                          ...guestDivisionForm, 
                          ageFrom: parseInt(e.target.value) || 0
                        })}
                      />
                    </div>
                    <div>
                      <Label>Age To</Label>
                      <Input 
                        type="number"
                        value={guestDivisionForm.ageTo}
                        onChange={(e) => setGuestDivisionForm({
                          ...guestDivisionForm, 
                          ageTo: parseInt(e.target.value) || 0
                        })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Sale Percentage</Label>
                    <Input 
                      type="number"
                      value={guestDivisionForm.salePercent}
                      onChange={(e) => setGuestDivisionForm({
                        ...guestDivisionForm, 
                        salePercent: parseInt(e.target.value) || 0
                      })}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="cityTax"
                      checked={guestDivisionForm.cityTax}
                      onCheckedChange={(checked) => setGuestDivisionForm({
                        ...guestDivisionForm, 
                        cityTax: checked
                      })}
                    />
                    <Label htmlFor="cityTax">City Tax</Label>
                  </div>
                  {guestDivisionForm.cityTax && (
                    <div>
                      <Label>City Tax Price</Label>
                      <Input 
                        type="number"
                        value={guestDivisionForm.cityTaxPrice}
                        onChange={(e) => setGuestDivisionForm({
                          ...guestDivisionForm, 
                          cityTaxPrice: parseFloat(e.target.value) || 0
                        })}
                      />
                    </div>
                  )}
                </div>

                {/* Second column - Translations */}
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
                    {hasValidTranslations(guestDivisionForm.langTrasn) && 
                      Object.keys(guestDivisionForm.langTrasn[0]).map(lang => (
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
                            value={guestDivisionForm.langTrasn[0][lang] || ''}
                            onChange={(e) => {
                              const newLangTrasn = [...guestDivisionForm.langTrasn];
                              newLangTrasn[0] = {
                                ...newLangTrasn[0],
                                [lang]: e.target.value
                              };
                              setGuestDivisionForm({...guestDivisionForm, langTrasn: newLangTrasn});
                            }}
                            placeholder={`${lang} translation`}
                          />
                        </div>
                      ))
                    }
                    {hasValidTranslations(guestDivisionForm.langTrasn) && Object.keys(guestDivisionForm.langTrasn[0]).length === 0 && (
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

export default GuestDivisionManagement;