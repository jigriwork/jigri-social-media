import { NextRequest, NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type NotificationEventType = 'new_post' | 'like' | 'follow' | 'comment'

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

    if (!eventType || !['new_post', 'like', 'follow', 'comment'].includes(eventType)) {
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