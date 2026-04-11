import { NextRequest, NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type NotificationEventType = 'new_post' | 'like' | 'follow' | 'comment' | 'message' | 'mention'

function extractMentionUsernames(text: string) {
  if (!text) return []
  const matches = text.match(/@[a-zA-Z0-9_.]+/g) || []
  return Array.from(new Set(matches.map((match) => match.slice(1).toLowerCase())))
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

async function hasRecentDuplicateNotification(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  type: NotificationEventType,
  fromUserId: string,
  actionUrl?: string,
  withinMinutes: number = 20
) {
  const since = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString()

  let query = adminClient
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('from_user_id', fromUserId)
    .gte('created_at', since)
    .limit(1)

  if (actionUrl) {
    query = query.eq('action_url', actionUrl)
  }

  const { data } = await query
  return Boolean(data && data.length > 0)
}

// GET /api/notifications — fetch notifications for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)

    const { data, error } = await supabase
      .from('notifications')
      .select('*, user:users!notifications_from_user_id_fkey(id, name, username, image_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching notifications:', error)
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    const unreadCount = (data || []).filter((n: any) => !n.read).length

    return NextResponse.json({ notifications: data || [], unreadCount })
  } catch (error) {
    console.error('GET notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/notifications — mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const notificationId = body?.notificationId
    const markAll = body?.markAll === true

    if (markAll) {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)

      if (error) {
        console.error('Error marking all as read:', error)
        return NextResponse.json({ error: 'Failed to mark all as read' }, { status: 500 })
      }
      return NextResponse.json({ success: true, message: 'All notifications marked as read' })
    }

    if (notificationId) {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error marking notification as read:', error)
        return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'notificationId or markAll required' }, { status: 400 })
  } catch (error) {
    console.error('PATCH notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({} as any))
    const eventType = body?.eventType as NotificationEventType | undefined

    if (!eventType || !['new_post', 'like', 'follow', 'comment', 'message', 'mention'].includes(eventType)) {
      return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data: actor } = await adminClient
      .from('users')
      .select('id, name, username, image_url')
      .eq('id', user.id)
      .single()

    if (!actor) {
      return NextResponse.json({ error: 'Actor profile not found' }, { status: 404 })
    }

    if (eventType === 'new_post') {
      const postId = typeof body?.postId === 'string' ? body.postId : ''
      if (!postId) {
        return NextResponse.json({ error: 'postId is required' }, { status: 400 })
      }

      const { data: post } = await adminClient
        .from('posts')
        .select('id, caption, creator_id')
        .eq('id', postId)
        .single()

      if (!post || post.creator_id !== user.id) {
        return NextResponse.json({ error: 'Post not found or unauthorized' }, { status: 404 })
      }

      const { data: followers } = await adminClient
        .from('follows')
        .select('follower_id')
        .eq('following_id', user.id)

      const notifications = (followers || []).map((follower) => ({
        user_id: follower.follower_id,
        type: 'new_post' as const,
        title: 'New Post',
        message: `${actor.name || actor.username || 'Someone'} shared a new post: ${truncateText(post.caption || 'New post', 50)}`,
        avatar: actor.image_url || '',
        action_url: `/posts/${post.id}`,
        from_user_id: actor.id,
        from_user_name: actor.name || actor.username || 'Unknown User',
        from_user_avatar: actor.image_url || '',
        read: false,
      }))

      if (notifications.length > 0) {
        await adminClient.from('notifications').insert(notifications)
      }

      return NextResponse.json({ success: true, inserted: notifications.length })
    }

    if (eventType === 'follow') {
      const followedUserId = typeof body?.followedUserId === 'string' ? body.followedUserId : ''
      if (!followedUserId) {
        return NextResponse.json({ error: 'followedUserId is required' }, { status: 400 })
      }

      if (followedUserId === user.id) {
        return NextResponse.json({ success: true, skipped: true })
      }

      const { data: followRecord } = await adminClient
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', followedUserId)
        .maybeSingle()

      if (!followRecord) {
        return NextResponse.json({ error: 'Follow relationship not found' }, { status: 400 })
      }

      const actionUrl = `/profile/${user.id}`
      const isDuplicate = await hasRecentDuplicateNotification(
        adminClient,
        followedUserId,
        'follow',
        user.id,
        actionUrl
      )

      if (isDuplicate) {
        return NextResponse.json({ success: true, skipped: true })
      }

      await adminClient.from('notifications').insert({
        user_id: followedUserId,
        type: 'follow',
        title: 'Someone followed you',
        message: `${actor.name || actor.username || 'Someone'} followed you`,
        avatar: actor.image_url || '',
        action_url: actionUrl,
        from_user_id: actor.id,
        from_user_name: actor.name || actor.username || 'Unknown User',
        from_user_avatar: actor.image_url || '',
        read: false,
      })

      return NextResponse.json({ success: true })
    }

    if (eventType === 'message') {
      const conversationId = typeof body?.conversationId === 'string' ? body.conversationId : ''
      const content = typeof body?.content === 'string' ? body.content : ''

      if (!conversationId) {
        return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
      }

      const { data: conversation } = await adminClient
        .from('conversations')
        .select('id, participant_one, participant_two')
        .eq('id', conversationId)
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
        .single()

      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }

      const recipientUserId = conversation.participant_one === user.id
        ? conversation.participant_two
        : conversation.participant_one

      if (!recipientUserId || recipientUserId === user.id) {
        return NextResponse.json({ success: true, skipped: true })
      }

      const actionUrl = `/messages`
      const isDuplicate = await hasRecentDuplicateNotification(
        adminClient,
        recipientUserId,
        'message',
        user.id,
        actionUrl,
        2
      )

      if (isDuplicate) {
        return NextResponse.json({ success: true, skipped: true })
      }

      await adminClient.from('notifications').insert({
        user_id: recipientUserId,
        type: 'message',
        title: 'New message',
        message: `${actor.name || actor.username || 'Someone'} sent you a message: ${truncateText(content || 'New message', 60)}`,
        avatar: actor.image_url || '',
        action_url: actionUrl,
        from_user_id: actor.id,
        from_user_name: actor.name || actor.username || 'Unknown User',
        from_user_avatar: actor.image_url || '',
        read: false,
      })

      return NextResponse.json({ success: true })
    }

    if (eventType === 'mention') {
      const entityType = typeof body?.entityType === 'string' ? body.entityType : 'post'
      const entityId = typeof body?.entityId === 'string' ? body.entityId : ''
      const content = typeof body?.content === 'string' ? body.content : ''
      const usernames = Array.isArray(body?.mentionedUsernames)
        ? body.mentionedUsernames.filter((value: unknown): value is string => typeof value === 'string')
        : extractMentionUsernames(content)

      if (!entityId || usernames.length === 0) {
        return NextResponse.json({ error: 'entityId and at least one mentioned username are required' }, { status: 400 })
      }

      const { data: mentionedUsers } = await adminClient
        .from('users')
        .select('id, username')
        .in('username', usernames)

      if (!mentionedUsers || mentionedUsers.length === 0) {
        return NextResponse.json({ success: true, skipped: true })
      }

      const notifications = []

      for (const mentionedUser of mentionedUsers) {
        if (!mentionedUser?.id || mentionedUser.id === user.id) continue

        const actionUrl = entityType === 'message' ? '/messages' : `/posts/${entityId}`
        const isDuplicate = await hasRecentDuplicateNotification(
          adminClient,
          mentionedUser.id,
          'mention',
          user.id,
          actionUrl,
          10
        )

        if (isDuplicate) continue

        notifications.push({
          user_id: mentionedUser.id,
          type: 'mention',
          title: 'You were mentioned',
          message: `${actor.name || actor.username || 'Someone'} mentioned you: ${truncateText(content, 60)}`,
          avatar: actor.image_url || '',
          action_url: actionUrl,
          from_user_id: actor.id,
          from_user_name: actor.name || actor.username || 'Unknown User',
          from_user_avatar: actor.image_url || '',
          read: false,
        })
      }

      if (notifications.length > 0) {
        await adminClient.from('notifications').insert(notifications)
      }

      return NextResponse.json({ success: true, inserted: notifications.length })
    }

    const postId = typeof body?.postId === 'string' ? body.postId : ''
    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 })
    }

    const { data: post } = await adminClient
      .from('posts')
      .select('id, creator_id')
      .eq('id', postId)
      .single()

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (post.creator_id === user.id) {
      return NextResponse.json({ success: true, skipped: true })
    }

    const actionUrl = `/posts/${post.id}`

    if (eventType === 'like') {
      const isDuplicate = await hasRecentDuplicateNotification(
        adminClient,
        post.creator_id,
        'like',
        user.id,
        actionUrl
      )

      if (isDuplicate) {
        return NextResponse.json({ success: true, skipped: true })
      }

      await adminClient.from('notifications').insert({
        user_id: post.creator_id,
        type: 'like',
        title: 'You have new activity',
        message: `${actor.name || actor.username || 'Someone'} liked your post`,
        avatar: actor.image_url || '',
        action_url: actionUrl,
        from_user_id: actor.id,
        from_user_name: actor.name || actor.username || 'Unknown User',
        from_user_avatar: actor.image_url || '',
        read: false,
      })

      return NextResponse.json({ success: true })
    }

    const commentText = typeof body?.commentText === 'string' ? body.commentText : ''
    const isReply = body?.isReply === true
    const isDuplicate = await hasRecentDuplicateNotification(
      adminClient,
      post.creator_id,
      'comment',
      user.id,
      actionUrl
    )

    if (isDuplicate) {
      return NextResponse.json({ success: true, skipped: true })
    }

    await adminClient.from('notifications').insert({
      user_id: post.creator_id,
      type: 'comment',
      title: isReply ? 'Someone replied to you' : 'You have new activity',
      message: isReply
        ? `${actor.name || actor.username || 'Someone'} replied: ${truncateText(commentText, 50)}`
        : `${actor.name || actor.username || 'Someone'} commented: ${truncateText(commentText, 50)}`,
      avatar: actor.image_url || '',
      action_url: actionUrl,
      from_user_id: actor.id,
      from_user_name: actor.name || actor.username || 'Unknown User',
      from_user_avatar: actor.image_url || '',
      read: false,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Notification API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}