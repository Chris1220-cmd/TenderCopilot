import { greekHolidays } from './greek-holidays';

function getHolidaysForRange(startDate: Date, endDate: Date): Date[] {
  const holidays: Date[] = [];
  for (let y = startDate.getFullYear(); y <= endDate.getFullYear(); y++) {
    holidays.push(...greekHolidays(y));
  }
  return holidays;
}

export function isBusinessDay(date: Date, holidays?: Date[]): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  const h = holidays ?? greekHolidays(date.getFullYear());
  return !h.some(
    (hd) =>
      hd.getFullYear() === date.getFullYear() &&
      hd.getMonth() === date.getMonth() &&
      hd.getDate() === date.getDate()
  );
}

export function subtractBusinessDays(fromDate: Date, businessDays: number): Date {
  if (businessDays === 0) return new Date(fromDate);
  const holidays = getHolidaysForRange(
    new Date(fromDate.getFullYear() - 1, 0, 1),
    fromDate
  );
  const result = new Date(fromDate);
  let remaining = businessDays;
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    if (isBusinessDay(result, holidays)) remaining--;
  }
  return result;
}

export function addBusinessDays(fromDate: Date, businessDays: number): Date {
  if (businessDays === 0) return new Date(fromDate);
  const holidays = getHolidaysForRange(
    fromDate,
    new Date(fromDate.getFullYear() + 1, 11, 31)
  );
  const result = new Date(fromDate);
  let remaining = businessDays;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result, holidays)) remaining--;
  }
  return result;
}

export function businessDaysBetween(startDate: Date, endDate: Date): number {
  const holidays = getHolidaysForRange(startDate, endDate);
  let count = 0;
  const current = new Date(startDate);
  while (current < endDate) {
    current.setDate(current.getDate() + 1);
    if (isBusinessDay(current, holidays)) count++;
  }
  return count;
}
