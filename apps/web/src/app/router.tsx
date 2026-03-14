import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createBrowserRouter, NavLink, Outlet, RouterProvider } from "react-router-dom";
import { BoardPage } from "../pages/board-page";
import { JiraPage } from "../pages/jira-page";
import { ProjectsPage } from "../pages/projects-page";
import { SettingsPage } from "../pages/settings-page";
import { TicketsPage } from "../pages/tickets-page";

interface AppHeaderContextValue {
  actionsHost: HTMLDivElement | null;
  rightActionsHost: HTMLDivElement | null;
  hasHost: boolean;
}

const AppHeaderContext = createContext<AppHeaderContextValue>({
  actionsHost: null,
  rightActionsHost: null,
  hasHost: false
});

export function useAppHeader() {
  return useContext(AppHeaderContext);
}

export function AppHeaderActions({ children }: { children: ReactNode }) {
  const { actionsHost } = useAppHeader();
  return actionsHost ? createPortal(children, actionsHost) : null;
}

export function AppHeaderRightActions({ children }: { children: ReactNode }) {
  const { rightActionsHost } = useAppHeader();
  return rightActionsHost ? createPortal(children, rightActionsHost) : null;
}

function AppShell() {
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null);
  const [rightActionsHost, setRightActionsHost] = useState<HTMLDivElement | null>(null);
  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-10 items-center border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
      isActive
        ? "border-ink-100 text-ink-50"
        : "border-transparent text-ink-200 hover:border-white/12 hover:text-ink-50"
    }`;

  return (
    <AppHeaderContext.Provider value={{ actionsHost, rightActionsHost, hasHost: true }}>
      <div className="flex min-h-screen w-full flex-col">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-canvas-850 focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-white/8 bg-canvas-950">
          <div className="relative flex min-h-14 w-full items-center justify-between gap-4 px-5">
            <div className="flex min-w-0 items-center gap-8">
              <h1 className="m-0 text-base font-semibold text-ink-50">Boroda</h1>
              <nav className="flex items-center gap-5" aria-label="Primary">
                <NavLink to="/" className={navLinkClassName}>
                  Board
                </NavLink>
                <NavLink to="/tickets" className={navLinkClassName}>
                  Tickets
                </NavLink>
                <NavLink to="/projects" className={navLinkClassName}>
                  Projects
                </NavLink>
                <NavLink to="/jira" className={navLinkClassName}>
                  Jira
                </NavLink>
              </nav>
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-1/2 flex w-full max-w-[44rem] -translate-x-1/2 items-center justify-center px-4">
              <div ref={setActionsHost} className="pointer-events-auto flex min-w-0 items-center justify-center gap-2" />
            </div>
            <div ref={setRightActionsHost} className="flex min-w-0 items-center justify-end gap-2" />
          </div>
        </header>
        <main
          id="content"
          className="grid min-h-0 min-w-0 flex-1 w-full overflow-x-hidden px-5 py-5"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>
    </AppHeaderContext.Provider>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <BoardPage /> },
      { path: "tickets", element: <TicketsPage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "jira", element: <JiraPage /> },
      { path: "settings", element: <SettingsPage /> }
    ]
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
