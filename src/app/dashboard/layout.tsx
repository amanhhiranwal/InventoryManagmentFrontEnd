// import ProtectedRoute from "@/components/common/ProtectedRoute";

// export default function DashboardLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   return (
//     <ProtectedRoute>
//       <div>{children}</div>
//     </ProtectedRoute>
//   );
// }

import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/sidebar/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Navbar />

        <main className="flex-1 overflow-y-auto bg-black-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}