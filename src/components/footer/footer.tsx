'use client'

import React from 'react';

interface FooterLink {
  label: string;
  href: string;
  target?: string;
  rel?: string;
}

interface FooterProps {
  links?: FooterLink[];
  className?: string;
}

const defaultLinks: FooterLink[] = [
  { 
    label: 'FAQs', 
    href: 'https://oil-shingle-30f.notion.site/Rifugio-Dibona-Cortina-d-Ampezzo-97d04d9014614182a45f9de6e1c7117d?pvs=4',
    target: '_blank',
    rel: 'noopener noreferrer'
  },
  { 
    label: 'Privacy', 
    href: 'https://oil-shingle-30f.notion.site/Rifugio-Dibona-Cortina-d-Ampezzo-1065d81c4ca149f986e1ac5b80134477',
    target: '_blank',
    rel: 'noopener noreferrer'
  },
  { 
    label: 'T&C', 
    href: 'https://oil-shingle-30f.notion.site/Rifugio-Dibona-Cortina-d-Ampezzo-3385b7bc54d8448ca9c66a47e5d4cb7e',
    target: '_blank',
    rel: 'noopener noreferrer'
  }
];

const Footer: React.FC<FooterProps> = ({ 
  links = defaultLinks,
  className = ''
}) => {
  return (
    <footer className={`bg-white border-t ${className}`}>
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex gap-4 text-sm text-gray-600">
            {links.map((link, index) => (
              <a 
                key={`${link.label}-${index}`}
                href={link.href} 
                className="hover:text-gray-900"
                target={link.target || '_blank'}
                rel={link.rel || 'noopener noreferrer'}
              >
                {link.label}
              </a>
            ))}
          </div>
          <div>
            <a 
              href="/login" 
              className="text-sm text-gray-600 hover:text-gray-900"
              target="_blank"
              rel="noopener noreferrer"
            >
              Login
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;