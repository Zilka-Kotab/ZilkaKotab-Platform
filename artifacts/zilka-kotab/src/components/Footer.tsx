import React from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';
import zilkaLogo from '@assets/zilka-logo.png';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">

          {/* Logo + tagline */}
          <div className="space-y-4 max-w-xs">
            <img
              src={zilkaLogo}
              alt="Zilka-Kotab PC Logo"
              className="h-9 w-auto object-contain brightness-0 invert opacity-90"
            />
            <p className="text-primary-foreground/60 text-sm leading-relaxed">
              Silicon Valley IP Strategists. Absolute precision in patent procurement, strategy, and litigation support.
            </p>
          </div>

          {/* Contact */}
          <ul className="space-y-2">
            <li className="flex items-start gap-3 text-sm text-primary-foreground/70">
              <MapPin className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span>1155 North 1st St #104, San Jose, CA 95112</span>
            </li>
            <li className="flex items-center gap-3 text-sm text-primary-foreground/70">
              <Phone className="w-4 h-4 text-accent shrink-0" />
              <a href="tel:408-971-2573" className="hover:text-white transition-colors">(408) 971-2573</a>
            </li>
            <li className="flex items-center gap-3 text-sm text-primary-foreground/70">
              <Mail className="w-4 h-4 text-accent shrink-0" />
              <a href="mailto:patent@zilkakotab.com" className="hover:text-white transition-colors">patent@zilkakotab.com</a>
            </li>
          </ul>

        </div>

        <div className="mt-6 pt-4 border-t border-white/10">
          <p className="text-xs text-primary-foreground/40 text-center">
            &copy; {currentYear} Zilka-Kotab PC. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
