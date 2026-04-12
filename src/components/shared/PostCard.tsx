"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { multiFormatDateString } from "@/lib/utils";
import { useUserContext } from "@/context/SupabaseAuthContext";
import { useDeletePost } from "@/lib/react-query/queriesAndMutations";
import { Button } from "@/components/ui/button";
import PostStats from "./PostStats";
import QuickComment from "./QuickComment";
import ConfirmActionModal from "./ConfirmActionModal";
import VerificationBadge from "./VerificationBadge";
import LinkifiedText from "./LinkifiedText";

const normalizeTag = (tag: string) => tag.replace(/^#/, "");

type PostCardProps = {
  post: any; // TODO: Add proper type from Supabase
};

const PostCard = ({ post }: PostCardProps) => {
  const router = useRouter();
  const { user } = useUserContext();
  const [showComments, setShowComments] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { mutate: deletePost } = useDeletePost();

  if (!post.creator) return;

  const handleCommentClick = () => {
    setShowComments(!showComments);
  };

  const handleDeletePost = () => {
    deletePost({ postId: post.id });
    setShowDeleteConfirm(false);
  };

  const isTextOnlyPost = !post.image_url;

  // Determine category-specific classes
  let categoryWrapperClass = "post-card";
  let categoryTag = null;

  if (post.category === "announcement") {
    categoryWrapperClass = "post-card ring-2 ring-primary-500/40 relative overflow-hidden";
    categoryTag = (
      <div className="absolute top-0 right-0 bg-primary-500 text-light-1 text-[10px] px-3 py-1 rounded-bl-lg font-bold flex items-center gap-1 uppercase tracking-wider">
        <span>📢</span> Announcement
      </div>
    );
  } else if (post.category === "question") {
    categoryWrapperClass = "post-card bg-gradient-to-br from-dark-2 to-dark-3/80 border-t-2 border-t-secondary-500 relative";
    categoryTag = (
      <div className="absolute -top-3 right-5 bg-dark-4 border border-dark-4 px-3 py-1 rounded-full text-xs font-medium text-light-2 flex items-center gap-1 shadow-lg shadow-dark-1">
        <span className="text-secondary-500 font-bold">Q:</span> Question
      </div>
    );
  }

  return (
    <div className={categoryWrapperClass}>
      {categoryTag}
      <div className="flex-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link href={`/profile/${post.creator.id}`} className="shrink-0">
            <img
              src={
                post.creator?.image_url ||
                "/assets/icons/profile-placeholder.svg"
              }
              alt="creator"
              className="w-10 h-10 rounded-full border border-dark-4 object-cover"
            />
          </Link>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <p className="base-medium text-light-1 truncate">
                {post.creator.name}
              </p>
              <VerificationBadge
                isVerified={post.creator?.is_verified}
                badgeType={post.creator?.verification_badge_type}
                role={post.creator?.role}
                size={12}
              />
            </div>
            <p className="subtle-semibold text-light-3 truncate">
              {multiFormatDateString(post.created_at)}
            </p>
          </div>
        </div>

        <div className={`flex gap-1 ${user?.id !== post.creator.id && "hidden"}`}>
          <Link href={`/update-post/${post.id}`}>
            <img
              src={"/assets/icons/edit.svg"}
              alt="edit"
              width={18}
              height={18}
              className="opacity-60 hover:opacity-100 transition-opacity"
            />
          </Link>

          <Button
            onClick={() => setShowDeleteConfirm(true)}
            variant="ghost"
            className="p-1.5 h-auto rounded-lg border border-red-500/35 bg-red-500/10 hover:bg-red-500/20 hover:border-red-500/60 transition-colors"
            aria-label="Delete post"
            title="Delete post"
          >
            <img
              src={"/assets/icons/delete.svg"}
              alt="delete"
              width={20}
              height={20}
              className="opacity-90"
            />
          </Button>
        </div>
      </div>

      <div
        className={`pt-3 pb-4 cursor-pointer ${isTextOnlyPost ? "w-full" : ""}`}
        onClick={() => router.push(`/posts/${post.id}`)}
      >
        {isTextOnlyPost ? (
          <div className="w-full rounded-[32px] bg-gradient-to-br from-[#1A1A1E] to-[#101012] py-8 px-6 flex flex-col items-center justify-center text-center border border-dark-4 transition-all hover:border-primary-500/30 group/thought">
            <div className="flex items-center gap-2 mb-4 bg-primary-500/10 px-3 py-1 rounded-full border border-primary-500/20 shadow-sm transition-all group-hover/thought:bg-primary-500/20">
              <span className="text-sm">💡</span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-primary-500">Thought</span>
            </div>
            <LinkifiedText
              text={post.caption}
              className="text-light-1 text-base lg:text-lg leading-relaxed whitespace-pre-wrap break-words opacity-95 group-hover/thought:opacity-100 transition-opacity"
            />
          </div>
        ) : (
          <>
            <LinkifiedText
              text={post.caption}
              className="text-light-1"
            />
            {!!post.tags?.length && (
              <ul className="flex gap-1 mt-2 flex-wrap">
                {post.tags.map((tag: string, index: string) => (
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
          </>
        )}
      </div>

      {post.image_url && (
        <Link href={`/posts/${post.id}`} className="block overflow-hidden rounded-[32px] border border-dark-4/30">
          <img
            src={post.image_url}
            alt="post image"
            className="h-64 xs:h-[350px] lg:h-[400px] w-full object-cover transition-transform duration-500 hover:scale-105"
          />
        </Link>
      )}

      <PostStats
        post={post}
        userId={user?.id || ""}
        onCommentClick={handleCommentClick}
      />

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-dark-4 pt-2">
          <QuickComment
            postId={post.id}
            onCommentAdded={() => {
              // Optionally refresh post data or show success message
              console.log('Comment added successfully!');
            }}
          />
        </div>
      )}

      <ConfirmActionModal
        isOpen={showDeleteConfirm}
        title="Delete post"
        description="This post will be removed permanently. This action cannot be undone."
        confirmLabel="Delete"
        isDestructive
        onConfirm={handleDeletePost}
        onClose={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};

export default PostCard;
