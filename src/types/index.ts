export type UserType =
  | "superAdmin"
  | "orgAdmin"
  | "projectManager"
  | "member";

export type Scope = "org" | "projects";

export type AttendanceStatus =
  | "present"
  | "absent"
  | "half_day"
  | "leave"
  | "holiday";

export type LeaveStatus = "pending" | "approved" | "rejected";

export type PayrollStatus = "draft" | "final";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  type: UserType;
  primary: boolean;
  orgId?: string | null;
  orgIds?: string[];
  projIds?: string[];
}
