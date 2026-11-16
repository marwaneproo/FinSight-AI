import { useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { pricingPlans } from '@/data/pricingPlans';
import { CheckoutModal } from '@/components/CheckoutModal';
import { FEATURE_LABEL, PLAN_NAME, requiredPlanFor } from '@/lib/plans';
import { formatCurrency } from '@/lib/cashFlowEngine';
import type { BillingCycle, PricingPlan } from '@/types';

export function UpgradeModal() {
  const { upgradePrompt, closeUpgrade, plan, setPlan } = useWorkspace();
  const [billing, setBilling] = useState<BillingCycle>('monthly');
  const [checkout, setCheckout] = useState<PricingPlan | null>(null);
  if (!upgradePrompt) return null;

  const feature = upgradePrompt.feature;
  const headline = upgradePrompt.reason ?? (feature ? `Unlock ${FEATURE_LABEL[feature]}` : 'Choose your plan');
  const sub = feature ? `This feature is included from the ${PLAN_NAME[requiredPlanFor(feature)]} plan.` : 'Upgrade any time. Cancel any time.';

  return (
    <>
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-md animate-fade-in" onClick={closeUpgrade} />
        <div className="relative w-full max-w-4xl card shadow-glass-lg animate-scale-in overflow-hidden max-h-[92vh] overflow-y-auto">
          <div className="gradient-brand px-6 py-5 text-white relative">
            <button onClick={closeUpgrade} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/20" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5" />
              <h2 className="text-xl font-bold">{headline}</h2>
            </div>
            <p className="text-sm text-white/80">{sub}</p>
          </div>
          <div className="p-6">
            <div className="flex justify-center mb-5">
              <div className="inline-flex rounded-xl bg-navy-100 p-1">
                {(['monthly', 'yearly'] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBilling(b)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all ${billing === b ? 'bg-white shadow text-navy-900' : 'text-navy-500'}`}
                  >
                    {b}
                    {b === 'yearly' && <span className="ml-1.5 text-[10px] text-success-600 font-bold">-20%</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {pricingPlans.map((p) => {
                const current = p.tier === plan;
                const price = billing === 'yearly' ? p.yearlyPrice : p.price;
                return (
                  <div key={p.tier} className={`rounded-2xl border-2 p-5 flex flex-col ${p.highlighted ? 'border-brand-500 shadow-glow-brand' : 'border-navy-200'}`}>
                    {p.badge && <span className="badge-brand self-start mb-2">{p.badge}</span>}
                    <h3 className="text-lg font-bold text-navy-900">{p.name}</h3>
                    <p className="mt-1 mb-3"><span className="text-3xl font-extrabold text-navy-900">{formatCurrency(price)}</span><span className="text-sm text-navy-400">/mo</span></p>
                    <ul className="space-y-1.5 mb-5 flex-1">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs text-navy-600"><Check className="h-3.5 w-3.5 text-success-600 mt-0.5 flex-shrink-0" />{f}</li>
                      ))}
                    </ul>
                    <button disabled={current} onClick={() => setCheckout(p)} className={current ? 'btn-secondary opacity-60 cursor-default' : 'btn-primary'}>
                      {current ? 'Current plan' : p.cta}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-center text-[11px] text-navy-400 mt-4">Demo checkout — no card is charged. Use any test number such as 4242 4242 4242 4242.</p>
          </div>
        </div>
      </div>
      {checkout && (
        <CheckoutModal
          plan={checkout}
          billing={billing}
          onClose={() => setCheckout(null)}
          onSuccess={() => {
            setPlan(checkout.tier);
            setCheckout(null);
            closeUpgrade();
          }}
        />
      )}
    </>
  );
}
