import type {
  User, Project, Task, JournalEntry, JournalPrompt, CheckinQuestion,
  LiteratureItem, LiteratureCollection, TeamMember, ActivityEvent,
  CalendarEvent, DashboardPost, Notification,
} from "@/types";

// ── Users ─────────────────────────────────────────────────────────────────────

export const CURRENT_USER_ID = "u1"; // The logged-in researcher (Tais)

export const USERS: User[] = [
  {
    id: "u0",
    name: "Dr. Yara Osei",
    email: "yara.osei@univ.edu",
    role: "pi",
    avatarColor: "#C5B4E3",
    avatarInitials: "YO",
    institution: "University of Michigan",
  },
  {
    id: "u1",
    name: "Tais Martinez",
    email: "tais.martinez@univ.edu",
    role: "researcher",
    avatarColor: "#B4D4E3",
    avatarInitials: "TM",
  },
  {
    id: "u2",
    name: "Achi Mensah",
    email: "achi.mensah@univ.edu",
    role: "researcher",
    avatarColor: "#B4E3C8",
    avatarInitials: "AM",
  },
  {
    id: "u3",
    name: "Jordan Lee",
    email: "jordan.lee@univ.edu",
    role: "researcher",
    avatarColor: "#E3D4B4",
    avatarInitials: "JL",
  },
  {
    id: "u4",
    name: "Priya Nair",
    email: "priya.nair@univ.edu",
    role: "researcher",
    avatarColor: "#E3B4B4",
    avatarInitials: "PN",
  },
];

export function getUser(id: string) {
  return USERS.find((u) => u.id === id);
}

// ── Project ───────────────────────────────────────────────────────────────────

