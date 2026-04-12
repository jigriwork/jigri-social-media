"use client";
import AppLayout from "../../components/AppLayout";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useGetPostById, useGetPublicPostById } from "../../../src/lib/react-query/queriesAndMutations";
import { multiFormatDateString } from "../../../src/lib/utils";
import { useUserContext } from "../../../src/context/SupabaseAuthContext";
import { Button } from "../../../src/components/ui";
import Loader from "../../../src/components/shared/Loader";
import PostStats from "../../../src/components/shared/PostStats";
import Comments from "../../../src/components/shared/Comments";
import Link from "next/link";
import LinkifiedText from "../../../src/components/shared/LinkifiedText";
import VerificationBadge from "../../../src/components/shared/VerificationBadge";
import { POST_CATEGORIES } from "../../../src/constants";

const normalizeTag = (tag: string) => tag.replace(/^#/, "");

interface PostDetailPageProps {
  params: Promise<{ id: string }>;
}

const PostDetailPage = ({ params }: PostDetailPageProps) => {
  const router = useRouter();
  const { id } = use(params);
  const { user } = useUserContext();

  const { data: authenticatedPost, isLoading: isAuthPostLoading } = useGetPostById(user ? id : "");
  const { data: publicPost, isLoading: isPublicPostLoading } = useGetPublicPostById(!user ? id : "");

  const post = user ? authenticatedPost : publicPost;
  const isLoading = user ? isAuthPostLoading : isPublicPostLoading;

  const handleDeletePost = () => {
    if (id) {
      // Add delete post functionality here
      router.back();
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="post_details-container">
          <div className="flex-center w-full h-full">
            <Loader />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!post) {
    return (
      <AppLayout>
        <div className="post_details-container">
          <div className="flex-center w-full h-full">
            <p className="text-light-4">Post not found</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="post_details-container">
        <div className="hidden md:flex max-w-[720px] w-full">
          <Button
            onClick={() => router.back()}
            className="shad-button_ghost">
            <img
              src={"/assets/icons/back.svg"}
              alt="back"
              width={24}
              height={24}
            />
            <p className="small-medium lg:base-medium">Back</p>
          </Button>
        </div>

        <div className="post_details-card">
          {post.image_url ? (
            <img
              src={post.image_url}
              alt="post media"
              className="post_details-img"
            />
          ) : (
            <div className="relative w-full overflow-hidden rounded-t-[30px] border-b border-dark-4/60 bg-gradient-to-br from-dark-3 via-dark-3/90 to-dark-2 px-6 py-6 lg:px-8 lg:py-7">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.16),transparent_50%)]" />
              <div className="relative z-10 w-full">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary-400">
                  💡 Thought
                </div>
                <div className="mt-4">
                  <LinkifiedText text={post.caption} className="text-light-1 text-base lg:text-lg leading-7 whitespace-pre-wrap break-words text-left" />
                </div>
              </div>
            </div>
          )}

          <div className="post_details-info">
            <div className="flex-between w-full">
              <div className="flex items-center gap-3">
                <Link href={`/profile/${post.creator.id}`}>
                  <img
                    src={
                      post.creator?.image_url ||
                      "/assets/icons/profile-placeholder.svg"
                    }
                    alt="creator"
                    className="w-8 h-8 lg:w-12 lg:h-12 rounded-full"
                  />
                </Link>
                <div className="flex gap-1 flex-col min-w-0">
                  <Link href={`/profile/${post.creator.id}`} className="flex items-center gap-2">
                    <p className="base-medium lg:body-bold text-light-1">
                      {post.creator.name}
                    </p>
                    <VerificationBadge
                      isVerified={post.creator?.is_verified}
                      badgeType={post.creator?.verification_badge_type}
                      role={post.creator?.role}
                      size={14}
                    />
                  </Link>
                  <div className="flex-center gap-2 text-light-3">
                    <p className="subtle-semibold lg:small-regular ">
                      {multiFormatDateString(post.created_at)}
                    </p>
                    {post.location && (
                      <>
                        •
                        <Link
                          href={`/explore?search=${encodeURIComponent(post.location)}`}
                          className="subtle-semibold lg:small-regular hover:text-primary-500"
                        >
                          {post.location}
                        </Link>
                      </>
                    )}
                    {post.category && (
                      <>
                        •
                        <span className="subtle-semibold lg:small-regular text-primary-500 capitalize">
                          {POST_CATEGORIES.find((cat) => cat.value === post.category)?.label || post.category}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-center gap-4">
                {user && user.id === post.creator.id && (
                  <>
                    <Link href={`/update-post/${post.id}`}>
                      <img
                        src={"/assets/icons/edit.svg"}
                        alt="edit"
                        width={24}
                        height={24}
                      />
                    </Link>

                    <Button
                      onClick={handleDeletePost}
                      className="ghost_details-delete_btn rounded-lg border border-red-500/35 bg-red-500/10 hover:bg-red-500/20 hover:border-red-500/60 px-2 py-1"
                      aria-label="Delete post"
                      title="Delete post"
                    >
                      <img
                        src={"/assets/icons/delete.svg"}
                        alt="delete"
                        width={22}
                        height={22}
                        className="opacity-95"
                      />
                    </Button>
                  </>
                )}
              </div>
            </div>

            <hr className="border w-full border-dark-4/80" />

            <div className="flex flex-col flex-1 w-full small-medium lg:base-regular">
              {post.image_url && <LinkifiedText text={post.caption} />}
              {!!post.tags?.length && (
                <ul className="flex gap-1 mt-2 flex-wrap">
                  {post.tags?.map((tag: string, index: number) => (
                    <li key={`${tag}${index}`}>
                      <Link
                        href={`/explore?search=${encodeURIComponent(`#${normalizeTag(tag)}`)}`}
                        className="text-light-3 small-regular hover:text-primary-500"
                      >
                        #{normalizeTag(tag)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="w-full">
              <PostStats post={post} userId={user?.id || ""} />
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="w-full max-w-[720px] rounded-3xl bg-dark-2/40 border border-dark-4/30 p-5 lg:p-7 mt-2 mx-auto">
          <Comments postId={id} />
        </div>
      </div>
    </AppLayout>
  );
};

export default PostDetailPage;
