'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// ─── Tender Status ──────────────────────────────────────────
const tenderStatusMap: Record<string, { label: string; className: string }> = {
  DISCOVERY: {
    label: 'Ανακάλυψη',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20',
  },
  GO_NO_GO: {
    label: 'Go / No-Go',
    className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20',
  },
  IN_PROGRESS: {
    label: 'Σε εξέλιξη',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20',
  },
  SUBMITTED: {
    label: 'Υποβλήθηκε',
    className: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
  },
  WON: {
    label: 'Κερδήθηκε',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  },
  LOST: {
    label: 'Χάθηκε',
    className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20',
  },
};

// ─── Coverage Status ────────────────────────────────────────
const coverageStatusMap: Record<string, { label: string; className: string }> = {
  UNMAPPED: {
    label: 'Μη αντιστοιχισμένο',
    className: 'bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/20',
  },
  COVERED: {
    label: 'Καλύπτεται',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  },
  GAP: {
    label: 'Κενό',
    className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20',
  },
  MANUAL_OVERRIDE: {
    label: 'Χειροκίνητο',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20',
  },
};

// ─── Task Priority ──────────────────────────────────────────
const taskPriorityMap: Record<string, { label: string; className: string }> = {
  LOW: {
    label: 'Χαμηλή',
    className: 'bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/20',
  },
  MEDIUM: {
    label: 'Μέτρια',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20',
  },
  HIGH: {
    label: 'Υψηλή',
    className: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20',
  },
  URGENT: {
    label: 'Επείγουσα',
    className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20',
  },
};

// ─── Task Status ────────────────────────────────────────────
const taskStatusMap: Record<string, { label: string; className: string }> = {
  TODO: {
    label: 'Εκκρεμεί',
    className: 'bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/20',
  },
  IN_PROGRESS: {
    label: 'Σε εξέλιξη',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20',
  },
  DONE: {
    label: 'Ολοκληρώθηκε',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  },
};

// ─── Doc Gen Status ─────────────────────────────────────────
const docGenStatusMap: Record<string, { label: string; className: string }> = {
  DRAFT: {
    label: 'Πρόχειρο',
    className: 'bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/20',
  },
  REVIEWED: {
    label: 'Ελεγμένο',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20',
  },
  FINAL: {
    label: 'Τελικό',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  },
};

// ─── Requirement Category ───────────────────────────────────
const requirementCategoryMap: Record<string, { label: string; className: string }> = {
  PARTICIPATION_CRITERIA: {
    label: 'Κριτήρια Συμμετοχής',
    className: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
  },
  EXCLUSION_CRITERIA: {
    label: 'Κριτήρια Αποκλεισμού',
    className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20',
  },
  TECHNICAL_REQUIREMENTS: {
    label: 'Τεχνικές Απαιτήσεις',
    className: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
  },
  FINANCIAL_REQUIREMENTS: {
    label: 'Οικονομικές Απαιτήσεις',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  },
  DOCUMENTATION_REQUIREMENTS: {
    label: 'Δικαιολογητικά',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20',
  },
  CONTRACT_TERMS: {
    label: 'Όροι Σύμβασης',
    className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20',
  },
};

// ─── Requirement Type ───────────────────────────────────────
const requirementTypeMap: Record<string, { label: string; className: string }> = {
  DOCUMENT: { label: 'Έγγραφο', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20' },
  EXPERIENCE: { label: 'Εμπειρία', className: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/20' },
  CERTIFICATE: { label: 'Πιστοποιητικό', className: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/20' },
  DECLARATION: { label: 'Δήλωση', className: 'bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-500/20' },
  FINANCIAL: { label: 'Οικονομικό', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
  TECHNICAL: { label: 'Τεχνικό', className: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/20' },
  OTHER: { label: 'Άλλο', className: 'bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/20' },
};

// ─── Platform ───────────────────────────────────────────────
const platformMap: Record<string, { label: string; className: string }> = {
  ESIDIS: { label: 'ΕΣΗΔΗΣ', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20' },
  COSMOONE: { label: 'Cosmote One', className: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/20' },
  ISUPPLIES: { label: 'iSupplies', className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20' },
  OTHER: { label: 'Άλλο', className: 'bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/20' },
};

// ─── Generic Badge Component ────────────────────────────────
interface StatusBadgeProps {
  type: 'tender' | 'coverage' | 'priority' | 'taskStatus' | 'docGenStatus' | 'category' | 'reqType' | 'platform';
  value: string;
  className?: string;
}

const mapRegistry: Record<string, Record<string, { label: string; className: string }>> = {
  tender: tenderStatusMap,
  coverage: coverageStatusMap,
  priority: taskPriorityMap,
  taskStatus: taskStatusMap,
  docGenStatus: docGenStatusMap,
  category: requirementCategoryMap,
  reqType: requirementTypeMap,
  platform: platformMap,
};

export function StatusBadge({ type, value, className }: StatusBadgeProps) {
  const map = mapRegistry[type];
  const config = map?.[value] ?? { label: value, className: 'bg-gray-500/15 text-gray-700 dark:text-gray-400' };

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-semibold text-[11px] transition-colors duration-200',
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}

// Export maps for external consumption
export {
  tenderStatusMap,
  coverageStatusMap,
  taskPriorityMap,
  taskStatusMap,
  docGenStatusMap,
  requirementCategoryMap,
  requirementTypeMap,
  platformMap,
};
