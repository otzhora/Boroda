import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useAppHeader } from "../app/router";
import { apiClient, apiClientBlob } from "../lib/api-client";

const railClassName = "lg:sticky lg:top-20 lg:self-start";
const navLinkClassName =
  "block min-h-10 border-l-2 border-transparent px-3 py-2 text-sm text-ink-200 transition-colors hover:border-white/18 hover:bg-white/[0.03] hover:text-ink-50";
const sectionHeaderClassName = "m-0 text-xs font-semibold uppercase tracking-[0.12em] text-ink-200";
const buttonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.02] px-3 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-white/[0.05] disabled:cursor-progress disabled:opacity-70";
const spinnerClassName = "h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent";

export function SettingsPage() {
  const { setActions } = useAppHeader();
  const queryClient = useQueryClient();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    setActions(null);
    document.title = "Settings · Boroda";
    return () => {
      setActions(null);
    };
  }, [setActions]);

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
      const result = await apiClient<{
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
          <a href="#settings-backups" className={navLinkClassName}>
            Backups
          </a>
        </nav>
      </aside>

      <div className="min-w-0 border-t border-white/8">
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
