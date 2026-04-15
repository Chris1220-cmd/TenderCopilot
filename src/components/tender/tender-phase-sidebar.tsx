'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import {
  Eye, ClipboardList, Award, Scale, Wrench, Banknote,
  FileText, FolderCheck, ListTodo, CalendarClock, Activity,
  PanelLeftClose, PanelLeft,
} from 'lucide-react';
import { SectionStatusIcon, type SectionStatus } from './section-status-icon';
import { Button } from '@/components/ui/button';

type Phase = {
  labelKey: string;
  sections: {
    value: string;
    labelKey: string;
    icon: typeof Eye;
  }[];
};

const phases: Phase[] = [
  {
    labelKey: 'tender.phase.understand',
    sections: [
      { value: 'overview', labelKey: 'tender.overviewTab', icon: Eye },
      { value: 'requirements', labelKey: 'tender.requirementsTab', icon: ClipboardList },
      { value: 'criteria', labelKey: 'tender.criteriaTab', icon: Award },
    ],
  },
  {
    labelKey: 'tender.phase.prepare',
    sections: [
      { value: 'legal', labelKey: 'tender.legalTab', icon: Scale },
      { value: 'technical', labelKey: 'tender.technicalTab', icon: Wrench },
      { value: 'financial', labelKey: 'tender.financialTab', icon: Banknote },
    ],
  },
  {
    labelKey: 'tender.phase.assemble',
    sections: [
      { value: 'documents', labelKey: 'tender.documentsTab', icon: FileText },
      { value: 'fakelos', labelKey: 'tender.dossierTab', icon: FolderCheck },
      { value: 'tasks', labelKey: 'tender.tasksTab', icon: ListTodo },
    ],
  },
  {
    labelKey: 'tender.phase.submit',
    sections: [
      { value: 'deadline', labelKey: 'deadline.tab', icon: CalendarClock },
      { value: 'activity', labelKey: 'tender.activityTab', icon: Activity },
    ],
  },
];

export function TenderPhaseSidebar({
  activeSection,
  onSectionChange,
  statuses,
  unreadClarifications,
}: {
  activeSection: string;
  onSectionChange: (section: string) => void;
  statuses: Record<string, SectionStatus>;
  unreadClarifications: number;
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);

  const completedCount = Object.values(statuses).filter((s) => s === 'complete').length;

  return (
    <div
      className={cn(
        'shrink-0 border-r border-border/40 bg-card/50 flex flex-col transition-all duration-200',
        collapsed ? 'w-14' : 'w-[220px]'
      )}
    >
      <div className="flex items-center justify-end px-2 pt-3 pb-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 cursor-pointer"
          onClick={() => setCollapsed(!collapsed)}
          title={t('tender.sidebar.toggle')}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {phases.map((phase, pi) => (
          <div key={pi} className="mb-3">
            {!collapsed && (
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {t(phase.labelKey)}
              </div>
            )}
            {phase.sections.map((section) => {
              const isActive = activeSection === section.value;
              const status = statuses[section.value] ?? 'not_started';
              const Icon = section.icon;

              return (
                <button
                  key={section.value}
                  type="button"
                  onClick={() => onSectionChange(section.value)}
                  className={cn(
                    'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors cursor-pointer',
                    isActive
                      ? 'bg-muted/60 text-foreground border-l-2 border-[#48A4D6] -ml-[2px] pl-[calc(0.625rem+2px)]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
                    collapsed && 'justify-center px-0'
                  )}
                  title={collapsed ? t(section.labelKey) : undefined}
                >
                  <SectionStatusIcon status={status} />
                  {!collapsed && (
                    <span className="flex-1 text-left truncate text-[13px]">
                      {t(section.labelKey)}
                    </span>
                  )}
                  {!collapsed && section.value === 'legal' && unreadClarifications > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                      {unreadClarifications}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="px-3 pb-4">
          <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / 11) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            {t('tender.sidebar.progress').replace('{{count}}', String(completedCount))}
          </p>
        </div>
      )}
    </div>
  );
}
