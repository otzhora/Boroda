export type JiraIssueSort = "needs-boroda" | "linked-first" | "jira-order" | "jira-key";

export function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function parseIssueSort(value: string | null): JiraIssueSort {
  if (
    value === "needs-boroda" ||
    value === "linked-first" ||
    value === "jira-order" ||
    value === "jira-key"
  ) {
    return value;
  }

  return "needs-boroda";
}

export function normalizeIssueSearch(value: string | null) {
  return value?.trim() ?? "";
}

export function sortIssues<
  TIssue extends {
    key: string;
    borodaTickets: Array<unknown>;
  }
>(issues: TIssue[], sort: JiraIssueSort) {
  const indexedIssues = issues.map((issue, index) => ({ issue, index }));

  switch (sort) {
    case "linked-first":
      return indexedIssues
        .sort((left, right) => {
          const leftRank = left.issue.borodaTickets.length > 0 ? 0 : 1;
          const rightRank = right.issue.borodaTickets.length > 0 ? 0 : 1;
          return leftRank - rightRank || left.index - right.index;
        })
        .map((entry) => entry.issue);
    case "jira-key":
      return indexedIssues
        .sort((left, right) => left.issue.key.localeCompare(right.issue.key))
        .map((entry) => entry.issue);
    case "jira-order":
      return issues;
    case "needs-boroda":
    default:
      return indexedIssues
        .sort((left, right) => {
          const leftRank = left.issue.borodaTickets.length === 0 ? 0 : 1;
          const rightRank = right.issue.borodaTickets.length === 0 ? 0 : 1;
          return leftRank - rightRank || left.index - right.index;
        })
        .map((entry) => entry.issue);
  }
}
