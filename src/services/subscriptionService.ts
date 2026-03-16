// src/services/subscriptionService.ts
import { supabase } from '../lib/supabase'

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export interface Plan {
  id: string
  name: string
  slug: string
  description: string
  price: number
  currency: string
  billing_period: 'monthly' | 'yearly'
  max_deliveries: number | null
  features: string[]
  is_active: boolean
  is_popular: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  user_id: string
  plan_id: string
  status: 'trial' | 'active' | 'past_due' | 'canceled' | 'expired'
  started_at: string
  current_period_start: string
  current_period_end: string | null
  trial_end: string | null
  canceled_at: string | null
  ended_at: string | null
  deliveries_used: number
  deliveries_limit: number | null
  payment_method: string | null
  last_payment_date: string | null
  next_billing_date: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
  // Campos extras quando joinado com plan
  plan?: Plan
  plan_name?: string
  plan_slug?: string
  plan_price?: number
  plan_features?: string[]
  deliveries_remaining?: number
}

export interface Payment {
  id: string
  subscription_id: string
  user_id: string
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed' | 'refunded'
  payment_method: string | null
  payment_provider: string | null
  payment_provider_id: string | null
  payment_provider_data: Record<string, any>
  paid_at: string | null
  refunded_at: string | null
  description: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface SubscriptionChange {
  id: string
  user_id: string
  subscription_id: string | null
  change_type: 'created' | 'upgraded' | 'downgraded' | 'canceled' | 'renewed' | 'expired' | 'reactivated'
  from_plan_id: string | null
  to_plan_id: string | null
  reason: string | null
  metadata: Record<string, any>
  created_at: string
}

export interface CreateSubscriptionParams {
  user_id: string
  plan_id: string
  payment_method?: string
  trial_days?: number
}

export interface UpgradeSubscriptionParams {
  subscription_id: string
  new_plan_id: string
  reason?: string
}

// ============================================================================
// SUBSCRIPTION SERVICE
// ============================================================================

class SubscriptionService {
  
  // --------------------------------------------------------------------------
  // PLANOS
  // --------------------------------------------------------------------------
  
  /**
   * Busca todos os planos ativos
   */
  async getActivePlans(): Promise<{ data: Plan[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Erro ao buscar planos:', error)
      return { data: null, error }
    }
  }
  
  /**
   * Busca um plano específico por slug
   */
  async getPlanBySlug(slug: string): Promise<{ data: Plan | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Erro ao buscar plano:', error)
      return { data: null, error }
    }
  }
  
