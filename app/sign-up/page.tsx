'use client';

import { useEffect, useState } from 'react';
import SignupForm from '../../src/_auth/forms/SignupForm';

export default function SignUpPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return (
    <div className="auth-page-wrapper">
      {/* Animated background particles */}
      <div className="auth-bg-particles" aria-hidden="true">
        <div className="auth-particle auth-particle-1" />
        <div className="auth-particle auth-particle-2" />
        <div className="auth-particle auth-particle-3" />
        <div className="auth-particle auth-particle-4" />
        <div className="auth-particle auth-particle-5" />
      </div>

      {/* Gradient orbs */}
      <div className="auth-gradient-orb auth-gradient-orb-1" aria-hidden="true" />
      <div className="auth-gradient-orb auth-gradient-orb-2" aria-hidden="true" />

      {/* Form section — scrollable */}
      <section className="auth-form-section custom-scrollbar">
        <SignupForm />
      </section>

      {/* Side image — desktop only */}
      <div className="auth-side-image">
        <div className="auth-side-overlay" />
        <img
          src="/assets/images/side-img.svg"
          alt="Jigri showcase"
          className="auth-side-img-element"
        />
      </div>
    </div>
  );
}
