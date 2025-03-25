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
import { Service, EntityType } from '@/app/types';

interface ServiceProps {
  services: Service[];
  currentTable: string;
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;
  editMode: boolean;
  setEditMode: (edit: boolean) => void;
  setCurrentTable: (table: EntityType) => void;
  setCurrentEntity: (entity: Service | null) => void;
  serviceForm: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>;
  setServiceForm: React.Dispatch<React.SetStateAction<Omit<Service, 'id' | 'createdAt' | 'updatedAt'>>>;
  handleSave: () => Promise<void>;
  handleDelete: (id: number) => Promise<void>;
}

const ServiceManagement: React.FC<ServiceProps> = ({
  services,
  currentTable,
  showDialog,
  setShowDialog,
  editMode,
  setEditMode,
  setCurrentTable,
  setCurrentEntity,
  serviceForm,
  setServiceForm,
  handleSave,
  handleDelete
}) => {
  return (
    <TabsContent value="services">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Services Management</h2>
          <Button onClick={() => {
            setCurrentTable('Service');
            setEditMode(false);
            setServiceForm({
              description: '',
              price: 0,
              requestQuantity: false,
              langTrasn: [{ de: '', en: '', es: '', fr: '' }]
            });
            setShowDialog(true);
          }}>
            <Plus className="mr-2 h-4 w-4" /> Add Service
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Quantity Required</TableHead>
              <TableHead>Languages</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.id}>
                <TableCell>{service.description}</TableCell>
                <TableCell>{service.price}</TableCell>
                <TableCell>
                  <Switch 
                    checked={service.requestQuantity} 
                    disabled
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {service.langTrasn[0] && Object.keys(service.langTrasn[0]).map(lang => (
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
                        setCurrentTable('Service');
                        setCurrentEntity(service);
                        setServiceForm({
                          description: service.description,
                          price: service.price,
                          requestQuantity: service.requestQuantity,
                          langTrasn: service.langTrasn
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
                      onClick={() => handleDelete(service.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {currentTable === 'Service' && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editMode ? 'Edit' : 'Add'} Service
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Description</Label>
                  <Input 
                    value={serviceForm.description}
                    onChange={(e) => setServiceForm({...serviceForm, description: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Price</Label>
                  <Input 
                    type="number"
                    value={serviceForm.price}
                    onChange={(e) => setServiceForm({...serviceForm, price: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="requestQuantity"
                    checked={serviceForm.requestQuantity}
                    onCheckedChange={(checked) => setServiceForm({...serviceForm, requestQuantity: checked})}
                  />
                  <Label htmlFor="requestQuantity">Require Quantity</Label>
                </div>
                <div>
                  <Label>Translations</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(serviceForm.langTrasn[0]).map(lang => (
                      <div key={lang}>
                        <Label>{lang.toUpperCase()}</Label>
                        <Input 
                          value={serviceForm.langTrasn[0][lang]}
                          onChange={(e) => {
                            const newLangTrasn = [...serviceForm.langTrasn];
                            newLangTrasn[0] = {
                              ...newLangTrasn[0],
                              [lang]: e.target.value
                            };
                            setServiceForm({...serviceForm, langTrasn: newLangTrasn});
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

export default ServiceManagement;