  /**
   * Busca um plano por ID
   */
  async getPlanById(id: string): Promise<{ data: Plan | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Erro ao buscar plano:', error)
      return { data: null, error }
    }
  }
  
  // --------------------------------------------------------------------------
  // ASSINATURAS
  // --------------------------------------------------------------------------
  
  /**
   * Busca a assinatura ativa do usuário
   */
  async getCurrentSubscription(userId: string): Promise<{ data: Subscription | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('v_user_subscriptions_with_plan')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['trial', 'active'])
        .single()
      
      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
      return { data: data || null, error: null }
    } catch (error) {
      console.error('Erro ao buscar assinatura atual:', error)
      return { data: null, error }
    }
  }
  
  /**
   * Busca todas as assinaturas do usuário (incluindo inativas)
   */
  async getUserSubscriptions(userId: string): Promise<{ data: Subscription[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('v_user_subscriptions_with_plan')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Erro ao buscar assinaturas:', error)
      return { data: null, error }
    }
  }
  
  /**
   * Cria uma nova assinatura
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<{ data: Subscription | null; error: any }> {
    try {
      const { user_id, plan_id, payment_method = 'credit_card', trial_days = 0 } = params
      
      // Busca o plano
      const { data: plan, error: planError } = await this.getPlanById(plan_id)
      if (planError || !plan) {
        throw new Error('Plano não encontrado')
      }
      
      // Calcula datas
      const now = new Date()
      const trialEnd = trial_days > 0 ? new Date(now.getTime() + trial_days * 24 * 60 * 60 * 1000) : null
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 dias
      
      // Cria a assinatura
      const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id,
          plan_id,
          status: trial_days > 0 ? 'trial' : 'active',
          started_at: now.toISOString(),
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          trial_end: trialEnd?.toISOString(),
          deliveries_limit: plan.max_deliveries,
          deliveries_used: 0,
          payment_method,
          next_billing_date: periodEnd.toISOString()
        })
        .select()
        .single()
      
      if (subError) throw subError
      
      // Registra a mudança
      await supabase.from('subscription_changes').insert({
        user_id,
        subscription_id: subscription.id,
        change_type: 'created',
        to_plan_id: plan_id,
        reason: 'Nova assinatura criada'
      })
      
      return { data: subscription, error: null }
    } catch (error) {
      console.error('Erro ao criar assinatura:', error)
      return { data: null, error }
    }
  }
  
  /**
   * Atualiza para um novo plano (upgrade/downgrade)
   */
  async changePlan(params: UpgradeSubscriptionParams): Promise<{ data: Subscription | null; error: any }> {
    try {
      const { subscription_id, new_plan_id, reason } = params
      
      // Busca a assinatura atual
      const { data: currentSub, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('id', subscription_id)
        .single()
      
      if (subError || !currentSub) {
        throw new Error('Assinatura não encontrada')
      }
      
      // Busca o novo plano
      const { data: newPlan, error: planError } = await this.getPlanById(new_plan_id)
      if (planError || !newPlan) {
        throw new Error('Novo plano não encontrado')
      }
      
      // Determina o tipo de mudança
      const { data: oldPlan } = await this.getPlanById(currentSub.plan_id)
      let changeType: SubscriptionChange['change_type'] = 'upgraded'
      if (oldPlan && newPlan.price < oldPlan.price) {
        changeType = 'downgraded'
      }
      
      // Atualiza a assinatura
      const { data: updatedSub, error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          plan_id: new_plan_id,
          deliveries_limit: newPlan.max_deliveries,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription_id)
        .select()
        .single()
      
      if (updateError) throw updateError
      
      // Registra a mudança
      await supabase.from('subscription_changes').insert({
        user_id: currentSub.user_id,
        subscription_id,
        change_type: changeType,
        from_plan_id: currentSub.plan_id,
        to_plan_id: new_plan_id,
        reason: reason || `Plano alterado para ${newPlan.name}`
      })
      
      return { data: updatedSub, error: null }
    } catch (error) {
      console.error('Erro ao mudar plano:', error)
      return { data: null, error }
    }
  }
  
  /**
   * Cancela uma assinatura
   */
  async cancelSubscription(subscriptionId: string, reason?: string): Promise<{ data: Subscription | null; error: any }> {
    try {
      const now = new Date()
      
      // Busca a assinatura
      const { data: currentSub, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single()
      
      if (subError || !currentSub) {
        throw new Error('Assinatura não encontrada')
      }
      
      // Atualiza para cancelada
      const { data: updatedSub, error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          canceled_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', subscriptionId)
        .select()
        .single()
      
      if (updateError) throw updateError
      
      // Registra a mudança
      await supabase.from('subscription_changes').insert({
        user_id: currentSub.user_id,
        subscription_id: subscriptionId,
        change_type: 'canceled',
        from_plan_id: currentSub.plan_id,
        reason: reason || 'Assinatura cancelada pelo usuário'
      })
      
      return { data: updatedSub, error: null }
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error)
      return { data: null, error }
    }
  }
  
  /**
   * Reativa uma assinatura cancelada
   */
  async reactivateSubscription(subscriptionId: string): Promise<{ data: Subscription | null; error: any }> {
    try {
      const now = new Date()
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      
      // Busca a assinatura
      const { data: currentSub, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single()
      
      if (subError || !currentSub) {
        throw new Error('Assinatura não encontrada')
      }
      
      // Reativa
      const { data: updatedSub, error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'active',
          canceled_at: null,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          next_billing_date: periodEnd.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', subscriptionId)
        .select()
        .single()
      
      if (updateError) throw updateError
      
      // Registra a mudança
      await supabase.from('subscription_changes').insert({
        user_id: currentSub.user_id,
        subscription_id: subscriptionId,
        change_type: 'reactivated',
        to_plan_id: currentSub.plan_id,
        reason: 'Assinatura reativada'
      })
      
      return { data: updatedSub, error: null }
    } catch (error) {
      console.error('Erro ao reativar assinatura:', error)
      return { data: null, error }
    }
  }
  
  /**
   * Verifica se o usuário pode criar uma entrega
   */
  async canCreateDelivery(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const { data, error } = await supabase.rpc('can_create_delivery', {
        p_user_id: userId
      })
      
      if (error) throw error
      
      if (!data) {
        const { data: sub } = await this.getCurrentSubscription(userId)
        if (!sub) {
          return { allowed: false, reason: 'Nenhuma assinatura ativa' }
        }
        if (sub.deliveries_limit && sub.deliveries_used >= sub.deliveries_limit) {
          return { allowed: false, reason: 'Limite de entregas atingido' }
        }
      }
      
      return { allowed: data }
    } catch (error) {
      console.error('Erro ao verificar permissão:', error)
      return { allowed: false, reason: 'Erro ao verificar permissão' }
    }
  }
  
  /**
   * Incrementa o contador de entregas usadas
   */
  async incrementDeliveryUsage(userId: string): Promise<{ success: boolean; error: any }> {
    try {
      const { error } = await supabase.rpc('increment_delivery_usage', {
        p_user_id: userId
      })
      
      if (error) throw error
      return { success: true, error: null }
    } catch (error) {
      console.error('Erro ao incrementar uso:', error)
      return { success: false, error }
    }
  }
  
  // --------------------------------------------------------------------------
  // PAGAMENTOS
  // --------------------------------------------------------------------------
  
  /**
   * Busca histórico de pagamentos do usuário
   */
  async getUserPayments(userId: string): Promise<{ data: Payment[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('subscription_payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Erro ao buscar pagamentos:', error)
      return { data: null, error }
    }
  }
  
  /**
   * Cria um registro de pagamento
   */
  async createPayment(payment: Partial<Payment>): Promise<{ data: Payment | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('subscription_payments')
        .insert(payment)
        .select()
        .single()
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Erro ao criar pagamento:', error)
      return { data: null, error }
    }
  }
  
  // --------------------------------------------------------------------------
  // HISTÓRICO
  // --------------------------------------------------------------------------
  
  /**
   * Busca histórico de mudanças do usuário
   */
  async getSubscriptionHistory(userId: string): Promise<{ data: SubscriptionChange[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('subscription_changes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Erro ao buscar histórico:', error)
      return { data: null, error }
    }
  }
}

// Exporta instância única do serviço
export const subscriptionService = new SubscriptionService()
export default subscriptionService