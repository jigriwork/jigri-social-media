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
import { POST_CATEGORIES } from "@/constants";
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

  return (
    <div className="post-card">
      <div className="flex-between">
        <div className="flex items-center gap-3">
          <Link href={`/profile/${post.creator.id}`}>
            <img
              src={
                post.creator?.image_url ||
                "/assets/icons/profile-placeholder.svg"
              }
              alt="creator"
              className="w-12 lg:h-12 rounded-full"
            />
          </Link>

          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <p className="base-medium lg:body-bold text-light-1">
                {post.creator.name}
              </p>
              <VerificationBadge
                isVerified={post.creator?.is_verified}
                badgeType={post.creator?.verification_badge_type}
                role={post.creator?.role}
                size={14}
              />
            </div>
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
                    {POST_CATEGORIES.find(cat => cat.value === post.category)?.label || post.category}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={`flex gap-2 ${user?.id !== post.creator.id && "hidden"}`}>
          <Link href={`/update-post/${post.id}`}>
            <img
              src={"/assets/icons/edit.svg"}
              alt="edit"
              width={20}
              height={20}
            />
          </Link>
          
          <Button
            onClick={() => setShowDeleteConfirm(true)}
            variant="ghost"
            className="p-0 h-auto"
          >
            <img
              src={"/assets/icons/delete.svg"}
              alt="delete"
              width={20}
              height={20}
            />
          </Button>
        </div>
      </div>

      <div
        className="small-medium lg:base-medium py-5 cursor-pointer"
        onClick={() => router.push(`/posts/${post.id}`)}
      >
          <LinkifiedText text={post.caption} />
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
        </div>

      <Link href={`/posts/${post.id}`}>
        {post.image_url ? (
          <img
            src={post.image_url}
            alt="post image"
            className="post-card_img"
          />
        ) : null}
      </Link>

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
