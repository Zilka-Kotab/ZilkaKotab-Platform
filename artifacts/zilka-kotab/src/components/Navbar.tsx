import React from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import zilkaLogo from '@assets/zilka-logo.png';
import { motion } from 'framer-motion';

const navLinks = [
  { name: 'Home', path: '/' },
  { name: 'About', path: '/about' },
  { name: 'Services', path: '/services' },
  { name: 'Our Team', path: '/team' },
];

export function Navbar() {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Close mobile menu on route change
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group z-50">
          <img 
            src={zilkaLogo} 
            alt="Zilka-Kotab PC Logo" 
            className="h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105" 
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <ul className="flex items-center gap-8">
            {navLinks.map((link) => (
              <li key={link.path}>
                <Link
                  href={link.path}
                  className={`text-sm font-medium tracking-wide transition-colors hover:text-primary relative py-2 ${
                    location === link.path ? 'text-primary' : 'text-foreground/80'
                  }`}
                >
                  {link.name}
                  {location === link.path && (
                    <motion.div
                      layoutId="activeNavIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-4 border-l border-border pl-8">
            <Link href="/contact" className="inline-flex h-10 items-center justify-center rounded-sm bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
              Contact Us
            </Link>
          </div>
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden flex items-center justify-center p-2 text-foreground/80 hover:text-primary z-50"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Mobile Navigation Overlay */}
        {isMobileMenuOpen && (
          <div id="mobile-menu" className="fixed inset-0 top-0 left-0 w-full h-[100dvh] bg-background z-40 flex flex-col pt-24 px-6 md:hidden">
            <ul className="flex flex-col gap-6">
              {navLinks.map((link) => (
                <motion.li 
                  key={link.path}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Link
                    href={link.path}
                    className={`block text-2xl font-display font-medium ${
                      location === link.path ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {link.name}
                  </Link>
                </motion.li>
              ))}
              <motion.li
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="mt-4 pt-6 border-t border-border"
              >
                <Link
                  href="/contact"
                  className="block text-2xl font-display font-medium text-primary"
                >
                  Contact Us
                </Link>
              </motion.li>
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}