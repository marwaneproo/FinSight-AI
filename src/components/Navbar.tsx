import { useState, useEffect } from 'react';
import { Logo } from '@/components/Logo';
import { Menu, X, LayoutDashboard } from 'lucide-react';
import type { PricingPlan, BillingCycle } from '@/types';

interface NavbarProps {
  onEnterApp: () => void;
  onOpenCheckout: (plan: PricingPlan, billing: BillingCycle) => void;
}

export function Navbar({ onEnterApp }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
  ];

  const scrollTo = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'glass-nav shadow-glass' : 'bg-transparent'}`}>
        <div className="section-padding max-w-7xl mx-auto flex items-center justify-between h-16">
          <Logo />

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => scrollTo(link.href)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-navy-600 hover:text-navy-900 hover:bg-navy-100/60 transition-all"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={onEnterApp}
              className="btn-ghost"
            >
              Sign In
            </button>
            <button
              onClick={onEnterApp}
              className="btn-primary"
            >
              <LayoutDashboard className="h-4 w-4" />
              Start Free Audit
            </button>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-navy-700 hover:bg-navy-100"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="fixed top-16 left-0 right-0 bg-white border-b border-navy-200 shadow-glass-lg animate-slide-up">
            <div className="section-padding py-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={() => scrollTo(link.href)}
                  className="text-left px-4 py-3 rounded-lg text-sm font-medium text-navy-700 hover:bg-navy-100"
                >
                  {link.label}
                </button>
              ))}
              <div className="h-px bg-navy-200 my-2" />
              <button
                onClick={() => { setMobileOpen(false); onEnterApp(); }}
                className="btn-primary w-full"
              >
                <LayoutDashboard className="h-4 w-4" />
                Start Free Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
