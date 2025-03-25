import React from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { MultiSelect } from "@/components/ui/multi-select"; 
import { Room, Building, EntityType } from '@/app/types';

interface BuildingProps {
  buildings: Building[];
  rooms: Room[];  // Necessario per la selezione delle stanze
  currentTable: string;
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;
  editMode: boolean;
  setEditMode: (edit: boolean) => void;
  setCurrentTable: (table: EntityType) => void;
  setCurrentEntity: (entity: Building | null) => void;
  buildingForm: Omit<Building, 'id' | 'createdAt' | 'updatedAt'>;
  setBuildingForm: React.Dispatch<React.SetStateAction<Omit<Building, 'id' | 'createdAt' | 'updatedAt'>>>;
  handleSave: () => Promise<void>;
  handleDelete: (id: number) => Promise<void>;
}

const BuildingManagement: React.FC<BuildingProps> = ({
  buildings,
  rooms,
  currentTable,
  showDialog,
  setShowDialog,
  editMode,
  setEditMode,
  setCurrentTable,
  setCurrentEntity,
  buildingForm,
  setBuildingForm,
  handleSave,
  handleDelete
}) => {
  return (
    <TabsContent value="buildings">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Buildings Management</h2>
          <Button onClick={() => {
            setCurrentTable('BuildingRegistration');
            setEditMode(false);
            setBuildingForm({
              buildingName: '',
              roomIds: []
            });
            setShowDialog(true);
          }}>
            <Plus className="mr-2 h-4 w-4" /> Add Building
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Building Name</TableHead>
              <TableHead>Rooms Count</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buildings.map((building) => (
              <TableRow key={building.id}>
                <TableCell>{building.buildingName}</TableCell>
                <TableCell>{building.roomIds.length}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setCurrentTable('BuildingRegistration');
                        setCurrentEntity(building);
                        setBuildingForm({
                          buildingName: building.buildingName,
                          roomIds: building.roomIds
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
                      onClick={() => handleDelete(building.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {currentTable === 'BuildingRegistration' && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editMode ? 'Edit' : 'Add'} Building
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Building Name</Label>
                  <Input 
                    value={buildingForm.buildingName}
                    onChange={(e) => setBuildingForm({...buildingForm, buildingName: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Rooms</Label>
                  <MultiSelect 
                    options={rooms.map(room => ({
                      value: room.id.toString(),
                      label: `${room.description} (${room.bedCount} beds)`
                    }))}
                    value={buildingForm.roomIds.map(id => id.toString())}
                    onChange={(values) => setBuildingForm({
                      ...buildingForm, 
                      roomIds: values.map(v => parseInt(v))
                    })}
                    className="w-full"
                  />
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

export default BuildingManagement;