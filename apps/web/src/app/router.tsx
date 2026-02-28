import { createBrowserRouter, NavLink, Outlet, RouterProvider } from "react-router-dom";
import { BoardPage } from "../pages/board-page";
import { ProjectsPage } from "../pages/projects-page";

function AppShell() {
  return (
    <div className="mx-auto grid min-h-screen w-full max-w-[1440px] gap-6 px-4 py-4 sm:px-6 sm:py-6">
      <header className="flex flex-col items-start justify-between gap-4 rounded-[28px] border border-white/10 bg-white/5 px-5 py-5 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl md:flex-row md:items-center">
        <div>
          <p className="m-0 text-[0.72rem] uppercase tracking-[0.16em] text-accent-500">
            Local Work Orchestration
          </p>
          <h1 className="m-0 text-3xl font-semibold tracking-tight text-ink-50">Boroda</h1>
        </div>
        <nav className="flex flex-wrap gap-3" aria-label="Primary">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-accent-700 bg-accent-700 text-canvas-950"
                  : "border-white/10 bg-white/5 text-ink-50 hover:border-white/20 hover:bg-white/10"
              }`
            }
          >
            Board
          </NavLink>
          <NavLink
            to="/projects"
            className={({ isActive }) =>
              `inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-accent-700 bg-accent-700 text-canvas-950"
                  : "border-white/10 bg-white/5 text-ink-50 hover:border-white/20 hover:bg-white/10"
              }`
            }
          >
            Projects
          </NavLink>
        </nav>
      </header>
      <main className="grid gap-4">
        <Outlet />
      </main>
    </div>
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
