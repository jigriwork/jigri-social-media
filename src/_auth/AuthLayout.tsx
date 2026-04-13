"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserContext } from "@/context/SupabaseAuthContext";

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useUserContext();
  const router = useRouter();

  useEffect(() => {
    // No longer forcing overflow:hidden on body — the auth-page-wrapper
    // handles its own containment via overflow:hidden on the wrapper and
    // overflow-y:auto on the form section. This prevents the layout from
    // breaking on mobile when form content is taller than the viewport.
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (isAuthenticated) {
    router.replace('/');
    return null;
  }

  return (
    <div className="w-full h-full flex overflow-hidden">
      <section className="flex flex-1 justify-center items-center flex-col">
        <div className="w-full" />
      </section>
      <img
        src="/assets/images/side-img.svg"
        alt="logo"
        className="hidden xl:block h-full w-1/2 object-cover bg-no-repeat flex-shrink-0"
      />
    </div>
  );
}
