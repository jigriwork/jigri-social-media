import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  let supabase
  try {
    supabase = createAdminClient()
  } catch {
    return NextResponse.json(
      {
        error: 'Supabase configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  try {
    // Try to get user data - this will work if RLS allows it or we have service role
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, username, email, image_url, bio, created_at')
      .eq('id', userId)
      .single()

    // If user query fails, try getting minimal data through posts table
    let userData = user
    if (userError) {
      console.log('Direct user query failed, trying posts table approach')
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select(`
          creator:users!posts_creator_id_fkey (
            id,
            name,
            username,
            image_url,
            bio,
            created_at
          )
        `)
        .eq('creator_id', userId)
        .limit(1)

      if (!postError && postData && postData[0] && postData[0].creator) {
        const creatorRaw = postData[0].creator as
          | {
              id: string
              name: string
              username: string
              image_url: string | null
              bio: string | null
              created_at: string
            }
          | Array<{
              id: string
              name: string
              username: string
              image_url: string | null
              bio: string | null
              created_at: string
            }>

        const creator = Array.isArray(creatorRaw) ? creatorRaw[0] : creatorRaw

        if (!creator) {
          throw new Error('Creator data not available')
        }

        userData = {
          id: creator.id,
          name: creator.name,
          username: creator.username,
          image_url: creator.image_url,
          bio: creator.bio,
          created_at: creator.created_at,
          email: '' // Don't expose email through this method
        }
      } else {
        // Return basic fallback data
        userData = {
          id: userId,
          name: 'User Profile',
          username: 'user_profile',
          email: '',
          image_url: null,
          bio: 'Profile information is currently unavailable',
          created_at: new Date().toISOString()
        }
      }
    }

    // Get user posts
    const { data: posts } = await supabase
      .from('posts')
      .select(`
        *,
        creator:users!posts_creator_id_fkey (
          id,
          name,
          username,
          image_url
        ),
        likes:likes!likes_post_id_fkey (
          user_id
        ),
        saves:saves!saves_post_id_fkey (
          user_id
        )
      `)
      .eq('creator_id', userId)
      .order('created_at', { ascending: false })

    // Get followers count
    const { count: followersCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId)

    // Get following count
    const { count: followingCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId)

    return NextResponse.json({
      user: userData,
      posts: posts || [],
      followersCount: followersCount || 0,
      followingCount: followingCount || 0
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
