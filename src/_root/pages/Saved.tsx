"use client";

import Link from "next/link";
import { useGetCurrentUser, useGetSavedPosts } from "@/lib/react-query/queriesAndMutations";
import Loader from "@/components/shared/Loader";
import GridPostList from "@/components/shared/GridPostList";

const Saved = () => {
  const { data: currentUser } = useGetCurrentUser();
  const { data: savedPosts, isLoading: isLoadingSaved } = useGetSavedPosts(currentUser?.id);

  if (!currentUser) {
    return <Loader />;
  }

  return (
    <div className="saved-container">
      <div className="flex gap-2 w-full max-w-5xl">
        <img
          src="/assets/icons/save.svg"
          width={36}
          height={36}
          alt="edit"
          className="invert-white"
        />
        <h2 className="h3-bold md:h2-bold text-left w-full">Saved Posts</h2>
      </div>

      {isLoadingSaved ? (
        <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="h-64 rounded-xl bg-dark-3/30 border border-dark-4 animate-pulse" />
          ))}
        </div>
      ) : (
        <ul className="w-full flex justify-center max-w-5xl gap-9">
          {!savedPosts || savedPosts.length === 0 ? (
            <div className="w-full rounded-xl border border-dark-4 bg-dark-3/20 p-8 text-center">
              <p className="text-light-3 font-medium">No saved posts yet</p>
              <p className="text-light-4 text-sm mt-2">Save posts you love to find them quickly later.</p>
              <Link href="/explore" className="inline-block mt-3 text-primary-500 hover:text-primary-400 text-sm font-medium">
                Explore posts
              </Link>
            </div>
          ) : (
            <GridPostList posts={savedPosts} showStats={false} />
          )}
        </ul>
      )}
    </div>
  );
};

export default Saved;
