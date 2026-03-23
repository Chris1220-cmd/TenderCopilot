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

const roleLabels: Record<string, string> = {
  ADMIN: 'Διαχειριστής',
  MEMBER: 'Μέλος',
  EXTERNAL_COLLABORATOR: 'Εξωτερικός Συνεργάτης',
};

const roleColors: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
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
  const { toast } = useToast();
  const { data: session } = useSession();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('team');

  const { data: members, isLoading, refetch } = trpc.tenant.getMembers.useQuery();
  const inviteMutation = trpc.tenant.invite.useMutation({
    onSuccess: () => {
      toast({ title: 'Η πρόσκληση στάλθηκε', description: `Πρόσκληση στο ${inviteEmail}` });
      setInviteEmail('');
      setInviteOpen(false);
      refetch();
    },
    onError: (err) => {
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-headline text-foreground">Ρυθμίσεις</h1>
        <p className="text-muted-foreground">
          Διαχείριση ομάδας και ρυθμίσεων λογαριασμού
        </p>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="border-b border-border/50 bg-transparent p-0 h-auto rounded-none gap-0">
            <AnimatedTabsTrigger value="team" activeValue={activeTab}>
              <Users className="h-3.5 w-3.5" />
              Ομάδα
            </AnimatedTabsTrigger>
            <AnimatedTabsTrigger value="profile" activeValue={activeTab}>
              <Shield className="h-3.5 w-3.5" />
              Προφίλ
            </AnimatedTabsTrigger>
          </TabsList>

          <div className="mt-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <TabsContent value="team" className="space-y-4 mt-0">
                  {/* Invite button */}
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-semibold">Μέλη Ομάδας</h2>
                      <p className="text-sm text-muted-foreground">
                        Διαχειριστείτε τα μέλη και τους ρόλους τους
                      </p>
                    </div>
                    <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                      <DialogTrigger asChild>
                        <Button className="gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 cursor-pointer">
                          <UserPlus className="h-4 w-4" />
                          Πρόσκληση
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Πρόσκληση νέου μέλους</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                              type="email"
                              placeholder="user@example.com"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Ρόλος</Label>
                            <Select value={inviteRole} onValueChange={setInviteRole}>
                              <SelectTrigger className="cursor-pointer">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="MEMBER" className="cursor-pointer">Μέλος</SelectItem>
                                <SelectItem value="EXTERNAL_COLLABORATOR" className="cursor-pointer">
                                  Εξωτερικός Συνεργάτης
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
                            Αποστολή Πρόσκλησης
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
                            transition={{ delay: i * 0.03, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
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
                                      Εσείς
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
                      <h3 className="text-base font-semibold">Πληροφορίες Λογαριασμού</h3>
                      <p className="text-sm text-muted-foreground">
                        Βασικά στοιχεία του λογαριασμού σας
                      </p>
                    </div>
                    <Separator className="my-4 opacity-50" />
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Όνομα</Label>
                          <Input
                            defaultValue={session?.user?.name || ''}
                            placeholder="Το όνομά σας"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            defaultValue={session?.user?.email || ''}
                            disabled
                            className="opacity-50"
                          />
                        </div>
                      </div>
                      <Button className="cursor-pointer">Αποθήκευση Αλλαγών</Button>
                    </div>
                  </div>
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          </div>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
