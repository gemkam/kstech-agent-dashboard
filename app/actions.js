'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const LEAD_STATUSES = ['new', 'approved', 'skipped', 'contacted', 'replied', 'meeting', 'won', 'lost']

export async function updateLead({ id, status, notes }) {
  if (!LEAD_STATUSES.includes(status)) return { error: 'Unknown status.' }
  const supabase = createClient()
  const { error } = await supabase
    .from('leads')
    .update({ status, notes: notes || null, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: 'Could not save. Only admins can edit leads.' }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function setFollowupDone({ id, done }) {
  const supabase = createClient()
  const { error } = await supabase.from('followups').update({ done }).eq('id', id)
  if (error) return { error: 'Could not update follow-up.' }
  revalidatePath('/dashboard')
  return { ok: true }
}

// Client or admin: approve / reject a drafted email (optionally with edits)
export async function reviewOutreach({ id, action, message, subject }) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('review_outreach', {
    p_id: id,
    p_action: action,
    p_message: message ?? null,
    p_subject: subject ?? null,
  })
  if (error || data !== 'ok') {
    const reasons = {
      not_draft: 'This email was already reviewed.',
      forbidden: 'You can only review emails for your own company.',
    }
    return { error: reasons[data] || 'Could not save your review. Refresh and try again.' }
  }
  revalidatePath('/dashboard')
  return { ok: true }
}

// Admin: after sending an approved email, record it as sent
export async function markSent({ id }) {
  const supabase = createClient()
  const { data: o, error } = await supabase
    .from('outreach')
    .select('id, lead_id, client_id, message_draft, leads(business_name, status)')
    .eq('id', id)
    .single()
  if (error || !o) return { error: 'Email not found.' }

  const now = new Date().toISOString()
  const { error: upErr } = await supabase
    .from('outreach')
    .update({ status: 'sent', sent_at: now, message_sent: o.message_draft })
    .eq('id', id)
  if (upErr) return { error: 'Only admins can mark emails as sent.' }

  if (['new', 'approved'].includes(o.leads?.status)) {
    await supabase.from('leads').update({ status: 'contacted', updated_at: now }).eq('id', o.lead_id)
  }
  const due = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10)
  await supabase.from('followups').insert({
    lead_id: o.lead_id,
    outreach_id: o.id,
    client_id: o.client_id,
    due_date: due,
    draft_message: 'Following up on my earlier email. Would a short call this week suit you?',
  })
  await supabase.from('agent_events').insert({
    client_id: o.client_id,
    kind: 'send',
    message: `Email sent to ${o.leads?.business_name || 'lead'}`,
  })
  revalidatePath('/dashboard')
  return { ok: true }
}

// Admin: switch the live agent indicator on / off for a real client
export async function startAgentRun({ clientId, step }) {
  const supabase = createClient()
  const text = (step || '').trim() || 'Searching for new businesses'
  const { data, error } = await supabase
    .from('agent_runs')
    .insert({ client_id: clientId, status: 'running', current_step: text })
    .select('id')
    .single()
  if (error) return { error: 'Only admins can start the agent.' }
  await supabase.from('agent_events').insert({ client_id: clientId, run_id: data.id, kind: 'start', message: `Agent started: ${text}` })
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function finishAgentRun({ runId, clientId, summary }) {
  const supabase = createClient()
  const text = (summary || '').trim() || 'Run completed'
  const { error } = await supabase
    .from('agent_runs')
    .update({ status: 'completed', finished_at: new Date().toISOString(), current_step: null, summary: text })
    .eq('id', runId)
  if (error) return { error: 'Only admins can finish the agent run.' }
  await supabase.from('agent_events').insert({ client_id: clientId, run_id: runId, kind: 'done', message: text })
  revalidatePath('/dashboard')
  return { ok: true }
}

// Demo company only: create sample leads and drafts after the animated run
export async function completeDemoRun() {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('demo_agent_complete')
  if (error || data !== 'ok') return { error: 'Demo run is only available for the demo company.' }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function updateProfile(formData) {
  const supabase = createClient()
  const userId = formData.get('user_id')
  const role = formData.get('role') === 'admin' ? 'admin' : 'client'
  const clientId = formData.get('client_id') || null
  await supabase.from('profiles').update({ role, client_id: clientId }).eq('user_id', userId)
  revalidatePath('/admin')
}

export async function addClient(formData) {
  const supabase = createClient()
  const name = String(formData.get('name') || '').trim()
  const slug = String(formData.get('slug') || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
  if (!name || !slug) return
  await supabase.from('clients').insert({ name, slug })
  revalidatePath('/admin')
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
