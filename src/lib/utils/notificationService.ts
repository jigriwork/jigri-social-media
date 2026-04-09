"use client";

import { createClient } from '../supabase/client';
import { NotificationData } from '../../components/shared/NotificationPopup';
import { notificationSound } from './notificationSound';

export interface DbNotification {
  id: string;
  user_id: string;
  type: 'new_post' | 'like' | 'comment' | 'follow';
  title: string;
  message: string;
  avatar: string;
  action_url?: string;
  created_at: string;
  read: boolean;
  from_user_id: string;
  from_user_name: string;
  from_user_avatar: string;
}

export class NotificationService {
  private static instance: NotificationService;
  private supabase = createClient();
  private listeners: Set<(notification: NotificationData) => void> = new Set();
  private subscription: any = null;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Subscribe to real-time notifications
  async subscribeToNotifications(userId: string) {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    // Subscribe to new notifications for this user
    this.subscription = this.supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const dbNotification = payload.new as DbNotification;
          this.handleNewNotification(dbNotification);
        }
      )
      .subscribe();
  }

  unsubscribeFromNotifications() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  // Convert database notification to UI notification
  private handleNewNotification(dbNotification: DbNotification) {
    const notification: NotificationData = {
      id: dbNotification.id,
      type: dbNotification.type,
      title: dbNotification.title,
      message: dbNotification.message,
      avatar: dbNotification.from_user_avatar || '/assets/icons/profile-placeholder.svg',
      actionUrl: dbNotification.action_url,
      timestamp: new Date(dbNotification.created_at),
      userId: dbNotification.from_user_id,
      userName: dbNotification.from_user_name,
    };

    // Play notification sound
    notificationSound.playNotificationSound(notification.type);

    // Trigger popup for all listeners
    this.listeners.forEach(listener => listener(notification));
  }

  // Add listener for popup notifications
  addNotificationListener(listener: (notification: NotificationData) => void) {
    this.listeners.add(listener);
  }

  removeNotificationListener(listener: (notification: NotificationData) => void) {
    this.listeners.delete(listener);
  }

  private async hasRecentDuplicateNotification(
    userId: string,
    type: DbNotification['type'],
    fromUserId: string,
    actionUrl?: string,
    withinMinutes: number = 20
  ): Promise<boolean> {
    try {
      const since = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();
      let query = this.supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('from_user_id', fromUserId)
        .gte('created_at', since)
        .limit(1);

      if (actionUrl) {
        query = query.eq('action_url', actionUrl);
      }

      const { data, error } = await query;
      if (error) return false;
      return !!data && data.length > 0;
    } catch {
      return false;
    }
  }

  // Create notification when someone creates a new post
  async createNewPostNotifications(postId: string, creatorId: string, creatorName: string, creatorAvatar: string, postCaption: string) {
    try {
      // Get all followers of the post creator
      const { data: followers, error: followersError } = await this.supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', creatorId);

      if (followersError) throw followersError;

      if (followers && followers.length > 0) {
        // Create notifications for all followers
        const notifications = followers.map(follower => ({
          user_id: follower.follower_id,
          type: 'new_post' as const,
          title: 'New Post',
          message: `${creatorName} shared a new post: ${this.truncateText(postCaption, 50)}`,
          avatar: creatorAvatar,
          action_url: `/posts/${postId}`,
          from_user_id: creatorId,
          from_user_name: creatorName,
          from_user_avatar: creatorAvatar,
          read: false,
        }));

        const { error: insertError } = await this.supabase
          .from('notifications')
          .insert(notifications);

        if (insertError) throw insertError;

        console.log(`Created ${notifications.length} new post notifications`);
      }
    } catch (error) {
      console.error('Error creating new post notifications:', error);
    }
  }

  // Create notification when someone likes a post
  async createLikeNotification(postId: string, postOwnerId: string, likerUserId: string, likerName: string, likerAvatar: string) {
    try {
      // Don't notify if user likes their own post
      if (postOwnerId === likerUserId) return;

      const actionUrl = `/posts/${postId}`;
      const isDuplicate = await this.hasRecentDuplicateNotification(
        postOwnerId,
        'like',
        likerUserId,
        actionUrl
      );
      if (isDuplicate) return;

      const notification = {
        user_id: postOwnerId,
        type: 'like' as const,
        title: 'You have new activity',
        message: `${likerName} liked your post`,
        avatar: likerAvatar,
        action_url: actionUrl,
        from_user_id: likerUserId,
        from_user_name: likerName,
        from_user_avatar: likerAvatar,
        read: false,
      };

      const { error } = await this.supabase
        .from('notifications')
        .insert([notification]);

      if (error) throw error;
    } catch (error) {
      console.error('Error creating like notification:', error);
    }
  }

  // Create notification when someone follows a user
  async createFollowNotification(followedUserId: string, followerUserId: string, followerName: string, followerAvatar: string) {
    try {
      const actionUrl = `/profile/${followerUserId}`;
      const isDuplicate = await this.hasRecentDuplicateNotification(
        followedUserId,
        'follow',
        followerUserId,
        actionUrl
      );
      if (isDuplicate) return;

      const notification = {
        user_id: followedUserId,
        type: 'follow' as const,
        title: 'Someone followed you',
        message: `${followerName} followed you`,
        avatar: followerAvatar,
        action_url: actionUrl,
        from_user_id: followerUserId,
        from_user_name: followerName,
        from_user_avatar: followerAvatar,
        read: false,
      };

      const { error } = await this.supabase
        .from('notifications')
        .insert([notification]);

      if (error) throw error;
    } catch (error) {
      console.error('Error creating follow notification:', error);
    }
  }

  // Create notification when someone comments on a post
  async createCommentNotification(
    postId: string,
    postOwnerId: string,
    commenterUserId: string,
    commenterName: string,
    commenterAvatar: string,
    commentText: string,
    isReply: boolean = false
  ) {
    try {
      // Don't notify if user comments on their own post
      if (postOwnerId === commenterUserId) return;

      const actionUrl = `/posts/${postId}`;
      const isDuplicate = await this.hasRecentDuplicateNotification(
        postOwnerId,
        'comment',
        commenterUserId,
        actionUrl
      );
      if (isDuplicate) return;

      const notification = {
        user_id: postOwnerId,
        type: 'comment' as const,
        title: isReply ? 'Someone replied to you' : 'You have new activity',
        message: isReply
          ? `${commenterName} replied: ${this.truncateText(commentText, 50)}`
          : `${commenterName} commented: ${this.truncateText(commentText, 50)}`,
        avatar: commenterAvatar,
        action_url: actionUrl,
        from_user_id: commenterUserId,
        from_user_name: commenterName,
        from_user_avatar: commenterAvatar,
        read: false,
      };

      const { error } = await this.supabase
        .from('notifications')
        .insert([notification]);

      if (error) throw error;
    } catch (error) {
      console.error('Error creating comment notification:', error);
    }
  }

  // Get user's notifications
  async getUserNotifications(userId: string, limit = 20) {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as DbNotification[];
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId: string) {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // Mark all notifications as read for a user
  async markAllNotificationsAsRead(userId: string) {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}

export const notificationService = NotificationService.getInstance();
