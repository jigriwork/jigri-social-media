"use client";

import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Loader from "@/components/shared/Loader";
import { useToast } from "@/hooks/use-toast";

import { SigninValidation } from "@/lib/validation";
import { useSignInAccount } from "@/lib/react-query/queriesAndMutations";
import { useUserContext } from "@/context/SupabaseAuthContext";
import PWAInstallPrompt from "@/components/shared/PWAInstallPrompt";

const SigninForm = () => {
  const router = useRouter();
  const { checkAuthUser, isLoading: isUserLoading } = useUserContext();
  const { toast } = useToast();

  // State for inline error display
  const [signInError, setSignInError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Query
  const { mutateAsync: signInAccount, isPending } = useSignInAccount();

  const form = useForm<z.infer<typeof SigninValidation>>({
    resolver: zodResolver(SigninValidation),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleSignin = async (user: z.infer<typeof SigninValidation>) => {
    // Clear previous error
    setSignInError(null);
    const normalizedUser = {
      ...user,
      email: user.email.toLowerCase().trim(),
    };

    try {
      const session = await signInAccount(normalizedUser);

      if (!session) {
        setSignInError("Login failed. Please try again.");
        return;
      }

      const isLoggedIn = await checkAuthUser();

      if (isLoggedIn) {
        form.reset();
        setSignInError(null);
        router.push("/");
      } else {
        setSignInError("Authentication check failed. Please try again.");
        return;
      }
    } catch (error: any) {
      console.error('Login error:', error);

      // Handle enhanced error messages from signInUser function
      if (error?.name === 'EmailNotConfirmedError') {
        setSignInError("⚠️ Email verification required. Please check your email and click the verification link, then try logging in again.");
        return;
      }

      if (error?.name === 'InvalidCredentialsError') {
        setSignInError("❌ Invalid credentials. Please check your email and password and try again.");
        return;
      }

      if (error?.name === 'AccountDeactivatedError') {
        setSignInError("🚫 Your account has been deactivated. If you believe this was done in error, please contact support at support@jigri.app for assistance.");
        toast({
          title: "Account Deactivated",
          description: "Your account has been deactivated. Please contact support at support@jigri.app if you believe this was done in error.",
          variant: "destructive",
        });
        return;
      }

      // Fallback checks for legacy error handling
      if (error?.message) {
        if (error.message.includes('email not confirmed') ||
          error.message.includes('Email not confirmed') ||
          error.message.includes('Email verification required')) {
          setSignInError("⚠️ Email verification required. Please verify your email address first, then try logging in.");
        } else if (error.message.includes('Invalid login credentials') ||
          error.message.includes('Invalid email or password')) {
          setSignInError("❌ Invalid credentials. Please check your email and password and try again.");
        } else if (error.message.includes('account has been deactivated')) {
          setSignInError("🚫 Your account has been deactivated. If you believe this was done in error, please contact support at support@jigri.app for assistance.");
        } else {
          setSignInError(`❌ Login failed: ${error.message}`);
        }
      } else {
        setSignInError("❌ An unexpected error occurred. Please try again.");
      }
    }
  };

  return (
    <Form {...form}>
      <div className="auth-form-container">
        {/* Logo with pulse glow animation */}
        <div className="auth-logo-wrapper">
          <div className="auth-logo-glow" />
          <img
            src="/assets/images/logo.svg"
            alt="Jigri"
            className="auth-logo-img"
          />
        </div>

        {/* Heading */}
        <div className="auth-heading-group">
          <h2 className="auth-title auth-slide-up" style={{ animationDelay: '0.15s' }}>
            Welcome back
          </h2>
          <p className="auth-subtitle auth-slide-up" style={{ animationDelay: '0.25s' }}>
            Sign in to continue to Jigri
          </p>
        </div>

        <form
          onSubmit={form.handleSubmit(handleSignin)}
          className="auth-form auth-slide-up" style={{ animationDelay: '0.35s' }}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="auth-label">Email</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    className="auth-input"
                    placeholder="you@example.com"
                    {...field}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(e) => {
                      field.onChange(e.target.value.toLowerCase());
                      if (signInError) setSignInError(null);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="auth-label">Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      className="auth-input pr-10"
                      placeholder="••••••••"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        if (signInError) setSignInError(null);
                      }}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Forgot Password Link */}
          <div className="auth-forgot-row">
            <Link href="/forgot-password" className="auth-forgot-link">
              Forgot password?
            </Link>
          </div>

          {/* Inline error display */}
          {signInError && (
            <div className="auth-error-box auth-shake">
              {signInError}
            </div>
          )}

          <Button type="submit" className="auth-submit-btn">
            {isPending || isUserLoading ? (
              <div className="flex-center gap-2">
                <Loader /> Signing in...
              </div>
            ) : (
              "Sign in"
            )}
          </Button>

          <p className="auth-switch-text">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="auth-switch-link">
              Sign up
            </Link>
          </p>

          <PWAInstallPrompt
            variant="inline"
            className="mt-2"
            buttonLabel="Install app"
            descriptionOverride="For the best experience, install the app on your device."
          />

          {/* Founder community message */}
          <div className="auth-founder-msg auth-slide-up" style={{ animationDelay: '0.55s' }}>
            <p className="auth-founder-line" style={{ animationDelay: '0.6s' }}>We just launched Jigri v1.</p>
            <p className="auth-founder-line" style={{ animationDelay: '0.8s' }}>We&apos;re actively fixing bugs and improving every day.</p>
            <p className="auth-founder-line" style={{ animationDelay: '1.0s' }}>Help us build this together.</p>
            <p className="auth-founder-line" style={{ animationDelay: '1.2s' }}>Report issues. Share feedback. Be part of the journey.</p>
            <span className="auth-founder-badge" style={{ animationDelay: '1.4s' }}>Made in India ❤️</span>
          </div>
        </form>
      </div>
    </Form>
  );
};

export default SigninForm;
