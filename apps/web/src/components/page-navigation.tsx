import {
  createContext,
  Fragment,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useLocation } from "react-router-dom";
import Link from "@/lib/navigation";
import { workspaceSection } from "@/lib/workspace-navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@hutian-ai/design/ui/breadcrumb";

type Crumb = { label: string; href?: string };
type Registration = { location: string; token: symbol; items: Crumb[] } | null;
const NavigationContext = createContext<{
  registration: Registration;
  register: Dispatch<SetStateAction<Registration>>;
} | null>(null);

export function PageNavigationProvider({ children }: { children: ReactNode }) {
  const [registration, register] = useState<Registration>(null);
  const value = useMemo(() => ({ registration, register }), [registration]);
  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

/** Pages supply authorized object names; the shell never fetches them separately. */
export function PageNavigation({ items }: { items: Crumb[] }) {
  const context = useContext(NavigationContext);
  const register = context?.register;
  const { pathname, search } = useLocation();
  const location = pathname + search;
  const encoded = JSON.stringify(items);
  useLayoutEffect(() => {
    if (!register) return;
    const token = Symbol();
    register({ location, token, items: JSON.parse(encoded) as Crumb[] });
    return () =>
      register((current) => (current?.token === token ? null : current));
  }, [register, location, encoded]);
  return null;
}

export function WorkspaceBreadcrumb({ owner }: { owner: string }) {
  const { pathname, search } = useLocation();
  const context = useContext(NavigationContext);
  const section = workspaceSection(pathname);
  const registration = context?.registration;
  const fallback: Crumb[] = section
    ? pathname === section.href
      ? [{ label: section.label }]
      : [{ ...section }, { label: "详情" }]
    : [{ label: "页面" }];
  const items =
    registration?.location === pathname + search
      ? registration.items
      : fallback;
  return (
    <Breadcrumb aria-label="当前位置" className="min-w-0 flex-1">
      <BreadcrumbList className="flex-nowrap gap-1.5 overflow-hidden text-xs sm:gap-1.5">
        <BreadcrumbItem className="hidden min-w-0 shrink-[2] sm:inline-flex">
          <span className="truncate" title={owner}>
            {owner}
          </span>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden sm:block" />
        {items.map((item, index) => {
          const last = index === items.length - 1;
          const hidden =
            index < items.length - 2 ? "hidden sm:inline-flex" : "inline-flex";
          return (
            <Fragment key={`${index}:${item.href ?? item.label}`}>
              {index > 0 && (
                <BreadcrumbSeparator
                  className={
                    index < items.length - 1
                      ? "hidden shrink-0 sm:block"
                      : "shrink-0"
                  }
                />
              )}
              <BreadcrumbItem
                className={`min-w-0 ${last ? "shrink" : "shrink-[2]"} ${hidden}`}
              >
                {last || !item.href ? (
                  <BreadcrumbPage className="truncate" title={item.label}>
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild className="truncate">
                    <Link href={item.href} title={item.label}>
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
