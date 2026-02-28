import { useEffect, useState } from "react";
import { useCreateWorkContextMutation, useDeleteWorkContextMutation, useUpdateWorkContextMutation } from "../../features/tickets/work-context-mutations";
import { WORK_CONTEXT_TYPES, workContextTypeLabelMap } from "../../lib/constants";
import type { WorkContext, WorkContextType } from "../../lib/types";

interface WorkContextDraft {
  type: WorkContextType;
  label: string;
  value: string;
}

interface WorkContextEditorProps {
  ticketId: number | null;
  contexts: WorkContext[];
}

function createEmptyContextDraft(): WorkContextDraft {
  return {
    type: "PR",
    label: "",
    value: ""
  };
}

function toDraft(context: WorkContext): WorkContextDraft {
  return {
    type: context.type,
    label: context.label,
    value: context.value
  };
}

function getValueLabel(type: WorkContextType) {
  switch (type) {
    case "PR":
      return "PR URL or branch";
    case "CODEX_SESSION":
    case "CLAUDE_SESSION":
    case "CURSOR_SESSION":
      return "Session URL or ID";
    case "MANUAL_UI":
      return "Flow, environment, or notes";
    case "NOTE":
      return "Note";
    default:
      return "Reference value";
  }
}

function getValuePlaceholder(type: WorkContextType) {
  switch (type) {
    case "PR":
      return "https://github.com/org/repo/pull/42";
    case "CODEX_SESSION":
    case "CLAUDE_SESSION":
    case "CURSOR_SESSION":
      return "codex://session/abc123 or pasted session URL";
    case "MANUAL_UI":
      return "Windows browser, staging env, billing settings drawer";
    case "NOTE":
      return "Capture the context you want to preserve…";
    default:
      return "Paste a durable reference…";
  }
}

