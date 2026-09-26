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
  return { ok: true, runId: data.id }
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

// Admin or client: save the current area (name only, never coordinates) as the search base
export async function setBaseArea({ clientId, area }) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('set_base_area', { p_client: clientId, p_area: String(area || '').slice(0, 60) })
  if (error || data !== 'ok') return { error: 'Could not save your area.' }
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

const clean = (v, max = 300) => {
  const t = String(v ?? '').trim()
  return t ? t.slice(0, max) : null
}

// Admin: check for possible duplicates before adding a lead
export async function checkDuplicates({ clientId, name, phone, email }) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('find_duplicate_leads', {
    p_client: clientId, p_name: name || '', p_phone: phone || '', p_email: email || '',
  })
  if (error) return { error: 'Could not check for duplicates.' }
  return { ok: true, matches: data || [] }
}

// Admin: add a lead from the dashboard
export async function addLead(input) {
  const supabase = createClient()
  const name = clean(input.business_name, 120)
  if (!name) return { error: 'Business name is required.' }
  const service = ['leadgen', 'quotes', 'booking'].includes(input.service) ? input.service : 'leadgen'
  const score = Number(input.score)
  const row = {
    client_id: input.clientId,
    service,
    business_name: name,
    category: clean(input.category, 60)?.toLowerCase().replace(/\s+/g, '_') || null,
    area: clean(input.area, 60),
    phone: clean(input.phone, 30),
    whatsapp: clean(input.whatsapp, 30),
    email: clean(input.email, 120)?.toLowerCase() || null,
    website: clean(input.website, 200),
    google_maps_url: clean(input.google_maps_url, 400),
    source: clean(input.source, 60) || 'google_maps',
    problem_found: clean(input.problem_found, 200),
    problem_evidence: clean(input.problem_evidence, 400),
    suggested_service: clean(input.suggested_service, 200),
    why_chosen: clean(input.why_chosen, 500),
    score: Number.isFinite(score) && score >= 1 && score <= 10 ? Math.round(score) : null,
    status: 'new',
  }
  const { data, error } = await supabase.from('leads').insert(row).select('id, ref_code, duplicate_of, do_not_contact').single()
  if (error) return { error: 'Could not add the lead. Only admins can add leads.' }
  await supabase.from('agent_events').insert({ client_id: input.clientId, kind: 'find', message: `New lead added: ${name}` })
  revalidatePath('/dashboard')
  return { ok: true, lead: data }
}

// Ready-made first messages for businesses found by the live search (the client still approves each one)
function templateMessage({ service, name, type, area, hasWebsite, ref, lang }) {
  const link = `https://kstech-solutions.vercel.app/?ref=${ref}#work`
  const where = area ? ` in ${area}` : ''
  if (lang === 'ur') {
    const line = service === 'quotes'
      ? 'بہت سے کاروبار ان گاہکوں کو کھو دیتے ہیں جو قیمت پوچھ کر خاموش ہو جاتے ہیں۔ ہمارا ایجنٹ ہر قیمت کا فالو اپ کرتا ہے، اور آپ صرف سنجیدہ گاہکوں سے بات کرتے ہیں۔'
      : service === 'booking'
        ? 'جو لوگ اپائنٹمنٹ کے بارے میں پوچھتے ہیں مگر بک نہیں کرتے، ہمارا ایجنٹ ہر ایک کو دو خالی وقت بھیجتا ہے تاکہ کوئی گاہک ضائع نہ ہو۔'
        : 'آپ کے مینو یا سروسز اور واٹس ایپ آرڈر کے ساتھ ایک سادہ ویب سائٹ سے نئے گاہک آپ تک آسانی سے پہنچ سکیں گے۔'
    return `السلام علیکم۔ میں کامران ضیاء صدیقی ہوں، KS TECH LLC کا مالک، جو مسقط کی ایک آئی ٹی کمپنی ہے۔ ${line}\n${link}\nکیا میں آپ کو کچھ نمونے دکھا سکتا ہوں؟`
  }
  const intro = `Good day. I'm Kamran Zia Siddiquee, owner of KS TECH LLC, a Muscat-based IT company. I came across ${name}${where}.`
  const body = service === 'quotes'
    ? `Many businesses lose customers who ask for a price and then go quiet. Our agent follows up every quote for you, so you only talk to the serious buyers.`
    : service === 'booking'
      ? `When people message to ask about an appointment, some never book. Our booking agent answers every enquiry with two free times, so fewer customers slip away.`
      : hasWebsite
        ? `We help businesses like yours get more customers online, with online booking, WhatsApp ordering and follow-ups.`
        : `I noticed ${name} has no website listed online, so people searching for a ${type.toLowerCase()} nearby may not find you. We build simple websites with WhatsApp ordering and booking.`
  return `${intro} ${body}\n${link}\nCan I show you a few examples?`
}

