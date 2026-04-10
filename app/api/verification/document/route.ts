import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const VERIFICATION_BUCKET = 'verification-documents'

async function ensureVerificationBucket(adminClient: ReturnType<typeof createAdminClient>) {
  const { data: buckets } = await adminClient.storage.listBuckets()
  const existing = buckets?.find((bucket) => bucket.name === VERIFICATION_BUCKET)

  if (!existing) {
    await adminClient.storage.createBucket(VERIFICATION_BUCKET, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
    })
    return
  }

  if (existing.public) {
    await adminClient.storage.updateBucket(VERIFICATION_BUCKET, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
    })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    await ensureVerificationBucket(adminClient)

    const fileExt = file.name.split('.').pop() || 'bin'
    const safeBaseName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .slice(0, 60)
    const filePath = `${user.id}/${Date.now()}-${safeBaseName}.${fileExt}`

    const { error } = await adminClient.storage
      .from(VERIFICATION_BUCKET)
      .upload(filePath, file, {
        cacheControl: '0',
        upsert: false,
        contentType: file.type || undefined,
      })

    if (error) {
      return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 })
    }

    return NextResponse.json({
      url: filePath,
      path: filePath,
      name: file.name,
      bucket: VERIFICATION_BUCKET,
      private: true,
    })
  } catch (error) {
    console.error('Verification document upload API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}