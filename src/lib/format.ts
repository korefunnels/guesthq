export const TZ = "Africa/Johannesburg";

export function fmtDate(d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-ZA", { timeZone: TZ, ...opts }).format(new Date(d));
}

export function fmtDateTime(d: string | Date | null | undefined) {
  return fmtDate(d, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function fmtZAR(n: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(n);
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
