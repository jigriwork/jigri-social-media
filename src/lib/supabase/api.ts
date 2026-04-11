'use client'

import { createClient } from './client'
import { Database } from './database.types'

export type User = Database['public']['Tables']['users']['Row']
export type Post = Database['public']['Tables']['posts']['Row'] & {
  creator: User
  likes: Array<{ user_id: string }>
  saves: Array<{ user_id: string }>
  comments?: Comment[]
  _count?: {
    comments: number
  }
}
export type Like = Database['public']['Tables']['likes']['Row']
export type Save = Database['public']['Tables']['saves']['Row']
export type Follow = Database['public']['Tables']['follows']['Row']
export type Comment = Database['public']['Tables']['comments']['Row'] & {
  user: User
  likes: Array<{ user_id: string }>
  replies?: Comment[]
  _count?: {
    likes: number
    replies: number
  }
}
export type CommentLike = Database['public']['Tables']['comment_likes']['Row']
export type VerificationApplication = Database['public']['Tables']['verification_applications']['Row']

const supabase = createClient()

async function getAuthenticatedFetchHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    }
  } catch (error) {
    console.warn('Unable to attach access token to request:', error)
  }

  return headers
}

// ============================================================
// AUTH
// ============================================================

// Function to check if email or username already exists
export async function checkEmailOrUsernameExists(email: string, username: string) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();

    console.log('Checking if email/username exists:', { email: normalizedEmail, username: normalizedUsername });

    // Check email in users table
    const { data: emailCheck, error: emailError } = await supabase
      .from('users')
      .select('email')
      .eq('email', normalizedEmail)
      .limit(1);

    if (emailError) {
      console.error('Error checking email:', emailError);
      throw emailError;
    }

    // Check username in users table
    const { data: usernameCheck, error: usernameError } = await supabase
      .from('users')
      .select('username')
      .eq('username', normalizedUsername)
      .limit(1);

    if (usernameError) {
      console.error('Error checking username:', usernameError);
      throw usernameError;
    }

    const emailExists = emailCheck && emailCheck.length > 0;
    const usernameExists = usernameCheck && usernameCheck.length > 0;

    console.log('Check results:', { emailExists, usernameExists });

    return {
      emailExists,
      usernameExists,
      isAvailable: !emailExists && !usernameExists
    };
  } catch (error) {
    console.error('Error in checkEmailOrUsernameExists:', error);
    throw error;
  }
}

export async function signUpUser(user: { name: string; email: string; password: string; username: string }) {
  try {
    // Normalize email to lowercase
    const normalizedEmail = user.email.toLowerCase().trim();
    const normalizedUsername = user.username.toLowerCase().trim();

    console.log('Attempting to sign up user:', {
      email: normalizedEmail,
      name: user.name,
      username: normalizedUsername
    });

    // Check if email or username already exists
    const existenceCheck = await checkEmailOrUsernameExists(normalizedEmail, normalizedUsername);

    if (!existenceCheck.isAvailable) {
      let errorMessage = '';

      if (existenceCheck.emailExists && existenceCheck.usernameExists) {
        errorMessage = 'Both email and username are already registered. Please use different credentials.';
      } else if (existenceCheck.emailExists) {
        errorMessage = 'This email has already been registered. Please use a different email address.';
      } else if (existenceCheck.usernameExists) {
        errorMessage = 'This username has already been taken. Please choose a different username.';
      }

      const availabilityError = new Error(errorMessage);
      availabilityError.name = 'EmailOrUsernameExistsError';
      throw availabilityError;
    }

    // Step 1: Create auth user
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin || 'https://www.jigri.in').replace(/\/$/, '');

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: user.password,
      options: {
        emailRedirectTo: `${appUrl}/sign-in`,
        data: {
          name: user.name,
          username: normalizedUsername,
        }
      }
    })

    if (error) {
      console.error('Supabase auth.signUp error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        code: error.code || 'No code'
      });
      throw error;
    }

    console.log('Auth signup successful:', data);

    // Ensure user profile is created
    if (data.user) {
      console.log('Ensuring user profile exists...');

      // Wait a moment for auth to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));

      const profile = await ensureUserProfile(data.user);
      if (!profile) {
        console.warn('Profile creation failed, but auth signup was successful');
      } else {
        console.log('Profile ensured successfully:', profile.username);
      }
    }

    return data
  } catch (error: any) {
    console.error('Error in signUpUser function:', error);
    throw error
  }
}

export async function signInUser(user: { email: string; password: string }) {
  try {
    // Normalize email to lowercase
    const normalizedEmail = user.email.toLowerCase().trim();

    console.log('Attempting to sign in user:', { email: normalizedEmail });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: user.password,
    })

    if (error) {
      console.error('Supabase auth.signInWithPassword error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        code: error.code || 'No code'
      });

      // Enhance error message for better user experience
      if (error.message.includes('Email not confirmed')) {
        const enhancedError = new Error('Email verification required. Please verify your email address first, then try logging in.');
        enhancedError.name = 'EmailNotConfirmedError';
        throw enhancedError;
      }

      if (error.message.includes('Invalid login credentials')) {
        const enhancedError = new Error('Invalid email or password. Please check your credentials and try again.');
        enhancedError.name = 'InvalidCredentialsError';
        throw enhancedError;
      }

      throw error;
    }

    // Check if user is deactivated by checking the database
    if (data.user) {
      console.log('Checking if user is deactivated...');

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_deactivated, is_active')
        .eq('id', data.user.id)
        .single();

      if (userError) {
        console.error('Error checking user status:', userError);
        // Don't block login if we can't check status, but log the error
      } else if (userData) {
        if (userData.is_deactivated === true) {
          console.log('User account is deactivated:', data.user.email);

          // Sign them out immediately
          await supabase.auth.signOut();

          const deactivatedError = new Error('Your account has been deactivated. If you believe this was done in error, please contact support at support@jigri.app for assistance.');
          deactivatedError.name = 'AccountDeactivatedError';
          throw deactivatedError;
        }

        // Set user as active since they just logged in successfully
        console.log('Setting user as active...');
        await supabase
          .from('users')
          .update({ is_active: true })
          .eq('id', data.user.id);
      }
    }

    console.log('Sign in successful:', { user: data.user?.email });
    return data;
  } catch (error: any) {
    console.error('Error in signInUser function:', error);
    throw error;
  }
}

export async function signOutUser() {
  try {
    // Get current user before signing out to update their active status
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Set user as inactive since they're logging out
      await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', user.id);
    }

    const { error } = await supabase.auth.signOut()
    if (error) throw error
  } catch (error) {
    console.error('Error signing out:', error)
    throw error
  }
}

// Function to update user activity status (heartbeat)
export async function updateUserActivity() {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from('users')
        .update({
          is_active: true,
          last_active: new Date().toISOString()
        })
        .eq('id', user.id);
    }
  } catch (error) {
    console.error('Error updating user activity:', error);
    // Don't throw error - this is a background operation
  }
}

// Function to set user as inactive when they go offline
export async function setUserInactive(userId?: string) {
  try {
    let targetUserId = userId;

    if (!targetUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      targetUserId = user?.id;
    }

    if (targetUserId) {
      await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', targetUserId);
    }
  } catch (error) {
    console.error('Error setting user inactive:', error);
  }
}

