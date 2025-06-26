'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { Textarea } from "@/components/ui/textarea";

interface NotesSectionProps {
  initialNotes?: string;
  onNotesChange: (notes: string) => void;
  t: (key: string, vars?: Record<string, unknown>) => string;
}

const NotesSection: React.FC<NotesSectionProps> = ({ 
  initialNotes = '', 
  onNotesChange,
  t
}) => {
  const [internalNotes, setInternalNotes] = useState(initialNotes);

  // Debounce effect for notes input
  useEffect(() => {
    const handler = setTimeout(() => {
      onNotesChange(internalNotes);
    }, 300); // 300ms debounce delay

    // Cleanup function to clear the timeout if the component unmounts
    // or if internalNotes changes before the timeout finishes
    return () => {
      clearTimeout(handler);
    };
  }, [internalNotes, onNotesChange]);

  // Update internal state if initialNotes prop changes externally
  useEffect(() => {
    setInternalNotes(initialNotes);
  }, [initialNotes]);

  const handleTextChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInternalNotes(event.target.value);
  }, []);

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4">{t('notes.title')}</h2>
      <p className="text-gray-600 mb-4">
        {t('notes.description')}
      </p>
      <Textarea 
        value={internalNotes} // Use internal state for value
        onChange={handleTextChange} // Update internal state directly
        className="w-full min-h-32"
        placeholder={t('notes.placeholder')}
      />
    </section>
  );
};

export default NotesSection; 