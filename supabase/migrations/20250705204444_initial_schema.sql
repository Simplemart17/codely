-- Codely Database Schema Migration for Supabase
-- This migration creates all necessary tables for the collaborative coding platform

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types/enums
CREATE TYPE user_role AS ENUM ('INSTRUCTOR', 'LEARNER');
CREATE TYPE language AS ENUM ('JAVASCRIPT', 'PYTHON', 'CSHARP');
CREATE TYPE session_status AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');
CREATE TYPE operation_type AS ENUM ('INSERT', 'DELETE', 'RETAIN');
CREATE TYPE participant_role AS ENUM ('INSTRUCTOR', 'PARTICIPANT');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'LEARNER',
    avatar TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    language language NOT NULL,
    status session_status DEFAULT 'ACTIVE',
    max_participants INTEGER DEFAULT 10,
    is_public BOOLEAN DEFAULT FALSE,
    code TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session participants table
CREATE TABLE session_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role participant_role DEFAULT 'PARTICIPANT',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    cursor_position JSONB,
    UNIQUE(user_id, session_id)
);

-- Operations table for CRDT operations
CREATE TABLE operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type operation_type NOT NULL,
    position INTEGER NOT NULL,
    content TEXT,
    length INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    vector_clock JSONB NOT NULL
);

-- Session invitations table
CREATE TABLE session_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session recordings table
CREATE TABLE session_recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL, -- duration in seconds
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session snapshots table
CREATE TABLE session_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_sessions_instructor_id ON sessions(instructor_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_is_public ON sessions(is_public);
CREATE INDEX idx_session_participants_user_id ON session_participants(user_id);
CREATE INDEX idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX idx_session_participants_is_active ON session_participants(is_active);
CREATE INDEX idx_operations_session_id ON operations(session_id);
CREATE INDEX idx_operations_timestamp ON operations(timestamp);
CREATE INDEX idx_session_invitations_recipient_id ON session_invitations(recipient_id);
CREATE INDEX idx_session_invitations_status ON session_invitations(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_session_invitations_updated_at BEFORE UPDATE ON session_invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_session_recordings_updated_at BEFORE UPDATE ON session_recordings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_snapshots ENABLE ROW LEVEL SECURITY;
