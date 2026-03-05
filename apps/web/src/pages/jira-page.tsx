import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAppHeader } from "../app/router";
import { useAssignedJiraIssueLinksQuery, useJiraSettingsQuery } from "../features/jira/queries";
import { useProjectsQuery } from "../features/projects/queries";
import { useCreateTicketMutation } from "../features/tickets/mutations";
import {
  createEmptyQuickTicketForm,
  QuickTicketForm,
  type QuickTicketFormState
} from "../components/board/quick-ticket-form";
import { ModalDialog } from "../components/ui/modal-dialog";

const headerActionButtonClassName =
  "inline-flex min-h-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-white/[0.06]";
const topBarButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-white/[0.06] disabled:cursor-progress disabled:opacity-70";
const createButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-white/10 bg-ink-50 px-3 py-2 text-sm font-medium text-canvas-975 transition-colors hover:bg-white disabled:cursor-progress disabled:opacity-70";
const ticketLinkClassName =
  "group flex min-h-11 min-w-0 items-center justify-between gap-3 border-t border-white/8 px-3 py-2 transition-colors hover:bg-white/[0.03]";
const spinnerClassName = "h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent";
const summaryNumberClassName = "text-lg font-semibold text-ink-50 tabular-nums";
const emptyPanelClassName = "border border-white/8 bg-canvas-900/96 px-4 py-4";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function createLinkedQuickTicketForm(issue: { key: string; summary: string }): QuickTicketFormState {
  return {
    ...createEmptyQuickTicketForm(),
    title: issue.summary.trim() || issue.key.trim()
  };
}

function toQuickCreatePayload(issue: { key: string; summary: string }, form: QuickTicketFormState) {
  const summary = issue.summary.trim();

  return {
    title: form.title.trim(),
    description: "",
    branch: null,
    jiraIssues: [
      {
        key: issue.key.trim().toUpperCase(),
        summary
      }
    ],
    status: form.status,
    priority: form.priority,
    dueAt: null,
    projectLinks: form.projectId
      ? [{ projectId: Number(form.projectId), relationship: "PRIMARY" as const }]
      : []
  };
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Updated recently";
  }

  return `Updated ${dateTimeFormatter.format(date)}`;
}

