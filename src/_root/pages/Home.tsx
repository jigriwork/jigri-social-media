"use client";

import Link from "next/link";

import {
  useGetFollowingFeed,
  useGetFollowingCount,
  useGetUserPosts,
} from "@/lib/react-query/queriesAndMutations";
import { useUserContext } from "@/context/SupabaseAuthContext";
import PostCard from "@/components/shared/PostCard";
import FeedFilter from "@/components/shared/FeedFilter";
import NotificationBell from "@/components/shared/NotificationBell";
import { useState, useMemo } from "react";

const Home = () => {
  const { user } = useUserContext();

  const {
    data: posts,
    isPending: isPostLoading,
    isError: isErrorPosts,
  } = useGetFollowingFeed();

  const { data: followingCount } = useGetFollowingCount(user?.id || "");
  const { data: ownPosts } = useGetUserPosts(user?.id || "");

  const [activeFilter, setActiveFilter] = useState("all");

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    if (activeFilter === "all") return posts;
    if (activeFilter === "pics") return posts.filter((p: any) => !!p.image_url);
    if (activeFilter === "notes") return posts.filter((p: any) => !p.image_url);
    if (activeFilter === "clips") return posts.filter((p: any) => p.video_url || false);
    return posts;
  }, [posts, activeFilter]);

  const missedPosts = (posts || []).slice(3, 6);

  const onboardingSteps = [
    {
      key: "photo",
      done: !!user?.image_url,
      label: "Upload profile photo",
      href: user?.id ? `/update-profile/${user.id}` : "/update-profile",
    },
    {
      key: "follow",
      done: (followingCount || 0) >= 3,
      label: "Follow at least 3 people",
      href: "/all-users",
    },
    {
      key: "post",
      done: (ownPosts?.length || 0) > 0,
      label: "Create your first post",
      href: "/create-post",
    },
  ];

  const onboardingCompleted = onboardingSteps.filter((step) => step.done).length;
  const showOnboarding = !!user?.id && onboardingCompleted < onboardingSteps.length;

  if (isErrorPosts) {
    return (
      <div className="flex flex-1">
        <div className="home-container">
          <p className="body-medium text-light-1">Something went wrong while loading the feed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-row flex-1 w-full">
      <div className="home-container">
        <div className="home-posts">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full mb-8">
            <h2 className="h3-bold md:h2-bold text-left bg-gradient-to-r from-white to-light-4 bg-clip-text text-transparent">Following Feed</h2>
            <div className="flex items-center gap-4">
              <FeedFilter activeFilter={activeFilter} onFilterChange={setActiveFilter} />
              <div className="hidden md:block">
                <NotificationBell />
              </div>
            </div>
          </div>

          {showOnboarding && (
            <div className="w-full rounded-xl border border-dark-4 bg-dark-3/30 p-4">
              <p className="text-sm text-light-2 font-semibold">
                Getting started ({onboardingCompleted}/{onboardingSteps.length})
              </p>
              <ul className="mt-2 space-y-2">
                {onboardingSteps.map((step) => (
                  <li key={step.key} className="flex items-center justify-between gap-3">
                    <p className={`text-sm ${step.done ? "text-light-3" : "text-light-2"}`}>
                      {step.done ? "✓" : "○"} {step.label}
                    </p>
                    {!step.done && (
                      <Link href={step.href} className="text-xs text-primary-500 hover:text-primary-400">
                        Continue
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isPostLoading && !posts ? (
            <div className="w-full space-y-4">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="w-full rounded-2xl border border-dark-4 bg-dark-3/20 p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-dark-4" />
                    <div className="space-y-2 flex-1">
                      <div className="h-3 w-1/3 rounded bg-dark-4" />
                      <div className="h-2 w-1/4 rounded bg-dark-4" />
                    </div>
                  </div>
                  <div className="mt-4 h-56 w-full rounded-xl bg-dark-4" />
                </div>
              ))}
            </div>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full max-w-6xl mx-auto">
              {filteredPosts && filteredPosts.length > 0 ? (
                <>
                  {filteredPosts.map((post: any, index: number) => (
                    <li key={post.id} className="flex justify-center w-full">
                      <PostCard post={post} />
                      {index === 2 && missedPosts.length > 0 && (
                        <div className="mt-4 w-full rounded-xl border border-dark-4 bg-dark-3/20 p-4">
                          <p className="text-sm font-semibold text-light-2">You might have missed this</p>
                          <div className="mt-3 space-y-2">
                            {missedPosts.map((missed: any) => (
                              <Link
                                key={`missed-${missed.id}`}
                                href={`/posts/${missed.id}`}
                                className="block rounded-lg border border-dark-4/60 bg-dark-4/20 px-3 py-2 hover:border-primary-500/40"
                              >
                                <p className="text-xs text-light-2 line-clamp-1">
                                  {missed.caption || "New post"}
                                </p>
                                <p className="text-[11px] text-light-4 mt-1">
                                  by @{missed.creator?.username || "user"}
                                </p>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-dark-3 flex items-center justify-center mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-light-4">
                      <path d="M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 14C16.4183 14 20 17.5817 20 22H4C4 17.5817 7.58172 14 12 14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <h3 className="text-light-2 text-lg font-semibold mb-2">Your feed is empty</h3>
                  <p className="text-light-4 text-sm mb-4 max-w-sm">
                    Follow other people to see their posts in your feed, or create your first post!
                  </p>
                  <div className="flex gap-3 flex-wrap justify-center">
                    <Link
                      href="/explore"
                      className="text-primary-500 hover:text-primary-400 text-sm font-medium"
                    >
                      Explore Posts
                    </Link>
                    <span className="text-light-4">•</span>
                    <Link
                      href="/all-users"
                      className="text-primary-500 hover:text-primary-400 text-sm font-medium"
                    >
                      Find People
                    </Link>
                    <span className="text-light-4">•</span>
                    <Link
                      href="/create-post"
                      className="text-primary-500 hover:text-primary-400 text-sm font-medium"
                    >
                      Create Post
                    </Link>
                  </div>
                </div>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
