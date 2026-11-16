import { forwardRef } from "react";
import type { AnchorHTMLAttributes, ImgHTMLAttributes } from "react";
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useSearchParams as routerSearchParams,
  redirect as routerRedirect,
} from "react-router-dom";
type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
};
const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, prefetch: _prefetch, replace, scroll, ...props },
  ref,
) {
  return (
    <RouterLink
      ref={ref}
      to={href}
      replace={replace}
      preventScrollReset={scroll === false}
      {...props}
    />
  );
});
export default Link;
export function Image({
  priority: _priority,
  fill: _fill,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & {
  priority?: boolean;
  fill?: boolean;
}) {
  return <img {...props} />;
}
export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (path: string, _options?: unknown) => navigate(path),
    replace: (path: string, _options?: unknown) =>
      navigate(path, { replace: true }),
    back: () => navigate(-1),
    refresh: () => {
      window.dispatchEvent(new Event("hutian:refresh"));
    },
  };
}
export const usePathname = () => useLocation().pathname;
export function useSearchParams() {
  return routerSearchParams()[0];
}
export function redirect(path: string): never {
  throw routerRedirect(path);
}
export function notFound(): never {
  throw new Response("页面不存在或不可访问。", { status: 404 });
}
