import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./client";
import {
  projectFolders,
  projects,
  sequences,
  ticketActivities,
  ticketJiraIssueLinks,
  ticketProjectLinks,
  tickets,
  workContexts
} from "./schema";

const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));
const mockReposRoot = path.resolve(repoRoot, "data/mock-repos");

function isoOffset(hoursAgo: number) {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

function mockRepoPath(folderName: string) {
  return path.resolve(mockReposRoot, folderName);
}

const seedProjects = [
  {
    name: "Hello Contacts API (.NET)",
    slug: "hello-contacts-dotnet",
    description: "ASP.NET minimal API sample with in-memory contacts CRUD.",
    color: "#2f6690",
    createdAt: isoOffset(120),
    updatedAt: isoOffset(4)
  },
  {
    name: "Task Notes API (TypeScript)",
    slug: "task-notes-typescript",
    description: "Express + TypeScript service with hello route and notes CRUD.",
    color: "#1f7a8c",
    createdAt: isoOffset(96),
    updatedAt: isoOffset(3)
  },
  {
    name: "Habit Tracker API (Python)",
    slug: "habit-tracker-python",
    description: "FastAPI sample for habit tracking with simple CRUD endpoints.",
    color: "#4d7c0f",
    createdAt: isoOffset(84),
    updatedAt: isoOffset(2)
  }
];

const seedTickets = [
  {
    key: "BRD-1",
    title: "Add list endpoint for contacts",
    description: "Expose `GET /contacts` and seed two sample records.",
    branch: "feature/contacts-list",
    status: "IN_PROGRESS",
    priority: "HIGH",
    dueAt: null,
    createdAt: isoOffset(48),
    updatedAt: isoOffset(2)
  },
  {
    key: "BRD-2",
    title: "Implement create/update/delete contacts",
    description: "Finish core CRUD handlers in Program.cs for the .NET sample.",
    branch: "feature/contacts-crud",
    status: "READY",
    priority: "MEDIUM",
    dueAt: null,
    createdAt: isoOffset(56),
    updatedAt: isoOffset(6)
  },
  {
    key: "BRD-3",
    title: "Wire TypeScript notes router",
    description: "Add hello endpoint and in-memory CRUD routes for notes.",
    branch: "feature/notes-router",
    status: "IN_PROGRESS",
    priority: "HIGH",
    dueAt: null,
    createdAt: isoOffset(44),
    updatedAt: isoOffset(3)
  },
  {
    key: "BRD-4",
    title: "Add basic input validation for notes",
    description: "Reject blank note titles and return 422 responses.",
    branch: "feature/notes-validation",
    status: "BLOCKED",
    priority: "LOW",
    dueAt: null,
    createdAt: isoOffset(38),
    updatedAt: isoOffset(9)
  },
  {
    key: "BRD-5",
    title: "Build Python habits CRUD",
    description: "Create `/habits` list/create/update/delete endpoints in FastAPI.",
    branch: "feature/habits-crud",
    status: "MANUAL_UI",
    priority: "MEDIUM",
    dueAt: null,
    createdAt: isoOffset(34),
    updatedAt: isoOffset(5)
  },
  {
    key: "BRD-6",
    title: "Document run commands for all sample repos",
    description: "Add README quick-start commands for C#, TS, and Python samples.",
    branch: "docs/sample-repos",
    status: "DONE",
    priority: "LOW",
    dueAt: null,
    createdAt: isoOffset(72),
    updatedAt: isoOffset(12)
  }
];

db.transaction((tx) => {
  tx.delete(ticketActivities).run();
  tx.delete(workContexts).run();
  tx.delete(ticketJiraIssueLinks).run();
  tx.delete(ticketProjectLinks).run();
  tx.delete(projectFolders).run();
  tx.delete(tickets).run();
  tx.delete(projects).run();
  tx.delete(sequences).run();
});

const [
  dotnetProject,
  typescriptProject,
  pythonProject
] = db
  .insert(projects)
  .values(seedProjects)
  .returning({ id: projects.id, slug: projects.slug })
  .all();

db.insert(projectFolders)
  .values([
    {
      projectId: dotnetProject.id,
      label: "api",
      path: mockRepoPath("hello-contacts-dotnet"),
      kind: "BACKEND",
      isPrimary: true,
      existsOnDisk: true,
      createdAt: isoOffset(118),
      updatedAt: isoOffset(4)
    },
    {
      projectId: typescriptProject.id,
      label: "api",
      path: mockRepoPath("task-notes-typescript"),
      kind: "BACKEND",
      isPrimary: true,
      existsOnDisk: true,
      createdAt: isoOffset(94),
      updatedAt: isoOffset(3)
    },
    {
      projectId: pythonProject.id,
      label: "api",
      path: mockRepoPath("habit-tracker-python"),
      kind: "BACKEND",
      isPrimary: true,
      existsOnDisk: true,
      createdAt: isoOffset(82),
      updatedAt: isoOffset(2)
    }
  ])
  .run();

db.insert(sequences).values({ name: "ticket", value: seedTickets.length }).onConflictDoUpdate({
  target: sequences.name,
  set: { value: seedTickets.length }
}).run();

const insertedTickets = db.insert(tickets)
  .values(seedTickets)
  .returning({ id: tickets.id, key: tickets.key })
  .all();

const ticketIdByKey = new Map(insertedTickets.map((ticket) => [ticket.key, ticket.id]));

db.insert(ticketProjectLinks)
  .values([
    {
      ticketId: ticketIdByKey.get("BRD-1")!,
      projectId: dotnetProject.id,
      relationship: "PRIMARY",
      createdAt: isoOffset(48)
    },
    {
      ticketId: ticketIdByKey.get("BRD-2")!,
      projectId: dotnetProject.id,
      relationship: "PRIMARY",
      createdAt: isoOffset(56)
    },
    {
      ticketId: ticketIdByKey.get("BRD-3")!,
      projectId: typescriptProject.id,
      relationship: "PRIMARY",
      createdAt: isoOffset(44)
    },
    {
      ticketId: ticketIdByKey.get("BRD-4")!,
      projectId: typescriptProject.id,
      relationship: "PRIMARY",
      createdAt: isoOffset(38)
    },
    {
      ticketId: ticketIdByKey.get("BRD-5")!,
      projectId: pythonProject.id,
      relationship: "PRIMARY",
      createdAt: isoOffset(34)
    },
    {
      ticketId: ticketIdByKey.get("BRD-6")!,
      projectId: dotnetProject.id,
      relationship: "RELATED",
      createdAt: isoOffset(72)
    },
    {
      ticketId: ticketIdByKey.get("BRD-6")!,
      projectId: typescriptProject.id,
      relationship: "RELATED",
      createdAt: isoOffset(72)
    },
    {
      ticketId: ticketIdByKey.get("BRD-6")!,
      projectId: pythonProject.id,
      relationship: "RELATED",
      createdAt: isoOffset(72)
    }
  ])
  .run();

db.insert(ticketJiraIssueLinks)
  .values([
    {
      ticketId: ticketIdByKey.get("BRD-1")!,
      issueKey: "DEMO-101",
      issueSummary: "Expose contacts list endpoint",
      createdAt: isoOffset(48)
    },
    {
      ticketId: ticketIdByKey.get("BRD-3")!,
      issueKey: "DEMO-102",
      issueSummary: "Wire notes router",
      createdAt: isoOffset(44)
    },
    {
      ticketId: ticketIdByKey.get("BRD-5")!,
      issueKey: "DEMO-103",
      issueSummary: "Build habits CRUD",
      createdAt: isoOffset(34)
    }
  ])
  .run();

db.insert(workContexts)
  .values([
    {
      ticketId: ticketIdByKey.get("BRD-1")!,
      type: "CODEX_SESSION",
      label: "Contacts list endpoint session",
      value: "codex://session/contacts-list",
      metaJson: JSON.stringify({ repo: "hello-contacts-dotnet" }),
      createdAt: isoOffset(8),
      updatedAt: isoOffset(2)
    },
    {
      ticketId: ticketIdByKey.get("BRD-3")!,
      type: "PR",
      label: "Notes router draft PR",
      value: "https://github.com/example/task-notes-typescript/pull/7",
      metaJson: JSON.stringify({ branch: "feature/notes-router" }),
      createdAt: isoOffset(10),
      updatedAt: isoOffset(3)
    },
    {
      ticketId: ticketIdByKey.get("BRD-5")!,
      type: "TERMINAL_COMMAND",
      label: "FastAPI local run",
      value: "uvicorn app:app --reload",
      metaJson: JSON.stringify({ cwd: mockRepoPath("habit-tracker-python") }),
      createdAt: isoOffset(6),
      updatedAt: isoOffset(5)
    }
  ])
  .run();

db.insert(ticketActivities)
  .values([
    {
      ticketId: ticketIdByKey.get("BRD-1")!,
      type: "ticket.created",
      message: "Created from local .NET sample planning",
      metaJson: "{}",
      createdAt: isoOffset(48)
    },
    {
      ticketId: ticketIdByKey.get("BRD-3")!,
      type: "ticket.created",
      message: "Created for TypeScript integration smoke tests",
      metaJson: "{}",
      createdAt: isoOffset(44)
    },
    {
      ticketId: ticketIdByKey.get("BRD-5")!,
      type: "ticket.created",
      message: "Created for Python CRUD and terminal integration",
      metaJson: "{}",
      createdAt: isoOffset(34)
    },
    {
      ticketId: ticketIdByKey.get("BRD-6")!,
      type: "ticket.completed",
      message: "Cross-repo runbook docs completed",
      metaJson: "{}",
      createdAt: isoOffset(12)
    }
  ])
  .run();

console.log("Seed data applied: 3 projects, 6 tickets, and sample mock-repo contexts.");
