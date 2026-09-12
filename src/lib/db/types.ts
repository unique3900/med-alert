export type MemberRole = 'admin' | 'member';
export type ScheduleKind = 'fixed' | 'interval';
export type DoseStatus = 'pending' | 'notified' | 'taken' | 'skipped' | 'missed';

export type Household = {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
};

export type Profile = {
  id: string;
  household_id: string;
  full_name: string;
  role: MemberRole;
  accent: string;
  receives_all_alerts: boolean;
  created_at: string;
  updated_at: string;
};

export type Device = {
  id: string;
  profile_id: string;
  token: string;
  label: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
};

export type Medication = {
  id: string;
  household_id: string;
  profile_id: string;
  name: string;
  strength: string | null;
  form: string | null;
  instructions: string | null;
  accent: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Schedule = {
  id: string;
  medication_id: string;
  kind: ScheduleKind;
  times: string[];
  interval_minutes: number | null;
  window_start: string;
  window_end: string;
  days_of_week: number[];
  starts_on: string;
  ends_on: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Dose = {
  id: string;
  household_id: string;
  profile_id: string;
  medication_id: string;
  schedule_id: string;
  origin_at: string;
  due_at: string;
  status: DoseStatus;
  resolved_at: string | null;
  resolved_by: string | null;
  alert_count: number;
  last_alert_at: string | null;
  created_at: string;
};

type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      households: Row<Household>;
      profiles: Row<Profile>;
      devices: Row<Device>;
      medications: Row<Medication>;
      schedules: Row<Schedule>;
      doses: Row<Dose>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      member_role: MemberRole;
      schedule_kind: ScheduleKind;
      dose_status: DoseStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type MedicationWithSchedules = Medication & { schedules: Schedule[] };
export type DoseWithMedication = Dose & {
  medications: Pick<Medication, 'id' | 'name' | 'strength' | 'form' | 'instructions' | 'accent'>;
  profiles: Pick<Profile, 'id' | 'full_name' | 'accent'>;
};
