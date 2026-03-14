import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/render-with-providers";
import { createProject } from "../test/fixtures/models";

const mocks = vi.hoisted(() => ({
  useProjectsQuery: vi.fn(),
  useProjectsPageMutations: vi.fn(),
  refetchProjects: vi.fn(),
  createProjectMutateAsync: vi.fn(),
  updateProjectMutateAsync: vi.fn(),
  archiveProjectMutate: vi.fn(),
  unarchiveProjectMutate: vi.fn(),
  createFolderMutateAsync: vi.fn(),
  updateFolderMutateAsync: vi.fn(),
  deleteFolderMutate: vi.fn(),
  validatePathMutateAsync: vi.fn(),
  scaffoldWorktreeSetupMutate: vi.fn()
}));

vi.mock("../features/projects/queries", () => ({
  useProjectsQuery: mocks.useProjectsQuery
}));

vi.mock("../features/projects/mutations", () => ({
  useProjectsPageMutations: mocks.useProjectsPageMutations
}));

import { ProjectsPage } from "./projects-page";

describe("ProjectsPage", () => {
  beforeEach(() => {
    document.title = "Tickets · Boroda";
    mocks.useProjectsQuery.mockReset();
    mocks.useProjectsPageMutations.mockReset();
    mocks.refetchProjects.mockReset();
    mocks.createProjectMutateAsync.mockReset();
    mocks.updateProjectMutateAsync.mockReset();
    mocks.archiveProjectMutate.mockReset();
    mocks.unarchiveProjectMutate.mockReset();
    mocks.createFolderMutateAsync.mockReset();
    mocks.updateFolderMutateAsync.mockReset();
    mocks.deleteFolderMutate.mockReset();
    mocks.validatePathMutateAsync.mockReset();
    mocks.scaffoldWorktreeSetupMutate.mockReset();

    mocks.createProjectMutateAsync.mockResolvedValue(undefined);
    mocks.updateProjectMutateAsync.mockResolvedValue(undefined);
    mocks.createFolderMutateAsync.mockResolvedValue(undefined);
    mocks.updateFolderMutateAsync.mockResolvedValue(undefined);
    mocks.validatePathMutateAsync.mockResolvedValue({
      exists: true,
      isDirectory: true,
      resolvedPath: "/tmp/projects/payments"
    });

    mocks.useProjectsQuery.mockImplementation(() => ({
      data: [
        createProject({
          id: 1,
          name: "Payments Backend",
          slug: "payments-backend",
          description: "Main backend system",
          updatedAt: "2026-03-10T10:00:00.000Z",
          folders: [
            {
              id: 101,
              projectId: 1,
              label: "api",
              path: "/home/otzhora/projects/payments-api",
              defaultBranch: "main",
              kind: "APP",
              isPrimary: true,
              existsOnDisk: true,
              setupInfo: {
                hasWorktreeSetup: false,
                configPath: null
              },
              createdAt: "2026-03-01T10:00:00.000Z",
              updatedAt: "2026-03-08T10:00:00.000Z"
            }
          ]
        }),
        createProject({
          id: 2,
          name: "Infra",
          slug: "infra",
          color: "#223344",
          updatedAt: "2026-03-09T10:00:00.000Z"
        })
      ],
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetchProjects
    }));

    mocks.useProjectsPageMutations.mockImplementation(() => ({
      createProjectMutation: {
        mutateAsync: mocks.createProjectMutateAsync,
        isPending: false,
        error: null
      },
      updateProjectMutation: {
        mutateAsync: mocks.updateProjectMutateAsync,
        isPending: false,
        error: null
      },
      archiveProjectMutation: {
        mutate: mocks.archiveProjectMutate,
        isPending: false,
        error: null
      },
      unarchiveProjectMutation: {
        mutate: mocks.unarchiveProjectMutate,
        isPending: false,
        error: null
      },
      createFolderMutation: {
        mutateAsync: mocks.createFolderMutateAsync,
        isPending: false,
        error: null
      },
      updateFolderMutation: {
        mutateAsync: mocks.updateFolderMutateAsync,
        isPending: false,
        error: null
      },
      deleteFolderMutation: {
        mutate: mocks.deleteFolderMutate,
        isPending: false,
        error: null
      },
      validatePathMutation: {
        mutateAsync: mocks.validatePathMutateAsync,
        isPending: false,
        error: null
      },
      scaffoldWorktreeSetupMutation: {
        mutate: mocks.scaffoldWorktreeSetupMutate,
        isPending: false,
        error: null
      }
    }));
  });

  it("reads and updates project scope from URL state", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ProjectsPage />, { initialEntries: ["/projects?scope=archived"] });

    expect(mocks.useProjectsQuery).toHaveBeenLastCalledWith("archived");

    await user.click(screen.getByRole("tab", { name: "All" }));
    expect(mocks.useProjectsQuery).toHaveBeenLastCalledWith("all");

    await user.click(screen.getByRole("tab", { name: "Active" }));
    expect(mocks.useProjectsQuery).toHaveBeenLastCalledWith("active");
  });

  it("creates a project with generated slug and preserves manual slug edits", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ProjectsPage />, { initialEntries: ["/projects"] });

    await user.click(screen.getByRole("button", { name: "New project" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Platform Ops");
    expect(screen.getByRole("textbox", { name: "Slug" })).toHaveValue("platform-ops");

    await user.clear(screen.getByRole("textbox", { name: "Slug" }));
    await user.type(screen.getByRole("textbox", { name: "Slug" }), "custom-slug");
    await user.type(screen.getByRole("textbox", { name: "Name" }), " Team");
    expect(screen.getByRole("textbox", { name: "Slug" })).toHaveValue("custom-slug");

    await user.type(screen.getByRole("textbox", { name: "Color" }), "#112233");
    await user.type(screen.getByRole("textbox", { name: "Description" }), "Shared tooling");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(mocks.createProjectMutateAsync).toHaveBeenCalledWith({
      name: "Platform Ops Team",
      slug: "custom-slug",
      description: "Shared tooling",
      color: "#355c7d#112233"
    });
  });

  it("wires project editing and folder create actions through the page orchestrator", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ProjectsPage />, { initialEntries: ["/projects"] });

    await user.click(screen.getByRole("button", { name: "Show details for Payments Backend" }));
    await user.click(screen.getByRole("button", { name: "Edit project" }));
    await user.clear(screen.getByRole("textbox", { name: "Name" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Payments API");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(mocks.updateProjectMutateAsync).toHaveBeenCalledWith({
      projectId: 1,
      payload: expect.objectContaining({
        name: "Payments API",
        slug: "payments-backend",
        description: "Main backend system",
        color: "#355c7d"
      })
    });

    await user.type(screen.getByRole("textbox", { name: "Label" }), "terraform");
    await user.type(
      screen.getByRole("textbox", { name: "WSL path" }),
      "/home/otzhora/projects/payments-terraform"
    );
    await user.type(screen.getByRole("textbox", { name: "Default branch" }), "main");
    await user.click(screen.getByRole("button", { name: "Check path" }));
    await user.click(screen.getByRole("button", { name: "Add folder" }));

    expect(mocks.validatePathMutateAsync).toHaveBeenCalledWith({
      existingFolderId: undefined,
      path: "/home/otzhora/projects/payments-terraform",
      targetKey: "project-1"
    });
    expect(mocks.createFolderMutateAsync).toHaveBeenCalledWith({
      projectId: 1,
      payload: {
        label: "terraform",
        path: "/home/otzhora/projects/payments-terraform",
        defaultBranch: "main",
        kind: "APP",
        isPrimary: false
      }
    });
  });
});
