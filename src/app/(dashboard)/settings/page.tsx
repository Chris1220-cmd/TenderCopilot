'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Mail,
  Shield,
  UserPlus,
  Trash2,
  Crown,
  Globe,
  Plus,
  Lock as LockIcon,
  Loader2,
} from 'lucide-react';
import { AnimatedTabsTrigger } from '@/components/ui/animated-tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getInitials } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/lib/i18n';
import { SUPPORTED_COUNTRIES, getCountryConfig } from '@/lib/country-config';
import { BlurFade } from '@/components/ui/blur-fade';
import { Particles } from '@/components/ui/particles';

const roleColors: Record<string, string> = {
  ADMIN: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary',
  MEMBER: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  EXTERNAL_COLLABORATOR: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: session } = useSession();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('team');

  const roleLabels: Record<string, string> = {
    ADMIN: t('roles.admin'),
    MEMBER: t('roles.member'),
    EXTERNAL_COLLABORATOR: t('roles.externalCollaborator'),
  };

  const { data: tenantData, refetch: refetchTenant } = trpc.tenant.get.useQuery();
  const addCountryMutation = trpc.tenant.addCountry.useMutation({
    onSuccess: () => { refetchTenant(); },
    onError: (err) => { alert(err.message); },
  });
  const { data: members, isLoading, refetch } = trpc.tenant.getMembers.useQuery();
  const inviteMutation = trpc.tenant.invite.useMutation({
    onSuccess: () => {
      toast({ title: t('settings.inviteSent'), description: t('settings.inviteSentTo').replace('{email}', inviteEmail) });
      setInviteEmail('');
      setInviteOpen(false);
      refetch();
    },
    onError: (err) => {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    },
  });

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <BlurFade delay={0.1}>
        <motion.div variants={itemVariants} className="relative">
          <Particles
            className="absolute inset-0 -m-4 rounded-xl"
            quantity={30}
            color="#48A4D6"
            size={0.5}
            staticity={40}
          />
          <h1 className="text-headline text-foreground">{t('settings.title')}</h1>
          <p className="text-muted-foreground">
            {t('settings.subtitle')}
          </p>
        </motion.div>
      </BlurFade>

      <BlurFade delay={0.15} inView>
      <motion.div variants={itemVariants}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="border-b border-border/50 bg-transparent p-0 h-auto rounded-none gap-0">
            <AnimatedTabsTrigger value="team" activeValue={activeTab}>
              <Users className="h-3.5 w-3.5" />
              {t('settings.teamTab')}
            </AnimatedTabsTrigger>
            <AnimatedTabsTrigger value="profile" activeValue={activeTab}>
              <Shield className="h-3.5 w-3.5" />
              {t('settings.profileTab')}
            </AnimatedTabsTrigger>
            <AnimatedTabsTrigger value="countries" activeValue={activeTab}>
              <Globe className="h-3.5 w-3.5" />
              {t('settings.countriesTab')}
            </AnimatedTabsTrigger>
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
                <TabsContent value="team" className="space-y-4 mt-0">
                  {/* Invite button */}
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-semibold">{t('settings.teamMembers')}</h2>
                      <p className="text-sm text-muted-foreground">
                        {t('settings.teamMembersSub')}
                      </p>
                    </div>
                    <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                      <DialogTrigger asChild>
                        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer">
                          <UserPlus className="h-4 w-4" />
                          {t('settings.invite')}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t('settings.inviteNewMember')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>{t('settings.email')}</Label>
                            <Input
                              type="email"
                              placeholder="user@example.com"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t('settings.role')}</Label>
                            <Select value={inviteRole} onValueChange={setInviteRole}>
                              <SelectTrigger className="cursor-pointer">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="MEMBER" className="cursor-pointer">{t('roles.member')}</SelectItem>
                                <SelectItem value="EXTERNAL_COLLABORATOR" className="cursor-pointer">
                                  {t('roles.externalCollaborator')}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() =>
                              inviteMutation.mutate({
                                email: inviteEmail,
                                role: inviteRole as any,
                              })
                            }
                            disabled={!inviteEmail || inviteMutation.isPending}
                            className="cursor-pointer"
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            {t('settings.sendInvite')}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Members list */}
                  <div className="rounded-xl border border-border/60 bg-card p-0">
                    {isLoading ? (
                      <div className="p-4 space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {members?.map((member, i) => (
                          <motion.div
                            key={member.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03, duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
                            className="flex items-center justify-between p-4"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {getInitials(member.user.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium flex items-center gap-2">
                                  {member.user.name || member.user.email}
                                  {member.user.id === session?.user?.id && (
                                    <Badge variant="outline" className="text-[10px]">
                                      {t('settings.you')}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {member.user.email}
                                </div>
                              </div>
                            </div>
                            <Badge className={roleColors[member.role]}>
                              {member.role === 'ADMIN' && (
                                <Crown className="mr-1 h-3 w-3" />
                              )}
                              {roleLabels[member.role]}
                            </Badge>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="profile" className="space-y-4 mt-0">
                  <div className="rounded-xl border border-border/60 bg-card p-6">
                    <div className="mb-1">
                      <h3 className="text-base font-semibold">{t('settings.accountInfo')}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t('settings.accountInfoSub')}
                      </p>
                    </div>
                    <Separator className="my-4 opacity-50" />
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t('settings.name')}</Label>
                          <Input
                            defaultValue={session?.user?.name || ''}
                            placeholder={t('settings.namePlaceholder')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('settings.email')}</Label>
                          <Input
                            defaultValue={session?.user?.email || ''}
                            disabled
                            className="opacity-50"
                          />
                        </div>
                      </div>
                      <Button className="cursor-pointer">{t('settings.saveChanges')}</Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="countries" className="space-y-4 mt-0">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-semibold">{t('settings.countriesTitle')}</h2>
                      <p className="text-sm text-muted-foreground">
                        {t('settings.countriesSub')}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {(tenantData?.countries ?? ['GR']).map((code) => {
                      const config = getCountryConfig(code);
                      return (
                        <div
                          key={code}
                          className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-sm">
                            {code}
                          </div>
                          <div>
                            <div className="font-medium">{config.name}</div>
                            <div className="text-xs text-muted-foreground">{config.legalFramework.name}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {(() => {
                    const maxCountries = tenantData?.subscription?.plan?.maxCountries;
                    const currentCount = tenantData?.countries?.length ?? 1;
                    const canAdd = maxCountries === null || maxCountries === undefined || currentCount < maxCountries;
                    const availableCountries = SUPPORTED_COUNTRIES.filter(
                      c => !(tenantData?.countries ?? []).includes(c.code)
                    );

                    if (availableCountries.length === 0) return null;

                    return (
                      <Button
                        variant="outline"
                        disabled={!canAdd || addCountryMutation.isPending}
                        className="gap-2 cursor-pointer"
                        onClick={() => {
                          const next = availableCountries[0];
                          if (next) addCountryMutation.mutate({ country: next.code });
                        }}
                      >
                        {addCountryMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : canAdd ? (
                          <Plus className="h-4 w-4" />
                        ) : (
                          <LockIcon className="h-4 w-4" />
                        )}
                        {addCountryMutation.isPending
                          ? '...'
                          : canAdd ? t('settings.addCountry') : t('settings.upgradeForCountries')}
                      </Button>
                    );
                  })()}
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
