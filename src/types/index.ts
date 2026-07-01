// ── User & Roles ──────────────────────────────────────────────────────────────

export type UserRole = "pi" | "researcher";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarColor: string;   // CSS hex — pastel
  avatarInitials: string;
  avatarUrl?: string;    // profile photo URL from Supabase Storage
  institution?: string;
  currentTask?: string;  // public "this week I'm working on..."
}

// ── Project ───────────────────────────────────────────────────────────────────

export interface SubProject {
  id: string;
  projectId: string;     // FK → projects.id (the lab)
  name: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
  archived: boolean;
}

export type ResearchType =
  | "trauma"
  | "oncology"
  | "conflict_zone"
  | "forensic"
  | "crisis_response"
  | "other";

export type ResearchParticipation =
  | "both_publications"
  | "wellbeing_only"
  | "private";

export interface Project {
  id: string;
  name: string;
  institution: string;
  researchType: ResearchType;
  researchParticipation: ResearchParticipation;
  createdAt: string;
  members: string[];      // User IDs
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
export type TaskPriority = "high" | "medium" | "low";

export interface TaskComment {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
  mentions?: string[];   // User IDs
}

export interface TaskFile {
  id: string;
  name: string;
  size: number;           // bytes
  uploaderId: string;
  uploadedAt: string;
  url: string;
  type: "pdf" | "docx" | "image" | "spreadsheet" | "other";
}

export interface TaskLink {
  id: string;
  title: string;
  url: string;
  type: "google_doc" | "google_sheet" | "other";
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeIds: string[];
  dueDate?: string;       // ISO date string
  createdAt: string;
  updatedAt: string;
  comments: TaskComment[];
  files: TaskFile[];
  links: TaskLink[];
}

// ── Journal ───────────────────────────────────────────────────────────────────

export type PromptCategory =
  | "emotional_processing"
  | "research_reflection"
  | "team_support"
  | "boundaries_workload"
  | "looking_forward";

export interface JournalPrompt {
  id: string;
  text: string;
  category: PromptCategory;
  isCustom?: boolean;
  suggestedBy?: string;  // User ID (PI) if suggested
}

export interface PromptResponse {
  promptId: string;
  promptText: string;
  response: string;
}

export interface CheckinResponse {
  questionId: string;
  score: 1 | 2 | 3 | 4 | 5;
}

export interface JournalEntry {
  id: string;
  userId: string;
  date: string;           // ISO date string
  prompts: PromptResponse[];
  checkin: CheckinResponse[];
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CheckinQuestion {
  id: string;
  text: string;
}

// ── Literature ────────────────────────────────────────────────────────────────

export type LiteratureType = "article" | "book" | "preprint" | "report" | "thesis";
export type ReadStatus = "read" | "reading" | "unread";
export type LibraryScope = "my" | "lab";

export interface LiteratureFile {
  id: string;
  name: string;
  size: number;
  uploaderId: string;
  uploadedAt: string;
  ocrStatus?: "pending" | "ready" | null;
}

export interface LiteratureItem {
  id: string;
  projectId: string;
  scope: LibraryScope;
  type: LiteratureType;
  title: string;
  authors: string[];
  year: number;
  journal?: string;
  publisher?: string;
  volume?: string;
  pages?: string;
  doi?: string;
  abstract?: string;
  tags: string[];
  status: ReadStatus;
  rating: number;          // 1–5
  notes?: string;
  files: LiteratureFile[];
  addedById: string;
  addedAt: string;
  collections: string[];   // Collection IDs
  relatedIds: string[];    // Related item IDs
}

export interface LiteratureCollection {
  id: string;
  name: string;
  iconName: string;
  itemCount: number;
}

// ── Team ──────────────────────────────────────────────────────────────────────

export interface TeamMember extends User {
  taskCounts: Record<TaskStatus, number>;
  weeklyUpdate?: string;
  weeklyUpdatedAt?: string;
}

// ── Activity Feed ─────────────────────────────────────────────────────────────

export interface ActivityEvent {
  id: string;
  actorId: string;
  action: string;          // e.g. "moved", "created", "uploaded"
  objectType: "task" | "file" | "comment";
  objectLabel: string;     // e.g. "Write Proposal"
  destination?: string;    // e.g. "In Progress"
  createdAt: string;
}

// ── Events / Calendar ─────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;            // ISO date string
  time?: string;
  projectId: string;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationType =
  | "task_assigned"
  | "task_moved"
  | "task_comment"
  | "task_mention"
  | "unassigned_tasks"
  | "checkin_requested"
  | "aggregate_ready"
  | "journal_reminder"
  | "meeting_proposed"
  | "meeting_response"
  | "reminder";

export interface Notification {
  id: string;
  type: NotificationType;
  recipientId: string;
  message: string;
  read: boolean;
  createdAt: string;
  linkTo?: string;
}

// ── Opportunities & Lab Wins ───────────────────────────────────────────────────

export interface DashboardPost {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
  type: "opportunity" | "lab_win";
}

// ── Scheduling ────────────────────────────────────────────────────────────────

// "day-slot" key where day=0..4 (Mon-Fri), slot=0..15 (9:00-16:30 in 30-min steps)
export interface WeeklyAvailability {
  userId: string;
  projectId: string;
  slots: string[];
  updatedAt: string;
}

export type MeetingResponseStatus = "pending" | "accepted" | "declined";

export interface MeetingResponse {
  userId: string;
  status: MeetingResponseStatus;
  respondedAt?: string;
}

export interface MeetingProposal {
  id: string;
  projectId: string;
  proposerId: string;
  title: string;
  description?: string;
  proposedDate: string;    // ISO date "YYYY-MM-DD"
  proposedTime: string;    // "HH:MM"
  durationMinutes: number;
  inviteeIds: string[];
  responses: MeetingResponse[];
  createdAt: string;
}

export type ScheduleEventScope = "lab" | "personal";

export interface ScheduleEvent {
  id: string;
  projectId: string;
  title: string;
  date: string;            // ISO date "YYYY-MM-DD"
  time?: string;           // "HH:MM"
  endTime?: string;        // "HH:MM"
  scope: ScheduleEventScope;
  createdBy: string;
  description?: string;
}

export interface Reminder {
  id: string;
  userId: string;
  title: string;
  dueAt: string;           // ISO datetime
  linkedTaskId?: string;
  linkedEventId?: string;
  emailEnabled: boolean;
  sent: boolean;
  createdAt: string;
}
