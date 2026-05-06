
-- Enable RLS on realtime.messages (Supabase Realtime broadcast/presence)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

-- Allow only authenticated users to participate in any realtime channel.
-- The actual data filtering still happens via per-table RLS (e.g. messages, quotes, notifications).
DROP POLICY IF EXISTS "Authenticated users can use realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can use realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);
