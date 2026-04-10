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

  private async sendNotificationEvent(payload: Record<string, unknown>) {
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload?.error || 'Failed to create notification');
    }

    return response.json().catch(() => ({}));
  }

  // Create notification when someone creates a new post
  async createNewPostNotifications(postId: string) {
    try {
      await this.sendNotificationEvent({ eventType: 'new_post', postId });
    } catch (error) {
      console.error('Error creating new post notifications:', error);
    }
  }

  // Create notification when someone likes a post
  async createLikeNotification(postId: string) {
    try {
      await this.sendNotificationEvent({ eventType: 'like', postId });
    } catch (error) {
      console.error('Error creating like notification:', error);
    }
  }

  // Create notification when someone follows a user
  async createFollowNotification(followedUserId: string) {
    try {
      await this.sendNotificationEvent({ eventType: 'follow', followedUserId });
    } catch (error) {
      console.error('Error creating follow notification:', error);
    }
  }

  // Create notification when someone comments on a post
  async createCommentNotification(
    postId: string,
    commentText: string,
    isReply: boolean = false
  ) {
    try {
      await this.sendNotificationEvent({ eventType: 'comment', postId, commentText, isReply });
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

}

export const notificationService = NotificationService.getInstance();
