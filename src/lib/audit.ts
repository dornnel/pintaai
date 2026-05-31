// Audit trail helper — popula a tabela audit_logs existente
import { supabase } from './supabase'

export type AuditAction =
  | 'lead_stage_changed'
  | 'lead_sent_to_painters'
  | 'lead_confirmed'
  | 'payment_milestone_released'
  | 'admin_permission_changed'
  | 'user_banned'
  | 'user_unbanned'
  | 'product_approved'
  | 'product_rejected'
  | 'ad_approved'
  | 'ad_rejected'
  | 'painter_status_changed'
  | 'subscription_canceled'
  | 'budget_divergence_registered'

interface AuditEntry {
  actor_user_id?: string
  entity_type: string
  entity_id: string
  action: AuditAction | string
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
  ip_address?: string
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      actor_user_id: entry.actor_user_id || null,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      action: entry.action,
      old_values: entry.old_values || null,
      new_values: entry.new_values || null,
      ip_address: entry.ip_address || null,
      user_agent: navigator.userAgent.slice(0, 200),
    })
  } catch (err) {
    // Audit log failure never blocks user actions
    console.warn('Audit log failed:', err)
  }
}

// Notificar admin via edge function
export async function notifyAdmin(event: string, data: Record<string, string>): Promise<void> {
  try {
    await supabase.functions.invoke('send-admin-notification', { body: { event, data } })
  } catch (err) {
    console.warn('Admin notification failed:', err)
  }
}
