import AuthShell from "@/features/auth/components/AuthShell";
import ChangePasswordForm from "@/features/auth/components/ChangePasswordForm";

export default function ChangePasswordPage() {
  return (
    <AuthShell>
      <ChangePasswordForm />
    </AuthShell>
  );
}
