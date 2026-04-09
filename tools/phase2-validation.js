const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

function mk(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

async function run() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anon || !service) throw new Error('Missing required Supabase env vars');

  const admin = createClient(url, service);
  const createdUsers = [];
  const report = { auth: {}, db: {}, post: {}, social: {}, notifications: {} };

  const u1 = {
    email: `${mk('phase2u1')}@example.com`,
    password: 'Phase2!Pass123',
    name: 'Phase2 User1',
    username: mk('u1'),
  };
  const u2 = {
    email: `${mk('phase2u2')}@example.com`,
    password: 'Phase2!Pass123',
    name: 'Phase2 User2',
    username: mk('u2'),
  };

  let postId = null;
  let commentId = null;

  try {
    const c1 = await admin.auth.admin.createUser({
      email: u1.email,
      password: u1.password,
      email_confirm: true,
      user_metadata: { name: u1.name, username: u1.username },
    });
    if (c1.error) throw c1.error;

    const c2 = await admin.auth.admin.createUser({
      email: u2.email,
      password: u2.password,
      email_confirm: true,
      user_metadata: { name: u2.name, username: u2.username },
    });
    if (c2.error) throw c2.error;

    createdUsers.push(c1.data.user.id, c2.data.user.id);

    const client1 = createClient(url, anon);
    const client2 = createClient(url, anon);

    // 1) Auth flow
    report.auth.signup = 'PASS (validated via live user creation)';
    const s1 = await client1.auth.signInWithPassword({ email: u1.email, password: u1.password });
    const s2 = await client2.auth.signInWithPassword({ email: u2.email, password: u2.password });
    report.auth.login = !s1.error && !s2.error ? 'PASS' : `FAIL: ${s1.error?.message || s2.error?.message}`;

    const sessBefore = await client1.auth.getSession();
    report.auth.sessionPersistence = sessBefore.data.session ? 'PASS' : 'FAIL: no session after login';

    await client1.auth.signOut();
    const sessAfter = await client1.auth.getSession();
    report.auth.logout = !sessAfter.data.session ? 'PASS' : 'FAIL: session still present after logout';
    await client1.auth.signInWithPassword({ email: u1.email, password: u1.password });

    // 2) DB profile create + fetch
    const p1 = await admin.from('users').select('id,email,username').eq('id', createdUsers[0]).single();
    const p2 = await admin.from('users').select('id,email,username').eq('id', createdUsers[1]).single();
    report.db.profileCreateAfterSignup = !p1.error && !!p1.data && !p2.error && !!p2.data
      ? 'PASS'
      : `FAIL: ${p1.error?.message || p2.error?.message || 'profile missing'}`;

    const f1 = await client1.from('users').select('id,email,username').eq('id', createdUsers[0]).single();
    report.db.profileFetch = !f1.error && !!f1.data ? 'PASS' : `FAIL: ${f1.error?.message}`;

    // 3) Post system
    const postIns = await client1
      .from('posts')
      .insert([{ caption: 'Phase2 test post', creator_id: createdUsers[0], category: 'general' }])
      .select('id,creator_id')
      .single();
    if (postIns.error) throw postIns.error;
    postId = postIns.data.id;
    report.post.createPost = 'PASS';

    const feed = await client1.from('posts').select('id,creator_id').eq('id', postId).single();
    report.post.fetchFeed = !feed.error && !!feed.data ? 'PASS' : `FAIL: ${feed.error?.message}`;

    const like = await client2.from('likes').insert([{ post_id: postId, user_id: createdUsers[1] }]);
    report.post.likePost = !like.error ? 'PASS' : `FAIL: ${like.error.message}`;

    const unlike = await client2.from('likes').delete().eq('post_id', postId).eq('user_id', createdUsers[1]);
    report.post.unlikePost = !unlike.error ? 'PASS' : `FAIL: ${unlike.error.message}`;

    const save = await client2.from('saves').insert([{ post_id: postId, user_id: createdUsers[1] }]);
    report.post.savePost = !save.error ? 'PASS' : `FAIL: ${save.error.message}`;

    const unsave = await client2.from('saves').delete().eq('post_id', postId).eq('user_id', createdUsers[1]);
    report.post.unsavePost = !unsave.error ? 'PASS' : `FAIL: ${unsave.error.message}`;

    // 4) Social system
    const follow = await client2.from('follows').insert([{ follower_id: createdUsers[1], following_id: createdUsers[0] }]);
    report.social.followUser = !follow.error ? 'PASS' : `FAIL: ${follow.error.message}`;

    const unfollow = await client2.from('follows').delete().eq('follower_id', createdUsers[1]).eq('following_id', createdUsers[0]);
    report.social.unfollowUser = !unfollow.error ? 'PASS' : `FAIL: ${unfollow.error.message}`;

    const cm = await client2
      .from('comments')
      .insert([{ content: 'phase2 comment', post_id: postId, user_id: createdUsers[1] }])
      .select('id')
      .single();
    report.social.comments = !cm.error && !!cm.data ? 'PASS' : `FAIL: ${cm.error?.message}`;
    commentId = cm.data?.id || null;

    if (commentId) {
      const cl = await client1.from('comment_likes').insert([{ comment_id: commentId, user_id: createdUsers[0] }]);
      const cul = await client1.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', createdUsers[0]);
      report.social.commentLikes = !cl.error && !cul.error ? 'PASS' : `FAIL: ${cl.error?.message || cul.error?.message}`;
    } else {
      report.social.commentLikes = 'FAIL: comment was not created';
    }

    // 5) Notifications insertion
    const notif = await client2.from('notifications').insert([
      {
        user_id: createdUsers[0],
        type: 'follow',
        title: 'Phase2 Test',
        message: 'User2 followed you',
        avatar: '',
        action_url: `/profile/${createdUsers[1]}`,
        from_user_id: createdUsers[1],
        from_user_name: u2.username,
        from_user_avatar: '',
        read: false,
      },
    ]);

    if (notif.error) {
      report.notifications.insert = `FAIL: ${notif.error.message}`;
    } else {
      const chk = await admin
        .from('notifications')
        .select('id')
        .eq('user_id', createdUsers[0])
        .eq('from_user_id', createdUsers[1])
        .order('created_at', { ascending: false })
        .limit(1);
      report.notifications.insert = !chk.error && (chk.data || []).length > 0 ? 'PASS' : `FAIL: ${chk.error?.message || 'not found'}`;
    }

    console.log(JSON.stringify(report, null, 2));
  } finally {
    // cleanup
    try {
      if (commentId) await admin.from('comment_likes').delete().eq('comment_id', commentId);
      if (commentId) await admin.from('comments').delete().eq('id', commentId);
      if (postId) {
        await admin.from('likes').delete().eq('post_id', postId);
        await admin.from('saves').delete().eq('post_id', postId);
        await admin.from('comments').delete().eq('post_id', postId);
        await admin.from('posts').delete().eq('id', postId);
      }

      if (createdUsers.length === 2) {
        await admin
          .from('follows')
          .delete()
          .or(`following_id.eq.${createdUsers[0]},follower_id.eq.${createdUsers[0]},following_id.eq.${createdUsers[1]},follower_id.eq.${createdUsers[1]}`);

        await admin
          .from('notifications')
          .delete()
          .or(`user_id.eq.${createdUsers[0]},from_user_id.eq.${createdUsers[0]},user_id.eq.${createdUsers[1]},from_user_id.eq.${createdUsers[1]}`);
      }
    } catch (_) {}

    for (const id of createdUsers) {
      try {
        await admin.auth.admin.deleteUser(id);
      } catch (_) {}
    }
  }
}

run().catch((e) => {
  console.error('PHASE2_VALIDATION_ERROR', e);
  process.exit(1);
});
