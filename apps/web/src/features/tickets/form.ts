import type {
  Ticket,
  TicketPriority,
  TicketProjectRelationship,
  TicketStatus,
  TicketType
} from "../../lib/types";

export interface TicketProjectLinkFormState {
  projectId: string;
  relationship: TicketProjectRelationship;
}

export interface TicketFormState {
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  type: TicketType;
  dueAt: string;
  projectLinks: TicketProjectLinkFormState[];
}

export function createEmptyTicketForm(): TicketFormState {
  return {
    title: "",
    description: "",
    status: "INBOX",
    priority: "MEDIUM",
    type: "TASK",
    dueAt: "",
    projectLinks: []
  };
}

export function createProjectLinkRow(): TicketProjectLinkFormState {
  return {
    projectId: "",
    relationship: "RELATED"
  };
}

function toDateTimeInput(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function toApiDateTime(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function toTicketForm(ticket: Ticket): TicketFormState {
  return {
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    type: ticket.type,
    dueAt: toDateTimeInput(ticket.dueAt),
    projectLinks: ticket.projectLinks.map((link) => ({
      projectId: String(link.projectId),
      relationship: link.relationship
    }))
  };
}

export function toTicketPayload(form: TicketFormState) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    status: form.status,
    priority: form.priority,
    type: form.type,
    dueAt: toApiDateTime(form.dueAt),
    projectLinks: form.projectLinks
      .filter((link) => link.projectId)
      .map((link) => ({
        projectId: Number(link.projectId),
        relationship: link.relationship
      }))
  };
}
