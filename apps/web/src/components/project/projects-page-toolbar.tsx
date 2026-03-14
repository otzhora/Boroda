import {
  primaryButtonClassName,
  scopeLabel,
  secondaryButtonClassName,
  spinnerClassName,
  type ProjectScope
} from "../../features/projects/page-helpers";

interface ProjectsPageToolbarProps {
  projectCount: number;
  folderCount: number;
  projectScope: ProjectScope;
  isRefreshing: boolean;
  onRefresh: () => void;
  onScopeChange: (scope: ProjectScope) => void;
  onCreateProject: () => void;
}

export function ProjectsPageToolbar(props: ProjectsPageToolbarProps) {
  return (
    <div className="flex min-h-12 flex-wrap items-end justify-between gap-3 border-b border-white/8 pb-3">
      <h1 className="m-0 text-base font-semibold text-ink-50">Projects</h1>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-300">
          <span>
            {props.projectCount} {scopeLabel(props.projectScope).toLowerCase()} projects
          </span>
          <span aria-hidden="true">/</span>
          <span>{props.folderCount} folders</span>
        </div>
        <button
          type="button"
          className={secondaryButtonClassName}
          onClick={props.onRefresh}
          disabled={props.isRefreshing}
        >
          {props.isRefreshing ? <span className={spinnerClassName} aria-hidden="true" /> : null}
          <span>{props.isRefreshing ? "Refreshing…" : "Refresh"}</span>
        </button>
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Project scope">
          {(["active", "archived", "all"] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              role="tab"
              aria-selected={props.projectScope === scope}
              className={props.projectScope === scope ? primaryButtonClassName : secondaryButtonClassName}
              onClick={() => props.onScopeChange(scope)}
            >
              {scopeLabel(scope)}
            </button>
          ))}
        </div>
        <button type="button" className={secondaryButtonClassName} onClick={props.onCreateProject}>
          New project
        </button>
      </div>
    </div>
  );
}
