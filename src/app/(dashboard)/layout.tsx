import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Toaster } from '@/components/ui/toaster';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: Re-enable auth check after setup
  // const session = await auth();
  // if (!session?.user) {
  //   redirect('/login');
  // }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="relative flex-1 overflow-y-auto p-8 scrollbar-thin surface-0">
          {/* Subtle gradient accent — top edge glow */}
          <div className="pointer-events-none fixed inset-x-0 top-0 h-[300px] bg-gradient-to-b from-blue-500/[0.03] to-transparent" />
          <div className="relative z-10 mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
