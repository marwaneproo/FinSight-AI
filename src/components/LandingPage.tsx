import { Navbar } from '@/components/Navbar';
import { HeroPreview } from '@/components/HeroPreview';
import { CheckoutModal } from '@/components/CheckoutModal';
import { pricingPlans } from '@/data/pricingPlans';
import type { PricingPlan, BillingCycle } from '@/types';
import { useState } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  Sparkles,
  ArrowRight,
  Check,
  Copy,
  TrendingUp,
  AlertTriangle,
  Eye,
  Brain,
  FileSpreadsheet,
  Search,
  Zap,
  ShieldCheck,
  BarChart3,
  Star,
} from 'lucide-react';

interface LandingPageProps {
  onEnterApp: () => void;
}

export function LandingPage({ onEnterApp }: LandingPageProps) {
  const { setPlan } = useWorkspace();
  const [billing, setBilling] = useState<BillingCycle>('monthly');
  const [checkoutPlan, setCheckoutPlan] = useState<PricingPlan | null>(null);
  const [checkoutBilling, setCheckoutBilling] = useState<BillingCycle>('monthly');

  const openCheckout = (plan: PricingPlan, b: BillingCycle) => {
    setCheckoutPlan(plan);
    setCheckoutBilling(b);
  };

  const closeCheckout = () => setCheckoutPlan(null);

  const handleCheckoutSuccess = () => {
    if (checkoutPlan) setPlan(checkoutPlan.tier);
    setCheckoutPlan(null);
    onEnterApp();
  };

  return (
    <div className="min-h-screen bg-navy-50">
      <Navbar onEnterApp={onEnterApp} onOpenCheckout={openCheckout} />

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 gradient-hero overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-brand-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-success-100/30 rounded-full blur-3xl" />

        <div className="relative section-padding max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-slide-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-100 border border-brand-200 text-brand-700 text-xs font-semibold mb-5">
                <Sparkles className="h-3.5 w-3.5" />
                AI-Powered Financial Intelligence
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-navy-900 leading-[1.1] tracking-tight text-balance mb-5">
                Stop Financial Leaks.{' '}
                <span className="gradient-text">Predict Your Cash Flow with AI.</span>
              </h1>
              <p className="text-lg text-navy-500 leading-relaxed mb-7 max-w-xl">
                Upload your bank statement CSV or Excel file and get instant anomaly detection,
                90-day cash-flow forecasting, and an AI financial copilot — all in seconds.
                No spreadsheets, no manual reconciliation.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <button onClick={onEnterApp} className="btn-primary text-base px-7 py-3">
                  <Zap className="h-5 w-5" />
                  Start Free Audit
                </button>
                <button
                  onClick={() => document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                  className="btn-secondary text-base px-7 py-3"
                >
                  See How It Works
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-5 text-sm text-navy-400">
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-success-500" />
                  No credit card required
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-success-500" />
                  2 free uploads/month
                </span>
              </div>
            </div>

            <div className="animate-slide-up animate-delay-200">
              <HeroPreview />
            </div>
          </div>
        </div>
      </section>

      {/* Problem vs Solution Section */}
      <section id="features" className="py-20 bg-white">
        <div className="section-padding max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-danger-50 border border-danger-100 text-danger-600 text-xs font-semibold mb-4">
              <AlertTriangle className="h-3.5 w-3.5" />
              The Problem
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy-900 mb-4 tracking-tight">
              Hidden costs are draining your business
            </h2>
            <p className="text-lg text-navy-500 max-w-2xl mx-auto">
              SMBs lose thousands every year to financial leaks they never notice — until it's too late.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {[
              {
                icon: Copy,
                title: 'Duplicate Charges',
                description: 'Vendors accidentally double-charge you for subscriptions and services. Without automated detection, these silently drain cash month after month.',
                stat: '$1,200+',
                statLabel: 'avg annual loss',
              },
              {
                icon: TrendingUp,
                title: 'Forgotten Subscriptions',
                description: 'SaaS tools auto-renew at higher prices or with hidden annual upgrades. You keep paying for software your team no longer uses.',
                stat: '37%',
                statLabel: 'of SaaS is wasted',
              },
              {
                icon: Eye,
                title: 'Cash-Flow Blind Spots',
                description: "Without forecasting, you can't predict when you'll run out of cash. Surprise deficits catch you off guard with no time to react.",
                stat: '29%',
                statLabel: 'of SMBs fail from this',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="card-hover p-6 rounded-2xl group">
                  <div className="h-12 w-12 rounded-xl bg-danger-50 flex items-center justify-center mb-4 group-hover:bg-danger-100 transition-colors">
                    <Icon className="h-6 w-6 text-danger-500" />
                  </div>
                  <h3 className="text-lg font-bold text-navy-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-navy-500 leading-relaxed mb-4">{item.description}</p>
                  <div className="flex items-baseline gap-2 pt-3 border-t border-navy-100">
                    <span className="text-2xl font-extrabold text-danger-600">{item.stat}</span>
                    <span className="text-xs text-navy-400 font-medium">{item.statLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Solution banner */}
          <div className="card p-8 md:p-10 rounded-3xl gradient-brand text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="relative grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-semibold mb-4">
                  <Brain className="h-3.5 w-3.5" />
                  The FinSight AI Solution
                </div>
                <h3 className="text-2xl md:text-3xl font-extrabold mb-3 leading-tight">
                  One upload. Complete financial clarity.
                </h3>
                <p className="text-white/80 leading-relaxed">
                  Our AI engine scans every transaction, detects anomalies instantly, forecasts your
                  cash flow 90 days ahead, and gives you a conversational copilot to ask any question
                  about your finances.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Search, label: 'Instant anomaly detection' },
                  { icon: BarChart3, label: '90-day AI forecasting' },
                  { icon: Brain, label: 'Conversational AI copilot' },
                  { icon: FileSpreadsheet, label: 'CSV/Excel export' },
                ].map((f) => {
                  const Icon = f.icon;
                  return (
                    <div key={f.label} className="flex items-center gap-2.5 rounded-xl bg-white/10 backdrop-blur-sm p-3.5">
                      <Icon className="h-5 w-5 text-white flex-shrink-0" />
                      <span className="text-sm font-medium text-white">{f.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-navy-50">
        <div className="section-padding max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-100 border border-brand-200 text-brand-700 text-xs font-semibold mb-4">
              <Zap className="h-3.5 w-3.5" />
              How It Works
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy-900 mb-4 tracking-tight">
              From spreadsheet to insight in 60 seconds
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Upload Your Statement',
                description: 'Drag and drop your bank statement CSV or Excel file. Our parser handles any format automatically.',
                icon: FileSpreadsheet,
              },
              {
                step: '02',
                title: 'AI Analyzes Everything',
                description: 'We categorize every transaction, detect anomalies, find duplicates, and flag price hikes — automatically.',
                icon: Brain,
              },
              {
                step: '03',
                title: 'Act on Insights',
                description: 'Review your 90-day forecast, chat with your AI copilot, export dispute emails, and download clean reports.',
                icon: TrendingUp,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="relative card p-6 rounded-2xl">
                  <span className="absolute top-4 right-5 text-5xl font-extrabold text-navy-100">{item.step}</span>
                  <div className="h-12 w-12 rounded-xl gradient-brand flex items-center justify-center mb-4 shadow-glow-brand">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-navy-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-navy-500 leading-relaxed">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="section-padding max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success-100 border border-success-400/30 text-success-700 text-xs font-semibold mb-4">
              <Star className="h-3.5 w-3.5" />
              Simple, Transparent Pricing
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy-900 mb-4 tracking-tight">
              Choose your financial intelligence tier
            </h2>
            <p className="text-lg text-navy-500 max-w-2xl mx-auto mb-8">
              Start free. Upgrade when you need deeper insights. Cancel anytime.
            </p>

            {/* Billing toggle */}
            <div className="inline-flex items-center gap-3 p-1.5 rounded-2xl bg-navy-100 border border-navy-200">
              <button
                onClick={() => setBilling('monthly')}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  billing === 'monthly' ? 'bg-white text-navy-900 shadow-glass' : 'text-navy-500 hover:text-navy-700'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                  billing === 'yearly' ? 'bg-white text-navy-900 shadow-glass' : 'text-navy-500 hover:text-navy-700'
                }`}
              >
                Yearly
                <span className="px-2 py-0.5 rounded-full bg-success-100 text-success-700 text-xs font-bold">Save 20%</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pricingPlans.map((plan) => {
              const displayPrice = billing === 'yearly' ? plan.yearlyPrice : plan.price;
              return (
                <div
                  key={plan.name}
                  className={`relative card rounded-2xl p-7 flex flex-col transition-all ${
                    plan.highlighted
                      ? 'border-brand-600 border-2 shadow-glow-brand lg:scale-[1.03]'
                      : 'card-hover'
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-4 py-1 rounded-full gradient-brand text-white text-xs font-bold shadow-glow-brand flex items-center gap-1">
                        <Star className="h-3 w-3 fill-white" />
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="mb-5">
                    <h3 className="text-xl font-bold text-navy-900 mb-1">{plan.name}</h3>
                    <p className="text-sm text-navy-500">{plan.tagline}</p>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-navy-900">${displayPrice}</span>
                      <span className="text-sm text-navy-400">/{billing === 'yearly' ? 'mo*' : 'mo'}</span>
                    </div>
                    {billing === 'yearly' && plan.price > 0 && (
                      <p className="text-xs text-success-600 font-semibold mt-1">Billed ${displayPrice * 12}/year</p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-7 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          plan.highlighted ? 'bg-brand-100' : 'bg-success-100'
                        }`}>
                          <Check className={`h-3 w-3 ${plan.highlighted ? 'text-brand-600' : 'text-success-600'}`} strokeWidth={3} />
                        </div>
                        <span className="text-sm text-navy-600">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => openCheckout(plan, billing)}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] ${
                      plan.highlighted
                        ? 'gradient-brand text-white shadow-glow-brand hover:shadow-lg'
                        : plan.price === 0
                        ? 'bg-navy-900 text-white hover:bg-navy-800'
                        : 'bg-navy-100 text-navy-900 hover:bg-navy-200'
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              );
            })}
          </div>

          {billing === 'yearly' && (
            <p className="text-center text-xs text-navy-400 mt-6">*Yearly plans are billed annually at the shown monthly rate.</p>
          )}
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 bg-navy-50 border-t border-navy-200">
        <div className="section-padding max-w-4xl mx-auto text-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { stat: '$2.3M+', label: 'Leaks detected' },
              { stat: '12,000+', label: 'Statements analyzed' },
              { stat: '99.8%', label: 'Anomaly accuracy' },
              { stat: '< 60s', label: 'To full insight' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-3xl md:text-4xl font-extrabold gradient-text">{s.stat}</p>
                <p className="text-sm text-navy-400 font-medium mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="section-padding max-w-4xl mx-auto text-center">
          <div className="card p-10 md:p-14 rounded-3xl dot-pattern relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-brand-100/50 rounded-full blur-3xl" />
            <div className="relative">
              <ShieldCheck className="h-12 w-12 text-brand-600 mx-auto mb-4" />
              <h2 className="text-3xl md:text-4xl font-extrabold text-navy-900 mb-4 tracking-tight">
                Ready to find your financial leaks?
              </h2>
              <p className="text-lg text-navy-500 mb-8 max-w-xl mx-auto">
                Upload your first bank statement for free. No credit card. No setup. Just instant financial clarity.
              </p>
              <button onClick={onEnterApp} className="btn-primary text-base px-8 py-3.5 mx-auto">
                <Zap className="h-5 w-5" />
                Start Free Audit Now
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-navy-900 text-navy-300">
        <div className="section-padding max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-brand flex items-center justify-center">
                <span className="text-white font-extrabold text-xs">FS</span>
              </div>
              <span className="font-bold text-white">FinSight AI</span>
            </div>
            <p className="text-sm text-navy-400">
              Financial Copilot & Cash-Flow Forecasting Platform
            </p>
            <p className="text-xs text-navy-500">
              © 2026 FinSight AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {checkoutPlan && (
        <CheckoutModal
          plan={checkoutPlan}
          billing={checkoutBilling}
          onClose={closeCheckout}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </div>
  );
}
