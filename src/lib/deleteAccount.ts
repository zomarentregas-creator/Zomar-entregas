import { supabase } from './supabase';

export async function deleteAccount() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Não autenticado');

  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) throw error;
  return data;
}