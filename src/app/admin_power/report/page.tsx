'use client'

import React from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from 'lucide-react';

const ReportsSection = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      {/* Past Reservations Report */}
      <Card className="p-4">
        <div className="flex justify-between items-center">
          <h2 className=" font-medium">Report prenotazioni passate</h2>
          <Button 
            variant="secondary"
            className="flex items-center gap-2"
            onClick={() => {
              // API integration will go here
              console.log('Download past reservations report');
            }}
          >
            <Download className="h-4 w-4" />
            Scarica
          </Button>
        </div>
      </Card>

      {/* Future Reservations Report */}
      <Card className="p-4">
        <div className="flex justify-between items-center">
          <h2 className=" font-medium">Report prenotazioni future</h2>
          <Button 
            variant="secondary"
            className="flex items-center gap-2"
            onClick={() => {
              // API integration will go here
              console.log('Send future reservations report');
            }}
          >
            <Download className="h-4 w-4" />
            Scarica
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ReportsSection;