# Database Quick Start Guide

## 🚀 3-Step Setup

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**

### Step 2: Run the Migration

Copy the entire contents of [supabase/migrations/001_initial_schema.sql](supabase/migrations/001_initial_schema.sql) and paste it into the SQL Editor, then click **Run**.

### Step 3: Verify Setup

Run this verification query:

```sql
-- Check all tables created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see:
- ✅ `encrypted_api_keys`
- ✅ `matters`
- ✅ `profiles`
- ✅ `segment_edit_history`
- ✅ `sessions`
- ✅ `transcription_segments`

## ✅ That's It!

Your database is now ready to use.

---

## 🔍 Verify Everything Works

### Test 1: Check RLS Policies

```sql
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';
```

Should return 21 policies.

### Test 2: Check Storage Bucket

```sql
SELECT * FROM storage.buckets WHERE id = 'audio-recordings';
```

Should return 1 row.

### Test 3: Check Indexes

```sql
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;
```

Should return multiple indexes for each table.

---

## 🆘 Troubleshooting

### Error: "permission denied for schema auth"

**This is expected!** The migration tries to set up triggers on `auth.users` which is managed by Supabase. The profile creation will still work via Supabase's built-in triggers.

### Error: "relation already exists"

**This is fine!** It means some tables already exist. The migration uses `CREATE TABLE IF NOT EXISTS` so it's safe to run multiple times.

### Storage policies not working

Run this separately:

```sql
CREATE POLICY "Users can upload own recordings" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own recordings" ON storage.objects FOR SELECT
  USING (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own recordings" ON storage.objects FOR UPDATE
  USING (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own recordings" ON storage.objects FOR DELETE
  USING (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 📝 Environment Variables

Make sure your `.env` file has:

```env
# Database (from Supabase Settings → Database → Connection String)
DATABASE_URL="postgresql://postgres.xxx:password@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxx:password@aws-1-us-east-2.pooler.supabase.com:5432/postgres"

# Supabase (from Supabase Settings → API)
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key-here"

# Encryption (generate with: node generate-key.js)
ENCRYPTION_MASTER_KEY="your-32-byte-hex-key-here"
```

---

## 🎯 Next Steps

After database setup:

1. **Generate encryption key:**
   ```bash
   node generate-key.js
   ```
   Copy the output to `.env` as `ENCRYPTION_MASTER_KEY`

2. **Start the dev server:**
   ```bash
   npm run dev
   ```

3. **Sign up/login:**
   - Go to http://localhost:3000/login
   - Sign up with Google or Microsoft
   - Profile will be auto-created

4. **Test the app:**
   - Go to Settings → API Keys
   - Add your ASR provider API keys
   - Go to Dictation and start recording!

---

## 📊 What Was Created

### Tables (6 core + metadata)
- `sessions` - Dictation sessions
- `transcription_segments` - Individual transcript segments
- `segment_edit_history` - Track transcript edits
- `matters` - Legal cases/matters
- `encrypted_api_keys` - Encrypted API keys for ASR providers
- `profiles` - User profile information

### Indexes (15+)
- Optimized for user queries
- Foreign key indexes
- Date/time indexes for sorting
- Composite indexes for complex queries

### RLS Policies (21)
- User-scoped data access
- Secure segment access via sessions
- Profile self-management
- API key protection

### Storage
- `audio-recordings` bucket
- User-scoped access policies
- Signed URL support

### Functions & Triggers
- Auto-update `updated_at` timestamps
- Auto-create profile on signup
- Cascade delete handling

---

## 💡 Pro Tips

1. **Use Supabase Table Editor** to view your data visually
2. **Enable real-time** on tables if you want live updates (Settings → Database → Replication)
3. **Check logs** in Supabase Dashboard → Logs if something fails
4. **Backup regularly** using Supabase's built-in backup system

---

## 🔗 Related Documentation

- [Complete Database Setup Guide](DATABASE_SETUP.md) - Detailed reference
- [ASR Implementation Guide](ASR_IMPLEMENTATION_GUIDE.md) - Transcription setup
- [Dictation Interface Guide](DICTATION_INTERFACE_GUIDE.md) - UI setup

---

**Ready to build!** 🚀
