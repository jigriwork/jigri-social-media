"use client";

import React from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, useNavigate } from "react-router-dom";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/components/ui/use-toast";
import { Textarea, Input, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { PRIVACY_SETTINGS } from "@/constants";


import { ProfileValidation } from "@/lib/validation";
import { useUserContext } from "@/context/SupabaseAuthContext";
import { useGetUserById, useUpdateUser, useGetCurrentUser, useUpdateUsername } from "@/lib/react-query/queriesAndMutations";
import Loader from "@/components/shared/Loader";
import ProfileUploader from "@/components/shared/ProfileUploder";
import { checkUsernameAvailability } from "@/lib/supabase/api";

const UpdateProfile = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, setUser } = useUserContext();

  const userId = Array.isArray(id) ? id[0] : id;
  // Queries
  const { data: currentUser } = useGetUserById(userId || "");
  const { refetch: refetchCurrentUser } = useGetCurrentUser();
  const { mutateAsync: updateUser, isPending: isLoadingUpdate } =
    useUpdateUser();
  const { mutateAsync: updateUsername, isPending: isUpdatingUsername } =
    useUpdateUsername();

  const [isCheckingUsername, setIsCheckingUsername] = React.useState(false);
  const [usernameMessage, setUsernameMessage] = React.useState({ text: "", type: "" });
  const [canChangeUsername, setCanChangeUsername] = React.useState(true);
  const [nextChangeDate, setNextChangeDate] = React.useState<Date | null>(null);

  const form = useForm<z.infer<typeof ProfileValidation>>({
    resolver: zodResolver(ProfileValidation),
    defaultValues: {
      file: [],
      name: currentUser?.name || "",
      username: currentUser?.username || "",
      email: currentUser?.email || "",
      bio: currentUser?.bio || "",
      privacy_setting: currentUser?.privacy_setting || "public",
    },
  });

  // Update form when currentUser data loads
  React.useEffect(() => {
    if (currentUser) {
      form.reset({
        file: [],
        name: currentUser.name || "",
        username: currentUser.username || "",
        email: currentUser.email || "",
        bio: currentUser.bio || "",
        privacy_setting: currentUser.privacy_setting || "public",
      });
    }
  }, [currentUser, form]);

  // Check 30-day rule on load
  React.useEffect(() => {
    if (currentUser?.username_last_changed) {
      const lastChanged = new Date(currentUser.username_last_changed);
      const nextDate = new Date(lastChanged);
      nextDate.setDate(nextDate.getDate() + 30);

      const now = new Date();
      if (now < nextDate) {
        setCanChangeUsername(false);
        setNextChangeDate(nextDate);
      }
    }
  }, [currentUser]);

  const handleUsernameCheck = async (username: string) => {
    if (!username || username === currentUser?.username) {
      setUsernameMessage({ text: "", type: "" });
      return;
    }

    if (username.length < 2) return;

    setIsCheckingUsername(true);
    try {
      const isAvailable = await checkUsernameAvailability(username);
      if (isAvailable) {
        setUsernameMessage({ text: "Username is available!", type: "success" });
      } else {
        setUsernameMessage({ text: "This username is already taken.", type: "error" });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const debouncedCheck = React.useRef(
    (() => {
      let timeout: NodeJS.Timeout;
      return (val: string) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => handleUsernameCheck(val), 500);
      };
    })()
  ).current;

  if (!currentUser)
    return (
      <div className="flex-center w-full h-full">
        <Loader />
      </div>
    );

  // Handler
  const handleUpdate = async (value: z.infer<typeof ProfileValidation>) => {
    try {
      const trimmedUsername = value.username.trim();
      let finalUsername = currentUser.username;

      if (trimmedUsername !== currentUser.username) {
        if (!canChangeUsername) {
          toast({
            title: nextChangeDate
              ? `You can change your username again on ${nextChangeDate.toLocaleDateString()}`
              : "Username cannot be changed right now.",
            variant: "destructive",
          });
          return;
        }

        if (trimmedUsername.length < 2) {
          toast({
            title: "Username must be at least 2 characters.",
            variant: "destructive",
          });
          return;
        }

        const isAvailable = await checkUsernameAvailability(trimmedUsername);
        if (!isAvailable) {
          setUsernameMessage({ text: "This username is already taken.", type: "error" });
          toast({
            title: "This username is already taken.",
            variant: "destructive",
          });
          return;
        }

        const usernameResult = await updateUsername({
          userId: currentUser.id,
          newUsername: trimmedUsername,
        });

        finalUsername = usernameResult?.data?.username || trimmedUsername;
        setCanChangeUsername(false);
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 30);
        setNextChangeDate(nextDate);
        setUsernameMessage({ text: "", type: "" });
      }

      const updatedUser = await updateUser({
        userId: currentUser.id,
        name: value.name,
        username: finalUsername,
        email: value.email,
        bio: value.bio,
        privacy_setting: value.privacy_setting,
        file: value.file,
        imageUrl: currentUser.image_url,
      });

      if (!updatedUser) {
        toast({
          title: `Update user failed. Please try again.`,
        });
        return;
      }

      if (user) {
        setUser({
          ...user,
          name: updatedUser?.name || user.name,
          username: updatedUser?.username || finalUsername || user.username,
          email: updatedUser?.email || user.email,
          bio: updatedUser?.bio || user.bio,
          privacy_setting: updatedUser?.privacy_setting || user.privacy_setting,
          image_url: updatedUser?.image_url || user.image_url,
        });
      }

      // Force refresh current user data
      await refetchCurrentUser();

      toast({
        title: "Profile updated successfully!",
      });

      navigate(`/profile/${userId}`);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: `Update user failed. Please try again.`,
      });
    }
  };

  return (
    <div className="flex flex-1">
      <div className="common-container md:pt-12">
        <div className="flex-start gap-3 justify-start w-full max-w-5xl">
          <img
            src="/assets/icons/edit.svg"
            width={36}
            height={36}
            alt="edit"
            className="invert-white"
          />
          <h2 className="h3-bold md:h2-bold text-left w-full">Edit Profile</h2>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleUpdate)}
            className="flex flex-col gap-7 w-full mt-4 max-w-5xl">
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FormItem className="flex">
                  <FormControl>
                    <ProfileUploader
                      fieldChange={field.onChange}
                      mediaUrl={currentUser.image_url}
                    />
                  </FormControl>
                  <FormMessage className="shad-form_message" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="shad-form_label">Name</FormLabel>
                  <FormControl>
                    <Input type="text" className="shad-input" {...field} />
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
                  <FormLabel className="shad-form_label">Username</FormLabel>
                  <FormControl>
                    <div className="flex flex-col gap-2">
                      <div className="relative">
                        <Input
                          type="text"
                          className={`shad-input ${!canChangeUsername ? 'opacity-50 cursor-not-allowed' : ''}`}
                          {...field}
                          disabled={!canChangeUsername || isUpdatingUsername}
                          onChange={(e) => {
                            field.onChange(e);
                            debouncedCheck(e.target.value);
                          }}
                        />
                        {isCheckingUsername && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader />
                          </div>
                        )}
                      </div>

                      {!canChangeUsername && nextChangeDate && (
                        <p className="text-xs text-orange-500 font-medium px-1">
                          🔒 You can change your username again on {nextChangeDate.toLocaleDateString()}
                        </p>
                      )}

                      {canChangeUsername && usernameMessage.text && (
                        <p className={`text-xs font-medium px-1 ${usernameMessage.type === 'success' ? 'text-green-500' : 'text-red-500'
                          }`}>
                          {usernameMessage.text}
                        </p>
                      )}

                      {canChangeUsername && field.value !== currentUser?.username && !usernameMessage.text && (
                        <p className="text-xs text-light-4 px-1">
                          Your new username will be saved when you tap “Update Profile”.
                        </p>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="shad-form_label">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      className="shad-input"
                      {...field}
                      disabled
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="shad-form_label">Bio</FormLabel>
                  <FormControl>
                    <Textarea
                      className="shad-textarea custom-scrollbar"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="shad-form_message" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="privacy_setting"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="shad-form_label">Privacy Setting</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="shad-input">
                        <SelectValue placeholder="Select privacy level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRIVACY_SETTINGS.map((setting) => (
                        <SelectItem key={setting.value} value={setting.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{setting.label}</span>
                            <span className="text-sm text-light-3">{setting.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="shad-form_message" />
                </FormItem>
              )}
            />

            <div className="flex gap-4 items-center justify-end mobile-bottom-spacing">
              <Button
                type="button"
                className="shad-button_dark_4"
                onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="shad-button_primary whitespace-nowrap"
                disabled={isLoadingUpdate}>
                {isLoadingUpdate && <Loader />}
                Update Profile
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default UpdateProfile;
