import type { ReactNode } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { FEATURE_LABEL, PLAN_NAME, requiredPlanFor, type FeatureKey } from '@/lib/plans';

interface Props {
  feature: FeatureKey;
  description?: string;
  children: ReactNode;
  /** Show a compact inline lock instead of a blurred overlay. */
  compact?: boolean;
}

/** Renders children when the plan allows it; otherwise a blurred live preview with an upgrade call-to-action. */
export function FeatureGate({ feature, description, children, compact }: Props) {
  const { can, openUpgrade } = useWorkspace();
  if (can(feature)) return <>{children}</>;
  const req = PLAN_NAME[requiredPlanFor(feature)];

  const card = (
    <div className="card shadow-glass-lg p-6 max-w-sm text-center">
      <div className="h-11 w-11 rounded-xl gradient-brand flex items-center justify-center mx-auto mb-3 shadow-glow-brand">
        <Lock className="h-5 w-5 text-white" />
      </div>
      <h3 className="text-base font-bold text-navy-900">{FEATURE_LABEL[feature]}</h3>
      <p className="text-xs text-navy-500 mt-1 mb-4">{description ?? `Available on the ${req} plan and above.`}</p>
      <button onClick={() => openUpgrade({ feature })} className="btn-primary w-full">
        <Sparkles className="h-4 w-4" /> Upgrade to {req}
      </button>
    </div>
  );

  if (compact) return <div className="flex justify-center py-6">{card}</div>;
  return (
    <div className="relative rounded-2xl overflow-hidden min-h-[320px]">
      <div aria-hidden className="pointer-events-none select-none blur-[3px] opacity-60">
        {children}
      </div>
      <div className="absolute inset-0 flex items-start justify-center bg-white/40 p-6 pt-16">{card}</div>
    </div>
  );
}
