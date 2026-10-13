-- Enable RLS on ALL IntentLead tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_context_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- workspaces: owner can CRUD own workspace
CREATE POLICY "workspace_owner_crud" ON workspaces
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- workspace_members: members can read their workspace memberships
CREATE POLICY "workspace_members_read" ON workspace_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Helper function to get user's workspace IDs
CREATE OR REPLACE FUNCTION get_user_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM workspaces WHERE owner_id = auth.uid()
  UNION
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid();
$$;

-- campaigns: users can CRUD campaigns in their workspaces
CREATE POLICY "campaigns_workspace_crud" ON campaigns
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT get_user_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids()));

-- signals: users can CRUD signals for their campaigns
CREATE POLICY "signals_workspace_crud" ON signals
  FOR ALL TO authenticated
  USING (campaign_id IN (
    SELECT id FROM campaigns WHERE workspace_id IN (SELECT get_user_workspace_ids())
  ))
  WITH CHECK (campaign_id IN (
    SELECT id FROM campaigns WHERE workspace_id IN (SELECT get_user_workspace_ids())
  ));

-- leads: users can read leads for their campaigns
CREATE POLICY "leads_workspace_read" ON leads
  FOR SELECT TO authenticated
  USING (campaign_id IN (
    SELECT id FROM campaigns WHERE workspace_id IN (SELECT get_user_workspace_ids())
  ));

-- messages: users can read messages for their leads
CREATE POLICY "messages_workspace_read" ON messages
  FOR SELECT TO authenticated
  USING (lead_id IN (
    SELECT l.id FROM leads l
    JOIN campaigns c ON c.id = l.campaign_id
    WHERE c.workspace_id IN (SELECT get_user_workspace_ids())
  ));

-- client_context_chunks: users can CRUD their own chunks
CREATE POLICY "chunks_workspace_crud" ON client_context_chunks
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT get_user_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids()));

-- conversations: users can CRUD their workspace conversations
CREATE POLICY "conversations_workspace_crud" ON conversations
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT get_user_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids()));

-- conversation_messages: users can CRUD messages in their conversations
CREATE POLICY "conv_messages_workspace_crud" ON conversation_messages
  FOR ALL TO authenticated
  USING (conversation_id IN (
    SELECT id FROM conversations WHERE workspace_id IN (SELECT get_user_workspace_ids())
  ));
