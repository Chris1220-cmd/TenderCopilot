'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { trpc } from '@/lib/trpc';
import { cn, formatDate } from '@/lib/utils';
import {
  CheckSquare,
  Clock,
  AlertCircle,
  Filter,
  Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import { getInitials } from '@/lib/utils';

const priorityColors: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const priorityLabels: Record<string, string> = {
  LOW: 'Χαμηλή',
  MEDIUM: 'Μεσαία',
  HIGH: 'Υψηλή',
  URGENT: 'Επείγον',
};

const statusLabels: Record<string, string> = {
  TODO: 'Εκκρεμεί',
  IN_PROGRESS: 'Σε Εξέλιξη',
  DONE: 'Ολοκληρώθηκε',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

export default function TasksPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data: tasks, isLoading } = trpc.task.listMyTasks.useQuery();

  const filteredTasks = tasks?.filter((task) => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const todoCount = tasks?.filter((t) => t.status === 'TODO').length || 0;
  const inProgressCount = tasks?.filter((t) => t.status === 'IN_PROGRESS').length || 0;
  const doneCount = tasks?.filter((t) => t.status === 'DONE').length || 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-headline text-foreground">Οι Εργασίες Μου</h1>
        <p className="text-muted-foreground">
          Διαχείριση εκκρεμών εργασιών από όλους τους διαγωνισμούς
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-overline">Εκκρεμείς</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/[0.08]">
              <Clock className="h-4 w-4 text-yellow-500" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{todoCount}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-overline">Σε Εξέλιξη</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/[0.08]">
              <AlertCircle className="h-4 w-4 text-blue-500" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{inProgressCount}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-overline">Ολοκληρωμένες</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/[0.08]">
              <CheckSquare className="h-4 w-4 text-green-500" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{doneCount}</p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Αναζήτηση εργασιών..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] cursor-pointer">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Κατάσταση" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="cursor-pointer">Όλες</SelectItem>
            <SelectItem value="TODO" className="cursor-pointer">Εκκρεμείς</SelectItem>
            <SelectItem value="IN_PROGRESS" className="cursor-pointer">Σε Εξέλιξη</SelectItem>
            <SelectItem value="DONE" className="cursor-pointer">Ολοκληρωμένες</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Task list */}
      {isLoading ? (
        <motion.div variants={itemVariants} className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </motion.div>
      ) : filteredTasks && filteredTasks.length > 0 ? (
        <div className="space-y-3">
          {filteredTasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="group flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-primary/20 hover:bg-card/80 cursor-pointer"
            >
              {/* Status indicator */}
              <div
                className={cn(
                  'h-3 w-3 rounded-full shrink-0',
                  task.status === 'TODO' && 'bg-yellow-500',
                  task.status === 'IN_PROGRESS' && 'bg-blue-500',
                  task.status === 'DONE' && 'bg-green-500'
                )}
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{task.title}</span>
                  <Badge
                    variant="outline"
                    className={cn('text-[10px] shrink-0', priorityColors[task.priority])}
                  >
                    {priorityLabels[task.priority]}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <Link
                    href={`/tenders/${task.tenderId}`}
                    className="hover:text-primary transition-colors cursor-pointer"
                  >
                    {(task as any).tender?.title || 'Διαγωνισμός'}
                  </Link>
                  {task.dueDate && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(task.dueDate)}
                    </span>
                  )}
                </div>
              </div>

              {/* Assignee */}
              {(task as any).assignee && (
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getInitials((task as any).assignee?.name)}
                  </AvatarFallback>
                </Avatar>
              )}

              {/* Status label */}
              <Badge variant="secondary" className="shrink-0">
                {statusLabels[task.status]}
              </Badge>
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-border/60 bg-card p-12 text-center">
            <CheckSquare className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <h3 className="mt-4 text-title text-foreground">Καμία εργασία</h3>
            <p className="mt-2 text-body text-muted-foreground">
              Δεν έχετε εκκρεμείς εργασίες αυτή τη στιγμή
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
