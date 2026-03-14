import type { TicketProjectLinkFormState } from "./form";
import type { Project, Ticket } from "../../lib/types";

type ProjectLinkLike = {
  projectId: number;
  relationship: string;
};

export function sortTicketProjectLinks<T extends ProjectLinkLike>(links: T[]) {
  return [...links].sort((left, right) => {
    if (left.relationship === right.relationship) {
      return left.projectId - right.projectId;
    }

    if (left.relationship === "PRIMARY") {
      return -1;
    }

    if (right.relationship === "PRIMARY") {
      return 1;
    }

    return left.projectId - right.projectId;
  });
}

export function sortTicketProjectLinkFormState(links: TicketProjectLinkFormState[]) {
  return [...links].sort((left, right) => {
    if (left.relationship === right.relationship) {
      return Number(left.projectId || 0) - Number(right.projectId || 0);
    }

    if (left.relationship === "PRIMARY") {
      return -1;
    }

    if (right.relationship === "PRIMARY") {
      return 1;
    }

    return Number(left.projectId || 0) - Number(right.projectId || 0);
  });
}

export function normalizeTicketProjectLinkFormState(projectLinks: TicketProjectLinkFormState[]) {
  const seen = new Set<string>();

  return projectLinks
    .filter((link) => {
      if (!link.projectId || seen.has(link.projectId)) {
        return false;
      }

      seen.add(link.projectId);
      return true;
    })
    .map((link, index) => ({
      ...link,
      relationship: index === 0 ? ("PRIMARY" as const) : ("RELATED" as const)
    }));
}

export function getPreferredTicketProjectFolderId(ticket: Ticket) {
  for (const link of sortTicketProjectLinks(ticket.projectLinks)) {
    const primaryFolder = link.project.folders.find((folder) => folder.isPrimary);
    if (primaryFolder) {
      return String(primaryFolder.id);
    }

    if (link.project.folders[0]) {
      return String(link.project.folders[0].id);
    }
  }

  return "";
}

export function getPreferredExistingProjectFolder(ticket: Ticket | undefined) {
  if (!ticket) {
    return null;
  }

  for (const link of sortTicketProjectLinks(ticket.projectLinks)) {
    const primaryFolder = link.project.folders.find((folder) => folder.isPrimary && folder.existsOnDisk);
    if (primaryFolder) {
      return primaryFolder;
    }

    const firstExistingFolder = link.project.folders.find((folder) => folder.existsOnDisk);
    if (firstExistingFolder) {
      return firstExistingFolder;
    }
  }

  return null;
}

export function sortProjectFolders(project: Project) {
  return [...project.folders].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) {
      return Number(right.isPrimary) - Number(left.isPrimary);
    }

    return left.label.localeCompare(right.label);
  });
}
