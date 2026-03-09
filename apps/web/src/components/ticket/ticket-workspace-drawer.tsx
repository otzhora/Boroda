import { useEffect, useMemo, useRef, useState } from "react";
import type { TicketFormState, TicketProjectLinkFormState, TicketWorkspaceFormState } from "../../features/tickets/form";
import type { Project } from "../../lib/types";
import { ModalDialog } from "../ui/modal-dialog";
import { inputClassName, labelClassName } from "./ticket-form";

interface TicketWorkspaceDrawerProps {
  open: boolean;
  form: TicketFormState;
  projects: Project[];
  isSaving: boolean;
  onChange: (updater: (current: TicketFormState) => TicketFormState) => void;
  onSave: () => void;
  onClose: () => void;
}

interface FolderRow {
  folderId: string;
  projectId: number;
  projectName: string;
  folderLabel: string;
  path: string;
  defaultBranch: string | null;
  branchName: string;
}

function ChevronIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function sortProjectLinks(links: TicketProjectLinkFormState[]) {
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

function sortFolders(project: Project) {
  return [...project.folders].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) {
      return Number(right.isPrimary) - Number(left.isPrimary);
    }

    return left.label.localeCompare(right.label);
  });
}

function normalizeProjectLinks(projectLinks: TicketProjectLinkFormState[]) {
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
      relationship: index === 0 ? "PRIMARY" : "RELATED"
    }));
}

function buildFolderProjectLookup(projects: Project[]) {
  const lookup = new Map<string, number>();

  for (const project of projects) {
    for (const folder of project.folders) {
      lookup.set(String(folder.id), project.id);
    }
  }

  return lookup;
}

function getAvailableProjectOptions(projects: Project[], projectLinks: TicketProjectLinkFormState[]) {
  const linkedIds = new Set(projectLinks.map((link) => Number(link.projectId)).filter((id) => Number.isInteger(id) && id > 0));
  return projects.filter((project) => !linkedIds.has(project.id));
}

function filterWorkspacesForProjects(
  workspaces: TicketWorkspaceFormState[],
  projectLinks: TicketProjectLinkFormState[],
  projects: Project[]
) {
  const linkedIds = new Set(projectLinks.map((link) => Number(link.projectId)).filter((id) => Number.isInteger(id) && id > 0));
  const folderProjectLookup = buildFolderProjectLookup(projects);

  return workspaces.filter((workspace) => {
    const projectId = folderProjectLookup.get(workspace.projectFolderId);
    return projectId !== undefined && linkedIds.has(projectId);
  });
}

function buildFolderRows(form: TicketFormState, projects: Project[]) {
  const workspaceByFolderId = new Map(form.workspaces.map((workspace) => [workspace.projectFolderId, workspace]));
  const linkedIds = new Set(form.projectLinks.map((link) => Number(link.projectId)).filter((id) => Number.isInteger(id) && id > 0));

  return projects
    .filter((project) => linkedIds.has(project.id))
    .flatMap((project) =>
      sortFolders(project).map((folder) => {
        const workspace = workspaceByFolderId.get(String(folder.id));

        return {
          folderId: String(folder.id),
          projectId: project.id,
          projectName: project.name,
          folderLabel: folder.label,
          path: folder.path,
          defaultBranch: folder.defaultBranch,
          branchName: workspace?.branchName ?? ""
        } satisfies FolderRow;
      })
    );
}

function getMissingDefaultBranchCount(rows: FolderRow[]) {
  return rows.filter((row) => row.branchName.trim() && !row.defaultBranch?.trim()).length;
}

function getWorkspaceSnapshot(form: TicketFormState) {
  return JSON.stringify({
    workspaces: form.workspaces.map((workspace) => ({
      projectFolderId: workspace.projectFolderId,
      branchName: workspace.branchName,
      baseBranch: workspace.baseBranch
    })),
    projectLinks: form.projectLinks.map((link) => ({
      projectId: link.projectId,
      relationship: link.relationship
    }))
  });
}