// Helper function to ensure user profile exists
async function ensureUserProfile(authUser: any): Promise<any> {
  try {
    // First try to get existing profile
    const { data: existingProfile, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (existingProfile && !fetchError) {
      return existingProfile;
    }

    // If profile doesn't exist, create it
    if (fetchError && (fetchError.code === 'PGRST116' || fetchError.message?.includes('0 rows'))) {
      console.log('Creating missing user profile for:', authUser.id);

      const userName = authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User';
      const username = authUser.user_metadata?.username || `user_${authUser.id.substring(0, 8)}`;

      const { data: newProfile, error: createError } = await supabase
        .from('users')
        .insert([
          {
            id: authUser.id,
            email: authUser.email,
            name: userName,
            username: username,
            image_url: null,
            bio: null,
            is_active: false,
            is_deactivated: false,
            last_active: null,
            privacy_setting: 'public'
          }
        ])
        .select()
        .single();

      if (createError) {
        console.error('Error creating user profile:', createError);
        return null;
      }

      console.log('User profile created successfully:', newProfile);
      return newProfile;
    }

    console.error('Unexpected error fetching profile:', fetchError);
    return null;
  } catch (error) {
    console.error('Error in ensureUserProfile:', error);
    return null;
  }
}

export async function getCurrentUser() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      // Only log auth errors if they're not just "missing session" errors
      if (!authError.message?.includes('session_missing') && !authError.message?.includes('Auth session missing')) {
        console.error('Auth error:', authError)
      }
      return null
    }

    if (!user) return null

    // Ensure user profile exists and return it
    const profile = await ensureUserProfile(user);
    return profile;
  } catch (error) {
    // Only log errors if they're not authentication-related
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (!errorMessage.includes('session_missing') && !errorMessage.includes('Auth session missing')) {
      console.error('Error getting current user:', error)
    }
    return null
  }
}

// ============================================================
// USER
// ============================================================

export async function getUsersByUsernames(usernames: string[]) {
  if (!usernames || usernames.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from('users')
      .select('username, is_verified, verification_badge_type, role')
      .in('username', usernames);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching users by usernames:', error);
    return []; // Return empty instead of throwing so it doesn't break rendering
  }
}

export async function getUserById(userId: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error getting user:', error)
    throw error
  }
}

// Public version for unauthenticated access (shared profiles) using API route
export async function getPublicUserById(userId: string) {
  console.log('ðŸ” getPublicUserById called with userId:', userId);

  try {
    // First try direct database access
    const { data, error } = await supabase
      .from('users')
      .select('id, name, username, email, image_url, bio, created_at')
      .eq('id', userId)
      .single()

    console.log('ðŸ“Š Direct database query result:', { data, error });

    if (error) {
      console.error('Direct user query failed:', error)
      // If RLS blocks this, try the API route
      if (error.code === 'PGRST116' || error.code === '42501' || error.message.includes('row-level security')) {
        console.log('âš ï¸ RLS blocking direct access, trying API route...')

        try {
          const response = await fetch(`/api/public/profile?userId=${userId}`)
          const apiData = await response.json()

          if (response.ok && apiData.user) {
            console.log('âœ… Got user data from API route:', apiData.user)
            return apiData.user
          } else {
            console.log('âŒ API route failed:', apiData)
          }
        } catch (apiError) {
          console.log('ðŸ’¥ API route error:', apiError)
        }
      }

      // For other errors, return fallback
      return {
        id: userId,
        name: 'User Profile',
        username: 'user_profile',
        email: '',
        image_url: null,
        bio: 'Profile information is currently unavailable',
        created_at: new Date().toISOString()
      }
    }

    console.log('âœ… Successfully fetched user data directly:', data)
    return data
  } catch (error) {
    console.error('ðŸ’¥ Exception in getPublicUserById:', error)
    // Return basic fallback info instead of null
    return {
      id: userId,
      name: 'User Profile',
      username: 'user_profile',
      email: '',
      image_url: null,
      bio: 'This profile is currently unavailable',
      created_at: new Date().toISOString()
    }
  }
}

// Public version for getting user posts (shared profiles) using API route fallback
export async function getPublicUserPosts(userId: string) {
  console.log('ðŸ” getPublicUserPosts called with userId:', userId);

  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        creator:users!posts_creator_id_fkey (
          id,
          name,
          username,
          role,
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

    console.log('ðŸ“Š Direct posts query result:', {
      dataLength: data?.length || 0,
      error,
      samplePost: data?.[0] ? {
        id: data[0].id,
        caption: data[0].caption?.substring(0, 50) + '...',
        creator: data[0].creator
      } : null
    });

    if (error) {
      console.error('Direct posts query failed:', error)
      // If RLS blocks this, try the API route
      if (error.code === 'PGRST116' || error.code === '42501' || error.message.includes('row-level security')) {
        console.log('âš ï¸ RLS blocking direct posts access, trying API route...')

        try {
          const response = await fetch(`/api/public/profile?userId=${userId}`)
          const apiData = await response.json()

          if (response.ok && apiData.posts) {
            console.log('âœ… Got posts data from API route:', apiData.posts.length, 'posts')
            return apiData.posts
          } else {
            console.log('âŒ API route failed for posts:', apiData)
          }
        } catch (apiError) {
          console.log('ðŸ’¥ API route error for posts:', apiError)
        }
      }

      return []
    }

    console.log('âœ… Successfully fetched', data?.length || 0, 'posts directly')
    return data || []
  } catch (error) {
    console.error('ðŸ’¥ Exception in getPublicUserPosts:', error)
    return []
  }
}

// Public version for getting followers count
export async function getPublicFollowersCount(userId: string) {
  try {
    const { count, error } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId)

    if (error) {
      console.error('Error getting public followers count:', error)
      return 0
    }
    return count || 0
  } catch (error) {
    console.error('Error getting public followers count:', error)
    return 0
  }
}

// Public version for getting following count
export async function getPublicFollowingCount(userId: string) {
  try {
    const { count, error } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId)

    if (error) {
      console.error('Error getting public following count:', error)
      return 0
    }
    return count || 0
  } catch (error) {
    console.error('Error getting public following count:', error)
    return 0
  }
}

