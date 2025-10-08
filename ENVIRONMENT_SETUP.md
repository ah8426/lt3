# Environment Variables Setup Guide

This guide explains how to configure all environment variables for the Legal Transcript application.

## 🚀 Quick Start

### 1. Copy Example File

```bash
cp .env.example .env
```

### 2. Generate Required Secrets

```bash
# Generate BACKUP_ENCRYPTION_SECRET
node -e "console.log('BACKUP_ENCRYPTION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate CRON_SECRET
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Configure Database (Supabase)

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Database**
3. Copy the connection strings:
   - **Connection pooling** → Use for `DATABASE_URL`
   - **Direct connection** → Use for `DIRECT_URL`

Example:
```bash
DATABASE_URL="postgresql://postgres.xxx:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.xxx:password@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
```

## 📋 Required Environment Variables

These variables are **required** for the application to function:

### Database Connection

```bash
# Pooled connection for application queries
DATABASE_URL="postgresql://..."

# Direct connection for running migrations
DIRECT_URL="postgresql://..."
```

### Backup System

```bash
# 64-character hex string for encrypting backups
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
BACKUP_ENCRYPTION_SECRET="e029a722786be62df067d60311bb1a6ce745090848c25328f421f19048d9c07b"
```

**Important:** Keep this secret secure. If lost, encrypted backups cannot be restored.

### Cron Job Security

```bash
# 64-character hex string for authenticating cron jobs
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CRON_SECRET="f072f487d5693c1701634c0f79c2de99679ac5ccb48dba1f30ca64d0b335fe4c"
```

**Usage:** Vercel Cron will use this to authenticate backup job requests.

## 🔧 Optional Environment Variables

### Supabase Configuration

```bash
# Your Supabase project URL
NEXT_PUBLIC_SUPABASE_URL="https://nmllrewdfkpuhchkeogh.supabase.co"

# Public anonymous key (safe to expose to client)
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."

# Service role key (server-side only, never expose to client)
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

**Where to find:**
- Go to Supabase dashboard → **Settings** → **API**
- Copy Project URL and API keys

### AI Services

```bash
# OpenAI for transcription and AI chat
OPENAI_API_KEY="sk-..."

# Anthropic Claude for advanced AI features
ANTHROPIC_API_KEY="sk-ant-..."
```

**Where to get:**
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/

### Authentication (OAuth)

```bash
# Google OAuth
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."

# Microsoft OAuth
MICROSOFT_CLIENT_ID="xxx"
MICROSOFT_CLIENT_SECRET="xxx"
```

**Setup guides:**
- Google: https://supabase.com/docs/guides/auth/social-login/auth-google
- Microsoft: https://supabase.com/docs/guides/auth/social-login/auth-microsoft

### Payments (Stripe)

```bash
# Stripe API keys
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

**Where to find:**
- Stripe Dashboard → **Developers** → **API keys**
- Webhook secret: **Developers** → **Webhooks**

### Email Service

```bash
# SendGrid
SENDGRID_API_KEY="SG.xxx"

# Or SMTP
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="your-user"
SMTP_PASSWORD="your-password"
```

### Cloud Storage (Alternative to Supabase Storage)

```bash
# AWS S3 for backups
AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
AWS_REGION="us-east-1"
AWS_S3_BACKUP_BUCKET="my-app-backups"
```

### Monitoring & Analytics

```bash
# Sentry for error tracking
SENTRY_DSN="https://xxx@xxx.ingest.sentry.io/xxx"

# Google Analytics
NEXT_PUBLIC_GA_TRACKING_ID="G-XXXXXXXXXX"
```

### Application Configuration

```bash
# Environment
NODE_ENV="production"  # or "development"

# App URL (for callbacks, webhooks)
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

## 🔐 Security Best Practices

### 1. Never Commit .env to Git

The `.env` file is already in `.gitignore`. Double-check:

```bash
# Verify .env is ignored
git check-ignore .env
# Should output: .env
```

### 2. Use Different Secrets for Each Environment

- **Development:** Use test/development keys
- **Staging:** Use separate staging keys
- **Production:** Use production keys with strict access control

### 3. Rotate Secrets Regularly

Especially:
- `BACKUP_ENCRYPTION_SECRET` (requires re-encrypting existing backups)
- `CRON_SECRET` (update Vercel environment variables)
- API keys after suspected leaks

