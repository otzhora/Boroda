import { useDeferredValue, useEffect, useEffectEvent, useId, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArchiveWorktreeDialog, extractDirtyWorktrees, type DirtyWorktreeDescriptor } from "../components/ticket/archive-worktree-dialog";
import { TicketDrawer } from "../components/ticket/ticket-drawer";
import { useAppHeader } from "../app/router";
import { TICKET_PRIORITIES, formatStatusLabel } from "../lib/constants";
import { useBoardColumnsQuery, type BoardFilters } from "../features/board/queries";
import { useProjectsQuery } from "../features/projects/queries";
import {
  createEmptyTicketForm,
  toTicketForm,
  toTicketPayload,
  type TicketFormState
} from "../features/tickets/form";
import {
  useDeleteTicketMutation,
  useOpenTicketInAppMutation,
  useRefreshTicketJiraLinksMutation,
  useUnarchiveTicketMutation,
  useUpdateTicketMutation
} from "../features/tickets/mutations";
import {
  useTicketQuery,
  useTicketsQuery,
  type TicketFilters,
  type TicketScope
} from "../features/tickets/queries";
import {
  getStoredAutoRunWorktreeSetup,
  getStoredLastStandupCompletedAt,
  setStoredLastStandupCompletedAt
} from "../lib/user-preferences";
import { ApiError } from "../lib/api-client";
import type { Project, TicketListItem, TicketStatus } from "../lib/types";

const EMPTY_BOARD_FILTERS: BoardFilters = {};
const panelClassName = "grid gap-4 rounded-[10px] border border-white/8 bg-canvas-925 px-5 py-5";
const softPanelClassName = "grid gap-3 rounded-[10px] border border-white/8 bg-canvas-925 px-4 py-4";
const listClassName = "overflow-hidden rounded-[10px] border border-white/8 bg-canvas-925";
const inputClassName =
  "min-h-10 rounded-[10px] border border-white/10 bg-canvas-950 px-3 py-2.5 text-sm text-ink-50 placeholder:text-ink-300";
const secondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-white/10 bg-canvas-950 px-3.5 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-canvas-900 disabled:cursor-progress disabled:opacity-70";
const primaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-accent-500/40 bg-accent-500 px-3.5 py-2 text-sm font-medium text-canvas-975 transition-colors hover:bg-accent-300 disabled:cursor-progress disabled:opacity-70";
const chipClassName = "inline-flex min-h-6 items-center rounded-[8px] border px-2 py-0.5 text-xs";
const headerButtonClassName =
  "inline-flex items-center gap-1 rounded-[8px] px-1.5 py-1 text-xs font-medium text-ink-200 transition-colors hover:bg-white/[0.04] hover:text-ink-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50";
const filterButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-white/10 bg-canvas-950 px-3.5 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-canvas-900";

type TicketSortField = "ticket" | "jira" | "status" | "priority" | "projects" | "updated";
type TicketSortDirection = "asc" | "desc";
type FilterSection = "status" | "priority" | "project" | "jira";

const priorityRank: Record<(typeof TICKET_PRIORITIES)[number], number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3
};

function hasTicketFilters(filters: TicketFilters) {
  return Boolean(
    filters.projectId?.length ||
      filters.priority?.length ||
      filters.status?.length ||
      filters.q?.trim() ||
      filters.jiraIssue?.length
  );
}

function getDefaultStandupWindowStart() {
  const date = new Date();
  date.setHours(date.getHours() - 24);
  return date.toISOString();
}

function wasUpdatedSinceStandup(ticket: TicketListItem, standupWindowStart: string) {
  const updatedAt = new Date(ticket.updatedAt).getTime();
  const standupStartedAt = new Date(standupWindowStart).getTime();

  if (Number.isNaN(updatedAt) || Number.isNaN(standupStartedAt)) {
    return false;
  }

  return updatedAt >= standupStartedAt;
}