// Public version for getting post details (shared posts)
export async function getPublicPostById(postId: string) {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        creator:users!posts_creator_id_fkey (
          id,
          name,
          username,
          role,
          image_url
        ),
        likes:likes!likes_post_id_fkey (
          user_id
        ),
        saves:saves!saves_post_id_fkey (
          user_id
        )
      `)
      .eq('id', postId)
      .single()

    if (error) {
      console.error('Error getting public post:', error)
      // If RLS blocks this, we might need to handle it differently
      if (error.code === 'PGRST116' || error.code === '42501') {
        console.log('Post access restricted for unauthenticated user')
      }
      return null
    }
    return data
  } catch (error) {
    console.error('Error getting public post:', error)
    return null
  }
}

export async function checkUsernameAvailability(username: string) {
  try {
    const normalizedUsername = username.toLowerCase().trim();
    const { data: usernameCheck, error: usernameError } = await supabase
      .from('users')
      .select('username')
      .eq('username', normalizedUsername)
      .limit(1);

    if (usernameError) throw usernameError;
    return usernameCheck && usernameCheck.length > 0 ? false : true;
  } catch (error) {
    console.error('Error checking username availability:', error);
    return false; // Default to false on error for safety
  }
}

export async function updateUsername(userId: string, newUsername: string) {
  try {
    const normalizedUsername = newUsername.toLowerCase().trim();

    // 1. Fetch user to check last changed date
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('username, username_last_changed, username_change_count')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    if (user.username.toLowerCase() === normalizedUsername) {
      return { success: true, message: "Username is already set to this" };
    }

    // 2. Check 30-day limit
    if (user.username_last_changed) {
      const lastChanged = new Date(user.username_last_changed);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (lastChanged > thirtyDaysAgo) {
        // Find exactly when they can change it again
        const nextAllowedDate = new Date(lastChanged);
        nextAllowedDate.setDate(nextAllowedDate.getDate() + 30);

        throw new Error(`You can change your username again on ${nextAllowedDate.toLocaleDateString()}`);
      }
    }

    // 3. Double-check availability
    const isAvailable = await checkUsernameAvailability(normalizedUsername);
    if (!isAvailable) {
      throw new Error("This username is already taken. Please choose another.");
    }

    // 4. Perform the massive update
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        username: normalizedUsername,
        username_last_changed: new Date().toISOString(),
        username_change_count: (user.username_change_count || 0) + 1
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) throw updateError;
    return { success: true, data: updatedUser };

  } catch (error: any) {
    console.error('Error updating username:', error);
    throw error;
  }
}

export async function updateUser(userId: string, userData: any) {
  try {
    let imageUrl = userData.imageUrl;

    // Handle file upload if there's a new file
    if (userData.file && userData.file.length > 0) {
      const file = userData.file[0];
      const fileExtension = file.name.split('.').pop();
      const fileName = `profile-${userId}-${Date.now()}.${fileExtension}`;

      try {
        // Try to upload file to Supabase storage (using posts bucket for now)
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Error uploading profile picture:', uploadError);
          // Continue without updating the image if upload fails
        } else {
          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('posts')
            .getPublicUrl(fileName);

          imageUrl = publicUrl;
        }
      } catch (error) {
        console.error('Storage upload failed, continuing without image update:', error);
      }
    }

    // Prepare user data for database update
    const userUpdateData: any = {
      name: userData.name,
      username: userData.username,
      email: userData.email,
      bio: userData.bio,
    };

    // Add privacy_setting if provided
    if (userData.privacy_setting !== undefined) {
      userUpdateData.privacy_setting = userData.privacy_setting;
    }

    // Only include image_url if we have one
    if (imageUrl) {
      userUpdateData.image_url = imageUrl;
    }

    const { data, error } = await supabase
      .from('users')
      .update(userUpdateData)
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating user:', error)
    throw error
  }
}

export async function getUsers(limit?: number) {
  try {
    let query = supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error getting users:', error)
    throw error
  }
}

export async function getSuggestedUsers(limit: number = 8) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    // Fallback for unauthenticated users: return recent/active users
    if (!user) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('is_active', { ascending: false })
        .order('last_active', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    }

    const [{ data: followsData }, { data: usersData, error: usersError }] = await Promise.all([
      supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id),
      supabase
        .from('users')
        .select('*')
        .neq('id', user.id)
        .order('is_active', { ascending: false })
        .order('last_active', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(150)
    ]);

    if (usersError) throw usersError;

    const followedIds = new Set((followsData || []).map((f: any) => f.following_id));
    const candidateUsers = (usersData || []).filter((u: any) => !followedIds.has(u.id));

    if (candidateUsers.length === 0) return [];

    const candidateIds = candidateUsers.map((u: any) => u.id);
    const recentWindow = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentPosts } = await supabase
      .from('posts')
      .select('creator_id, created_at')
      .in('creator_id', candidateIds)
      .gte('created_at', recentWindow)
      .limit(1000);

    const activityByUser = new Map<string, number>();
    (recentPosts || []).forEach((post: any) => {
      const prev = activityByUser.get(post.creator_id) || 0;
      activityByUser.set(post.creator_id, prev + 1);
    });

    const scored = candidateUsers
      .map((u: any) => {
        const lastActiveMs = u?.last_active ? new Date(u.last_active).getTime() : 0;
        const activeHoursAgo = lastActiveMs ? (Date.now() - lastActiveMs) / (1000 * 60 * 60) : 9999;
        const recencyScore = Math.max(0, 72 - activeHoursAgo) / 12; // 0..6
        const activeScore = u?.is_active ? 4 : 0;
        const postsScore = (activityByUser.get(u.id) || 0) * 1.5;
        return {
          ...u,
          _engagementScore: activeScore + postsScore + recencyScore,
        };
      })
      .sort((a: any, b: any) => b._engagementScore - a._engagementScore)
      .slice(0, limit);

    return scored;
  } catch (error) {
    console.error('Error getting suggested users:', error);
    return [];
  }
}

export async function searchUsers(searchTerm: string, limit: number = 50) {
  try {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return []
    }

    const trimmedSearch = searchTerm.trim()

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .or(`name.ilike.%${trimmedSearch}%,username.ilike.%${trimmedSearch}%`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error searching users:', error)
    return []
  }
}

// ============================================================
// ADMIN STATISTICS
// ============================================================

type AppRole = 'user' | 'moderator' | 'admin' | 'super_admin'

// Legacy export retained for compatibility. Super-admin is now role-based.
export async function isInitialAdmin(_userEmail?: string): Promise<boolean> {
  return false;
}

// Get all admin users from database
export async function getAdminUsers(): Promise<User[]> {
  try {
    // First check if current user has admin access
    const hasAccess = await checkAdminAccess();
    if (!hasAccess) {
      throw new Error('Access denied. Admin privileges required.');
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .or('role.eq.admin,role.eq.super_admin,is_admin.eq.true')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting admin users:', error);
    throw error;
  }
}

// Check if user has governance dashboard access (moderator/admin/super_admin)
export async function isUserAdmin(userEmail?: string): Promise<boolean> {
  if (!userEmail) {
    console.log('isUserAdmin: No email provided');
    return false;
  }

  console.log('isUserAdmin: Checking admin status for:', userEmail);

  // Check database for role/admin status
  try {
    console.log('isUserAdmin: Checking database for role/admin status');
    const { data, error } = await supabase
      .from('users')
      .select('role, is_admin')
      .eq('email', userEmail.toLowerCase())
      .single();

    if (error) {
      // Not found => definitely not admin
      if (error.code === 'PGRST116') {
        return false;
      }

      // Migration-safe fallback when role column is not yet applied in DB
      const isMissingRoleColumn =
        error.code === '42703' ||
        String((error as any)?.message || '').toLowerCase().includes('role')

      if (isMissingRoleColumn) {
        const { data: legacyData, error: legacyError } = await supabase
          .from('users')
          .select('is_admin')
          .eq('email', userEmail.toLowerCase())
          .single()

        if (legacyError) {
          if (legacyError.code !== 'PGRST116') {
            console.warn('isUserAdmin legacy fallback failed:', {
              code: legacyError.code,
              message: legacyError.message,
            })
          }
          return false
        }

        return legacyData?.is_admin === true
      }

      console.warn('isUserAdmin role check failed:', {
        code: error.code,
        message: (error as any)?.message,
      })
      return false;
    }

    const role = data?.role as AppRole | null | undefined
    const isAdmin = role === 'moderator' || role === 'admin' || role === 'super_admin' || data?.is_admin === true;
    return isAdmin;
  } catch (error) {
    console.warn('isUserAdmin unexpected error:', error instanceof Error ? error.message : error);
    return false;
  }
}

// Add a new admin user
export async function addAdminUser(email: string): Promise<boolean> {
  try {
    const response = await fetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.toLowerCase(), role: 'admin', reason: 'Grant admin access' }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to add admin user.')
    }

    return true;
  } catch (error) {
    console.error('Error adding admin user:', error);
    throw error;
  }
}

// Remove admin privileges from a user
export async function removeAdminUser(userId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/admin/roles/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', reason: 'Revoke admin access' }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to remove admin user.')
    }

    return true;
  } catch (error) {
    console.error('Error removing admin user:', error);
    throw error;
  }
}

export async function checkAdminAccess(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return false;
    }

    const isAdmin = await isUserAdmin(user.email);
    return isAdmin;
  } catch (error) {
    console.warn('checkAdminAccess failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

export async function getAdminStats() {
  try {
    const response = await fetch('/api/admin/stats')
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to fetch admin stats')
    }

    return payload
  } catch (error) {
    console.error('Error getting admin stats:', error)
    throw error
  }
}

// ============================================================
// POSTS
// ============================================================

export async function createPost(post: {
  caption: string
  file: File[]
  location?: string
  tags?: string
  userId: string
  category: 'general' | 'announcement' | 'question'
}) {
  try {
    console.log('Creating post with data:', post)
    console.log('User ID:', post.userId)
    console.log('User ID type:', typeof post.userId)

    let imageUrl = null

    // Upload file if provided - with better error handling
    if (post.file && post.file.length > 0) {
      console.log('Uploading file:', post.file[0])
      const firstFile = post.file[0]

      // Check file size (limit to 2MB for better performance)
      if (firstFile.size > 2 * 1024 * 1024) {
        throw new Error('File size too large. Please choose a file smaller than 2MB.')
      }

      const fileExt = firstFile.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      console.log('Starting upload to storage...')
      try {
        // Simple direct upload without timeout wrapper for testing
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, firstFile, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error('File upload error:', uploadError)
          throw new Error(`Upload failed: ${uploadError.message}`)
        }

        console.log('File uploaded successfully to:', fileName)

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('posts')
          .getPublicUrl(fileName)

        imageUrl = publicUrl
        console.log('Public URL generated:', imageUrl)
      } catch (uploadErr) {
        console.error('Upload process failed:', uploadErr)
        // Continue without image if upload fails
        console.log('Continuing post creation without image due to upload failure')
        imageUrl = null
      }
    }

    console.log('Creating post record in database...')

    // Convert tags string to array
    let tagsArray: string[] | null = null
    if (post.tags) {
      // Split tags by spaces or commas and normalize leading #
      tagsArray = post.tags
        .split(/[\s,]+/)
        .map((tag: string) => tag.trim().replace(/^#/, ''))
        .filter((tag: string) => tag.length > 0)
    }

    // Log the exact data being inserted
    const insertData = {
      caption: post.caption,
      image_url: imageUrl,
      location: post.location,
      tags: tagsArray,
      creator_id: post.userId,
      category: post.category,
    }
    console.log('Insert data:', insertData)

    // Create post record
    const { data, error } = await supabase
      .from('posts')
      .insert([insertData])
      .select(`
        *,
        creator:users(*),
        likes(user_id),
        saves(user_id)
      `)
      .single()

    if (error) {
      console.error('Database insert error:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      throw error
    }

    console.log('Post created successfully:', data)

    // Note: Notifications are now handled by the notification service in the React query mutations

    return data
  } catch (error) {
    console.error('Error creating post:', error)
    throw error
  }
}

export async function getRecentPosts() {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    // Get all posts without any filtering in the query
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        creator:users(*),
        likes(user_id),
        saves(user_id)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Client-side privacy filtering
    const filteredData = data?.filter(post => {
      const creator = post.creator;

      // If user is authenticated
      if (user) {
        // Always show own posts
        if (creator.id === user.id) return true;

        // Only show public posts from others (followers_only and private are hidden in explore/recent)
        return creator.privacy_setting === 'public';
      } else {
        // For unauthenticated users - only show public posts
        return creator.privacy_setting === 'public';
      }
    }) || [];

    // Add comment counts to posts
    if (filteredData.length > 0) {
      const postsWithCommentCounts = await Promise.all(
        filteredData.map(async (post) => {
          const { count } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id)

          return {
            ...post,
            _count: {
              comments: count || 0
            }
          }
        })
      )
      return postsWithCommentCounts
    }

    return filteredData
  } catch (error) {
    console.error('Error getting recent posts:', error)
    throw error
  }
}

export async function getPostById(postId: string) {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        creator:users(*),
        likes(user_id),
        saves(user_id)
      `)
      .eq('id', postId)
      .single()

    if (error) throw error

    // Add comment count to post
    if (data) {
      const { count } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', data.id)

      return {
        ...data,
        _count: {
          comments: count || 0
        }
      }
    }

    return data
  } catch (error) {
    console.error('Error getting post:', error)
    throw error
  }
}

