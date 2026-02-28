import { createBrowserRouter, NavLink, Outlet, RouterProvider } from "react-router-dom";
import { BoardPage } from "../pages/board-page";
import { ProjectsPage } from "../pages/projects-page";

function AppShell() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Local Work Orchestration</p>
          <h1>Boroda</h1>
        </div>
        <nav className="nav">
          <NavLink to="/">Board</NavLink>
          <NavLink to="/projects">Projects</NavLink>
        </nav>
      </header>
      <main className="content">
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

