import type { PathInfo, Project, ProjectFolder } from "../../lib/types";

export interface ProjectFormState {
  name: string;
  slug: string;
  description: string;
  color: string;
}

export interface FolderFormState {
  label: string;
  path: string;
  defaultBranch: string;
  kind: ProjectFolder["kind"];
  isPrimary: boolean;
}

export type ProjectScope = "active" | "archived" | "all";

export const panelClassName =
  "grid gap-4 rounded-[10px] border border-white/8 bg-canvas-925 px-4 py-4";
export const insetPanelClassName = "grid gap-4 border-t border-white/8 pt-4";
export const projectListClassName =
  "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[10px] border border-white/8 bg-canvas-925";
export const projectArticleClassName =
  "grid gap-0 border-t border-white/8 px-4 transition-colors first:border-t-0";
export const projectRowClassName = "grid gap-4 py-4";
export const projectBodyClassName = "grid gap-4 border-t border-white/8 pb-4 pt-4";
export const sectionTitleClassName = "m-0 text-sm font-semibold text-ink-100";
export const labelClassName = "m-0 text-sm font-medium text-ink-100";
export const fieldClassName = "grid gap-1.5";
export const fieldWideClassName = "grid gap-1.5 md:col-span-full";
export const compactFieldClassName = "grid min-w-0 gap-1.5";
export const compactCheckboxLabelClassName =
  "flex min-h-10 min-w-[11rem] items-center gap-3 self-end rounded-[10px] border border-white/8 bg-canvas-950 px-3 py-2 text-sm text-ink-50";
export const inputClassName =
  "min-h-10 rounded-[10px] border border-white/10 bg-canvas-950 px-3 py-2.5 text-sm text-ink-50 placeholder:text-ink-300";
export const textareaClassName =
  "rounded-[10px] border border-white/10 bg-canvas-950 px-3 py-2.5 text-sm text-ink-50 placeholder:text-ink-300";
export const primaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-accent-500/40 bg-accent-500 px-3 py-2 text-sm font-medium text-canvas-975 transition-colors hover:bg-accent-300 disabled:cursor-progress disabled:opacity-70";
export const secondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-white/10 bg-canvas-950 px-3 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-canvas-900 disabled:cursor-progress disabled:opacity-70";
export const headerActionButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-white/10 bg-canvas-950 px-3 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-canvas-900 disabled:cursor-progress disabled:opacity-70";
export const dangerButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-red-400/24 bg-red-950/36 px-3 py-2 text-sm font-medium text-red-100 transition-colors hover:border-red-300/32 hover:bg-red-950/52 disabled:cursor-progress disabled:opacity-70";
export const subtleDangerButtonClassName =
  "inline-flex min-h-9 items-center justify-center rounded-[10px] border border-red-400/18 bg-transparent px-3 py-2 text-sm font-medium text-red-100 transition-colors hover:border-red-300/30 hover:bg-red-950/30 disabled:cursor-progress disabled:opacity-70";
export const chipClassName =
  "inline-flex min-h-6 items-center rounded-[8px] border px-2 py-0.5 text-xs font-medium";
export const projectToggleButtonClassName =
  "grid w-full min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[8px] px-1 py-1 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50";
export const spinnerClassName =
  "h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});

export function slugifyProjectName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function nowIso() {
  return new Date().toISOString();
}

export function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

export function describePathInfo(pathInfo: PathInfo) {
  if (pathInfo.exists && pathInfo.isDirectory) {
    return `Directory: ${pathInfo.resolvedPath}`;
  }

  if (pathInfo.exists) {
    return `Exists but not a directory: ${pathInfo.resolvedPath}`;
  }

  return `Missing: ${pathInfo.resolvedPath}`;
}

export function formatFolderCount(count: number) {
  return `${count} folder${count === 1 ? "" : "s"}`;
}

export function scopeLabel(scope: ProjectScope) {
  if (scope === "archived") {
    return "Archived";
  }

  if (scope === "all") {
    return "All";
  }

  return "Active";
}

export function createProjectFormState(project?: Project): ProjectFormState {
  if (!project) {
    return {
      name: "",
      slug: "",
      description: "",
      color: "#355c7d"
    };
  }

  return {
    name: project.name,
    slug: project.slug,
    description: project.description,
    color: project.color
  };
}

export function createFolderFormState(folder?: ProjectFolder): FolderFormState {
  if (!folder) {
    return {
      label: "",
      path: "",
      defaultBranch: "",
      kind: "APP",
      isPrimary: false
    };
  }

  return {
    label: folder.label,
    path: folder.path,
    defaultBranch: folder.defaultBranch ?? "",
    kind: folder.kind,
    isPrimary: folder.isPrimary
  };
}

export function sortProjects(items: Project[]) {
  return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function sortFolders(items: ProjectFolder[]) {
  return [...items].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) {
      return Number(right.isPrimary) - Number(left.isPrimary);
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function getFolderStatusClassName(existsOnDisk: boolean) {
  return `${chipClassName} ${
    existsOnDisk
      ? "border-emerald-400/24 bg-emerald-400/10 text-emerald-100"
      : "border-amber-300/24 bg-amber-300/10 text-amber-100"
  }`;
}

export function getWorktreeSetupStatusClassName(hasWorktreeSetup: boolean) {
  return `${chipClassName} ${
    hasWorktreeSetup
      ? "border-sky-400/24 bg-sky-400/10 text-sky-100"
      : "border-white/12 bg-white/[0.04] text-ink-200"
  }`;
}

export function hasWorktreeSetup(folder: ProjectFolder) {
  return folder.setupInfo?.hasWorktreeSetup === true;
}

export function getProjectStatusClassName(folderCount: number) {
  return `${chipClassName} ${
    folderCount > 0
      ? "border-emerald-400/24 bg-emerald-400/10 text-emerald-100"
      : "border-amber-300/24 bg-amber-300/10 text-amber-100"
  }`;
}
