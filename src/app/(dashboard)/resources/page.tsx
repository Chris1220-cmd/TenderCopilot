'use client';

import { trpc } from '@/lib/trpc';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'motion/react';
import { Shield, AlertTriangle, Landmark, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PremiumStatCardV2 } from '@/components/ui/premium-stat-card-v2';
import { BlurFade } from '@/components/ui/blur-fade';
import { AlertsSection } from '@/components/resources/alerts-section';
import { CertificateMatrix } from '@/components/resources/certificate-matrix';
import { GuaranteeSection } from '@/components/resources/guarantee-section';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function ResourcesPage() {
  const { t } = useTranslation();

  const { data: kpis, isLoading: kpisLoading } =
    trpc.resources.getKpis.useQuery();
  const { data: alertsData, isLoading: alertsLoading } =
    trpc.resources.getAlerts.useQuery();
  const { data: matrixData, isLoading: matrixLoading } =
    trpc.resources.getCertificateMatrix.useQuery();
  const { data: guaranteeData, isLoading: guaranteeLoading } =
    trpc.resources.getGuaranteeOverview.useQuery();

  const isLoading =
    kpisLoading || alertsLoading || matrixLoading || guaranteeLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 p-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <BlurFade delay={0.05}>
          <h1 className="text-2xl font-bold text-foreground">
            {t('resources.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('resources.subtitle')}
          </p>
        </BlurFade>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <PremiumStatCardV2
          title={t('resources.kpi.activeTenders')}
          value={kpis?.activeTenders ?? 0}
          subtitle=""
          icon={Shield}
          index={0}
        />
        <PremiumStatCardV2
          title={t('resources.kpi.criticalAlerts')}
          value={alertsData?.criticalCount ?? 0}
          subtitle=""
          icon={AlertTriangle}
          index={1}
        />
        <PremiumStatCardV2
          title={t('resources.kpi.guaranteeCommitted')}
          value={kpis?.guaranteeCommitted ?? 0}
          suffix="€"
          subtitle=""
          icon={Landmark}
          index={2}
        />
        <PremiumStatCardV2
          title={t('resources.kpi.winRate')}
          value={kpis?.winRate ?? 0}
          suffix="%"
          subtitle=""
          icon={TrendingUp}
          index={3}
        />
      </motion.div>

      {/* Section A: Alerts */}
      <motion.div variants={itemVariants}>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          {t('resources.alerts.title')}
        </h2>
        <AlertsSection alerts={alertsData?.alerts ?? []} />
      </motion.div>

      {/* Section B: Certificate Matrix */}
      <motion.div variants={itemVariants}>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          {t('resources.matrix.title')}
        </h2>
        {matrixData && <CertificateMatrix data={matrixData} />}
      </motion.div>

      {/* Section C: Guarantee Exposure */}
      {guaranteeData && <GuaranteeSection data={guaranteeData} />}
    </motion.div>
  );
}
