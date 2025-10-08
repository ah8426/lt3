# Vercel Deployment Guide

Complete guide for deploying the Legal Transcript application to Vercel.

## 📋 Prerequisites

- [ ] Vercel account (https://vercel.com)
- [ ] GitHub repository connected to Vercel
- [ ] Supabase project set up
- [ ] All required environment variables ready

## 🚀 Quick Deploy

### Option 1: Deploy via Vercel Dashboard

1. **Import Project**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Select the repository root
   - Click "Import"

2. **Configure Project**
   - Framework Preset: **Next.js**
   - Root Directory: `./`
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
   - Install Command: `npm install` (default)

3. **Add Environment Variables**
   - See section below for complete list
   - Copy from `.env.vercel` file
   - Set scope to: **Production, Preview, Development**

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (~3-5 minutes)
   - Your app will be live at `https://your-app.vercel.app`

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Or deploy with environment variables
vercel --prod -e DATABASE_URL="postgresql://..." -e NEXT_PUBLIC_SUPABASE_URL="..."
```

## 🔐 Environment Variables Setup

### Required Variables (Must be set)

Go to **Vercel Dashboard** → **Your Project** → **Settings** → **Environment Variables**

Add the following variables:

#### Database
```
DATABASE_URL=postgresql://postgres.nmllrewdfkpuhchkeogh:HWvgzEJcyCsNbwl4@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

DIRECT_URL=postgresql://postgres.nmllrewdfkpuhchkeogh:HWvgzEJcyCsNbwl4@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

#### Supabase (Get from Supabase Dashboard → Settings → API)
```
NEXT_PUBLIC_SUPABASE_URL=https://nmllrewdfkpuhchkeogh.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE

SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE

NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=audio-files
```

#### Encryption & Security
```
ENCRYPTION_MASTER_KEY=43825f6bea5867cc08b9c4a7dc423d3d7b8d9e9809be81090d01d80fae6e11e5

BACKUP_ENCRYPTION_SECRET=e029a722786be62df067d60311bb1a6ce745090848c25328f421f19048d9c07b

CRON_SECRET=f072f487d5693c1701634c0f79c2de99679ac5ccb48dba1f30ca64d0b335fe4c
```

#### Application
```
NODE_ENV=production

NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Optional Variables (Enable features as needed)

#### AI Services
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
OPENROUTER_API_KEY=sk-or-...
```

### Environment Variable Scopes

For each variable, set the scope:

- ✅ **Production** - Live production environment
- ✅ **Preview** - Preview deployments (branches)
- ✅ **Development** - Local development via `vercel dev`

**Sensitive variables** (keys, secrets) should be:
- ✅ Production
- ❌ Preview (use test keys instead)
- ❌ Development (use local .env)

## 🔄 Cron Jobs Setup

The application uses Vercel Cron for automated backups.

### 1. Verify vercel.json

Ensure `vercel.json` exists in project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/backup",
      "schedule": "0 * * * *"
    }
  ]
}
```

### 2. Check Cron in Dashboard

After deployment:
1. Go to **Vercel Dashboard** → **Your Project** → **Settings** → **Cron Jobs**
2. Verify cron job appears: `/api/cron/backup` running every hour
3. Test cron job manually:

```bash
curl -X POST https://your-app.vercel.app/api/cron/backup \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 3. Monitor Cron Execution

- Go to **Logs** tab in Vercel Dashboard
- Filter by `/api/cron/backup`
- Check for successful executions every hour

## 🗄️ Database Migrations

### Run Migrations on First Deploy

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Or run migrations
npx prisma migrate deploy
```

### Automatic Migrations

Add to `package.json`:

```json
{
  "scripts": {
    "build": "prisma generate && next build",
    "postinstall": "prisma generate"
  }
}
```

This ensures Prisma client is generated on every deployment.

## 🪣 Supabase Storage Setup

### Create Storage Buckets

1. Go to **Supabase Dashboard** → **Storage**
2. Create buckets:
   - `audio-files` - For audio recordings
   - `backups` - For backup files

3. Set bucket policies:

**Audio Files Bucket:**
```sql
-- Users can upload to their own folder
CREATE POLICY "Users can upload audio files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'audio-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own files
CREATE POLICY "Users can view their audio files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'audio-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

**Backups Bucket:**
- Same policies as audio-files (already in migration 009_backups.sql)

## ✅ Post-Deployment Checklist

### 1. Test Core Functionality

- [ ] Visit your app URL: `https://your-app.vercel.app`
- [ ] Sign up / Login works
- [ ] Create a test matter
- [ ] Upload a test audio file
- [ ] Verify database connection
- [ ] Check Supabase storage upload works

### 2. Test Backup System

