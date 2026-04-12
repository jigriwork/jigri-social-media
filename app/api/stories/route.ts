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

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const user = await getAuthenticatedUser(supabase, request)

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const formData = await request.formData()
        const media = formData.get('media')
        const caption = (formData.get('caption') as string | null)?.trim() || null

        if (!(media instanceof File)) {
            return NextResponse.json({ error: 'Media file is required' }, { status: 400 })
        }

        const isImage = media.type.startsWith('image/')
        const isVideo = media.type.startsWith('video/')

        if (!isImage && !isVideo) {
            return NextResponse.json({ error: 'Only image and video stories are allowed' }, { status: 400 })
        }

        const storyId = crypto.randomUUID()
        const ext = media.name.includes('.') ? media.name.split('.').pop() : (isVideo ? 'mp4' : 'jpg')
        const safeExt = ext?.replace(/[^a-zA-Z0-9]/g, '') || (isVideo ? 'mp4' : 'jpg')
        const objectPath = `stories/${user.id}/${storyId}/media.${safeExt}`

        const { error: uploadError } = await supabase.storage
            .from(STORIES_BUCKET)
            .upload(objectPath, media, {
                cacheControl: '3600',
                upsert: false,
            })

        if (uploadError) {
            return NextResponse.json({ error: uploadError.message }, { status: 500 })
        }

        const {
            data: { publicUrl },
        } = supabase.storage.from(STORIES_BUCKET).getPublicUrl(objectPath)

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

        const { data: story, error: insertError } = await (supabase as any)
            .from('stories')
            .insert({
                id: storyId,
                user_id: user.id,
                media_url: publicUrl,
                media_type: isVideo ? 'video' : 'image',
                caption,
                expires_at: expiresAt,
                is_active: true,
            })
            .select('*')
            .single()

        if (insertError) {
            await supabase.storage.from(STORIES_BUCKET).remove([objectPath])
            return NextResponse.json({ error: insertError.message }, { status: 500 })
        }

        return NextResponse.json({ story }, { status: 201 })
    } catch (error) {
        console.error('POST /api/stories error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
