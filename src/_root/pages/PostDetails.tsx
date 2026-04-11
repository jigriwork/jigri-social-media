"use client";

import { useParams, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  useGetPostById,
  useGetUserPosts,
  useDeletePost,
} from "@/lib/react-query/queriesAndMutations";
import { multiFormatDateString } from "@/lib/utils";
import { useUserContext } from "@/context/SupabaseAuthContext";
import { Button } from "@/components/ui";
import Loader from "@/components/shared/Loader";
import PostStats from "@/components/shared/PostStats";
import GridPostList from "@/components/shared/GridPostList";
import Comments from "@/components/shared/Comments";
import LinkifiedText from "@/components/shared/LinkifiedText";
import VerificationBadge from "@/components/shared/VerificationBadge";
import { POST_CATEGORIES } from "@/constants";

const normalizeTag = (tag: string) => tag.replace(/^#/, "");

const PostDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useUserContext();

  const postId = Array.isArray(id) ? id[0] : id;
  const { data: post, isLoading } = useGetPostById(postId);
  const { data: userPosts, isLoading: isUserPostLoading } = useGetUserPosts(
    post?.creator.$id
  );
  const { mutate: deletePost } = useDeletePost();

  const relatedPosts = userPosts?.filter(
    (userPost: any) => userPost.id !== postId
  );

  const handleDeletePost = () => {
    if (postId) {
      deletePost({ postId: postId });
      navigate(-1);
    }
  };

  return (
    <div className="post_details-container">
      <div className="hidden md:flex max-w-[720px] w-full">
        <Button
          onClick={() => navigate(-1)}
          variant="ghost"
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

      {isLoading || !post ? (
        <Loader />
      ) : (
        <div className="post_details-card p-5 lg:p-7">
          <div className="flex-between w-full mb-4">
            <Link
              to={`/profile/${post?.creator.id}`}
              className="flex items-center gap-3">
              <img
                src={
                  post?.creator.image_url ||
                  "/assets/icons/profile-placeholder.svg"
                }
                alt="creator"
                className="w-10 h-10 lg:w-12 lg:h-12 rounded-full object-cover"
              />
              <div className="flex gap-1 flex-col">
                <div className="flex items-center gap-1">
                  <p className="base-medium lg:body-bold text-light-1">
                    {post?.creator.name}
                  </p>
                  <VerificationBadge
                    isVerified={post?.creator?.is_verified}
                    badgeType={post?.creator?.verification_badge_type}
                    role={post?.creator?.role}
                    size={14}
                  />
                </div>
                <div className="flex items-center gap-2 text-light-3">
                  <p className="subtle-semibold lg:small-regular">
                    {multiFormatDateString(post?.$createdAt || post?.created_at)}
                  </p>
                  {post?.location && (
                    <>
                      <span className="text-light-4">•</span>
                      <Link to={`/explore?search=${encodeURIComponent(post.location)}`} className="subtle-semibold lg:small-regular hover:text-primary-500">
                        {post?.location}
                      </Link>
                    </>
                  )}
                  {post?.category && (
                    <>
                      <span className="text-light-4">•</span>
                      <span className="subtle-semibold lg:small-regular text-primary-500 capitalize">
                        {POST_CATEGORIES.find((cat) => cat.value === post.category)?.label || post.category}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Link>

            <div className="flex-center gap-4">
              <Link
                to={`/update-post/${post?.id}`}
                className={`${user?.id !== post?.creator.id && "hidden"}`}>
                <img
                  src={"/assets/icons/edit.svg"}
                  alt="edit"
                  width={24}
                  height={24}
                />
              </Link>

              <Button
                onClick={handleDeletePost}
                variant="ghost"
                className={`ghost_details-delete_btn ${
                  user?.id !== post?.creator.id && "hidden"
                }`}>
                <img
                  src={"/assets/icons/delete.svg"}
                  alt="delete"
                  width={24}
                  height={24}
                  className="hover:invert"
                />
              </Button>
            </div>
          </div>

          <div className="text-sm lg:text-base cursor-text pt-2 pb-5 text-light-1 leading-7 whitespace-pre-wrap break-words">
            <LinkifiedText text={post?.caption || ""} />
            {!!post?.tags?.length && (
              <ul className="flex gap-1 mt-3 flex-wrap">
                {post?.tags.map((tag: string, index: string) => (
                  <li key={`${tag}${index}`}>
                    <Link
                      to={`/explore?search=${encodeURIComponent(`#${normalizeTag(tag)}`)}`}
                      className="text-light-3 small-regular hover:text-primary-500"
                    >
                      #{normalizeTag(tag)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {post?.image_url && (
            <img
              src={post?.image_url}
              alt="post media"
              className="post_details-img"
            />
          )}

          <div className="w-full pt-3">
            <PostStats post={post} userId={user?.id || ""} />
          </div>
        </div>
      )}

      {/* Comments Section */}
      {postId && (
        <div className="w-full max-w-[720px] rounded-3xl bg-dark-2/40 border border-dark-4/30 p-5 lg:p-7 mt-6 mx-auto">
          <Comments postId={postId} />
        </div>
      )}

      <div className="w-full max-w-[720px] mx-auto mt-10">
        <h3 className="body-bold md:h3-bold w-full mb-6">
          More Related Posts
        </h3>
        {isUserPostLoading || !relatedPosts ? (
          <Loader />
        ) : (
          <GridPostList posts={relatedPosts} />
        )}
      </div>
    </div>
  );
};

export default PostDetails;
