// Orthodox Easter (Meeus algorithm) + Greek public holidays for any year

export function orthodoxEaster(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const julian = new Date(year, month - 1, day);
  julian.setDate(julian.getDate() + 13); // Julian → Gregorian
  return julian;
}

const FIXED_HOLIDAYS: { month: number; day: number }[] = [
  { month: 0, day: 1 },   // Πρωτοχρονιά
  { month: 0, day: 6 },   // Θεοφάνεια
  { month: 2, day: 25 },  // 25η Μαρτίου
  { month: 4, day: 1 },   // Πρωτομαγιά
  { month: 7, day: 15 },  // Κοίμηση Θεοτόκου
  { month: 9, day: 28 },  // Ημέρα του ΟΧΙ
  { month: 11, day: 25 }, // Χριστούγεννα
  { month: 11, day: 26 }, // Σύναξη Θεοτόκου
];

export function greekHolidays(year: number): Date[] {
  const easter = orthodoxEaster(year);

  const cleanMonday = new Date(easter);
  cleanMonday.setDate(easter.getDate() - 48);

  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);

  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  const whitMonday = new Date(easter);
  whitMonday.setDate(easter.getDate() + 50);

  const fixed = FIXED_HOLIDAYS.map(h => new Date(year, h.month, h.day));
  return [...fixed, cleanMonday, goodFriday, easterMonday, whitMonday];
}
