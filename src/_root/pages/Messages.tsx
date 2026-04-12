"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useUserContext } from "@/context/SupabaseAuthContext";
import {
  useGetConversations,
  useGetMessages,
  useSendMessage,
  useCreateConversation,
  useSearchUsers,
} from "@/lib/react-query/queriesAndMutations";
import Loader from "@/components/shared/Loader";
import VerificationBadge from "@/components/shared/VerificationBadge";
import UserAvatar from "@/components/shared/UserAvatar";
import useDebounce from "@/hooks/useDebounce";

const Messages = () => {
  const { user } = useUserContext();
  const router = useRouter();
  const [selectedConvId, setSelectedConvId] = useState<string>("");
  const [messageText, setMessageText] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(newChatSearch, 300);

  const { data: conversations, isLoading: loadingConvs } = useGetConversations();
  const { data: messages, isLoading: loadingMsgs } = useGetMessages(selectedConvId);
  const { mutate: sendMsg, isPending: isSending } = useSendMessage();
  const { mutateAsync: createConv } = useCreateConversation();
  const { data: searchResults, isLoading: isSearching } = useSearchUsers(debouncedSearch, 20);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedConv = conversations?.find((c: any) => c.id === selectedConvId);

  const getOtherUser = (conv: any) => {
    if (!user) return null;
    if (conv.participant_one === user.id) return conv.participant_two_user;
    return conv.participant_one_user;
  };

  const handleSend = () => {
    if (!messageText.trim() || !selectedConvId || isSending) return;
    sendMsg(
      { conversationId: selectedConvId, content: messageText.trim() },
      { onSuccess: () => setMessageText("") }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStartChat = async (otherUserId: string) => {
    try {
      const conv = await createConv(otherUserId);
      if (conv?.id) {
        setSelectedConvId(conv.id);
        setShowNewChat(false);
        setNewChatSearch("");
      }
    } catch (error) {
      console.error("Error starting chat:", error);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 24) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (diffHours < 168) {
      return date.toLocaleDateString([], { weekday: "short" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] md:h-screen w-full max-w-6xl mx-auto overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 md:p-6 border-b border-dark-4/50">
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-primary-500">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h2 className="h3-bold md:h2-bold">Messages</h2>
        </div>
        <button
          onClick={() => setShowNewChat(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New Chat
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Conversations List */}
        <div className={`${selectedConvId ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 lg:w-96 border-r border-dark-4/50 overflow-y-auto custom-scrollbar`}>
          {loadingConvs ? (
            <div className="flex items-center justify-center py-20">
              <Loader />
            </div>
          ) : !conversations || conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="text-light-4 mb-4 opacity-40">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <p className="text-light-3 font-medium mb-1">No conversations yet</p>
              <p className="text-light-4 text-sm">Start a new chat to connect with someone</p>
            </div>
          ) : (
            conversations.map((conv: any) => {
              const other = getOtherUser(conv);
              if (!other) return null;
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`flex items-center gap-3 p-4 w-full text-left hover:bg-dark-3/50 transition-colors border-b border-dark-4/20 ${selectedConvId === conv.id ? "bg-dark-3/70 border-l-2 border-l-primary-500" : ""
                    }`}
                >
                  <UserAvatar 
                    user={other} 
                    size="lg"
                    showRing={true} 
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`font-semibold text-sm truncate flex items-center gap-1 ${conv.unreadCount > 0 ? "text-light-1" : "text-light-2"}`}>
                        {other.name}
                        <VerificationBadge
                          isVerified={other.is_verified}
                          badgeType={other.verification_badge_type}
                          role={other.role}
                          size={14}
                        />
                      </p>
                      {conv.lastMessage && (
                        <span className="text-[11px] text-light-4 flex-shrink-0 ml-2">
                          {formatTime(conv.lastMessage.created_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-light-4 truncate mt-0.5">
                      @{other.username}
                    </p>
                    {conv.lastMessage && (
                      <p className={`text-xs truncate mt-1 ${conv.unreadCount > 0 ? "text-light-2 font-medium" : "text-light-4"}`}>
                        {conv.lastMessage.sender_id === user?.id ? "You: " : ""}
                        {conv.lastMessage.content}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Chat View */}
        <div className={`${selectedConvId ? "flex" : "hidden md:flex"} flex-col flex-1 min-w-0`}>
          {selectedConvId && selectedConv ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 p-4 border-b border-dark-4/50 bg-dark-2/50">
                <button
                  onClick={() => setSelectedConvId("")}
                  className="md:hidden p-1 hover:bg-dark-3 rounded transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <UserAvatar 
                  user={getOtherUser(selectedConv)} 
                  size="md"
                  showRing={true} 
                />
                <div>
                  <p className="font-semibold text-light-1 text-sm flex items-center gap-1">
                    {getOtherUser(selectedConv)?.name}
                    <VerificationBadge
                      isVerified={getOtherUser(selectedConv)?.is_verified}
                      badgeType={getOtherUser(selectedConv)?.verification_badge_type}
                      role={getOtherUser(selectedConv)?.role}
                      size={14}
                    />
                  </p>
                  <p className="text-xs text-light-4">@{getOtherUser(selectedConv)?.username}</p>
                </div>
                <button
                  onClick={() => router.push(`/profile/${getOtherUser(selectedConv)?.id}`)}
                  className="ml-auto text-light-4 hover:text-light-2 transition-colors text-xs"
                >
                  View Profile
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-32 md:pb-4 space-y-3">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader />
                  </div>
                ) : !messages || messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <p className="text-light-4 text-sm">No messages yet. Say hello! 👋</p>
                  </div>
                ) : (
                  messages.map((msg: any) => {
                    const isMe = msg.sender_id === user?.id;
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe
                              ? "bg-primary-500 text-white rounded-br-md"
                              : "bg-dark-3 text-light-1 rounded-bl-md border border-dark-4/50"
                            }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${isMe ? "text-white/60" : "text-light-4"}`}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="sticky bottom-0 z-10 p-3 md:p-4 border-t border-dark-4/50 bg-dark-2/95 backdrop-blur supports-[backdrop-filter]:bg-dark-2/80 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                <div className="flex items-end gap-3">
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 bg-dark-3 border border-dark-4/50 rounded-xl px-4 py-3 text-sm text-light-1 placeholder:text-light-4 resize-none outline-none focus:border-primary-500/50 transition-colors max-h-32"
                    style={{ minHeight: "44px" }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!messageText.trim() || isSending}
                    className="p-3 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex-shrink-0"
                  >
                    {isSending ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center px-6">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" className="text-light-4 mb-4 opacity-30">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <h3 className="text-light-2 text-lg font-semibold mb-2">Your Messages</h3>
              <p className="text-light-4 text-sm max-w-sm">
                Select a conversation or start a new chat to begin messaging.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      <AnimatePresence>
        {showNewChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setShowNewChat(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-dark-2 rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col border border-dark-4/50 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-dark-4/50 flex items-center justify-between">
                <h3 className="font-semibold text-light-1">New Message</h3>
                <button onClick={() => setShowNewChat(false)} className="text-light-4 hover:text-light-2 transition-colors">
                  ✕
                </button>
              </div>
              <div className="p-4">
                <input
                  type="text"
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  placeholder="Search users..."
                  className="w-full bg-dark-3 border border-dark-4/50 rounded-lg px-4 py-3 text-sm text-light-1 placeholder:text-light-4 outline-none focus:border-primary-500/50 transition-colors"
                  autoFocus
                />
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4">
                {isSearching ? (
                  <div className="flex justify-center py-8"><Loader /></div>
                ) : !searchResults || searchResults.length === 0 ? (
                  <p className="text-center text-light-4 text-sm py-8">
                    {newChatSearch ? "No users found" : "Search for someone to message"}
                  </p>
                ) : (
                  searchResults
                    .filter((u: any) => u.id !== user?.id)
                    .map((u: any) => (
                      <button
                        key={u.id}
                        onClick={() => handleStartChat(u.id)}
                        className="flex items-center gap-3 w-full p-3 hover:bg-dark-3/50 rounded-xl transition-colors"
                      >
                        <UserAvatar 
                          user={u} 
                          size="md"
                          showRing={true} 
                        />
                        <div className="text-left">
                          <p className="font-medium text-sm text-light-1 flex items-center gap-1">
                            {u.name}
                            <VerificationBadge
                              isVerified={u.is_verified}
                              badgeType={u.verification_badge_type}
                              role={u.role}
                              size={13}
                            />
                          </p>
                          <p className="text-xs text-light-4">@{u.username}</p>
                        </div>
                      </button>
                    ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Messages;
