import { supabase } from '@/integrations/supabase/client';
import { TEMPLATES } from '@/lib/prompts';

export interface UserTemplate {
  id: string;
  name: string;
  systemPrompt: string;
  isDefault: boolean;
  updatedAt: string;
}

const toTemplate = (row: any): UserTemplate => ({
  id: row.id,
  name: row.name,
  systemPrompt: row.system_prompt || '',
  isDefault: !!row.is_default,
  updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
});

const getUserId = async (): Promise<string | null> => {
  const { data: auth } = await supabase.auth.getUser();
  return auth.user?.id || null;
};

export async function listUserTemplates(): Promise<UserTemplate[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('note_templates')
    .select('id, name, system_prompt, is_default, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(toTemplate);
}

export async function bootstrapUserTemplates(): Promise<UserTemplate[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const existing = await listUserTemplates();
  if (existing.length > 0) return existing;

  const rows = Object.entries(TEMPLATES).map(([name, systemPrompt]) => ({
    user_id: userId,
    name,
    system_prompt: systemPrompt,
    is_default: true,
  }));

  const { error } = await supabase.from('note_templates').insert(rows);
  if (error) throw error;

  return listUserTemplates();
}

export async function createTemplate(name: string, systemPrompt: string): Promise<UserTemplate> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('note_templates')
    .insert({
      user_id: userId,
      name,
      system_prompt: systemPrompt,
      is_default: false,
    })
    .select('id, name, system_prompt, is_default, created_at, updated_at')
    .single();

  if (error || !data) throw error || new Error('Template creation failed');
  return toTemplate(data);
}

export async function updateTemplate(
  templateId: string,
  patch: { name?: string; systemPrompt?: string; isDefault?: boolean }
): Promise<UserTemplate> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not signed in');

  const payload: Record<string, unknown> = {};
  if (typeof patch.name === 'string') payload.name = patch.name;
  if (typeof patch.systemPrompt === 'string') payload.system_prompt = patch.systemPrompt;
  if (typeof patch.isDefault === 'boolean') payload.is_default = patch.isDefault;

  const { data, error } = await supabase
    .from('note_templates')
    .update(payload)
    .eq('id', templateId)
    .eq('user_id', userId)
    .select('id, name, system_prompt, is_default, created_at, updated_at')
    .single();

  if (error || !data) throw error || new Error('Template update failed');
  return toTemplate(data);
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not signed in');

  const { error } = await supabase
    .from('note_templates')
    .delete()
    .eq('id', templateId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function getTemplatePrompt(templateName: string, fallbackPrompt: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return fallbackPrompt;

  const { data, error } = await supabase
    .from('note_templates')
    .select('system_prompt')
    .eq('user_id', user.id)
    .eq('name', templateName)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error || !data?.length) return fallbackPrompt;
  const prompt = data[0]?.system_prompt?.trim();
  return prompt || fallbackPrompt;
}
