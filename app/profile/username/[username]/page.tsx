import { notFound, redirect } from 'next/navigation'

import { createAdminClient } from '@/lib/supabase/admin'

type ProfileByUsernamePageProps = {
  params: Promise<{ username: string }>
}

export default async function ProfileByUsernamePage({ params }: ProfileByUsernamePageProps) {
  const { username } = await params

  const adminClient = createAdminClient()
  const { data: user } = await adminClient
    .from('users')
    .select('id')
    .ilike('username', username)
    .maybeSingle()

  if (!user?.id) {
    notFound()
  }

  redirect(`/profile/${user.id}`)
}