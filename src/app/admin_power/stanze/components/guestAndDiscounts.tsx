import React from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { GuestDivision, EntityType } from '@/app/types';

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
  handleDelete
}) => {
  return (
    <TabsContent value="guestDivisions">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Guest Divisions Management</h2>
          <Button onClick={() => {
            setCurrentTable('GuestDivision');
            setEditMode(false);
            setGuestDivisionForm({
              description: '',
              title: '',
              ageFrom: 0,
              ageTo: 0,
              salePercent: 0,
              cityTax: false,
              cityTaxPrice: 0,
              langTrasn: [{ de: '', en: '', es: '', fr: '' }]
            });
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
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setCurrentTable('GuestDivision');
                        setCurrentEntity(division);
                        setGuestDivisionForm({
                          description: division.description,
                          title: division.title,
                          ageFrom: division.ageFrom,
                          ageTo: division.ageTo,
                          salePercent: division.salePercent,
                          cityTax: division.cityTax,
                          cityTaxPrice: division.cityTaxPrice,
                          langTrasn: division.langTrasn
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editMode ? 'Edit' : 'Add'} Guest Division
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
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
                <div>
                  <Label>Translations</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(guestDivisionForm.langTrasn[0]).map(lang => (
                      <div key={lang}>
                        <Label>{lang.toUpperCase()}</Label>
                        <Input 
                          value={guestDivisionForm.langTrasn[0][lang]}
                          onChange={(e) => {
                            const newLangTrasn = [...guestDivisionForm.langTrasn];
                            newLangTrasn[0] = {
                              ...newLangTrasn[0],
                              [lang]: e.target.value
                            };
                            setGuestDivisionForm({...guestDivisionForm, langTrasn: newLangTrasn});
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDialog(false)}>
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