-- ==============================================================================
-- BLOCKDRIVE HEALTHCARE: SUPABASE RBAC & USER MANAGEMENT SCHEMA
-- ==============================================================================
-- Run this entire script in your Supabase Project -> SQL Editor
-- This sets up:
--   1. Public Profiles table linked to auth.users
--   2. Strict Healthcare Roles: 'admin', 'doctor', 'patient', 'medicalStaff'
--   3. Row Level Security (RLS) policies
--   4. Automatic Trigger to sync Auth Users into Public Profiles
--   5. Admin verification functions
-- ==============================================================================

-- 1. Create Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'doctor', 'patient', 'medicalStaff')),
    wallet_address TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for fast role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 2. Helper Function to Check if a User is Admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own basic profile" ON public.profiles;

-- Policy 1: Any authenticated user can read their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    auth.uid() = id
);

-- Policy 2: Admins can view ALL user profiles (for user management)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    public.is_admin(auth.uid())
);

-- Policy 3: Admins can insert profiles when creating doctor/patient/staff
CREATE POLICY "Admins can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin(auth.uid()) OR auth.uid() = id
);

-- Policy 4: Admins can update any user profile (change roles, info)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    public.is_admin(auth.uid())
)
WITH CHECK (
    public.is_admin(auth.uid())
);

-- Policy 5: Admins can delete profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
    public.is_admin(auth.uid())
);

-- Policy 6: Users can update their own wallet address or name (cannot change role)
CREATE POLICY "Users can update own basic profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    auth.uid() = id
)
WITH CHECK (
    auth.uid() = id
);

-- 4. Automatic Trigger: Handle new user sign-ups from Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role TEXT;
    user_name TEXT;
    creator_id UUID;
BEGIN
    -- Extract role from metadata (default to 'patient' if unspecified)
    assigned_role := COALESCE(NEW.raw_user_meta_data->>'role', 'patient');
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
    
    -- Extract creator id if created by an admin
    IF NEW.raw_user_meta_data->>'created_by' IS NOT NULL THEN
        creator_id := (NEW.raw_user_meta_data->>'created_by')::UUID;
    ELSE
        creator_id := NULL;
    END IF;

    -- Validate role value
    IF assigned_role NOT IN ('admin', 'doctor', 'patient', 'medicalStaff') THEN
        assigned_role := 'patient';
    END IF;

    -- Insert into public.profiles
    INSERT INTO public.profiles (id, email, full_name, role, created_by, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        user_name,
        assigned_role,
        creator_id,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- HOW TO DESIGNATE YOUR ADMIN GMAIL ACCOUNT MANUALLY:
-- Replace 'YOUR_ADMIN_EMAIL@gmail.com' with your actual Gmail address.
--
-- OPTION A: If the user is already created in Supabase Authentication:
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE email = 'YOUR_ADMIN_EMAIL@gmail.com';
--
-- OPTION B: Update auth.users metadata so role is always 'admin':
-- UPDATE auth.users
-- SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
-- WHERE email = 'YOUR_ADMIN_EMAIL@gmail.com';
-- ==============================================================================
