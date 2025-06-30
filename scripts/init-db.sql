-- Initial database setup for Codely platform
-- This script runs when the PostgreSQL container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create initial tables (will be replaced by Prisma migrations later)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('instructor', 'learner')),
    avatar TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructor_id UUID NOT NULL REFERENCES users(id),
    language VARCHAR(50) NOT NULL CHECK (language IN ('javascript', 'python', 'csharp')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'paused', 'ended')),
    max_participants INTEGER DEFAULT 10,
    is_public BOOLEAN DEFAULT false,
    code TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    session_id UUID NOT NULL REFERENCES sessions(id),
    role VARCHAR(50) NOT NULL CHECK (role IN ('instructor', 'learner', 'observer')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    cursor_position JSONB,
    UNIQUE(user_id, session_id)
);

-- Create indexes for better performance
CREATE INDEX idx_sessions_instructor_id ON sessions(instructor_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX idx_session_participants_user_id ON session_participants(user_id);

-- Insert sample data for development
INSERT INTO users (email, name, role) VALUES 
    ('instructor@codely.dev', 'John Instructor', 'instructor'),
    ('learner@codely.dev', 'Jane Learner', 'learner')
ON CONFLICT (email) DO NOTHING;
