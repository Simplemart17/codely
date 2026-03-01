-- ============================================
-- Initial schema for Address Book application
-- ============================================

-- Create contact_users table
CREATE TABLE contact_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID NOT NULL UNIQUE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    password TEXT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    status BOOLEAN DEFAULT TRUE,
    user_type TEXT DEFAULT 'user'
);

-- Create contacts table
CREATE TABLE contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    url TEXT,
    user_id UUID NOT NULL
);

-- Create admin_users table (seeded separately from regular users)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX contact_users_user_id_idx ON contact_users(user_id);
CREATE INDEX contacts_user_id_idx ON contacts(user_id);

-- Enable Row Level Security
ALTER TABLE contact_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Helper: check if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS policies for admin_users
CREATE POLICY "Admins can read their own record" ON admin_users
    FOR SELECT USING (auth.uid() = id);

-- RLS policies for contact_users: admins get full access, regular users see their own row
CREATE POLICY "Users can read their own record" ON contact_users
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all users" ON contact_users
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all users" ON contact_users
    FOR UPDATE USING (public.is_admin());

CREATE POLICY "Users can update their own record" ON contact_users
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete all users" ON contact_users
    FOR DELETE USING (public.is_admin());

CREATE POLICY "Service role can insert users" ON contact_users
    FOR INSERT WITH CHECK (true);

-- RLS policies: users can only access their own contacts
CREATE POLICY "Users can only see their own contacts" ON contacts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own contacts" ON contacts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own contacts" ON contacts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own contacts" ON contacts
    FOR DELETE USING (auth.uid() = user_id);

-- Storage: create public bucket for contact images
INSERT INTO storage.buckets (id, name, public)
VALUES ('contact-images', 'contact-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload their own images" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'contact-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Public read access for contact images" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'contact-images');

CREATE POLICY "Users can delete their own images" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'contact-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
