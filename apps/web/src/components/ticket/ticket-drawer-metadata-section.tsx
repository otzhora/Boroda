import { TICKET_PRIORITIES, formatStatusLabel } from "../../lib/constants";
import { formatTicketDateTime } from "../../features/tickets/date-time";
import type { TicketFormState } from "../../features/tickets/form";
import type { Ticket } from "../../lib/types";
import { EditableReadRegion, MetaFieldEditor, MetaRow } from "./ticket-drawer-primitives";
import { inputClassName } from "./ticket-form";
import type { EditableSectionId } from "./ticket-drawer-layout";

interface TicketDrawerMetadataSectionProps {
  ticket: Ticket;
  form: TicketFormState;
  statuses: Array<{ id: number; status: string; label: string; position: number; createdAt: string; updatedAt: string }>;
  activeEditor: EditableSectionId | null;
  editorRootRefs: React.MutableRefObject<Partial<Record<EditableSectionId, HTMLElement | null>>>;
  onChange: (updater: (current: TicketFormState) => TicketFormState) => void;
  onOpenEditor: (section: EditableSectionId) => void;
}

export function TicketDrawerMetadataSection(props: TicketDrawerMetadataSectionProps) {
  const metadata = {
    status: props.statuses.find((column) => column.status === props.form.status)?.label ?? formatStatusLabel(props.form.status),
    priority: props.form.priority,
    dueAt: formatTicketDateTime(props.ticket.dueAt ?? null)
  };
  const availableStatuses =
    props.statuses.length > 0
      ? props.statuses
      : [
          {
            id: 0,
            status: props.form.status,
            label: formatStatusLabel(props.form.status),
            position: 0,
            createdAt: "",
            updatedAt: ""
          }
        ];

  return (
    <>
      {props.activeEditor === "status" ? (
        <div
          ref={(element) => {
            props.editorRootRefs.current.status = element;
          }}
        >
          <MetaFieldEditor label="Status">
            <select
              className={inputClassName}
              value={props.form.status}
              onChange={(event) =>
                props.onChange((current) => ({
                  ...current,
                  status: event.target.value as Ticket["status"]
                }))
              }
            >
              {availableStatuses.map((status) => (
                <option key={status.status} value={status.status}>
                  {status.label || formatStatusLabel(status.status)}
                </option>
              ))}
            </select>
          </MetaFieldEditor>
        </div>
      ) : (
        <EditableReadRegion label="Edit ticket status" onActivate={() => props.onOpenEditor("status")} className="p-0">
          <MetaRow label="Status" value={metadata.status} />
        </EditableReadRegion>
      )}

      {props.activeEditor === "priority" ? (
        <div
          ref={(element) => {
            props.editorRootRefs.current.priority = element;
          }}
        >
          <MetaFieldEditor label="Priority">
            <select
              className={inputClassName}
              value={props.form.priority}
              onChange={(event) =>
                props.onChange((current) => ({
                  ...current,
                  priority: event.target.value as Ticket["priority"]
                }))
              }
            >
              {TICKET_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </MetaFieldEditor>
        </div>
      ) : (
        <EditableReadRegion label="Edit ticket priority" onActivate={() => props.onOpenEditor("priority")} className="p-0">
          <MetaRow label="Priority" value={metadata.priority} />
        </EditableReadRegion>
      )}

      {props.activeEditor === "dueAt" ? (
        <div
          ref={(element) => {
            props.editorRootRefs.current.dueAt = element;
          }}
        >
          <MetaFieldEditor label="Due at">
            <input
              className={inputClassName}
              type="datetime-local"
              value={props.form.dueAt}
              onChange={(event) =>
                props.onChange((current) => ({
                  ...current,
                  dueAt: event.target.value
                }))
              }
            />
          </MetaFieldEditor>
        </div>
      ) : (
        <EditableReadRegion label="Edit ticket due date" onActivate={() => props.onOpenEditor("dueAt")} className="p-0">
          <MetaRow label="Due at" value={metadata.dueAt} />
        </EditableReadRegion>
      )}
    </>
  );
}
