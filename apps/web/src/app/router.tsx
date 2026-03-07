import { createContext, useContext, useState, type ReactNode } from "react";
import { createBrowserRouter, NavLink, Outlet, RouterProvider } from "react-router-dom";
import { BoardPage } from "../pages/board-page";
import { JiraPage } from "../pages/jira-page";
import { ProjectsPage } from "../pages/projects-page";
import { SettingsPage } from "../pages/settings-page";

interface AppHeaderContextValue {
  actions: ReactNode;
  setActions: (actions: ReactNode) => void;
  rightActions: ReactNode;
  setRightActions: (actions: ReactNode) => void;
  hasHost: boolean;
}

const AppHeaderContext = createContext<AppHeaderContextValue>({
  actions: null,
  setActions: () => {},
  rightActions: null,
  setRightActions: () => {},
  hasHost: false
});

export function useAppHeader() {
  return useContext(AppHeaderContext);
}

function AppShell() {
  const [actions, setActions] = useState<ReactNode>(null);
  const [rightActions, setRightActions] = useState<ReactNode>(null);
  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-10 items-center border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
      isActive
        ? "border-ink-100 text-ink-50"
        : "border-transparent text-ink-200 hover:border-white/12 hover:text-ink-50"
    }`;

  return (
    <AppHeaderContext.Provider value={{ actions, setActions, rightActions, setRightActions, hasHost: true }}>
      <div className="flex min-h-screen w-full flex-col">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-canvas-850 focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-white/8 bg-canvas-950">
          <div className="relative grid min-h-14 w-full grid-cols-[1fr_auto_1fr] items-center gap-4 px-5">
            <div className="flex min-w-0 items-center gap-8 justify-self-start">
              <h1 className="m-0 text-base font-semibold text-ink-50">Boroda</h1>
              <nav className="flex items-center gap-5" aria-label="Primary">
                <NavLink to="/" className={navLinkClassName}>
                  Board
                </NavLink>
                <NavLink to="/projects" className={navLinkClassName}>
                  Projects
                </NavLink>
                <NavLink to="/jira" className={navLinkClassName}>
                  Jira
                </NavLink>
              </nav>
            </div>
            <div className="flex min-w-0 w-[min(100%,44rem)] items-center justify-center gap-2 justify-self-center">
              {actions}
            </div>
            <div className="flex min-w-0 items-center justify-end gap-2 justify-self-end">{rightActions}</div>
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
      { path: "projects", element: <ProjectsPage /> },
      { path: "jira", element: <JiraPage /> },
      { path: "settings", element: <SettingsPage /> }
    ]
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
