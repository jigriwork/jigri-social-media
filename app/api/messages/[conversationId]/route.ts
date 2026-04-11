import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/messages/[conversationId] — fetch messages in a conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId } = await params

    // Verify user is a participant
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, participant_one, participant_two')
      .eq('id', conversationId)
      .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
      .single()

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Get URL params for pagination
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const before = url.searchParams.get('before') // cursor for older messages

    let query = supabase
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey(id, name, username, image_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data: messages, error } = await query

    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    // Mark unread messages from the other user as read
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('read', false)

    return NextResponse.json({ messages: (messages || []).reverse() })
  } catch (error) {
    console.error('Messages API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/messages/[conversationId] — send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId } = await params
    const body = await request.json().catch(() => ({}))
    const content = body?.content?.trim()

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    if (content.length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 characters)' }, { status: 400 })
    }

    // Verify user is a participant
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, participant_one, participant_two')
      .eq('id', conversationId)
      .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
      .single()

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Insert message
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: content,
      })
      .select(`
        *,
        sender:users!messages_sender_id_fkey(id, name, username, image_url)
      `)
      .single()

    if (error) {
      console.error('Error sending message:', error)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    return NextResponse.json({ message })
  } catch (error) {
    console.error('Send message API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
