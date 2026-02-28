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
    <div className="field field-wide">
      <span>Linked projects</span>
      <div className="stack">
        {value.length ? (
          value.map((link, index) => (
            <div className="ticket-link-row" key={`${link.projectId}-${index}`}>
              <select
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
                type="button"
                onClick={() => onChange(value.filter((_, currentIndex) => currentIndex !== index))}
              >
                Remove
              </button>
            </div>
          ))
        ) : (
          <p className="empty-state">No linked projects yet.</p>
        )}
        <button type="button" onClick={() => onChange([...value, createProjectLinkRow()])}>
          Add project link
        </button>
      </div>
    </div>
  );
}
