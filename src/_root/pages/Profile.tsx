"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useUserContext } from "@/context/SupabaseAuthContext";
import { 
  useGetUserById, 
  useGetUserPosts, 
  useGetFollowersCount, 
  useGetFollowingCount,
  useIsFollowing,
  useFollowUser,
  useUnfollowUser
} from "@/lib/react-query/queriesAndMutations";
import Loader from "@/components/shared/Loader";
import GridPostList from "@/components/shared/GridPostList";
import LinkifiedText from "@/components/shared/LinkifiedText";
import LikedPosts from "./LikedPosts";
import { PRIVACY_SETTINGS } from "@/constants";

interface StabBlockProps {
  value: string | number;
  label: string;
}

const StatBlock = ({ value, label }: StabBlockProps) => (
  <div className="flex-center gap-2">
    <p className="small-semibold lg:body-bold text-primary-500">{value}</p>
    <p className="small-medium lg:base-medium text-light-2">{label}</p>
  </div>
);

type ProfileWrapperProps = {
  params: { id: string };
};

const ProfileWrapper = ({ params }: ProfileWrapperProps) => {
  const { user } = useUserContext();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'posts' | 'liked'>('posts');
  
  const id = params?.id;

  const { data: currentUser, isPending: isUserLoading, error: userError } = useGetUserById(id || "");
  const { data: userPosts, isPending: isPostsLoading } = useGetUserPosts(id || "");
  
  const { data: followersCount, isLoading: followersLoading } = useGetFollowersCount(id || "");
  const { data: followingCount, isLoading: followingLoading } = useGetFollowingCount(id || "");
  const { data: isCurrentlyFollowing, isLoading: isFollowingLoading } = useIsFollowing(id || "");
  
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();
  
  const handleFollowToggle = () => {
    if (!id) return;
    
    if (isCurrentlyFollowing) {
      unfollowMutation.mutate(id);
    } else {
      followMutation.mutate(id);
    }
  };

  // ==================================================================
  // NEW ROBUST SHARE/COPY FUNCTION
  // ==================================================================
  const handleShareProfile = async () => {
    const url = window.location.href;

    // --- 1. Try Web Share API (Mobile, HTTPS only) ---
    if (navigator.share && window.location.protocol === 'https:') {
      try {
        await navigator.share({
          title: `${currentUser.name}'s Profile`,
          text: `Check out ${currentUser.name}'s profile (@${currentUser.username})!`,
          url: url,
        });
        return; // Success!
      } catch (error) {
        console.error("Web Share API failed:", error);
      }
    }

    // --- 2. Fallback to Modern Clipboard API (If available) ---
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied", description: "Profile link copied to clipboard." });
        return; // Success!
      } catch (error) {
        console.error("Clipboard API failed:", error);
      }
    }

    // --- 3. Ultimate Fallback: Legacy execCommand (for HTTP/older browsers) ---
    try {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      textArea.style.position = "absolute";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      toast({ title: "Link copied", description: "Profile link copied to clipboard." });
    } catch (error) {
      console.error("Legacy copy command failed:", error);
      toast({
        title: "Copy failed",
        description: "Could not copy link automatically. Please copy it manually.",
        variant: "destructive",
      });
    }
  };
  // ==================================================================

  const isOwnProfile = user?.id === id;

  if (isUserLoading) {
    return <div className="flex-center w-full h-full"><Loader /></div>;
  }
  if (userError) {
    return <div className="flex-center w-full h-full"><p className="text-light-1">Error loading user profile</p></div>;
  }
  if (!currentUser) {
    return <div className="flex-center w-full h-full"><p className="text-light-1">User not found</p></div>;
  }

  const ActionButtons = () => (
    <div className="flex gap-2 w-full mt-3">
      {isOwnProfile ? (
        <>
          <Link
            href={`/update-profile/${currentUser.id}`}
            className="h-10 bg-dark-4 px-4 text-light-1 flex-center gap-2 rounded-lg hover:bg-dark-3 flex-1"
          >
            <p className="flex whitespace-nowrap small-medium">Edit Profile</p>
          </Link>
          <Link
            href="/settings"
            className="h-10 bg-dark-4 px-4 text-light-1 flex-center gap-2 rounded-lg hover:bg-dark-3 flex-1"
          >
            <img src="/assets/icons/settings.svg" alt="settings" width={16} height={16} className="invert-white" />
            <p className="flex whitespace-nowrap small-medium">Settings</p>
          </Link>
          <Button type="button" className="h-10 bg-dark-4 px-4 text-light-1 rounded-lg hover:bg-dark-3 flex-1" onClick={handleShareProfile}>
            <p className="flex whitespace-nowrap small-medium">Share Profile</p>
          </Button>
        </>
      ) : (
        <>
          <Button
            type="button"
            className={`h-10 px-4 text-light-1 flex-center gap-2 rounded-lg flex-1 ${
              isCurrentlyFollowing 
                ? "bg-dark-4 hover:bg-dark-3" 
                : "bg-primary-500 hover:bg-primary-600"
            }`}
            onClick={handleFollowToggle}
            disabled={followMutation.isPending || unfollowMutation.isPending || isFollowingLoading}
          >
            <p className="flex whitespace-nowrap small-medium">
              {followMutation.isPending || unfollowMutation.isPending 
                ? "Loading..." 
                : isCurrentlyFollowing 
                  ? "Following" 
                  : "Follow"
              }
            </p>
          </Button>
          <Button type="button" className="h-10 bg-dark-4 px-4 text-light-1 rounded-lg hover:bg-dark-3 flex-1" onClick={handleShareProfile}>
            <p className="flex whitespace-nowrap small-medium">Share Profile</p>
          </Button>
        </>
      )}
    </div>
  );

  return (
    <div className="profile-container pb-20 md:pb-8">
      <div className="flex flex-col w-full max-w-5xl">
        <div className="flex flex-row items-center gap-4 sm:gap-6 w-full">
          <img
            src={currentUser.image_url || "/assets/icons/profile-placeholder.svg"}
            alt="profile"
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex-shrink-0"
          />
          <div className="flex flex-col items-start w-full">
            <h1 className="text-left text-xl sm:text-2xl font-bold">
              {currentUser.name}
            </h1>
            <div className="relative group">
              <p 
                className={`text-sm text-light-3 text-left ${currentUser.username_change_count > 0 ? 'cursor-help hover:text-primary-500 transition-colors' : ''}`}
                onClick={() => {
                  if (currentUser.username_change_count > 0) {
                    toast({
                      title: "Account History",
                      description: `This user has changed their username ${currentUser.username_change_count} ${currentUser.username_change_count === 1 ? 'time' : 'times'}.`,
                    });
                  }
                }}
              >
                @{currentUser.username}
              </p>
              {currentUser.username_change_count > 0 && (
                <div className="absolute left-0 -top-6 hidden group-hover:block bg-dark-4 text-light-2 text-[10px] px-2 py-0.5 rounded border border-dark-4 whitespace-nowrap z-10 shadow-xl">
                  {currentUser.username_change_count} {currentUser.username_change_count === 1 ? 'change' : 'changes'}
                </div>
              )}
            </div>

            {/* Privacy indicator */}
            {isOwnProfile && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-light-3">Privacy:</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm">
                    {PRIVACY_SETTINGS.find(setting => setting.value === currentUser.privacy_setting)?.icon || "🌍"}
                  </span>
                  <span className="text-xs text-light-2 capitalize">
                    {PRIVACY_SETTINGS.find(setting => setting.value === currentUser.privacy_setting)?.label || "Public"}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-4 sm:gap-6 mt-3">
              <StatBlock value={isPostsLoading ? "..." : userPosts?.length || 0} label="Posts" />
              <StatBlock value={followersLoading ? "..." : followersCount || 0} label="Followers" />
              <StatBlock value={followingLoading ? "..." : followingCount || 0} label="Following" />
            </div>
          </div>
        </div>
        
        <div className="mt-2 w-full">
            <LinkifiedText 
              text={currentUser.bio || ""}
              className="text-sm text-left"
            />
        </div>

        {isOwnProfile && (followersCount || 0) === 0 && (
          <div className="mt-3 w-full rounded-lg border border-dark-4 bg-dark-3/20 p-3 text-sm text-light-3">
            Grow your network by following people you know.
            <Link href="/all-users" className="ml-2 text-primary-500 hover:text-primary-400">
              Find people
            </Link>
          </div>
        )}

        <ActionButtons />
        

      </div>
      
      <div className="flex border-t border-dark-4 w-full max-w-5xl mt-2 pt-2">
        {currentUser.id === user?.id && (
          <div className="flex max-w-5xl w-full">
            <button
              onClick={() => setActiveTab('posts')}
              className={`profile-tab rounded-l-lg ${
                activeTab === 'posts' && "!bg-dark-3"
              }`}
            >
              <img src={"/assets/icons/posts.svg"} alt="posts" width={20} height={20} />
              Posts
            </button>
            <button
              onClick={() => setActiveTab('liked')}
              className={`profile-tab rounded-r-lg ${
                activeTab === 'liked' && "!bg-dark-3"
              }`}
            >
              <img src={"/assets/icons/like.svg"} alt="like" width={20} height={20} />
              Liked Posts
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-5xl mt-4">
        {activeTab === 'posts' ? (
          userPosts && userPosts.length > 0 ? (
            <GridPostList posts={userPosts} showUser={false} showComments={false} />
          ) : (
            <div className="w-full rounded-xl border border-dark-4 bg-dark-3/20 p-8 text-center">
              <p className="text-light-3 font-medium">No posts yet</p>
              {isOwnProfile ? (
                <>
                  <p className="text-light-4 text-sm mt-2">Share your first post to get started.</p>
                  <Link href="/create-post" className="inline-block mt-3 text-primary-500 hover:text-primary-400 text-sm font-medium">
                    Create your first post
                  </Link>
                </>
              ) : (
                <p className="text-light-4 text-sm mt-2">Posts shared by this user will appear here.</p>
              )}
            </div>
          )
        ) : (
          currentUser.id === user?.id && <LikedPosts />
        )}
      </div>
    </div>
  );
};

export default ProfileWrapper;