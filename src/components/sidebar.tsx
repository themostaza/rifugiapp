'use client'

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, Users, Settings, LogOut, CalendarDays, BedDouble, FileText, ExternalLink, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';


interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

const Sidebar = ({ isCollapsed, setIsCollapsed }: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  
//   useEffect(() => {
//     const fetchUserProfile = async () => {
//       try {
//         const { data: { user } } = await supabase.auth.getUser();
//         if (user) {
//           setUserName(user.user_metadata.user_name);
//         }
//       } catch (error) {
//         console.error('Error fetching user profile:', error);
//       }
//     };

    // Aggiungi il listener per l'evento di aggiornamento del nome utente
    // const handleUserNameUpdate = () => {
    // };

    // window.addEventListener('userNameUpdated', handleUserNameUpdate as EventListener);
    // fetchUserProfile();

    // Cleanup
//     return () => {
//       window.removeEventListener('userNameUpdated', handleUserNameUpdate as EventListener);
//     };
//   }, [supabase]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }

      router.push('/login');
      
      
    } catch (error) {
      console.error('Errore durante il logout:', error);
      
    }
  };

  const navItems = [
    { 
      name: 'Calendario', 
      icon: <CalendarDays className="h-5 w-5" />,  
      href: '/admin_power/calendario' 
    },
    {
      name: 'DB Prenotazioni',
      icon: <Database className="h-5 w-5" />,
      href: '/admin_power/db_prenotazioni'
    },
    {
      name: 'DB Mail',
      icon: <Database className="h-5 w-5" />,
      href: '/admin_power/resend-sync'
    },
    { 
      name: 'Stanze', 
      icon: <BedDouble className="h-5 w-5" />,  
      href: '/admin_power/stanze' 
    },
    // { 
    //   name: 'Richieste [Beta]', 
    //   icon: <FileText className="h-5 w-5" />,  
    //   href: '/requests' 
    // },
    { 
      name: 'Impostazioni', 
      icon: <Settings className="h-5 w-5" />,  
      href: '/admin_power/impostazioni' 
    },
    { 
        name: 'Report', 
        icon: <FileText className="h-5 w-5" />,  
        href: '/admin_power/report' 
    },
    {
      name: 'Stripe Check',
      icon: <ExternalLink className="h-5 w-5" />,  
      href: '/stripe_check',
    },
    { 
        name: 'Vai a Stripe',
        icon: <ExternalLink className="h-5 w-5" />,
        href: 'https://dashboard.stripe.com',
        className: 'border border-violet-600'
    },
  ];

  return (
    <div className={`fixed top-0 left-0 h-screen bg-gray-900 text-white transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'} flex flex-col`}>
      <div className="p-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="mb-4 hover:bg-gray-800"
        >
          <ChevronLeft className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
        </Button>
        
        <div className={`transition-opacity ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
          <div className="flex items-center space-x-2">
            
            <h1 className="text-2xl font-bold">Zona Admin</h1>
          </div>
          <p className="text-sm text-gray-400">Rifugio A. Dibona</p>
        </div>
      </div>

      <nav className="flex-1 px-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            target={item.href.startsWith('https://') ? '_blank' : undefined}
            rel={item.href.startsWith('https://') ? 'noopener noreferrer' : undefined}
            className={`flex items-center px-2 py-3 my-1 rounded-lg transition-colors
              ${pathname === item.href ? 'bg-gray-800' : 'hover:bg-gray-800'}
              ${item.className || ''}`}
          >
            <div className="min-w-[24px]">
              {item.icon}
            </div>
            {!isCollapsed && <span className="ml-3">{item.name}</span>}
          </Link>
        ))}
      </nav>

      <div className="p-4 ">
        <Button 
          className={`flex items-center rounded-lg transition-colors hover:bg-gray-800 w-full justify-${isCollapsed ? 'center' : 'start'}`}
        //   onClick={() => router.push('/profile')}
        >
          <Users className="h-5 w-5" />
          {/* {!isCollapsed && <span className="ml-3">{userName}</span>} */}
          Paolo
        </Button>
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={`mt-2 text-red-400 hover:text-red-300 hover:bg-gray-800 w-full flex items-center justify-${isCollapsed ? 'center' : 'start'}`}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-3">Logout</span>}
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;