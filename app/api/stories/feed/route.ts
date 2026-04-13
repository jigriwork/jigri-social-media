import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const STORIES_BUCKET = 'stories'
const LEGACY_STORIES_BUCKET = 'posts'

function extractStorageLocation(mediaUrl: string): { bucket: string; path: string } | null {
    if (mediaUrl.startsWith('stories://')) {
        return { bucket: STORIES_BUCKET, path: mediaUrl.slice('stories://'.length) }
    }

    const markers = [
        { bucket: STORIES_BUCKET, marker: `/storage/v1/object/public/${STORIES_BUCKET}/` },
        { bucket: LEGACY_STORIES_BUCKET, marker: `/storage/v1/object/public/${LEGACY_STORIES_BUCKET}/` },
    ]

    for (const { bucket, marker } of markers) {
        const index = mediaUrl.indexOf(marker)
        if (index >= 0) {
            return {
                bucket,
                path: mediaUrl.slice(index + marker.length),
            }
        }
    }

    return null
}

async function resolveStoryMediaUrl(supabase: Awaited<ReturnType<typeof createClient>>, mediaUrl: string | null) {
    if (!mediaUrl || typeof mediaUrl !== 'string') return mediaUrl

    const location = extractStorageLocation(mediaUrl)
    if (!location) return mediaUrl

    if (location.bucket === LEGACY_STORIES_BUCKET) {
        return mediaUrl
    }

    const { data, error } = await supabase.storage
        .from(location.bucket)
        .createSignedUrl(location.path, 60 * 60)

    if (error || !data?.signedUrl) return mediaUrl
    return data.signedUrl
}

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

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const user = await getAuthenticatedUser(supabase, request)

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const nowIso = new Date().toISOString()

        const { data: stories, error: storiesError } = await (supabase as any)
            .from('stories')
            .select('id, user_id, media_url, media_type, caption, created_at, expires_at, users:user_id(id, username, name, image_url, is_verified, verification_badge_type, role)')
            .eq('is_active', true)
            .gt('expires_at', nowIso)
            .order('created_at', { ascending: true })

        if (storiesError) {
            return NextResponse.json({ error: storiesError.message }, { status: 500 })
        }

        const storyIds = (stories || []).map((story: any) => story.id)

        const { data: follows } = await (supabase as any)
            .from('follows')
            .select('following_id')
            .eq('follower_id', user.id)

        const followedSet = new Set((follows || []).map((item: any) => item.following_id))

        let viewedStoryIds = new Set<string>()
        if (storyIds.length > 0) {
            const { data: views } = await (supabase as any)
                .from('story_views')
                .select('story_id')
                .eq('viewer_id', user.id)
                .in('story_id', storyIds)

            viewedStoryIds = new Set((views || []).map((view: any) => view.story_id))
        }

        const grouped = new Map<string, any>()

        for (const story of stories || []) {
            const uid = story.user_id
            const item = {
                ...story,
                media_url: await resolveStoryMediaUrl(supabase, story.media_url),
                viewed: viewedStoryIds.has(story.id),
            }

            if (!grouped.has(uid)) {
                grouped.set(uid, {
                    user: story.users,
                    stories: [item],
                })
            } else {
                grouped.get(uid).stories.push(item)
            }
        }

        const groups = Array.from(grouped.values()).map((group: any) => {
            const hasUnviewed = group.stories.some((story: any) => !story.viewed)
            const latestCreatedAt = group.stories[group.stories.length - 1]?.created_at || null
            return {
                user: group.user,
                stories: group.stories,
                hasUnviewed,
                latestCreatedAt,
            }
        })

        groups.sort((a: any, b: any) => {
            const aFollowed = followedSet.has(a.user?.id)
            const bFollowed = followedSet.has(b.user?.id)

            if (aFollowed !== bFollowed) {
                return aFollowed ? -1 : 1
            }

            const aTime = new Date(a.latestCreatedAt || 0).getTime()
            const bTime = new Date(b.latestCreatedAt || 0).getTime()

            return bTime - aTime
        })

        return NextResponse.json({ groups })
    } catch (error) {
        console.error('GET /api/stories/feed error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
