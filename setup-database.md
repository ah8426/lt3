# Supabase Database Connection Setup

Your Supabase project: **nmllrewdfkpuhchkeogh**

## Quick Setup

### Option 1: Find Your Database Password

1. Go to: https://supabase.com/dashboard/project/nmllrewdfkpuhchkeogh/settings/database
2. Look for **Database Password** or **Reset Database Password**
3. Copy your password
4. Use it in the connection strings below

### Option 2: Reset Your Password

If you don't remember your password:

1. Go to: https://supabase.com/dashboard/project/nmllrewdfkpuhchkeogh/settings/database
2. Scroll to **Database Password**
3. Click **Reset database password**
4. Copy the new password shown
5. **IMPORTANT**: Save it securely!

## Connection String Templates

Once you have your password, replace `[YOUR-PASSWORD]` below:

### For `.env.local`:

```env
# Pooled connection (for most operations)
DATABASE_URL="postgresql://postgres.nmllrewdfkpuhchkeogh:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Direct connection (for migrations)
DIRECT_URL="postgresql://postgres.nmllrewdfkpuhchkeogh:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
```

## Example (with fake password)

If your password was `MyP@ssw0rd123`, it would look like:

```env
DATABASE_URL="postgresql://postgres.nmllrewdfkpuhchkeogh:MyP@ssw0rd123@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

DIRECT_URL="postgresql://postgres.nmllrewdfkpuhchkeogh:MyP@ssw0rd123@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
```

## Special Characters in Password

If your password contains special characters like `@`, `#`, `$`, etc., you need to URL-encode them:

| Character | Encode as |
|-----------|-----------|
| `@` | `%40` |
| `#` | `%23` |
| `$` | `%24` |
| `%` | `%25` |
| `&` | `%26` |
| `+` | `%2B` |
| ` ` (space) | `%20` |
| `/` | `%2F` |
| `?` | `%3F` |
| `=` | `%3D` |

Example: If password is `My@Pass#123`, use `My%40Pass%23123`

## Test Connection

After updating `.env.local`, test with:

```bash
npx prisma db pull
```

If successful, you'll see:
```
✔ Introspected 1 model and wrote it into prisma/schema.prisma
```

## Troubleshooting

### Error: "P1001: Can't reach database server"
- Check your internet connection
- Verify the host URL is correct
- Make sure password is URL-encoded if it has special characters

### Error: "P1000: Authentication failed"
- Password is incorrect
- Try resetting your database password
- Check for extra spaces or quotes in the password

### Error: "Connection closed unexpectedly"
- Try the DIRECT_URL instead
- Check if your IP is allowed in Supabase (usually auto-allowed)

## Still Can't Find It?

Try this direct link to your database settings:
https://supabase.com/dashboard/project/nmllrewdfkpuhchkeogh/settings/database

Look for any of these sections:
- **Database Password**
- **Connection Pooling**
- **Connection String**
- **Connection Info**

## Need Help?

Share a screenshot of your Supabase Database Settings page (hide your password!) and I can help construct the exact URLs.
