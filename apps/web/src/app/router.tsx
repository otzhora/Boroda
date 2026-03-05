import { createContext, useContext, useState, type ReactNode } from "react";
import { createBrowserRouter, NavLink, Outlet, RouterProvider } from "react-router-dom";
import { BoardPage } from "../pages/board-page";
import { ProjectsPage } from "../pages/projects-page";
import { SettingsPage } from "../pages/settings-page";

interface AppHeaderContextValue {
  actions: ReactNode;
  setActions: (actions: ReactNode) => void;
}

const AppHeaderContext = createContext<AppHeaderContextValue>({
  actions: null,
  setActions: () => {}
});

export function useAppHeader() {
  return useContext(AppHeaderContext);
}

function AppShell() {
  const [actions, setActions] = useState<ReactNode>(null);

  return (
    <AppHeaderContext.Provider value={{ actions, setActions }}>
      <div className="flex min-h-screen w-full flex-col">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-canvas-800 focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-white/8 bg-canvas-950">
          <div className="flex min-h-14 w-full items-center justify-between gap-4 px-5">
            <div className="flex min-w-0 items-center gap-4">
              <h1 className="m-0 text-sm font-semibold uppercase tracking-[0.22em] text-ink-100">Boroda</h1>
              <nav className="flex items-center gap-1" aria-label="Primary">
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `inline-flex min-h-10 items-center rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "border border-white/12 bg-white/10 text-ink-50"
                        : "text-ink-200 hover:bg-white/5 hover:text-ink-50"
                    }`
                  }
                >
                  Board
                </NavLink>
                <NavLink
                  to="/projects"
                  className={({ isActive }) =>
                    `inline-flex min-h-10 items-center rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "border border-white/12 bg-white/10 text-ink-50"
                        : "text-ink-200 hover:bg-white/5 hover:text-ink-50"
                    }`
                  }
                >
                  Projects
                </NavLink>
              </nav>
            </div>
            <div className="flex items-center gap-2">{actions}</div>
          </div>
        </header>
        <main id="content" className="grid min-h-0 min-w-0 flex-1 overflow-x-hidden px-5 py-4" tabIndex={-1}>
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
      { path: "settings", element: <SettingsPage /> }
    ]
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
