"use client";

import { useState, useEffect } from "react";
import { useUserContext } from "@/context/SupabaseAuthContext";
import {
  useGetComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
} from "@/lib/react-query/queriesAndMutations";
import {
  Comment,
  likeComment,
  unlikeComment,
  getCommentLikeStatus,
} from "@/lib/supabase/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { multiFormatDateString } from "@/lib/utils";
import AuthPromptModal from "./AuthPromptModal";
import Link from "next/link";
import ConfirmActionModal from "./ConfirmActionModal";
import VerificationBadge from "./VerificationBadge";
import { useMentions } from "@/hooks/useMentions";
import MentionsDropdown from "./MentionsDropdown";
import { notificationService } from "@/lib/utils/notificationService";
import { extractMentionUsernames } from "@/lib/supabase/api";

type QuickCommentProps = {
  postId: string;
  onCommentAdded?: () => void;
};

const QuickComment = ({ postId, onCommentAdded }: QuickCommentProps) => {
  const { user } = useUserContext();
  const [comment, setComment] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [authAction, setAuthAction] = useState("");
  const [deleteTargetCommentId, setDeleteTargetCommentId] = useState<string | null>(null);

  const mainMentions = useMentions();
  const replyMentions = useMentions();

  // React Query hooks — read + write unified through cache
  const { data: comments = [], isLoading: isLoadingComments } = useGetComments(postId);
  const { mutate: createCommentMutate, isPending: isSubmitting } = useCreateComment();
  const { mutate: updateCommentMutate, isPending: isUpdatingComment } = useUpdateComment();
  const { mutate: deleteCommentMutate } = useDeleteComment();

  // Load like statuses when user or comments change
  useEffect(() => {
    if (user && comments.length > 0) {
      loadLikeStatuses();
    }
  }, [user, comments]);

  const loadLikeStatuses = async () => {
    if (!user) return;

    const likedSet = new Set<string>();

    // Check like status for all comments and their replies
    for (const comment of comments) {
      const isLiked = await getCommentLikeStatus(comment.id, user.id);
      if (isLiked) likedSet.add(comment.id);

      // Check replies too
      if (comment.replies) {
        for (const reply of comment.replies) {
          const isReplyLiked = await getCommentLikeStatus(reply.id, user.id);
          if (isReplyLiked) likedSet.add(reply.id);
        }
      }
    }

    setLikedComments(likedSet);
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) {
      setAuthAction("like comments");
      setShowAuthPrompt(true);
      return;
    }

    const isLiked = likedComments.has(commentId);

    try {
      if (isLiked) {
        const success = await unlikeComment(commentId, user.id);
        if (success) {
          setLikedComments(prev => {
            const newSet = new Set(prev);
            newSet.delete(commentId);
            return newSet;
          });
        }
      } else {
        const success = await likeComment(commentId, user.id);
        if (success) {
          setLikedComments(prev => new Set([...prev, commentId]));
        }
      }
    } catch (error) {
      console.error("Error toggling comment like:", error);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!user) {
      setAuthAction("reply to comments");
      setShowAuthPrompt(true);
      return;
    }

    if (!replyContent.trim() || isSubmitting) return;

    createCommentMutate(
      { content: replyContent.trim(), postId, userId: user.id, parentId },
      {
        onSuccess: async (reply) => {
          if (reply) {
            await notificationService.createCommentNotification(postId, replyContent.trim(), true);
            const mentionedUsernames = extractMentionUsernames(replyContent.trim());
            if (mentionedUsernames.length > 0) {
              await notificationService.createMentionNotification('comment', postId, replyContent.trim(), mentionedUsernames);
            }
            setReplyContent("");
            setReplyingTo(null);
            onCommentAdded?.();
          }
        },
      }
    );
  };

  const handleEditComment = (commentId: string, currentContent: string) => {
    setEditingComment(commentId);
    setEditContent(currentContent);
    setReplyingTo(null); // Close any open reply forms
  };

  const handleUpdateComment = (commentId: string) => {
    if (!editContent.trim() || !user || isUpdatingComment) return;
    updateCommentMutate(
      { commentId, content: editContent.trim() },
      {
        onSuccess: () => {
          setEditingComment(null);
          setEditContent("");
        },
      }
    );
  };

  const handleDeleteComment = (commentId: string) => {
    if (!user) return;
    deleteCommentMutate(commentId, {
      onSuccess: () => setDeleteTargetCommentId(null),
    });
  };

  const cancelEdit = () => {
    setEditingComment(null);
    setEditContent("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setAuthAction("comment on posts");
      setShowAuthPrompt(true);
      return;
    }

    if (!comment.trim() || isSubmitting) return;

    createCommentMutate(
      { content: comment.trim(), postId, userId: user.id },
      {
        onSuccess: async (newComment) => {
          if (newComment) {
            await notificationService.createCommentNotification(postId, comment.trim(), false);
            const mentionedUsernames = extractMentionUsernames(comment.trim());
            if (mentionedUsernames.length > 0) {
              await notificationService.createMentionNotification('comment', postId, comment.trim(), mentionedUsernames);
            }
            setComment("");
            onCommentAdded?.();
          }
        },
      }
    );
  };

  const displayedComments = showAllComments ? comments : (comments as Comment[]).slice(0, 5);
  const hasMoreComments = comments.length > 5;

  return (
    <div className="space-y-4">
      {/* Comment Form - Only show if user is authenticated */}
      {user ? (
        <form onSubmit={handleSubmit} className="flex items-center gap-3 p-3">
          <img
            src={user.image_url || "/assets/icons/profile-placeholder.svg"}
            alt="Your profile"
            className="w-9 h-9 rounded-full object-cover shrink-0"
          />

          <div className="flex-1 flex flex-col gap-1 relative">
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Add a comment... (Type @ to mention)"
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  mainMentions.handleTextChange(e, e.target.value);
                }}
                className="flex-1 border-none shadow-none rounded-full px-4 h-10 bg-dark-4/30 text-sm text-light-1 placeholder:text-light-4 focus-visible:ring-1 focus-visible:ring-primary-500"
                maxLength={2200}
                disabled={isSubmitting}
              />
              <MentionsDropdown
                isVisible={mainMentions.isDropdownVisible}
                users={mainMentions.searchResults || []}
                isFetching={mainMentions.isFetching}
                onClose={mainMentions.closeDropdown}
                onSelect={(username) => {
                  const newText = mainMentions.insertMention(username, comment);
                  setComment(newText);
                }}
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={!comment.trim() || isSubmitting}
            className="text-primary-500 hover:text-primary-600 disabled:text-light-4 px-3 py-2 font-semibold"
          >
            {isSubmitting ? "Posting..." : "Post"}
          </Button>
        </form>
      ) : (
        /* Auth prompt for unauthenticated users */
        <div className="flex items-center gap-3 p-3 bg-dark-4 rounded-lg">
          <img
            src="/assets/icons/profile-placeholder.svg"
            alt="Guest profile"
            width={32}
            height={32}
            className="rounded-full opacity-50"
          />
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Sign in to add a comment..."
              className="flex-1 border rounded-full px-4 py-2 bg-dark-3 border-dark-3 text-light-1 placeholder:text-light-3 cursor-pointer"
              readOnly
              onClick={() => {
                setAuthAction("comment on posts");
                setShowAuthPrompt(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Comments Display - Always visible */}
      <div className="px-3 space-y-3">
        {isLoadingComments ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-light-4 text-sm">No comments yet. Start the conversation.</p>
          </div>
        ) : (
          <>
            {/* Comments List */}
            <div className={`space-y-3 ${hasMoreComments && !showAllComments ? 'max-h-80 overflow-hidden' : showAllComments ? 'max-h-96 overflow-y-auto' : ''}`}>
              {displayedComments.map((commentItem) => (
                <div key={commentItem.id} className="flex gap-3">
                  {/* User Avatar */}
                  <Link href={`/profile/${commentItem.user.id}`}>
                    <img
                      src={commentItem.user.image_url || "/assets/icons/profile-placeholder.svg"}
                      alt={commentItem.user.name}
                      width={28}
                      height={28}
                      className="rounded-full mt-1"
                    />
                  </Link>

                  <div className="flex-1">
                    {/* Comment Content */}
                    <div className="bg-dark-4 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/profile/${commentItem.user.id}`}
                          className="text-sm font-medium text-light-1 hover:text-primary-500"
                        >
                          {commentItem.user.name}
                        </Link>
                        <VerificationBadge
                          isVerified={commentItem.user?.is_verified}
                          role={(commentItem.user as any)?.role}
                          badgeType={commentItem.user?.verification_badge_type}
                          size={13}
                        />
                        <span className="text-xs text-light-4">
                          @{commentItem.user.username}
                        </span>
                        {commentItem.is_edited && (
                          <span className="text-xs text-light-4">• edited</span>
                        )}
                      </div>

                      {/* Comment Content - Edit Mode */}
                      {editingComment === commentItem.id ? (
                        <div className="space-y-2">
                          <Input
                            type="text"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full border rounded px-2 py-1 text-xs bg-dark-3 border-dark-3 text-light-1 placeholder:text-light-4 focus:border-primary-500"
                            maxLength={2200}
                            disabled={isUpdatingComment}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleUpdateComment(commentItem.id);
                              }
                              if (e.key === 'Escape') {
                                cancelEdit();
                              }
                            }}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleUpdateComment(commentItem.id)}
                              disabled={isUpdatingComment || !editContent.trim()}
                              className="text-xs px-2 py-1 h-6 bg-primary-500 text-white hover:bg-primary-600 disabled:bg-dark-3"
                            >
                              {isUpdatingComment ? "Saving..." : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEdit}
                              className="text-xs px-2 py-1 h-6 text-light-4 hover:text-light-2"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-light-2 whitespace-pre-wrap break-words">
                          {commentItem.content}
                        </p>
                      )}
                    </div>

                    {/* Comment Meta */}
                    <div className="flex items-center gap-4 mt-1 mb-2">
                      <span className="text-xs text-light-4">
                        {multiFormatDateString(commentItem.created_at)}
                      </span>

                      {commentItem._count?.likes && commentItem._count.likes > 0 && (
                        <span className="text-xs text-light-4">
                          {commentItem._count.likes} {commentItem._count.likes === 1 ? 'like' : 'likes'}
                        </span>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLikeComment(commentItem.id)}
                        className={`text-xs px-1 py-0 h-auto ${likedComments.has(commentItem.id)
                            ? 'text-red-500 hover:text-red-400'
                            : 'text-light-4 hover:text-primary-500'
                          }`}
                      >
                        {likedComments.has(commentItem.id) ? 'Liked' : 'Like'}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (!user) {
                            setAuthAction("reply to comments");
                            setShowAuthPrompt(true);
                            return;
                          }
                          setReplyingTo(replyingTo === commentItem.id ? null : commentItem.id);
                        }}
                        className="text-xs text-light-4 hover:text-primary-500 px-1 py-0 h-auto"
                      >
                        {replyingTo === commentItem.id ? 'Cancel' : 'Reply'}
                      </Button>

                      {/* Edit and Delete buttons - only show if comment belongs to current user */}
                      {user && commentItem.user.id === user.id && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditComment(commentItem.id, commentItem.content)}
                            className="text-xs text-light-4 hover:text-blue-500 px-1 py-0 h-auto"
                          >
                            Edit
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTargetCommentId(commentItem.id)}
                            className="text-xs text-light-4 hover:text-red-500 px-1 py-0 h-auto"
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Reply Form */}
                    {replyingTo === commentItem.id && (
                      <div className="flex items-center gap-2 mt-2 mb-2">
                        <img
                          src={user?.image_url || "/assets/icons/profile-placeholder.svg"}
                          alt="Your profile"
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                        <div className="flex-1 relative">
                          <Input
                            type="text"
                            placeholder={`Reply to ${commentItem.user.name}...`}
                            value={replyContent}
                            onChange={(e) => {
                              setReplyContent(e.target.value);
                              replyMentions.handleTextChange(e, e.target.value);
                            }}
                            className="w-full border rounded-full px-3 py-1 text-xs bg-dark-4 border-dark-4 text-light-1 placeholder:text-light-4 focus:border-primary-500"
                            maxLength={2200}
                            disabled={isSubmitting}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSubmitReply(commentItem.id);
                              }
                            }}
                          />
                          <MentionsDropdown
                            isVisible={replyMentions.isDropdownVisible}
                            users={replyMentions.searchResults || []}
                            isFetching={replyMentions.isFetching}
                            onClose={replyMentions.closeDropdown}
                            onSelect={(username) => {
                              const newText = replyMentions.insertMention(username, replyContent);
                              setReplyContent(newText);
                            }}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSubmitReply(commentItem.id)}
                          disabled={!replyContent.trim() || isSubmitting}
                          className="text-xs text-primary-500 hover:text-primary-600 disabled:text-light-4 px-2 py-1"
                        >
                          {isSubmitting ? "Posting..." : "Post"}
                        </Button>
                      </div>
                    )}

                    {/* Replies (if any) */}
                    {commentItem.replies && commentItem.replies.length > 0 && (
                      <div className="ml-4 mt-2 space-y-2">
                        {commentItem.replies.slice(0, 2).map((reply) => (
                          <div key={reply.id} className="space-y-1">
                            <div className="flex gap-2">
                              <Link href={`/profile/${reply.user.id}`}>
                                <img
                                  src={reply.user.image_url || "/assets/icons/profile-placeholder.svg"}
                                  alt={reply.user.name}
                                  width={24}
                                  height={24}
                                  className="rounded-full"
                                />
                              </Link>
                              <div className="bg-dark-4 rounded-lg px-3 py-1 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Link
                                    href={`/profile/${reply.user.id}`}
                                    className="text-xs font-medium text-light-1 hover:text-primary-500"
                                  >
                                    {reply.user.name}
                                  </Link>
                                  <VerificationBadge
                                    isVerified={reply.user?.is_verified}
                                    badgeType={reply.user?.verification_badge_type}
                                    role={(reply.user as any)?.role}
                                    size={12}
                                  />
                                  <span className="text-xs text-light-4">
                                    @{reply.user.username}
                                  </span>
                                  {reply.is_edited && (
                                    <span className="text-xs text-light-4">• edited</span>
                                  )}
                                </div>
                                {/* Reply Content - Edit Mode */}
                                {editingComment === reply.id ? (
                                  <div className="space-y-2">
                                    <Input
                                      type="text"
                                      value={editContent}
                                      onChange={(e) => setEditContent(e.target.value)}
                                      className="w-full border rounded px-2 py-1 text-xs bg-dark-3 border-dark-3 text-light-1 placeholder:text-light-4 focus:border-primary-500"
                                      maxLength={2200}
                                      disabled={isUpdatingComment}
                                      onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleUpdateComment(reply.id);
                                        }
                                        if (e.key === 'Escape') {
                                          cancelEdit();
                                        }
                                      }}
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => handleUpdateComment(reply.id)}
                                        disabled={isUpdatingComment || !editContent.trim()}
                                        className="text-xs px-2 py-1 h-6 bg-primary-500 text-white hover:bg-primary-600 disabled:bg-dark-3"
                                      >
                                        {isUpdatingComment ? "Saving..." : "Save"}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={cancelEdit}
                                        className="text-xs px-2 py-1 h-6 text-light-4 hover:text-light-2"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-light-2 whitespace-pre-wrap break-words">
                                    {reply.content}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Reply Meta */}
                            <div className="flex items-center gap-4 ml-6">
                              <span className="text-xs text-light-4">
                                {multiFormatDateString(reply.created_at)}
                              </span>

                              {reply._count?.likes && reply._count.likes > 0 && (
                                <span className="text-xs text-light-4">
                                  {reply._count.likes} {reply._count.likes === 1 ? 'like' : 'likes'}
                                </span>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleLikeComment(reply.id)}
                                className={`text-xs px-1 py-0 h-auto ${likedComments.has(reply.id)
                                    ? 'text-red-500 hover:text-red-400'
                                    : 'text-light-4 hover:text-primary-500'
                                  }`}
                              >
                                {likedComments.has(reply.id) ? 'Liked' : 'Like'}
                              </Button>

                              {/* Edit and Delete buttons for replies - only show if reply belongs to current user */}
                              {user && reply.user.id === user.id && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditComment(reply.id, reply.content)}
                                    className="text-xs text-light-4 hover:text-blue-500 px-1 py-0 h-auto"
                                  >
                                    Edit
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteTargetCommentId(reply.id)}
                                    className="text-xs text-light-4 hover:text-red-500 px-1 py-0 h-auto"
                                  >
                                    Delete
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                        {commentItem.replies.length > 2 && null}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Show More/Less Button */}
            {hasMoreComments && (
              <div className="text-center pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllComments(!showAllComments)}
                  className="text-primary-500 hover:text-primary-400 text-xs"
                >
                  {showAllComments
                    ? "Show less comments"
                    : `View ${comments.length - 5} more comments`
                  }
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Auth Prompt Modal */}
      <AuthPromptModal
        isOpen={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        action={authAction}
      />

      <ConfirmActionModal
        isOpen={!!deleteTargetCommentId}
        title="Delete comment"
        description="This comment will be removed permanently."
        confirmLabel="Delete"
        isDestructive
        onConfirm={() => {
          if (deleteTargetCommentId) {
            handleDeleteComment(deleteTargetCommentId);
          }
        }}
        onClose={() => setDeleteTargetCommentId(null)}
      />
    </div>
  );
};

export default QuickComment;
