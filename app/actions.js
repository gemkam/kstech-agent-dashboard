'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const LEAD_STATUSES = ['new', 'approved', 'skipped', 'contacted', 'replied', 'meeting', 'won', 'lost']
// Same number of days as the client_mark_sent function in Supabase
const FOLLOWUP_DAYS = 3

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
  const due = new Date(Date.now() + FOLLOWUP_DAYS * 86400000).toISOString().slice(0, 10)
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

// Client (or admin): after sending an approved email from their own mailbox, record it
export async function clientMarkSent({ id }) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('client_mark_sent', { p_id: id })
  if (error || data !== 'ok') return { error: 'Could not mark as sent. Refresh and try again.' }
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

// Demo company only: guided demo steps (reset, find, draft, send, replies, results)
export async function demoAction(action, clientId) {
  const allowed = ['reset', 'find', 'draft', 'send', 'replies', 'results']
  if (!allowed.includes(action)) return { error: 'Unknown demo step.' }
  const supabase = createClient()
  const { data, error } = await supabase.rpc('demo_action', { p_action: action, p_client: clientId })
  if (error || data !== 'ok') return { error: 'Demo steps only work on a demo company.' }
  revalidatePath('/dashboard')
  return { ok: true }
}

// Demo company only: put the top demo leads in the viewer's current area (area name only, never coordinates)
export async function demoSetArea(area, clientId) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('demo_set_area', { p_area: String(area || '').slice(0, 60), p_client: clientId })
  if (error || data !== 'ok') return { error: 'Could not set the demo area.' }
  revalidatePath('/dashboard')
  return { ok: true }
}

// Client or admin: how far the agent should search (0 = nearby, else +km)
export async function setSearchRadius({ clientId, km }) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('set_search_radius', { p_client: clientId, p_km: km })
  if (error || data !== 'ok') return { error: 'Could not change the search area.' }
  revalidatePath('/dashboard')
  return { ok: true }
}

// Demo company only: expanding the radius finds more businesses further out
export async function demoExpand(km, clientId) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('demo_expand', { p_km: km, p_client: clientId })
  if (error || data !== 'ok') return { error: 'Could not expand the demo search.' }
  revalidatePath('/dashboard')
  return { ok: true }
}

// Demo company only: approve and "send" drafted emails
export async function demoSend(ids) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('demo_send', { p_ids: ids })
  if (error || data < 0) return { error: 'Sending is only simulated for demo companies.' }
  revalidatePath('/dashboard')
  return { ok: true, sent: data }
}

// Demo login only: switch between the demo companies
export async function switchDemo(slug) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('switch_demo', { p_slug: slug })
  if (error || data !== 'ok') return { error: 'Could not switch demo.' }
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

// Client or admin: mark a follow-up done / not done
export async function completeFollowup({ id, done = true }) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('complete_followup', { p_id: id, p_done: done })
  if (error || data !== 'ok') return { error: 'Could not update the follow-up.' }
  revalidatePath('/dashboard')
  return { ok: true }
}

// Client or admin: put a lead on the do-not-contact list (admin can also take it off)
export async function setDoNotContact({ id, on, reason }) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('set_do_not_contact', {
    p_lead: id,
    p_on: Boolean(on),
    p_reason: String(reason || '').slice(0, 200) || null,
  })
  if (error || data !== 'ok') {
    const reasons = {
      admin_only: 'Only KS Tech can take a business off the do-not-contact list.',
      forbidden: 'You can only change leads of your own company.',
    }
    return { error: reasons[data] || 'Could not save. Refresh and try again.' }
  }
  revalidatePath('/dashboard')
  return { ok: true }
}

// Admin: the duplicate warning was wrong, clear it
export async function clearDuplicate({ id }) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('clear_duplicate', { p_lead: id })
  if (error || data !== 'ok') return { error: 'Only admins can clear this.' }
  revalidatePath('/dashboard')
  return { ok: true }
}

// Admin: save the outreach mailbox checklist for a company
export async function saveMailboxSetup(input) {
  const supabase = createClient()
  const row = {
    client_id: input.clientId,
    outreach_email: String(input.outreach_email || '').trim().slice(0, 120) || null,
    provider: String(input.provider || '').trim().slice(0, 60) || null,
    mailbox_created: Boolean(input.mailbox_created),
    spf: Boolean(input.spf),
    dkim: Boolean(input.dkim),
    dmarc: Boolean(input.dmarc),
    test_passed: Boolean(input.test_passed),
    notes: String(input.notes || '').trim().slice(0, 500) || null,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('mailbox_setup').upsert(row, { onConflict: 'client_id' })
  if (error) return { error: 'Only admins can change the email setup.' }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