export async function getUserPosts(userId: string) {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        creator:users(*),
        likes(user_id),
        saves(user_id)
      `)
      .eq('creator_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error getting user posts:', error)
    throw error
  }
}

// Get posts from followed users and own posts for the following feed
// Automatically updates when user follows/unfollows someone via React Query invalidation
// Respects user privacy settings
export async function getFollowingFeed(page: number = 1, limit: number = 20) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // First, get the list of followed user IDs
    const { data: followsData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    const followedUserIds = followsData?.map(follow => follow.following_id) || []

    // 1) Followed + own posts bucket
    let followedQuery = supabase
      .from('posts')
      .select(`
        *,
        creator:users(*),
        likes(user_id),
        saves(user_id)
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    if (followedUserIds.length > 0) {
      followedQuery = followedQuery.or(`creator_id.eq.${user.id},creator_id.in.(${followedUserIds.join(',')})`)
    } else {
      followedQuery = followedQuery.eq('creator_id', user.id)
    }

    const { data: followedData, error } = await followedQuery

    if (error) throw error

    // 2) Global recent public posts bucket (excluding followed + own)
    const excludedIds = [user.id, ...followedUserIds]
    const { data: globalRaw } = await supabase
      .from('posts')
      .select(`
        *,
        creator:users(*),
        likes(user_id),
        saves(user_id)
      `)
      .order('created_at', { ascending: false })
      .limit(250)

    const globalData = (globalRaw || []).filter((post: any) => {
      const creator = post.creator;
      if (!creator) return false;
      if (excludedIds.includes(creator.id)) return false;
      return creator.privacy_setting === 'public';
    });

    // Client-side privacy filtering for followed bucket
    const followedFiltered = (followedData || []).filter((post: any) => {
      const creator = post.creator;
      if (!creator) return false;

      // Always show own posts
      if (creator.id === user.id) return true;

      // For others' posts, check privacy settings
      if (creator.privacy_setting === 'private') return false;

      // For followers_only, check if current user follows the creator
      if (creator.privacy_setting === 'followers_only') {
        return followedUserIds.includes(creator.id);
      }

      // Public posts are always visible
      return true;
    }) || [];

    // Add comment counts for ranking + card stats in one pass
    const allCandidatePosts = [...followedFiltered, ...globalData];
    const uniquePostIds = Array.from(new Set(allCandidatePosts.map((p: any) => p.id)));

    let commentCountMap = new Map<string, number>();
    if (uniquePostIds.length > 0) {
      const { data: commentsData } = await supabase
        .from('comments')
        .select('post_id')
        .in('post_id', uniquePostIds)
        .limit(5000);

      commentCountMap = (commentsData || []).reduce((map: Map<string, number>, row: any) => {
        map.set(row.post_id, (map.get(row.post_id) || 0) + 1);
        return map;
      }, new Map<string, number>());
    }

    const withCommentsAndScore = (post: any) => {
      const likes = post.likes?.length || 0;
      const comments = commentCountMap.get(post.id) || 0;

      // Calculate how many hours old the post is
      const hoursAgo = Math.max(0, (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60));

      // Massive Recency Factor: Starts at 1000 points and decays over 48 hours.
      // This essentially guarantees any post made in the last few hours is at the top,
      // while older posts MUST have huge engagement to compete.
      const recencyFactor = Math.max(0, 48 - hoursAgo) * 20; // Max 960 points

      // 1 like = 1 point, 1 comment = 3 points
      const score = likes + (comments * 3) + recencyFactor;

      return {
        ...post,
        _count: { comments },
        _engagementScore: score
      };
    };

    // Sort by Engagement Score (which is heavily weighted towards Newness)
    const followedRanked = followedFiltered.map(withCommentsAndScore).sort((a: any, b: any) => b._engagementScore - a._engagementScore);
    const globalRanked = globalData.map(withCommentsAndScore).sort((a: any, b: any) => b._engagementScore - a._engagementScore);

    // Followed-first, with a controlled global mix so feed stays alive
    const followedTarget = Math.max(8, Math.floor(limit * 0.7));
    const mixedFirstPage = [
      ...followedRanked.slice(0, followedTarget),
      ...globalRanked.slice(0, Math.max(0, limit - followedTarget)),
      ...followedRanked.slice(followedTarget),
      ...globalRanked.slice(Math.max(0, limit - followedTarget)),
    ];

    // Deduplicate and ensure descending engagement score order globally
    const deduped = mixedFirstPage.filter((post: any, index: number, arr: any[]) =>
      arr.findIndex((p: any) => p.id === post.id) === index
    ).sort((a: any, b: any) => b._engagementScore - a._engagementScore);

    const offset = (page - 1) * limit;
    const paginatedData = deduped.slice(offset, offset + limit);

    return paginatedData
  } catch (error) {
    console.error('Error getting following feed:', error)
    throw error
  }
}

