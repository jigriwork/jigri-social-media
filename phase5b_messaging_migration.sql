-- ============================================================
-- Phase 5B: Messaging (DM) Schema Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Conversations table (1-to-1 only)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  participant_one UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_two UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_conversation UNIQUE (participant_one, participant_two),
  CONSTRAINT no_self_chat CHECK (participant_one <> participant_two)
);

-- 2. Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 5000),
  read BOOLEAN NOT NULL DEFAULT false
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_participant_one ON conversations(participant_one);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_two ON conversations(participant_two);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- 4. RLS Policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Conversations: users can only see their own conversations
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = participant_one OR auth.uid() = participant_two);

CREATE POLICY "Users can create conversations they are part of"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = participant_one OR auth.uid() = participant_two);

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = participant_one OR auth.uid() = participant_two);

-- Messages: users can only see messages in their conversations
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.participant_one = auth.uid() OR conversations.participant_two = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.participant_one = auth.uid() OR conversations.participant_two = auth.uid())
    )
  );

CREATE POLICY "Users can update read status of messages sent to them"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.participant_one = auth.uid() OR conversations.participant_two = auth.uid())
    )
  );

-- 5. Function to update conversation's last_message_at on new message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at, updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- 6. Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
