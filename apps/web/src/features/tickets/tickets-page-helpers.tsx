import { useMemo, useState } from "react";
import { SectionedFilterDropdown } from "../../components/ui/sectioned-filter-dropdown";
import { TICKET_PRIORITIES, formatStatusLabel } from "../../lib/constants";
import type { Project, TicketListItem, TicketStatus } from "../../lib/types";
import type { TicketFilters, TicketScope, TicketSortDirection, TicketSortField } from "./queries";
import { formatTicketTimestamp } from "./date-time";
import { getProjectBadgeStyle } from "../../lib/project-colors";

const chipClassName = "inline-flex min-h-6 items-center rounded-[8px] border px-2 py-0.5 text-xs";
const headerButtonClassName =
  "inline-flex items-center gap-1 rounded-[8px] px-1.5 py-1 text-xs font-medium text-ink-200 transition-colors hover:bg-white/[0.04] hover:text-ink-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50";

export function hasTicketFilters(filters: TicketFilters) {
  return Boolean(
    filters.projectId?.length ||
      filters.priority?.length ||
      filters.status?.length ||
      filters.q?.trim() ||
      filters.jiraIssue?.length
  );
}

export function getDefaultStandupWindowStart() {
  const date = new Date();
  date.setHours(date.getHours() - 24);
  return date.toISOString();
}

export function wasUpdatedSinceStandup(ticket: TicketListItem, standupWindowStart: string) {
  const updatedAt = new Date(ticket.updatedAt).getTime();
  const standupStartedAt = new Date(standupWindowStart).getTime();

  if (Number.isNaN(updatedAt) || Number.isNaN(standupStartedAt)) {
    return false;
  }

  return updatedAt >= standupStartedAt;
}

export function formatStandupWindowLabel(value: string, hasSavedStandup: boolean) {
  const prefix = hasSavedStandup ? "Since last standup" : "Showing the last 24 hours";
  return `${prefix}: ${formatTicketTimestamp(value)}`;
}

export function parseScope(value: string | null): TicketScope {
  if (value === "archived" || value === "all") {
    return value;
  }

  return "active";
}

export function parseSortField(value: string | null): TicketSortField | null {
  if (
    value === "ticket" ||
    value === "jira" ||
    value === "status" ||
    value === "priority" ||
    value === "projects" ||
    value === "updated"
  ) {
    return value;
  }

  return null;
}

export function parseSortDirection(value: string | null): TicketSortDirection {
  return value === "desc" ? "desc" : "asc";
}

export function parseTicketFilters(searchParams: URLSearchParams): TicketFilters {
  const projectIds = searchParams
    .getAll("projectId")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
  const priorities = searchParams
    .getAll("priority")
    .filter((value): value is (typeof TICKET_PRIORITIES)[number] =>
      TICKET_PRIORITIES.some((priority) => priority === value)
    );
  const statuses = searchParams
    .getAll("status")
    .map((value) => value.trim())
    .filter((value): value is TicketStatus => value.length > 0);
  const jiraIssues = searchParams.getAll("jiraIssue").map((value) => value.trim()).filter(Boolean);

  return {
    q: searchParams.get("q")?.trim() || undefined,
    jiraIssue: jiraIssues.length ? jiraIssues : undefined,
    status: statuses.length ? statuses : undefined,
    priority: priorities.length ? priorities : undefined,
    projectId: projectIds.length ? projectIds : undefined,
    scope: parseScope(searchParams.get("scope"))
  };
}

export function updateSearchParam(
  searchParams: URLSearchParams,
  key: string,
  value: string | undefined,
  defaultValue?: string
) {
  if (!value || value === defaultValue) {
    searchParams.delete(key);
    return;
  }

  searchParams.set(key, value);
}

export function formatLastChange(ticket: TicketListItem) {
  if (ticket.archivedAt) {
    return `Archived ${formatTicketTimestamp(ticket.archivedAt)}`;
  }

  return `Updated ${formatTicketTimestamp(ticket.updatedAt)}`;
}

