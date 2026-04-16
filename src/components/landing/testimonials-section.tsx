'use client';

import { motion } from 'motion/react';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    quote: 'Βρίσκαμε τους διαγωνισμούς με Ctrl+F στο ΚΗΜΔΗΣ. Τώρα το TenderCopilot μας ειδοποιεί πριν καν βγουν — και ξέρουμε αν αξίζει να συμμετάσχουμε.',
    name: 'Μηχανολόγος Μηχανικός',
    role: 'Τεχνική εταιρεία, Θεσσαλονίκη',
    stars: 5,
  },
  {
    quote: 'Η ανάλυση τιμών μας έδωσε σαφή εικόνα — ξέραμε ακριβώς σε ποιο εύρος κινούνται οι κατακυρώσεις. Κερδίσαμε τον πρώτο μας μεγάλο διαγωνισμό.',
    name: 'Διευθύνων Σύμβουλος',
    role: 'IT εταιρεία, Αθήνα',
    stars: 5,
  },
  {
    quote: 'Ως μικρή εταιρεία δεν είχαμε bid manager. Ο οδηγός βήμα-βήμα μας πήρε από το μηδέν στην υποβολή σε 2 μέρες αντί για 2 εβδομάδες.',
    name: 'Ιδιοκτήτης',
    role: 'Κατασκευαστική ΙΚΕ, Ηράκλειο',
    stars: 5,
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2
            className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-[#1a1a2e]"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Τι λένε οι χρήστες μας
          </h2>
          <p className="mt-3 text-gray-500 max-w-md mx-auto">
            Εταιρείες σε όλη την Ελλάδα χρησιμοποιούν το TenderCopilot
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              className="relative rounded-2xl bg-white p-8 shadow-lg shadow-gray-100/80 border border-gray-100 hover:shadow-xl hover:border-gray-200 transition-all duration-300"
            >
              <Quote className="absolute top-6 right-6 h-8 w-8 text-[#48A4D6]/10" />

              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, s) => (
                  <Star key={s} className="h-4 w-4 text-amber-400 fill-amber-400" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-[15px] leading-relaxed text-gray-700 mb-6">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#48A4D6] to-[#3B96C4] text-white text-sm font-semibold">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1a1a2e]">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
