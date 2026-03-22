'use client';

import { AlertTriangle, FileText, Scale, Banknote } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/ui/glass-card';
import { BlurFade } from '@/components/ui/blur-fade';

interface MissingInfoPanelProps {
  tenderId: string;
}

interface MissingSection {
  label: string;
  icon: React.ReactNode;
  items: string[];
}

/**
 * Aggregates missing info from Brief, Legal, and Financial analyses.
 * Shows categorized warnings for fields that AI couldn't find in documents.
 */
export function MissingInfoPanel({ tenderId }: MissingInfoPanelProps) {
  const brief = trpc.aiRoles.getBrief.useQuery({ tenderId });
  const legal = trpc.aiRoles.getLegalClauses.useQuery({ tenderId });

  // Extract missingInfo from brief
  const briefMissing: string[] = [];
  if (brief.data) {
    const keyPoints = brief.data.keyPoints as Record<string, unknown> | null;
    if (keyPoints && Array.isArray(keyPoints.missingInfo)) {
      briefMissing.push(...keyPoints.missingInfo);
    }
  }

  // Extract missingInfo from legal summary
  const legalMissing: string[] = [];
  if (legal.data?.summary?.missingInfo) {
    legalMissing.push(...legal.data.summary.missingInfo);
  }

  // Build sections
  const sections: MissingSection[] = [];

  if (briefMissing.length > 0) {
    sections.push({
      label: 'Σύνοψη',
      icon: <FileText className="h-4 w-4 text-amber-500" />,
      items: briefMissing,
    });
  }

  if (legalMissing.length > 0) {
    sections.push({
      label: 'Νομική',
      icon: <Scale className="h-4 w-4 text-amber-500" />,
      items: legalMissing,
    });
  }

  // Don't render anything while loading or if no analyses exist yet
  const isLoading = brief.isLoading || legal.isLoading;
  const hasNoData = !brief.data && !legal.data;

  if (isLoading || hasNoData || sections.length === 0) {
    return null;
  }

  const totalMissing = sections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <BlurFade delay={0.1} inView>
      <GlassCard className="border-amber-500/20 bg-amber-500/5">
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              Ελλιπείς Πληροφορίες ({totalMissing})
            </span>
          </GlassCardTitle>
        </GlassCardHeader>

        <GlassCardContent>
          <div className="space-y-3">
            {sections.map((section) => (
              <div key={section.label}>
                <div className="flex items-center gap-1.5 mb-1">
                  {section.icon}
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    {section.label}
                  </span>
                </div>
                <ul className="ml-6 space-y-0.5">
                  {section.items.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </GlassCardContent>
      </GlassCard>
    </BlurFade>
  );
}
