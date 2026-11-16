import { useState } from 'react';
import type { PricingPlan, BillingCycle } from '@/types';
import { formatCurrency } from '@/lib/cashFlowEngine';
import { X, Check, CreditCard, Lock, Sparkles, ShieldCheck, Loader2 } from 'lucide-react';

interface CheckoutModalProps {
  plan: PricingPlan;
  billing: BillingCycle;
  onClose: () => void;
  onSuccess: () => void;
}

export function CheckoutModal({ plan, billing, onClose, onSuccess }: CheckoutModalProps) {
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  const displayPrice = billing === 'yearly' ? plan.yearlyPrice : plan.price;
  const total = displayPrice * (billing === 'yearly' ? 12 : 1);
  const isFree = plan.price === 0;

  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, '').substring(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, '').substring(0, 4);
    if (digits.length >= 2) return `${digits.substring(0, 2)}/${digits.substring(2)}`;
    return digits;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('processing');
    setTimeout(() => setStep('success'), 1800);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-navy-900/60 backdrop-blur-md animate-fade-in"
        onClick={step !== 'processing' ? onClose : undefined}
      />

      <div className="relative w-full max-w-md card shadow-glass-lg animate-scale-in overflow-hidden">
        <div className="gradient-brand px-6 py-5 text-white relative">
          <button
            onClick={step !== 'processing' ? onClose : undefined}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5" />
            <h2 className="text-lg font-bold">Subscribe to {plan.name}</h2>
          </div>
          <p className="text-sm text-white/80">{plan.tagline}</p>
        </div>

        {step === 'success' ? (
          <div className="px-6 py-10 text-center animate-fade-in">
            <div className="h-16 w-16 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-success-600" strokeWidth={3} />
            </div>
            <h3 className="text-xl font-bold text-navy-900 mb-2">Welcome to {plan.name}!</h3>
            <p className="text-sm text-navy-500 mb-6">
              Your subscription is now active. You can access all {plan.name} features immediately.
            </p>
            <button onClick={onSuccess} className="btn-primary w-full">
              Go to Dashboard
            </button>
          </div>
        ) : step === 'processing' ? (
          <div className="px-6 py-10 text-center">
            <Loader2 className="h-12 w-12 text-brand-600 animate-spin mx-auto mb-4" />
            <p className="text-sm text-navy-500">Processing your payment securely...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5">
            <div className="card !shadow-none !border-navy-100 bg-navy-50/50 mb-5 p-4 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-navy-700">{plan.name} Plan</span>
                <span className="text-xs font-medium text-navy-400 capitalize">{billing}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-navy-900">{formatCurrency(displayPrice)}</span>
                <span className="text-sm text-navy-400">/{billing === 'yearly' ? 'mo billed yearly' : 'mo'}</span>
              </div>
              {!isFree && billing === 'yearly' && (
                <p className="text-xs text-success-600 font-semibold mt-1">You save {formatCurrency((plan.price - plan.yearlyPrice) * 12)} per year!</p>
              )}
              <div className="h-px bg-navy-200 my-3" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-navy-500">Total {billing === 'yearly' ? 'annual' : 'monthly'} charge</span>
                <span className="text-lg font-bold text-navy-900">{formatCurrency(total)}</span>
              </div>
            </div>

            {isFree ? (
              <button type="button" onClick={onSuccess} className="btn-primary w-full">
                <Check className="h-4 w-4" />
                Activate Free Plan
              </button>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-navy-600 mb-1.5">Cardholder Name</label>
                    <input
                      type="text"
                      required
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="John Smith"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-navy-600 mb-1.5">Card Number</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        placeholder="4242 4242 4242 4242"
                        className="input-field pr-10 font-mono"
                      />
                      <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-navy-600 mb-1.5">Expiry</label>
                      <input
                        type="text"
                        required
                        value={expiry}
                        onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                        placeholder="MM/YY"
                        className="input-field font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-navy-600 mb-1.5">CVC</label>
                      <input
                        type="text"
                        required
                        value={cvc}
                        onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').substring(0, 4))}
                        placeholder="123"
                        className="input-field font-mono"
                      />
                    </div>
                  </div>
                </div>

                <button type="submit" className="btn-primary w-full mt-5">
                  <Lock className="h-4 w-4" />
                  Subscribe & Pay {formatCurrency(total)}
                </button>
              </>
            )}

            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-navy-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Secured with 256-bit SSL encryption. Cancel anytime.</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
