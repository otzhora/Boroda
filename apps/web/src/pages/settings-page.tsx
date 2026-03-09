import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  useJiraSettingsQuery,
  useUpdateJiraSettingsMutation,
  type UpdateJiraSettingsPayload
} from "../features/jira/queries";
import { apiClient, apiClientBlob } from "../lib/api-client";
import {
  getStoredAutoRunWorktreeSetup,
  getStoredDefaultOpenInMode,
  setStoredAutoRunWorktreeSetup,
  setStoredDefaultOpenInMode
} from "../lib/user-preferences";
import type { OpenInMode } from "../lib/types";

const railClassName = "lg:sticky lg:top-20 lg:self-start";
const navLinkClassName =
  "block min-h-10 border-l-2 border-transparent px-3 py-2 text-sm text-ink-200 transition-colors hover:border-white/18 hover:bg-white/[0.03] hover:text-ink-50";
const sectionHeaderClassName = "m-0 text-xs font-semibold uppercase tracking-[0.12em] text-ink-200";
const buttonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.02] px-3 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-white/[0.05] disabled:cursor-progress disabled:opacity-70";
const spinnerClassName = "h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent";
const fieldClassName = "grid gap-1.5";
const inputClassName =
  "min-h-10 rounded-[10px] border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-ink-50 placeholder:text-ink-300";
const helperTextClassName = "m-0 text-xs text-ink-200";

interface JiraSettingsFormState {
  baseUrl: string;
  email: string;
  apiToken: string;
}

interface GeneralSettingsFormState {
  defaultOpenInMode: OpenInMode;
  autoRunWorktreeSetup: boolean;
}

