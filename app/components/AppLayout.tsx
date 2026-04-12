'use client';

import { useEffect, useState } from 'react';
import { useUserContext } from '../../src/context/SupabaseAuthContext';
import Topbar from '../../src/components/shared/Topbar';
import LeftSidebar from '../../src/components/shared/LeftSidebar';
import RightSidebar from '../../src/components/shared/RightSidebar';
import Bottombar from '../../src/components/shared/Bottombar';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';

const RIGHT_SIDEBAR_HIDDEN_PREFIXES = [
  '/messages',
  '/settings',
  '/create-post',
  '/admin',
  '/update-profile',
  '/update-post',
  '/verification',
  '/forgot-password',
  '/reset-password',
  '/update-password',
];

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useUserContext();
  const router = useRouter();
  const pathname = usePathname();

  const showRightSidebar = !RIGHT_SIDEBAR_HIDDEN_PREFIXES.some((route) =>
    pathname?.startsWith(route)
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/sign-in');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex-center w-full h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="w-full min-h-screen md:flex">
      <Topbar />
      <LeftSidebar />

      <section className="flex flex-1 min-w-0 h-full justify-center">
        {children}
      </section>

      {showRightSidebar && <RightSidebar />}

      <Bottombar />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return (
    <AuthenticatedLayout>
      {children}
    </AuthenticatedLayout>
  );
}