export function scopeLabel(scope: TicketScope) {
  if (scope === "archived") {
    return "Archived";
  }

  if (scope === "all") {
    return "All";
  }

  return "Current";
}

function toggleStringFilter(searchParams: URLSearchParams, key: string, value: string) {
  const currentValues = searchParams.getAll(key);
  const nextValues = currentValues.includes(value)
    ? currentValues.filter((item) => item !== value)
    : [...currentValues, value];

  searchParams.delete(key);

  for (const nextValue of nextValues) {
    searchParams.append(key, nextValue);
  }
}

function toggleNumericFilter(searchParams: URLSearchParams, key: string, value: number) {
  toggleStringFilter(searchParams, key, String(value));
}

export function ProjectChip({ project }: { project: Pick<Project, "name" | "color"> }) {
  return (
    <span
      className={`${chipClassName} border-white/10 text-ink-100`}
      style={getProjectBadgeStyle(project.color)}
      title={project.name}
    >
      {project.name}
    </span>
  );
}

export function ColumnHeader(props: {
  label: string;
  sortField: TicketSortField;
  currentSortField: TicketSortField | null;
  currentSortDirection: TicketSortDirection;
  onSort: (field: TicketSortField) => void;
}) {
  const sorted = props.currentSortField === props.sortField;
  const currentDirection =
    sorted && props.currentSortDirection === "asc" ? "ascending" : sorted ? "descending" : "not sorted";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className={headerButtonClassName}
        aria-label={`${props.label}, ${currentDirection}`}
        onClick={() => {
          props.onSort(props.sortField);
        }}
      >
        <span>{props.label}</span>
        <span aria-hidden="true" className="text-[10px] text-ink-300">
          {sorted ? (props.currentSortDirection === "asc" ? "▲" : "▼") : "·"}
        </span>
      </button>
    </div>
  );
}

