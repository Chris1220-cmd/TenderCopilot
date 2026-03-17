'use client';

import { useState } from 'react';
import { cn, formatDate, getInitials } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/tender/status-badge';
import {
  Plus,
  CalendarDays,
  Circle,
  Timer,
  CheckCircle2,
} from 'lucide-react';

interface TasksTabProps {
  tenderId: string;
}

const columnConfig = [
  { status: 'TODO', label: 'Εκκρεμεί', icon: Circle, color: 'border-gray-500/30' },
  { status: 'IN_PROGRESS', label: 'Σε εξέλιξη', icon: Timer, color: 'border-amber-500/30' },
  { status: 'DONE', label: 'Ολοκληρώθηκε', icon: CheckCircle2, color: 'border-emerald-500/30' },
];

export function TasksTab({ tenderId }: TasksTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<any | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState('MEDIUM');
  const [formDueDate, setFormDueDate] = useState('');

  const utils = trpc.useUtils();

  const tasksQuery = trpc.task.listByTender.useQuery(
    { tenderId },
    { retry: false }
  );

  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      utils.task.listByTender.invalidate({ tenderId });
      resetForm();
      setCreateOpen(false);
    },
  });

  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => {
      utils.task.listByTender.invalidate({ tenderId });
      setEditTask(null);
    },
  });

  const tasks = (tasksQuery.data ?? []) as any[];

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormPriority('MEDIUM');
    setFormDueDate('');
  };

  const handleCreate = () => {
    createTask.mutate({
      tenderId,
      title: formTitle,
      description: formDescription || undefined,
      priority: formPriority as any,
      dueDate: formDueDate ? new Date(formDueDate) : undefined,
    });
  };

  const handleStatusChange = (taskId: string, newStatus: string) => {
    updateTask.mutate({ id: taskId, status: newStatus as any });
  };

  const openEdit = (task: any) => {
    if (!task) return;
    setEditTask(task);
    setFormTitle(task.title ?? '');
    setFormDescription(task.description ?? '');
    setFormPriority(task.priority ?? 'MEDIUM');
    setFormDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
  };

  const handleEditSave = () => {
    if (!editTask) return;
    updateTask.mutate({
      id: editTask.id,
      title: formTitle,
      description: formDescription || undefined,
      priority: formPriority as any,
      dueDate: formDueDate ? new Date(formDueDate) : undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {tasks.length} εργασίες
        </h3>
        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button
              className={cn(
                'cursor-pointer gap-2',
                'bg-gradient-to-r from-indigo-600 to-violet-600',
                'hover:from-indigo-500 hover:to-violet-500',
                'shadow-lg shadow-indigo-500/25',
                'border-0 text-white'
              )}
            >
              <Plus className="h-4 w-4" />
              Νέα Εργασία
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Νέα Εργασία</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="task-title">Τίτλος</Label>
                <Input
                  id="task-title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Τίτλος εργασίας..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-desc">Περιγραφή</Label>
                <Textarea
                  id="task-desc"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Προαιρετική περιγραφή..."
                  className="min-h-[80px] resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Προτεραιότητα</Label>
                  <Select value={formPriority} onValueChange={setFormPriority}>
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Χαμηλή</SelectItem>
                      <SelectItem value="MEDIUM">Μέτρια</SelectItem>
                      <SelectItem value="HIGH">Υψηλή</SelectItem>
                      <SelectItem value="URGENT">Επείγουσα</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-due">Προθεσμία</Label>
                  <Input
                    id="task-due"
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" className="cursor-pointer">
                  Ακύρωση
                </Button>
              </DialogClose>
              <Button
                onClick={handleCreate}
                disabled={!formTitle.trim() || createTask.isPending}
                className={cn(
                  'cursor-pointer',
                  'bg-gradient-to-r from-indigo-600 to-violet-600',
                  'hover:from-indigo-500 hover:to-violet-500',
                  'border-0 text-white'
                )}
              >
                Δημιουργία
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban Columns */}
      {!tasksQuery.isLoading && tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Circle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Δεν υπάρχουν εργασίες ακόμα.
            </p>
          </CardContent>
        </Card>
      ) : tasksQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {columnConfig.map((col) => (
            <div key={col.status} className="space-y-3">
              <Skeleton className="h-6 w-32" />
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-full mb-3" />
                    <Skeleton className="h-3 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {columnConfig.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.status);
            const ColIcon = col.icon;

            return (
              <div key={col.status} className="space-y-3">
                {/* Column Header */}
                <div className={cn(
                  'flex items-center gap-2 rounded-lg border-l-4 bg-muted/40 px-3 py-2',
                  col.color
                )}>
                  <ColIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {colTasks.length}
                  </span>
                </div>

                {/* Task Cards */}
                {colTasks.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-muted-foreground/20 p-6 text-center">
                    <p className="text-xs text-muted-foreground">Κενή στήλη</p>
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <Card
                      key={task.id}
                      className={cn(
                        'group transition-all duration-200 cursor-pointer',
                        'hover:shadow-md hover:border-primary/15 hover:-translate-y-0.5',
                        'bg-gradient-to-br from-background to-muted/20'
                      )}
                      onClick={() => openEdit(task)}
                    >
                      <CardContent className="p-4 space-y-3">
                        {/* Priority + Title */}
                        <div className="flex items-start gap-2">
                          <StatusBadge type="priority" value={task.priority} className="shrink-0 mt-0.5" />
                          <h4 className="text-sm font-medium leading-snug line-clamp-2">
                            {task.title}
                          </h4>
                        </div>

                        {/* Description */}
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        {/* Linked Requirement */}
                        {task?.requirement && (
                          <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-md px-2 py-1 line-clamp-1">
                            {task.requirement?.text ?? ''}
                          </div>
                        )}

                        {/* Footer: Assignee + Due Date */}
                        <div className="flex items-center justify-between pt-1">
                          {task.assignee ? (
                            <div className="flex items-center gap-1.5">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={task.assignee?.image ?? undefined} />
                                <AvatarFallback className="text-[10px] bg-primary/10">
                                  {getInitials(task.assignee?.name ?? '')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-[11px] text-muted-foreground">
                                {task.assignee?.name ?? 'Χωρίς όνομα'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Μη ανατεθειμένο</span>
                          )}

                          {task.dueDate && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <CalendarDays className="h-3 w-3" />
                              {formatDate(task.dueDate)}
                            </div>
                          )}
                        </div>

                        {/* Quick Status Change */}
                        <div
                          className="flex gap-1 pt-1 border-t border-dashed border-muted-foreground/10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {columnConfig
                            .filter((c) => c.status !== task.status)
                            .map((c) => {
                              const Icon = c.icon;
                              return (
                                <Button
                                  key={c.status}
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-[10px] gap-1 cursor-pointer flex-1"
                                  onClick={() => handleStatusChange(task.id, c.status)}
                                >
                                  <Icon className="h-3 w-3" />
                                  {c.label}
                                </Button>
                              );
                            })}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Task Dialog */}
      <Dialog open={!!editTask} onOpenChange={(open) => { if (!open) { setEditTask(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Επεξεργασία Εργασίας</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-task-title">Τίτλος</Label>
              <Input
                id="edit-task-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-task-desc">Περιγραφή</Label>
              <Textarea
                id="edit-task-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Προτεραιότητα</Label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Χαμηλή</SelectItem>
                    <SelectItem value="MEDIUM">Μέτρια</SelectItem>
                    <SelectItem value="HIGH">Υψηλή</SelectItem>
                    <SelectItem value="URGENT">Επείγουσα</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-task-due">Προθεσμία</Label>
                <Input
                  id="edit-task-due"
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="cursor-pointer">
                Ακύρωση
              </Button>
            </DialogClose>
            <Button
              onClick={handleEditSave}
              disabled={!formTitle.trim() || updateTask.isPending}
              className={cn(
                'cursor-pointer',
                'bg-gradient-to-r from-indigo-600 to-violet-600',
                'hover:from-indigo-500 hover:to-violet-500',
                'border-0 text-white'
              )}
            >
              Αποθήκευση
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