export function TicketWorkspaceDrawer({
  open,
  form,
  projects,
  isSaving,
  onChange,
  onSave,
  onClose
}: TicketWorkspaceDrawerProps) {
  const addProjectSelectRef = useRef<HTMLSelectElement>(null);
  const [projectToAdd, setProjectToAdd] = useState("");
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(false);
  const openedSnapshotRef = useRef<string | null>(null);
  const sortedProjectLinks = useMemo(() => sortProjectLinks(form.projectLinks), [form.projectLinks]);
  const availableProjectOptions = useMemo(
    () => getAvailableProjectOptions(projects, sortedProjectLinks),
    [projects, sortedProjectLinks]
  );
  const folderRows = useMemo(() => buildFolderRows({ ...form, projectLinks: sortedProjectLinks }, projects), [form, projects, sortedProjectLinks]);
  const missingDefaultBranchCount = useMemo(() => getMissingDefaultBranchCount(folderRows), [folderRows]);

  useEffect(() => {
    if (!open) {
      openedSnapshotRef.current = null;
      setIsProjectsExpanded(false);
      setProjectToAdd("");
      return;
    }

    openedSnapshotRef.current = getWorkspaceSnapshot(form);
  }, [open]);

  const handleClose = () => {
    if (openedSnapshotRef.current !== null && openedSnapshotRef.current !== getWorkspaceSnapshot(form) && !isSaving) {
      onSave();
    }

    onClose();
  };

  const updateProjectLinks = (projectLinks: TicketProjectLinkFormState[]) => {
    const normalizedProjectLinks = normalizeProjectLinks(projectLinks);

    onChange((current) => ({
      ...current,
      projectLinks: normalizedProjectLinks,
      workspaces: filterWorkspacesForProjects(current.workspaces, normalizedProjectLinks, projects),
      branch: filterWorkspacesForProjects(current.workspaces, normalizedProjectLinks, projects)[0]?.branchName ?? current.branch
    }));
  };

  const updateWorkspaceBranch = (row: FolderRow, branchName: string) => {
    onChange((current) => {
      const nextWorkspaces = current.workspaces.filter((workspace) => workspace.projectFolderId !== row.folderId);
      const trimmedBranchName = branchName.trim();

      if (trimmedBranchName) {
        const existingWorkspace = current.workspaces.find((workspace) => workspace.projectFolderId === row.folderId);
        nextWorkspaces.push({
          id: existingWorkspace?.id,
          projectFolderId: row.folderId,
          branchName,
          baseBranch: row.defaultBranch ?? "",
          role: existingWorkspace?.role ?? "primary"
        });
      }

      return {
        ...current,
        workspaces: nextWorkspaces,
        branch: nextWorkspaces[0]?.branchName ?? current.branch
      };
    });
  };

  return (
    <ModalDialog
      open={open}
      title="Code setup"
      onClose={handleClose}
      variant="flat"
      size="wide"
      placement="right"
      initialFocusRef={folderRows.length ? undefined : addProjectSelectRef}
    >
      <div className="grid min-h-0 gap-0">
        <section className="grid gap-4 px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="m-0 text-base font-semibold text-ink-50">Workspaces</h3>
            <span className="text-sm text-ink-300">{form.workspaces.length} active</span>
          </div>

          {missingDefaultBranchCount ? (
            <p className="m-0 rounded-md border border-red-400/20 bg-red-950/25 px-3 py-2 text-sm text-red-100" role="alert">
              {missingDefaultBranchCount} workspace{missingDefaultBranchCount === 1 ? "" : "s"} need a folder default branch in Projects.
            </p>
          ) : null}

          {folderRows.length ? (
            <div className="overflow-hidden rounded-lg border border-white/8">
              {folderRows.map((row) => {
                const hasDefaultBranch = Boolean(row.defaultBranch?.trim());

                return (
                  <div
                    key={row.folderId}
                    className="grid gap-3 border-b border-white/8 px-3 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-center"
                  >
                    <div className="min-w-0">
                      <p className="m-0 text-sm font-medium text-ink-50">
                        {row.projectName} / {row.folderLabel}
                      </p>
                      <p className="m-0 mt-1 break-all font-mono text-[0.84rem] text-ink-300">{row.path}</p>
                      {!hasDefaultBranch ? (
                        <p className="m-0 mt-2 text-sm text-red-100">Set this folder default branch in Projects before using it here.</p>
                      ) : null}
                    </div>

                    <label className="grid gap-2">
                      <span className={labelClassName}>Ticket branch</span>
                      <input
                        className={inputClassName}
                        value={row.branchName}
                        onChange={(event) => {
                          updateWorkspaceBranch(row, event.target.value);
                        }}
                        placeholder={hasDefaultBranch ? "feature/ticket-context…" : "Set folder default branch first"}
                        aria-invalid={row.branchName.trim().length > 0 && !hasDefaultBranch}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="m-0 text-sm text-ink-300">No linked project folders yet.</p>
          )}
        </section>

        <section className="grid gap-3 border-t border-white/8 px-5 py-4 sm:px-6">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-md px-1 py-1 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50"
            onClick={() => {
              setIsProjectsExpanded((current) => !current);
            }}
            aria-expanded={isProjectsExpanded}
            aria-label={`${isProjectsExpanded ? "Collapse" : "Expand"} linked projects`}
          >
            <span className="text-sm font-medium text-ink-50">Linked projects</span>
            <span className="flex items-center gap-2 text-sm text-ink-300">
              <span>
                {sortedProjectLinks.length} project{sortedProjectLinks.length === 1 ? "" : "s"}
              </span>
              <ChevronIcon className={`h-4 w-4 transition-transform ${isProjectsExpanded ? "rotate-180" : ""}`} />
            </span>
          </button>

          {isProjectsExpanded ? (
            <div className="grid gap-3">
              {sortedProjectLinks.length ? (
                <div className="overflow-hidden rounded-lg border border-white/8">
                  {sortedProjectLinks.map((link, index) => {
                    const project = projects.find((item) => String(item.id) === link.projectId);

                    return (
                      <div key={`${link.projectId}-${index}`} className="flex items-center justify-between gap-3 border-b border-white/8 px-3 py-3 last:border-b-0">
                        <p className="m-0 min-w-0 text-sm text-ink-50">{project?.name ?? "Choose project"}</p>
                        <button
                          type="button"
                          className="inline-flex min-h-9 items-center justify-center rounded-md border border-white/10 px-3 py-1.5 text-sm font-medium text-ink-100 transition-colors hover:bg-white/[0.05]"
                          onClick={() => updateProjectLinks(sortedProjectLinks.filter((_, currentIndex) => currentIndex !== index))}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="m-0 text-sm text-ink-300">No linked projects.</p>
              )}

              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="grid gap-2">
                  <span className={labelClassName}>Add linked project</span>
                  <select
                    ref={addProjectSelectRef}
                    className={inputClassName}
                    value={projectToAdd}
                    onChange={(event) => {
                      setProjectToAdd(event.target.value);
                    }}
                  >
                    <option value="">Choose project…</option>
                    {availableProjectOptions.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/10 px-4 py-2 text-sm font-medium text-ink-100 transition-colors hover:bg-white/[0.05] disabled:opacity-50"
                  disabled={!projectToAdd}
                  onClick={() => {
                    updateProjectLinks([...sortedProjectLinks, { projectId: projectToAdd, relationship: "RELATED" }]);
                    setProjectToAdd("");
                  }}
                >
                  Add project
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </ModalDialog>
  );
}
