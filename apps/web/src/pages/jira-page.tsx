import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppHeader } from "../app/router";
import { useAssignedJiraIssuesQuery, useJiraSettingsQuery } from "../features/jira/queries";

const panelClassName = "min-w-0 overflow-hidden border border-white/8 bg-canvas-900/96";
const headerActionButtonClassName =
  "inline-flex min-h-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-white/[0.06]";
const refreshButtonClassName =
  "inline-flex min-h-9 items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-white/[0.06] disabled:cursor-progress disabled:opacity-70";
const spinnerClassName = "h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function JiraPage() {
  const { setActions } = useAppHeader();
  const settingsQuery = useJiraSettingsQuery();
  const issuesQuery = useAssignedJiraIssuesQuery();

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
  const issues = issuesQuery.data?.issues ?? [];

  return (
    <section className="mx-auto grid w-full min-w-0 max-w-3xl content-start gap-2">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-2">
        <h1 className="m-0 text-sm font-semibold text-ink-50">Assigned Jira issues</h1>
        <div className="flex items-center gap-2">
          {issuesQuery.data ? <span className="text-xs text-ink-200">{issuesQuery.data.total}</span> : null}
          <button
            type="button"
            className={refreshButtonClassName}
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

      <div className={panelClassName}>
        {issuesQuery.isLoading ? (
          <p className="m-0 px-3 py-2 text-sm text-ink-200">Loading assigned issues…</p>
        ) : issues.length === 0 ? (
          <p className="m-0 px-3 py-2 text-sm text-ink-200">No assigned issues found.</p>
        ) : (
          <ul className="m-0 grid list-none p-0">
            {issues.map((issue, index) => (
              <li key={issue.key} className={index === 0 ? "border-t-0" : "border-t border-white/8"}>
                {baseUrl ? (
                  <a
                    href={`${baseUrl}/browse/${issue.key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="grid gap-0.5 px-3 py-2 no-underline transition-colors hover:bg-white/[0.03]"
                  >
                    <span className="text-sm font-semibold text-ink-50">{issue.key}</span>
                    <span className="min-w-0 break-words text-sm text-ink-100">{issue.summary}</span>
                  </a>
                ) : (
                  <div className="grid gap-0.5 px-3 py-2">
                    <span className="text-sm font-semibold text-ink-50">{issue.key}</span>
                    <span className="min-w-0 break-words text-sm text-ink-100">{issue.summary}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
