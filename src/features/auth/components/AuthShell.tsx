"use client";

import { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiChevronLeft } from "react-icons/fi";

interface AuthShellProps {
  children: ReactNode;
  /** Renders the "Back to sign in" link in the top-left of the page body. */
  showBackToSignIn?: boolean;
}

/**
 * Shared chrome for the authentication screens: a white brand bar across the
 * top and a centred card on a muted background.
 */
export default function AuthShell({
  children,
  showBackToSignIn = false,
}: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col bg-[#f4f5f7] dark:bg-[#030d16]">
      {/* Brand bar */}
      <header className="w-full border-b border-slate-200/70 bg-white py-4 dark:border-[#0d2336] dark:bg-[#051422]">
        <div className="flex items-center justify-center">
          <Image
            src="/logo-light.png"
            alt="Synergy Global"
            width={150}
            height={40}
            priority
            className="object-contain dark:hidden"
          />
          <Image
            src="/logo-dark.png"
            alt="Synergy Global"
            width={150}
            height={40}
            priority
            className="hidden object-contain dark:block"
          />
        </div>
      </header>

      {/* Body */}
      <div className="relative flex flex-1 flex-col px-4 pb-16">
        {showBackToSignIn && (
          <Link
            href="/login"
            className="mt-5 inline-flex w-fit items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-primary dark:text-slate-400 dark:hover:text-slate-200"
          >
            <FiChevronLeft className="text-sm" />
            Back to sign in
          </Link>
        )}

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[440px]">{children}</div>
        </div>
      </div>
    </main>
  );
}
