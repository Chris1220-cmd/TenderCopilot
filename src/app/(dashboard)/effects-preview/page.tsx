'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { BlurFade } from '@/components/ui/blur-fade';
import { BorderBeam } from '@/components/ui/border-beam';
// CardSpotlight uses CanvasRevealEffect (WebGL) — may fail in SSR
// import { CardSpotlight } from '@/components/ui/card-spotlight';
import { Particles } from '@/components/ui/particles';
import { Ripple } from '@/components/ui/ripple';
import { PremiumStatCardV2 } from '@/components/ui/premium-stat-card-v2';
import { NumberTicker } from '@/components/ui/number-ticker';
import { FileText, TrendingUp, Shield, Calendar, ChevronRight } from 'lucide-react';

export default function EffectsPreviewPage() {
  const [activeEffect, setActiveEffect] = useState<string | null>(null);

  return (
    <div className="space-y-12 pb-20">
      <div>
        <h1 className="text-display text-foreground">Effects Preview</h1>
        <p className="mt-1 text-body text-muted-foreground">
          Δες κάθε effect ζωντανά — διάλεξε ποια θέλεις
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* A) CardSpotlight — Mouse-tracked spotlight on cards    */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-title text-foreground mb-4">A) CardSpotlight — Mouse Spotlight</h2>
        <p className="text-sm text-muted-foreground mb-4">Κούνα το mouse πάνω στις κάρτες</p>
        <div className="grid gap-4 md:grid-cols-3">
          {['ΜΕΛΕΤΗ ΠΡΟΣΤΑΣΙΑΣ ΛΑΔΩΝΑ', 'Προμήθεια εξοπλισμού IT', 'Κατασκευή γέφυρας Αχελώου'].map((title, i) => (
            <motion.div
              key={i}
              className="group relative rounded-xl border border-border/60 bg-card p-6 cursor-pointer overflow-hidden"
              whileHover={{ scale: 1.01 }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
                e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
              }}
            >
              {/* CSS spotlight */}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: 'radial-gradient(300px circle at var(--mx, 50%) var(--my, 50%), rgba(72,164,214,0.08), transparent 60%)',
                }}
              />
              <div className="relative z-10">
                <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-[12px] text-muted-foreground font-mono">REF-2026-{1000 + i}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-bold text-primary">{65 + i * 12}%</span>
                  <span className="text-[11px] text-muted-foreground">{15 + i * 5} ημέρες</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* B) Particles — Cursor-follow background particles      */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-title text-foreground mb-4">B) Particles — Cursor Follow Background</h2>
        <p className="text-sm text-muted-foreground mb-4">Κούνα το mouse — τα particles ακολουθούν</p>
        <div className="relative rounded-xl border border-border/60 bg-card overflow-hidden" style={{ height: 250 }}>
          <Particles
            className="absolute inset-0"
            quantity={40}
            color="#48A4D6"
            size={0.6}
            staticity={30}
          />
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-foreground">Dashboard Header</h3>
              <p className="text-muted-foreground mt-1">Particles πίσω από content</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* C) BorderBeam — Animated border travel on cards        */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-title text-foreground mb-4">C) BorderBeam — Animated Border</h2>
        <p className="text-sm text-muted-foreground mb-4">Φως που τρέχει γύρω από το border</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative rounded-xl border border-border/60 bg-card p-6 overflow-hidden">
            <BorderBeam size={80} duration={8} colorFrom="#48A4D6" colorTo="#48A4D6" borderWidth={2} />
            <h3 className="text-title text-foreground">Πρόσφατοι Διαγωνισμοί</h3>
            <p className="mt-2 text-sm text-muted-foreground">Section card με BorderBeam effect</p>
          </div>
          <div className="relative rounded-xl border border-border/60 bg-card p-6 overflow-hidden">
            <BorderBeam size={60} duration={10} colorFrom="#48A4D6" colorTo="transparent" borderWidth={1} delay={3} />
            <h3 className="text-title text-foreground">Επερχόμενες Προθεσμίες</h3>
            <p className="mt-2 text-sm text-muted-foreground">Πιο subtle version</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* D) Ripple — Expanding circles background               */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-title text-foreground mb-4">D) Ripple — Expanding Circles</h2>
        <p className="text-sm text-muted-foreground mb-4">Κύκλοι που επεκτείνονται — ωραίο για empty states</p>
        <div className="relative rounded-xl border border-border/60 bg-card overflow-hidden" style={{ height: 250 }}>
          <Ripple mainCircleSize={120} mainCircleOpacity={0.08} numCircles={6} />
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center">
              <FileText className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-foreground font-medium">Δεν υπάρχουν διαγωνισμοί</p>
              <p className="text-sm text-muted-foreground">Ripple effect πίσω από empty state</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* E) BlurFade InView — Scroll-triggered reveals          */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-title text-foreground mb-4">E) BlurFade InView — Scroll Reveal</h2>
        <p className="text-sm text-muted-foreground mb-4">Cards που εμφανίζονται καθώς scrollάρεις</p>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { title: 'Ενεργοί', value: 12, icon: FileText },
            { title: 'Win Rate', value: 67, icon: TrendingUp, suffix: '%' },
            { title: 'Compliance', value: 84, icon: Shield, suffix: '%' },
            { title: 'Deadlines', value: 5, icon: Calendar },
          ].map((card, i) => (
            <BlurFade key={i} delay={i * 0.15} inView>
              <PremiumStatCardV2
                title={card.title}
                value={card.value}
                suffix={card.suffix}
                subtitle="Demo data"
                icon={card.icon}
                index={i}
              />
            </BlurFade>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* F) Combo — Cards with hover BorderBeam + lift          */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-title text-foreground mb-4">F) Combo — Hover lift + BorderBeam</h2>
        <p className="text-sm text-muted-foreground mb-4">Hover πάνω στις κάρτες</p>
        <div className="grid gap-5 md:grid-cols-3">
          {['ΜΕΛΕΤΗ ΠΡΟΣΤΑΣΙΑΣ', 'Προμήθεια Εξοπλισμού', 'Κατασκευή Δικτύου'].map((title, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="group relative rounded-2xl border border-border/60 bg-card p-6 cursor-pointer transition-shadow hover:shadow-lg"
            >
              {/* BorderBeam only on hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <BorderBeam size={60} duration={6} colorFrom="#48A4D6" colorTo="transparent" borderWidth={1} />
              </div>
              <h3 className="text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors">
                {title}
              </h3>
              <p className="mt-1 text-[12px] font-mono text-muted-foreground">REF-2026-{2000 + i}</p>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-sm font-semibold">{72 + i * 8}%</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* G) NumberTicker standalone                              */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section>
        <h2 className="text-title text-foreground mb-4">G) NumberTicker — Animated Counters</h2>
        <p className="text-sm text-muted-foreground mb-4">Αριθμοί που "τρέχουν" μέχρι την τελική τιμή</p>
        <div className="flex gap-8 items-end">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Pipeline</p>
            <span className="text-4xl font-bold text-foreground">
              <NumberTicker value={24} />
            </span>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Win Rate</p>
            <span className="text-4xl font-bold text-emerald-500">
              <NumberTicker value={67} />%
            </span>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Compliance</p>
            <span className="text-4xl font-bold text-primary">
              <NumberTicker value={84} decimalPlaces={1} />%
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
