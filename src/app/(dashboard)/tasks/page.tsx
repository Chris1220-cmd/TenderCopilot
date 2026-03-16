'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { cn, formatDate } from '@/lib/utils';
import {
  CheckSquare,
  Clock,
  AlertCircle,
  Filter,
  Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Οι Εργασίες Μου</h1>
        <p className="text-muted-foreground">
          Διαχείριση εκκρεμών εργασιών από όλους τους διαγωνισμούς
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Εκκρεμείς
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todoCount}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Σε Εξέλιξη
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressCount}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ολοκληρωμένες
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{doneCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
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
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredTasks && filteredTasks.length > 0 ? (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <Card
              key={task.id}
              className="group transition-all duration-200 hover:shadow-md hover:border-primary/20 cursor-pointer"
            >
              <CardContent className="flex items-center gap-4 p-4">
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
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <CheckSquare className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <h3 className="mt-4 text-lg font-semibold">Καμία εργασία</h3>
          <p className="mt-2 text-muted-foreground">
            Δεν έχετε εκκρεμείς εργασίες αυτή τη στιγμή
          </p>
        </Card>
      )}
    </div>
  );
}
