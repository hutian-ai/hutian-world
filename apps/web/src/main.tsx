import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "react-router-dom";
import { WorkspaceShell } from "@/components/shell";
import { PageNavigationProvider } from "@/components/page-navigation";
import { Toaster } from "@hutian-ai/design/ui/sonner";
import Loading from "@/app/loading";
import ErrorPage, { PageResourceError } from "@/app/error";
import NotFound from "@/app/not-found";
import { getWorkspace } from "@/lib/api";
import type { Workspace } from "@hutian-world/contracts";
import "@/app/globals.css";

const modules = import.meta.glob<{
  default: (props: {
    params: Promise<Record<string, string>>;
    searchParams: Promise<Record<string, string | string[]>>;
  }) => ReactNode | Promise<ReactNode>;
}>("./app/(workspace)/**/page.tsx");
function Shell() {
  const workspace = useLoaderData() as Workspace;
  return (
    <PageNavigationProvider>
      <WorkspaceShell
        owner={workspace.creator.displayName}
        defaultSidebarOpen={
          !document.cookie
            .split(";")
            .some((v) => v.trim() === "sidebar_state=false")
        }
      >
        <Outlet />
      </WorkspaceShell>
    </PageNavigationProvider>
  );
}
function Page() {
  return useLoaderData() as ReactNode;
}
function Failure() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  return <ErrorPage error={error} reset={() => router.revalidate()} />;
}
const routes = Object.entries(modules).map(([file, load]) => ({
  path: file
    .replace("./app/(workspace)/", "")
    .replace("/page.tsx", "")
    .replace(/\[([^\]]+)\]/g, ":$1"),
  loader: async ({
    params,
    request,
  }: {
    params: Record<string, string | undefined>;
    request: Request;
  }) => {
    const module = await load().catch((cause: unknown) => {
      throw new PageResourceError("页面资源加载失败", { cause });
    });
    const query: Record<string, string | string[]> = {};
    for (const [key, value] of new URL(request.url).searchParams) {
      const old = query[key];
      query[key] =
        old === undefined
          ? value
          : Array.isArray(old)
            ? [...old, value]
            : [old, value];
    }
    return module.default({
      params: Promise.resolve(params as Record<string, string>),
      searchParams: Promise.resolve(query),
    });
  },
  Component: Page,
  ErrorBoundary: Failure,
}));
const router = createBrowserRouter([
  {
    path: "/",
    loader: getWorkspace,
    Component: Shell,
    ErrorBoundary: Failure,
    HydrateFallback: Loading,
    children: [
      {
        index: true,
        loader: () => {
          throw new Response(null, {
            status: 302,
            headers: { Location: "/chat" },
          });
        },
      },
      ...routes,
      { path: "*", Component: NotFound },
    ],
  },
]);
window.addEventListener("hutian:refresh", () => void router.revalidate());
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <a href="#main-content" className="skip-link">
      跳转到内容
    </a>
    <RouterProvider router={router} />
    <Toaster
      theme="dark"
      position="top-center"
      richColors
      closeButton
      containerAriaLabel="通知"
      toastOptions={{ closeButtonAriaLabel: "关闭通知" }}
    />
  </StrictMode>,
);