// Admin: save businesses from the live search as leads, optionally with ready-made drafts
export async function addFoundLeads({ clientId, service, items, withDrafts, searchedNear }) {
  const supabase = createClient()
  const svc = ['leadgen', 'quotes', 'booking'].includes(service) ? service : 'leadgen'
  const list = Array.isArray(items) ? items.slice(0, 60) : []
  let added = 0, drafts = 0, dup = 0, blocked = 0
  for (const b of list) {
    const name = clean(b.name, 120)
    if (!name) continue
    const gaps = Array.isArray(b.gaps) ? b.gaps.slice(0, 3) : []
    const row = {
      client_id: clientId,
      service: svc,
      business_name: name,
      category: clean(b.typeKey || b.type, 60)?.toLowerCase().replace(/\s+/g, '_') || null,
      area: clean(b.area, 60) || clean(searchedNear, 60),
      phone: clean(b.phone, 30),
      email: clean(b.email, 120)?.toLowerCase() || null,
      website: clean(b.website, 200),
      google_maps_url: clean(b.mapUrl, 400),
      source: 'openstreetmap',
      problem_found: gaps[0] || null,
      problem_evidence: gaps.length ? `Public map listing: ${gaps.join(', ').toLowerCase()}` : null,
      suggested_service: svc === 'quotes' ? 'Quote follow-up agent' : svc === 'booking' ? 'Booking agent' : (b.website ? 'Online booking and WhatsApp ordering' : 'Website with WhatsApp ordering'),
      why_chosen: `${b.type || 'Business'} about ${Number(b.km || 0).toFixed(1)} km from ${searchedNear || 'the search area'}.${gaps.length ? ' ' + gaps.join('. ') + '.' : ''}`,
      score: Number.isFinite(Number(b.score)) ? Math.max(1, Math.min(10, Math.round(Number(b.score)))) : null,
      status: 'new',
    }
    const { data: lead, error } = await supabase.from('leads').insert(row).select('id, ref_code, duplicate_of, do_not_contact').single()
    if (error || !lead) continue
    added++
    if (lead.duplicate_of) dup++
    if (!withDrafts) continue
    if (lead.do_not_contact) { blocked++; continue }
    const channel = row.phone ? 'whatsapp' : row.email ? 'email' : null
    if (!channel) continue
    const langs = /pakistan|lahori|karachi|kolachi|peshawari|multani/i.test(`${name} ${b.cuisine || ''}`) ? ['en', 'ur'] : ['en']
    for (const lang of langs) {
      const { error: dErr } = await supabase.from('outreach').insert({
        lead_id: lead.id,
        client_id: clientId,
        channel,
        language: lang,
        subject: channel === 'email' ? `Quick idea for ${name}` : null,
        message_draft: templateMessage({ service: svc, name, type: b.type || 'business', area: row.area, hasWebsite: Boolean(b.website), ref: lead.ref_code, lang }),
        status: 'draft',
      })
      if (!dErr) drafts++
    }
  }
  if (added) {
    await supabase.from('agent_events').insert({
      client_id: clientId, kind: 'find',
      message: `${added} lead${added === 1 ? '' : 's'} saved from live search${drafts ? `, ${drafts} draft${drafts === 1 ? '' : 's'} written` : ''}`,
    })
  }
  revalidatePath('/dashboard')
  return { ok: true, added, drafts, dup, blocked }
}

// Admin: write a message draft for a lead (goes to the client for approval)
export async function addDraft(input) {
  const supabase = createClient()
  const message = clean(input.message, 4000)
  if (!message) return { error: 'Write the message first.' }
  const channel = ['email', 'whatsapp'].includes(input.channel) ? input.channel : 'email'
  const language = ['en', 'ar', 'ur'].includes(input.language) ? input.language : 'en'
  const { data: lead } = await supabase.from('leads').select('id, client_id, business_name, do_not_contact').eq('id', input.leadId).single()
  if (!lead) return { error: 'Lead not found.' }
  if (lead.do_not_contact) return { error: 'This business is on the do-not-contact list.' }
  const { error } = await supabase.from('outreach').insert({
    lead_id: lead.id,
    client_id: lead.client_id,
    channel,
    language,
    subject: channel === 'email' ? clean(input.subject, 200) : null,
    message_draft: message,
    status: 'draft',
  })
  if (error) return { error: 'Could not save the draft. Only admins can write drafts.' }
  await supabase.from('agent_events').insert({ client_id: lead.client_id, kind: 'draft', message: `Message drafted for ${lead.business_name}` })
  revalidatePath('/dashboard')
  return { ok: true }
}

// Client or admin: record the result of a lead (replied, meeting, won, lost)
export async function setResult({ id, status, note }) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('client_set_result', { p_lead: id, p_status: status, p_note: clean(note, 300) })
  if (error || data !== 'ok') {
    return { error: data === 'forbidden' ? 'You can only update your own leads.' : 'Could not save. Refresh and try again.' }
  }
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
