import React from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { BedBlock, EntityType} from "@/app/types"


interface BedBlockProps {
  bedBlocks: BedBlock[];
  currentTable: string;
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;
  editMode: boolean;
  setEditMode: (edit: boolean) => void;
  setCurrentTable: (table: EntityType) => void;
  setCurrentEntity: (entity: BedBlock | null) => void;
  bedBlockForm: Omit<BedBlock, 'id' | 'createdAt' | 'updatedAt'>;
  setBedBlockForm: React.Dispatch<React.SetStateAction<Omit<BedBlock, 'id' | 'createdAt' | 'updatedAt'>>>;
  handleSave: () => Promise<void>;
  handleDelete: (id: number) => Promise<void>;
}

const BedBlockManagement: React.FC<BedBlockProps> = ({
  bedBlocks,
  currentTable,
  showDialog,
  setShowDialog,
  editMode,
  setEditMode,
  setCurrentTable,
  setCurrentEntity,
  bedBlockForm,
  setBedBlockForm,
  handleSave,
  handleDelete
}) => {
  return (
    <TabsContent value="bedBlocks">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Bed Blocks Management</h2>
          <Button onClick={() => {
            setCurrentTable('BedBlock');
            setEditMode(false);
            setBedBlockForm({
              description: '',
              price: 0
            });
            setShowDialog(true);
          }}>
            <Plus className="mr-2 h-4 w-4" /> Add Bed Block
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bedBlocks.map((block) => (
              <TableRow key={block.id}>
                <TableCell>{block.description}</TableCell>
                <TableCell>{block.price}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setCurrentTable('BedBlock');
                        setCurrentEntity(block);
                        setBedBlockForm({
                          description: block.description,
                          price: block.price
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
                      onClick={() => handleDelete(block.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {currentTable === 'BedBlock' && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editMode ? 'Edit' : 'Add'} Bed Block
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Description</Label>
                  <Input 
                    value={bedBlockForm.description}
                    onChange={(e) => setBedBlockForm({...bedBlockForm, description: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Price</Label>
                  <Input 
                    type="number"
                    value={bedBlockForm.price}
                    onChange={(e) => setBedBlockForm({
                      ...bedBlockForm, 
                      price: parseFloat(e.target.value) || 0
                    })}
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

export default BedBlockManagement;