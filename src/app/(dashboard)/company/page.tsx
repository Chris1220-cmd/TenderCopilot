'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileForm } from '@/components/company/profile-form';
import { CertificatesList } from '@/components/company/certificates-list';
import { LegalDocsList } from '@/components/company/legal-docs-list';
import { ProjectsList } from '@/components/company/projects-list';
import { ContentLibrary } from '@/components/company/content-library';
import {
  Building2,
  ShieldCheck,
  FileCheck,
  Briefcase,
  BookOpen,
} from 'lucide-react';

const tabs = [
  { value: 'profile', label: 'Προφίλ', icon: Building2 },
  { value: 'certificates', label: 'Πιστοποιητικά', icon: ShieldCheck },
  { value: 'legal', label: 'Νομικά Έγγραφα', icon: FileCheck },
  { value: 'projects', label: 'Έργα Εμπειρίας', icon: Briefcase },
  { value: 'library', label: 'Βιβλιοθήκη Κειμένων', icon: BookOpen },
] as const;

export default function CompanyPage() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Εταιρεία</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Διαχειριστείτε το προφίλ, τα πιστοποιητικά και τη βιβλιοθήκη της εταιρείας σας
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList
          className={cn(
            'grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
            'h-auto gap-1 bg-muted/50 p-1.5 backdrop-blur-sm',
            'rounded-xl border border-white/10'
          )}
        >
          {tabs.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 text-xs sm:text-sm',
                'data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600/10 data-[state=active]:to-violet-600/10',
                'data-[state=active]:border data-[state=active]:border-indigo-500/20',
                'data-[state=active]:shadow-sm'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileForm />
        </TabsContent>
        <TabsContent value="certificates" className="mt-6">
          <CertificatesList />
        </TabsContent>
        <TabsContent value="legal" className="mt-6">
          <LegalDocsList />
        </TabsContent>
        <TabsContent value="projects" className="mt-6">
          <ProjectsList />
        </TabsContent>
        <TabsContent value="library" className="mt-6">
          <ContentLibrary />
        </TabsContent>
      </Tabs>
    </div>
  );
}
