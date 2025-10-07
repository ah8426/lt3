# Supabase Integration

This directory contains the Supabase integration for Law Transcribed, including authentication, storage, and database access.

## Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy the project URL and anon key

### 2. Environment Variables

Add to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=audio-files
```

### 3. Configure OAuth Providers

#### Google OAuth

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable Google provider
3. Add Google OAuth credentials from Google Cloud Console
4. Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`

#### Microsoft OAuth (Azure AD)

1. Enable Azure provider in Supabase
2. Add Microsoft/Azure AD credentials
3. Add redirect URI: `https://your-project.supabase.co/auth/v1/callback`

### 4. Create Storage Bucket

```sql
-- Run in Supabase SQL Editor
insert into storage.buckets (id, name, public)
values ('audio-files', 'audio-files', false);

-- Set up storage policies
create policy "Authenticated users can upload audio files"
on storage.objects for insert
to authenticated
with check (bucket_id = 'audio-files');

create policy "Users can access their own audio files"
on storage.objects for select
to authenticated
using (bucket_id = 'audio-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own audio files"
on storage.objects for delete
to authenticated
using (bucket_id = 'audio-files' and auth.uid()::text = (storage.foldername(name))[1]);
```

## Files Overview

### Client-side (`client.ts`)
- Browser Supabase client
- Used in Client Components and client-side code

```typescript
import { createBrowserClient } from '@/lib/supabase'

const supabase = createBrowserClient()
```

### Server-side (`server.ts`)
- Server Supabase client with cookie handling
- Used in Server Components, Server Actions, and Route Handlers
- Supports Next.js 15 async cookies()

```typescript
import { createServerClient } from '@/lib/supabase'

const supabase = await createServerClient()
```

### Service Client (`server.ts`)
- Admin client with service role key
- For operations that bypass RLS
- Use with caution!

```typescript
import { createServiceClient } from '@/lib/supabase'

const supabase = await createServiceClient()
```

### Middleware (`middleware.ts`)
- Handles authentication state
- Refreshes user sessions
- Protects routes automatically

### Auth Utilities (`auth.ts`)

```typescript
// Client-side
import { signInWithOAuth, signOut } from '@/lib/supabase'

// Sign in with Google
await signInWithOAuth('google')

// Sign in with Microsoft
await signInWithOAuth('azure')

// Sign out
await signOut()

// Server-side
import { getUser, requireAuth, isAuthenticated } from '@/lib/supabase'

// Get current user (returns null if not authenticated)
const user = await getUser()

// Require authentication (throws if not authenticated)
const user = await requireAuth()

// Check if authenticated
const authenticated = await isAuthenticated()
```

### Storage Utilities (`storage.ts`)

```typescript
import {
  uploadAudioFile,
  getAudioFileUrl,
  getSignedAudioUrl,
  deleteAudioFile,
} from '@/lib/supabase'

// Upload audio file
const { path } = await uploadAudioFile(file, 'user-id/session-id/audio.wav')

// Get public URL
const url = await getAudioFileUrl(path)

// Get signed URL (expires in 1 hour)
const signedUrl = await getSignedAudioUrl(path, 3600)

// Delete file
await deleteAudioFile(path)
```

## Usage Examples

### Server Component

```typescript
// app/(app)/dashboard/page.tsx
import { createServerClient, getUser } from '@/lib/supabase'

export default async function DashboardPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const supabase = await createServerClient()
  const { data: matters } = await supabase
    .from('matters')
    .select('*')
    .eq('user_id', user.id)

  return <div>...</div>
}
```

### Client Component

```typescript
'use client'

import { createBrowserClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export default function UserProfile() {
  const [user, setUser] = useState(null)
  const supabase = createBrowserClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }

    getUser()
  }, [])

  return <div>{user?.email}</div>
}
```

### Server Action

```typescript
'use server'

import { createServerClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/supabase'

export async function createMatter(formData: FormData) {
  const user = await requireAuth()
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('matters')
    .insert({
      name: formData.get('name'),
      user_id: user.id,
    })
    .select()
    .single()

  if (error) throw error

  return data
}
```

### Route Handler

```typescript
// app/api/session/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET() {
  const supabase = await createServerClient()

  const { data: { session } } = await supabase.auth.getSession()

  return NextResponse.json({ session })
}
```

## Protected Routes

The middleware automatically protects these routes:
- `/dashboard`
- `/dictation`
- `/matters`
- `/sessions`
- `/settings`

Unauthenticated users are redirected to `/login`.

## Important Notes

### Next.js 15 Compatibility
- Uses `@supabase/ssr` 0.1.0 for Next.js 15 support
- Properly handles async `cookies()` from `next/headers`
- Compatible with Server Components and Server Actions

### Cookie Handling
- The middleware refreshes sessions automatically
- Cookies are properly synced between server and client
- Session state is maintained across requests

### Security
- Service role key should only be used server-side
- Never expose service role key to the client
- Use Row Level Security (RLS) policies in Supabase
- Storage policies enforce user-level access control

## Troubleshooting

### "Cookies can only be modified in a Server Action or Route Handler"
- Make sure you're using `await createServerClient()` in Server Components
- The middleware handles session refresh automatically

### OAuth redirect issues
- Verify redirect URLs in OAuth provider settings
- Check that `NEXT_PUBLIC_SUPABASE_URL` is correct
- Ensure callback route exists: `/auth/callback`

### Storage upload fails
- Check storage policies are set correctly
- Verify bucket exists and is configured
- Ensure user is authenticated
