export type JiraIssueSort = "needs-boroda" | "linked-first" | "jira-order" | "jira-key";
export const JIRA_PAGE_SIZE = 10;
export type JiraPageItem = number | "ellipsis";

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

export function parseIssuePage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function buildJiraPageItems(totalPages: number, currentPage: number): JiraPageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];
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
