import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../src/lib/supabase/server';
import { getUserGovernanceById, logGovernanceAudit, requireMinRole } from '@/lib/governance/server';

// GET /api/admin/users/[id] - Get user details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  try {
    await requireMinRole('admin')

    const supabase = await createClient();
    const { data: user, error } = await supabase
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
      `)
      .eq('id', resolvedParams.id)
      .single();

    if (error) {
      console.error('Error fetching user:', error);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user statistics
    const [postsResult, followersResult, followingResult] = await Promise.allSettled([
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('creator_id', resolvedParams.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', resolvedParams.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', resolvedParams.id)
    ]);

    const stats = {
      postsCount: postsResult.status === 'fulfilled' ? postsResult.value.count || 0 : 0,
      followersCount: followersResult.status === 'fulfilled' ? followersResult.value.count || 0 : 0,
      followingCount: followingResult.status === 'fulfilled' ? followingResult.value.count || 0 : 0
    };

    return NextResponse.json({
      user,
      stats
    });

  } catch (error) {
    console.error('Admin user details API error:', error);
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

// DELETE /api/admin/users/[id] - Deactivate user
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  try {
    const actor = await requireMinRole('admin')

    const supabase = await createClient();

    if (actor.userId === resolvedParams.id) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own account' },
        { status: 400 }
      );
    }

    const targetUser = await getUserGovernanceById(resolvedParams.id)
    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (targetUser.role === 'super_admin') {
      return NextResponse.json(
        { error: 'Cannot deactivate a super admin user' },
        { status: 400 }
      );
    }

    if (targetUser.isBootstrapProtected) {
      return NextResponse.json(
        { error: 'Cannot deactivate protected bootstrap super admin' },
        { status: 400 }
      );
    }

    if (targetUser.role === 'admin' && actor.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Cannot deactivate another admin user' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        is_deactivated: true,
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', resolvedParams.id);

    if (updateError) {
      console.error('Error deactivating user:', updateError);
      return NextResponse.json(
        { error: 'Failed to deactivate user' },
        { status: 500 }
      );
    }

    await logGovernanceAudit({
      actionType: 'admin_deactivate_user',
      targetType: 'user',
      targetId: resolvedParams.id,
      reason: 'Admin deactivation action',
      beforeSnapshot: {
        role: targetUser.role,
        is_deactivated: targetUser.is_deactivated,
      },
      afterSnapshot: {
        is_deactivated: true,
        is_active: false,
      },
    })

    return NextResponse.json({
      message: 'User deactivated successfully',
      userId: resolvedParams.id
    });

  } catch (error) {
    console.error('Admin user deactivation API error:', error);
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

// PATCH /api/admin/users/[id] - Toggle activation status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  try {
    const actor = await requireMinRole('admin')
    const body = await request.json().catch(() => ({} as any))
    const reason = typeof body?.reason === 'string' ? body.reason : 'Admin activation status update'

    if (actor.userId === resolvedParams.id) {
      return NextResponse.json(
        { error: 'Cannot modify your own account status' },
        { status: 400 }
      );
    }

    const targetUser = await getUserGovernanceById(resolvedParams.id)
    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (targetUser.isBootstrapProtected || targetUser.role === 'super_admin') {
      return NextResponse.json(
        { error: 'Cannot modify protected super admin account status' },
        { status: 400 }
      );
    }

    if (targetUser.role === 'admin' && actor.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super admin can modify another admin status' },
        { status: 403 }
      );
    }

    const newDeactivatedStatus = !targetUser.is_deactivated;
    const newActiveStatus = !newDeactivatedStatus;

    const supabase = await createClient();
    const { error: updateError } = await supabase
      .from('users')
      .update({
        is_deactivated: newDeactivatedStatus,
        is_active: newActiveStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', resolvedParams.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update user status' },
        { status: 500 }
      );
    }

    await logGovernanceAudit({
      actionType: newDeactivatedStatus ? 'admin_deactivate_user' : 'admin_activate_user',
      targetType: 'user',
      targetId: resolvedParams.id,
      reason,
      beforeSnapshot: {
        role: targetUser.role,
        is_deactivated: targetUser.is_deactivated,
      },
      afterSnapshot: {
        is_deactivated: newDeactivatedStatus,
        is_active: newActiveStatus,
      },
    })

    return NextResponse.json({
      success: true,
      message: `User ${newDeactivatedStatus ? 'deactivated' : 'activated'} successfully`,
      isDeactivated: newDeactivatedStatus,
    });
  } catch (error) {
    console.error('Admin user status update API error:', error);
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