function SubmitLabel(props: { pending: boolean; idle: string; pendingText: string }) {
  return (
    <>
      {props.pending ? (
        <span
          className="h-[0.85rem] w-[0.85rem] animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : null}
      {props.pending ? props.pendingText : props.idle}
    </>
  );
}

export function WorkContextEditor({ ticketId, contexts }: WorkContextEditorProps) {
  const [drafts, setDrafts] = useState<Record<number, WorkContextDraft>>({});
  const [newContext, setNewContext] = useState<WorkContextDraft>(createEmptyContextDraft());

  useEffect(() => {
    setDrafts(Object.fromEntries(contexts.map((context) => [context.id, toDraft(context)])));
    setNewContext(createEmptyContextDraft());
  }, [contexts, ticketId]);

  const createMutation = useCreateWorkContextMutation(ticketId);
  const updateMutation = useUpdateWorkContextMutation(ticketId);
  const deleteMutation = useDeleteWorkContextMutation(ticketId);

  const actionMessage =
    createMutation.error?.message ??
    updateMutation.error?.message ??
    deleteMutation.error?.message;

  return (
    <section className="grid gap-4 rounded-[20px] border border-white/8 bg-black/15 px-4 py-4 xl:col-span-full">
      <div className="flex items-center justify-between gap-4">
        <h4 className="m-0 text-base font-semibold text-ink-50">Work contexts</h4>
      </div>

      <p className="m-0 text-sm text-ink-200">
        Keep pull requests, AI sessions, and manual UI references attached to the ticket.
      </p>

      {actionMessage ? (
        <p className="m-0 text-sm text-danger-400" aria-live="polite">
          {actionMessage}
        </p>
      ) : null}

      <div className="grid gap-4">
        {contexts.length ? (
          contexts.map((context) => {
            const draft = drafts[context.id] ?? toDraft(context);
            const isSaving = updateMutation.isPending && updateMutation.variables?.id === context.id;
            const isDeleting = deleteMutation.isPending && deleteMutation.variables === context.id;

            return (
              <form
                key={context.id}
                className="grid gap-4 rounded-[18px] bg-black/20 px-4 py-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  updateMutation.mutate({
                    id: context.id,
                    type: draft.type,
                    label: draft.label.trim(),
                    value: draft.value.trim()
                  });
                }}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-end">
                  <label className="grid min-w-0 flex-1 gap-2">
                    <span className="m-0 text-sm font-medium text-ink-50">Type</span>
                    <select
                      className="min-h-11 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-ink-50"
                      value={draft.type}
                      onChange={(event) => {
                        const type = event.target.value as WorkContextType;
                        setDrafts((current) => ({
                          ...current,
                          [context.id]: {
                            ...draft,
                            type
                          }
                        }));
                      }}
                    >
                      {WORK_CONTEXT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {workContextTypeLabelMap[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid min-w-0 flex-1 gap-2">
                    <span className="m-0 text-sm font-medium text-ink-50">Label</span>
                    <input
                      className="min-h-11 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-ink-50 placeholder:text-ink-200/65"
                      name={`context-label-${context.id}`}
                      placeholder="Short reference label…"
                      value={draft.label}
                      onChange={(event) => {
                        const label = event.target.value;
                        setDrafts((current) => ({
                          ...current,
                          [context.id]: {
                            ...draft,
                            label
                          }
                        }));
                      }}
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="m-0 text-sm font-medium text-ink-50">{getValueLabel(draft.type)}</span>
                  {draft.type === "NOTE" || draft.type === "MANUAL_UI" ? (
                    <textarea
                      className="rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-ink-50 placeholder:text-ink-200/65"
                      name={`context-value-${context.id}`}
                      rows={3}
                      placeholder={getValuePlaceholder(draft.type)}
                      value={draft.value}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDrafts((current) => ({
                          ...current,
                          [context.id]: {
                            ...draft,
                            value
                          }
                        }));
                      }}
                    />
                  ) : (
                    <input
                      className="min-h-11 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-ink-50 placeholder:text-ink-200/65"
                      name={`context-value-${context.id}`}
                      placeholder={getValuePlaceholder(draft.type)}
                      value={draft.value}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDrafts((current) => ({
                          ...current,
                          [context.id]: {
                            ...draft,
                            value
                          }
                        }));
                      }}
                    />
                  )}
                </label>

                <div className="flex flex-wrap gap-3">
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent-700 px-4 py-2.5 text-sm font-medium text-canvas-950 transition-opacity disabled:cursor-progress disabled:opacity-70"
                    type="submit"
                    disabled={isSaving}
                  >
                    <SubmitLabel pending={isSaving} idle="Save changes" pendingText="Saving changes" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-500/20 bg-red-700/20 px-4 py-2.5 text-sm font-medium text-red-100 transition-colors hover:border-red-400/35 hover:bg-red-700/30 disabled:cursor-progress disabled:opacity-70"
                    disabled={isDeleting}
                    onClick={() => {
                      deleteMutation.mutate(context.id);
                    }}
                  >
                    <SubmitLabel pending={isDeleting} idle="Remove context" pendingText="Removing context" />
                  </button>
                </div>
              </form>
            );
          })
        ) : (
          <p className="m-0 text-sm text-ink-200">No work contexts attached yet.</p>
        )}

        <form
          className="grid gap-4 rounded-[18px] bg-black/20 px-4 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate({
              type: newContext.type,
              label: newContext.label.trim(),
              value: newContext.value.trim()
            });
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <h4 className="m-0 text-base font-semibold text-ink-50">Add context</h4>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <label className="grid min-w-0 flex-1 gap-2">
              <span className="m-0 text-sm font-medium text-ink-50">Type</span>
              <select
                className="min-h-11 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-ink-50"
                value={newContext.type}
                onChange={(event) => {
                  setNewContext((current) => ({
                    ...current,
                    type: event.target.value as WorkContextType
                  }));
                }}
              >
                {WORK_CONTEXT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {workContextTypeLabelMap[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 flex-1 gap-2">
              <span className="m-0 text-sm font-medium text-ink-50">Label</span>
              <input
                className="min-h-11 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-ink-50 placeholder:text-ink-200/65"
                placeholder="Short reference label…"
                value={newContext.label}
                onChange={(event) => {
                  setNewContext((current) => ({
                    ...current,
                    label: event.target.value
                  }));
                }}
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="m-0 text-sm font-medium text-ink-50">{getValueLabel(newContext.type)}</span>
            {newContext.type === "NOTE" || newContext.type === "MANUAL_UI" ? (
              <textarea
                className="rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-ink-50 placeholder:text-ink-200/65"
                rows={3}
                placeholder={getValuePlaceholder(newContext.type)}
                value={newContext.value}
                onChange={(event) => {
                  setNewContext((current) => ({
                    ...current,
                    value: event.target.value
                  }));
                }}
              />
            ) : (
              <input
                className="min-h-11 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-ink-50 placeholder:text-ink-200/65"
                placeholder={getValuePlaceholder(newContext.type)}
                value={newContext.value}
                onChange={(event) => {
                  setNewContext((current) => ({
                    ...current,
                    value: event.target.value
                  }));
                }}
              />
            )}
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent-700 px-4 py-2.5 text-sm font-medium text-canvas-950 transition-opacity disabled:cursor-progress disabled:opacity-70"
              type="submit"
              disabled={createMutation.isPending}
            >
              <SubmitLabel pending={createMutation.isPending} idle="Add context" pendingText="Adding context" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
