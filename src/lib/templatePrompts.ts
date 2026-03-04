import { supabase } from '@/integrations/supabase/client';

export async function getTemplatePrompt(templateName: string, fallbackPrompt: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return fallbackPrompt;

  const { data, error } = await supabase
    .from('note_templates')
    .select('system_prompt')
    .eq('user_id', user.id)
    .eq('name', templateName)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data?.length) return fallbackPrompt;
  const prompt = data[0]?.system_prompt?.trim();
  return prompt || fallbackPrompt;
}
