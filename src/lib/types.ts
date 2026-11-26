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
}

export const TRIP_LABEL: Record<TripType, string> = {
  hourly: "Hourly (in city)", one_way: "One-way drop", round_trip: "Round trip", outstation: "Outstation",
};

export const STATUS_LABEL: Record<BookingStatus, string> = {
  requested: "Finding a driver", accepted: "Driver on the way", started: "Trip running",
  completed: "Completed", cancelled: "Cancelled",
};