export async function updatePost(postId: string, post: {
  caption?: string
  file?: File[]
  location?: string
  tags?: string[]
  category?: string
}) {
  try {
    let imageUrl: string | undefined

    // Upload new file if provided
    if (post.file && post.file.length > 0) {
      const firstFile = post.file[0]
      const fileExt = firstFile.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(fileName, firstFile)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('posts')
        .getPublicUrl(fileName)

      imageUrl = publicUrl
    }

    // Update post record
    const updateData: any = {}
    if (post.caption !== undefined) updateData.caption = post.caption
    if (imageUrl !== undefined) updateData.image_url = imageUrl
    if (post.location !== undefined) updateData.location = post.location
    if (post.tags !== undefined) updateData.tags = post.tags
    if (post.category !== undefined) updateData.category = post.category

    const { data, error } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', postId)
      .select(`
        *,
        creator:users(*),
        likes(user_id),
        saves(user_id)
      `)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating post:', error)
    throw error
  }
}

export async function deletePost(postId: string) {
  try {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)

    if (error) throw error
  } catch (error) {
    console.error('Error deleting post:', error)
    throw error
  }
}

// ============================================================
// LIKES
// ============================================================

export async function likePost(postId: string, userId: string) {
  try {
    console.log('Liking post:', { postId, userId })

    const { data, error } = await supabase
      .from('likes')
      .insert([
        {
          post_id: postId,
          user_id: userId,
        }
      ])
      .select()

    if (error) {
      console.error('Like insertion error:', error)
      console.error('Like insertion error details:', JSON.stringify(error, null, 2))
      console.error('Error message:', error.message)
      console.error('Error code:', error.code)
      throw error
    }

    console.log('Like created successfully:', data)

    return data
  } catch (error) {
    console.error('Error liking post:', error)
    console.error('Error liking post details:', JSON.stringify(error, null, 2))
    if (error instanceof Error) {
      console.error('Error message:', error.message)
    }
    throw error
  }
}

export async function deleteLike(postId: string, userId: string) {
  try {
    console.log('Unliking post:', { postId, userId })

    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)

    if (error) {
      console.error('Unlike deletion error:', error)
      throw error
    }

    console.log('Like deleted successfully')
  } catch (error) {
    console.error('Error unliking post:', error)
    throw error
  }
}

// ============================================================
// SAVES
// ============================================================

export async function savePost(postId: string, userId: string) {
  try {
    console.log('Saving post:', { postId, userId })
    console.log('PostId type:', typeof postId, 'UserId type:', typeof userId)

    // Direct insert - let the database handle duplicates with a meaningful error
    const { data, error } = await supabase
      .from('saves')
      .insert([
        {
          post_id: postId,
          user_id: userId,
        }
      ])
      .select()

    if (error) {
      // Handle duplicate key error gracefully
      if (error.code === '23505') { // Unique constraint violation
        console.log('Post already saved by this user (duplicate key ignored)')
        // Query the existing save record
        const { data: existingSave } = await supabase
          .from('saves')
          .select()
          .eq('post_id', postId)
          .eq('user_id', userId)
          .single()
        return existingSave
      }

      console.error('Save insertion error:', error)
      console.error('Error message:', error.message)
      console.error('Error details:', error.details)
      console.error('Error hint:', error.hint)
      console.error('Error code:', error.code)
      throw error
    }

    console.log('Post saved successfully:', data)
    return data
  } catch (error) {
    console.error('Error saving post:', error)
    throw error
  }
}

export async function deleteSave(postId: string, userId: string) {
  try {
    console.log('Unsaving post:', { postId, userId })

    const { error } = await supabase
      .from('saves')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)

    if (error) {
      console.error('Unsave deletion error:', error)
      throw error
    }

    console.log('Post unsaved successfully')
  } catch (error) {
    console.error('Error unsaving post:', error)
    throw error
  }
}

