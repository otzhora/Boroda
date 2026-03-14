import type { KeyboardEvent as ReactKeyboardEvent, MutableRefObject, RefObject } from "react";
import { formatTicketDateTime } from "../../features/tickets/date-time";
import type { TicketFormState } from "../../features/tickets/form";
import type { Ticket } from "../../lib/types";
import { MarkdownDescription } from "./markdown-description";
import { TicketActivityDetails } from "./ticket-drawer-activity";
import { EditableReadRegion } from "./ticket-drawer-primitives";
import { TicketDescriptionField } from "./ticket-form";
import { WorkContextEditor } from "./work-context-editor";
import { detailTabs, type DetailTabId, type EditableSectionId } from "./ticket-drawer-layout";

const sectionClassName = "grid gap-3 border-b border-white/8 pb-4";
const detailTabClassName =
  "inline-flex min-h-10 items-center justify-center border-b-2 border-transparent px-1 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50";

interface TicketDrawerMainContentProps {
  ticket: Ticket;
  form: TicketFormState;
  activeEditor: EditableSectionId | null;
  activeDetailTab: DetailTabId;
  detailTabsId: string;
  detailTabRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  descriptionTextareaRef: RefObject<HTMLTextAreaElement | null>;
  editorRootRefs: MutableRefObject<Partial<Record<EditableSectionId, HTMLElement | null>>>;
  activityMessages: Map<number, string>;
  onChange: (updater: (current: TicketFormState) => TicketFormState) => void;
  onSave: () => void;
  onOpenEditor: (section: EditableSectionId) => void;
  onSetActiveDetailTab: (tab: DetailTabId) => void;
  onDetailTabKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => void;
}

export function TicketDrawerMainContent(props: TicketDrawerMainContentProps) {
  return (
    <div className="grid min-w-0 content-start gap-6">
      <section className={sectionClassName}>
        {props.activeEditor === "description" ? (
          <div
            ref={(element) => {
              props.editorRootRefs.current.description = element;
            }}
          >
            <TicketDescriptionField
              ticketId={props.ticket.id}
              value={props.form.description}
              onChange={(value) =>
                props.onChange((current) => ({
                  ...current,
                  description: value
                }))
              }
              onSubmit={props.onSave}
              textareaRef={props.descriptionTextareaRef}
            />
          </div>
        ) : (
          <EditableReadRegion
            label="Edit ticket description"
            onActivate={() => {
              props.onOpenEditor("description");
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <h4 className="m-0 text-base font-semibold text-ink-50">Description</h4>
            </div>
            {props.form.description ? (
              <div
                className="min-w-0 rounded-lg border border-white/8 bg-white/[0.02] p-3"
                role="region"
                aria-label="Ticket description"
              >
                <MarkdownDescription value={props.form.description} />
              </div>
            ) : (
              <p className="m-0 text-sm text-ink-300">No description yet. Click to add one.</p>
            )}
          </EditableReadRegion>
        )}
      </section>

      <section className="grid content-start gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-3">
          <h4 className="m-0 text-base font-semibold text-ink-50">Additional details</h4>
          <div className="inline-flex min-h-10 flex-wrap gap-4 border-b border-white/8" role="tablist" aria-label="Ticket detail sections">
            {detailTabs.map((tab, index) => {
              const isActive = props.activeDetailTab === tab.id;

              return (
                <button
                  key={tab.id}
                  ref={(element) => {
                    props.detailTabRefs.current[index] = element;
                  }}
                  id={`${props.detailTabsId}-${tab.id}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`${props.detailTabsId}-${tab.id}-panel`}
                  tabIndex={isActive ? 0 : -1}
                  className={`${detailTabClassName} ${
                    isActive ? "border-white text-ink-50" : "text-ink-300 hover:text-ink-100"
                  }`}
                  onClick={() => {
                    props.onSetActiveDetailTab(tab.id);
                  }}
                  onKeyDown={(event) => {
                    props.onDetailTabKeyDown(event, index);
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          id={`${props.detailTabsId}-${props.activeDetailTab}-panel`}
          role="tabpanel"
          aria-labelledby={`${props.detailTabsId}-${props.activeDetailTab}-tab`}
          className={
            props.activeDetailTab === "contexts"
              ? "min-w-0"
              : "min-w-0 rounded-lg border border-white/8 bg-white/[0.02] p-3 pb-4"
          }
          tabIndex={0}
        >
          {props.activeDetailTab === "contexts" ? (
            <WorkContextEditor ticketId={props.ticket.id} contexts={props.ticket.workContexts} embedded />
          ) : props.ticket.activities.length ? (
            <div className="grid gap-3">
              {props.ticket.activities.map((activity) => (
                <div className="grid gap-1 border-b border-white/8 pb-3 last:border-b-0 last:pb-0" key={activity.id}>
                  <p className="m-0 text-sm text-ink-50">{props.activityMessages.get(activity.id) ?? activity.message}</p>
                  <TicketActivityDetails activity={activity} />
                  <span className="text-[0.8rem] text-ink-300">{formatTicketDateTime(activity.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 text-sm text-ink-200">No activity yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
