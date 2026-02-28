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
      {props.pending ? <span className="button-spinner" aria-hidden="true" /> : null}
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
    <section className="subform work-contexts-panel">
      <div className="folders-header">
        <h4>Work contexts</h4>
      </div>

      <p className="empty-state">
        Keep pull requests, AI sessions, and manual UI references attached to the ticket.
      </p>

      {actionMessage ? (
        <p className="form-message error-text" aria-live="polite">
          {actionMessage}
        </p>
      ) : null}

      <div className="stack">
        {contexts.length ? (
          contexts.map((context) => {
            const draft = drafts[context.id] ?? toDraft(context);
            const isSaving = updateMutation.isPending && updateMutation.variables?.id === context.id;
            const isDeleting = deleteMutation.isPending && deleteMutation.variables === context.id;

            return (
              <form
                key={context.id}
                className="context-card"
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
                <div className="context-card-grid">
                  <label className="field">
                    <span>Type</span>
                    <select
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
                  <label className="field">
                    <span>Label</span>
                    <input
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

                <label className="field">
                  <span>{getValueLabel(draft.type)}</span>
                  {draft.type === "NOTE" || draft.type === "MANUAL_UI" ? (
                    <textarea
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

                <div className="form-actions">
                  <button type="submit" disabled={isSaving}>
                    <SubmitLabel pending={isSaving} idle="Save changes" pendingText="Saving changes" />
                  </button>
                  <button
                    type="button"
                    className="danger-button"
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
          <p className="empty-state">No work contexts attached yet.</p>
        )}

        <form
          className="context-card"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate({
              type: newContext.type,
              label: newContext.label.trim(),
              value: newContext.value.trim()
            });
          }}
        >
          <div className="folders-header">
            <h4>Add context</h4>
          </div>
          <div className="context-card-grid">
            <label className="field">
              <span>Type</span>
              <select
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
            <label className="field">
              <span>Label</span>
              <input
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

          <label className="field">
            <span>{getValueLabel(newContext.type)}</span>
            {newContext.type === "NOTE" || newContext.type === "MANUAL_UI" ? (
              <textarea
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

          <div className="form-actions">
            <button type="submit" disabled={createMutation.isPending}>
              <SubmitLabel pending={createMutation.isPending} idle="Add context" pendingText="Adding context" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
