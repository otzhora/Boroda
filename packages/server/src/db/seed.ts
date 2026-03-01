import { eq } from "drizzle-orm";
import { db } from "./client";
import {
  projectFolders,
  projects,
  sequences,
  ticketActivities,
  ticketProjectLinks,
  tickets,
  workContexts
} from "./schema";

function isoOffset(hoursAgo: number) {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

async function getProjectId(slug: string) {
  const project = db.select({ id: projects.id }).from(projects).where(eq(projects.slug, slug)).get();

  if (!project) {
    throw new Error(`Seed project missing after insert: ${slug}`);
  }

  return project.id;
}

async function getTicketId(key: string) {
  const ticket = db.select({ id: tickets.id }).from(tickets).where(eq(tickets.key, key)).get();

  if (!ticket) {
    throw new Error(`Seed ticket missing after insert: ${key}`);
  }

  return ticket.id;
}

const existingRecords =
  db.select({ count: projects.id }).from(projects).all().length +
  db.select({ count: tickets.id }).from(tickets).all().length;

if (existingRecords > 0) {
  console.log("Seed skipped because the database already contains data.");
  process.exit(0);
}

const seedProjects = [
  {
    name: "Boroda Product",
    slug: "boroda-product",
    description: "Local planning board and frontend shell.",
    color: "#b07e3e",
    createdAt: isoOffset(72),
    updatedAt: isoOffset(3)
  },
  {
    name: "Payments API",
    slug: "payments-api",
    description: "Backend service work and migration follow-up.",
    color: "#355c7d",
    createdAt: isoOffset(96),
    updatedAt: isoOffset(6)
  },
  {
    name: "Ops Terraform",
    slug: "ops-terraform",
    description: "Infra changes that need manual console verification.",
    color: "#4f6f52",
    createdAt: isoOffset(120),
    updatedAt: isoOffset(12)
  }
];

db.insert(projects).values(seedProjects).run();

const borodaProjectId = await getProjectId("boroda-product");
const paymentsProjectId = await getProjectId("payments-api");
const opsProjectId = await getProjectId("ops-terraform");

db.insert(projectFolders)
  .values([
    {
      projectId: borodaProjectId,
      label: "web app",
      path: "/home/otzhora/projects/codex_projects/boroda/apps/web",
      kind: "APP",
      isPrimary: true,
      existsOnDisk: true,
      createdAt: isoOffset(70),
      updatedAt: isoOffset(6)
    },
    {
      projectId: paymentsProjectId,
      label: "api service",
      path: "/home/otzhora/projects/payments-api",
      kind: "BACKEND",
      isPrimary: true,
      existsOnDisk: false,
      createdAt: isoOffset(90),
      updatedAt: isoOffset(12)
    },
    {
      projectId: opsProjectId,
      label: "terraform",
      path: "/home/otzhora/projects/payments-terraform",
      kind: "TERRAFORM",
      isPrimary: true,
      existsOnDisk: false,
      createdAt: isoOffset(110),
      updatedAt: isoOffset(18)
    }
  ])
  .run();

db.insert(sequences).values({ name: "ticket", value: 4 }).run();

db.insert(tickets)
  .values([
    {
      key: "BRD-1",
      title: "Polish empty board experience",
      description: "Add guided empty states, shortcuts, and an export action.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueAt: null,
      createdAt: isoOffset(24),
      updatedAt: isoOffset(2)
    },
    {
      key: "BRD-2",
      title: "Review payments webhook retry handling",
      description: "Backend follow-up after failed staging replay.",
      status: "READY",
      priority: "CRITICAL",
      dueAt: null,
      createdAt: isoOffset(40),
      updatedAt: isoOffset(5)
    },
    {
      key: "BRD-3",
      title: "Run Terraform drift check for nightly alarms",
      description: "Needs manual AWS console verification after plan review.",
      status: "MANUAL_UI",
      priority: "MEDIUM",
      dueAt: null,
      createdAt: isoOffset(36),
      updatedAt: isoOffset(8)
    },
    {
      key: "BRD-4",
      title: "Archive obsolete design notes",
      description: "Close out the initial discovery thread.",
      status: "DONE",
      priority: "LOW",
      dueAt: null,
      createdAt: isoOffset(84),
      updatedAt: isoOffset(20)
    }
  ])
  .run();

const boardTicketId = await getTicketId("BRD-1");
const paymentsTicketId = await getTicketId("BRD-2");
const opsTicketId = await getTicketId("BRD-3");
const doneTicketId = await getTicketId("BRD-4");

db.insert(ticketProjectLinks)
  .values([
    {
      ticketId: boardTicketId,
      projectId: borodaProjectId,
      relationship: "PRIMARY",
      createdAt: isoOffset(24)
    },
    {
      ticketId: paymentsTicketId,
      projectId: paymentsProjectId,
      relationship: "PRIMARY",
      createdAt: isoOffset(40)
    },
    {
      ticketId: opsTicketId,
      projectId: opsProjectId,
      relationship: "PRIMARY",
      createdAt: isoOffset(36)
    },
    {
      ticketId: opsTicketId,
      projectId: paymentsProjectId,
      relationship: "RELATED",
      createdAt: isoOffset(35)
    },
    {
      ticketId: doneTicketId,
      projectId: borodaProjectId,
      relationship: "PRIMARY",
      createdAt: isoOffset(84)
    }
  ])
  .run();

db.insert(workContexts)
  .values([
    {
      ticketId: boardTicketId,
      type: "CODEX_SESSION",
      label: "Board polish pass",
      value: "codex://session/board-polish-pass",
      metaJson: JSON.stringify({ tool: "codex", mode: "default" }),
      createdAt: isoOffset(3),
      updatedAt: isoOffset(2)
    },
    {
      ticketId: paymentsTicketId,
      type: "PR",
      label: "Retry fix PR",
      value: "https://github.com/example/payments-api/pull/128",
      metaJson: JSON.stringify({ branch: "fix/webhook-retries" }),
      createdAt: isoOffset(8),
      updatedAt: isoOffset(5)
    },
    {
      ticketId: opsTicketId,
      type: "AWS_CONSOLE",
      label: "CloudWatch alarm review",
      value: "Reviewed alarm thresholds in us-east-1",
      metaJson: JSON.stringify({ region: "us-east-1" }),
      createdAt: isoOffset(12),
      updatedAt: isoOffset(8)
    }
  ])
  .run();

db.insert(ticketActivities)
  .values([
    {
      ticketId: boardTicketId,
      type: "ticket.created",
      message: "Ticket created for board polish",
      metaJson: "{}",
      createdAt: isoOffset(24)
    },
    {
      ticketId: boardTicketId,
      type: "ticket.status.changed",
      message: "Status changed from ready to in progress",
      metaJson: JSON.stringify({ from: "READY", to: "IN_PROGRESS" }),
      createdAt: isoOffset(2)
    },
    {
      ticketId: paymentsTicketId,
      type: "ticket.created",
      message: "Ticket created from staging retry incident",
      metaJson: "{}",
      createdAt: isoOffset(40)
    },
    {
      ticketId: opsTicketId,
      type: "ticket.created",
      message: "Manual verification work captured for AWS console review",
      metaJson: "{}",
      createdAt: isoOffset(36)
    },
    {
      ticketId: doneTicketId,
      type: "ticket.completed",
      message: "Discovery notes archived and ticket closed",
      metaJson: "{}",
      createdAt: isoOffset(20)
    }
  ])
  .run();

console.log("Seed data applied: 3 projects, 4 tickets, and linked sample contexts.");
