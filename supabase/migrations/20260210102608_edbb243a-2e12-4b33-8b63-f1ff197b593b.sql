-- Block direct client access to chat_gesprekken
-- All access should go through the ellen-chat edge function (service_role)
CREATE POLICY "Block anon access"
  ON chat_gesprekken
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false);

CREATE POLICY "Block authenticated access"
  ON chat_gesprekken
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (false);