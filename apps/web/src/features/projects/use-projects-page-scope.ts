import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { sortProjects, type ProjectScope } from "./page-helpers";
import { useProjectsQuery } from "./queries";

function getProjectScope(searchParams: URLSearchParams): ProjectScope {
  const scopeParam = searchParams.get("scope");
  return scopeParam === "archived" || scopeParam === "all" ? scopeParam : "active";
}

export function useProjectsPageScope() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    document.title = "Projects · Boroda";
  }, []);

  const projectScope = getProjectScope(searchParams);
  const projectsQuery = useProjectsQuery(projectScope);
  const sortedProjects = useMemo(
    () => sortProjects(projectsQuery.data ?? []),
    [projectsQuery.data]
  );

  function setScope(scope: ProjectScope) {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (scope === "active") {
      nextSearchParams.delete("scope");
    } else {
      nextSearchParams.set("scope", scope);
    }

    setSearchParams(nextSearchParams, { replace: true });
  }

  return {
    projectScope,
    setScope,
    projectsQuery,
    sortedProjects
  };
}
