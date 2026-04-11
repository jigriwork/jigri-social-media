"use client";

import React from "react";
import Link from "next/link";
import { useGetSuggestedUsers } from "@/lib/react-query/queriesAndMutations";
import { useUserContext } from "@/context/SupabaseAuthContext";

const RightSidebar = () => {
  const { user } = useUserContext();
  
  const {
    data: creators,
    isPending: isUserLoading,
    isError: isErrorCreators,
  } = useGetSuggestedUsers(5);

  const suggestedUsers = creators?.filter((creator: any) => creator.id !== user?.id).slice(0, 4) || [];

  const trendingTopics = [
    { tag: "#Design2026", posts: "24.5k" },
    { tag: "#NextJS", posts: "18.2k" },
    { tag: "#Frontend", posts: "12.4k" },
    { tag: "#Supabase", posts: "8.1k" },
  ];

  return (
    <div className="rightsidebar">
      {/* Search / Explore Area (Optional) */}
      <div className="w-full relative">
        <input 
          type="text" 
          placeholder="Search..." 
          className="w-full bg-dark-4/50 border border-dark-4/60 rounded-full py-2.5 px-5 text-sm text-light-1 focus:outline-none focus:border-primary-500/50 focus:bg-dark-4/80 transition-all"
        />
        <img src="/assets/icons/search.svg" alt="search" className="absolute right-4 top-3 w-4 h-4 opacity-50" />
      </div>

      {/* Suggested Users */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-light-1">Who to follow</h3>
        {isErrorCreators && <p className="text-sm text-light-4">Failed to load suggestions.</p>}
        {isUserLoading && !creators ? (
          <div className="flex flex-col gap-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-16 w-full rounded-xl bg-dark-4/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {suggestedUsers && suggestedUsers.length > 0 ? (
              suggestedUsers.map((creator: any) => (
                <div key={creator?.id} className="flex items-center justify-between p-3 rounded-2xl bg-dark-2/40 border border-dark-4/30 hover:bg-dark-2/80 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <img 
                      src={creator.image_url || "/assets/icons/profile-placeholder.svg"} 
                      alt="creator" 
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex flex-col min-w-0">
                      <Link href={`/profile/${creator.id}`} className="text-sm font-semibold text-light-1 truncate hover:text-primary-500">
                        {creator.name}
                      </Link>
                      <p className="text-xs text-light-3 truncate max-w-[120px]">@{creator.username}</p>
                    </div>
                  </div>
                  <Link href={`/profile/${creator.id}`} className="bg-light-1 text-dark-1 text-xs font-bold px-4 py-1.5 rounded-full hover:bg-light-2 transition-colors">
                    View
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-sm text-light-4 bg-dark-4/20 p-4 rounded-xl border border-dark-4/30 text-center">
                You're all caught up 👌
              </p>
            )}
          </div>
        )}
      </div>

      {/* Trending Topics */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-light-1">Trending</h3>
        <div className="flex flex-col bg-dark-2/40 border border-dark-4/30 rounded-2xl overflow-hidden">
          {trendingTopics.map((topic, i) => (
            <Link 
              key={i} 
              href={`/explore?search=${encodeURIComponent(topic.tag)}`}
              className={`flex flex-col gap-1 p-4 hover:bg-dark-4/40 transition-colors ${i !== trendingTopics.length - 1 ? 'border-b border-dark-4/30' : ''}`}
            >
              <span className="text-xs text-light-4 font-medium uppercase tracking-wider">Trending Topic</span>
              <span className="font-bold text-light-1">{topic.tag}</span>
              <span className="text-xs text-light-4">{topic.posts} posts</span>
            </Link>
          ))}
        </div>
      </div>
      
      {/* Footer Links */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-auto px-2">
        <a href="#" className="text-xs text-light-4 hover:underline">About</a>
        <a href="#" className="text-xs text-light-4 hover:underline">Help Center</a>
        <a href="#" className="text-xs text-light-4 hover:underline">Terms</a>
        <a href="#" className="text-xs text-light-4 hover:underline">Privacy Policy</a>
        <span className="text-xs text-light-4">© 2026 Jigri</span>
      </div>
    </div>
  );
};

export default RightSidebar;
