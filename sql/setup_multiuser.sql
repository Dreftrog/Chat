-- =============================================
-- Multi-User Private Chat - Database Setup
-- Execute this in Supabase SQL Editor
-- =============================================

-- 1. Add more users (password: 123456 for all)
INSERT INTO users (username, password_hash) VALUES 
('Usuario2', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'),
('Usuario3', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92')
ON CONFLICT (username) DO NOTHING;

-- 2. Add receiver_id column to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS receiver_id UUID;

-- 3. Create index for faster conversation queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation 
ON messages(sender_id, receiver_id);

-- 4. Verify users
SELECT id, username FROM users;
