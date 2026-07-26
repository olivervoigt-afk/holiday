export type UserRole = "admin" | "user";
export type CountryCode = "AT" | "MT";
export type LeaveKind = "vacation" | "special";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  user: "Mitarbeiter",
};

export const COUNTRY_LABELS: Record<CountryCode, string> = {
  AT: "Österreich",
  MT: "Malta",
};

export const COUNTRIES: CountryCode[] = ["AT", "MT"];

export const KIND_LABELS: Record<LeaveKind, string> = {
  vacation: "Urlaub",
  special: "Sonderurlaub / unbezahlt",
};

export const KIND_LABELS_SHORT: Record<LeaveKind, string> = {
  vacation: "Urlaub",
  special: "Sonderurlaub",
};

export const STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: "Offen",
  approved: "Genehmigt",
  rejected: "Abgelehnt",
  cancelled: "Zurückgezogen",
};

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  country: CountryCode;
  active: boolean;
  created_at: string;
};

export type Holiday = {
  id: string;
  country: CountryCode;
  /** ISO-Datum, etwa "2026-12-25". */
  day: string;
  name: string;
};

export type Entitlement = {
  id: string;
  profile_id: string;
  year: number;
  annual_days: number;
  /** Höchstzahl der Tage, die aus diesem Jahr ins Folgejahr wandern dürfen. */
  carryover_max: number;
  /** Stichtag im Folgejahr; null bedeutet: der Übertrag verfällt nicht. */
  carryover_expires_on: string | null;
  /**
   * Startsaldo für dieses Jahr — überschreibt den errechneten Vortrag.
   * Für den Umstieg aus einem früheren System gedacht, darf negativ sein.
   */
  opening_carryover: number | null;
  opening_carryover_expires_on: string | null;
  note: string;
  created_at: string;
};

export type LeaveRequest = {
  id: string;
  profile_id: string;
  kind: LeaveKind;
  start_date: string;
  end_date: string;
  start_half_day: boolean;
  end_half_day: boolean;
  reason: string;
  status: LeaveStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string;
  created_at: string;
  updated_at: string;
};

/**
 * Abwesenheit eines Kollegen — bewusst ohne Begründung. Kommt aus der
 * Datenbankfunktion `team_absences` und ist auf das eigene Land beschränkt
 * (der Administrator sieht alle).
 */
export type TeamAbsence = {
  profile_id: string;
  full_name: string;
  country: CountryCode;
  start_date: string;
  end_date: string;
  start_half_day: boolean;
  end_half_day: boolean;
  kind: LeaveKind;
  status: LeaveStatus;
};

export type Notification = {
  id: string;
  profile_id: string;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};
