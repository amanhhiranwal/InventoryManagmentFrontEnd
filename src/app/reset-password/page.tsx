import { Suspense } from "react";
import AuthShell from "@/features/auth/components/AuthShell";
import ResetPasswordForm from "@/features/auth/components/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthShell showBackToSignIn>
      <Suspense
        fallback={
          <div className="w-full rounded-xl border border-slate-200/70 bg-white p-8 text-center text-sm text-slate-500 shadow-sm sm:p-10 dark:border-[#0d2336] dark:bg-[#051422] dark:text-slate-400">
            Loading...
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
