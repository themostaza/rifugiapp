import React from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Room, EntityType } from '@/app/types';

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
  handleDelete
}) => {
  return (
    <TabsContent value="rooms">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Rooms Management</h2>
          <Button onClick={() => {
            setCurrentTable('Room');
            setEditMode(false);
            setRoomForm({
              description: '',
              bedCount: 0,
              langTrasn: [{ de: '', en: '', es: '', fr: '' }]
            });
            setShowDialog(true);
          }}>
            <Plus className="mr-2 h-4 w-4" /> Add Room
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Bed Count</TableHead>
              <TableHead>Languages</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((room) => (
              <TableRow key={room.id}>
                <TableCell>{room.description}</TableCell>
                <TableCell>{room.bedCount}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {room.langTrasn[0] && Object.keys(room.langTrasn[0]).map(lang => (
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
                        setCurrentTable('Room');
                        setCurrentEntity(room);
                        setRoomForm({
                          description: room.description,
                          bedCount: room.bedCount,
                          langTrasn: room.langTrasn
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

        {currentTable === 'Room' && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editMode ? 'Edit' : 'Add'} Room
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Description</Label>
                  <Input 
                    value={roomForm.description}
                    onChange={(e) => setRoomForm({...roomForm, description: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Bed Count</Label>
                  <Input 
                    type="number"
                    value={roomForm.bedCount}
                    onChange={(e) => setRoomForm({...roomForm, bedCount: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <Label>Translations</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(roomForm.langTrasn[0]).map(lang => (
                      <div key={lang}>
                        <Label>{lang.toUpperCase()}</Label>
                        <Input 
                          value={roomForm.langTrasn[0][lang]}
                          onChange={(e) => {
                            const newLangTrasn = [...roomForm.langTrasn];
                            newLangTrasn[0] = {
                              ...newLangTrasn[0],
                              [lang]: e.target.value
                            };
                            setRoomForm({...roomForm, langTrasn: newLangTrasn});
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

export default RoomManagement;