import { supabase } from '@/integrations/supabase/client';
import { TEMPLATES } from '@/lib/prompts';

export interface UserTemplate {
  id: string;
  name: string;
  systemPrompt: string;
  isDefault: boolean;
  updatedAt: string;
}

const normalizeTemplateName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, ' ');

const toTemplate = (row: any): UserTemplate => ({
  id: row.id,
  name: row.name,
  systemPrompt: row.system_prompt || '',
  isDefault: !!row.is_default,
  updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
});

const TEMPLATE_COLUMNS_WITH_UPDATED = 'id, name, system_prompt, is_default, created_at, updated_at';
const TEMPLATE_COLUMNS_LEGACY = 'id, name, system_prompt, is_default, created_at';

const getUserId = async (): Promise<string | null> => {
  const { data: auth } = await supabase.auth.getUser();
  return auth.user?.id || null;
};

const fetchUserTemplatesRaw = async (userId: string): Promise<UserTemplate[]> => {
  const withUpdated = await supabase
    .from('note_templates')
    .select(TEMPLATE_COLUMNS_WITH_UPDATED)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (!withUpdated.error) {
    return (withUpdated.data || []).map(toTemplate);
  }

  const legacy = await supabase
    .from('note_templates')
    .select(TEMPLATE_COLUMNS_LEGACY)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (legacy.error) throw legacy.error;
  return (legacy.data || []).map(toTemplate);
};

const dedupeTemplatesByName = (templates: UserTemplate[]): UserTemplate[] => {
  const seen = new Set<string>();
  const deduped: UserTemplate[] = [];
  for (const template of templates) {
    const key = normalizeTemplateName(template.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      ...template,
      name: template.name.trim(),
    });
  }
  return deduped;
};

export async function listUserTemplates(): Promise<UserTemplate[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const rows = await fetchUserTemplatesRaw(userId);
  return dedupeTemplatesByName(rows);
}

export async function cleanupDuplicateTemplates(): Promise<number> {
  const userId = await getUserId();
  if (!userId) return 0;

  const rows = await fetchUserTemplatesRaw(userId);
  const seen = new Set<string>();
  const duplicateIds: string[] = [];

  for (const row of rows) {
    const key = normalizeTemplateName(row.name);
    if (!key) continue;
    if (seen.has(key)) {
      duplicateIds.push(row.id);
      continue;
    }
    seen.add(key);
  }

  if (duplicateIds.length === 0) return 0;

  const { error } = await supabase
    .from('note_templates')
    .delete()
    .in('id', duplicateIds)
    .eq('user_id', userId);

  if (error) {
    console.warn('Could not clean duplicate templates:', error.message);
    return 0;
  }

  return duplicateIds.length;
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

export async function syncDefaultTemplatePrompts(): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const { data, error } = await supabase
    .from('note_templates')
    .select(TEMPLATE_COLUMNS_WITH_UPDATED)
    .eq('user_id', userId)
    .eq('is_default', true);

  const templateRows = !error
    ? data || []
    : (
        await supabase
          .from('note_templates')
          .select(TEMPLATE_COLUMNS_LEGACY)
          .eq('user_id', userId)
          .eq('is_default', true)
      ).data || [];

  const updates = templateRows
    .map(toTemplate)
    .filter((row) => !!TEMPLATES[row.name])
    .filter((row) => {
      const raw = templateRows.find((item: any) => item.id === row.id) as any;
      const createdAt = raw?.created_at || null;
      const updatedAt = raw?.updated_at || createdAt;
      const untouched = !updatedAt || !createdAt || updatedAt === createdAt;
      return untouched && row.systemPrompt.trim() !== TEMPLATES[row.name].trim();
    });

  if (updates.length === 0) return;

  await Promise.all(
    updates.map((row) =>
      supabase
        .from('note_templates')
        .update({ system_prompt: TEMPLATES[row.name] })
        .eq('id', row.id)
        .eq('user_id', userId)
    )
  );
}

export async function createTemplate(name: string, systemPrompt: string): Promise<UserTemplate> {
  const userId = await getUserId();
  if (!userId) throw new Error('Not signed in');
  const normalizedName = normalizeTemplateName(name);
  const existing = await listUserTemplates();
  if (existing.some((template) => normalizeTemplateName(template.name) === normalizedName)) {
    throw new Error('Template name already exists');
  }

  const { data, error } = await supabase
    .from('note_templates')
    .insert({
      user_id: userId,
      name,
      system_prompt: systemPrompt,
      is_default: false,
    })
    .select(TEMPLATE_COLUMNS_WITH_UPDATED)
    .single();

  if (!error && data) return toTemplate(data);

  const legacyResult = await supabase
    .from('note_templates')
    .select(TEMPLATE_COLUMNS_LEGACY)
    .eq('user_id', userId)
    .eq('name', name)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (legacyResult.error || !legacyResult.data) {
    throw error || legacyResult.error || new Error('Template creation failed');
  }
  return toTemplate(legacyResult.data);
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
    .select(TEMPLATE_COLUMNS_WITH_UPDATED)
    .single();

  if (!error && data) return toTemplate(data);

  const legacyResult = await supabase
    .from('note_templates')
    .select(TEMPLATE_COLUMNS_LEGACY)
    .eq('id', templateId)
    .eq('user_id', userId)
    .single();

  if (legacyResult.error || !legacyResult.data) {
    throw error || legacyResult.error || new Error('Template update failed');
  }
  return toTemplate(legacyResult.data);
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
    .select('name, system_prompt, updated_at, created_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (!error && data?.length) {
    const match = data.find((row: any) =>
      normalizeTemplateName(String(row?.name || '')) === normalizeTemplateName(templateName)
    );
    if (match) {
      return typeof match.system_prompt === 'string' ? match.system_prompt : '';
    }
    return fallbackPrompt;
  }

  const legacy = await supabase
    .from('note_templates')
    .select('name, system_prompt')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (legacy.error || !legacy.data?.length) return fallbackPrompt;
  const match = legacy.data.find((row: any) =>
    normalizeTemplateName(String(row?.name || '')) === normalizeTemplateName(templateName)
  );
  if (match) {
    return typeof match.system_prompt === 'string' ? match.system_prompt : '';
  }
  return fallbackPrompt;
}
