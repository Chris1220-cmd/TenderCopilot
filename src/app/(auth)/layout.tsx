'use client';

import './auth.css';
import { AnimatedMesh } from '@/components/ui/animated-mesh';
import { useTranslation } from '@/lib/i18n';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      <AnimatedMesh />

      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Two-column grid: product showcase + auth form */}
      <div className="relative z-10 grid w-full grid-cols-1 lg:grid-cols-[3fr_2fr]">
        {/* Left: Product showcase (hidden on mobile) */}
        <div className="hidden lg:flex flex-col items-center justify-center p-12">
          <div className="max-w-lg space-y-6">
            <h2 className="text-4xl font-bold tracking-tight gradient-text-cyan">
              {t('auth.showcaseTitle')}
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t('auth.showcaseSubtitle')}
            </p>
            <div className="flex gap-8 pt-4">
              <div>
                <div className="text-2xl font-bold text-foreground">500+</div>
                <div className="text-sm text-muted-foreground">{t('auth.statDocs')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">90%</div>
                <div className="text-sm text-muted-foreground">{t('auth.statTime')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">68%</div>
                <div className="text-sm text-muted-foreground">{t('auth.statWinRate')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Auth form */}
        <div className="flex items-center justify-center p-4 py-8 lg:p-12">
          <div className="w-full max-w-[440px]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
