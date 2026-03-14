import { useState } from "react";
import { SectionedFilterDropdown } from "../../components/ui/sectioned-filter-dropdown";
import { TICKET_PRIORITIES } from "../../lib/constants";
import type { BoardFilters } from "./queries";
import type { QuickTicketFormState } from "../../components/board/quick-ticket-form";

export function hasBoardFilters(filters: BoardFilters) {
  return Boolean(filters.projectId || filters.priority || filters.q?.trim());
}

export function toQuickCreatePayload(form: QuickTicketFormState) {
  return {
    title: form.title.trim(),
    description: "",
    branch: null,
    workspaces: [],
    jiraIssues: [],
    status: form.status,
    priority: form.priority,
    dueAt: null,
    projectLinks: form.projectId
      ? [{ projectId: Number(form.projectId), relationship: "PRIMARY" as const }]
      : []
  };
}

export function BoardFilterDropdown(props: {
  filters: BoardFilters;
  projects: Array<{ id: number; name: string }>;
  inputClassName: string;
  primaryButtonClassName: string;
  secondaryButtonClassName: string;
  onUpdateFilters: (updater: (current: BoardFilters) => BoardFilters) => void;
  onClearFilters: () => void;
  hotkeySignal: number;
}) {
  const [projectSearch, setProjectSearch] = useState("");
  const hasFilters = hasBoardFilters(props.filters);

  const filteredProjects = props.projects.filter((project) =>
    project.name.toLowerCase().includes(projectSearch.trim().toLowerCase())
  );

  return (
    <SectionedFilterDropdown
      title="Board filters"
      hotkeySignal={props.hotkeySignal}
      hasFilters={hasFilters}
      sections={[
        { id: "project", label: "Project" },
        { id: "priority", label: "Priority" }
      ]}
      initialSection="project"
      activeButtonClassName={props.primaryButtonClassName}
      inactiveButtonClassName={props.secondaryButtonClassName}
      onClear={props.onClearFilters}
      renderSection={(section) => {
        if (section === "project") {
          return (
            <div className="grid gap-2">
              <span className="text-sm font-medium text-ink-100">Project</span>
              <input
                className={props.inputClassName}
                aria-label="Project filter"
                placeholder="Search projects…"
                value={projectSearch}
                onChange={(event) => {
                  setProjectSearch(event.target.value);
                }}
              />
              <div className="grid max-h-[16rem] gap-1 overflow-auto pr-1">
                {filteredProjects.map((project) => {
                  const checked = props.filters.projectId === project.id;

                  return (
                    <label key={project.id} className="flex min-h-10 items-center gap-3 rounded-[8px] px-2 py-1 text-sm text-ink-200 hover:bg-white/[0.03]">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={checked}
                        onChange={() => {
                          props.onUpdateFilters((current) => ({
                            ...current,
                            projectId: checked ? undefined : project.id
                          }));
                        }}
                      />
                      <span className="min-w-0 truncate">{project.name}</span>
                    </label>
                  );
                })}
                {filteredProjects.length === 0 ? <p className="m-0 px-2 py-1 text-sm text-ink-300">No projects match</p> : null}
              </div>
            </div>
          );
        }

        if (section === "priority") {
          return (
            <div className="grid gap-2">
              <span className="text-sm font-medium text-ink-100">Priority</span>
              <div className="grid gap-1">
                {TICKET_PRIORITIES.map((priority) => {
                  const checked = props.filters.priority === priority;

                  return (
                    <label key={priority} className="flex min-h-10 items-center gap-3 rounded-[8px] px-2 py-1 text-sm text-ink-200 hover:bg-white/[0.03]">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={checked}
                        onChange={() => {
                          props.onUpdateFilters((current) => ({
                            ...current,
                            priority: checked ? undefined : priority
                          }));
                        }}
                      />
                      <span>{priority}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        }

        return null;
      }}
    />
  );
}