export async function getSavedPosts(userId: string) {
  try {
    const { data, error } = await supabase
      .from('saves')
      .select(`
        *,
        posts:posts!inner(
          *,
          creator:users(*),
          likes(user_id),
          saves(user_id)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data?.map(save => save.posts) || []
  } catch (error) {
    console.error('Error getting saved posts:', error)
    throw error
  }
}

// Check if a post is saved by a specific user
export async function isPostSaved(postId: string, userId: string) {
  try {
    const { data, error } = await supabase
      .from('saves')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      throw error
    }

    return !!data // Returns true if found, false if not
  } catch (error) {
    console.error('Error checking if post is saved:', error)
    return false
  }
}

// ============================================================
// FILE UPLOAD
// ============================================================

export async function uploadFile(file: File, bucket: string) {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file)

    if (error) throw error

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName)

    return publicUrl
  } catch (error) {
    console.error('Error uploading file:', error)
    throw error
  }
}

export async function uploadVerificationDocument(file: File) {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/verification/document', {
      method: 'POST',
      body: formData,
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to upload verification document')
    }

    return payload
  } catch (error) {
    console.error('Error uploading verification document:', error)
    throw error
  }
}

export async function deleteFile(url: string, bucket: string) {
  try {
    // Extract filename from URL
    const fileName = url.split('/').pop()
    if (!fileName) throw new Error('Invalid file URL')

    const { error } = await supabase.storage
      .from(bucket)
      .remove([fileName])

    if (error) throw error
  } catch (error) {
    console.error('Error deleting file:', error)
    throw error
  }
}

// ============================================================
// SEARCH
// ============================================================

export async function searchPosts(searchTerm: string) {
  try {
    const normalized = searchTerm.trim().replace(/^#/, '')
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        creator:users(*),
        likes(user_id),
        saves(user_id)
      `)
      .or(`caption.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%,tags.cs.{${normalized}}`)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error searching posts:', error)
    throw error
  }
}

export async function getInfinitePosts({ pageParam }: { pageParam?: string }) {
  try {
    console.log('Fetching infinite posts with pageParam:', pageParam);

    const pageSize = 10 // Number of posts per page

    let query = supabase
      .from('posts')
      .select(`
        *,
        creator:users(*),
        likes(user_id),
        saves(user_id)
      `)
      .order('created_at', { ascending: false })
      .limit(pageSize)

    // If pageParam is provided, fetch posts created before that timestamp
    if (pageParam) {
      // Get the post with pageParam id to get its created_at timestamp
      const { data: paramPost, error: paramError } = await supabase
        .from('posts')
        .select('created_at')
        .eq('id', pageParam)
        .single()

      if (!paramError && paramPost) {
        query = query.lt('created_at', paramPost.created_at)
      } else {
        console.warn('Could not find post with pageParam:', pageParam, paramError);
      }
    }

    const { data, error } = await query

    if (error) {
      console.error('Supabase error in getInfinitePosts:', error);
      throw error;
    }

    // Return in the format expected by react-query infinite queries
    return {
      documents: data || [],
      hasMore: data && data.length === pageSize
    }
  } catch (error) {
    console.error('Error getting infinite posts:', error)
    throw error
  }
}

// ============================================================
// LIKES
// ============================================================

export async function getLikedPosts(userId: string) {
  try {
    if (!userId) throw new Error('User ID is required')

    const { data, error } = await supabase
      .from('likes')
      .select(`
        post:posts (
          *,
          creator:users (
            id,
            name,
            username,
            image_url
          ),
          likes (user_id),
          saves (user_id)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Transform the data to match our Post type structure
    const likedPosts = data?.map((item: any) => ({
      ...item.post,
      likes: item.post?.likes || [],
      saves: item.post?.saves || []
    })).filter((post: any) => post?.id) || []

    return likedPosts
  } catch (error) {
    console.error('Error getting liked posts:', error)
    throw error
  }
}

// ============================================================
// FOLLOW FUNCTIONALITY
// ============================================================

export async function followUser(followingId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    console.log('Attempting to follow user:', { follower_id: user.id, following_id: followingId })

    const { data, error } = await supabase
      .from('follows')
      .insert([
        {
          follower_id: user.id,
          following_id: followingId,
        }
      ])

    if (error) {
      console.error('Database error in followUser:', error)
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      throw error
    }

    console.log('Successfully followed user:', data)
    return data
  } catch (error) {
    console.error('Error following user:', error)
    throw error
  }
}

export async function unfollowUser(followingId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    console.log('Attempting to unfollow user:', { follower_id: user.id, following_id: followingId })

    const { data, error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', followingId)

    if (error) {
      console.error('Database error in unfollowUser:', error)
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      throw error
    }

    console.log('Successfully unfollowed user:', data)
    return data
  } catch (error) {
    console.error('Error unfollowing user:', error)
    throw error
  }
}

export async function getFollowersCount(userId: string) {
  try {
    const { count, error } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId)

    if (error) throw error
    return count || 0
  } catch (error) {
    console.error('Error getting followers count:', error)
    return 0
  }
}

export async function getFollowingCount(userId: string) {
  try {
    const { count, error } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId)

    if (error) throw error
    return count || 0
  } catch (error) {
    console.error('Error getting following count:', error)
    return 0
  }
}

export async function isFollowing(followingId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { data, error } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', followingId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return !!data
  } catch (error) {
    console.error('Error checking if following:', error)
    return false
  }
}

export async function getFollowers(userId: string) {
  try {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        follower:users!follows_follower_id_fkey (
          id,
          name,
          username,
          image_url
        )
      `)
      .eq('following_id', userId)

    if (error) throw error
    return data?.map(item => item.follower).filter(Boolean) || []
  } catch (error) {
    console.error('Error getting followers:', error)
    return []
  }
}

export async function getFollowing(userId: string) {
  try {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        following:users!follows_following_id_fkey (
          id,
          name,
          username,
          image_url
        )
      `)
      .eq('follower_id', userId)

    if (error) throw error
    return data?.map(item => item.following).filter(Boolean) || []
  } catch (error) {
    console.error('Error getting following:', error)
    return []
  }
}

// ============================================================
// COMMENTS
// ============================================================

export async function createComment(comment: {
  content: string
  postId: string
  userId: string
  parentId?: string
}): Promise<Comment | null> {
  try {
    const { data, error } = await supabase
      .from('comments')
      .insert([
        {
          content: comment.content,
          post_id: comment.postId,
          user_id: comment.userId,
          parent_id: comment.parentId || null,
        },
      ])
      .select(`
        *,
        user:users (
          id,
          name,
          username,
          role,
          image_url,
          is_verified,
          verification_badge_type,
          verification_status
        ),
        likes:comment_likes (
          user_id
        )
      `)
      .single()

    if (error) throw error
    return data as Comment
  } catch (error) {
    console.error('Error creating comment:', error)
    return null
  }
}

export function extractMentionUsernames(content: string): string[] {
  if (!content) return []
  const matches = content.match(/@[a-zA-Z0-9_.]+/g) || []
  return Array.from(new Set(matches.map((match) => match.slice(1).toLowerCase())))
}

export async function getPostComments(postId: string): Promise<Comment[]> {
  try {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        user:users (
          id,
          name,
          username,
          role,
          image_url,
          is_verified,
          verification_badge_type,
          verification_status
        ),
        likes:comment_likes (
          user_id
        )
      `)
      .eq('post_id', postId)
      .is('parent_id', null)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching comments:', error);
      throw error;
    }

    const commentsWithReplies = await Promise.all(
      (data || []).map(async (comment) => {
        const replies = await getCommentReplies(comment.id)
        return {
          ...comment,
          replies,
          _count: {
            likes: comment.likes?.length || 0,
            replies: replies.length,
          },
        } as Comment
      })
    )

    return commentsWithReplies
  } catch (error) {
    console.error('Error getting post comments:', error)
    return []
  }
}

