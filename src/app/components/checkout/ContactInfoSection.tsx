'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from 'zod';

// Types moved or adapted from CheckoutPage
interface Region {
  id: number;
  name: string;
}

interface Country {
  name: string;
  code: string;
  native: string;
  englishName?: string;
}

export interface ContactDetails {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  selectedCountry: string;
  countryName: string;
  selectedRegion: string;
  isValid: boolean;
}

interface ContactInfoSectionProps {
  initialDetails?: Partial<ContactDetails>;
  onContactInfoChange: (details: ContactDetails) => void;
  t: (key: string, vars?: Record<string, unknown>) => string;
}

// Email validation schema
const emailSchema = z.string().email({ message: "Email non valido" });

const ContactInfoSection: React.FC<ContactInfoSectionProps> = ({ 
  initialDetails = {}, 
  onContactInfoChange,
  t
}) => {
  const [customerName, setCustomerName] = useState(initialDetails.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(initialDetails.customerPhone || '');
  const [customerEmail, setCustomerEmail] = useState(initialDetails.customerEmail || '');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState(initialDetails.selectedCountry || '');
  const [countries, setCountries] = useState<Country[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState(initialDetails.selectedRegion || '');
  const [italianRegions, setItalianRegions] = useState<Region[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);

  // Fetch countries on component mount
  useEffect(() => {
    const fetchCountries = async () => {
      setCountriesLoading(true);
      try {
        const response = await fetch('/api/countries');
        if (!response.ok) {
          throw new Error('Failed to fetch countries');
        }
        const data = await response.json();
        setCountries(data);
      } catch (error) {
        console.error('Error fetching countries:', error);
      } finally {
        setCountriesLoading(false);
      }
    };
    fetchCountries();
  }, []);

  // Fetch Italian regions when Italy is selected
  useEffect(() => {
    if (selectedCountry === 'IT') {
      const fetchItalianRegions = async () => {
        setRegionsLoading(true);
        try {
          const response = await fetch('/api/italyregions');
          if (!response.ok) {
            throw new Error('Failed to fetch Italian regions');
          }
          const data = await response.json();
          setItalianRegions(data);
        } catch (error) {
          console.error('Error fetching Italian regions:', error);
        } finally {
          setRegionsLoading(false);
        }
      };
      fetchItalianRegions();
    } else {
      setSelectedRegion(''); // Reset region if country is not Italy
    }
  }, [selectedCountry]);

  // Handle email validation
  const validateEmail = useCallback((email: string) => {
    try {
      emailSchema.parse(email);
      setEmailError(null);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setEmailError(t('contactInfo.invalidEmail'));
      }
      return false;
    }
  }, [t]);

  // Effect to DEBOUNCE calculation and callback
  useEffect(() => {
    // Set up the timer
    const handler = setTimeout(() => {
      // --- Calculations performed inside the debounced function --- 
      const isEmailValid = emailSchema.safeParse(customerEmail).success;
      const isValid = 
        customerName.trim() !== '' && 
        customerPhone.trim() !== '' && 
        customerEmail.trim() !== '' && 
        isEmailValid &&
        selectedCountry !== '' &&
        (selectedCountry !== 'IT' || selectedRegion !== '');

      const selectedCountryObj = countries.find(c => c.code === selectedCountry);
      const countryName = selectedCountryObj?.englishName || selectedCountryObj?.native || selectedCountry;
      // --- End Calculations --- 

      // Find the selected region name
      const selectedRegionName = italianRegions.find(r => r.id.toString() === selectedRegion)?.name || selectedRegion;

      // Call the parent callback with the calculated details
      onContactInfoChange({
        customerName,
        customerPhone,
        customerEmail,
        selectedCountry,
        countryName,
        selectedRegion: selectedRegionName, 
        isValid,
      });

    }, 500); // Use a slightly longer delay (e.g., 500ms) for forms

    // Cleanup function to clear the timeout
    return () => {
      clearTimeout(handler);
    };
  }, [
    customerName, 
    customerPhone, 
    customerEmail, 
    selectedCountry, 
    selectedRegion, 
    countries, // Include countries as calc depends on it
    italianRegions, // Add italianRegions as dependency for name lookup
    onContactInfoChange, // Include callback in dependencies
    emailSchema // Include schema if it could change (though unlikely here)
  ]);

  return (
    <section>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 bg-gray-900 text-white rounded-full font-bold text-lg">5</div>
        <h2 className="text-xl font-semibold">{t('contactInfo.title')}</h2>
      </div>
      <p className="text-gray-600 mb-4">
        {t('contactInfo.description')}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="space-y-2">
          <Label htmlFor="customer-name">{t('contactInfo.nameLabel')} *</Label>
          <Input 
            id="customer-name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder={t('contactInfo.namePlaceholder')}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="customer-phone">{t('contactInfo.phoneLabel')} *</Label>
          <Input 
            id="customer-phone"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder={t('contactInfo.phonePlaceholder')}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="customer-email">{t('contactInfo.emailLabel')} *</Label>
          <Input 
            id="customer-email"
            type="email" // Use email type for better browser validation/input modes
            value={customerEmail}
            onChange={(e) => {
              setCustomerEmail(e.target.value);
              // Optional: Clear error instantly while typing, validate on blur/debounce
              if (emailError) setEmailError(null); 
            }}
            onBlur={() => validateEmail(customerEmail)} // Keep validation on blur
            placeholder={t('contactInfo.emailPlaceholder')}
            className={emailError ? "border-red-500" : ""}
            required
          />
          {emailError && (
            <p className="text-red-500 text-sm mt-1">{emailError}</p>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <Label htmlFor="customer-country">{t('contactInfo.countryLabel')} *</Label>
          <Select 
            value={selectedCountry}
            onValueChange={setSelectedCountry}
            required
          >
            <SelectTrigger id="customer-country" className="w-full">
              <SelectValue placeholder={t('contactInfo.countryPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {countriesLoading ? (
                <SelectItem value="loading" disabled>{t('contactInfo.loadingCountries')}</SelectItem>
              ) : countries.length === 0 ? (
                 <SelectItem value="error" disabled>{t('contactInfo.errorLoadingCountries')}</SelectItem>
              ) : (
                countries.map(country => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.native} {country.englishName && country.native !== country.englishName ? `(${country.englishName})` : ''}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        
        {selectedCountry === 'IT' && (
          <div className="space-y-2">
            <Label htmlFor="customer-region">{t('contactInfo.regionLabel')} *</Label>
            <Select 
              value={selectedRegion}
              onValueChange={setSelectedRegion}
              required={selectedCountry === 'IT'} // Only required if Italy is selected
            >
              <SelectTrigger id="customer-region" className="w-full">
                <SelectValue placeholder={t('contactInfo.regionPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {regionsLoading ? (
                  <SelectItem value="loading" disabled>{t('contactInfo.loadingRegions')}</SelectItem>
                ) : italianRegions.length === 0 ? (
                  <SelectItem value="error" disabled>{t('contactInfo.errorLoadingRegions')}</SelectItem>
                ) : (
                  italianRegions.map(region => (
                    <SelectItem key={region.id} value={region.id.toString()}>
                      {region.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </section>
  );
};

export default ContactInfoSection; 