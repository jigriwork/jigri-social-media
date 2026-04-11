"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useUserContext } from "@/context/SupabaseAuthContext";
import { useUpdateUser, useGetCurrentUser } from "@/lib/react-query/queriesAndMutations";
import { updateUserPassword, signOutUser } from "@/lib/supabase/api";
import { useToast } from "@/components/ui/use-toast";
import { INITIAL_USER, PRIVACY_SETTINGS } from "@/constants";
import Loader from "@/components/shared/Loader";
import ProfileUploader from "@/components/shared/ProfileUploder";

const Settings = () => {
  const { toast } = useToast();
  const router = useRouter();
  const { user, setUser, setIsAuthenticated } = useUserContext();
  const { refetch: refetchCurrentUser } = useGetCurrentUser();
  const { mutateAsync: updateUser, isPending: isUpdating } = useUpdateUser();

  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [privacySetting, setPrivacySetting] = useState(user?.privacy_setting || "public");
  const [profileFile, setProfileFile] = useState<File[]>([]);


  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setBio(user.bio || "");
      setPrivacySetting(user.privacy_setting || "public");
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user) return;

    try {
      const updatedUser = await updateUser({
        userId: user.id,
        name,
        username: user.username,
        email: user.email,
        bio,
        privacy_setting: privacySetting,
        file: profileFile,
        imageUrl: user.image_url || undefined,
      });

      if (updatedUser) {
        setUser({
          ...user,
          name: updatedUser.name,
          bio: updatedUser.bio,
          image_url: updatedUser.image_url,
          privacy_setting: updatedUser.privacy_setting,
        });
        await refetchCurrentUser();
        toast({ title: "Profile updated successfully!" });
        setProfileFile([]);
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ title: "Failed to update profile. Please try again." });
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({ title: "Please fill in all password fields." });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match." });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters." });
      return;
    }

    setIsChangingPassword(true);
    try {
      await updateUserPassword(newPassword);
      toast({ title: "Password updated successfully!" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast({ title: error.message || "Failed to change password." });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
      setIsAuthenticated(false);
      setUser(INITIAL_USER as any);
      router.push("/sign-in");
    } catch (error) {
      console.error("Error logging out:", error);
      toast({ title: "Failed to log out." });
    }
  };

  if (!user) return <Loader />;

  return (
    <div className="common-container pb-32 md:pb-12">
      <div className="flex-start gap-3 justify-start w-full max-w-3xl">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-light-1">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
        </svg>
        <h2 className="h3-bold md:h2-bold text-left w-full">Settings</h2>
      </div>

      <div className="flex flex-col gap-8 w-full max-w-3xl mt-6">
        {/* Profile Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-dark-2 rounded-2xl p-6 border border-dark-4/30"
        >
          <h3 className="text-lg font-semibold text-light-1 mb-6">Profile Information</h3>

          {/* Profile Image */}
          <div className="mb-6">
            <ProfileUploader
              fieldChange={(files: File[]) => setProfileFile(files)}
              mediaUrl={user.image_url || ""}
            />
          </div>

          {/* Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-light-2 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-dark-3 border border-dark-4/50 rounded-lg px-4 py-3 text-sm text-light-1 placeholder:text-light-4 outline-none focus:border-primary-500/50 transition-colors"
            />
          </div>

          {/* Username (managed from Edit Profile) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-light-2 mb-2">Username</label>
            <input
              type="text"
              value={user.username || ""}
              disabled
              className="w-full bg-dark-4/50 border border-dark-4/50 rounded-lg px-4 py-3 text-sm text-light-3 cursor-not-allowed"
            />
            <p className="text-xs text-light-4 mt-1">
              Username can be changed from the{" "}
              <Link
                href={`/update-profile/${user.id}`}
                className="text-primary-500 hover:text-primary-400 underline underline-offset-2"
              >
                Edit Profile
              </Link>
              {" "}page.
            </p>
          </div>

          {/* Email (read-only) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-light-2 mb-2">Email</label>
            <input
              type="text"
              value={user.email || ""}
              disabled
              className="w-full bg-dark-4/50 border border-dark-4/50 rounded-lg px-4 py-3 text-sm text-light-3 cursor-not-allowed"
            />
          </div>

          {/* Bio */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-light-2 mb-2">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full bg-dark-3 border border-dark-4/50 rounded-lg px-4 py-3 text-sm text-light-1 placeholder:text-light-4 outline-none focus:border-primary-500/50 transition-colors resize-none custom-scrollbar"
              placeholder="Tell the world about yourself..."
            />
          </div>

          {/* Privacy Setting */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-light-2 mb-2">Privacy</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PRIVACY_SETTINGS.map((setting) => (
                <button
                  key={setting.value}
                  onClick={() => setPrivacySetting(setting.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${privacySetting === setting.value
                      ? "border-primary-500 bg-primary-500/10"
                      : "border-dark-4/50 bg-dark-3 hover:border-dark-4"
                    }`}
                >
                  <span className="text-lg">{setting.icon}</span>
                  <p className="text-sm font-medium text-light-1 mt-1">{setting.label}</p>
                  <p className="text-xs text-light-4 mt-0.5">{setting.description}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleUpdateProfile}
            disabled={isUpdating}
            className="w-full sm:w-auto px-8 py-3 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isUpdating && <Loader />}
            Save Changes
          </button>
        </motion.section>

        {/* Password Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-dark-2 rounded-2xl p-6 border border-dark-4/30"
        >
          <h3 className="text-lg font-semibold text-light-1 mb-6">Change Password</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-light-2 mb-2">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full bg-dark-3 border border-dark-4/50 rounded-lg px-4 py-3 pr-12 text-sm text-light-1 placeholder:text-light-4 outline-none focus:border-primary-500/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-light-4 hover:text-light-2 transition-colors p-1"
              >
                {showNewPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-light-2 mb-2">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full bg-dark-3 border border-dark-4/50 rounded-lg px-4 py-3 pr-12 text-sm text-light-1 placeholder:text-light-4 outline-none focus:border-primary-500/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-light-4 hover:text-light-2 transition-colors p-1"
              >
                {showConfirmPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            onClick={handleChangePassword}
            disabled={isChangingPassword || !newPassword || !confirmPassword}
            className="w-full sm:w-auto px-8 py-3 bg-dark-3 hover:bg-dark-4 disabled:opacity-50 text-light-1 rounded-lg text-sm font-medium transition-colors border border-dark-4/50 flex items-center justify-center gap-2"
          >
            {isChangingPassword && <Loader />}
            Update Password
          </button>
        </motion.section>

        {/* Danger Zone */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-dark-2 rounded-2xl p-6 border border-dark-4/30"
        >
          <h3 className="text-lg font-semibold text-light-1 mb-4">Account</h3>
          <p className="text-sm text-light-4 mb-4">Sign out of your Jigri account on this device.</p>
          <button
            onClick={handleLogout}
            className="px-8 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium transition-colors border border-red-600/30"
          >
            Log Out
          </button>
        </motion.section>

        {/* Privacy Policy Placeholder */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-dark-2 rounded-2xl p-6 border border-dark-4/30"
        >
          <h3 className="text-lg font-semibold text-light-1 mb-2">Legal</h3>
          <p className="text-sm text-light-4">
            By using Jigri, you agree to our Terms of Service and Privacy Policy.
          </p>
          <p className="text-xs text-light-4 mt-3">Jigri v1.0 — Phase 5B</p>
        </motion.section>
      </div>
    </div>
  );
};

export default Settings;
