import { Brain, TrendingUp } from 'lucide-react';

interface LogoProps {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ variant = 'dark', size = 'md' }: LogoProps) {
  const textColor = variant === 'dark' ? 'text-navy-900' : 'text-white';
  const subColor = variant === 'dark' ? 'text-navy-400' : 'text-navy-300';

  const sizes = {
    sm: { icon: 'h-7 w-7', title: 'text-base', sub: 'text-[10px]' },
    md: { icon: 'h-9 w-9', title: 'text-lg', sub: 'text-[11px]' },
    lg: { icon: 'h-12 w-12', title: 'text-2xl', sub: 'text-xs' },
  };

  const s = sizes[size];

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative">
        <div className={`${s.icon} rounded-xl gradient-brand flex items-center justify-center shadow-glow-brand`}>
          <Brain className="h-1/2 w-1/2 text-white" strokeWidth={2.5} />
        </div>
        <div className={`absolute -bottom-0.5 -right-0.5 ${size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} rounded-full bg-success-500 border-2 border-white flex items-center justify-center`}>
          <TrendingUp className="h-1/2 w-1/2 text-white" strokeWidth={3} />
        </div>
      </div>
      <div className="flex flex-col leading-none">
        <span className={`${s.title} font-extrabold ${textColor} tracking-tight`}>
          FinSight<span className="text-brand-600"> AI</span>
        </span>
        <span className={`${s.sub} ${subColor} font-medium tracking-wide`}>Financial Copilot</span>
      </div>
    </div>
  );
}
