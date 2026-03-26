'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs';
import { AnimatedTabsTrigger } from '@/components/ui/animated-tabs';
import { ProfileForm } from '@/components/company/profile-form';
import { CertificatesList } from '@/components/company/certificates-list';
import { LegalDocsList } from '@/components/company/legal-docs-list';
import { ProjectsList } from '@/components/company/projects-list';
import { ContentLibrary } from '@/components/company/content-library';
import { TeamMembersList } from '@/components/company/team-members-list';
import { useTranslation } from '@/lib/i18n';
import { BlurFade } from '@/components/ui/blur-fade';
import { Particles } from '@/components/ui/particles';
import {
  Building2,
  ShieldCheck,
  FileCheck,
  Briefcase,
  BookOpen,
  Users,
} from 'lucide-react';

const tabKeys = [
  { value: 'profile', labelKey: 'company.profileTab', icon: Building2 },
  { value: 'certificates', labelKey: 'company.certificatesTab', icon: ShieldCheck },
  { value: 'legal', labelKey: 'company.legalDocsTab', icon: FileCheck },
  { value: 'projects', labelKey: 'company.projectsTab', icon: Briefcase },
  { value: 'library', labelKey: 'company.libraryTab', icon: BookOpen },
  { value: 'team', labelKey: 'company.teamTab', icon: Users },
] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function CompanyPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <BlurFade delay={0.1}>
        <motion.div variants={itemVariants} className="relative">
          <Particles
            className="absolute inset-0 -m-4 rounded-xl"
            quantity={30}
            color="#48A4D6"
            size={0.5}
            staticity={40}
          />
          <h1 className="text-headline text-foreground">{t('company.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('company.subtitle')}
          </p>
        </motion.div>
      </BlurFade>

      {/* Tabs */}
      <BlurFade delay={0.15} inView>
      <motion.div variants={itemVariants}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="border-b border-border/50 bg-transparent p-0 h-auto rounded-none flex-wrap gap-0">
            {tabKeys.map(({ value, labelKey, icon: Icon }) => (
              <AnimatedTabsTrigger key={value} value={value} activeValue={activeTab}>
                <Icon className="h-3.5 w-3.5" />
                {t(labelKey)}
              </AnimatedTabsTrigger>
            ))}
          </TabsList>

          <div className="mt-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as const }}
              >
                <TabsContent value="profile" forceMount={activeTab === 'profile' ? true : undefined}>
                  <ProfileForm />
                </TabsContent>
                <TabsContent value="certificates" forceMount={activeTab === 'certificates' ? true : undefined}>
                  <CertificatesList />
                </TabsContent>
                <TabsContent value="legal" forceMount={activeTab === 'legal' ? true : undefined}>
                  <LegalDocsList />
                </TabsContent>
                <TabsContent value="projects" forceMount={activeTab === 'projects' ? true : undefined}>
                  <ProjectsList />
                </TabsContent>
                <TabsContent value="library" forceMount={activeTab === 'library' ? true : undefined}>
                  <ContentLibrary />
                </TabsContent>
                <TabsContent value="team" forceMount={activeTab === 'team' ? true : undefined}>
                  <TeamMembersList />
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          </div>
        </Tabs>
      </motion.div>
      </BlurFade>
    </motion.div>
  );
}
