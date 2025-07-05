-- Row Level Security Policies for Codely
-- These policies ensure users can only access data they're authorized to see

-- Users table policies
-- Users can read their own data and public profile info of others
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "Users can insert their own profile" ON users
    FOR INSERT WITH CHECK (auth.uid()::text = id::text);

-- Sessions table policies
-- Users can view sessions they created, participate in, or are public
CREATE POLICY "Users can view accessible sessions" ON sessions
    FOR SELECT USING (
        instructor_id::text = auth.uid()::text OR
        is_public = true OR
        EXISTS (
            SELECT 1 FROM session_participants 
            WHERE session_id = sessions.id 
            AND user_id::text = auth.uid()::text
        )
    );

-- Instructors can create sessions
CREATE POLICY "Instructors can create sessions" ON sessions
    FOR INSERT WITH CHECK (
        instructor_id::text = auth.uid()::text AND
        EXISTS (
            SELECT 1 FROM users 
            WHERE id::text = auth.uid()::text 
            AND role = 'INSTRUCTOR'
        )
    );

-- Instructors can update their own sessions
CREATE POLICY "Instructors can update their sessions" ON sessions
    FOR UPDATE USING (instructor_id::text = auth.uid()::text);

-- Session participants policies
-- Users can view participants of sessions they have access to
CREATE POLICY "Users can view session participants" ON session_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE id = session_id AND (
                instructor_id::text = auth.uid()::text OR
                is_public = true OR
                EXISTS (
                    SELECT 1 FROM session_participants sp2
                    WHERE sp2.session_id = sessions.id 
                    AND sp2.user_id::text = auth.uid()::text
                )
            )
        )
    );

-- Users can join sessions (insert their own participation)
CREATE POLICY "Users can join sessions" ON session_participants
    FOR INSERT WITH CHECK (
        user_id::text = auth.uid()::text AND
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE id = session_id AND (
                is_public = true OR
                instructor_id::text = auth.uid()::text OR
                EXISTS (
                    SELECT 1 FROM session_invitations 
                    WHERE session_id = sessions.id 
                    AND recipient_id::text = auth.uid()::text 
                    AND status = 'ACCEPTED'
                )
            )
        )
    );

-- Users can update their own participation
CREATE POLICY "Users can update their participation" ON session_participants
    FOR UPDATE USING (user_id::text = auth.uid()::text);

-- Instructors can manage participants in their sessions
CREATE POLICY "Instructors can manage session participants" ON session_participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE id = session_id 
            AND instructor_id::text = auth.uid()::text
        )
    );

-- Operations table policies
-- Users can view operations for sessions they participate in
CREATE POLICY "Users can view session operations" ON operations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE id = session_id AND (
                instructor_id::text = auth.uid()::text OR
                EXISTS (
                    SELECT 1 FROM session_participants 
                    WHERE session_id = sessions.id 
                    AND user_id::text = auth.uid()::text
                )
            )
        )
    );

-- Users can create operations in sessions they participate in
CREATE POLICY "Users can create operations" ON operations
    FOR INSERT WITH CHECK (
        user_id::text = auth.uid()::text AND
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE id = session_id AND (
                instructor_id::text = auth.uid()::text OR
                EXISTS (
                    SELECT 1 FROM session_participants 
                    WHERE session_id = sessions.id 
                    AND user_id::text = auth.uid()::text 
                    AND is_active = true
                )
            )
        )
    );

-- Session invitations policies
-- Users can view invitations sent to them
CREATE POLICY "Users can view their invitations" ON session_invitations
    FOR SELECT USING (recipient_id::text = auth.uid()::text);

-- Users can view invitations they sent
CREATE POLICY "Users can view sent invitations" ON session_invitations
    FOR SELECT USING (sender_id::text = auth.uid()::text);

-- Instructors can create invitations for their sessions
CREATE POLICY "Instructors can create invitations" ON session_invitations
    FOR INSERT WITH CHECK (
        sender_id::text = auth.uid()::text AND
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE id = session_id 
            AND instructor_id::text = auth.uid()::text
        )
    );

-- Users can update invitations sent to them (accept/decline)
CREATE POLICY "Users can respond to invitations" ON session_invitations
    FOR UPDATE USING (recipient_id::text = auth.uid()::text);

-- Session recordings policies
-- Users can view recordings of sessions they have access to
CREATE POLICY "Users can view accessible recordings" ON session_recordings
    FOR SELECT USING (
        is_public = true OR
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE id = session_id AND (
                instructor_id::text = auth.uid()::text OR
                EXISTS (
                    SELECT 1 FROM session_participants 
                    WHERE session_id = sessions.id 
                    AND user_id::text = auth.uid()::text
                )
            )
        )
    );

-- Instructors can create recordings for their sessions
CREATE POLICY "Instructors can create recordings" ON session_recordings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE id = session_id 
            AND instructor_id::text = auth.uid()::text
        )
    );

-- Instructors can update recordings for their sessions
CREATE POLICY "Instructors can update recordings" ON session_recordings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE id = session_id 
            AND instructor_id::text = auth.uid()::text
        )
    );

-- Session snapshots policies
-- Users can view snapshots of sessions they have access to
CREATE POLICY "Users can view accessible snapshots" ON session_snapshots
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE id = session_id AND (
                instructor_id::text = auth.uid()::text OR
                is_public = true OR
                EXISTS (
                    SELECT 1 FROM session_participants 
                    WHERE session_id = sessions.id 
                    AND user_id::text = auth.uid()::text
                )
            )
        )
    );

-- Users can create snapshots for sessions they participate in
CREATE POLICY "Users can create snapshots" ON session_snapshots
    FOR INSERT WITH CHECK (
        created_by::text = auth.uid()::text AND
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE id = session_id AND (
                instructor_id::text = auth.uid()::text OR
                EXISTS (
                    SELECT 1 FROM session_participants 
                    WHERE session_id = sessions.id 
                    AND user_id::text = auth.uid()::text 
                    AND is_active = true
                )
            )
        )
    );
