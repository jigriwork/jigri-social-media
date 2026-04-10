"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUserContext } from "@/context/SupabaseAuthContext";
import PostStats from "./PostStats";
import VerificationBadge from "./VerificationBadge";

type GridPostListProps = {
  posts: any[]; // Posts array from Supabase
  showUser?: boolean;
  showStats?: boolean;
  showComments?: boolean;
};

const GridPostList = ({
  posts,
  showUser = true,
  showStats = true,
  showComments = true,
}: GridPostListProps) => {
  const router = useRouter();
  const { user } = useUserContext();

  return (
    <ul className="grid-container">
      {posts.map((post) => (
        <li key={post.id || post.$id} className="relative min-w-80 h-80">
          <Link href={`/posts/${post.id || post.$id}`} className="grid-post_link">
            {post.image_url || post.imageUrl ? (
              <img
                src={post.image_url || post.imageUrl}
                alt="post"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-dark-3 p-4 flex items-center justify-center text-center">
                <p className="small-medium text-light-2 line-clamp-5">{post.caption || "Text post"}</p>
              </div>
            )}
          </Link>

          <div className="grid-post_user">
            {showUser && (
              <div className="flex items-center justify-start gap-2 flex-1">
                <img
                  src={
                    post.creator?.image_url || post.creator?.imageUrl ||
                    "/assets/icons/profile-placeholder.svg"
                  }
                  alt="creator"
                  className="w-8 h-8 rounded-full"
                />
                <div className="flex items-center gap-1 min-w-0">
                  <p className="line-clamp-1">{post.creator?.name}</p>
                  <VerificationBadge
                    isVerified={post.creator?.is_verified}
                    badgeType={post.creator?.verification_badge_type}
                    role={post.creator?.role}
                    size={13}
                  />
                </div>
              </div>
            )}
            {showStats && (
              <PostStats 
                post={post} 
                userId={user?.id || ""} 
                showComments={showComments}
                onCommentClick={() => {
                  router.push(`/posts/${post.id || post.$id}`);
                }}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};

export default GridPostList;
