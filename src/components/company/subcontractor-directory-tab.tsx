'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Users, Plus, Search, Star, Phone, Mail, Building2, Trash2, Edit2, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function SubcontractorDirectoryTab() {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    specialties: '',
    kind: 'SUBCONTRACTOR' as 'SUBCONTRACTOR' | 'SUPPLIER',
    certifications: '',
    regions: '',
    rating: 0,
    notes: '',
  });

  const utils = trpc.useUtils();
  const { data: contacts, isLoading } = trpc.subcontractorDirectory.list.useQuery(
    search ? { search } : undefined
  );

  const createMutation = trpc.subcontractorDirectory.create.useMutation({
    onSuccess: () => { utils.subcontractorDirectory.list.invalidate(); setShowAdd(false); resetForm(); },
  });
  const updateMutation = trpc.subcontractorDirectory.update.useMutation({
    onSuccess: () => { utils.subcontractorDirectory.list.invalidate(); setEditId(null); resetForm(); },
  });
  const deleteMutation = trpc.subcontractorDirectory.delete.useMutation({
    onSuccess: () => { utils.subcontractorDirectory.list.invalidate(); },
  });

  function resetForm() {
    setForm({ companyName: '', contactPerson: '', email: '', phone: '', specialties: '', kind: 'SUBCONTRACTOR', certifications: '', regions: '', rating: 0, notes: '' });
  }

  function openEdit(contact: any) {
    setForm({
      companyName: contact.companyName,
      contactPerson: contact.contactPerson || '',
      email: contact.email || '',
      phone: contact.phone || '',
      specialties: (contact.specialties || []).join(', '),
      kind: contact.kind,
      certifications: (contact.certifications || []).join(', '),
      regions: (contact.regions || []).join(', '),
      rating: contact.rating || 0,
      notes: contact.notes || '',
    });
    setEditId(contact.id);
  }

  function handleSubmit() {
    const data = {
      companyName: form.companyName,
      contactPerson: form.contactPerson || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      specialties: form.specialties.split(',').map((s) => s.trim()).filter(Boolean),
      kind: form.kind,
      certifications: form.certifications.split(',').map((s) => s.trim()).filter(Boolean),
      regions: form.regions.split(',').map((s) => s.trim()).filter(Boolean),
      rating: form.rating || undefined,
      notes: form.notes || undefined,
    };

    if (editId) {
      updateMutation.mutate({ id: editId, ...data });
    } else {
      createMutation.mutate(data);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Κατάλογος Υπεργολάβων</h2>
          <p className="text-sm text-muted-foreground">Διαχείριση επαφών υπεργολάβων και προμηθευτών</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true); }} type="button">
          <Plus className="h-4 w-4 mr-2" /> Νέα Επαφή
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Αναζήτηση..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !contacts?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Δεν υπάρχουν επαφές ακόμα.</p>
          <p className="text-xs mt-1">Πρόσθεσε υπεργολάβους για να τους βρίσκεις γρήγορα σε διαγωνισμούς.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((contact: any) => (
            <div key={contact.id} className="rounded-xl border border-border/60 bg-card p-4 hover:border-primary/20 transition-colors group">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{contact.companyName}</p>
                    {contact.contactPerson && (
                      <p className="text-xs text-muted-foreground">{contact.contactPerson}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => openEdit(contact)} className="p-1 rounded hover:bg-muted">
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => deleteMutation.mutate({ id: contact.id })} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Rating */}
              {contact.rating && (
                <div className="flex gap-0.5 mb-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={cn('h-3 w-3', s <= contact.rating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30')} />
                  ))}
                </div>
              )}

              {/* Specialties */}
              {contact.specialties?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {contact.specialties.map((s: string) => (
                    <span key={s} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{s}</span>
                  ))}
                </div>
              )}

              {/* Contact info */}
              <div className="space-y-1 text-xs text-muted-foreground">
                {contact.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3" /> {contact.email}
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" /> {contact.phone}
                  </div>
                )}
              </div>

              {/* Kind badge */}
              <div className="mt-2">
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded',
                  contact.kind === 'SUBCONTRACTOR' ? 'bg-blue-500/10 text-blue-600' : 'bg-green-500/10 text-green-600'
                )}>
                  {contact.kind === 'SUBCONTRACTOR' ? 'Υπεργολάβος' : 'Προμηθευτής'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd || editId !== null} onOpenChange={(open) => { if (!open) { setShowAdd(false); setEditId(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Επεξεργασία Επαφής' : 'Νέα Επαφή'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Επωνυμία *</Label>
              <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="π.χ. Ηλεκτρολογική Παπαδόπουλος" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Υπεύθυνος</Label>
                <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Τύπος</Label>
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as any })} className="mt-1 w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                  <option value="SUBCONTRACTOR">Υπεργολάβος</option>
                  <option value="SUPPLIER">Προμηθευτής</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" className="mt-1" />
              </div>
              <div>
                <Label>Τηλέφωνο</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Ειδικότητες (χωρισμένες με κόμμα)</Label>
              <Input value={form.specialties} onChange={(e) => setForm({ ...form, specialties: e.target.value })} placeholder="Ηλεκτρολόγος, Υδραυλικός" className="mt-1" />
            </div>
            <div>
              <Label>Πιστοποιήσεις (χωρισμένες με κόμμα)</Label>
              <Input value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} placeholder="ISO 9001, Άδεια ΥΔΕ" className="mt-1" />
            </div>
            <div>
              <Label>Περιοχές (χωρισμένες με κόμμα)</Label>
              <Input value={form.regions} onChange={(e) => setForm({ ...form, regions: e.target.value })} placeholder="Αττική, Θεσσαλονίκη" className="mt-1" />
            </div>
            <div>
              <Label>Αξιολόγηση (1-5)</Label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} type="button" onClick={() => setForm({ ...form, rating: s })} className="p-1">
                    <Star className={cn('h-5 w-5', s <= form.rating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30')} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Σημειώσεις</Label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full h-20 rounded-md border border-border bg-background px-3 py-2 text-sm resize-none" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">Ακύρωση</Button>
            </DialogClose>
            <Button onClick={handleSubmit} disabled={!form.companyName || createMutation.isPending || updateMutation.isPending} type="button">
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : editId ? 'Αποθήκευση' : 'Προσθήκη'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
