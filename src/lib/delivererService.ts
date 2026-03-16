import { supabase } from './supabase'

export interface DelivererStats {
  total_deliveries: number
  rating: number
  status: string
  vehicle_type?: string
  license_plate?: string
  delivery_radius_km?: number
  document_verified?: boolean
  available?: boolean
}

export async function getDelivererStats(userId: string): Promise<DelivererStats> {
  try {
    // Primeiro tenta buscar da tabela delivery_persons
    const { data, error } = await supabase
      .from('delivery_persons')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      // Return default stats if table not found
      return {
        total_deliveries: 0,
        rating: 0,
        status: 'ativo',
        vehicle_type: undefined,
        license_plate: undefined,
        delivery_radius_km: 0,
        document_verified: false,
        available: false
      }
    }

    return data
  } catch (error) {
    // Return default stats on error
    return {
      total_deliveries: 0,
      rating: 0,
      status: 'ativo',
      vehicle_type: undefined,
      license_plate: undefined,
      delivery_radius_km: 0,
      document_verified: false,
      available: false
    }
  }
}

export async function updateDelivererStats(
  userId: string, 
  updates: Partial<DelivererStats>
) {
  try {
    // Tenta atualizar a tabela delivery_persons
    const { error } = await supabase
      .from('delivery_persons')
      .upsert({
        user_id: userId,
        ...updates,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })

    if (error) {
      return { success: false }
    }

    return { success: true }
  } catch (error) {
    return { success: false }
  }
}

export async function incrementDelivererDeliveries(userId: string) {
  try {
    // Tenta incrementar o contador
    const { data: currentData } = await supabase
      .from('delivery_persons')
      .select('total_deliveries')
      .eq('user_id', userId)
      .single()

    const currentCount = currentData?.total_deliveries || 0
    
    const { error } = await supabase
      .from('delivery_persons')
      .update({
        total_deliveries: currentCount + 1,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (error) {
      return { success: false }
    }

    return { success: true }
  } catch (error) {
    return { success: false }
  }
}
