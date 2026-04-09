import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../src/lib/supabase/server';
import { requireMinRole } from '@/lib/governance/server';

// GET /api/admin/users - List all users
export async function GET(request: NextRequest) {
  try {
    await requireMinRole('admin')

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const onlyAdmins = searchParams.get('onlyAdmins') === 'true';
    
    const offset = (page - 1) * limit;

    let query = supabase
      .from('users')
      .select(`
        id,
        name,
        username,
        email,
        image_url,
        bio,
        role,
        is_admin,
        is_active,
        is_deactivated,
        last_active,
        created_at,
        updated_at
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (onlyAdmins) {
      query = query.in('role', ['admin', 'super_admin']);
    }

    // Add search filter if provided
    if (search) {
      query = query.or(`name.ilike.%${search}%,username.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Add pagination
    query = query.range(offset, offset + limit - 1);

    const { data: users, error, count } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Admin users API error:', error);
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
