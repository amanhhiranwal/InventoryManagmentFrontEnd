"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LuShieldX } from "react-icons/lu";

import {
  DBMenuItem,
  getMenuTreeApi,
  getSidebarMenusApi,
} from "@/features/menus/api/menus.api";
import { useAuthStore } from "@/features/auth/store/auth.store";

interface Access {
  /** Every page path a menu item points at. */
  menuPaths: string[];
  /** The ones this user's sidebar includes. */
  allowedPaths: string[];
}

const flatten = (items: DBMenuItem[]): string[] =>
  items.flatMap((item) => [
    ...(item.path ? [item.path] : []),
    ...flatten(item.children || []),
  ]);

/* One lookup per signed-in user, shared by every page they open. */
let cached: { userId: string; promise: Promise<Access> } | null = null;

function loadAccess(userId: string): Promise<Access> {
  if (cached?.userId !== userId) {
    const promise = Promise.all([getMenuTreeApi(), getSidebarMenusApi()]).then(
      ([tree, sidebar]) => ({
        menuPaths: flatten(tree || []),
        allowedPaths: flatten(sidebar || []),
      }),
    );

    /* A failed lookup is retried on the next page rather than remembered. */
    promise.catch(() => {
      cached = null;
    });

    cached = { userId, promise };
  }

  return cached.promise;
}

/** The menu path a URL belongs to: the longest one it sits under, so
    /sales/orders/12 is judged by Sales Order. */
function owningPath(pathname: string, paths: string[]): string | null {
  const matches = paths.filter(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  return matches.sort((a, b) => b.length - a.length)[0] || null;
}

/**
 * Blocks pages whose menu item the user has not been given.
 *
 * The sidebar already hides them; this covers a typed or bookmarked URL. The
 * API refuses the data either way - this just shows a clear page instead of
 * an empty one. Pages that are not on any menu (Profile) are always open.
 */
export default function RouteAccessGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [access, setAccess] = useState<Access | null>(null);

  const superAdmin = user?.is_super_admin === true;

  useEffect(() => {
    if (!user?.id || superAdmin) return;

    let cancelled = false;

    loadAccess(user.id)
      .then((result) => {
        if (!cancelled) setAccess(result);
      })
      .catch(() => {
        /* Fail open: the backend still guards the data. */
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, superAdmin]);

  const owner = access ? owningPath(pathname, access.menuPaths) : null;
  const blocked =
    !superAdmin && !!access && !!owner && !access.allowedPaths.includes(owner);
  const firstAllowed = access?.allowedPaths[0];

  /* Everyone lands on the dashboard after signing in; a role without it is
     sent to the first page it does have instead of an access notice. */
  const redirect = blocked && owner === "/dashboard" && !!firstAllowed;

  useEffect(() => {
    if (redirect && firstAllowed) router.replace(firstAllowed);
  }, [redirect, firstAllowed, router]);

  if (!blocked) return <>{children}</>;
  if (redirect) return null;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-xl bg-white p-8 text-center dark:border dark:border-[#17304a] dark:bg-[#071929]">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-2xl text-rose-500">
        <LuShieldX />
      </div>

      <h2 className="mb-2 text-lg font-semibold text-[#141414] dark:text-white">
        You don&apos;t have access to this page
      </h2>

      <p className="max-w-md text-[13px] text-[#777777] dark:text-slate-400">
        Your role has not been given this page. Ask your administrator if you
        need it.
      </p>

      {firstAllowed && (
        <Link
          href={firstAllowed}
          className="mt-5 inline-flex h-[39px] items-center rounded-lg bg-[#273756] px-4 text-[13px] font-medium text-white transition hover:bg-[#18243a]"
        >
          Go to my workspace
        </Link>
      )}
    </div>
  );
}
