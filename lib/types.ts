export type Role = "instructor" | "guard" | "admin";
export type Level = "Non-Swimmer" | "Beginner" | "Intermediate" | "Advanced";
export type FileType = "students" | "schedule";

export interface Instructor {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  slug: string | null;
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
}

export interface Week {
  id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  label: string | null;
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
