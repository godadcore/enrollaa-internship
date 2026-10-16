/**
 * Date and Time utilities for Enrollaa Internship Management System
 * Authoritative Timezone: Africa/Lagos (West Africa Time, UTC+1)
 */

export function getNowWAT(): Date {
  return new Date();
}

/**
 * Formats a Date or ISO string into Africa/Lagos time format
 */
export function formatInWAT(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    ...options,
  }).format(d);
}

/**
 * Formats date part YYYY-MM-DD in Africa/Lagos timezone
 */
export function getDateStringWAT(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts; // Returns YYYY-MM-DD
}

function utcDateFromWatYmd(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatUtcYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Monday–Sunday programme week in Africa/Lagos, with a year-safe week number (YYYYWW). */
export function getProgrammeWeekWAT(date: Date | string = new Date()): {
  weekNumber: number;
  periodStart: string;
  periodEnd: string;
} {
  const start = utcDateFromWatYmd(getDateStringWAT(date));
  const weekday = start.getUTCDay() === 0 ? 7 : start.getUTCDay();
  const monday = new Date(start.getTime() - (weekday - 1) * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  const thursday = new Date(monday.getTime() + 3 * 86400000);
  const year = thursday.getUTCFullYear();
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Day = new Date(jan4).getUTCDay() || 7;
  const week1Monday = jan4 - (jan4Day - 1) * 86400000;
  const isoWeek = Math.floor((monday.getTime() - week1Monday) / (7 * 86400000)) + 1;
  return {
    weekNumber: year * 100 + isoWeek,
    periodStart: formatUtcYmd(monday),
    periodEnd: formatUtcYmd(sunday),
  };
}

/**
 * Gets hours, minutes, seconds numbers in Africa/Lagos timezone
 */
export function getTimePartsWAT(date: Date | string = new Date()): {
  hours: number;
  minutes: number;
  seconds: number;
  timeStringWAT: string;
} {
  const d = typeof date === "string" ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const timeStringWAT = formatter.format(d); // "HH:mm:ss"
  const [hours, minutes, seconds] = timeStringWAT.split(":").map(Number);
  return { hours, minutes, seconds, timeStringWAT };
}

/**
 * Evaluates attendance punctuality given a check-in timestamp in WAT
 * Standard: 09:00:00 AM target
 * Grace Period: 15 mins (up to 09:15:00) => on_time, score 100
 * Late Cutoff: up to 10:30:00 => late, scaled score (40 to 90)
 * Past 10:30:00 => late (severe penalty, score 20)
 */
export function evaluatePunctuality(checkInDate: Date = new Date()): {
  status: "on_time" | "late";
  punctualityScore: number;
  formattedTimeWAT: string;
  isAfterGracePeriod: boolean;
} {
  const { hours, minutes, seconds, timeStringWAT } = getTimePartsWAT(checkInDate);
  const totalMinutes = hours * 60 + minutes + seconds / 60;
  const targetMinutes = 9 * 60; // 540 (09:00 AM)
  const graceMinutes = targetMinutes + 15; // 555 (09:15 AM)
  const lateCutoffMinutes = 10 * 60 + 30; // 630 (10:30 AM)

  if (totalMinutes <= graceMinutes) {
    return {
      status: "on_time",
      punctualityScore: 100,
      formattedTimeWAT: formatInWAT(checkInDate, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }),
      isAfterGracePeriod: false,
    };
  }

  // Late check-in
  const minutesLate = totalMinutes - graceMinutes;
  let score = 90 - minutesLate * 0.7;
  if (totalMinutes > lateCutoffMinutes) {
    score = 25;
  }
  score = Math.max(20, Math.min(90, Math.round(score)));

  return {
    status: "late",
    punctualityScore: score,
    formattedTimeWAT: formatInWAT(checkInDate, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }),
    isAfterGracePeriod: true,
  };
}
