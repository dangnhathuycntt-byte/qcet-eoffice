// Design-sync shim for next/link: the real module reads the Next.js router
// (process.env.__NEXT_*), which doesn't exist on the Claude Design canvas and
// crashes the whole bundle at load. Wired via .design-sync/tsconfig.json paths.
import * as React from "react";

type UrlObject = { pathname?: string | null; hash?: string | null };

type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | UrlObject;
  prefetch?: boolean | null;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  legacyBehavior?: boolean;
  locale?: string | false;
};

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, prefetch, replace, scroll, shallow, passHref, legacyBehavior, locale, ...rest },
  ref,
) {
  const url = typeof href === "string" ? href : `${href.pathname ?? ""}${href.hash ?? ""}`;
  return <a ref={ref} href={url} {...rest} />;
});

export default Link;
