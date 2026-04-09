import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMinRole } from '@/lib/governance/server'

// GET /api/admin/verification - verification queue (moderator+)
export async function GET(request: NextRequest) {
  try {
    await requireMinRole('moderator')

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const reviewer = searchParams.get('reviewer')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = (page - 1) * limit

    const adminClient = createAdminClient()
    let query = adminClient
      .from('verification_applications')
      .select(
        `
        *,
        applicant:users!verification_applications_applicant_user_id_fkey(
          id,
          name,
          username,
          image_url,
          is_verified,
          verification_badge_type,
          verification_status
        ),
        reviewer:users!verification_applications_reviewed_by_user_id_fkey(
          id,
          name,
          username
        )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (reviewer && reviewer !== 'all') {
      if (reviewer === 'unassigned') {
        query = query.is('reviewed_by_user_id', null)
      } else {
        query = query.eq('reviewed_by_user_id', reviewer)
      }
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch verification queue' }, { status: 500 })
    }

    return NextResponse.json({
      applications: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json({ error: 'Access denied. Moderator privileges required.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
