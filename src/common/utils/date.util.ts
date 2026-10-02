const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const DEFAULT_SALON_TIMEZONE = 'America/Guayaquil';

function getPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  return Number(parts.find((part) => part.type === type)?.value);
}

function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const asUtc = Date.UTC(
    getPart(parts, 'year'),
    getPart(parts, 'month') - 1,
    getPart(parts, 'day'),
    getPart(parts, 'hour'),
    getPart(parts, 'minute'),
    getPart(parts, 'second'),
  );

  return asUtc - instant.getTime();
}

export function zonedCivilTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string,
): Date {
  const utcGuess = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond,
  );
  let utcMs = utcGuess;

  for (let index = 0; index < 3; index += 1) {
    const offsetMs = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
    utcMs = utcGuess - offsetMs;
  }

  return new Date(utcMs);
}

export function getCalendarDateInTimeZone(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);

  return {
    year: getPart(parts, 'year'),
    month: getPart(parts, 'month'),
    day: getPart(parts, 'day'),
  };
}

export function toCalendarDateString(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match?.[1];
}

export function parseCalendarDate(
  date: string,
): { year: number; month: number; day: number } | null {
  const normalized = toCalendarDateString(date);
  const match = normalized ? ISO_DATE_PATTERN.exec(normalized) : null;

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function getZonedDayRange(
  timeZone: string = DEFAULT_SALON_TIMEZONE,
  date?: string,
): { startOfDay: Date; endOfDay: Date } {
  const calendarDate = date
    ? parseCalendarDate(date)
    : getCalendarDateInTimeZone(new Date(), timeZone);

  if (!calendarDate) {
    throw new Error('date must be a valid YYYY-MM-DD calendar date.');
  }

  return calendarDateToDayRange(calendarDate, timeZone);
}

export type DateRangePreset =
  | 'TODAY'
  | 'YESTERDAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'CUSTOM';

export function getZonedPeriodRange(
  dateRange: DateRangePreset,
  timeZone: string = DEFAULT_SALON_TIMEZONE,
  startDate?: string,
  endDate?: string,
): { start: Date; end: Date } {
  const today = getCalendarDateInTimeZone(new Date(), timeZone);
  const customStart = toCalendarDateString(startDate);
  const customEnd = toCalendarDateString(endDate);
  const useCustomRange =
    dateRange === 'CUSTOM' || Boolean(customStart && customEnd);

  if (useCustomRange) {
    return resolveCustomRange(customStart, customEnd, timeZone);
  }

  if (dateRange === 'TODAY') {
    const range = calendarDateToDayRange(today, timeZone);
    return { start: range.startOfDay, end: range.endOfDay };
  }

  if (dateRange === 'YESTERDAY') {
    const range = calendarDateToDayRange(addCalendarDays(today, -1), timeZone);
    return { start: range.startOfDay, end: range.endOfDay };
  }

  if (dateRange === 'THIS_WEEK') {
    const monday = startOfWeekMonday(today, timeZone);
    const sunday = addCalendarDays(monday, 6);
    return {
      start: calendarDateToDayRange(monday, timeZone).startOfDay,
      end: calendarDateToDayRange(sunday, timeZone).endOfDay,
    };
  }

  if (dateRange === 'THIS_MONTH') {
    const startOfMonth = { year: today.year, month: today.month, day: 1 };
    const lastDay = new Date(Date.UTC(today.year, today.month, 0)).getUTCDate();
    const endOfMonth = { year: today.year, month: today.month, day: lastDay };
    return {
      start: calendarDateToDayRange(startOfMonth, timeZone).startOfDay,
      end: calendarDateToDayRange(endOfMonth, timeZone).endOfDay,
    };
  }

  return resolveCustomRange(customStart, customEnd, timeZone);
}

function resolveCustomRange(
  startDate: string | undefined,
  endDate: string | undefined,
  timeZone: string,
): { start: Date; end: Date } {
  const startCalendar = startDate ? parseCalendarDate(startDate) : null;
  const endCalendar = endDate ? parseCalendarDate(endDate) : null;

  if (!startCalendar || !endCalendar) {
    throw new Error(
      'startDate and endDate must be valid YYYY-MM-DD calendar dates for CUSTOM range.',
    );
  }

  const start = calendarDateToDayRange(startCalendar, timeZone).startOfDay;
  const end = calendarDateToDayRange(endCalendar, timeZone).endOfDay;

  if (start.getTime() > end.getTime()) {
    throw new Error('startDate cannot be after endDate.');
  }

  return { start, end };
}

function calendarDateToDayRange(
  calendarDate: { year: number; month: number; day: number },
  timeZone: string,
): { startOfDay: Date; endOfDay: Date } {
  const startOfDay = zonedCivilTimeToUtc(
    calendarDate.year,
    calendarDate.month,
    calendarDate.day,
    0,
    0,
    0,
    0,
    timeZone,
  );
  const nextCalendarDate = addCalendarDays(calendarDate, 1);
  const startOfNextDay = zonedCivilTimeToUtc(
    nextCalendarDate.year,
    nextCalendarDate.month,
    nextCalendarDate.day,
    0,
    0,
    0,
    0,
    timeZone,
  );

  return {
    startOfDay,
    endOfDay: new Date(startOfNextDay.getTime() - 1),
  };
}

function addCalendarDays(
  calendarDate: { year: number; month: number; day: number },
  days: number,
): { year: number; month: number; day: number } {
  const next = new Date(
    Date.UTC(calendarDate.year, calendarDate.month - 1, calendarDate.day + days),
  );

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function startOfWeekMonday(
  calendarDate: { year: number; month: number; day: number },
  timeZone: string,
): { year: number; month: number; day: number } {
  const noon = zonedCivilTimeToUtc(
    calendarDate.year,
    calendarDate.month,
    calendarDate.day,
    12,
    0,
    0,
    0,
    timeZone,
  );
  const weekday = getZonedWeekdayIndex(noon, timeZone);
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;

  return addCalendarDays(calendarDate, -daysFromMonday);
}

export function getZonedWeekdayIndex(instant: Date, timeZone: string): number {
  const weekdayLabel = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(instant);
  const weekdayIndex: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return weekdayIndex[weekdayLabel] ?? 1;
}

export function isToday(
  instant: Date,
  timeZone: string = DEFAULT_SALON_TIMEZONE,
  now: Date = new Date(),
): boolean {
  const target = getCalendarDateInTimeZone(instant, timeZone);
  const current = getCalendarDateInTimeZone(now, timeZone);

  return (
    target.year === current.year &&
    target.month === current.month &&
    target.day === current.day
  );
}

export function isSalonWeekend(instant: Date, timeZone: string): boolean {
  const weekday = getZonedWeekdayIndex(instant, timeZone);
  return weekday === 0 || weekday === 6;
}

export function getSalonPayrollWeekRange(
  timeZone: string = DEFAULT_SALON_TIMEZONE,
  periodStart?: string,
  periodEnd?: string,
): { start: Date; end: Date } {
  const startCalendar = periodStart
    ? parseCalendarDate(toCalendarDateString(periodStart) ?? '')
    : null;
  const endCalendar = periodEnd
    ? parseCalendarDate(toCalendarDateString(periodEnd) ?? '')
    : null;

  if (periodStart && !startCalendar) {
    throw new Error('periodStart must be a valid YYYY-MM-DD or ISO date.');
  }

  if (periodEnd && !endCalendar) {
    throw new Error('periodEnd must be a valid YYYY-MM-DD or ISO date.');
  }

  if (startCalendar && endCalendar) {
    const start = calendarDateToDayRange(startCalendar, timeZone).startOfDay;
    const end = calendarDateToDayRange(endCalendar, timeZone).endOfDay;

    if (start.getTime() > end.getTime()) {
      throw new Error('periodStart cannot be after periodEnd.');
    }

    return { start, end };
  }

  if (startCalendar) {
    const friday = addCalendarDays(startCalendar, 6);
    return {
      start: calendarDateToDayRange(startCalendar, timeZone).startOfDay,
      end: calendarDateToDayRange(friday, timeZone).endOfDay,
    };
  }

  if (endCalendar) {
    const saturday = addCalendarDays(endCalendar, -6);
    return {
      start: calendarDateToDayRange(saturday, timeZone).startOfDay,
      end: calendarDateToDayRange(endCalendar, timeZone).endOfDay,
    };
  }

  const today = getCalendarDateInTimeZone(new Date(), timeZone);
  const saturday = startOfWeekSaturday(today, timeZone);
  const friday = addCalendarDays(saturday, 6);

  return {
    start: calendarDateToDayRange(saturday, timeZone).startOfDay,
    end: calendarDateToDayRange(friday, timeZone).endOfDay,
  };
}

function startOfWeekSaturday(
  calendarDate: { year: number; month: number; day: number },
  timeZone: string,
): { year: number; month: number; day: number } {
  const noon = zonedCivilTimeToUtc(
    calendarDate.year,
    calendarDate.month,
    calendarDate.day,
    12,
    0,
    0,
    0,
    timeZone,
  );
  const weekday = getZonedWeekdayIndex(noon, timeZone);
  const daysFromSaturday = (weekday + 1) % 7;

  return addCalendarDays(calendarDate, -daysFromSaturday);
}