export function JiraPage() {
  const { setActions } = useAppHeader();
  const settingsQuery = useJiraSettingsQuery();
  const issuesQuery = useAssignedJiraIssueLinksQuery();
  const projectsQuery = useProjectsQuery();
  const [issueToCreateFrom, setIssueToCreateFrom] = useState<{ key: string; summary: string } | null>(null);
  const [quickCreateForm, setQuickCreateForm] = useState<QuickTicketFormState>(createEmptyQuickTicketForm());
  const quickCreateTitleRef = useRef<HTMLInputElement>(null);
  const createTicketMutation = useCreateTicketMutation({
    boardFilters: {},
    onCreated: () => {
      setIssueToCreateFrom(null);
    },
    onReset: () => {
      setQuickCreateForm(createEmptyQuickTicketForm());
    }
  });

  useEffect(() => {
    document.title = "Jira · Boroda";
  }, []);

  useEffect(() => {
    setActions(
      <Link to="/settings" className={headerActionButtonClassName}>
        Settings
      </Link>
    );

    return () => {
      setActions(null);
    };
  }, [setActions]);

  const baseUrl = settingsQuery.data?.baseUrl ? trimTrailingSlash(settingsQuery.data.baseUrl) : "";
  const payload = issuesQuery.data;
  const issues = payload?.issues ?? [];
  const projects = projectsQuery.data ?? [];

  const openQuickCreate = (issue: { key: string; summary: string }) => {
    setIssueToCreateFrom(issue);
    setQuickCreateForm(createLinkedQuickTicketForm(issue));
  };

  return (
    <section className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-3">
      <div className="flex min-h-12 flex-wrap items-end justify-between gap-3 border-b border-white/8 pb-3">
        <div className="min-w-0">
          <h1 className="m-0 text-base font-semibold text-ink-50">Assigned Jira issues</h1>
          <p className="m-0 mt-1 text-sm text-ink-200">Jira stays primary. Boroda links sit beside each issue.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={topBarButtonClassName}
            onClick={() => {
              void issuesQuery.refetch();
            }}
            disabled={issuesQuery.isFetching}
          >
            {issuesQuery.isFetching ? <span className={spinnerClassName} aria-hidden="true" /> : null}
            <span>{issuesQuery.isFetching ? "Refreshing…" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {issuesQuery.error ? (
        <p className="m-0 border border-red-400/24 bg-red-950/32 px-3 py-2 text-sm text-red-100" role="alert">
          {issuesQuery.error.message}
        </p>
      ) : null}

      {createTicketMutation.error ? (
        <p className="m-0 border border-red-400/24 bg-red-950/32 px-3 py-2 text-sm text-red-100" role="alert">
          {createTicketMutation.error.message}
        </p>
      ) : null}

      <section className="grid gap-px border border-white/8 bg-white/8 md:grid-cols-3" aria-label="Jira issue summary">
        <div className="bg-canvas-900/96 px-4 py-3">
          <p className="m-0 text-[0.75rem] font-medium uppercase tracking-[0.14em] text-ink-300">Total</p>
          <p className={`${summaryNumberClassName} m-0 mt-1`}>
            {issuesQuery.isLoading && !payload ? "…" : payload?.total ?? 0}
          </p>
        </div>
        <div className="bg-canvas-900/96 px-4 py-3">
          <p className="m-0 text-[0.75rem] font-medium uppercase tracking-[0.14em] text-ink-300">Linked</p>
          <p className={`${summaryNumberClassName} m-0 mt-1`}>
            {issuesQuery.isLoading && !payload ? "…" : payload?.linked ?? 0}
          </p>
        </div>
        <div className="bg-canvas-900/96 px-4 py-3">
          <p className="m-0 text-[0.75rem] font-medium uppercase tracking-[0.14em] text-ink-300">Needs Boroda</p>
          <p className={`${summaryNumberClassName} m-0 mt-1`}>
            {issuesQuery.isLoading && !payload ? "…" : payload?.unlinked ?? 0}
          </p>
        </div>
      </section>

      {issuesQuery.isLoading && !payload ? (
        <p className={`${emptyPanelClassName} m-0 text-sm text-ink-200`}>Loading assigned issues…</p>
      ) : null}

      {!issuesQuery.isLoading && issues.length === 0 ? (
        <p className={`${emptyPanelClassName} m-0 text-sm text-ink-200`}>No assigned Jira issues found.</p>
      ) : null}

      {issues.length > 0 ? (
        <section className="border border-white/8 bg-canvas-900/96">
          <div className="hidden gap-px border-b border-white/8 bg-white/8 md:grid md:grid-cols-[minmax(0,1.45fr)_minmax(18rem,1fr)]">
            <div className="bg-canvas-900/96 px-4 py-2 text-[0.75rem] font-medium uppercase tracking-[0.14em] text-ink-300">
              Jira
            </div>
            <div className="bg-canvas-900/96 px-4 py-2 text-[0.75rem] font-medium uppercase tracking-[0.14em] text-ink-300">
              Boroda
            </div>
          </div>

          <ul className="m-0 list-none p-0">
            {issues.map((issue, index) => {
              const jiraHref = baseUrl ? `${baseUrl}/browse/${issue.key}` : null;

              return (
                <li
                  key={issue.key}
                  className={`${index === 0 ? "border-t-0" : "border-t border-white/8"} grid min-w-0 md:grid-cols-[minmax(0,1.45fr)_minmax(18rem,1fr)]`}
                >
                  <div className="min-w-0 px-4 py-3 md:border-r md:border-white/8">
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          {jiraHref ? (
                            <a
                              href={jiraHref}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex min-h-7 items-center rounded-[8px] border border-white/10 bg-white/[0.04] px-2 py-1 text-[0.8rem] font-semibold text-ink-50 transition-colors hover:border-white/16 hover:bg-white/[0.08]"
                              aria-label={`Open Jira issue ${issue.key}`}
                            >
                              {issue.key}
                            </a>
                          ) : (
                            <span className="inline-flex min-h-7 items-center rounded-[8px] border border-white/10 bg-white/[0.04] px-2 py-1 text-[0.8rem] font-semibold text-ink-50">
                              {issue.key}
                            </span>
                          )}
                          <span
                            className={`inline-flex min-h-7 items-center rounded-[8px] border px-2 py-1 text-[0.76rem] font-medium ${
                              issue.borodaTickets.length > 0
                                ? "border-white/10 bg-white/[0.04] text-ink-200"
                                : "border-white/12 bg-white/[0.02] text-ink-300"
                            }`}
                          >
                            {issue.borodaTickets.length > 0
                              ? issue.borodaTickets.length === 1
                                ? "1 Boroda ticket"
                                : `${issue.borodaTickets.length} Boroda tickets`
                              : "No Boroda ticket"}
                          </span>
                        </div>
                        <p className="m-0 mt-2 break-words text-sm leading-6 text-ink-50">{issue.summary}</p>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 px-4 py-3">
                    <div className="grid gap-3 border border-white/8 bg-white/[0.02] p-3">
                      <div className="flex min-h-11 flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="m-0 text-[0.75rem] font-medium uppercase tracking-[0.14em] text-ink-300">
                            Boroda tickets for
                          </p>
                          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                            <span className="inline-flex min-h-7 items-center rounded-[8px] border border-white/10 bg-white/[0.04] px-2 py-1 text-[0.8rem] font-semibold text-ink-50">
                              {issue.key}
                            </span>
                            <span className="text-sm text-ink-300">
                              {issue.borodaTickets.length > 0
                                ? issue.borodaTickets.length === 1
                                  ? "1 linked ticket"
                                  : `${issue.borodaTickets.length} linked tickets`
                                : "No linked tickets yet"}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={issue.borodaTickets.length > 0 ? topBarButtonClassName : createButtonClassName}
                          disabled={createTicketMutation.isPending}
                          onClick={() => {
                            openQuickCreate(issue);
                          }}
                        >
                          <span>{issue.borodaTickets.length > 0 ? "New linked" : "Create linked"}</span>
                        </button>
                      </div>

                      {issue.borodaTickets.length > 0 ? (
                        <div className="min-w-0 border border-white/8 bg-canvas-950/48">
                          <ul className="m-0 list-none p-0">
                            {issue.borodaTickets.map((ticket) => (
                              <li key={ticket.id}>
                                <Link
                                  to={`/?ticketId=${ticket.id}`}
                                  className={ticketLinkClassName}
                                  aria-label={`Open Boroda ticket ${ticket.key}`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                      <span className="text-sm font-semibold text-ink-50">{ticket.key}</span>
                                      <span className="rounded-[6px] border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[0.72rem] font-medium uppercase tracking-[0.08em] text-ink-200">
                                        {ticket.status.replace(/_/g, " ")}
                                      </span>
                                    </div>
                                    <p className="m-0 mt-1 truncate text-sm text-ink-100">{ticket.title}</p>
                                  </div>
                                  <span className="shrink-0 text-xs text-ink-300">{formatUpdatedAt(ticket.updatedAt)}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="border border-dashed border-white/10 bg-canvas-950/32 px-3 py-3">
                          <p className="m-0 min-w-0 text-sm text-ink-300">
                            Create the first Boroda ticket linked to <span className="font-medium text-ink-100">{issue.key}</span>.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <ModalDialog
        open={issueToCreateFrom !== null}
        title="Create linked ticket"
        onClose={() => {
          setIssueToCreateFrom(null);
        }}
        initialFocusRef={quickCreateTitleRef}
        variant="flat"
        showHeader={false}
        showCloseButton={false}
      >
        <div className="border-b border-white/8 px-3 py-3 sm:px-4 sm:py-4">
          <p className="m-0 text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-ink-300">Linked Jira issue</p>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex min-h-7 items-center rounded-[8px] border border-white/10 bg-white/[0.04] px-2 py-1 text-[0.8rem] font-semibold text-ink-50">
              {issueToCreateFrom?.key}
            </span>
            <p className="m-0 min-w-0 break-words text-sm text-ink-100">{issueToCreateFrom?.summary}</p>
          </div>
        </div>
        <QuickTicketForm
          form={quickCreateForm}
          projects={projects}
          isSubmitting={createTicketMutation.isPending}
          submitLabel="Create linked ticket"
          submittingLabel="Creating linked ticket…"
          titleInputRef={quickCreateTitleRef}
          onChange={(updater) => {
            setQuickCreateForm((current) => updater(current));
          }}
          onSubmit={() => {
            if (!issueToCreateFrom) {
              return;
            }

            createTicketMutation.mutate(toQuickCreatePayload(issueToCreateFrom, quickCreateForm));
          }}
          onCancel={() => {
            setIssueToCreateFrom(null);
          }}
        />
      </ModalDialog>
    </section>
  );
}
