# Supabase OAuth Setup Guide

This guide will walk you through setting up OAuth authentication with Google and Microsoft in Supabase.

## Prerequisites

- A Supabase project (create one at https://supabase.com)
- Google Cloud Console access (for Google OAuth)
- Azure Portal access (for Microsoft OAuth)

## 1. Database Setup

First, create the required database tables and enable Row Level Security (RLS).

### Create Profiles Table

Run this SQL in your Supabase SQL Editor:

```sql
-- Create profiles table
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table profiles enable row level security;

-- Create policies
create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Create function to handle profile updates
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger for new user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## 2. Google OAuth Setup

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Web application**
6. Configure:
   - **Name**: Your app name
   - **Authorized JavaScript origins**:
     - `https://<your-project-ref>.supabase.co`
     - `http://localhost:3000` (for local development)
   - **Authorized redirect URIs**:
     - `https://<your-project-ref>.supabase.co/auth/v1/callback`
     - `http://localhost:3000/auth/callback` (for local development)
7. Click **Create**
8. Copy the **Client ID** and **Client Secret**

### Step 2: Configure Google OAuth in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Google** and enable it
4. Enter your **Client ID** and **Client Secret**
5. Click **Save**

## 3. Microsoft OAuth Setup

### Step 1: Register Application in Azure

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: Your app name
   - **Supported account types**: Choose based on your needs
     - **Single tenant**: Only your organization
     - **Multitenant**: Any organization
     - **Personal**: Personal Microsoft accounts
   - **Redirect URI**:
     - Platform: **Web**
     - URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
5. Click **Register**

### Step 2: Create Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Add a description and select expiration
4. Click **Add**
5. **Important**: Copy the secret value immediately (you won't see it again)

### Step 3: Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Add these permissions:
   - `openid`
   - `profile`
   - `email`
6. Click **Add permissions**
7. (Optional) Click **Grant admin consent** if required

### Step 4: Get Application Details

1. Go to **Overview**
2. Copy these values:
   - **Application (client) ID**
   - **Directory (tenant) ID**

### Step 5: Configure Microsoft OAuth in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Azure** and enable it
4. Enter:
   - **Azure Client ID**: Application (client) ID
   - **Azure Secret**: Client secret value from Step 2
   - **Azure Tenant ID**: Directory (tenant) ID (or use `common` for multi-tenant)
5. Click **Save**

## 4. Environment Variables

Add these to your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

Find these in your Supabase Dashboard under **Project Settings** → **API**.

## 5. Configure Redirect URLs

In your Supabase Dashboard:

1. Go to **Authentication** → **URL Configuration**
2. Add your site URLs:
   - **Site URL**: `http://localhost:3000` (development) or your production URL
   - **Redirect URLs**: Add these:
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/**` (wildcard for development)
     - `https://yourdomain.com/auth/callback` (production)
     - `https://yourdomain.com/**` (production wildcard)

## 6. Test the Setup

### Local Testing

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000/login`

3. Test Google OAuth:
   - Click "Continue with Google"
   - Authorize the application
   - Should redirect to `/dashboard`

4. Test Microsoft OAuth:
   - Click "Continue with Microsoft"
   - Authorize the application
   - Should redirect to `/dashboard`

### Verify User Creation

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. You should see the authenticated user
3. Go to **Table Editor** → **profiles**
4. Verify the profile was created with correct data

## 7. Production Deployment

Before deploying to production:

1. **Update OAuth Redirect URIs** in both Google and Microsoft to include your production domain
2. **Update Supabase Redirect URLs** to include your production domain
3. **Update environment variables** in your production environment
4. **Test thoroughly** with both providers

## Troubleshooting

### Common Issues

**Error: "redirect_uri_mismatch"**
- Ensure the redirect URI in your OAuth provider matches exactly what's configured in Supabase
- Check for trailing slashes and http vs https

**Error: "Invalid client credentials"**
- Verify your Client ID and Secret are correct
- For Microsoft, ensure you copied the secret value (not the ID)

**User created but no profile**
- Check if the `handle_new_user()` trigger is working
- Manually insert a profile if needed
- Check Supabase logs for errors

**Session not persisting**
- Verify middleware is configured correctly
- Check browser cookies are enabled
- Ensure environment variables are set correctly

**Microsoft OAuth fails**
- Verify tenant ID is correct (use `common` for multi-tenant)
- Check API permissions are granted
- Ensure client secret hasn't expired

### Debug Steps

1. Check Supabase logs: **Project Settings** → **Logs** → **Auth logs**
2. Check browser console for errors
3. Verify network requests in browser DevTools
4. Test with incognito/private browsing to rule out cache issues

## Security Considerations

1. **Never commit secrets** to version control
2. **Use environment variables** for all sensitive data
3. **Enable RLS** on all tables
4. **Regularly rotate** client secrets
5. **Monitor auth logs** for suspicious activity
6. **Set appropriate token expiration** times
7. **Use HTTPS** in production

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Microsoft Identity Platform](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
