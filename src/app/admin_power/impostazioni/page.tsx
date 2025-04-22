'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import { Bold, Italic, List, Link } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const ProfileSettings = () => {
  // Profile state
  const [profileData, setProfileData] = useState({
    email: '',
  });

  // Password change state
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [passwords, setPasswords] = useState({
    new: '',
    confirm: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Deposit percentage state
  const [depositPercentage, setDepositPercentage] = useState('30.00');
  
  // Email template state
  const [emailTemplate, setEmailTemplate] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        protocols: ['http', 'https'],
        validate: url => {
          try {
            const parsedUrl = url.includes(':') ? new URL(url) : new URL(`https://${url}`);
            return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
          } catch {
            return false;
          }
        },
      })
    ],
    content: emailTemplate,
    onUpdate: ({ editor }) => {
      setEmailTemplate(editor.getHTML());
    }
  });

  const setLink = useCallback(() => {
    const previousUrl = editor?.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    // cancelled
    if (url === null) {
      return;
    }

    // empty
    if (url === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    // update link
    try {
      editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } catch (e) {
      console.log(e)
    }
  }, [editor]);

  useEffect(() => {
    // Fetch current user data
    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setProfileData({
          email: user.email || '',
        });
      }
    };

    // Fetch deposit percentage from AppSettings
    const fetchDepositPercentage = async () => {
      const { data, error } = await supabase
        .from('AppSettings')
        .select('value')
        .eq('name', 'partial refund')
        .single();
      
      if (!error && data) {
        setDepositPercentage(data.value);
      }
    };

    // Fetch email template from TemplateData
    const fetchEmailTemplate = async () => {
      const { data, error } = await supabase
        .from('TemplateData')
        .select('htmlMarkUp')
        .eq('templateName', 'confirm-email-template')
        .single();
      
      if (!error && data) {
        setEmailTemplate(data.htmlMarkUp || '');
        editor?.commands.setContent(data.htmlMarkUp || '');
      }
    };

    fetchUserProfile();
    fetchDepositPercentage();
    fetchEmailTemplate();
  }, [editor]);

  // Handle password change
  const handlePasswordChange = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    setIsLoading(true);
    
    // Validate passwords
    if (passwords.new !== passwords.confirm) {
      setPasswordError('Le nuove password non coincidono');
      setIsLoading(false);
      return;
    }
    
    if (passwords.new.length < 6) {
      setPasswordError('La password deve essere di almeno 6 caratteri');
      setIsLoading(false);
      return;
    }

    // Update password via Supabase Auth
    const { error } = await supabase.auth.updateUser({
      password: passwords.new
    });

    setIsLoading(false);

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess('Password aggiornata con successo!');
      setTimeout(() => {
        setPasswordDialog(false);
        setPasswords({ new: '', confirm: '' });
        setPasswordSuccess('');
      }, 2000);
    }
  };

  // Handle deposit percentage change
  const handleDepositChange = async (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setDepositPercentage(value);
      
      const { error } = await supabase
        .from('AppSettings')
        .update({ value: value })
        .eq('name', 'partial refund');

      if (error) {
        console.error('Error updating deposit percentage:', error);
      }
    }
  };

  // Handle email template save to database
  const handleTemplateSave = async () => {
    const { error } = await supabase
      .from('TemplateData')
      .update({ htmlMarkUp: emailTemplate })
      .eq('templateName', 'confirm-email-template');

    if (error) {
      console.error('Error updating email template:', error);
    } else {
      alert('Template email salvato con successo!');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Profile Section */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-6">Profilo</h2>
        <div className="space-y-4">
          <div className="grid gap-4">
            <div>
              <Label>Email:</Label>
              <Input 
                type="email"
                value={profileData.email} 
                disabled
              />
            </div>
            <div>
              <Label>Password:</Label>
              <Input 
                type="password"
                value="••••••••••"
                disabled
              />
              <div className='flex justify-end items-end mt-2 '>
              <Button 
                variant="outline" 
                onClick={() => setPasswordDialog(true)}
                >
                Modifica password
                </Button>
                </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Deposit Section */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-6">Caparra</h2>
        <div className="space-y-4">
          <div>
            <Label>Percentuale caparra:</Label>
            <div className="flex items-center gap-2">
              <Input 
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={depositPercentage}
                onChange={(e) => handleDepositChange(e.target.value)}
                className="max-w-[200px]"
              />
              <span>%</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Email Template Section */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-6">Email di Conferma</h2>
        <div className="space-y-4">
          <div className="border rounded-md">
            <div className="border-b p-2 bg-gray-50">
              <div className="flex flex-wrap gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={editor?.isActive('bold') ? 'bg-accent' : ''}
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={editor?.isActive('italic') ? 'bg-accent' : ''}
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  className={editor?.isActive('bulletList') ? 'bg-accent' : ''}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={setLink}
                  className={editor?.isActive('link') ? 'bg-accent' : ''}
                >
                  <Link className="h-4 w-4" />
                </Button>
                {editor?.isActive('link') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor?.chain().focus().unsetLink().run()}
                  >
                    Rimuovi link
                  </Button>
                )}
              </div>
            </div>
            <EditorContent 
              editor={editor} 
              className="prose prose-sm max-w-none p-4 focus:outline-none min-h-[400px] [&_a]:text-blue-600 [&_a]:underline hover:[&_a]:text-blue-800"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleTemplateSave}>
              Salva
            </Button>
          </div>
        </div>
      </Card>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nuova password</Label>
              <Input
                id="new-password"
                type="password"
                value={passwords.new}
                onChange={(e) => setPasswords({...passwords, new: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Conferma nuova password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwords.confirm}
                onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
              />
            </div>
            {passwordError && (
              <div className="text-red-500 text-sm">{passwordError}</div>
            )}
            {passwordSuccess && (
              <div className="text-green-500 text-sm">{passwordSuccess}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialog(false)}>
              Annulla
            </Button>
            <Button onClick={handlePasswordChange} disabled={isLoading}>
              {isLoading ? "Salvando..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfileSettings;