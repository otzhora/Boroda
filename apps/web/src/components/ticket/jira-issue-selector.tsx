import { useId, useMemo, useState, type KeyboardEvent } from "react";
import type { TicketJiraIssueFormState } from "../../features/tickets/form";
import { useAssignedJiraIssuesQuery, useJiraSettingsQuery } from "../../features/jira/queries";

interface JiraIssueSelectorProps {
  value: TicketJiraIssueFormState[];
  onChange: (jiraIssues: TicketJiraIssueFormState[]) => void;
}

const inputClassName =
  "min-h-11 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-ink-50 placeholder:text-ink-300";
const secondaryButtonClassName =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-white/[0.05] disabled:cursor-progress disabled:opacity-70";

function normalizeJiraIssueKey(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function isJiraIssueKey(value: string) {
  return /^[A-Z][A-Z0-9_]*-\d+$/.test(value);
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function JiraIssueSelector({ value, onChange }: JiraIssueSelectorProps) {
  const inputId = useId();
  const helpId = useId();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const assignedIssuesQuery = useAssignedJiraIssuesQuery();
  const jiraSettingsQuery = useJiraSettingsQuery();
  const baseUrl = jiraSettingsQuery.data?.baseUrl ? trimTrailingSlash(jiraSettingsQuery.data.baseUrl) : "";
  const normalizedQuery = normalizeJiraIssueKey(query);
  const selectedKeys = new Set(value.map((issue) => normalizeJiraIssueKey(issue.key)));
  const filteredIssues = useMemo(() => {
    const search = query.trim().toLowerCase();

    return (assignedIssuesQuery.data?.issues ?? []).filter((issue) => {
      if (selectedKeys.has(normalizeJiraIssueKey(issue.key))) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack = `${issue.key} ${issue.summary}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [assignedIssuesQuery.data?.issues, query, selectedKeys]);
  const manualIssueKey =
    normalizedQuery && isJiraIssueKey(normalizedQuery) && !selectedKeys.has(normalizedQuery)
      ? normalizedQuery
      : null;

  function handleAddIssue(nextIssue: TicketJiraIssueFormState) {
    const key = normalizeJiraIssueKey(nextIssue.key);

    if (!key || selectedKeys.has(key)) {
      return;
    }

    onChange([
      ...value,
      {
        key,
        summary: nextIssue.summary.trim()
      }
    ]);
    setQuery("");
  }

  function handleRemoveIssue(issueKey: string) {
    const normalizedKey = normalizeJiraIssueKey(issueKey);
    onChange(value.filter((issue) => normalizeJiraIssueKey(issue.key) !== normalizedKey));
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    if (filteredIssues.length > 0) {
      event.preventDefault();
      handleAddIssue({
        key: filteredIssues[0].key,
        summary: filteredIssues[0].summary
      });
      return;
    }

    if (manualIssueKey) {
      event.preventDefault();
      handleAddIssue({
        key: manualIssueKey,
        summary: ""
      });
    }
  }

  return (
    <div className="grid gap-3">
      {value.length ? (
        <div className="flex flex-wrap gap-2">
          {value.map((issue) => {
            const href = baseUrl ? `${baseUrl}/browse/${issue.key}` : null;

            return (
              <div
                key={issue.key}
                className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2"
              >
                <div className="min-w-0">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-ink-50 no-underline hover:text-white"
                    >
                      {issue.key}
                    </a>
                  ) : (
                    <span className="text-sm font-semibold text-ink-50">{issue.key}</span>
                  )}
                  {issue.summary ? (
                    <p className="m-0 min-w-0 max-w-[24rem] truncate text-sm text-ink-200">{issue.summary}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() => {
                    handleRemoveIssue(issue.key);
                  }}
                  aria-label={`Remove Jira issue ${issue.key}`}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="m-0 text-sm text-ink-300">No Jira issues linked yet.</p>
      )}

      <div className="grid gap-2">
        <input
          id={inputId}
          className={inputClassName}
          type="text"
          inputMode="text"
          placeholder="Search assigned issues by key or summary…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          onKeyDown={handleInputKeyDown}
          aria-describedby={helpId}
          aria-controls={listboxId}
        />
        <p id={helpId} className="m-0 text-sm text-ink-300">
          Search your assigned Jira issues. Press Enter to add the top match, or paste a key like PROJ-123.
        </p>
      </div>

      <div
        id={listboxId}
        className="grid max-h-64 gap-0 overflow-y-auto rounded-xl border border-white/8 bg-black/15"
        role="listbox"
        aria-label="Available Jira issues"
      >
        {manualIssueKey ? (
          <button
            type="button"
            role="option"
            className="grid gap-1 border-b border-white/8 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
            onClick={() => {
              handleAddIssue({
                key: manualIssueKey,
                summary: ""
              });
            }}
          >
            <span className="text-sm font-semibold text-ink-50">{manualIssueKey}</span>
            <span className="text-sm text-ink-200">Attach manual Jira key</span>
          </button>
        ) : null}

        {assignedIssuesQuery.isLoading ? (
          <p className="m-0 px-3 py-2 text-sm text-ink-200">Loading assigned issues…</p>
        ) : assignedIssuesQuery.error ? (
          <p className="m-0 px-3 py-2 text-sm text-danger-400" role="alert">
            {assignedIssuesQuery.error.message}
          </p>
        ) : filteredIssues.length ? (
          filteredIssues.slice(0, 10).map((issue, index) => (
            <button
              key={issue.key}
              type="button"
              role="option"
              className={`grid gap-1 px-3 py-2 text-left transition-colors hover:bg-white/[0.04] ${
                index === 0 && !manualIssueKey ? "" : "border-t border-white/8"
              }`}
              onClick={() => {
                handleAddIssue({
                  key: issue.key,
                  summary: issue.summary
                });
              }}
            >
              <span className="text-sm font-semibold text-ink-50">{issue.key}</span>
              <span className="min-w-0 break-words text-sm text-ink-200">{issue.summary}</span>
            </button>
          ))
        ) : (
          <p className="m-0 px-3 py-2 text-sm text-ink-200">
            {assignedIssuesQuery.data?.issues?.length
              ? "No assigned Jira issues match this search."
              : "No assigned Jira issues found."}
          </p>
        )}
      </div>
    </div>
  );
}
