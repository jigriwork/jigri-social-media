"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useUserContext } from "@/context/SupabaseAuthContext";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  user_id: string;
  from_user_id: string;
  from_user_name?: string;
  from_user_avatar?: string;
  action_url?: string;
  read?: boolean;
  created_at: string;
  user?: { id: string; name: string; username: string; image_url?: string };
};

type GroupedNotification = Notification & {
  count: number;
};

const getImportance = (type: string) => {
  if (type === "follow" || type === "comment") return "high";
  return "normal";
};

const getUrgencyLabel = (type: string) => {
  if (type === "comment") return "Someone replied to you";
  if (type === "follow") return "Someone followed you";
  return "You have new activity";
};

const NotificationBell = () => {
  const router = useRouter();
  const { user } = useUserContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const groupedNotifications = useMemo<GroupedNotification[]>(() => {
    const grouped = new Map<string, GroupedNotification>();

    for (const item of notifications) {
      const key = `${item.type}|${item.from_user_id}|${item.action_url || ""}`;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, { ...item, count: 1 });
      } else {
        const existingDate = new Date(existing.created_at).getTime();
        const currentDate = new Date(item.created_at).getTime();
        const latest = currentDate > existingDate ? item : existing;

        grouped.set(key, {
          ...latest,
          count: existing.count + 1,
          read: Boolean(existing.read && item.read),
        });
      }
    }

    return [...grouped.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [notifications]);

  const fetchNotifications = async (withLoader = false) => {
    if (!user?.id) return;
    if (withLoader) setIsLoading(true);

    try {
      const res = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      const data = (res.data as Notification[] | null) || [];
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.read).length);
      return data;
    } finally {
      if (withLoader) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchNotifications(true);

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => fetchNotifications(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  const handleBellClick = async () => {
    const nextOpen = !showDropdown;
    setShowDropdown(nextOpen);

    if (!nextOpen || !user?.id) return;
    await fetchNotifications(true);
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;

    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length > 0) {
      await supabase
        .from("notifications")
        .update({ read: true })
        .in("id", unreadIds)
        .eq("user_id", user.id);
    }

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const onNotificationClick = (notification: GroupedNotification) => {
    setShowDropdown(false);
    router.push(notification.action_url || `/profile/${notification.from_user_id}`);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        className="relative p-3 rounded-xl bg-dark-3/50 hover:bg-dark-2/70 border border-dark-4/50 hover:border-dark-4 transition-all duration-200 group"
        onClick={handleBellClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          className="text-light-2 group-hover:text-light-1 transition-colors"
        >
          <path
            d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center border-2 border-dark-1"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-80 max-w-[calc(100vw-2rem)] bg-dark-2/95 backdrop-blur-lg border border-dark-4/50 rounded-2xl shadow-2xl z-50 overflow-hidden fixed top-20 left-[15%] -translate-x-1/2 sm:absolute sm:top-full sm:mt-2 sm:left-0 sm:translate-x-0"
          >
            <div className="p-4 border-b border-dark-4/50 bg-gradient-to-r from-dark-2 to-dark-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-light-1">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-xs text-primary-400 hover:text-primary-300 font-medium transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                  {unreadCount > 0 && (
                    <span className="text-xs bg-primary-500/20 text-primary-400 px-2 py-1 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(4)].map((_, index) => (
                    <div key={index} className="flex items-center gap-3 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-dark-4" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 rounded bg-dark-4 w-3/4" />
                        <div className="h-2 rounded bg-dark-4 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : groupedNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-light-3 text-sm">No notifications yet</p>
                  <p className="text-light-4 text-xs mt-1">We'll keep you updated here.</p>
                </div>
              ) : (
                <div className="divide-y divide-dark-4/30">
                  {groupedNotifications.map((n, index) => (
                    <motion.button
                      key={n.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={`w-full text-left p-4 hover:bg-dark-3/30 transition-colors ${
                        !n.read ? "bg-primary-500/5 border-l-2 border-l-primary-500" : ""
                      }`}
                      onClick={() => onNotificationClick(n)}
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={n.from_user_avatar || "/assets/icons/profile-placeholder.svg"}
                          alt={n.from_user_name || "User"}
                          className="w-10 h-10 rounded-full object-cover border border-dark-4"
                        />
                        <div className="flex-1 min-w-0">
                          {getImportance(n.type) === "high" && (
                            <p className="text-[11px] font-semibold text-primary-400 mb-1">
                              {getUrgencyLabel(n.type)}
                            </p>
                          )}
                          <div className="text-sm text-light-1">
                            {n.from_user_name && (
                              <span className="font-semibold text-primary-400">{n.from_user_name}</span>
                            )}
                            {n.from_user_name ? " " : ""}
                            <span className="text-light-2">{n.message}</span>
                            {n.count > 1 && (
                              <span className="ml-2 text-xs text-primary-400">+{n.count - 1} more</span>
                            )}
                          </div>
                          <p className="text-xs text-light-4 mt-1">
                            {new Date(n.created_at).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;