import { TICKET_PROJECT_RELATIONSHIPS } from "../../lib/constants";
import type { Project, TicketProjectRelationship } from "../../lib/types";
import { createProjectLinkRow, type TicketProjectLinkFormState } from "../../features/tickets/form";

interface ProjectLinkEditorProps {
  value: TicketProjectLinkFormState[];
  projects: Project[];
  onChange: (nextValue: TicketProjectLinkFormState[]) => void;
}

export function ProjectLinkEditor({ value, projects, onChange }: ProjectLinkEditorProps) {
  return (
    <div className="grid gap-2 md:col-span-full">
      <span className="m-0 text-sm font-medium text-ink-50">Linked projects</span>
      <div className="grid gap-4">
        {value.length ? (
          value.map((link, index) => (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center" key={`${link.projectId}-${index}`}>
              <select
                className="min-h-11 flex-[1.4] rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3 text-ink-50"
                value={link.projectId}
                onChange={(event) => {
                  const nextValue = [...value];
                  nextValue[index] = {
                    ...nextValue[index],
                    projectId: event.target.value
                  };
                  onChange(nextValue);
                }}
              >
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <select
                className="min-h-11 flex-1 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3 text-ink-50"
                value={link.relationship}
                onChange={(event) => {
                  const nextValue = [...value];
                  nextValue[index] = {
                    ...nextValue[index],
                    relationship: event.target.value as TicketProjectRelationship
                  };
                  onChange(nextValue);
                }}
              >
                {TICKET_PROJECT_RELATIONSHIPS.map((relationship) => (
                  <option key={relationship} value={relationship}>
                    {relationship}
                  </option>
                ))}
              </select>
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-red-400/20 bg-red-950/50 px-4 py-2.5 text-sm font-medium text-red-100 transition-colors hover:border-red-300/30 hover:bg-red-950/70"
                type="button"
                onClick={() => onChange(value.filter((_, currentIndex) => currentIndex !== index))}
              >
                Remove
              </button>
            </div>
          ))
        ) : (
          <p className="m-0 text-sm text-ink-200">No linked projects yet.</p>
        )}
        <button
          className="inline-flex min-h-11 w-fit items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-white/[0.06]"
          type="button"
          onClick={() => onChange([...value, createProjectLinkRow()])}
        >
          Add project link
        </button>
      </div>
    </div>
  );
}
