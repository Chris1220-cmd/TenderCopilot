import { greekHolidays } from './greek-holidays';

type HolidaysFn = (year: number) => Date[];

function getHolidaysForRange(startDate: Date, endDate: Date, holidaysFn: HolidaysFn): Date[] {
  const holidays: Date[] = [];
  for (let y = startDate.getFullYear(); y <= endDate.getFullYear(); y++) {
    holidays.push(...holidaysFn(y));
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

export function subtractBusinessDays(
  fromDate: Date,
  businessDays: number,
  holidaysFn: HolidaysFn = greekHolidays,
): Date {
  if (businessDays === 0) return new Date(fromDate);
  const holidays = getHolidaysForRange(
    new Date(fromDate.getFullYear() - 1, 0, 1),
    fromDate,
    holidaysFn,
  );
  const result = new Date(fromDate);
  let remaining = businessDays;
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    if (isBusinessDay(result, holidays)) remaining--;
  }
  return result;
}

export function addBusinessDays(
  fromDate: Date,
  businessDays: number,
  holidaysFn: HolidaysFn = greekHolidays,
): Date {
  if (businessDays === 0) return new Date(fromDate);
  const holidays = getHolidaysForRange(
    fromDate,
    new Date(fromDate.getFullYear() + 1, 11, 31),
    holidaysFn,
  );
  const result = new Date(fromDate);
  let remaining = businessDays;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result, holidays)) remaining--;
  }
  return result;
}

export function businessDaysBetween(
  startDate: Date,
  endDate: Date,
  holidaysFn: HolidaysFn = greekHolidays,
): number {
  const holidays = getHolidaysForRange(startDate, endDate, holidaysFn);
  let count = 0;
  const current = new Date(startDate);
  while (current < endDate) {
    current.setDate(current.getDate() + 1);
    if (isBusinessDay(current, holidays)) count++;
  }
  return count;
}
