export type Role = "customer" | "driver" | "admin";
export type TripType = "hourly" | "one_way" | "round_trip" | "outstation";
export type BookingStatus = "requested" | "accepted" | "started" | "completed" | "cancelled";

export interface Profile { id: string; role: Role; full_name: string; phone: string | null }

export interface Car { id: string; reg_no: string; model: string; transmission: "manual" | "automatic" }

export interface NearbyDriver {
  driver_id: string; full_name: string; distance_m: number; rating: number | null;
  experience_years: number; can_drive: string[]; lat: number; lng: number; fare_paise: number;
}

export interface Booking {
  id: string; customer_id: string; car_id: string; driver_id: string | null; trip_type: TripType;
  hours: number; pickup_address: string; drop_address: string | null; quoted_paise: number;
  status: BookingStatus; created_at: string; accepted_at: string | null; started_at: string | null;
  completed_at: string | null; rating: number | null;
  scheduled_for?: string | null; promo_code?: string | null; discount_paise?: number; use_wallet?: boolean;
  wallet_paise?: number; cash_collected_paise?: number | null; share_token?: string; payment_method?: string;
  platform_fee_paise?: number | null; driver_earning_paise?: number | null;
}

export interface MonthlyPlan {
  id: string; status: "requested" | "assigned" | "active" | "cancelled" | "ended"; start_date: string; shift_start: string;
  daily_hours: number; days_per_week: number; pickup_address: string; notes: string | null; monthly_paise: number;
  created_at: string; car: string; customer_name: string; customer_phone: string | null;
  driver_id: string | null; driver_name: string | null; driver_phone: string | null;
}

export const MONTHLY_LABEL: Record<MonthlyPlan["status"], string> = {
  requested: "Finding a driver", assigned: "Driver offered", active: "Active", cancelled: "Cancelled", ended: "Ended",
};

/** Same formula as the server: ₹70 per driving hour, 4.33 weeks, rounded up to ₹100. */
export const monthlyQuote = (hours: number, days: number) => Math.ceil((hours * days * 4.33 * 70) / 100) * 100 * 100;

/** A booking is "now" if it has no schedule or starts within the hour. */
export const isNow = (b: Booking) => !b.scheduled_for || new Date(b.scheduled_for).getTime() - Date.now() < 3600_000;

export const TRIP_LABEL: Record<TripType, string> = {
  hourly: "Hourly (in city)", one_way: "One-way drop", round_trip: "Round trip", outstation: "Outstation",
};

export const STATUS_LABEL: Record<BookingStatus, string> = {
  requested: "Finding a driver", accepted: "Driver on the way", started: "Trip running",
  completed: "Completed", cancelled: "Cancelled",
};
