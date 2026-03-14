import type { TicketFormState } from "../../features/tickets/form";
import type { Ticket } from "../../lib/types";
import { JiraIssueSelector } from "./jira-issue-selector";
import { DisclosureRow, EditableReadRegion, MetaFieldEditor } from "./ticket-drawer-primitives";
import type { EditableSectionId } from "./ticket-drawer-layout";

interface TicketDrawerJiraSectionProps {
  ticket: Ticket;
  form: TicketFormState;
  activeEditor: EditableSectionId | null;
  isJiraSectionExpanded: boolean;
  isRefreshingJira: boolean;
  jiraBaseUrl: string;
  jiraSectionId: string;
  editorRootRefs: React.MutableRefObject<Partial<Record<EditableSectionId, HTMLElement | null>>>;
  onChange: (updater: (current: TicketFormState) => TicketFormState) => void;
  onOpenEditor: (section: EditableSectionId) => void;
  onToggleJiraSection: () => void;
  onRefreshJira: () => void;
}

export function TicketDrawerJiraSection(props: TicketDrawerJiraSectionProps) {
  return (
    <div className="grid gap-2 border-b border-white/8 pb-4 last:border-b-0 last:pb-0">
      <DisclosureRow
        label="Jira issues"
        description={
          props.ticket.jiraIssues.length
            ? `${props.ticket.jiraIssues.length} linked issue${props.ticket.jiraIssues.length === 1 ? "" : "s"}`
            : "No Jira issues linked"
        }
        expanded={props.isJiraSectionExpanded}
        onToggle={props.onToggleJiraSection}
        className="border border-transparent px-0 py-1 hover:bg-transparent"
      />
      {props.isJiraSectionExpanded ? (
        props.activeEditor === "jiraIssues" ? (
          <div
            id={props.jiraSectionId}
            ref={(element) => {
              props.editorRootRefs.current.jiraIssues = element;
            }}
          >
            <MetaFieldEditor label="Jira issues">
              <JiraIssueSelector
                value={props.form.jiraIssues}
                onChange={(jiraIssues) =>
                  props.onChange((current) => ({
                    ...current,
                    jiraIssues
                  }))
                }
              />
            </MetaFieldEditor>
          </div>
        ) : (
          <EditableReadRegion
            label="Edit ticket Jira issues"
            onActivate={() => props.onOpenEditor("jiraIssues")}
            className="p-0"
          >
            <div id={props.jiraSectionId}>
              {props.ticket.jiraIssues.length ? (
                <div className="grid gap-2">
                  {props.ticket.jiraIssues.map((issue) => {
                    const href = props.jiraBaseUrl ? `${props.jiraBaseUrl}/browse/${issue.key}` : null;

                    return (
                      <div
                        key={issue.id}
                        className="min-w-0 rounded-md border border-white/8 px-3 py-2.5"
                      >
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
                        <p className="m-0 mt-1 min-w-0 break-words text-sm text-ink-200">
                          {issue.summary || "No Jira summary cached."}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="text-sm font-medium text-ink-50">No Jira issues</span>
              )}
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  className="text-sm font-medium text-ink-300 transition-colors hover:text-ink-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50"
                  onClick={props.onRefreshJira}
                  disabled={props.isRefreshingJira}
                  aria-label={props.isRefreshingJira ? "Refreshing linked issues" : "Refresh linked issues"}
                >
                  {props.isRefreshingJira ? "Refreshing…" : "Refresh linked issues"}
                </button>
              </div>
            </div>
          </EditableReadRegion>
        )
      ) : null}
    </div>
  );
}
