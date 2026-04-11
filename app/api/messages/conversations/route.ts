import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/messages/conversations — list user's conversations
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch conversations where user is a participant
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        participant_one_user:users!conversations_participant_one_fkey(id, name, username, image_url, is_verified, verification_badge_type, role),
        participant_two_user:users!conversations_participant_two_fkey(id, name, username, image_url, is_verified, verification_badge_type, role)
      `)
      .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
      .order('last_message_at', { ascending: false })

    if (error) {
      console.error('Error fetching conversations:', error)
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
    }

    // For each conversation, get the last message and unread count
    const conversationsWithMeta = await Promise.all(
      (data || []).map(async (conv) => {
        // Get last message
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('id, content, sender_id, created_at, read')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        // Get unread count (messages FROM the other person that are unread)
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', user.id)
          .eq('read', false)

        return {
          ...conv,
          lastMessage: lastMsg || null,
          unreadCount: unreadCount || 0,
        }
      })
    )

    return NextResponse.json({ conversations: conversationsWithMeta })
  } catch (error) {
    console.error('Conversations API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/messages/conversations — create or find conversation with another user
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const otherUserId = body?.otherUserId

    if (!otherUserId || typeof otherUserId !== 'string') {
      return NextResponse.json({ error: 'otherUserId is required' }, { status: 400 })
    }

    if (otherUserId === user.id) {
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })
    }

    // Check if other user exists
    const { data: otherUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', otherUserId)
      .single()

    if (!otherUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if conversation already exists (in either direction)
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .or(
        `and(participant_one.eq.${user.id},participant_two.eq.${otherUserId}),and(participant_one.eq.${otherUserId},participant_two.eq.${user.id})`
      )
      .limit(1)
      .single()

    if (existing) {
      return NextResponse.json({ conversation: existing, created: false })
    }

    // Create new conversation (always put smaller UUID first for consistency)
    const [p1, p2] = user.id < otherUserId
      ? [user.id, otherUserId]
      : [otherUserId, user.id]

    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({ participant_one: p1, participant_two: p2 })
      .select()
      .single()

    if (error) {
      // Handle unique constraint violation (race condition)
      if (error.code === '23505') {
        const { data: raceConv } = await supabase
          .from('conversations')
          .select('*')
          .or(
            `and(participant_one.eq.${user.id},participant_two.eq.${otherUserId}),and(participant_one.eq.${otherUserId},participant_two.eq.${user.id})`
          )
          .limit(1)
          .single()

        return NextResponse.json({ conversation: raceConv, created: false })
      }
      console.error('Error creating conversation:', error)
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }

    return NextResponse.json({ conversation: newConv, created: true })
  } catch (error) {
    console.error('Create conversation API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
