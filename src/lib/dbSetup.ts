import { supabase } from './supabase'

export async function checkTablesExist() {
  try {
    // Tenta buscar das tabelas (uma query simples)
    const { data: deliveries, error: deliveriesError } = await supabase
      .from('deliveries')
      .select('id')
      .limit(1)

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)

    const { data: incidents, error: incidentsError } = await supabase
      .from('incidents')
      .select('id')
      .limit(1)

    return {
      deliveries: !deliveriesError,
      profiles: !profilesError,
      incidents: !incidentsError,
      errors: {
        deliveries: deliveriesError?.message,
        profiles: profilesError?.message,
        incidents: incidentsError?.message
      }
    }
  } catch (error) {
    console.error('Erro ao verificar tabelas:', error)
    return {
      deliveries: false,
      profiles: false,
      incidents: false,
      errors: { general: error.message }
    }
  }
}

export async function setupDatabase() {
  const tables = await checkTablesExist()
  
  if (!tables.deliveries || !tables.profiles) {
    console.warn('⚠️  Tabelas não encontradas. Execute o SQL no Supabase.')
    return {
      success: false,
      message: 'Tabelas não encontradas. Execute o script SQL no dashboard do Supabase.',
      tables
    }
  }
  
  return {
    success: true,
    message: 'Banco de dados configurado corretamente.',
    tables
  }
}