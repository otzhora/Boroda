import { useMemo, useState } from "react";
import { SectionedFilterDropdown } from "../../components/ui/sectioned-filter-dropdown";

export interface JiraPageFilters {
  jiraStatus?: string[];
}

export function hasJiraFilters(filters: JiraPageFilters) {
  return Boolean(filters.jiraStatus?.length);
}

export function JiraFilterDropdown(props: {
  filters: JiraPageFilters;
  statuses: string[];
  inputClassName: string;
  primaryButtonClassName: string;
  filterButtonClassName: string;
  onUpdateFilters: (updater: (nextSearchParams: URLSearchParams) => void) => void;
  onClearFilters: () => void;
  hotkeySignal: number;
}) {
  const [statusSearch, setStatusSearch] = useState("");
  const hasFilters = hasJiraFilters(props.filters);

  const filteredStatuses = useMemo(() => {
    const searchValue = statusSearch.trim().toLowerCase();

    if (!searchValue) {
      return props.statuses;
    }

    return props.statuses.filter((status) => status.toLowerCase().includes(searchValue));
  }, [props.statuses, statusSearch]);

  return (
    <SectionedFilterDropdown
      title="Jira filters"
      hotkeySignal={props.hotkeySignal}
      hasFilters={hasFilters}
      sections={[{ id: "status", label: "Jira status" }]}
      initialSection="status"
      activeButtonClassName={props.primaryButtonClassName}
      inactiveButtonClassName={props.filterButtonClassName}
      onClear={props.onClearFilters}
      renderSection={() => (
        <div className="grid gap-2">
          <span className="text-sm font-medium text-ink-100">Jira status</span>
          <input
            className={props.inputClassName}
            aria-label="Jira status filter"
            placeholder="Search Jira statuses…"
            value={statusSearch}
            onChange={(event) => {
              setStatusSearch(event.target.value);
            }}
          />
          <div className="grid max-h-[16rem] gap-1 overflow-auto pr-1">
            {filteredStatuses.map((status) => {
              const checked = props.filters.jiraStatus?.includes(status) ?? false;

              return (
                <label key={status} className="flex min-h-10 items-center gap-3 rounded-[8px] px-2 py-1 text-sm text-ink-200 hover:bg-white/[0.03]">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={checked}
                    onChange={() => {
                      props.onUpdateFilters((nextSearchParams) => {
                        const currentValues = nextSearchParams.getAll("jiraStatus");
                        const nextValues = checked
                          ? currentValues.filter((value) => value !== status)
                          : [...currentValues, status];

                        if (checked) {
                          nextSearchParams.delete("jiraStatus");
                          for (const nextValue of nextValues) {
                            nextSearchParams.append("jiraStatus", nextValue);
                          }
                          return;
                        }

                        nextSearchParams.delete("jiraStatus");
                        for (const nextValue of nextValues) {
                          nextSearchParams.append("jiraStatus", nextValue);
                        }
                      });
                    }}
                  />
                  <span className="min-w-0 truncate">{status}</span>
                </label>
              );
            })}
            {filteredStatuses.length === 0 ? <p className="m-0 px-2 py-1 text-sm text-ink-300">No Jira statuses match</p> : null}
          </div>
        </div>
      )}
    />
  );
}