export function TicketFilterDropdown(props: {
  filters: TicketFilters;
  projects: Project[];
  statuses: Array<{ status: string; label: string }>;
  jiraIssues: string[];
  inputClassName: string;
  primaryButtonClassName: string;
  filterButtonClassName: string;
  onUpdateFilters: (updater: (nextSearchParams: URLSearchParams) => void) => void;
  onClearFilters: () => void;
  hotkeySignal: number;
}) {
  const [projectSearch, setProjectSearch] = useState("");
  const [jiraSearch, setJiraSearch] = useState("");
  const hasFilters = hasTicketFilters(props.filters);

  const filteredProjects = useMemo(() => {
    const searchValue = projectSearch.trim().toLowerCase();

    if (!searchValue) {
      return props.projects;
    }

    return props.projects.filter((project) => project.name.toLowerCase().includes(searchValue));
  }, [projectSearch, props.projects]);

  const filteredJiraIssues = useMemo(() => {
    const searchValue = jiraSearch.trim().toLowerCase();

    if (!searchValue) {
      return props.jiraIssues;
    }

    return props.jiraIssues.filter((issue) => issue.toLowerCase().includes(searchValue));
  }, [jiraSearch, props.jiraIssues]);

  return (
    <SectionedFilterDropdown
      title="Ticket filters"
      hotkeySignal={props.hotkeySignal}
      hasFilters={hasFilters}
      sections={[
        { id: "status", label: "Status" },
        { id: "priority", label: "Priority" },
        { id: "project", label: "Project" },
        { id: "jira", label: "Jira issue" }
      ]}
      initialSection="status"
      activeButtonClassName={props.primaryButtonClassName}
      inactiveButtonClassName={props.filterButtonClassName}
      onClear={props.onClearFilters}
      renderSection={(section) => {
        if (section === "status") {
          return (
            <div className="grid gap-2">
              <span className="text-sm font-medium text-ink-100">Status</span>
              <div className="grid gap-1">
                {props.statuses.map((status) => {
                  const checked = props.filters.status?.includes(status.status) ?? false;

                  return (
                    <label key={status.status} className="flex min-h-10 items-center gap-3 rounded-[8px] px-2 py-1 text-sm text-ink-200 hover:bg-white/[0.03]">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={checked}
                        onChange={() => {
                          props.onUpdateFilters((nextSearchParams) => {
                            toggleStringFilter(nextSearchParams, "status", status.status);
                          });
                        }}
                      />
                      <span>{status.label || formatStatusLabel(status.status)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        }

        if (section === "priority") {
          return (
            <div className="grid gap-2">
              <span className="text-sm font-medium text-ink-100">Priority</span>
              <div className="grid gap-1">
                {TICKET_PRIORITIES.map((priority) => {
                  const checked = props.filters.priority?.includes(priority) ?? false;

                  return (
                    <label key={priority} className="flex min-h-10 items-center gap-3 rounded-[8px] px-2 py-1 text-sm text-ink-200 hover:bg-white/[0.03]">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={checked}
                        onChange={() => {
                          props.onUpdateFilters((nextSearchParams) => {
                            toggleStringFilter(nextSearchParams, "priority", priority);
                          });
                        }}
                      />
                      <span>{priority}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        }

        if (section === "project") {
          return (
            <div className="grid gap-2">
              <span className="text-sm font-medium text-ink-100">Project</span>
              <input
                className={props.inputClassName}
                aria-label="Project filter"
                placeholder="Search projects…"
                value={projectSearch}
                onChange={(event) => {
                  setProjectSearch(event.target.value);
                }}
              />
              <div className="grid max-h-[16rem] gap-1 overflow-auto pr-1">
                {filteredProjects.map((project) => {
                  const checked = props.filters.projectId?.includes(project.id) ?? false;

                  return (
                    <label key={project.id} className="flex min-h-10 items-center gap-3 rounded-[8px] px-2 py-1 text-sm text-ink-200 hover:bg-white/[0.03]">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={checked}
                        onChange={() => {
                          props.onUpdateFilters((nextSearchParams) => {
                            toggleNumericFilter(nextSearchParams, "projectId", project.id);
                          });
                        }}
                      />
                      <span className="min-w-0 truncate">{project.name}</span>
                    </label>
                  );
                })}
                {filteredProjects.length === 0 ? <p className="m-0 px-2 py-1 text-sm text-ink-300">No projects match</p> : null}
              </div>
            </div>
          );
        }

        if (section === "jira") {
          return (
            <div className="grid gap-2">
              <span className="text-sm font-medium text-ink-100">Jira issue</span>
              <input
                className={props.inputClassName}
                aria-label="Jira issue filter"
                placeholder="Search Jira issues…"
                value={jiraSearch}
                onChange={(event) => {
                  setJiraSearch(event.target.value);
                }}
              />
              <div className="grid max-h-[16rem] gap-1 overflow-auto pr-1">
                {filteredJiraIssues.map((jiraIssue) => {
                  const checked = props.filters.jiraIssue?.includes(jiraIssue) ?? false;

                  return (
                    <label key={jiraIssue} className="flex min-h-10 items-center gap-3 rounded-[8px] px-2 py-1 text-sm text-ink-200 hover:bg-white/[0.03]">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={checked}
                        onChange={() => {
                          props.onUpdateFilters((nextSearchParams) => {
                            toggleStringFilter(nextSearchParams, "jiraIssue", jiraIssue);
                          });
                        }}
                      />
                      <span>{jiraIssue}</span>
                    </label>
                  );
                })}
                {filteredJiraIssues.length === 0 ? <p className="m-0 px-2 py-1 text-sm text-ink-300">No Jira issues on the board</p> : null}
              </div>
            </div>
          );
        }

        return null;
      }}
    />
  );
}
