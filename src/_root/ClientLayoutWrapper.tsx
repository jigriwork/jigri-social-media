"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserContext } from '../context/SupabaseAuthContext';
import { useUserActivity } from '../hooks/useUserActivity';
import Topbar from '../components/shared/Topbar';
import LeftSidebar from '../components/shared/LeftSidebar';
import RightSidebar from '../components/shared/RightSidebar';
import Bottombar from '../components/shared/Bottombar';

interface ClientLayoutWrapperProps {
  children: React.ReactNode;
}

const ClientLayoutWrapper = ({ children }: ClientLayoutWrapperProps) => {
  const [isClient, setIsClient] = useState(false);
  const { isAuthenticated, isLoading } = useUserContext();
  const router = useRouter();
  
  // Track user activity when authenticated
  useUserActivity();

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    router.replace('/sign-in');
    return null;
  }

  return (
    <div className="w-full md:flex justify-between relative mx-auto max-w-7xl 2xl:max-w-[1440px]">
      <Topbar />
      <LeftSidebar />
      <section className="flex flex-1 h-full justify-center min-w-0">
        {children}
      </section>
      <RightSidebar />
      <Bottombar />
    </div>
  );
};

export default ClientLayoutWrapper;
