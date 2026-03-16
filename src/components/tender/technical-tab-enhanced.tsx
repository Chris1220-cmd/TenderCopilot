'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
  GlassCardAction,
  GlassCardFooter,
} from '@/components/ui/glass-card';
import {
  Wrench,
  FileCode2,
  ShieldAlert,
  Users,
  BarChart3,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Pencil,
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  GripVertical,
  Star,
  Target,
  Cpu,
  Shield,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────
type SectionStatus = 'AI_DRAFT' | 'HUMAN_EDITING' | 'REVIEWED' | 'APPROVED';

interface ProposalSection {
  id: string;
  order: number;
  title: string;
  status: SectionStatus;
  content: string;
}

interface TechRisk {
  id: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  mitigation: string;
}

interface TeamRequirement {
  id: string;
  role: string;
  qualifications: string;
  experienceYears: number;
  count: number;
  mappedStaff: string | null;
  status: 'MAPPED' | 'PARTIAL' | 'UNMAPPED';
}

interface ScoreCriterion {
  name: string;
  maxScore: number;
  estimatedScore: number;
}

// ─── Mock Data ────────────────────────────────────────────────
const mockSections: ProposalSection[] = [
  {
    id: 'sec-1',
    order: 1,
    title: 'Κατανόηση Αντικειμένου & Μεθοδολογία',
    status: 'AI_DRAFT',
    content: '## Κατανόηση Αντικειμένου\n\nΗ εταιρεία μας κατανοεί πλήρως τις ανάγκες του Δήμου Αθηναίων για εκσυγχρονισμό του πληροφοριακού εξοπλισμού. Η προτεινόμενη λύση περιλαμβάνει:\n\n- **Σταθμούς εργασίας** τελευταίας γενιάς με Intel i7 / 16GB RAM\n- **Servers** Dell PowerEdge R750 με redundancy\n- **Δικτυακό εξοπλισμό** Cisco Catalyst για enterprise networking\n\n### Μεθοδολογία Υλοποίησης\n\nΗ υλοποίηση θα ακολουθήσει μεθοδολογία Prince2 με τέσσερις φάσεις:\n\n1. **Φάση 1: Σχεδιασμός** (2 εβδομάδες)\n2. **Φάση 2: Προμήθεια** (4 εβδομάδες)\n3. **Φάση 3: Εγκατάσταση** (4 εβδομάδες)\n4. **Φάση 4: Παράδοση & Εκπαίδευση** (2 εβδομάδες)',
  },
  {
    id: 'sec-2',
    order: 2,
    title: 'Τεχνικές Προδιαγραφές Εξοπλισμού',
    status: 'HUMAN_EDITING',
    content: '## Τεχνικές Προδιαγραφές\n\n### Σταθμοί Εργασίας (50 τεμ.)\n- Επεξεργαστής: Intel Core i7-13700 ή ανώτερος\n- Μνήμη: 16GB DDR5\n- Αποθηκευτικός χώρος: 512GB NVMe SSD\n- Οθόνη: 24" IPS Full HD\n\n### Servers (3 τεμ.)\n- Dell PowerEdge R750\n- Dual Xeon Gold 6326\n- 128GB ECC DDR5\n- RAID 10 SAS',
  },
  {
    id: 'sec-3',
    order: 3,
    title: 'Χρονοδιάγραμμα Υλοποίησης',
    status: 'REVIEWED',
    content: '## Χρονοδιάγραμμα\n\nΣυνολική διάρκεια: 12 εβδομάδες\n\n| Φάση | Διάρκεια | Παραδοτέα |\n|------|----------|----------|\n| Σχεδιασμός | 2 εβδ. | Project Plan |\n| Προμήθεια | 4 εβδ. | Εξοπλισμός |\n| Εγκατάσταση | 4 εβδ. | Setup |\n| Παράδοση | 2 εβδ. | Handover |',
  },
  {
    id: 'sec-4',
    order: 4,
    title: 'Ομάδα Έργου & Εμπειρία',
    status: 'APPROVED',
    content: '## Ομάδα Έργου\n\nΗ ομάδα αποτελείται από 6 ειδικούς:\n\n- **Project Manager** - 10+ έτη εμπειρίας\n- **Network Engineer** - Cisco CCNP\n- **Systems Administrator** - Microsoft MCSE\n- **2x Τεχνικοί Εγκατάστασης**\n- **Help Desk Support**',
  },
  {
    id: 'sec-5',
    order: 5,
    title: 'Εγγυήσεις & Υποστήριξη',
    status: 'AI_DRAFT',
    content: '## Εγγυήσεις\n\n- Εγγύηση εξοπλισμού: 36 μήνες\n- SLA 99.5% uptime\n- Response time: 4 ώρες\n- On-site support: Εντός 24 ωρών',
  },
];

const mockRisks: TechRisk[] = [
  {
    id: 'tr-1',
    riskLevel: 'HIGH',
    title: 'Καθυστέρηση Παράδοσης Εξοπλισμού',
    description: 'Λόγω παγκόσμιων ελλείψεων, πιθανή καθυστέρηση 2-4 εβδομάδες στην παράδοση servers.',
    mitigation: 'Προ-παραγγελία εξοπλισμού αμέσως μετά την ανάθεση. Εναλλακτικοί προμηθευτές σε standby.',
  },
  {
    id: 'tr-2',
    riskLevel: 'MEDIUM',
    title: 'Συμβατότητα Δικτυακού Εξοπλισμού',
    description: 'Ο υπάρχων εξοπλισμός του Δήμου μπορεί να μην είναι πλήρως συμβατός.',
    mitigation: 'Αναλυτικό site survey πριν την εγκατάσταση. Adapters και protocol converters σε απόθεμα.',
  },
  {
    id: 'tr-3',
    riskLevel: 'LOW',
    title: 'Εκπαίδευση Χρηστών',
    description: 'Πιθανή αντίσταση χρηστών στη νέα τεχνολογία.',
    mitigation: 'Πρόγραμμα εκπαίδευσης σε 3 στάδια. Help desk support για 3 μήνες μετά το deployment.',
  },
  {
    id: 'tr-4',
    riskLevel: 'CRITICAL',
    title: 'Data Migration',
    description: 'Μεταφορά δεδομένων από legacy συστήματα ενέχει κίνδυνο απώλειας δεδομένων.',
    mitigation: 'Full backup πριν τη μετάκληση. Δοκιμαστική μεταφορά σε staging environment. Rollback plan.',
  },
];

const mockTeam: TeamRequirement[] = [
  { id: 'tm-1', role: 'Project Manager', qualifications: 'PMP ή Prince2 Practitioner', experienceYears: 8, count: 1, mappedStaff: 'Γ. Παπαδόπουλος', status: 'MAPPED' },
  { id: 'tm-2', role: 'Network Engineer', qualifications: 'Cisco CCNP ή ανώτερο', experienceYears: 5, count: 1, mappedStaff: 'Α. Νικολάου', status: 'MAPPED' },
  { id: 'tm-3', role: 'Systems Administrator', qualifications: 'Microsoft MCSE, VMware VCP', experienceYears: 5, count: 1, mappedStaff: null, status: 'UNMAPPED' },
  { id: 'tm-4', role: 'Τεχνικός Εγκατάστασης', qualifications: 'CompTIA A+', experienceYears: 2, count: 2, mappedStaff: 'Κ. Δημητρίου (1/2)', status: 'PARTIAL' },
  { id: 'tm-5', role: 'Help Desk Support', qualifications: 'ITIL Foundation', experienceYears: 2, count: 1, mappedStaff: 'Μ. Αλεξίου', status: 'MAPPED' },
];

const mockScoreCriteria: ScoreCriterion[] = [
  { name: 'Μεθοδολογία', maxScore: 30, estimatedScore: 24 },
  { name: 'Τεχνικές Προδιαγραφές', maxScore: 25, estimatedScore: 22 },
  { name: 'Ομάδα Έργου', maxScore: 20, estimatedScore: 15 },
  { name: 'Χρονοδιάγραμμα', maxScore: 15, estimatedScore: 13 },
  { name: 'Εγγυήσεις & Υποστήριξη', maxScore: 10, estimatedScore: 8 },
];

// ─── Status Config ────────────────────────────────────────────
const sectionStatusConfig: Record<SectionStatus, { label: string; bg: string; text: string; border: string }> = {
  AI_DRAFT: {
    label: 'AI Draft',
    bg: 'bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-500/20',
  },
  HUMAN_EDITING: {
    label: 'Επεξεργασία',
    bg: 'bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-500/20',
  },
  REVIEWED: {
    label: 'Ελεγμένο',
    bg: 'bg-purple-500/15',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-500/20',
  },
  APPROVED: {
    label: 'Εγκρίθηκε',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500/20',
  },
};

const riskConfig = {
  LOW: { label: 'Χαμηλό', bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
  MEDIUM: { label: 'Μέτριο', bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-500' },
  HIGH: { label: 'Υψηλό', bg: 'bg-orange-500/15', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-500/20', dot: 'bg-orange-500' },
  CRITICAL: { label: 'Κρίσιμο', bg: 'bg-red-500/15', text: 'text-red-700 dark:text-red-400', border: 'border-red-500/20', dot: 'bg-red-500' },
};

const staffStatusConfig = {
  MAPPED: { label: 'Αντιστοιχίστηκε', bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-500/20' },
  PARTIAL: { label: 'Μερικά', bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-500/20' },
  UNMAPPED: { label: 'Κενό', bg: 'bg-red-500/15', text: 'text-red-700 dark:text-red-400', border: 'border-red-500/20' },
};

// ─── Component ────────────────────────────────────────────────
interface TechnicalTabEnhancedProps {
  tenderId: string;
}

export function TechnicalTabEnhanced({ tenderId }: TechnicalTabEnhancedProps) {
  const [sections, setSections] = useState<ProposalSection[]>(mockSections);
  const [risks, setRisks] = useState<TechRisk[]>(mockRisks);
  const [team, setTeam] = useState<TeamRequirement[]>(mockTeam);
  const [scoreCriteria, setScoreCriteria] = useState<ScoreCriterion[]>(mockScoreCriteria);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // tRPC mutations with fallback
  const analyzeMutation = trpc.aiRoles?.analyzeTechRequirements?.useMutation?.({
    onSuccess: (data: any) => {
      if (data?.risks) setRisks(data.risks);
      if (data?.team) setTeam(data.team);
      setLoadingAction(null);
    },
    onError: () => setLoadingAction(null),
  }) ?? null;

  const proposalMutation = trpc.aiRoles?.generateProposal?.useMutation?.({
    onSuccess: (data: any) => {
      if (data?.sections) setSections(data.sections);
      setLoadingAction(null);
    },
    onError: () => setLoadingAction(null),
  }) ?? null;

  const flagRisksMutation = trpc.aiRoles?.flagTechRisks?.useMutation?.({
    onSuccess: (data: any) => {
      if (data?.risks) setRisks(data.risks);
      setLoadingAction(null);
    },
    onError: () => setLoadingAction(null),
  }) ?? null;

  const handleAnalyze = () => {
    setLoadingAction('analyze');
    if (analyzeMutation) {
      analyzeMutation.mutate({ tenderId });
    } else {
      setTimeout(() => setLoadingAction(null), 1500);
    }
  };

  const handleGenerate = () => {
    setLoadingAction('generate');
    if (proposalMutation) {
      proposalMutation.mutate({ tenderId });
    } else {
      setTimeout(() => setLoadingAction(null), 1500);
    }
  };

  const handleFlagRisks = () => {
    setLoadingAction('risks');
    if (flagRisksMutation) {
      flagRisksMutation.mutate({ tenderId });
    } else {
      setTimeout(() => setLoadingAction(null), 1500);
    }
  };

  const handleToggleSection = (id: string) => {
    if (editingSection === id) return;
    setExpandedSection(expandedSection === id ? null : id);
  };

  const handleEditSection = (id: string, content: string) => {
    setEditingSection(id);
    setEditContent(content);
    setExpandedSection(id);
  };

  const handleAcceptAI = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'REVIEWED' as SectionStatus } : s))
    );
  };

  const handleApproveSection = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'APPROVED' as SectionStatus } : s))
    );
    if (editingSection === id) {
      setSections((prev) =>
        prev.map((s) => (s.id === id ? { ...s, content: editContent, status: 'APPROVED' as SectionStatus } : s))
      );
      setEditingSection(null);
    }
  };

  const handleSaveEdit = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, content: editContent, status: 'HUMAN_EDITING' as SectionStatus } : s))
    );
    setEditingSection(null);
  };

  const totalMax = scoreCriteria.reduce((sum, c) => sum + c.maxScore, 0);
  const totalEstimated = scoreCriteria.reduce((sum, c) => sum + c.estimatedScore, 0);

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={handleAnalyze}
          disabled={loadingAction !== null}
          variant="outline"
          className="cursor-pointer gap-2 h-9"
        >
          {loadingAction === 'analyze' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
          AI Ανάλυση Απαιτήσεων
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={loadingAction !== null}
          variant="outline"
          className="cursor-pointer gap-2 h-9"
        >
          {loadingAction === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode2 className="h-4 w-4" />}
          Δημιουργία Τεχνικής Πρότασης
        </Button>
        <Button
          onClick={handleFlagRisks}
          disabled={loadingAction !== null}
          variant="outline"
          className="cursor-pointer gap-2 h-9"
        >
          {loadingAction === 'risks' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
          Εντοπισμός Κινδύνων
        </Button>
      </div>

      {/* Proposal Sections */}
      <GlassCard>
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-700 via-indigo-500 to-violet-400" />
        <GlassCardHeader className="pt-2">
          <GlassCardTitle className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-blue-500" />
            Ενότητες Τεχνικής Πρότασης
          </GlassCardTitle>
          <GlassCardDescription>
            {sections.length} ενότητες - {sections.filter((s) => s.status === 'APPROVED').length} εγκρίθηκαν
          </GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="space-y-2">
            {sections
              .sort((a, b) => a.order - b.order)
              .map((section) => {
                const statusCfg = sectionStatusConfig[section.status];
                const isExpanded = expandedSection === section.id;
                const isEditing = editingSection === section.id;

                return (
                  <div
                    key={section.id}
                    className={cn(
                      'rounded-xl border overflow-hidden transition-all duration-200',
                      'bg-white/40 dark:bg-white/[0.03]',
                      'border-white/30 dark:border-white/10',
                      isExpanded && 'border-blue-300/30 dark:border-blue-500/15 shadow-md'
                    )}
                  >
                    {/* Section Header */}
                    <div
                      onClick={() => handleToggleSection(section.id)}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-blue-50/30 dark:hover:bg-blue-500/5 transition-colors duration-150"
                    >
                      <span className="text-xs font-bold text-muted-foreground/50 tabular-nums w-5">
                        {section.order}.
                      </span>
                      <span className="flex-1 text-sm font-medium text-foreground">
                        {section.title}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] font-semibold', statusCfg.bg, statusCfg.text, statusCfg.border)}
                      >
                        {statusCfg.label}
                      </Badge>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-border/30">
                        {isEditing ? (
                          <div className="mt-3 space-y-3">
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="min-h-[200px] font-mono text-xs"
                              placeholder="Markdown content..."
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveEdit(section.id)}
                                className="cursor-pointer gap-1.5 h-8 text-xs"
                              >
                                <Check className="h-3 w-3" />
                                Αποθήκευση
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApproveSection(section.id)}
                                className="cursor-pointer gap-1.5 h-8 text-xs text-emerald-600 hover:text-emerald-500 border-emerald-200 dark:border-emerald-500/20"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Έγκριση
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingSection(null)}
                                className="cursor-pointer h-8 text-xs"
                              >
                                Ακύρωση
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {/* Content Preview */}
                            <div className="rounded-lg bg-muted/20 border border-border/30 p-4 max-h-[300px] overflow-y-auto">
                              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                                {section.content}
                              </pre>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              {section.status === 'AI_DRAFT' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAcceptAI(section.id)}
                                  className="cursor-pointer gap-1.5 h-8 text-xs text-blue-600 hover:text-blue-500 border-blue-200 dark:border-blue-500/20"
                                >
                                  <Sparkles className="h-3 w-3" />
                                  Αποδοχή AI
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditSection(section.id, section.content)}
                                className="cursor-pointer gap-1.5 h-8 text-xs"
                              >
                                <Pencil className="h-3 w-3" />
                                Επεξεργασία
                              </Button>
                              {section.status !== 'APPROVED' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApproveSection(section.id)}
                                  className="cursor-pointer gap-1.5 h-8 text-xs text-emerald-600 hover:text-emerald-500 border-emerald-200 dark:border-emerald-500/20"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Έγκριση
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Technical Risks */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-orange-500" />
            Τεχνικοί Κίνδυνοι
          </GlassCardTitle>
          <GlassCardDescription>
            {risks.length} κίνδυνοι εντοπίστηκαν
          </GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="space-y-3">
            {risks.map((risk) => {
              const cfg = riskConfig[risk.riskLevel];
              return (
                <div
                  key={risk.id}
                  className={cn(
                    'rounded-xl border p-4',
                    'bg-white/40 dark:bg-white/[0.03]',
                    'border-white/30 dark:border-white/10',
                    'transition-all duration-200',
                    'hover:border-orange-300/30 dark:hover:border-orange-500/15'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn('mt-0.5 h-2.5 w-2.5 rounded-full shrink-0', cfg.dot)} />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{risk.title}</span>
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] font-semibold', cfg.bg, cfg.text, cfg.border)}
                        >
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {risk.description}
                      </p>
                      <div className="flex items-start gap-1.5 mt-1">
                        <Shield className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          <span className="font-semibold">Αντιμετώπιση:</span> {risk.mitigation}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Team Requirements */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            Απαιτήσεις Ομάδας Έργου
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ρόλος</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Προσόντα</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Εμπειρία</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">#</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Στέλεχος</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Κατάσταση</th>
                </tr>
              </thead>
              <tbody>
                {team.map((req) => {
                  const sCfg = staffStatusConfig[req.status];
                  return (
                    <tr key={req.id} className="border-b border-border/30">
                      <td className="px-5 py-2.5 text-xs font-semibold text-foreground">{req.role}</td>
                      <td className="px-3 py-2.5 text-[11px] text-muted-foreground hidden md:table-cell">{req.qualifications}</td>
                      <td className="px-3 py-2.5 text-xs text-center text-muted-foreground tabular-nums">{req.experienceYears}+ έτη</td>
                      <td className="px-3 py-2.5 text-xs text-center font-bold tabular-nums">{req.count}</td>
                      <td className="px-3 py-2.5 text-xs text-foreground">
                        {req.mappedStaff ?? <span className="text-muted-foreground/50 italic">Κενό</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] font-semibold', sCfg.bg, sCfg.text, sCfg.border)}
                        >
                          {sCfg.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Proposal Strength Score */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            Εκτιμώμενη Βαθμολογία Πρότασης
          </GlassCardTitle>
          <GlassCardAction>
            <div className="flex items-baseline gap-1.5">
              <span className={cn(
                'text-3xl font-bold tabular-nums',
                totalEstimated >= totalMax * 0.75
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : totalEstimated >= totalMax * 0.5
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
              )}>
                {totalEstimated}
              </span>
              <span className="text-xs text-muted-foreground">/ {totalMax}</span>
            </div>
          </GlassCardAction>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="space-y-3">
            {scoreCriteria.map((criterion, i) => {
              const pct = (criterion.estimatedScore / criterion.maxScore) * 100;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-foreground w-44 shrink-0 truncate">
                    {criterion.name}
                  </span>
                  <div className="flex-1">
                    <div className="h-3 w-full rounded-full bg-muted/30 overflow-hidden relative">
                      {/* Max score area */}
                      <div className="absolute inset-0 bg-blue-500/5 rounded-full" />
                      {/* Estimated score bar */}
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700 ease-out',
                          pct >= 75 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                          pct >= 50 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                          'bg-gradient-to-r from-red-500 to-red-400'
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-bold tabular-nums w-14 text-right text-foreground">
                    {criterion.estimatedScore}/{criterion.maxScore}
                  </span>
                </div>
              );
            })}
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}

export function TechnicalTabEnhancedSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-40" />
      </div>
      <GlassCard>
        <GlassCardContent>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-border/30">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
          ))}
        </GlassCardContent>
      </GlassCard>
      <GlassCard>
        <GlassCardContent>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2 py-3 border-b border-border/30">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
