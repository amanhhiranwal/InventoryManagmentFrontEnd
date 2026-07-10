import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/sidebar/Sidebar";
import ProtectedRoute from "@/components/common/ProtectedRoute";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />

        <div className="flex flex-1 flex-col">
          <Navbar />

          <main className="flex-grow overflow-y-auto p-6 bg-slate-50 dark:bg-[#020b12] text-slate-900 dark:text-slate-100 transition-colors duration-300">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}