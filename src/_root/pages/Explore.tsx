"use client";

import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import useDebounce from "@/hooks/useDebounce";
import { useGetPosts, useSearchPosts, useSearchUsers } from "@/lib/react-query/queriesAndMutations";
import Loader from "@/components/shared/Loader";
import GridPostList from "@/components/shared/GridPostList";
import { Input } from "@/components/ui";

export type SearchResultProps = {
  isSearchFetching: boolean;
  searchedPosts: any;
};

const SearchResults = ({ isSearchFetching, searchedPosts }: SearchResultProps) => {
  if (isSearchFetching) {
    return <Loader />;
  } else if (searchedPosts && searchedPosts.length > 0) {
    return <GridPostList posts={searchedPosts} />;
  } else {
    return (
      <p className="text-light-4 mt-10 text-center w-full">No results found</p>
    );
  }
};

const Explore = () => {
  const { ref, inView } = useInView();
  const searchParams = useSearchParams();
  const { data: posts, fetchNextPage, hasNextPage, error, refetch } = useGetPosts();

  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
  const [activeTab, setActiveTab] = useState<"posts" | "users">("posts");
  const debouncedSearch = useDebounce(searchValue, 500);
  const { data: searchedPosts, isFetching: isSearchFetching } = useSearchPosts(debouncedSearch);
  const { data: searchedUsers, isFetching: isUserSearchFetching } = useSearchUsers(debouncedSearch, 20);

  useEffect(() => {
    setSearchValue(searchParams.get("search") || "");
  }, [searchParams]);

  useEffect(() => {
    if (inView && !searchValue) {
      fetchNextPage();
    }
  }, [inView, searchValue]);

  if (!posts)
    return (
      <div className="flex-center w-full h-full">
        <Loader />
      </div>
    );

  // Check if there's an error or no data
  if (error || (posts && posts.pages.length === 0)) {
    return (
      <div className="flex-center flex-col w-full h-full gap-4">
        <p className="text-light-4">Failed to load posts</p>
        <button 
          onClick={() => refetch()} 
          className="shad-button_primary"
        >
          Try Again
        </button>
      </div>
    );
  }

  const shouldShowSearchResults = searchValue !== "";
  const shouldShowEmptyMessage = !shouldShowSearchResults && 
    posts.pages.every((item) => item && item.documents && item.documents.length === 0);

  const userResults = searchedUsers?.filter((u: any) => u) || [];

  return (
    <div className="explore-container">
      <div className="explore-inner_container">
        <h2 className="h3-bold md:h2-bold w-full">Search Posts</h2>
        <div className="flex gap-1 px-4 w-full rounded-lg bg-dark-4">
          <img
            src="/assets/icons/search.svg"
            width={24}
            height={24}
            alt="search"
          />
          <Input
            type="text"
            placeholder="Search posts, users, tags..."
            className="explore-search"
            value={searchValue}
            onChange={(e) => {
              const { value } = e.target;
              setSearchValue(value);
            }}
          />
          {searchValue && (
            <button
              onClick={() => setSearchValue("")}
              className="text-light-4 hover:text-light-2 transition-colors px-2"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Search Results with Tabs */}
      {shouldShowSearchResults ? (
        <div className="w-full max-w-5xl mt-8">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-dark-4/50">
            <button
              onClick={() => setActiveTab("posts")}
              className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                activeTab === "posts"
                  ? "text-primary-500"
                  : "text-light-3 hover:text-light-2"
              }`}
            >
              Posts
              {searchedPosts && searchedPosts.length > 0 && (
                <span className="ml-2 text-xs bg-dark-3 px-2 py-0.5 rounded-full">
                  {searchedPosts.length}
                </span>
              )}
              {activeTab === "posts" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                activeTab === "users"
                  ? "text-primary-500"
                  : "text-light-3 hover:text-light-2"
              }`}
            >
              People
              {userResults.length > 0 && (
                <span className="ml-2 text-xs bg-dark-3 px-2 py-0.5 rounded-full">
                  {userResults.length}
                </span>
              )}
              {activeTab === "users" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "posts" ? (
            <div className="flex flex-wrap gap-9 w-full">
              <SearchResults
                isSearchFetching={isSearchFetching}
                searchedPosts={searchedPosts}
              />
            </div>
          ) : (
            <div className="w-full">
              {isUserSearchFetching ? (
                <div className="flex justify-center py-10"><Loader /></div>
              ) : userResults.length === 0 ? (
                <p className="text-light-4 text-center py-10">No users found matching &quot;{debouncedSearch}&quot;</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {userResults.map((u: any) => (
                    <Link
                      key={u.id}
                      href={`/profile/${u.id}`}
                      className="flex items-center gap-4 p-4 bg-dark-3/30 hover:bg-dark-3/60 rounded-xl border border-dark-4/30 transition-colors"
                    >
                      <img
                        src={u.image_url || "/assets/icons/profile-placeholder.svg"}
                        alt={u.name}
                        className="w-12 h-12 rounded-full object-cover border border-dark-4"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-light-1 text-sm truncate">{u.name}</p>
                        <p className="text-xs text-light-4 truncate">@{u.username}</p>
                        {u.bio && (
                          <p className="text-xs text-light-3 mt-1 line-clamp-1">{u.bio}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex-between w-full max-w-5xl mt-16 mb-7">
            <h3 className="body-bold md:h3-bold">Popular Today</h3>

            <div className="flex gap-3">
              <button 
                onClick={() => refetch()} 
                className="flex-center gap-2 bg-dark-3 rounded-xl px-4 py-2 cursor-pointer hover:bg-dark-2"
                title="Refresh posts"
              >
                <p className="small-medium md:base-medium text-light-2">Refresh</p>
                <img
                  src="/assets/icons/loader.svg"
                  width={16}
                  height={16}
                  alt="refresh"
                  className="invert-white"
                />
              </button>
              <div className="flex-center gap-3 bg-dark-3 rounded-xl px-4 py-2 cursor-pointer">
                <p className="small-medium md:base-medium text-light-2">All</p>
                <img
                  src="/assets/icons/filter.svg"
                  width={20}
                  height={20}
                  alt="filter"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-9 w-full max-w-5xl">
            {shouldShowEmptyMessage ? (
              <p className="text-light-4 mt-10 text-center w-full">End of posts</p>
            ) : (
              posts.pages
              .filter((item) => item !== undefined)
              .map((item, index) => (
                <GridPostList key={`page-${index}`} posts={item.documents} />
              ))
            )}
          </div>

          {hasNextPage && !searchValue && (
            <div ref={ref} className="mt-10">
              <Loader />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Explore;
