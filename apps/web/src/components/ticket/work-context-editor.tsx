import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useCreateWorkContextMutation, useDeleteWorkContextMutation, useUpdateWorkContextMutation } from "../../features/tickets/work-context-mutations";
import { VISIBLE_WORK_CONTEXT_TYPES, workContextTypeLabelMap } from "../../lib/constants";
import type { WorkContext, WorkContextType } from "../../lib/types";
import { MarkdownDescription } from "./markdown-description";
import { TicketDescriptionField } from "./ticket-form";

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
    type: "NOTE",
    label: "",
    value: ""
  };
}

function getSelectableWorkContextTypes(currentType?: WorkContextType) {
  if (currentType && !VISIBLE_WORK_CONTEXT_TYPES.includes(currentType as (typeof VISIBLE_WORK_CONTEXT_TYPES)[number])) {
    return [currentType, ...VISIBLE_WORK_CONTEXT_TYPES];
  }

  return VISIBLE_WORK_CONTEXT_TYPES;
}

function getContextTimestamp(context: Pick<WorkContext, "createdAt" | "updatedAt" | "id">) {
  const createdAt = Date.parse(context.createdAt);

  if (!Number.isNaN(createdAt)) {
    return createdAt;
  }

  const updatedAt = Date.parse(context.updatedAt);

  if (!Number.isNaN(updatedAt)) {
    return updatedAt;
  }

  return context.id;
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

function usesDedicatedNoteEditor(type: WorkContextType) {
  return type === "NOTE";
}

function getContextHeading(context: Pick<WorkContext, "type" | "label">) {
  if (context.label.trim()) {
    return context.label;
  }

  return context.type === "NOTE" ? "" : "Untitled context";
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

const WorkContextCreateForm = memo(function WorkContextCreateForm({
  ticketId,
  contexts
}: Pick<WorkContextEditorProps, "ticketId" | "contexts">) {
  const [newContext, setNewContext] = useState<WorkContextDraft>(createEmptyContextDraft());
  const createMutation = useCreateWorkContextMutation(ticketId);

  useEffect(() => {
    setNewContext(createEmptyContextDraft());
  }, [contexts, ticketId]);

  return (
    <form
      className={`grid min-w-0 gap-2 border-b border-white/8 pb-3 transition-opacity ${
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
      {createMutation.error?.message ? (
        <p className="m-0 text-sm text-danger-400" aria-live="polite">
          {createMutation.error.message}
        </p>
      ) : null}

      <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <label className="grid min-w-0 w-[10rem] shrink-0 gap-1">
            <span className="sr-only">Type</span>
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
              {getSelectableWorkContextTypes().map((type) => (
                <option key={type} value={type}>
                  {workContextTypeLabelMap[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 flex-1 gap-1">
            <span className="sr-only">Label</span>
            <input
              className="min-h-10 w-full min-w-0 rounded-md border border-white/8 bg-white/[0.02] px-3 py-2 text-sm text-ink-50 placeholder:text-ink-300"
              disabled={createMutation.isPending}
              placeholder="Label…"
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
      </div>

      {usesDedicatedNoteEditor(newContext.type) ? (
        <TicketDescriptionField
          ticketId={ticketId}
          value={newContext.value}
          onChange={(value) => {
            setNewContext((current) => ({
              ...current,
              value
            }));
          }}
          label="Note"
          modeLabel="Note editor mode"
          uploadAriaLabel="Upload note image"
          compact
          rows={7}
          showImageUploadButton={false}
          showModeTabs={false}
        />
      ) : (
        <label className="grid min-w-0 gap-1">
          <span className="sr-only">{getValueLabel(newContext.type)}</span>
          {newContext.type === "MANUAL_UI" ? (
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
      )}
    </form>
  );
});

interface WorkContextRowProps {
  context: WorkContext;
  ticketId: number | null;
  isEditing: boolean;
  onEditingChange: React.Dispatch<React.SetStateAction<number | null>>;
  updateMutation: ReturnType<typeof useUpdateWorkContextMutation>;
  deleteMutation: ReturnType<typeof useDeleteWorkContextMutation>;
}

const WorkContextRow = memo(function WorkContextRow({
  context,
  ticketId,
  isEditing,
  onEditingChange,
  updateMutation,
  deleteMutation
}: WorkContextRowProps) {
  const [draft, setDraft] = useState<WorkContextDraft>(() => toDraft(context));
  const contextItemRef = useRef<HTMLElement | null>(null);
  const editFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const isSaving = updateMutation.isPending && updateMutation.variables?.id === context.id;
  const isDeleting = deleteMutation.isPending && deleteMutation.variables === context.id;

  useEffect(() => {
    setDraft(toDraft(context));
  }, [context]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const field = editFieldRef.current;
    if (!field) {
      return;
    }

    field.focus();
    if ("select" in field) {
      field.select();
    }
  }, [isEditing]);

  function startEditing() {
    setDraft(toDraft(context));
    onEditingChange(context.id);
  }

  function stopEditing() {
    setDraft(toDraft(context));
    onEditingChange((current) => (current === context.id ? null : current));
    requestAnimationFrame(() => {
      contextItemRef.current?.focus();
    });
  }

  function saveChanges() {
    updateMutation.mutate({
      id: context.id,
      type: draft.type,
      label: draft.label.trim(),
      value: draft.value.trim()
    });
  }

  return (
    <section
      className="grid min-w-0 border-b border-white/8 py-3 last:border-b-0 last:pb-0"
      onDoubleClick={() => {
        if (!isEditing) {
          startEditing();
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
            saveChanges();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape") {
              return;
            }

            event.preventDefault();
            stopEditing();
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
                  setDraft((current) => ({
                    ...current,
                    type
                  }));
                }}
              >
                {getSelectableWorkContextTypes(draft.type).map((type) => (
                  <option key={type} value={type}>
                    {workContextTypeLabelMap[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 flex-1 gap-2">
              <span className="m-0 text-sm font-medium text-ink-50">Label</span>
              <input
                ref={editFieldRef as React.RefObject<HTMLInputElement | null>}
                className="min-h-11 w-full min-w-0 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-ink-50 placeholder:text-ink-300"
                disabled={isSaving}
                name={`context-label-${context.id}`}
                placeholder="Short reference label…"
                value={draft.label}
                onChange={(event) => {
                  const label = event.target.value;
                  setDraft((current) => ({
                    ...current,
                    label
                  }));
                }}
              />
            </label>
          </div>

          {usesDedicatedNoteEditor(draft.type) ? (
            <TicketDescriptionField
              ticketId={ticketId}
              value={draft.value}
              onChange={(value) => {
                setDraft((current) => ({
                  ...current,
                  value
                }));
              }}
              onSubmit={saveChanges}
              label="Note"
              modeLabel="Note editor mode"
              uploadAriaLabel="Upload note image"
              textareaRef={editFieldRef as React.RefObject<HTMLTextAreaElement | null>}
            />
          ) : (
            <label className="grid min-w-0 gap-2">
              <span className="m-0 text-sm font-medium text-ink-50">{getValueLabel(draft.type)}</span>
              {draft.type === "MANUAL_UI" ? (
                <textarea
                  ref={editFieldRef as React.RefObject<HTMLTextAreaElement | null>}
                  className="w-full min-w-0 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-ink-50 placeholder:text-ink-300"
                  disabled={isSaving}
                  name={`context-value-${context.id}`}
                  rows={3}
                  placeholder={getValuePlaceholder(draft.type)}
                  value={draft.value}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((current) => ({
                      ...current,
                      value
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
                    setDraft((current) => ({
                      ...current,
                      value
                    }));
                  }}
                />
              )}
            </label>
          )}

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
          ref={contextItemRef}
          tabIndex={0}
          role="button"
          aria-label={`Edit ${context.label || "work context"}`}
          className="grid min-w-0 gap-2 rounded-md px-1 py-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink-200/60"
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") {
              return;
            }

            event.preventDefault();
            startEditing();
          }}
        >
          <div className="flex min-w-0 items-baseline gap-3">
            <p className="m-0 shrink-0 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-300">
              {workContextTypeLabelMap[context.type]}
            </p>
            {getContextHeading(context) ? (
              <h5 className="m-0 min-w-0 break-words text-sm font-semibold text-ink-50">{getContextHeading(context)}</h5>
            ) : null}
          </div>
          {context.type === "NOTE" ? (
            <MarkdownDescription value={context.value} />
          ) : (
            <p className="m-0 break-words text-sm leading-6 text-ink-100">{context.value}</p>
          )}
        </article>
      )}
    </section>
  );
});

const WorkContextList = memo(function WorkContextList({
  ticketId,
  contexts
}: Pick<WorkContextEditorProps, "ticketId" | "contexts">) {
  const [editingContextId, setEditingContextId] = useState<number | null>(null);
  const updateMutation = useUpdateWorkContextMutation(ticketId);
  const deleteMutation = useDeleteWorkContextMutation(ticketId);
  const sortedContexts = useMemo(
    () => [...contexts].sort((left, right) => getContextTimestamp(right) - getContextTimestamp(left)),
    [contexts]
  );

  useEffect(() => {
    setEditingContextId(null);
  }, [contexts, ticketId]);

  return sortedContexts.length ? (
    <>
      {updateMutation.error?.message || deleteMutation.error?.message ? (
        <p className="m-0 text-sm text-danger-400" aria-live="polite">
          {updateMutation.error?.message ?? deleteMutation.error?.message}
        </p>
      ) : null}

      {sortedContexts.map((context) => (
        <WorkContextRow
          key={context.id}
          context={context}
          ticketId={ticketId}
          isEditing={editingContextId === context.id}
          onEditingChange={setEditingContextId}
          updateMutation={updateMutation}
          deleteMutation={deleteMutation}
        />
      ))}
    </>
  ) : (
    <p className="m-0 text-sm text-ink-300">No work contexts attached yet.</p>
  );
});

export function WorkContextEditor({ ticketId, contexts, embedded = false }: WorkContextEditorProps) {
  return (
    <section className={embedded ? "grid min-w-0 gap-3" : "grid min-w-0 gap-3 border-b border-white/8 pb-5"}>
      {!embedded ? (
        <div className="flex items-center justify-between gap-4">
          <h4 className="m-0 text-base font-semibold text-ink-50">Work contexts</h4>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4">
        <WorkContextCreateForm ticketId={ticketId} contexts={contexts} />
        <WorkContextList ticketId={ticketId} contexts={contexts} />
      </div>
    </section>
  );
}