function formatStandupWindowLabel(value: string, hasSavedStandup: boolean) {
  const prefix = hasSavedStandup ? "Since last standup" : "Showing the last 24 hours";
  return `${prefix}: ${formatTimestamp(value)}`;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function isSearchFocused(searchInputRef: React.RefObject<HTMLInputElement | null>) {
  return document.activeElement === searchInputRef.current;
}

function parseTicketId(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseScope(value: string | null): TicketScope {
  if (value === "archived" || value === "all") {
    return value;
  }

  return "active";
}

function parseSortField(value: string | null): TicketSortField | null {
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

function parseSortDirection(value: string | null): TicketSortDirection {
  return value === "desc" ? "desc" : "asc";
}

function parseTicketFilters(searchParams: URLSearchParams): TicketFilters {
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

function updateSearchParam(
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

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatLastChange(ticket: TicketListItem) {
  if (ticket.archivedAt) {
    return `Archived ${formatTimestamp(ticket.archivedAt)}`;
  }

  return `Updated ${formatTimestamp(ticket.updatedAt)}`;
}

function scopeLabel(scope: TicketScope) {
  if (scope === "archived") {
    return "Archived";
  }

  if (scope === "all") {
    return "All";
  }

  return "Current";
}

function compareTicketValues(
  left: TicketListItem,
  right: TicketListItem,
  field: TicketSortField,
  statusOrder: Map<string, number>
) {
  switch (field) {
    case "ticket":
      return `${left.key} ${left.title}`.localeCompare(`${right.key} ${right.title}`);
    case "jira":
      return left.jiraIssues.map((issue) => issue.key).join(", ").localeCompare(right.jiraIssues.map((issue) => issue.key).join(", "));
    case "status":
      return (statusOrder.get(left.status) ?? Number.MAX_SAFE_INTEGER) - (statusOrder.get(right.status) ?? Number.MAX_SAFE_INTEGER);
    case "priority":
      return priorityRank[left.priority] - priorityRank[right.priority];
    case "projects":
      return left.projectBadges.map((project) => project.name).join(", ").localeCompare(right.projectBadges.map((project) => project.name).join(", "));
    case "updated":
    default: {
      const leftTimestamp = left.archivedAt ?? left.updatedAt;
      const rightTimestamp = right.archivedAt ?? right.updatedAt;
      return new Date(leftTimestamp).getTime() - new Date(rightTimestamp).getTime();
    }
  }
}

function sortTickets(
  tickets: TicketListItem[],
  sortField: TicketSortField | null,
  sortDirection: TicketSortDirection,
  statusOrder: Map<string, number>
) {
  if (!sortField) {
    return tickets;
  }

  const directionMultiplier = sortDirection === "asc" ? 1 : -1;

  return [...tickets].sort((left, right) => {
    const comparison = compareTicketValues(left, right, sortField, statusOrder);

    if (comparison !== 0) {
      return comparison * directionMultiplier;
    }

    return right.id - left.id;
  });
}

function ProjectChip({ project }: { project: Pick<Project, "name" | "color"> }) {
  return (
    <span
      className={`${chipClassName} border-white/10 text-ink-100`}
      style={{
        borderColor: `${project.color}66`,
        backgroundColor: `${project.color}1a`
      }}
      title={project.name}
    >
      {project.name}
    </span>
  );
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

function ColumnHeader(props: {
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

function FilterDropdown(props: {
  filters: TicketFilters;
  projects: Project[];
  statuses: Array<{ status: string; label: string }>;
  jiraIssues: string[];
  onUpdateFilters: (updater: (nextSearchParams: URLSearchParams) => void) => void;
  onClearFilters: () => void;
  hotkeySignal: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [section, setSection] = useState<FilterSection>("status");
  const [projectSearch, setProjectSearch] = useState("");
  const [jiraSearch, setJiraSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (props.hotkeySignal === 0) {
      return;
    }

    setIsOpen((current) => !current);
  }, [props.hotkeySignal]);

  const sectionButtonClassName = (current: FilterSection) =>
    `flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-sm ${
      section === current
        ? "bg-canvas-900 text-ink-50"
        : "text-ink-200 hover:bg-white/[0.03] hover:text-ink-50"
    }`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className={`${filterButtonClassName} ${hasFilters ? "border-accent-500/40 text-ink-50" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? titleId : undefined}
        onClick={() => {
          setIsOpen((current) => !current);
        }}
      >
        Filter
      </button>
      {isOpen ? (
        <div
          id={titleId}
          role="dialog"
          aria-label="Ticket filters"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-30 grid w-[min(52rem,calc(100vw-2.5rem))] grid-rows-[auto_1fr_auto] overflow-hidden rounded-[10px] border border-white/8 bg-canvas-925 shadow-[0_8px_24px_rgba(0,0,0,0.24)]"
        >
          <div className="grid min-h-[22rem] grid-cols-[13rem_minmax(0,1fr)]">
            <div className="border-r border-white/8 p-3">
              <div className="grid gap-1">
                <button type="button" className={sectionButtonClassName("status")} onClick={() => setSection("status")}>
                  Status
                </button>
                <button type="button" className={sectionButtonClassName("priority")} onClick={() => setSection("priority")}>
                  Priority
                </button>
                <button type="button" className={sectionButtonClassName("project")} onClick={() => setSection("project")}>
                  Project
                </button>
                <button type="button" className={sectionButtonClassName("jira")} onClick={() => setSection("jira")}>
                  Jira issue
                </button>
              </div>
            </div>
            <div className="p-4">
              {section === "status" ? (
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
              ) : null}
              {section === "priority" ? (
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
              ) : null}
              {section === "project" ? (
                <div className="grid gap-2">
                  <span className="text-sm font-medium text-ink-100">Project</span>
                  <input
                    className={inputClassName}
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
              ) : null}
              {section === "jira" ? (
                <div className="grid gap-2">
                  <span className="text-sm font-medium text-ink-100">Jira issue</span>
                  <input
                    className={inputClassName}
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
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-white/8 px-4 py-3">
            <button type="button" className="text-sm text-ink-200 hover:text-ink-50" onClick={props.onClearFilters}>
              Clear all
            </button>
            <div className="text-sm text-ink-300">Press Shift + F to open and close</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TicketsPage() {
  const { setActions, setRightActions, hasHost } = useAppHeader();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(() => parseTicketId(searchParams.get("ticketId")));
  const [editForm, setEditForm] = useState<TicketFormState>(createEmptyTicketForm());
  const [ticketSaveSuccessCount, setTicketSaveSuccessCount] = useState(0);
  const [filterHotkeySignal, setFilterHotkeySignal] = useState(0);
  const [dirtyWorktreesToConfirm, setDirtyWorktreesToConfirm] = useState<DirtyWorktreeDescriptor[]>([]);
  const [standupOnly, setStandupOnly] = useState(false);
  const [{ lastCompletedAt, standupWindowStart }, setStandupWindow] = useState(() => {
    const storedStandup = getStoredLastStandupCompletedAt();

    return {
      lastCompletedAt: storedStandup,
      standupWindowStart: storedStandup ?? getDefaultStandupWindowStart()
    };
  });
  const searchInputRef = useRef<HTMLInputElement>(null);

  const parsedFilters = parseTicketFilters(searchParams);
  const sortField = parseSortField(searchParams.get("sort"));
  const sortDirection = parseSortDirection(searchParams.get("dir"));
  const hasSavedStandup = lastCompletedAt !== null;
  const [searchInputValue, setSearchInputValue] = useState(parsedFilters.q ?? "");
  const deferredFilters = useDeferredValue({
    ...parsedFilters,
    q: searchInputValue.trim() || undefined
  });

  const boardColumnsQuery = useBoardColumnsQuery();
  const ticketsQuery = useTicketsQuery(deferredFilters);
  const activeBoardTicketsQuery = useTicketsQuery({ scope: "active" });
  const projectsQuery = useProjectsQuery();
  const selectedTicketQuery = useTicketQuery(selectedTicketId);
  const boardColumns = boardColumnsQuery.data?.columns ?? [];
  const statusOrder = useMemo(
    () => new Map(boardColumns.map((column, index) => [column.status, index])),
    [boardColumns]
  );

  useEffect(() => {
    document.title = "Tickets · Boroda";
  }, []);

  useEffect(() => {
    if (selectedTicketQuery.data) {
      setEditForm(toTicketForm(selectedTicketQuery.data));
    }
  }, [selectedTicketQuery.data]);

  useEffect(() => {
    const nextSelectedTicketId = parseTicketId(searchParams.get("ticketId"));
    setSelectedTicketId((current) => (current === nextSelectedTicketId ? current : nextSelectedTicketId));
  }, [searchParams]);

  useEffect(() => {
    setSearchInputValue((current) => (current === (parsedFilters.q ?? "") ? current : parsedFilters.q ?? ""));
  }, [parsedFilters.q]);

  useEffect(() => {
    const currentTicketId = parseTicketId(searchParams.get("ticketId"));

    if (currentTicketId === selectedTicketId) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);

    if (selectedTicketId === null) {
      nextSearchParams.delete("ticketId");
    } else {
      nextSearchParams.set("ticketId", String(selectedTicketId));
    }

    setSearchParams(nextSearchParams, { replace: true });
  }, [searchParams, selectedTicketId, setSearchParams]);

  const projects = projectsQuery.data ?? [];
  const sortedTickets = sortTickets(ticketsQuery.data ?? [], sortField, sortDirection, statusOrder);
  const tickets = standupOnly
    ? sortedTickets.filter((ticket) => wasUpdatedSinceStandup(ticket, standupWindowStart))
    : sortedTickets;
  const boardJiraIssues = useMemo(() => {
    const issueKeys = new Set<string>();

    for (const ticket of activeBoardTicketsQuery.data ?? []) {
      for (const jiraIssue of ticket.jiraIssues) {
        issueKeys.add(jiraIssue.key);
      }
    }

    return [...issueKeys].sort((left, right) => left.localeCompare(right));
  }, [activeBoardTicketsQuery.data]);
  const filtersApplied = hasTicketFilters(parsedFilters) || standupOnly;
  const statusFilterKey = parsedFilters.status?.join(",") ?? "";
  const priorityFilterKey = parsedFilters.priority?.join(",") ?? "";
  const projectFilterKey = parsedFilters.projectId?.join(",") ?? "";
  const jiraFilterKey = parsedFilters.jiraIssue?.join(",") ?? "";
  const boardJiraIssuesKey = boardJiraIssues.join(",");
  const projectOptionsKey = projects.map((project) => `${project.id}:${project.name}`).join("|");

  const updateTicketMutation = useUpdateTicketMutation({
    ticketId: selectedTicketId,
    boardFilters: EMPTY_BOARD_FILTERS,
    onUpdated: (ticket) => {
      setEditForm(ticket);
      setTicketSaveSuccessCount((current) => current + 1);
    }
  });

  const deleteTicketMutation = useDeleteTicketMutation({
    ticketId: selectedTicketId,
    boardFilters: EMPTY_BOARD_FILTERS,
    onDeleted: () => {
      setSelectedTicketId(null);
    },
    onReset: (form) => {
      setEditForm(form);
    }
  });
  const unarchiveTicketMutation = useUnarchiveTicketMutation({
    ticketId: selectedTicketId,
    boardFilters: EMPTY_BOARD_FILTERS,
    onRestored: () => {
      setSelectedTicketId(null);
    }
  });

  const openTicketInAppMutation = useOpenTicketInAppMutation(selectedTicketId);
  const refreshTicketJiraLinksMutation = useRefreshTicketJiraLinksMutation(selectedTicketId);

  const actionError =
    updateTicketMutation.error?.message ??
    deleteTicketMutation.error?.message ??
    unarchiveTicketMutation.error?.message ??
    refreshTicketJiraLinksMutation.error?.message;

  const handleKeyboardShortcuts = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented) {
      return;
    }

    if (!isTypingTarget(event.target) && event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      setFilterHotkeySignal((current) => current + 1);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();

      if (isSearchFocused(searchInputRef)) {
        searchInputRef.current?.blur();
        return;
      }

      searchInputRef.current?.focus();
      searchInputRef.current?.select();
      return;
    }

    if (event.key === "Escape" && isSearchFocused(searchInputRef)) {
      event.preventDefault();
      searchInputRef.current?.blur();
      return;
    }

    if (isTypingTarget(event.target)) {
      return;
    }

    if (event.key === "/") {
      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
      return;
    }

    if (event.key === "Escape" && selectedTicketId !== null) {
      event.preventDefault();
      setSelectedTicketId(null);
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboardShortcuts);
    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcuts);
    };
  }, []);

  const updateFilters = (updater: (nextSearchParams: URLSearchParams) => void) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    updater(nextSearchParams);
    setSearchParams(nextSearchParams, { replace: true });
  };

  const clearFilters = () => {
    updateFilters((nextSearchParams) => {
      nextSearchParams.delete("q");
      nextSearchParams.delete("status");
      nextSearchParams.delete("projectId");
      nextSearchParams.delete("priority");
      nextSearchParams.delete("jiraIssue");
      nextSearchParams.delete("scope");
    });
    setStandupOnly(false);
    setSearchInputValue("");
  };

  const handleSort = (field: TicketSortField) => {
    updateFilters((nextSearchParams) => {
      if (sortField !== field) {
        nextSearchParams.set("sort", field);
        nextSearchParams.set("dir", "asc");
        return;
      }

      if (sortDirection === "asc") {
        nextSearchParams.set("sort", field);
        nextSearchParams.set("dir", "desc");
        return;
      }

      nextSearchParams.delete("sort");
      nextSearchParams.delete("dir");
    });
  };

  const handleMarkStandupDone = useEffectEvent(() => {
    const completedAt = new Date().toISOString();
    setStoredLastStandupCompletedAt(completedAt);
    setStandupWindow({
      lastCompletedAt: completedAt,
      standupWindowStart: completedAt
    });
  });

  const renderSearchControl = () => (
    <label className="min-w-0 flex-1 basis-[18rem] max-w-[32rem]">
      <span className="sr-only">Search</span>
      <input
        ref={searchInputRef}
        type="search"
        inputMode="search"
        name="ticketSearch"
        autoComplete="off"
        spellCheck={false}
        className={`${inputClassName} w-[18rem] transition-[width] duration-200 ease-out focus:w-[32rem] motion-reduce:transition-none`}
        placeholder="Search…"
        value={searchInputValue}
        onChange={(event) => {
          const value = event.target.value;
          setSearchInputValue(value);
          updateFilters((nextSearchParams) => {
            updateSearchParam(nextSearchParams, "q", value.trim() || undefined);
          });
        }}
      />
    </label>
  );

  useEffect(() => {
    setActions(
      hasHost ? (
        <>
          {renderSearchControl()}
          <FilterDropdown
            filters={parsedFilters}
            projects={projects}
            statuses={boardColumns}
            jiraIssues={boardJiraIssues}
            onUpdateFilters={updateFilters}
            onClearFilters={clearFilters}
            hotkeySignal={filterHotkeySignal}
          />
        </>
      ) : null
    );
    setRightActions(
      <>
        <button type="button" className={primaryButtonClassName} onClick={handleMarkStandupDone}>
          Standup done
        </button>
        <Link to="/settings" className={secondaryButtonClassName}>
          Settings
        </Link>
      </>
    );

    return () => {
      setActions(null);
      setRightActions(null);
    };
  }, [
    boardJiraIssuesKey,
    filterHotkeySignal,
    hasHost,
    jiraFilterKey,
    parsedFilters.q,
    parsedFilters.scope,
    priorityFilterKey,
    projectFilterKey,
    projectOptionsKey,
    searchInputValue,
    setActions,
    setRightActions,
    statusFilterKey
  ]);

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/8 pb-3">
        <div className="grid gap-1">
          <h1 className="m-0 text-base font-semibold text-ink-50">Tickets</h1>
          <p className="m-0 text-sm text-ink-300">
            {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"} in {scopeLabel(parsedFilters.scope ?? "active").toLowerCase()}
          </p>
          {standupOnly ? <p className="m-0 text-sm text-ink-200">{formatStandupWindowLabel(standupWindowStart, hasSavedStandup)}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Ticket scope">
          {(["active", "archived", "all"] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              role="tab"
              aria-selected={(parsedFilters.scope ?? "active") === scope}
              className={(parsedFilters.scope ?? "active") === scope ? primaryButtonClassName : secondaryButtonClassName}
              onClick={() => {
                updateFilters((nextSearchParams) => {
                  updateSearchParam(nextSearchParams, "scope", scope, "active");
                });
              }}
            >
              {scopeLabel(scope)}
            </button>
          ))}
          {filtersApplied ? (
            <button type="button" className={secondaryButtonClassName} onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
          <button
            type="button"
            className={standupOnly ? primaryButtonClassName : secondaryButtonClassName}
            aria-pressed={standupOnly}
            onClick={() => {
              setStandupOnly((current) => !current);
            }}
          >
            For standup
          </button>
        </div>
      </div>

      {actionError ? (
        <p className={`${softPanelClassName} m-0 text-sm text-danger-400`} role="alert">
          {actionError}
        </p>
      ) : null}

      {!hasHost ? (
        <section className={`${softPanelClassName} grid-cols-[minmax(0,1fr)_auto] items-center gap-3`}>
          {renderSearchControl()}
          <FilterDropdown
            filters={parsedFilters}
            projects={projects}
            statuses={boardColumns}
            jiraIssues={boardJiraIssues}
            onUpdateFilters={updateFilters}
            onClearFilters={clearFilters}
            hotkeySignal={filterHotkeySignal}
          />
        </section>
      ) : null}

      {ticketsQuery.isLoading && ticketsQuery.data === undefined ? (
        <p className={`${softPanelClassName} m-0 text-sm text-ink-50`}>Loading tickets…</p>
      ) : null}
      {ticketsQuery.isError ? (
        <section className={`${panelClassName} h-full content-start`} aria-live="polite">
          <h2 className="m-0 text-lg font-semibold text-ink-50">Tickets request failed</h2>
          <p className="m-0 max-w-[48rem] text-sm text-ink-200">
            The ticket list could not be loaded. Retry the request or inspect the local API logs.
          </p>
          <div className="flex flex-wrap gap-3">
            <button className={primaryButtonClassName} type="button" onClick={() => void ticketsQuery.refetch()}>
              Retry tickets
            </button>
          </div>
        </section>
      ) : null}

      {!ticketsQuery.isLoading && !ticketsQuery.isError && tickets.length === 0 ? (
        <section className={`${panelClassName} h-full content-start`} aria-live="polite">
          <h2 className="m-0 text-lg font-semibold text-ink-50">
            {filtersApplied ? "No tickets match these filters" : "No tickets available"}
          </h2>
          <p className="m-0 max-w-[44rem] text-sm text-ink-200">
            {filtersApplied
              ? "Clear the current filters or switch scope to review a different slice of work."
              : "Create a ticket from the board or import your local sample data to populate the list."}
          </p>
          {filtersApplied ? (
            <div className="flex flex-wrap gap-3">
              <button type="button" className={secondaryButtonClassName} onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {!ticketsQuery.isLoading && !ticketsQuery.isError && tickets.length > 0 ? (
        <section className={`${listClassName} min-h-0 min-w-0 flex-1 overflow-auto`}>
          <div className="grid min-w-[72rem] grid-cols-[minmax(0,2.3fr)_minmax(0,1.1fr)_10rem_9rem_minmax(0,1.6fr)_10rem] gap-3 border-b border-white/8 px-4 py-3 text-xs text-ink-300">
            <ColumnHeader
              label="Ticket"
              sortField="ticket"
              currentSortField={sortField}
              currentSortDirection={sortDirection}
              onSort={handleSort}
            />
            <ColumnHeader
              label="Jira"
              sortField="jira"
              currentSortField={sortField}
              currentSortDirection={sortDirection}
              onSort={handleSort}
            />
            <ColumnHeader
              label="Status"
              sortField="status"
              currentSortField={sortField}
              currentSortDirection={sortDirection}
              onSort={handleSort}
            />
            <ColumnHeader
              label="Priority"
              sortField="priority"
              currentSortField={sortField}
              currentSortDirection={sortDirection}
              onSort={handleSort}
            />
            <ColumnHeader
              label="Projects"
              sortField="projects"
              currentSortField={sortField}
              currentSortDirection={sortDirection}
              onSort={handleSort}
            />
            <ColumnHeader
              label="Last change"
              sortField="updated"
              currentSortField={sortField}
              currentSortDirection={sortDirection}
              onSort={handleSort}
            />
          </div>
          <ul className="m-0 min-w-[72rem] list-none p-0">
            {tickets.map((ticket) => {
              const selected = ticket.id === selectedTicketId;

              return (
                <li key={ticket.id} className="border-t border-white/8 first:border-t-0">
                  <button
                    type="button"
                    className={`grid w-full min-w-[72rem] grid-cols-[minmax(0,2.3fr)_minmax(0,1.1fr)_10rem_9rem_minmax(0,1.6fr)_10rem] gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink-50 ${selected ? "bg-white/[0.03]" : ""}`}
                    aria-pressed={selected}
                    aria-label={`Open ticket ${ticket.key} ${ticket.title}`}
                    onClick={() => {
                      setSelectedTicketId(ticket.id);
                    }}
                  >
                    <div className="min-w-0 grid gap-1">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="shrink-0 font-mono text-sm tabular-nums text-ink-200">{ticket.key}</span>
                        <span className="truncate text-sm font-medium text-ink-50">{ticket.title}</span>
                      </div>
                      <div className="text-xs text-ink-300">{ticket.archivedAt ? "Archived ticket" : "Current ticket"}</div>
                    </div>
                    <div className="min-w-0 text-sm text-ink-200">
                      <span className="block truncate">
                        {ticket.jiraIssues.length
                          ? ticket.jiraIssues.map((issue) => issue.key).join(", ")
                          : "No Jira links"}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className={`${chipClassName} border-white/10 text-ink-200`}>
                        {boardColumns.find((column) => column.status === ticket.status)?.label ?? formatStatusLabel(ticket.status)}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className={`${chipClassName} border-white/10 text-ink-200`}>{ticket.priority}</span>
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-2">
                      {ticket.projectBadges.length ? (
                        ticket.projectBadges.map((project) => <ProjectChip key={project.id} project={project} />)
                      ) : (
                        <span className="text-sm text-ink-300">No projects</span>
                      )}
                    </div>
                    <div className="text-sm text-ink-300">{formatLastChange(ticket)}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <TicketDrawer
        ticketId={selectedTicketId}
        ticket={selectedTicketQuery.data}
        statuses={boardColumns}
        isLoading={selectedTicketQuery.isLoading}
        isError={selectedTicketQuery.isError}
        form={editForm}
        projects={projects}
        isSaving={updateTicketMutation.isPending}
        saveSuccessCount={ticketSaveSuccessCount}
        isArchiving={deleteTicketMutation.isPending}
        isRestoring={unarchiveTicketMutation.isPending}
        isOpeningInApp={openTicketInAppMutation.isPending}
        isRefreshingJira={refreshTicketJiraLinksMutation.isPending}
        onChange={(updater) => {
          setEditForm((current) => updater(current));
        }}
        onSave={() => {
          updateTicketMutation.mutate(toTicketPayload(editForm));
        }}
        onArchive={() => {
          void (async () => {
            try {
              await deleteTicketMutation.mutateAsync(undefined);
            } catch (error) {
              if (!(error instanceof ApiError) || error.code !== "TICKET_ARCHIVE_DIRTY_WORKTREES") {
                return;
              }

              const dirtyWorktrees = extractDirtyWorktrees(error.details);
              if (!dirtyWorktrees.length) {
                return;
              }

              setDirtyWorktreesToConfirm(dirtyWorktrees);
            }
          })();
        }}
        onRestore={() => {
          unarchiveTicketMutation.mutate();
        }}
        onOpenInApp={async (target, mode, folderId, workspaceId) => {
          const runSetup = getStoredAutoRunWorktreeSetup();
          await openTicketInAppMutation.mutateAsync(
            folderId === undefined
              ? { target, mode, runSetup }
              : workspaceId === undefined
                ? { target, mode, folderId, runSetup }
                : { target, mode, folderId, workspaceId, runSetup }
          );
        }}
        onRefreshJira={() => {
          refreshTicketJiraLinksMutation.mutate();
        }}
        onClose={() => {
          setSelectedTicketId(null);
        }}
      />

      <ArchiveWorktreeDialog
        open={dirtyWorktreesToConfirm.length > 0}
        worktrees={dirtyWorktreesToConfirm}
        isDeleting={deleteTicketMutation.isPending}
        onCancel={() => {
          if (deleteTicketMutation.isPending) {
            return;
          }

          setDirtyWorktreesToConfirm([]);
        }}
        onConfirm={() => {
          void (async () => {
            await deleteTicketMutation.mutateAsync({ force: true });
            setDirtyWorktreesToConfirm([]);
          })();
        }}
      />
    </section>
  );
}
