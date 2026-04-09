import { NextResponse } from 'next/server';
import { requireMinRole } from '@/lib/governance/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/admin/stats - Get basic statistics
export async function GET() {
  try {
    await requireMinRole('admin')
    const adminClient = createAdminClient()

    const [{ count: totalUsers }, { count: totalPosts }, { count: totalLikes }, { count: totalComments }] = await Promise.all([
      adminClient.from('users').select('*', { count: 'exact', head: true }),
      adminClient.from('posts').select('*', { count: 'exact', head: true }),
      adminClient.from('likes').select('*', { count: 'exact', head: true }),
      adminClient.from('comments').select('*', { count: 'exact', head: true }),
    ])

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [{ count: activeToday }, { count: newUsers }] = await Promise.all([
      adminClient
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .gte('last_active', today.toISOString()),
      adminClient
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString()),
    ])

    const stats = {
      totalUsers: totalUsers || 0,
      totalPosts: totalPosts || 0,
      activeToday: activeToday || 0,
      totalLikes: totalLikes || 0,
      totalComments: totalComments || 0,
      newUsersThisWeek: newUsers || 0,
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Admin stats API error:', error);
    
    // Check if it's an access error
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json(
        { error: 'Access denied. Admin privileges required.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
