import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { JiraIssueSelector } from "./jira-issue-selector";

vi.mock("../../features/jira/queries", () => ({
  useJiraSettingsQuery: () => ({
    data: {
      baseUrl: "https://jira.example.test",
      email: "me@example.test",
      hasApiToken: true
    }
  }),
  useAssignedJiraIssuesQuery: () => ({
    data: {
      issues: [
        { key: "ABC-123", summary: "Payment retry fails" },
        { key: "XYZ-42", summary: "Dashboard cleanup" }
      ],
      total: 2
    },
    isLoading: false,
    error: null
  })
}));

describe("JiraIssueSelector", () => {
  it("filters assigned issues by summary and adds the selected one", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<JiraIssueSelector value={[]} onChange={handleChange} />);

    await user.type(screen.getByPlaceholderText("Search assigned issues by key or summary…"), "retry");
    await user.click(screen.getByRole("option", { name: /ABC-123/i }));

    expect(handleChange).toHaveBeenCalledWith([
      {
        key: "ABC-123",
        summary: "Payment retry fails"
      }
    ]);
  });

  it("supports attaching a manual Jira key", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<JiraIssueSelector value={[]} onChange={handleChange} />);

    await user.type(screen.getByPlaceholderText("Search assigned issues by key or summary…"), "ops-7");
    await user.keyboard("{Enter}");

    expect(handleChange).toHaveBeenCalledWith([
      {
        key: "OPS-7",
        summary: ""
      }
    ]);
  });
});
