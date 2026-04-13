"use client";

import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { SignupValidation } from "@/lib/validation"
import Loader from "@/components/shared/Loader"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useCreateUserAccount, useSignInAccount } from "@/lib/react-query/queriesAndMutations"
import { useState, useEffect } from "react"
import { checkEmailOrUsernameExists } from "@/lib/supabase/api"
import { Eye, EyeOff } from "lucide-react"
import PWAInstallPrompt from "@/components/shared/PWAInstallPrompt"


const SignupForm = () => {
  const { toast } = useToast()
  const router = useRouter()
  const [availabilityStatus, setAvailabilityStatus] = useState<{
    email: 'available' | 'taken' | 'checking' | 'idle';
    username: 'available' | 'taken' | 'checking' | 'idle';
  }>({
    email: 'idle',
    username: 'idle'
  })
  const [showPassword, setShowPassword] = useState(false)

  // 1. Define your form.
  const form = useForm<z.infer<typeof SignupValidation>>({
    resolver: zodResolver(SignupValidation),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const { mutateAsync: createUserAccount, isPending: isCreatingAccount } = useCreateUserAccount();
  const { mutateAsync: _signInAccount, isPending: isSigningInUser } = useSignInAccount();

  // Real-time availability checking
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'email' && value.email && value.email.length > 3) {
        setAvailabilityStatus(prev => ({ ...prev, email: 'checking' }));

        const checkEmail = async () => {
          try {
            const result = await checkEmailOrUsernameExists(value.email!, '');
            setAvailabilityStatus(prev => ({
              ...prev,
              email: result.emailExists ? 'taken' : 'available'
            }));
          } catch (error) {
            console.error('Error checking email availability:', error);
            setAvailabilityStatus(prev => ({ ...prev, email: 'idle' }));
          }
        };

        const timeoutId = setTimeout(checkEmail, 500);
        return () => clearTimeout(timeoutId);
      }

      if (name === 'username' && value.username && value.username.length > 2) {
        setAvailabilityStatus(prev => ({ ...prev, username: 'checking' }));

        const checkUsername = async () => {
          try {
            const result = await checkEmailOrUsernameExists('', value.username!);
            setAvailabilityStatus(prev => ({
              ...prev,
              username: result.usernameExists ? 'taken' : 'available'
            }));
          } catch (error) {
            console.error('Error checking username availability:', error);
            setAvailabilityStatus(prev => ({ ...prev, username: 'idle' }));
          }
        };

        const timeoutId = setTimeout(checkUsername, 500);
        return () => clearTimeout(timeoutId);
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);

  const getAvailabilityMessage = (field: 'email' | 'username') => {
    const status = availabilityStatus[field];
    switch (status) {
      case 'checking':
        return <span className="text-xs text-yellow-500">Checking availability...</span>;
      case 'available':
        return <span className="text-xs text-green-500">✓ Available</span>;
      case 'taken':
        return <span className="text-xs text-red-500">✗ Already taken</span>;
      default:
        return null;
    }
  };

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof SignupValidation>) {
    try {
      console.log('Starting signup process with values:', {
        name: values.name,
        username: values.username,
        email: values.email
      });

      const newUser = await createUserAccount(values);

      console.log('Signup result:', newUser);

      if (!newUser) {
        console.error('Signup failed: newUser is null/undefined');
        toast({
          title: "Sign up failed",
          description: "Unable to create account. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // Show success message
      toast({
        title: "Account created successfully!",
        description: "Please sign in with your new account."
      });

      // Redirect to sign-in page
      router.push('/sign-in');

    } catch (error: any) {
      console.error('Signup error details:', error);
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      console.error('Full error object:', JSON.stringify(error, null, 2));

      let errorMessage = "Sign up failed. Please try again.";

      // Handle specific error types
      if (error?.name === 'EmailOrUsernameExistsError') {
        errorMessage = error.message;
      } else if (error?.message) {
        if (error.message.includes('This email has already been registered')) {
          errorMessage = "This email has already been registered. Please use a different email address or try signing in instead.";
        } else if (error.message.includes('This username has already been taken')) {
          errorMessage = "This username has already been taken. Please choose a different username.";
        } else if (error.message.includes('Both email and username are already registered')) {
          errorMessage = "Both email and username are already registered. Please use different credentials or try signing in.";
        } else if (error.message.includes('duplicate') || error.message.includes('already exists')) {
          errorMessage = "An account with this email or username already exists. Please use different credentials.";
        } else if (error.message.includes('weak password') || error.message.includes('password')) {
          errorMessage = "Password is too weak. Please use a stronger password.";
        } else if (error.message.includes('invalid email') || error.message.includes('email')) {
          errorMessage = "Please enter a valid email address.";
        } else if (error.message.includes('row-level security policy') || error.code === '42501') {
          errorMessage = "Account creation is temporarily unavailable. Please try again later or contact support.";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Sign up failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
  }

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
            Create your account
          </h2>
          <p className="auth-subtitle auth-slide-up" style={{ animationDelay: '0.25s' }}>
            Join Jigri and start connecting
          </p>
        </div>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="auth-form auth-slide-up" style={{ animationDelay: '0.35s' }}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="auth-label">Name</FormLabel>
                <FormControl>
                  <Input type="text" className="auth-input" placeholder="Your full name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="auth-label">Username</FormLabel>
                <FormControl>
                  <Input type="text" className="auth-input" placeholder="Choose a username" {...field} />
                </FormControl>
                {getAvailabilityMessage('username')}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="auth-label">Email</FormLabel>
                <FormControl>
                  <Input type="text" className="auth-input" placeholder="you@example.com" {...field} />
                </FormControl>
                {getAvailabilityMessage('email')}
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

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="auth-label">Confirm Password</FormLabel>
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    className="auth-input"
                    placeholder="••••••••"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="auth-submit-btn"
            disabled={
              isCreatingAccount ||
              isSigningInUser ||
              availabilityStatus.email === 'taken' ||
              availabilityStatus.username === 'taken' ||
              availabilityStatus.email === 'checking' ||
              availabilityStatus.username === 'checking'
            }
          >
            {isCreatingAccount || isSigningInUser ? (
              <div className="flex-center gap-2">
                <Loader /> Creating account...
              </div>
            ) : availabilityStatus.email === 'taken' || availabilityStatus.username === 'taken' ? (
              "Please fix availability issues"
            ) : (
              "Sign up"
            )}
          </Button>

          <p className="auth-switch-text">
            Already have an account?{" "}
            <Link href="/sign-in" className="auth-switch-link">
              Sign in
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
  )
}

export default SignupForm