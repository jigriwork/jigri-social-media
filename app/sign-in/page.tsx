'use client';

import { useEffect, useState } from 'react';
import SigninForm from '../../src/_auth/forms/SigninForm';

export default function SignInPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen flex">
      <section className="flex flex-1 justify-center items-center flex-col py-10">
        <SigninForm />
      </section>
      <div className="hidden xl:block h-screen w-1/2 bg-no-repeat bg-cover bg-center bg-[url('/assets/images/side-img.svg')]" />
    </div>
  );
}
