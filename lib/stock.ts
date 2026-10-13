// Relative, with their extensions, so the tests can load this file directly.
import { formatDays } from "./format.ts";

// What the seller pastes to stock a plan: one login per line, as
//
//   login | password | numastore order number | cost | YYYY-MM-DD
//
// the date being the day it stops working, in Pakistan. A password may itself
// contain "|", so the login is the first field, the last three are the order,
// cost and date, and everything between is the password, exactly as typed.
//
// Every problem is reported by line number and what's wrong, never by what
// the line says: a refusal is shown on screen and may be logged, and a
// password must reach neither.

export const STOCK_FORMAT = "login | password | numastore order number | cost | YYYY-MM-DD";
export const MAX_STOCK_LINES = 50;

export type StockLine = {
  line: number;
  login: string;
  password: string;
  supplierOrderNumber: string;
  cost: number;
  expiresOn: string;
};

export type LineProblem = { line: number; problem: string };

export type ParsedStock = { items: StockLine[]; problems: LineProblem[] };

const MAX_LOGIN = 254;
const MAX_PASSWORD = 256;
const MAX_NUMBER = 64;
const MAX_COST = 1_000_000;

function fieldProblem(
  login: string,
  password: string,
  supplierOrderNumber: string,
  cost: string,
  date: string,
  today: string,
): string | null {
  if (login === "") return "login is missing";
  if (login.length > MAX_LOGIN) return `login is over ${MAX_LOGIN} characters`;
  if (password === "") return "password is missing";
  if (password.length > MAX_PASSWORD) return `password is over ${MAX_PASSWORD} characters`;
  if (supplierOrderNumber === "") return "numastore order number is missing";
  if (supplierOrderNumber.length > MAX_NUMBER) return `numastore order number is over ${MAX_NUMBER} characters`;
  if (!/^\d+$/.test(cost)) return "cost must be a whole number of rupees";
  if (Number(cost) < 1 || Number(cost) > MAX_COST) return `cost must be between 1 and ${MAX_COST}`;
  if (!isCalendarDate(date)) return "date must be a real day written YYYY-MM-DD";
  if (date <= today) return "date has already passed";
  return null;
}

// `today` is the Pakistan date as YYYY-MM-DD; an item has to still work after it.
export function parseStockLines(text: string, today: string): ParsedStock {
  const items: StockLine[] = [];
  const problems: LineProblem[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  const filled = lines.filter((value) => value.trim() !== "").length;
  if (filled === 0) return { items, problems: [{ line: 0, problem: "Paste at least one line" }] };
  if (filled > MAX_STOCK_LINES) {
    return { items, problems: [{ line: 0, problem: `At most ${MAX_STOCK_LINES} lines at a time` }] };
  }

  lines.forEach((raw, index) => {
    const line = index + 1;
    if (raw.trim() === "") return;
    const fields = raw.split("|");
    if (fields.length < 5) {
      problems.push({ line, problem: "needs five parts separated by |" });
      return;
    }
    const login = fields[0].trim();
    const password = fields.slice(1, -3).join("|").trim();
    const [numberField, costField, dateField] = fields.slice(-3).map((field) => field.trim());
    const supplierOrderNumber = numberField.replace(/\s/g, "").toUpperCase();

    const problem = fieldProblem(login, password, supplierOrderNumber, costField, dateField, today);
    if (problem) {
      problems.push({ line, problem });
      return;
    }
    items.push({ line, login, password, supplierOrderNumber, cost: Number(costField), expiresOn: dateField });
  });

  return { items, problems };
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const pakistanDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Karachi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// The Pakistan date as YYYY-MM-DD, which compares correctly as text.
export function pakistanDateKey(now: Date): string {
  return pakistanDay.format(now);
}

// What the database said about a line it didn't add.
export const stockRefusalLabel: Record<string, string> = {
  duplicate: "already in stock",
  number_used: "numastore order number already recorded",
};

export function describeLineProblems(problems: LineProblem[]): string {
  return problems.map(({ line, problem }) => (line === 0 ? problem : `line ${line}: ${problem}`)).join("; ");
}

// ───────────────────────────── Time left ─────────────────────────────

const DAY_MS = 86_400_000;

// Whole days an item still has, rounded down: these are promises to a
// customer, so a part day isn't counted.
export function wholeDaysLeft(expiresAt: Date, now: Date): number {
  return Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / DAY_MS));
}

// What a stocked plan promises before buying, from the free item that runs
// out first: the customer gets that one or a later one. Months are counted
// down, so "at least" is always true.
export function stockTimeLeft(expiresAt: Date, now: Date): string {
  const days = wholeDaysLeft(expiresAt, now);
  const months = Math.floor((days * 12) / 365);
  // Under two months, days say more than "1 month".
  if (months < 2) return `at least ${formatDays(days)} left`;
  return `at least ${months} months left`;
}
