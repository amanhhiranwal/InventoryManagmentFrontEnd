"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { FiHome, FiAlertCircle } from "react-icons/fi";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#020b12] px-6 py-12 font-sans transition-colors duration-300">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Visual Icon with soft pulsing background */}
        <div className="relative w-20 h-20 mx-auto bg-rose-500/10 dark:bg-rose-500/5 rounded-full flex items-center justify-center border border-rose-500/20 text-rose-500">
          <FiAlertCircle className="text-4xl" />
        </div>

        {/* Header Title */}
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
            The route you are trying to access does not exist or has been relocated. If this is a new route, please restart the Next.js dev server to compile it.
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex justify-center">
          <Link href="/dashboard">
            <Button icon={<FiHome />}>
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