- [ ] Go to Settings → Backups
- [ ] Click "Create Backup Now"
- [ ] Verify backup appears in list
- [ ] Download backup file
- [ ] Test restore functionality

### 3. Test Cron Jobs

- [ ] Wait for next hour or trigger manually
- [ ] Check Vercel logs for cron execution
- [ ] Verify automatic backup created
- [ ] Check no errors in logs

### 4. Monitor Performance

- [ ] Check Vercel Analytics for Core Web Vitals
- [ ] Verify page load times < 3s
- [ ] Check function execution times
- [ ] Monitor database query performance

### 5. Security Check

- [ ] Verify RLS policies work (users can't access other users' data)
- [ ] Test authentication flow
- [ ] Check API endpoints are protected
- [ ] Verify secrets are not exposed in client code

## 🐛 Troubleshooting

### Build Fails

**Error:** `Prisma Client could not be generated`

**Solution:**
```bash
# Add postinstall script to package.json
"postinstall": "prisma generate"

# Or set in Vercel build settings:
# Build Command: prisma generate && next build
```

**Error:** `Module not found: Can't resolve '@prisma/client'`

**Solution:**
```bash
# Ensure @prisma/client is in dependencies, not devDependencies
npm install @prisma/client
```

### Database Connection Issues

**Error:** `Can't reach database server`

**Solution:**
1. Verify `DATABASE_URL` is correct in Vercel environment variables
2. Check Supabase project is not paused
3. Verify IP whitelist (Supabase allows all IPs by default)

**Error:** `Connection pool timeout`

**Solution:**
- Use connection pooling URL (port 6543)
- Set `connection_limit=1` in DATABASE_URL
- Check `serverExternalPackages` includes `@prisma/client` in next.config.ts

### Cron Jobs Not Running

**Error:** Cron job doesn't execute

**Solution:**
1. Verify `vercel.json` is in project root
2. Check `CRON_SECRET` is set in environment variables
3. Ensure route `/api/cron/backup` exists
4. Check Vercel logs for error messages

**Error:** `401 Unauthorized` in cron logs

**Solution:**
- Verify `CRON_SECRET` in environment variables matches
- Check `Authorization` header format in cron endpoint

### Storage Upload Fails

**Error:** `Failed to upload to Supabase Storage`

**Solution:**
1. Verify storage bucket exists
2. Check RLS policies are set correctly
3. Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
4. Check bucket is not set to private

## 📊 Monitoring & Analytics

### Vercel Analytics

1. Go to **Analytics** tab in Vercel Dashboard
2. Enable **Web Vitals** monitoring
3. Set up **Audience** insights
4. Monitor:
   - Page load times
   - Time to First Byte (TTFB)
   - Largest Contentful Paint (LCP)
   - First Input Delay (FID)
   - Cumulative Layout Shift (CLS)

### Vercel Logs

```bash
# Stream production logs
vercel logs --follow

# Filter by function
vercel logs --follow /api/cron/backup

# View specific deployment
vercel logs [deployment-url]
```

### Error Tracking (Optional)

Add Sentry for comprehensive error tracking:

```bash
npm install @sentry/nextjs

# Configure in next.config.js
```

## 🔄 Continuous Deployment

### Automatic Deployments

Vercel automatically deploys:
- **Production**: When you push to `main` branch
- **Preview**: When you create/update a pull request

### Manual Deployment

```bash
# Deploy current branch
vercel

# Deploy to production
vercel --prod

# Rollback to previous deployment
vercel rollback [deployment-url]
```

### Environment-Specific Branches

Create separate environments:

```
main → Production (https://your-app.vercel.app)
staging → Staging (https://your-app-staging.vercel.app)
develop → Development previews
```

Configure in **Vercel Dashboard** → **Settings** → **Git**

## 🎯 Performance Optimization

### Enable Edge Functions

For faster response times, convert API routes to Edge:

```typescript
// app/api/some-route/route.ts
export const runtime = 'edge'
```

### Enable ISR (Incremental Static Regeneration)

```typescript
// For pages that change infrequently
export const revalidate = 3600 // 1 hour
```

### Optimize Images

Use Next.js Image component:

```tsx
import Image from 'next/image'

<Image
  src="/image.jpg"
  width={800}
  height={600}
  alt="Description"
  priority // For above-the-fold images
/>
```

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma with Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
- [Supabase with Vercel](https://supabase.com/docs/guides/integrations/vercel)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)

## 🎉 Deployment Complete!

Once everything is verified:
1. Update `NEXT_PUBLIC_APP_URL` with your actual domain
2. Configure custom domain in Vercel (optional)
3. Enable HTTPS redirect
4. Set up monitoring and alerts
5. Share your app! 🚀
