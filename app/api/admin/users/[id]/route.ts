import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../../src/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserGovernanceById, logGovernanceAudit, requireMinRole } from '@/lib/governance/server';

function isAppointedVerificationReviewer(email?: string | null) {
  const raw = process.env.VERIFICATION_REVIEWER_EMAILS || ''
  if (!email || !raw) return false
  const allowList = raw
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
  return allowList.includes(email.toLowerCase())
}

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
    const action = typeof body?.action === 'string' ? body.action : 'toggle_activation'
    const reason = typeof body?.reason === 'string' ? body.reason : 'Admin user update action'

    const supabase = await createClient();

    if (action === 'update_profile') {
      if (actor.role !== 'super_admin') {
        return NextResponse.json(
          { error: 'Only super admin can edit user profiles from admin panel' },
          { status: 403 }
        );
      }

      const targetUser = await getUserGovernanceById(resolvedParams.id)
      if (!targetUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      const name = typeof body?.name === 'string' ? body.name.trim() : targetUser.name
      const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : targetUser.username
      const bio = typeof body?.bio === 'string' ? body.bio.trim() : targetUser.bio
      const role = typeof body?.role === 'string' ? body.role : targetUser.role

      if (!name || !username) {
        return NextResponse.json(
          { error: 'Name and username are required' },
          { status: 400 }
        );
      }

      if (!['user', 'moderator', 'admin', 'super_admin'].includes(role)) {
        return NextResponse.json(
          { error: 'Invalid role' },
          { status: 400 }
        );
      }

      if (targetUser.isBootstrapProtected && role !== 'super_admin') {
        return NextResponse.json(
          { error: 'Cannot demote protected bootstrap super admin' },
          { status: 400 }
        );
      }

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          name,
          username,
          bio,
          role,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resolvedParams.id)
        .select('*')
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message || 'Failed to update user profile' },
          { status: 500 }
        );
      }

      await logGovernanceAudit({
        actionType: 'admin_update_user_profile',
        targetType: 'user',
        targetId: resolvedParams.id,
        reason,
        beforeSnapshot: {
          name: targetUser.name,
          username: targetUser.username,
          bio: targetUser.bio,
          role: targetUser.role,
        },
        afterSnapshot: {
          name: updatedUser.name,
          username: updatedUser.username,
          bio: updatedUser.bio,
          role: updatedUser.role,
        },
      })

      return NextResponse.json({ success: true, user: updatedUser });
    }

    if (action === 'set_verification') {
      if (actor.role !== 'super_admin' && !isAppointedVerificationReviewer(actor.email)) {
        return NextResponse.json(
          { error: 'Only super admin or appointed verification reviewer can set verification badges' },
          { status: 403 }
        );
      }

      const targetUser = await getUserGovernanceById(resolvedParams.id)
      if (!targetUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      const isVerified = body?.isVerified === true
      const badgeType = body?.badgeType === 'official' ? 'official' : 'verified'
      const nowIso = new Date().toISOString()

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          is_verified: isVerified,
          verification_badge_type: isVerified ? badgeType : null,
          verification_status: isVerified ? 'verified' : 'none',
          verification_updated_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', resolvedParams.id)
        .select('*')
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message || 'Failed to update verification badge' },
          { status: 500 }
        );
      }

      await logGovernanceAudit({
        actionType: isVerified ? 'verification_approved' : 'verification_revoked',
        targetType: 'user',
        targetId: resolvedParams.id,
        reason,
        beforeSnapshot: {
          is_verified: targetUser.is_verified,
          verification_badge_type: targetUser.verification_badge_type,
        },
        afterSnapshot: {
          is_verified: updatedUser.is_verified,
          verification_badge_type: updatedUser.verification_badge_type,
        },
      })

      return NextResponse.json({ success: true, user: updatedUser });
    }

    if (action === 'reset_password') {
      if (actor.role !== 'super_admin') {
        return NextResponse.json(
          { error: 'Only super admin can reset user passwords from admin panel' },
          { status: 403 }
        );
      }

      const targetUser = await getUserGovernanceById(resolvedParams.id)
      if (!targetUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      const newPassword = typeof body?.newPassword === 'string' ? body.newPassword.trim() : ''
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: 'New password must be at least 8 characters' },
          { status: 400 }
        );
      }

      const adminClient = createAdminClient()
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(resolvedParams.id, {
        password: newPassword,
        email_confirm: true,
      })

      if (authUpdateError) {
        return NextResponse.json(
          { error: authUpdateError.message || 'Failed to reset user password' },
          { status: 500 }
        )
      }

      await logGovernanceAudit({
        actionType: 'admin_reset_user_password',
        targetType: 'user',
        targetId: resolvedParams.id,
        reason,
        metadata: { actor_role: actor.role },
      })

      return NextResponse.json({ success: true, message: 'Password reset successfully' })
    }

    if (action === 'delete_user') {
      if (actor.role !== 'super_admin') {
        return NextResponse.json(
          { error: 'Only super admin can delete users from admin panel' },
          { status: 403 }
        );
      }

      if (actor.userId === resolvedParams.id) {
        return NextResponse.json(
          { error: 'Cannot delete your own account' },
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
          { error: 'Cannot delete protected super admin account' },
          { status: 400 }
        );
      }

      const adminClient = createAdminClient()
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(resolvedParams.id)
      if (authDeleteError) {
        return NextResponse.json(
          { error: authDeleteError.message || 'Failed to delete auth user' },
          { status: 500 }
        )
      }

      await supabase.from('users').delete().eq('id', resolvedParams.id)

      await logGovernanceAudit({
        actionType: 'admin_delete_user',
        targetType: 'user',
        targetId: resolvedParams.id,
        reason,
        beforeSnapshot: {
          role: targetUser.role,
          email: targetUser.email,
        },
      })

      return NextResponse.json({ success: true, message: 'User deleted successfully' })
    }

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
