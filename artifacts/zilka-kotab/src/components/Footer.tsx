import React from 'react';
import { Link } from 'wouter';
import { Mail, MapPin, Phone } from 'lucide-react';
import zilkaLogo from '@assets/zilka-logo.png';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          <div className="space-y-6">
            <img 
              src={zilkaLogo} 
              alt="Zilka-Kotab PC Logo" 
              className="h-10 w-auto object-contain brightness-0 invert opacity-90" 
            />
            <p className="text-secondary-foreground/70 max-w-sm text-sm leading-relaxed">
              Silicon Valley IP Strategists. Delivering absolute precision in patent procurement, strategy, and litigation support.
            </p>
          </div>

          <div>
            <h4 className="text-lg font-display font-medium mb-6">Quick Links</h4>
            <ul className="space-y-4">
              <li>
                <Link href="/" className="text-sm text-secondary-foreground/70 hover:text-white transition-colors">Home</Link>
              </li>
              <li>
                <Link href="/about" className="text-sm text-secondary-foreground/70 hover:text-white transition-colors">About Us</Link>
              </li>
              <li>
                <Link href="/services" className="text-sm text-secondary-foreground/70 hover:text-white transition-colors">Services</Link>
              </li>
              <li>
                <Link href="/team" className="text-sm text-secondary-foreground/70 hover:text-white transition-colors">Our Team</Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-secondary-foreground/70 hover:text-white transition-colors">Contact</Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-display font-medium mb-6">Services</h4>
            <ul className="space-y-4">
              <li className="text-sm text-secondary-foreground/70">Patent Strategy</li>
              <li className="text-sm text-secondary-foreground/70">Cost-Effective Prosecution</li>
              <li className="text-sm text-secondary-foreground/70">Litigation Support</li>
              <li className="text-sm text-secondary-foreground/70">Licensing</li>
              <li className="text-sm text-secondary-foreground/70">IP Strategies</li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-display font-medium mb-6">Contact</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-sm text-secondary-foreground/70">
                <MapPin className="w-5 h-5 text-primary-foreground/50 shrink-0 mt-0.5" />
                <span>
                  1155 North 1st St #104<br />
                  San Jose, CA 95112
                </span>
              </li>
              <li className="flex items-center gap-3 text-sm text-secondary-foreground/70">
                <Phone className="w-5 h-5 text-primary-foreground/50 shrink-0" />
                <a href="tel:408-971-2573" className="hover:text-white transition-colors">(408) 971-2573</a>
              </li>
              <li className="flex items-center gap-3 text-sm text-secondary-foreground/70">
                <Mail className="w-5 h-5 text-primary-foreground/50 shrink-0" />
                <a href="mailto:patent@zilkakotab.com" className="hover:text-white transition-colors">patent@zilkakotab.com</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-secondary-foreground/50">
            &copy; {currentYear} Zilka-Kotab PC. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/contact" className="text-xs text-secondary-foreground/50 hover:text-white transition-colors">Contact Us</Link>
            <a href="mailto:patent@zilkakotab.com" className="text-xs text-secondary-foreground/50 hover:text-white transition-colors">patent@zilkakotab.com</a>
          </div>
        </div>
      </div>
    </footer>
  );
}