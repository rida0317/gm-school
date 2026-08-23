import { createClient } from '@/lib/supabase/client';

export interface AuditEventPayload {
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  user_id?: string;
  ip_address?: string;
}

/**
 * Log an event to Supabase `audit_logs` table seamlessly and safely.
 * Non-blocking: will never crash the UI if Supabase encounters a temporary network issue.
 */
export async function logAuditEvent(payload: AuditEventPayload): Promise<void> {
  try {
    const supabase = createClient();

    let userId = payload.user_id;
    if (!userId) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        userId = authData.user.id;
      }
    }

    const record = {
      action: payload.action,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id ? String(payload.entity_id) : null,
      details: payload.details || {},
      user_id: userId || null,
      ip_address: payload.ip_address || null,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('audit_logs').insert([record]);
    if (error) {
      console.warn('[Audit Log] Notice inserting into Supabase:', error.message);
    }
  } catch (err) {
    console.warn('[Audit Log] Exception while recording log:', err);
  }
}
