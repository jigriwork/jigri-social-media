"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useGetComments, useCreateComment } from "@/lib/react-query/queriesAndMutations";

import { Comment } from "@/lib/supabase/api";
import { useUserContext } from "@/context/SupabaseAuthContext";
import CommentItem from "@/components/shared/CommentItem";
import Loader from "@/components/shared/Loader";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QUERY_KEYS } from "@/lib/react-query/queryKeys";

type CommentsProps = {
  postId: string;
  className?: string;
};

const Comments = ({ postId, className = "" }: CommentsProps) => {
  const { user } = useUserContext();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");

  const { data: comments, isLoading } = useGetComments(postId);
  const { mutate: createComment, isPending: isPosting } = useCreateComment();

  const commentsCount = comments?.length ?? 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !user || isPosting) return;
    createComment(
      { content: commentText.trim(), postId, userId: user.id },
      { onSuccess: () => setCommentText("") }
    );
  };

  const handleCommentUpdated = () => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_COMMENTS, postId] });
  };

  return (
    <div className={`comments-section ${className}`}>
      {/* Comments Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium text-light-1">
          {commentsCount === 0
            ? "No comments yet"
            : `${commentsCount} ${commentsCount === 1 ? "comment" : "comments"}`}
        </h3>
      </div>

      {/* Comment Form — React Query mutation */}
      {user && (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 mb-6">
          <img
            src={user.image_url || "/assets/icons/profile-placeholder.svg"}
            alt="Your profile"
            className="w-8 h-8 rounded-full object-cover shrink-0"
          />
          <Input
            type="text"
            placeholder="Add a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            maxLength={2200}
            disabled={isPosting}
            className="flex-1 bg-dark-3 border-none text-sm text-light-1 placeholder:text-light-4 rounded-full px-4 h-10"
          />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={!commentText.trim() || isPosting}
            className="text-primary-500 hover:text-primary-600 disabled:text-light-4 px-3 font-semibold"
          >
            {isPosting ? "Posting..." : "Post"}
          </Button>
        </form>
      )}

      {/* Comments List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader />
        </div>
      ) : comments && comments.length > 0 ? (
        <div className="space-y-4">
          {comments.map((comment: Comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onCommentUpdated={handleCommentUpdated}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-light-4">
          <p>Be the first to comment!</p>
        </div>
      )}
    </div>
  );
};

export default Comments;
