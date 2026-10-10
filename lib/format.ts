// Money is whole rupees; times are shown in Pakistan time whatever the server's
// or the phone's own time zone.

const rupees = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

export function formatRupees(amount: number): string {
  if (!Number.isInteger(amount)) {
    throw new Error(`Money is whole rupees, got ${amount}`);
  }
  return `Rs ${rupees.format(amount)}`;
}

const pakistanTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatPakistanTime(timestamp: string | Date): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Not a time: ${String(timestamp)}`);
  }
  return pakistanTime.format(date);
}

export function formatDays(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

// Zero is a real choice, not a missing value: the plan has no warranty at all.
export function formatWarranty(days: number): string {
  return days === 0 ? "No warranty" : `${formatDays(days)} warranty`;
}

const pakistanDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatPakistanDate(timestamp: string | Date): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Not a time: ${String(timestamp)}`);
  }
  return pakistanDate.format(date);
}

export function formatDaysAgo(days: number): string {
  return days === 0 ? "today" : `${formatDays(days)} ago`;
}

// A time of day as the database keeps it ("10:00:00") or a time input sends it
// ("10:00"), said the way people say it: "10am", "10:30am", "12pm" for noon.
export function formatClockTime(time: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/.exec(time);
  if (!match) throw new Error(`Not a time of day: ${time}`);
  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours < 12 ? "am" : "pm";
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === "00" ? `${hour}${suffix}` : `${hour}:${minutes}${suffix}`;
}