function createEmptyJiraSettingsFormState(): JiraSettingsFormState {
  return {
    baseUrl: "",
    email: "",
    apiToken: ""
  };
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSavingGeneralSettings, setIsSavingGeneralSettings] = useState(false);
  const [jiraForm, setJiraForm] = useState<JiraSettingsFormState>(createEmptyJiraSettingsFormState());
  const [generalForm, setGeneralForm] = useState<GeneralSettingsFormState>(() => ({
    defaultOpenInMode: getStoredDefaultOpenInMode(),
    autoRunWorktreeSetup: getStoredAutoRunWorktreeSetup()
  }));
  const [generalSettingsStatus, setGeneralSettingsStatus] = useState<string | null>(null);

  const jiraSettingsQuery = useJiraSettingsQuery();
  const updateJiraSettingsMutation = useUpdateJiraSettingsMutation();

  useEffect(() => {
    document.title = "Settings · Boroda";
  }, []);

  useEffect(() => {
    if (!jiraSettingsQuery.data) {
      return;
    }

    setJiraForm((current) => ({
      baseUrl: current.baseUrl || jiraSettingsQuery.data.baseUrl,
      email: current.email || jiraSettingsQuery.data.email,
      apiToken: ""
    }));
  }, [jiraSettingsQuery.data]);

  const exportBoardData = useEffectEvent(async () => {
    setIsExporting(true);

    try {
      const blob = await apiClientBlob("/api/export");
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const dateStamp = new Date().toISOString().slice(0, 10);

      anchor.href = downloadUrl;
      anchor.download = `boroda-export-${dateStamp}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
    } finally {
      setIsExporting(false);
    }
  });

  const importBoardData = useEffectEvent(async (file: File) => {
    if (!window.confirm("Import will replace the current local workspace. Continue?")) {
      return;
    }

    setIsImporting(true);

    try {
      const snapshot = JSON.parse(await file.text()) as unknown;
      await apiClient<{
        ok: true;
        counts: {
          projects: number;
          tickets: number;
        };
      }>("/api/import", {
        method: "POST",
        body: JSON.stringify({
          replaceExisting: true,
          snapshot
        })
      });

      await queryClient.invalidateQueries();
    } finally {
      setIsImporting(false);

      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  });

  const saveJiraSettings = useEffectEvent(async () => {
    const payload: UpdateJiraSettingsPayload = {
      baseUrl: jiraForm.baseUrl.trim(),
      email: jiraForm.email.trim()
    };

    if (jiraForm.apiToken.trim()) {
      payload.apiToken = jiraForm.apiToken.trim();
    }

    await updateJiraSettingsMutation.mutateAsync(payload);
    setJiraForm((current) => ({
      ...current,
      apiToken: ""
    }));
  });

  const jiraSettingsStatus = jiraSettingsQuery.data?.hasApiToken
    ? "API token saved"
    : "No API token saved";

  const saveGeneralSettings = useEffectEvent(async () => {
    setIsSavingGeneralSettings(true);

    try {
      setStoredDefaultOpenInMode(generalForm.defaultOpenInMode);
      setStoredAutoRunWorktreeSetup(generalForm.autoRunWorktreeSetup);
      setGeneralSettingsStatus(
        `${generalForm.defaultOpenInMode === "folder" ? "Folder" : "Worktree"} is now the default open mode. ${
          generalForm.autoRunWorktreeSetup ? "Fresh worktrees will run setup automatically." : "Fresh worktrees will skip setup."
        }`
      );
    } finally {
      setIsSavingGeneralSettings(false);
    }
  });

  return (
    <section className="mx-auto grid w-full min-w-0 max-w-5xl gap-4 lg:grid-cols-[12rem_minmax(0,42rem)] lg:gap-6">
      <input
        ref={importInputRef}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void importBoardData(file);
          }
        }}
      />
      <aside className={railClassName}>
        <h1 id="settings-heading" className="m-0 px-3 pb-2 text-base font-semibold text-ink-50">
          Settings
        </h1>
        <nav aria-label="Settings sections" className="grid border-t border-white/8 pt-1">
          <a href="#settings-general" className={navLinkClassName}>
            General
          </a>
          <a href="#settings-jira" className={navLinkClassName}>
            Jira
          </a>
          <a href="#settings-backups" className={navLinkClassName}>
            Backups
          </a>
        </nav>
      </aside>

      <div className="min-w-0 border-t border-white/8">
        <section id="settings-general" aria-labelledby="settings-general-heading" className="scroll-mt-20 border-b border-white/8">
          <form
            className="grid gap-3 px-1 py-4 sm:px-2"
            onSubmit={(event) => {
              event.preventDefault();
              void saveGeneralSettings();
            }}
          >
            <h2 id="settings-general-heading" className={sectionHeaderClassName}>
              General
            </h2>

            <div className="grid gap-3 border border-white/8 bg-white/[0.02] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <label className="block text-sm text-ink-100" htmlFor="default-open-mode">
                  Default Open In mode
                </label>
                <p className="m-0 mt-1 text-xs text-ink-300">Folder opens the repo directly. Worktree opens the ticket workspace.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div id="default-open-mode" className="inline-flex min-h-9 flex-wrap rounded-[8px] border border-white/8 bg-black/20 p-0.5">
                  {(["folder", "worktree"] as const).map((mode) => {
                    const isSelected = generalForm.defaultOpenInMode === mode;

                    return (
                      <button
                        key={mode}
                        type="button"
                        className={`inline-flex min-h-8 min-w-20 items-center justify-center rounded-[6px] px-2.5 py-1.5 text-sm transition-colors ${
                          isSelected ? "bg-white text-canvas-975" : "text-ink-200 hover:bg-white/[0.05] hover:text-ink-50"
                        }`}
                        aria-pressed={isSelected}
                        onClick={() => {
                          setGeneralForm((current) => ({
                            ...current,
                            defaultOpenInMode: mode
                          }));
                          setGeneralSettingsStatus(null);
                        }}
                      >
                        {mode === "folder" ? "Folder" : "Worktree"}
                      </button>
                    );
                  })}
                </div>
                <button type="submit" className={buttonClassName} disabled={isSavingGeneralSettings}>
                  {isSavingGeneralSettings ? <span className={spinnerClassName} aria-hidden="true" /> : null}
                  <span>{isSavingGeneralSettings ? "Saving…" : "Save"}</span>
                </button>
              </div>
            </div>

            <div className="grid gap-3 border border-white/8 bg-white/[0.02] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <label className="block text-sm text-ink-100" htmlFor="auto-run-worktree-setup">
                  Auto-run worktree setup
                </label>
                <p className="m-0 mt-1 text-xs text-ink-300">
                  When a Boroda-managed worktree is created for the first time, run `.boroda/worktree.setup.json` automatically.
                </p>
              </div>
              <button
                id="auto-run-worktree-setup"
                type="button"
                className={`inline-flex min-h-9 min-w-24 items-center justify-center rounded-[8px] border px-3 py-2 text-sm transition-colors ${
                  generalForm.autoRunWorktreeSetup
                    ? "border-white/12 bg-white text-canvas-975"
                    : "border-white/8 bg-black/20 text-ink-200 hover:bg-white/[0.05] hover:text-ink-50"
                }`}
                aria-pressed={generalForm.autoRunWorktreeSetup}
                onClick={() => {
                  setGeneralForm((current) => ({
                    ...current,
                    autoRunWorktreeSetup: !current.autoRunWorktreeSetup
                  }));
                  setGeneralSettingsStatus(null);
                }}
              >
                {generalForm.autoRunWorktreeSetup ? "Enabled" : "Disabled"}
              </button>
            </div>

            <p className={helperTextClassName} aria-live="polite">
              {generalSettingsStatus ?? "Choose how Open In should default across tickets and whether fresh worktrees should run setup."}
            </p>
          </form>
        </section>

        <section id="settings-jira" aria-labelledby="settings-jira-heading" className="scroll-mt-20 border-b border-white/8">
          <form
            className="grid gap-4 px-1 py-4 sm:px-2"
            onSubmit={(event) => {
              event.preventDefault();
              void saveJiraSettings();
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="settings-jira-heading" className={sectionHeaderClassName}>
                Jira
              </h2>
              <Link to="/jira" className={buttonClassName}>
                Open issues
              </Link>
            </div>

            <label className={fieldClassName}>
              <span className="text-sm text-ink-100">Jira base URL</span>
              <input
                className={inputClassName}
                type="url"
                name="jira_base_url"
                autoComplete="url"
                placeholder="https://your-company.atlassian.net…"
                required
                value={jiraForm.baseUrl}
                onChange={(event) => {
                  const value = event.target.value;
                  setJiraForm((current) => ({
                    ...current,
                    baseUrl: value
                  }));
                }}
              />
            </label>

            <label className={fieldClassName}>
              <span className="text-sm text-ink-100">Jira email</span>
              <input
                className={inputClassName}
                type="email"
                name="jira_email"
                autoComplete="email"
                spellCheck={false}
                required
                value={jiraForm.email}
                onChange={(event) => {
                  const value = event.target.value;
                  setJiraForm((current) => ({
                    ...current,
                    email: value
                  }));
                }}
              />
            </label>

            <label className={fieldClassName}>
              <span className="text-sm text-ink-100">Jira API token</span>
              <input
                className={inputClassName}
                type="password"
                name="jira_api_token"
                autoComplete="off"
                placeholder={jiraSettingsQuery.data?.hasApiToken ? "Leave blank to keep existing token…" : "Paste API token…"}
                value={jiraForm.apiToken}
                onChange={(event) => {
                  const value = event.target.value;
                  setJiraForm((current) => ({
                    ...current,
                    apiToken: value
                  }));
                }}
              />
            </label>

            <p className={helperTextClassName} aria-live="polite">
              {jiraSettingsStatus}
            </p>

            {updateJiraSettingsMutation.error ? (
              <p className="m-0 text-sm text-danger-400" role="alert">
                {updateJiraSettingsMutation.error.message}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <button type="submit" className={buttonClassName} disabled={updateJiraSettingsMutation.isPending}>
                {updateJiraSettingsMutation.isPending ? <span className={spinnerClassName} aria-hidden="true" /> : null}
                <span>{updateJiraSettingsMutation.isPending ? "Saving…" : "Save Jira settings"}</span>
              </button>
            </div>
          </form>
        </section>

        <section id="settings-backups" aria-labelledby="settings-backups-heading" className="scroll-mt-20 border-b border-white/8">
          <div className="grid gap-3 px-1 py-4 sm:px-2">
            <h2 id="settings-backups-heading" className={sectionHeaderClassName}>
              Backups
            </h2>
          </div>
          <div className="grid">
            <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 px-1 py-3 sm:px-2">
              <p className="m-0 text-sm text-ink-100">Import backup…</p>
              <button
                type="button"
                className={buttonClassName}
                onClick={() => {
                  importInputRef.current?.click();
                }}
                disabled={isImporting}
              >
                {isImporting ? <span className={spinnerClassName} aria-hidden="true" /> : null}
                <span>{isImporting ? "Importing…" : "Import"}</span>
              </button>
            </div>
            <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-t border-white/8 px-1 py-3 sm:px-2">
              <p className="m-0 text-sm text-ink-100">Export backup</p>
              <button
                type="button"
                className={buttonClassName}
                onClick={() => {
                  void exportBoardData();
                }}
                disabled={isExporting}
              >
                {isExporting ? <span className={spinnerClassName} aria-hidden="true" /> : null}
                <span>{isExporting ? "Exporting…" : "Export"}</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
