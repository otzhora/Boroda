import { useEffect, useRef, useState } from "react";
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
  embedded?: boolean;
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

export function WorkContextEditor({ ticketId, contexts, embedded = false }: WorkContextEditorProps) {
  const [drafts, setDrafts] = useState<Record<number, WorkContextDraft>>({});
  const [newContext, setNewContext] = useState<WorkContextDraft>(createEmptyContextDraft());
  const [editingContextId, setEditingContextId] = useState<number | null>(null);
  const contextItemRefs = useRef<Record<number, HTMLElement | null>>({});
  const editFieldRefs = useRef<Record<number, HTMLInputElement | HTMLTextAreaElement | null>>({});

  useEffect(() => {
    setDrafts(Object.fromEntries(contexts.map((context) => [context.id, toDraft(context)])));
    setNewContext(createEmptyContextDraft());
    setEditingContextId(null);
  }, [contexts, ticketId]);

  useEffect(() => {
    if (editingContextId === null) {
      return;
    }

    const field = editFieldRefs.current[editingContextId];
    if (!field) {
      return;
    }

    field.focus();
    if ("select" in field) {
      field.select();
    }
  }, [editingContextId]);

  const createMutation = useCreateWorkContextMutation(ticketId);
  const updateMutation = useUpdateWorkContextMutation(ticketId);
  const deleteMutation = useDeleteWorkContextMutation(ticketId);

  const actionMessage =
    createMutation.error?.message ??
    updateMutation.error?.message ??
    deleteMutation.error?.message;

  function startEditing(context: WorkContext) {
    setDrafts((current) => ({
      ...current,
      [context.id]: current[context.id] ?? toDraft(context)
    }));
    setEditingContextId(context.id);
  }

  function stopEditing(context: WorkContext) {
    setDrafts((current) => ({
      ...current,
      [context.id]: toDraft(context)
    }));
    setEditingContextId((current) => (current === context.id ? null : current));
    contextItemRefs.current[context.id]?.focus();
  }

  return (
    <section className={embedded ? "grid min-w-0 gap-3" : "grid min-w-0 gap-3 border-b border-white/8 pb-5"}>
      {!embedded ? (
        <div className="flex items-center justify-between gap-4">
          <h4 className="m-0 text-base font-semibold text-ink-50">Work contexts</h4>
        </div>
      ) : null}

      <p className="m-0 text-xs text-ink-300">PRs, sessions, links, and notes for this ticket.</p>

      {actionMessage ? (
        <p className="m-0 text-sm text-danger-400" aria-live="polite">
          {actionMessage}
        </p>
      ) : null}

      <div className="grid min-w-0 gap-4">
        <form
          className={`grid min-w-0 gap-3 border-b border-white/8 pb-4 transition-opacity ${
            createMutation.isPending ? "opacity-85" : ""
          }`}
          aria-busy={createMutation.isPending}
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
            <h4 className="m-0 text-sm font-semibold text-ink-100">Add context</h4>
            <p className="m-0 text-xs text-ink-300" aria-live="polite">
              {createMutation.isPending ? "Adding context…" : ""}
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end">
            <label className="grid min-w-0 flex-1 gap-2">
              <span className="m-0 text-xs font-medium uppercase tracking-[0.14em] text-ink-300">Type</span>
              <select
                className="min-h-10 w-full min-w-0 rounded-md border border-white/8 bg-white/[0.02] px-3 py-2 text-sm text-ink-50"
                disabled={createMutation.isPending}
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
              <span className="m-0 text-xs font-medium uppercase tracking-[0.14em] text-ink-300">Label</span>
              <input
                className="min-h-10 w-full min-w-0 rounded-md border border-white/8 bg-white/[0.02] px-3 py-2 text-sm text-ink-50 placeholder:text-ink-300"
                disabled={createMutation.isPending}
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

          <label className="grid min-w-0 gap-2">
            <span className="m-0 text-xs font-medium uppercase tracking-[0.14em] text-ink-300">
              {getValueLabel(newContext.type)}
            </span>
            {newContext.type === "NOTE" || newContext.type === "MANUAL_UI" ? (
              <textarea
                className="w-full min-w-0 rounded-md border border-white/8 bg-white/[0.02] px-3 py-2 text-sm text-ink-50 placeholder:text-ink-300"
                disabled={createMutation.isPending}
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
                className="min-h-10 w-full min-w-0 rounded-md border border-white/8 bg-white/[0.02] px-3 py-2 text-sm text-ink-50 placeholder:text-ink-300"
                disabled={createMutation.isPending}
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
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-ink-50 px-4 py-2 text-sm font-medium text-canvas-975 transition-opacity disabled:cursor-progress disabled:opacity-70"
              type="submit"
              disabled={createMutation.isPending}
            >
              <SubmitLabel pending={createMutation.isPending} idle="Add context" pendingText="Adding context" />
            </button>
          </div>
        </form>

        {contexts.length ? (
          contexts.map((context) => {
            const draft = drafts[context.id] ?? toDraft(context);
            const isSaving = updateMutation.isPending && updateMutation.variables?.id === context.id;
            const isDeleting = deleteMutation.isPending && deleteMutation.variables === context.id;
            const isEditing = editingContextId === context.id;

            return (
              <section
                key={context.id}
                className="grid min-w-0 border-b border-white/8 py-3 last:border-b-0 last:pb-0"
                onDoubleClick={() => {
                  if (!isEditing) {
                    startEditing(context);
                  }
                }}
              >
                {isEditing ? (
                  <form
                    className={`grid min-w-0 gap-3 rounded-lg border bg-white/[0.02] p-3 transition-opacity ${
                      isSaving ? "border-white/15 opacity-85" : "border-white/10"
                    }`}
                    aria-busy={isSaving}
                    onSubmit={(event) => {
                      event.preventDefault();
                      updateMutation.mutate({
                        id: context.id,
                        type: draft.type,
                        label: draft.label.trim(),
                        value: draft.value.trim()
                      });
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Escape") {
                        return;
                      }

                      event.preventDefault();
                      stopEditing(context);
                    }}
                  >
                    <p className="m-0 text-xs text-ink-300" aria-live="polite">
                      {isSaving ? "Saving changes…" : ""}
                    </p>
                    <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end">
                      <label className="grid min-w-0 flex-1 gap-2">
                        <span className="m-0 text-sm font-medium text-ink-50">Type</span>
                        <select
                          className="min-h-11 w-full min-w-0 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-ink-50"
                          disabled={isSaving}
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
                          ref={(node) => {
                            editFieldRefs.current[context.id] = node;
                          }}
                          className="min-h-11 w-full min-w-0 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-ink-50 placeholder:text-ink-300"
                          disabled={isSaving}
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

                    <label className="grid min-w-0 gap-2">
                      <span className="m-0 text-sm font-medium text-ink-50">{getValueLabel(draft.type)}</span>
                      {draft.type === "NOTE" || draft.type === "MANUAL_UI" ? (
                        <textarea
                          className="w-full min-w-0 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-ink-50 placeholder:text-ink-300"
                          disabled={isSaving}
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
                          className="min-h-11 w-full min-w-0 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-ink-50 placeholder:text-ink-300"
                          disabled={isSaving}
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
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-ink-50 px-4 py-2 text-sm font-medium text-canvas-975 transition-opacity disabled:cursor-progress disabled:opacity-70"
                        type="submit"
                        disabled={isSaving}
                      >
                        <SubmitLabel pending={isSaving} idle="Save changes" pendingText="Saving changes" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-400/20 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-100 transition-colors hover:border-red-300/30 hover:bg-red-950/55 disabled:cursor-progress disabled:opacity-70"
                        disabled={isDeleting}
                        onClick={() => {
                          deleteMutation.mutate(context.id);
                        }}
                      >
                        <SubmitLabel pending={isDeleting} idle="Remove context" pendingText="Removing context" />
                      </button>
                    </div>
                  </form>
                ) : (
                  <article
                    ref={(node) => {
                      contextItemRefs.current[context.id] = node;
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Edit ${context.label || "work context"}`}
                    className="grid min-w-0 gap-2 rounded-md px-1 py-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink-200/60"
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") {
                        return;
                      }

                      event.preventDefault();
                      startEditing(context);
                    }}
                  >
                    <div className="flex min-w-0 items-baseline gap-3">
                      <p className="m-0 shrink-0 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-300">
                        {workContextTypeLabelMap[context.type]}
                      </p>
                      <h5 className="m-0 min-w-0 break-words text-sm font-semibold text-ink-50">
                        {context.label || "Untitled context"}
                      </h5>
                    </div>
                    <p className="m-0 break-words text-sm leading-6 text-ink-100">{context.value}</p>
                  </article>
                )}
              </section>
            );
          })
        ) : (
          <p className="m-0 text-sm text-ink-300">No work contexts attached yet.</p>
        )}
      </div>
    </section>
  );
}