### 4. Limit Access

- Only give team members access to secrets they need
- Use secret management tools (e.g., 1Password, AWS Secrets Manager)
- Never share secrets via email or Slack

## 📦 Deployment Setup

### Vercel

1. Go to your Vercel project
2. Navigate to **Settings** → **Environment Variables**
3. Add all required variables:

```bash
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
BACKUP_ENCRYPTION_SECRET=xxx
CRON_SECRET=xxx
```

4. Set environment scope:
   - Production: Production environment
   - Preview: Preview deployments
   - Development: Local development

5. For cron jobs, Vercel will automatically use `CRON_SECRET` to authenticate requests to `/api/cron/*` endpoints.

### Other Platforms

#### Railway

```bash
railway variables set BACKUP_ENCRYPTION_SECRET=xxx
railway variables set CRON_SECRET=xxx
# ... etc
```

#### Heroku

```bash
heroku config:set BACKUP_ENCRYPTION_SECRET=xxx
heroku config:set CRON_SECRET=xxx
# ... etc
```

#### Docker

Create a `.env` file and use it with Docker:

```bash
docker run --env-file .env your-image
```

Or use Docker secrets:

```bash
echo "xxx" | docker secret create backup_secret -
```

## 🧪 Testing Environment Variables

### Local Development

1. Create `.env.local` for local overrides:

```bash
# .env.local (not committed to git)
DATABASE_URL="postgresql://localhost:5432/mydb"
BACKUP_ENCRYPTION_SECRET="test-secret-for-local-dev"
```

2. Test environment variables are loaded:

```bash
# In Node.js
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"
```

### Verify Backup Encryption

```bash
# Test encryption secret is working
curl -X POST http://localhost:3000/api/backups \
  -H "Content-Type: application/json" \
  -d '{"scope":"full","encrypt":true}'
```

Should return backup details without errors.

### Verify Cron Secret

```bash
# Test cron endpoint (should fail without secret)
curl -X POST http://localhost:3000/api/cron/backup
# Should return: 401 Unauthorized

# Test with secret
curl -X POST http://localhost:3000/api/cron/backup \
  -H "Authorization: Bearer your-cron-secret"
# Should return: 200 with backup results
```

## 🐛 Troubleshooting

### "DATABASE_URL is not defined"

**Solution:** Make sure `.env` file exists and is in the project root.

```bash
# Check if .env exists
ls -la .env

# Check if DATABASE_URL is set
grep DATABASE_URL .env
```

### "BACKUP_ENCRYPTION_SECRET is not defined"

**Solution:** Add the variable to `.env`:

```bash
echo 'BACKUP_ENCRYPTION_SECRET="'$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")'"' >> .env
```

### "Unauthorized" when accessing cron endpoint

**Solution:** Make sure `CRON_SECRET` matches in both:
1. Local `.env` or Vercel environment variables
2. The `Authorization: Bearer` header in requests

### Supabase connection errors

**Solution:**

1. Verify connection strings are correct
2. Check if IP is whitelisted (Supabase → Settings → Database → Connection pooling)
3. Test connection:

```bash
psql "postgresql://user:pass@host:5432/postgres"
```

### Backup encryption fails

**Solution:**

1. Verify `BACKUP_ENCRYPTION_SECRET` is 64 characters (32 bytes hex)
2. Check secret is consistent across all environments
3. Regenerate secret if corrupted

## 📚 Additional Resources

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Prisma Environment Variables](https://www.prisma.io/docs/guides/development-environment/environment-variables)

## 🔄 Environment Variable Checklist

Use this checklist when setting up a new environment:

- [ ] Copy `.env.example` to `.env`
- [ ] Generate `BACKUP_ENCRYPTION_SECRET`
- [ ] Generate `CRON_SECRET`
- [ ] Configure `DATABASE_URL`
- [ ] Configure `DIRECT_URL`
- [ ] Add Supabase URL and keys (optional)
- [ ] Add AI service keys (optional)
- [ ] Configure OAuth providers (optional)
- [ ] Add Stripe keys (optional)
- [ ] Set up email service (optional)
- [ ] Configure monitoring (optional)
- [ ] Test all endpoints work
- [ ] Document any additional secrets in team wiki
- [ ] Store secrets in password manager
- [ ] Update deployment platform environment variables
- [ ] Verify cron jobs work in production
