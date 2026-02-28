import { createContext, useContext, useState, type ReactNode } from "react";
import { createBrowserRouter, NavLink, Outlet, RouterProvider } from "react-router-dom";
import { OverflowMenu } from "../components/ui/overflow-menu";
import { BoardPage } from "../pages/board-page";
import { ProjectsPage } from "../pages/projects-page";

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
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgba(22,18,15,0.92)] backdrop-blur-xl">
          <div className="flex h-12 items-center justify-between gap-3 px-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-4">
              <h1 className="m-0 text-base font-semibold tracking-tight text-ink-50">Boroda</h1>
              <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `inline-flex min-h-9 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-accent-700 text-canvas-950"
                        : "text-ink-200 hover:bg-white/8 hover:text-ink-50"
                    }`
                  }
                >
                  Board
                </NavLink>
                <NavLink
                  to="/projects"
                  className={({ isActive }) =>
                    `inline-flex min-h-9 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-accent-700 text-canvas-950"
                        : "text-ink-200 hover:bg-white/8 hover:text-ink-50"
                    }`
                  }
                >
                  Projects
                </NavLink>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <div className="sm:hidden">
                <OverflowMenu buttonLabel="Open navigation menu">
                  <NavLink
                    to="/"
                    className={({ isActive }) =>
                      `inline-flex min-h-10 items-center rounded-2xl px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-accent-700 text-canvas-950"
                          : "text-ink-50 hover:bg-white/8"
                      }`
                    }
                    role="menuitem"
                  >
                    Board
                  </NavLink>
                  <NavLink
                    to="/projects"
                    className={({ isActive }) =>
                      `inline-flex min-h-10 items-center rounded-2xl px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-accent-700 text-canvas-950"
                          : "text-ink-50 hover:bg-white/8"
                      }`
                    }
                    role="menuitem"
                  >
                    Projects
                  </NavLink>
                </OverflowMenu>
              </div>
            </div>
          </div>
        </header>
        <main className="grid min-h-0 flex-1 px-4 pb-4 pt-2 sm:px-5">
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
      { path: "projects", element: <ProjectsPage /> }
    ]
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
