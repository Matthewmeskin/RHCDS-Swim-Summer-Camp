export type Role = "instructor" | "guard" | "admin";
export type Level = "Non-Swimmer" | "Beginner" | "Intermediate" | "Advanced";
export type FileType = "students" | "schedule";

export interface Instructor {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  slug: string | null;
  active?: boolean;
  /** Plaintext access code for name+code login (admin-visible). */
  access_code?: string | null;
  /** Synthetic login identity used by Supabase auth. */
  login_email?: string | null;
}

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  age: number | null;
  level: Level | null;
  goals: string | null;
  special_needs: boolean;
  parent_notes: string | null;
  staff_notes: string | null;
  preferred_instructor_id: string | null;
  group_level: number | null; // 1–6 swim group (see lib/groups.ts)
  active?: boolean;
}

export interface SwimLevel {
  level: number;
  name: string;
  emoji: string;
  color: string;
  overview: string | null;
  assessment: string | null;
  games: string | null;
}

export interface InstructorNote {
  id: string;
  student_id: string;
  instructor_id: string;
  note: string | null;
  updated_at: string;
}

export type RequestStatus = "pending" | "approved" | "denied";

export interface AvailabilityRequest {
  id: string;
  instructor_id: string;
  week_number: number;
  off_slots: { date: string; start: string }[];
  contact_email: string | null;
  contact_phone: string | null;
  note: string | null;
  status: RequestStatus;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface Week {
  id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  label: string | null;
  /** When false, instructors can't see this week's lesson schedule (availability still works). */
  schedule_published?: boolean;
}

export interface ScheduleSlot {
  id: string;
  instructor_id: string | null;
  student_id: string | null;
  student_name_raw: string | null;
  lesson_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
  week_number: number | null;
}

export interface InstructorAvailability {
  id: string;
  instructor_id: string | null;
  lesson_date: string;
  start_time: string;
  is_available: boolean;
  week_number: number | null;
}

export interface ImportLog {
  id: string;
  imported_at: string;
  file_type: FileType;
  week_number: number | null;
  rows_inserted: number;
  rows_updated: number;
  warnings: unknown;
}
