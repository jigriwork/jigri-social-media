"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useUserContext } from "@/context/SupabaseAuthContext";
import Topbar from "@/components/shared/Topbar";
import LeftSidebar from "@/components/shared/LeftSidebar";
import Bottombar from "@/components/shared/Bottombar";

const RootLayout = () => {
  const { isAuthenticated, isLoading } = useUserContext();
  const router = useRouter();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    router.replace('/sign-in');
    return null;
  }

  return (
    <div className="w-full md:flex">
      <Topbar />
      <LeftSidebar />

      <section className="flex flex-1 h-full">
        <div className="w-full" />
      </section>

      <Bottombar />
    </div>
  );
};

export default RootLayout;
