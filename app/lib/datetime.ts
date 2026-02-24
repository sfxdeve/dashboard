import { format, isValid, parse } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const FALLBACK_TIMEZONE = "UTC";

export const CURATED_TIMEZONES = [
  "Europe/Rome",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
] as const;

function resolveTimeZone(timeZone: string) {
  return isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIMEZONE;
}

function parseIso(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function isValidTimeZone(value: string) {
  if (!value.trim()) {
    return false;
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function toDateFromInput(value: string) {
  if (!DATE_ONLY_REGEX.test(value)) {
    return undefined;
  }

  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return isValid(parsed) ? parsed : undefined;
}

export function fromDateToInput(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function toDateOnlyInput(isoOrDateString: string, timeZone: string) {
  const value = isoOrDateString.trim();
  if (!value) {
    return "";
  }

  if (DATE_ONLY_REGEX.test(value)) {
    return value;
  }

  const parsed = parseIso(value);
  if (!parsed) {
    return "";
  }

  return format(toZonedTime(parsed, resolveTimeZone(timeZone)), "yyyy-MM-dd");
}

export function toTimeInput(iso: string, timeZone: string) {
  const value = iso.trim();
  if (!value) {
    return "";
  }

  const parsed = parseIso(value);
  if (!parsed) {
    return "";
  }

  return format(toZonedTime(parsed, resolveTimeZone(timeZone)), "HH:mm");
}

export function fromDateOnlyInput(dateString: string, timeZone: string) {
  const value = dateString.trim();
  if (!DATE_ONLY_REGEX.test(value)) {
    return "";
  }

  return fromZonedTime(
    `${value}T00:00:00`,
    resolveTimeZone(timeZone),
  ).toISOString();
}

export function fromDateTimeInput(
  dateString: string,
  timeString: string,
  timeZone: string,
) {
  const dateValue = dateString.trim();
  const timeValue = timeString.trim();
  if (!DATE_ONLY_REGEX.test(dateValue) || !TIME_REGEX.test(timeValue)) {
    return "";
  }

  return fromZonedTime(
    `${dateValue}T${timeValue}:00`,
    resolveTimeZone(timeZone),
  ).toISOString();
}

export function getTodayInput(timeZone: string) {
  return toDateOnlyInput(new Date().toISOString(), timeZone);
}

export function formatDateForButton(dateInput: string) {
  const parsed = toDateFromInput(dateInput);
  return parsed ? format(parsed, "PPP") : "Pick a date";
}

export function formatDateTimeForButton(iso: string, timeZone: string) {
  const parsed = parseIso(iso);
  if (!parsed) {
    return "Pick date and time";
  }

  return formatInTimeZone(parsed, resolveTimeZone(timeZone), "PPP HH:mm");
}

export function createTimeOptions(minuteStep = 5) {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += minuteStep) {
      const hh = String(hour).padStart(2, "0");
      const mm = String(minute).padStart(2, "0");
      options.push(`${hh}:${mm}`);
    }
  }

  return options;
}
