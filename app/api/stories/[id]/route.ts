import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const STORIES_BUCKET = 'posts'

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const supabase = await createClient()
        const user = await getAuthenticatedUser(supabase, request)
        const resolvedParams = await params
        const userId = resolvedParams.id

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const nowIso = new Date().toISOString()

        const { data: stories, error: storiesError } = await (supabase as any)
            .from('stories')
            .select('id, user_id, media_url, media_type, caption, created_at, expires_at, users:user_id(id, username, name, image_url, is_verified, verification_badge_type, role)')
            .eq('user_id', userId)
            .eq('is_active', true)
            .gt('expires_at', nowIso)
            .order('created_at', { ascending: true })

        if (storiesError) {
            return NextResponse.json({ error: storiesError.message }, { status: 500 })
        }

        const storyIds = (stories || []).map((story: any) => story.id)

        let viewedStoryIds = new Set<string>()
        if (storyIds.length > 0) {
            const { data: views } = await (supabase as any)
                .from('story_views')
                .select('story_id')
                .eq('viewer_id', user.id)
                .in('story_id', storyIds)

            viewedStoryIds = new Set((views || []).map((view: any) => view.story_id))
        }

        const enhancedStories = (stories || []).map((story: any) => ({
            ...story,
            viewed: viewedStoryIds.has(story.id),
            viewers: [],
        }))

        if (user.id === userId && storyIds.length > 0) {
            const { data: viewerRows } = await (supabase as any)
                .from('story_views')
                .select('story_id, viewer_id, viewed_at, users:viewer_id(id, name, username, image_url, is_verified, verification_badge_type, role)')
                .in('story_id', storyIds)
                .order('viewed_at', { ascending: false })

            const viewerMap = new Map<string, any[]>()
            for (const row of viewerRows || []) {
                if (!viewerMap.has(row.story_id)) {
                    viewerMap.set(row.story_id, [])
                }
                viewerMap.get(row.story_id)!.push({
                    id: row.viewer_id,
                    name: row.users?.name || row.users?.username || 'Viewer',
                    username: row.users?.username || null,
                    image_url: row.users?.image_url || null,
                    is_verified: row.users?.is_verified || false,
                    verification_badge_type: row.users?.verification_badge_type || null,
                    role: row.users?.role || null,
                    viewed_at: row.viewed_at,
                })
            }

            for (const story of enhancedStories) {
                story.viewers = viewerMap.get(story.id) || []
                story.viewer_count = story.viewers.length
            }
        }

        return NextResponse.json({ stories: enhancedStories })
    } catch (error) {
        console.error('GET /api/stories/[id] error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const supabase = await createClient()
        const user = await getAuthenticatedUser(supabase, request)
        const resolvedParams = await params
        const storyId = resolvedParams.id

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: story, error: storyError } = await (supabase as any)
            .from('stories')
            .select('id, user_id, media_url')
            .eq('id', storyId)
            .single()

        if (storyError || !story) {
            return NextResponse.json({ error: 'Story not found' }, { status: 404 })
        }

        if (story.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { error: deleteError } = await (supabase as any)
            .from('stories')
            .delete()
            .eq('id', storyId)

        if (deleteError) {
            return NextResponse.json({ error: deleteError.message }, { status: 500 })
        }

        if (story.media_url && typeof story.media_url === 'string') {
            const marker = `/storage/v1/object/public/${STORIES_BUCKET}/`
            const index = story.media_url.indexOf(marker)
            if (index >= 0) {
                const objectPath = story.media_url.slice(index + marker.length)
                await supabase.storage.from(STORIES_BUCKET).remove([objectPath])
            }
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('DELETE /api/stories/[id] error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
