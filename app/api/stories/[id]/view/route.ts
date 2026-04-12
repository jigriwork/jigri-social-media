import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAuthenticatedUser(supabase: Awaited<ReturnType<typeof createClient>>, request?: NextRequest) {
    const authHeader = request?.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (token) {
        const { data, error } = await supabase.auth.getUser(token)
        if (!error && data.user) return data.user
    }

    const {
        data: { user },
    } = await supabase.auth.getUser()

    return user
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const supabase = await createClient()
        const user = await getAuthenticatedUser(supabase, request)
        const resolvedParams = await params
        const storyId = resolvedParams.id

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const nowIso = new Date().toISOString()

        const { data: story, error: storyError } = await (supabase as any)
            .from('stories')
            .select('id, user_id, is_active, expires_at')
            .eq('id', storyId)
            .single()

        if (storyError || !story) {
            return NextResponse.json({ error: 'Story not found' }, { status: 404 })
        }

        if (!story.is_active || new Date(story.expires_at).toISOString() <= nowIso) {
            return NextResponse.json({ error: 'Story has expired' }, { status: 410 })
        }

        if (story.user_id === user.id) {
            return NextResponse.json({ viewed: false, own_story: true })
        }

        const { error: insertError } = await (supabase as any)
            .from('story_views')
            .upsert(
                {
                    story_id: storyId,
                    viewer_id: user.id,
                    viewed_at: new Date().toISOString(),
                },
                {
                    onConflict: 'story_id,viewer_id',
                    ignoreDuplicates: true,
                }
            )

        if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 500 })
        }

        return NextResponse.json({ viewed: true })
    } catch (error) {
        console.error('POST /api/stories/[id]/view error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