export async function getCommentReplies(commentId: string): Promise<Comment[]> {
  try {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        user:users (
          id,
          name,
          username,
          role,
          image_url,
          is_verified,
          verification_badge_type,
          verification_status
        ),
        likes:comment_likes (
          user_id
        )
      `)
      .eq('parent_id', commentId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return (data || []).map(comment => ({
      ...comment,
      _count: {
        likes: comment.likes?.length || 0,
        replies: 0,
      },
    })) as Comment[]
  } catch (error) {
    console.error('Error getting comment replies:', error)
    return []
  }
}

export async function updateComment(commentId: string, content: string): Promise<Comment | null> {
  try {
    const { data, error } = await supabase
      .from('comments')
      .update({
        content,
        is_edited: true,
      })
      .eq('id', commentId)
      .select(`
        *,
        user:users (
          id,
          name,
          username,
          role,
          image_url,
          is_verified,
          verification_badge_type,
          verification_status
        ),
        likes:comment_likes (
          user_id
        )
      `)
      .single()

    if (error) throw error
    return data as Comment
  } catch (error) {
    console.error('Error updating comment:', error)
    return null
  }
}

export async function deleteComment(commentId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting comment:', error)
    return false
  }
}

export async function likeComment(commentId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('comment_likes')
      .insert([{ comment_id: commentId, user_id: userId }])

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error liking comment:', error)
    return false
  }
}

export async function unlikeComment(commentId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error unliking comment:', error)
    return false
  }
}

export async function getCommentLikeStatus(commentId: string, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return !!data
  } catch (error) {
    console.error('Error checking comment like status:', error)
    return false
  }
}

// ============ PASSWORD RESET FUNCTIONS ============

export async function sendPasswordResetEmail(email: string) {
  try {
    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin || 'https://www.jigri.in').replace(/\/$/, '');

    console.log('ðŸ”„ Starting password reset for email:', normalizedEmail);

    // First check if user exists
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', normalizedEmail)
      .single()

    console.log('ðŸ‘¤ User check result:', { userData, userError });

    if (userError || !userData) {
      console.log('âŒ User not found');
      throw new Error('No account found with this email address')
    }

    console.log('ðŸ“§ Sending reset email to:', normalizedEmail);
    // Send password reset email with link (this will use your email template)
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${appUrl}/reset-password`,
    });

    if (error) {
      console.log('âŒ Reset email error:', error);
      throw error;
    }

    console.log('âœ… Reset email sent successfully');
    return { success: true, message: 'Password reset email sent! Please check your inbox.' }
  } catch (error: any) {
    console.error('Error sending password reset email:', error)
    throw error
  }
}


export async function updateUserPassword(newPassword: string) {
  try {
    console.log('🔄 Starting password update with production-optimized approach...');
    console.log('🔄 Password length:', newPassword.length);
    console.log('🌐 Current origin:', window.location.origin);
    console.log('🌐 Environment:', process.env.NODE_ENV);

    // Create a completely fresh Supabase client instance
    console.log('🆕 Creating fresh Supabase client instance...');
    const freshClient = createClient();

    // For production/Vercel deployment, use optimized approach
    console.log('� Using production-optimized password update...');

    // Try to get and transfer session with shorter timeout for production
    console.log('🔄 Attempting session transfer...');
    try {
      // Shorter timeout for production environments
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('getSession timeout')), 2000)
      );

      const sessionResult = await Promise.race([sessionPromise, timeoutPromise]);
      const { data: { session } } = sessionResult as any;

      if (session) {
        console.log('✅ Got session, transferring to fresh client...');
        await freshClient.auth.setSession(session);
        console.log('✅ Session transferred successfully');
      } else {
        console.log('⚠️ No session found, proceeding without transfer');
      }
    } catch (sessionError) {
      const errorMsg = sessionError instanceof Error ? sessionError.message : 'Unknown error';
      console.log('⚠️ Session transfer failed, proceeding anyway:', errorMsg);
    }

    // Use the fresh client for password update with timeout protection
    console.log('📞 Calling updateUser on fresh client with timeout...');

    const updateResult = await Promise.race([
      freshClient.auth.updateUser({ password: newPassword }),
      new Promise((_, reject) =>
        setTimeout(() => {
          console.error('⏰ Fresh client updateUser timed out after 10 seconds');
          reject(new Error('Password update timed out. This may be a network or Supabase service issue.'));
        }, 10000)
      )
    ]);

    const { data, error } = updateResult as any;

    console.log('🔐 Fresh client update result:', {
      hasData: !!data,
      hasUser: !!data?.user,
      error: error?.message
    });

    if (error) {
      console.log('❌ Fresh client password update failed:', error.message);
      console.log('❌ Error details:', {
        status: error.status,
        code: error.code || 'no-code'
      });

      // If fresh client also fails, this might be a Supabase service issue
      if (error.message.includes('timeout') || error.message.includes('network')) {
        throw new Error('Unable to connect to authentication service. Please check your internet connection and try again.');
      }

      // Handle specific error types
      if (error.message.includes('session') || error.message.includes('unauthorized')) {
        throw new Error('Your session has expired. Please use a fresh password reset link.');
      }

      if (error.message.includes('weak_password')) {
        throw new Error('Password is too weak. Please use a stronger password.');
      }

      if (error.message.includes('same_password')) {
        throw new Error('New password must be different from your current password.');
      }

      throw error;
    }

    if (!data?.user) {
      throw new Error('Password update failed - no user data returned');
    }

    console.log('✅ Password updated successfully with fresh client for:', data.user.email);
    return { success: true, message: 'Password updated successfully!' }

  } catch (error: any) {
    console.error('🚨 Error in updateUserPassword:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 200) + '...'
    });
    throw error;
  }
}

// ============================================================
// ADMIN MANAGEMENT FUNCTIONS
// ============================================================