export const PROJECT: Project = {
  id: "p1",
  name: "Moral Injury & Resilience Study",
  institution: "University of Michigan",
  researchType: "trauma",
  researchParticipation: "wellbeing_only",
  createdAt: "2025-09-01T00:00:00Z",
  members: ["u0", "u1", "u2", "u3", "u4"],
};

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const TASKS: Task[] = [
  {
    id: "t1",
    projectId: "p1",
    title: "Finalize consent form language",
    description:
      "Review the draft consent form against IRB protocol 2025-0341. Pay particular attention to the section on audio recording and data retention.",
    status: "in_review",
    priority: "high",
    assigneeIds: ["u1", "u0"],
    dueDate: "2026-06-06",
    createdAt: "2026-05-20T10:00:00Z",
    updatedAt: "2026-06-01T14:30:00Z",
    comments: [
      {
        id: "c1",
        authorId: "u0",
        content:
          "Please double-check that the withdrawal language matches what we submitted to IRB. The version from last March had a slightly different phrasing.",
        createdAt: "2026-05-28T09:15:00Z",
      },
      {
        id: "c2",
        authorId: "u1",
        content:
          "Updated the withdrawal section — matches the IRB submission exactly now. @u0 can you take a final look before we send to legal?",
        createdAt: "2026-05-29T11:30:00Z",
        mentions: ["u0"],
      },
    ],
    files: [
      {
        id: "f1",
        name: "consent_form_v4.docx",
        size: 48200,
        uploaderId: "u1",
        uploadedAt: "2026-05-29T11:28:00Z",
        url: "#",
        type: "docx",
      },
    ],
    links: [
      {
        id: "l1",
        title: "IRB Protocol 2025-0341 (Google Doc)",
        url: "#",
        type: "google_doc",
      },
    ],
  },
  {
    id: "t2",
    projectId: "p1",
    title: "Code interview transcripts — Phase 1",
    description:
      "Apply the moral injury codebook to the first 12 interview transcripts. Flag any passages that don't fit existing codes for team discussion.",
    status: "in_progress",
    priority: "high",
    assigneeIds: ["u2", "u3"],
    dueDate: "2026-06-14",
    createdAt: "2026-05-15T09:00:00Z",
    updatedAt: "2026-06-01T10:00:00Z",
    comments: [
      {
        id: "c3",
        authorId: "u2",
        content:
          "Finished transcripts 1–6. Three passages in transcript 4 don't map cleanly to existing codes. Will flag in the shared doc.",
        createdAt: "2026-05-31T16:00:00Z",
      },
    ],
    files: [],
    links: [
      {
        id: "l2",
        title: "Codebook v2 (Google Sheet)",
        url: "#",
        type: "google_sheet",
      },
    ],
  },
  {
    id: "t3",
    projectId: "p1",
    title: "Literature review — resilience frameworks",
    description:
      "Synthesize literature on post-traumatic resilience frameworks published 2018–2026. Focus on longitudinal study designs.",
    status: "in_progress",
    priority: "medium",
    assigneeIds: ["u1"],
    dueDate: "2026-06-20",
    createdAt: "2026-05-10T08:00:00Z",
    updatedAt: "2026-05-30T12:00:00Z",
    comments: [],
    files: [],
    links: [
      {
        id: "l3",
        title: "Literature Review Notes (Google Doc)",
        url: "#",
        type: "google_doc",
      },
    ],
  },
  {
    id: "t4",
    projectId: "p1",
    title: "Schedule Phase 2 participant interviews",
    description:
      "Coordinate with 18 participants for 60-minute interviews. Use the Zoom link and send calendar invites. Ensure the trauma-informed protocol script is ready.",
    status: "todo",
    priority: "medium",
    assigneeIds: ["u4"],
    dueDate: "2026-06-10",
    createdAt: "2026-05-25T14:00:00Z",
    updatedAt: "2026-05-25T14:00:00Z",
    comments: [],
    files: [],
    links: [],
  },
  {
    id: "t5",
    projectId: "p1",
    title: "Prepare team debrief protocol",
    description:
      "Draft structured debrief questions for the post-interview team check-in. Reference the vicarious trauma mitigation guide from Dr. Osei's previous study.",
    status: "todo",
    priority: "medium",
    assigneeIds: ["u0", "u1"],
    dueDate: "2026-06-08",
    createdAt: "2026-05-26T10:00:00Z",
    updatedAt: "2026-05-26T10:00:00Z",
    comments: [],
    files: [],
    links: [],
  },
  {
    id: "t6",
    projectId: "p1",
    title: "Statistical analysis — pilot data",
    description:
      "Run descriptive statistics on the 24-person pilot dataset. Check for floor/ceiling effects on the MI-Measure subscales.",
    status: "todo",
    priority: "low",
    assigneeIds: ["u3"],
    dueDate: "2026-06-28",
    createdAt: "2026-05-28T09:00:00Z",
    updatedAt: "2026-05-28T09:00:00Z",
    comments: [],
    files: [],
    links: [
      {
        id: "l4",
        title: "Pilot Data Analysis Sheet (Google Sheet)",
        url: "#",
        type: "google_sheet",
      },
    ],
  },
  {
    id: "t7",
    projectId: "p1",
    title: "Submit ethics amendment",
    description:
      "File the amendment to extend data collection by 6 months and add the digital consent procedure.",
    status: "done",
    priority: "high",
    assigneeIds: ["u0", "u1"],
    dueDate: "2026-05-15",
    createdAt: "2026-04-20T09:00:00Z",
    updatedAt: "2026-05-14T17:00:00Z",
    comments: [
      {
        id: "c4",
        authorId: "u0",
        content: "Amendment approved. IRB confirmation email is in the project folder.",
        createdAt: "2026-05-20T10:00:00Z",
      },
    ],
    files: [
      {
        id: "f2",
        name: "ethics_amendment_approved.pdf",
        size: 124800,
        uploaderId: "u0",
        uploadedAt: "2026-05-20T10:05:00Z",
        url: "#",
        type: "pdf",
      },
    ],
    links: [],
  },
  {
    id: "t8",
    projectId: "p1",
    title: "Develop trauma-informed interview guide",
    description:
      "Iterative development of the semi-structured interview protocol. Three rounds of peer review completed.",
    status: "done",
    priority: "high",
    assigneeIds: ["u0", "u2", "u4"],
    dueDate: "2026-04-30",
    createdAt: "2026-03-15T08:00:00Z",
    updatedAt: "2026-04-28T15:00:00Z",
    comments: [],
    files: [
      {
        id: "f3",
        name: "interview_guide_final.docx",
        size: 89600,
        uploaderId: "u0",
        uploadedAt: "2026-04-28T15:00:00Z",
        url: "#",
        type: "docx",
      },
    ],
    links: [],
  },
];

