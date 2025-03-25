import React from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Bed, EntityType, LanguageTranslation } from '@/app/types';

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
  handleDelete
}) => {
  // Funzione di utility per verificare se langTrasn è valido
  const hasValidTranslations = (langTrasn: LanguageTranslation[] | null | undefined): boolean => {
    return Array.isArray(langTrasn) && langTrasn.length > 0 && langTrasn[0] !== null;
  };

  // Funzione per resettare il form
  const resetForm = () => {
    setBedForm({
      description: '',
      priceMP: 0,
      priceBandB: 0,
      peopleCount: 0,
      langTrasn: [{
        de: '',
        en: '',
        es: '',
        fr: ''
      }]
    });
  };

  return (
    <TabsContent value="beds">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Beds Management</h2>
          <Button onClick={() => {
            setCurrentTable('Bed');
            setEditMode(false);
            resetForm();
            setShowDialog(true);
          }}>
            <Plus className="mr-2 h-4 w-4" /> Add Bed
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Price MP</TableHead>
              <TableHead>Price B&B</TableHead>
              <TableHead>People Count</TableHead>
              {/* <TableHead>Languages</TableHead> */}
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
                {/* <TableCell>
                  <div className="flex gap-1">
                    {hasValidTranslations(bed.langTrasn) &&
                      Object.keys(bed.langTrasn[0]).map(lang => (
                        <span key={lang} className="px-2 py-1 bg-gray-100 rounded text-xs">
                          {lang}
                        </span>
                      ))
                    }
                  </div>
                </TableCell> */}
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setCurrentTable('Bed');
                        setCurrentEntity(bed);
                        setBedForm({
                          description: bed.description,
                          priceMP: bed.priceMP,
                          priceBandB: bed.priceBandB,
                          peopleCount: bed.peopleCount,
                          langTrasn: hasValidTranslations(bed.langTrasn) ? bed.langTrasn : [{
                            de: '',
                            en: '',
                            es: '',
                            fr: ''
                          }]
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

        {currentTable === 'Bed' && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editMode ? 'Edit' : 'Add'} Bed
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
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
                {/* <div>
                  <Label>Translations</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {hasValidTranslations(bedForm.langTrasn) &&
                      Object.keys(bedForm.langTrasn[0]).map(lang => (
                        <div key={lang}>
                          <Label>{lang.toUpperCase()}</Label>
                          <Input 
                            value={bedForm.langTrasn[0][lang]}
                            onChange={(e) => {
                              const newLangTrasn = [...bedForm.langTrasn];
                              newLangTrasn[0] = {
                                ...newLangTrasn[0],
                                [lang]: e.target.value
                              };
                              setBedForm({...bedForm, langTrasn: newLangTrasn});
                            }}
                          />
                        </div>
                      ))
                    }
                  </div>
                </div> */}
              </div>
              <DialogFooter>
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