// Get all users for admin management
export async function getAdminAllUsers(page: number = 1, limit: number = 10, search: string = '') {
  try {
    const response = await fetch(
      `/api/admin/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
    )
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to fetch admin users')
    }

    return payload
  } catch (error) {
    console.error('Error getting all users for admin:', error);
    throw error;
  }
}

// Get user details for admin
export async function getAdminUserDetails(userId: string) {
  try {
    const response = await fetch(`/api/admin/users/${userId}`)
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to fetch user details')
    }

    return payload;
  } catch (error) {
    console.error('Error getting user details for admin:', error);
    throw error;
  }
}

// Toggle user activation status (admin only)
export async function toggleUserActivation(userId: string) {
  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Admin activation status toggle' }),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to toggle user activation')
    }

    return payload
  } catch (error) {
    console.error('Error toggling user activation:', error);
    throw error;
  }
}

export async function updateAdminUserProfile(
  userId: string,
  input: {
    name: string
    username: string
    bio?: string
    role: 'user' | 'moderator' | 'admin' | 'super_admin'
    reason?: string
  }
) {
  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_profile',
        ...input,
        reason: input.reason || 'Super admin profile update from admin panel',
      }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to update user profile')
    }

    return payload
  } catch (error) {
    console.error('Error updating admin user profile:', error)
    throw error
  }
}

export async function setAdminUserVerification(
  userId: string,
  input: {
    isVerified: boolean
    badgeType?: 'verified' | 'official'
    reason?: string
  }
) {
  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set_verification',
        ...input,
        reason: input.reason || 'Admin verification action from user management panel',
      }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to update verification badge')
    }

    return payload
  } catch (error) {
    console.error('Error setting admin user verification:', error)
    throw error
  }
}

export async function resetAdminUserPassword(
  userId: string,
  input: {
    newPassword: string
    reason?: string
  }
) {
  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reset_password',
        newPassword: input.newPassword,
        reason: input.reason || 'Super admin password reset from admin users panel',
      }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to reset user password')
    }

    return payload
  } catch (error) {
    console.error('Error resetting admin user password:', error)
    throw error
  }
}

export async function deleteAdminUserAccount(
  userId: string,
  reason: string = 'Super admin delete user from admin users panel'
) {
  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_user',
        reason,
      }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to delete user')
    }

    return payload
  } catch (error) {
    console.error('Error deleting admin user account:', error)
    throw error
  }
}

// Legacy function for backward compatibility - now uses toggleUserActivation
export async function deactivateUser(userId: string) {
  try {
    // Check current status first
    const { data: targetUser } = await supabase
      .from('users')
      .select('is_deactivated')
      .eq('id', userId)
      .single();

    if (!targetUser || targetUser.is_deactivated) {
      throw new Error('User not found or already deactivated');
    }

    return await toggleUserActivation(userId);
  } catch (error) {
    console.error('Error deactivating user:', error);
    throw error;
  }
}

// Get all posts for admin management
export async function getAdminAllPosts(page: number = 1, limit: number = 10, search: string = '') {
  try {
    const response = await fetch(
      `/api/admin/posts?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
    )
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to fetch admin posts')
    }

    return payload;
  } catch (error) {
    console.error('Error getting all posts for admin:', error);
    throw error;
  }
}

// Delete post (admin only)
export async function adminDeletePost(postId: string) {
  try {
    const response = await fetch(`/api/admin/posts/${postId}`, {
      method: 'DELETE',
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to delete post')
    }

    return { success: true, message: payload?.message || 'Post deleted successfully' };
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
}

// ============================================================
// MODERATION / GOVERNANCE
// ============================================================

export async function getAdminReports(page: number = 1, limit: number = 20, status: string = '') {
  try {
    const response = await fetch(
      `/api/admin/reports?page=${page}&limit=${limit}&status=${encodeURIComponent(status)}`
    )
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to fetch reports')
    }

    return payload
  } catch (error) {
    console.error('Error getting admin reports:', error)
    throw error
  }
}

export async function updateAdminReport(
  reportId: string,
  input: {
    status?: 'open' | 'triaged' | 'in_review' | 'resolved' | 'dismissed' | 'escalated'
    assignToSelf?: boolean
    reason: string
    resolutionNote?: string
  }
) {
  try {
    const response = await fetch(`/api/admin/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to update report')
    }

    return payload
  } catch (error) {
    console.error('Error updating admin report:', error)
    throw error
  }
}

export async function getGovernanceAuditLogs(page: number = 1, limit: number = 20) {
  try {
    const response = await fetch(`/api/admin/audit?page=${page}&limit=${limit}`)
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to fetch governance audit logs')
    }

    return payload
  } catch (error) {
    console.error('Error fetching governance audit logs:', error)
    throw error
  }
}

// ============================================================
// VERIFICATION / TRUST
// ============================================================

export async function getMyVerificationApplications() {
  try {
    const response = await fetch('/api/verification')
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to fetch verification applications')
    }

    return payload
  } catch (error) {
    console.error('Error fetching verification applications:', error)
    throw error
  }
}

export async function submitVerificationApplication(input: {
  applicationType: 'person' | 'creator' | 'organization'
  requestedBadgeType: 'verified' | 'official'
  evidencePayload?: Record<string, any>
}) {
  try {
    const response = await fetch('/api/verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to submit verification application')
    }

    return payload
  } catch (error) {
    console.error('Error submitting verification application:', error)
    throw error
  }
}

export async function updateMyVerificationApplication(
  applicationId: string,
  input: {
    action: 'withdraw' | 'resubmit'
    evidencePayload?: Record<string, any>
  }
) {
  try {
    const response = await fetch(`/api/verification/${applicationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to update verification application')
    }

    return payload
  } catch (error) {
    console.error('Error updating verification application:', error)
    throw error
  }
}

export async function getAdminVerificationApplications(
  page: number = 1,
  limit: number = 20,
  status: string = 'all',
  reviewer: string = 'all'
) {
  try {
    const response = await fetch(
      `/api/admin/verification?page=${page}&limit=${limit}&status=${encodeURIComponent(status)}&reviewer=${encodeURIComponent(reviewer)}`
    )
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to fetch admin verification queue')
    }

    return payload
  } catch (error) {
    console.error('Error fetching admin verification queue:', error)
    throw error
  }
}

export async function getAdminVerificationApplicationDetails(applicationId: string) {
  try {
    const response = await fetch(`/api/admin/verification/${applicationId}`)
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to fetch verification application details')
    }

    return payload
  } catch (error) {
    console.error('Error fetching verification application details:', error)
    throw error
  }
}

export async function updateAdminVerificationApplication(
  applicationId: string,
  input: {
    status: 'under_review' | 'approved' | 'rejected' | 'needs_resubmission' | 'revoked' | 'withdrawn'
    reason?: string
    reviewNotes?: string
    badgeType?: 'verified' | 'official'
    forceOverride?: boolean
  }
) {
  try {
    const response = await fetch(`/api/admin/verification/${applicationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to update verification application')
    }

    return payload
  } catch (error) {
    console.error('Error updating verification application:', error)
    throw error
  }
}

// ============================================================
// MESSAGING (DM)
// ============================================================

export async function getConversations() {
  try {
    const response = await fetch('/api/messages/conversations', {
      headers: await getAuthenticatedFetchHeaders(),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to fetch conversations')
    }

    return payload.conversations || []
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return []
  }
}

export async function getMessages(conversationId: string) {
  try {
    const response = await fetch(`/api/messages/${conversationId}`, {
      headers: await getAuthenticatedFetchHeaders(),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to fetch messages')
    }

    return payload.messages || []
  } catch (error) {
    console.error('Error fetching messages:', error)
    return []
  }
}

export async function sendMessage(conversationId: string, content: string) {
  try {
    const response = await fetch(`/api/messages/${conversationId}`, {
      method: 'POST',
      headers: await getAuthenticatedFetchHeaders(),
      body: JSON.stringify({ content }),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to send message')
    }

    return payload.message
  } catch (error) {
    console.error('Error sending message:', error)
    throw error
  }
}

export async function createConversation(otherUserId: string) {
  try {
    const response = await fetch('/api/messages/conversations', {
      method: 'POST',
      headers: await getAuthenticatedFetchHeaders(),
      body: JSON.stringify({ otherUserId }),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to create conversation')
    }

    return payload.conversation
  } catch (error) {
    console.error('Error creating conversation:', error)
    throw error
  }
}
