// ── Activity Feed ─────────────────────────────────────────────────────────────

export const ACTIVITY: ActivityEvent[] = [
  {
    id: "a1",
    actorId: "u2",
    action: "moved",
    objectType: "task",
    objectLabel: "Code interview transcripts — Phase 1",
    destination: "In Progress",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: "a2",
    actorId: "u1",
    action: "uploaded",
    objectType: "file",
    objectLabel: "consent_form_v4.docx",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "a3",
    actorId: "u4",
    action: "assigned themselves to",
    objectType: "task",
    objectLabel: "Schedule Phase 2 participant interviews",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "a4",
    actorId: "u0",
    action: "commented on",
    objectType: "comment",
    objectLabel: "Finalize consent form language",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
  },
  {
    id: "a5",
    actorId: "u3",
    action: "created",
    objectType: "task",
    objectLabel: "Statistical analysis — pilot data",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
];

// ── Calendar Events ───────────────────────────────────────────────────────────

export const EVENTS: CalendarEvent[] = [
  {
    id: "e1",
    title: "Team debrief — post interview",
    date: "2026-06-04",
    time: "14:00",
    projectId: "p1",
  },
  {
    id: "e2",
    title: "IRB amendment follow-up call",
    date: "2026-06-06",
    time: "11:00",
    projectId: "p1",
  },
  {
    id: "e3",
    title: "Phase 2 participant interviews begin",
    date: "2026-06-10",
    projectId: "p1",
  },
  {
    id: "e4",
    title: "Lab meeting — codebook review",
    date: "2026-06-12",
    time: "13:00",
    projectId: "p1",
  },
  {
    id: "e5",
    title: "Conference abstract deadline",
    date: "2026-06-20",
    projectId: "p1",
  },
];

// ── Dashboard Posts ───────────────────────────────────────────────────────────

export const DASHBOARD_POSTS: DashboardPost[] = [
  {
    id: "dp1",
    authorId: "u2",
    content:
      "NSF supplement funding opportunity — due Aug 1. Could support a summer RA. Sharing link in Slack.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    type: "opportunity",
  },
  {
    id: "dp2",
    authorId: "u4",
    content:
      "Priya just got accepted to the APA Trauma Division early-career workshop!",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    type: "lab_win",
  },
  {
    id: "dp3",
    authorId: "u0",
    content: "The ethics amendment was approved faster than expected — 3 weeks! Great team effort on that submission.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    type: "lab_win",
  },
];

// ── Journal Prompts ───────────────────────────────────────────────────────────

export const JOURNAL_PROMPTS: JournalPrompt[] = [
  // Emotional Processing
  { id: "jp1", text: "What emotions came up for you in your research work this week?", category: "emotional_processing" },
  { id: "jp2", text: "Was there a moment this week when you felt particularly affected by the content of your work? What happened?", category: "emotional_processing" },
  { id: "jp3", text: "What have you done to take care of yourself this week?", category: "emotional_processing" },
  // Research Reflection
  { id: "jp4", text: "What felt meaningful in your research work this week?", category: "research_reflection" },
  { id: "jp5", text: "What's one thing you're uncertain about in your current research, and how are you sitting with that uncertainty?", category: "research_reflection" },
  { id: "jp6", text: "How does the work you're doing connect to the reason you started this research in the first place?", category: "research_reflection" },
  // Boundaries & Workload
  { id: "jp7", text: "Were you able to step away from your research this week? What helped or made that difficult?", category: "boundaries_workload" },
  { id: "jp8", text: "What's one thing you wish your team knew about your workload this week?", category: "boundaries_workload" },
  // Team & Support
  { id: "jp9", text: "Is there something you'd like more support with right now? What would that support look like?", category: "team_support" },
  { id: "jp10", text: "How connected did you feel to your team this week?", category: "team_support" },
  // Looking Forward
  { id: "jp11", text: "What's one thing you're looking forward to next week, in or outside of your research?", category: "looking_forward" },
  { id: "jp12", text: "If you could change one thing about how your research work is going right now, what would it be?", category: "looking_forward" },
];

export const ACTIVE_PROMPT_IDS = ["jp2", "jp7", "jp11"];

// ── Checkin Questions ─────────────────────────────────────────────────────────

export const CHECKIN_QUESTIONS: CheckinQuestion[] = [
  { id: "cq1", text: "I feel supported by my research team." },
  { id: "cq2", text: "I have been able to manage my workload this week." },
  { id: "cq3", text: "My research work has felt meaningful to me." },
  { id: "cq4", text: "I have been able to maintain boundaries between work and personal time." },
  { id: "cq5", text: "I feel comfortable reaching out for help when I need it." },
];

export const CHECKIN_LABELS: Record<number, string> = {
  1: "Strongly Disagree",
  2: "Disagree",
  3: "Neutral",
  4: "Agree",
  5: "Strongly Agree",
};

export const CHECKIN_COLORS: Record<number, string> = {
  1: "#C0392B",
  2: "#D97706",
  3: "#6B7280",
  4: "#2E7D52",
  5: "#1B2E4B",
};

// ── Journal Entries ───────────────────────────────────────────────────────────

export const JOURNAL_ENTRIES: JournalEntry[] = [
  {
    id: "je1",
    userId: "u1",
    date: "2026-05-26",
    prompts: [
      {
        promptId: "jp2",
        promptText: "Was there a moment this week when you felt particularly affected by the content of your work? What happened?",
        response:
          "Transcript 3 from the pilot was hard to sit with. The participant described losing a colleague to suicide after they both witnessed the same incident. I noticed myself slowing way down while coding it — which I think is good, actually. Gave myself the afternoon to step away from the coding and go for a walk.",
      },
      {
        promptId: "jp7",
        promptText: "Were you able to step away from your research this week? What helped or made that difficult?",
        response:
          "Better than last week. I set a hard stop at 6pm on Wednesday and kept it. The hardest day was Friday when I wanted to finish coding transcript 6 — I ended up stopping at a natural break instead of pushing through. It helped.",
      },
      {
        promptId: "jp11",
        promptText: "What's one thing you're looking forward to next week, in or outside of your research?",
        response: "The team meeting Thursday — I actually enjoy when we all get together to work through codebook disagreements. Also: hiking Sunday.",
      },
    ],
    checkin: [
      { questionId: "cq1", score: 4 },
      { questionId: "cq2", score: 3 },
      { questionId: "cq3", score: 5 },
      { questionId: "cq4", score: 3 },
      { questionId: "cq5", score: 4 },
    ],
    isDraft: false,
    createdAt: "2026-05-26T19:00:00Z",
    updatedAt: "2026-05-26T19:45:00Z",
  },
  {
    id: "je2",
    userId: "u1",
    date: "2026-05-19",
    prompts: [
      {
        promptId: "jp2",
        promptText: "Was there a moment this week when you felt particularly affected by the content of your work? What happened?",
        response: "Not as much as other weeks. The administrative work (IRB amendment) is tedious but less emotionally activating. I think I needed a week like this.",
      },
      {
        promptId: "jp7",
        promptText: "Were you able to step away from your research this week? What helped or made that difficult?",
        response: "Harder this week — kept thinking about the amendment deadlines. Worked a couple of evenings I hadn't planned to.",
      },
      {
        promptId: "jp11",
        promptText: "What's one thing you're looking forward to next week, in or outside of your research?",
        response: "Getting back to the actual interview data.",
      },
    ],
    checkin: [
      { questionId: "cq1", score: 4 },
      { questionId: "cq2", score: 2 },
      { questionId: "cq3", score: 3 },
      { questionId: "cq4", score: 2 },
      { questionId: "cq5", score: 4 },
    ],
    isDraft: false,
    createdAt: "2026-05-19T20:00:00Z",
    updatedAt: "2026-05-19T20:30:00Z",
  },
];

// ── Literature ────────────────────────────────────────────────────────────────

export const LITERATURE_COLLECTIONS: LiteratureCollection[] = [
  { id: "lc0", name: "All Items",          emoji: "📚", itemCount: 18 },
  { id: "lc1", name: "IRB & Ethics",       emoji: "📋", itemCount: 3  },
  { id: "lc2", name: "Trauma Studies",     emoji: "🧠", itemCount: 8  },
  { id: "lc3", name: "Research Methods",   emoji: "🔬", itemCount: 4  },
  { id: "lc4", name: "Researcher Wellbeing", emoji: "💚", itemCount: 3 },
];

export const LITERATURE_ITEMS: LiteratureItem[] = [
  {
    id: "li1",
    projectId: "p1",
    scope: "lab",
    type: "article",
    title: "Moral injury in military veterans: A qualitative investigation of the role of unit cohesion",
    authors: ["Williamson, V.", "Greenberg, N.", "Murphy, D."],
    year: 2022,
    journal: "Psychological Trauma: Theory, Research, Practice, and Policy",
    volume: "14(3)",
    pages: "512–521",
    doi: "10.1037/tra0001234",
    abstract:
      "This qualitative study examines how unit cohesion relates to moral injury outcomes in military veterans. Thematic analysis of 22 semi-structured interviews revealed that strong unit bonds can both buffer and complicate the experience of moral injury, depending on the nature of the transgressive event.",
    tags: ["moral injury", "veterans", "unit cohesion", "qualitative"],
    status: "read",
    rating: 5,
    notes:
      "Key paper for our theoretical framework. The finding on 'protective guilt' is directly relevant to Phase 2 interview guide — add to codebook meeting agenda.",
    files: [
      {
        id: "lf1",
        name: "williamson_2022_moral_injury.pdf",
        size: 1240000,
        uploaderId: "u0",
        uploadedAt: "2026-01-15T09:00:00Z",
        ocrStatus: "ready",
      },
    ],
    addedById: "u0",
    addedAt: "2026-01-15T09:00:00Z",
    collections: ["lc2"],
    relatedIds: ["li2", "li3"],
  },
  {
    id: "li2",
    projectId: "p1",
    scope: "lab",
    type: "article",
    title: "Measuring moral injury: Psychometric properties of the Moral Injury Outcomes Scale",
    authors: ["Litz, B.T.", "Stein, N.", "Delaney, E.", "Lebowitz, L."],
    year: 2019,
    journal: "Psychological Assessment",
    volume: "31(4)",
    pages: "461–472",
    doi: "10.1037/pas0000660",
    abstract:
      "We examine the psychometric properties of the Moral Injury Outcomes Scale (MIOS) in a sample of 412 combat veterans. Confirmatory factor analysis supports a two-factor structure: transgression-based distress and betrayal-based distress.",
    tags: ["moral injury", "measurement", "psychometrics", "MI-Measure"],
    status: "read",
    rating: 5,
    notes: "Core measurement paper. Using MIOS subscales in our pilot — see pilot data analysis sheet.",
    files: [],
    addedById: "u1",
    addedAt: "2026-02-03T10:00:00Z",
    collections: ["lc2", "lc3"],
    relatedIds: ["li1", "li4"],
  },
  {
    id: "li3",
    projectId: "p1",
    scope: "lab",
    type: "article",
    title: "Vicarious trauma and resilience in trauma researchers: A systematic review",
    authors: ["Dunkley, J.", "Whelan, T.A."],
    year: 2020,
    journal: "Traumatology",
    volume: "12(1)",
    pages: "1–8",
    doi: "10.1177/1534765620956",
    abstract:
      "A systematic review of 34 studies examining vicarious trauma (VT) in researchers who study trauma. Findings reveal that VT is prevalent but underacknowledged in academic research contexts, and that institutional support structures significantly moderate outcomes.",
    tags: ["vicarious trauma", "researchers", "resilience", "systematic review"],
    status: "reading",
    rating: 4,
    notes: "",
    files: [],
    addedById: "u1",
    addedAt: "2026-03-10T11:00:00Z",
    collections: ["lc4"],
    relatedIds: ["li1"],
  },
  {
    id: "li4",
    projectId: "p1",
    scope: "lab",
    type: "article",
    title: "Post-traumatic growth: Conceptual foundations and empirical evidence",
    authors: ["Tedeschi, R.G.", "Calhoun, L.G."],
    year: 2018,
    journal: "Psychological Inquiry",
    volume: "15(1)",
    pages: "1–18",
    doi: "10.1207/s15327965pli1501_01",
    abstract:
      "This paper reviews the conceptual framework of post-traumatic growth (PTG) and the empirical evidence supporting it across populations including trauma survivors, cancer patients, and bereaved individuals.",
    tags: ["PTG", "resilience", "longitudinal", "theoretical"],
    status: "read",
    rating: 4,
    files: [],
    addedById: "u2",
    addedAt: "2026-02-20T09:00:00Z",
    collections: ["lc2"],
    relatedIds: ["li2"],
  },
  {
    id: "li5",
    projectId: "p1",
    scope: "lab",
    type: "report",
    title: "Guidance on ethical considerations in trauma research with vulnerable populations",
    authors: ["APA Science Directorate"],
    year: 2023,
    publisher: "American Psychological Association",
    doi: "",
    abstract:
      "APA guidance document covering consent procedures, risk minimization, researcher self-care, and IRB considerations specific to trauma research with vulnerable participant groups.",
    tags: ["IRB", "ethics", "trauma research", "consent"],
    status: "read",
    rating: 3,
    files: [],
    addedById: "u0",
    addedAt: "2026-01-08T09:00:00Z",
    collections: ["lc1"],
    relatedIds: [],
  },
  {
    id: "li6",
    projectId: "p1",
    scope: "my",
    type: "preprint",
    title: "Digital consent procedures in sensitive research: A mixed-methods evaluation",
    authors: ["Chen, A.", "Okonkwo, B."],
    year: 2025,
    journal: "PsyArXiv",
    doi: "10.31234/osf.io/abc12",
    abstract:
      "We evaluate the acceptability and comprehension of digital consent procedures across three trauma research studies. Findings suggest digital consent is comparable to in-person procedures when accompanied by synchronous clarification opportunities.",
    tags: ["digital consent", "research methods", "IRB"],
    status: "unread",
    rating: 0,
    files: [],
    addedById: "u1",
    addedAt: "2026-05-15T14:00:00Z",
    collections: ["lc1", "lc3"],
    relatedIds: ["li5"],
  },
];

// ── Team Members ──────────────────────────────────────────────────────────────

export const TEAM_MEMBERS: TeamMember[] = [
  {
    ...USERS[0],
    taskCounts: { todo: 2, in_progress: 1, in_review: 1, done: 2 },
    weeklyUpdate: "Reviewing Phase 1 coding and preparing debrief protocol.",
    weeklyUpdatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  },
  {
    ...USERS[1],
    taskCounts: { todo: 1, in_progress: 1, in_review: 1, done: 1 },
    weeklyUpdate: "Literature review + consent form final review.",
    weeklyUpdatedAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
  {
    ...USERS[2],
    taskCounts: { todo: 0, in_progress: 1, in_review: 0, done: 1 },
    weeklyUpdate: "Coding transcripts 7–12 this week.",
    weeklyUpdatedAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
  },
  {
    ...USERS[3],
    taskCounts: { todo: 1, in_progress: 1, in_review: 0, done: 0 },
    weeklyUpdate: undefined,
    weeklyUpdatedAt: undefined,
  },
  {
    ...USERS[4],
    taskCounts: { todo: 1, in_progress: 0, in_review: 0, done: 1 },
    weeklyUpdate: "Scheduling participant interviews for Phase 2.",
    weeklyUpdatedAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
  },
];

// ── Notifications ─────────────────────────────────────────────────────────────

export const NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    type: "task_comment",
    recipientId: "u1",
    message: "Dr. Yara Osei commented on Finalize consent form language",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    linkTo: "/tasks",
  },
  {
    id: "n2",
    type: "task_mention",
    recipientId: "u1",
    message: "You were mentioned in a comment on Finalize consent form language",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    linkTo: "/tasks",
  },
  {
    id: "n3",
    type: "journal_reminder",
    recipientId: "u1",
    message: "Your journal is here when you're ready.",
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    linkTo: "/journal",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const diff = now - new Date(isoString).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(isoDateString: string): string {
  const d = new Date(isoDateString + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatFullDate(isoDateString: string): string {
  const d = new Date(isoDateString + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
