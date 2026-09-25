'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  updateLead,
  setFollowupDone,
  signOut,
  reviewOutreach,
  markSent,
  startAgentRun,
  finishAgentRun,
  demoAction,
  demoSend,
  clientMarkSent,
  demoSetArea,
  setSearchRadius,
  demoExpand,
  switchDemo,
} from '../actions'

const STATUS = {
  new: 'New',
  approved: 'Approved',
  contacted: 'Contacted',
  replied: 'Replied',
  meeting: 'Meeting',
  won: 'Won',
  lost: 'Lost',
  skipped: 'Skipped',
}
const STATUS_ORDER = ['new', 'approved', 'contacted', 'replied', 'meeting', 'won', 'lost', 'skipped']
const CONTACTED = ['contacted', 'replied', 'meeting', 'won', 'lost']
const REPLIED = ['replied', 'meeting', 'won']
const MEETING = ['meeting', 'won']
const CHANNEL = { email: 'Email', whatsapp: 'WhatsApp', call: 'Call', visit: 'Visit' }

// Guided demo: what each step says, which button moves it on, and the animation shown
const DEMO = {
  1: {
    label: 'Profile',
    title: 'Your company profile',
    text: 'We start by learning what you sell and who you want as customers. When you press Start agent, allow location so it searches near you first.',
    button: 'Start agent',
    action: 'find',
    anim: [
      'Reading your company profile',
      'Searching business listings in Al Khuwair and Ghubrah',
      'Searching Qurum, Bousher, Ghala and Ruwi',
      'Found 38 businesses, reading their customer reviews',
      'Checking which ones match your ideal customer',
      '6 businesses matched, saving them to your leads',
    ],
    target: 'sec-agent',
  },
  2: {
    label: 'Find',
    title: 'The agent found 6 businesses',
    text: 'Each lead shows why it fits: a problem spotted in its reviews that your service solves. Open any lead to see the details.',
    button: 'Write emails',
    action: 'draft',
    anim: [
      'Reading each business and its problem',
      'Writing a personalized email for each one',
      'Checking tone and length',
      'Saving drafts for your approval',
    ],
    target: 'sec-leads',
  },
  3: {
    label: 'Approve',
    title: 'You approve every email',
    text: 'Read each email, then approve, edit or reject it. Nothing is sent without your approval.',
    target: 'sec-approvals',
  },
  4: {
    label: 'Send',
    title: 'Approved emails are sent',
    text: 'Emails go out from your own company email address, so replies come straight to you.',
    button: 'Send approved emails',
    action: 'send',
    anim: ['Sending approved emails from your company email', 'Scheduling follow-ups for each business'],
    target: 'sec-approvals',
  },
  5: {
    label: 'Replies',
    title: 'Waiting for replies',
    text: 'The agent tracks who replies. Businesses that do not reply get a polite follow-up after two days.',
    button: 'Show 2 days later',
    action: 'replies',
    anim: ['Two days later', 'Checking replies'],
    target: 'sec-pipeline',
  },
  6: {
    label: 'Results',
    title: '2 businesses replied',
    text: 'Replies arrive in your inbox and show here. Follow-ups for the others are due today. You handle the conversations and close the deals.',
    button: 'Show 1 week later',
    action: 'results',
    anim: ['One week later', 'Updating your results'],
    target: 'sec-activity',
  },
  7: {
    label: 'Done',
    title: 'One week in: a meeting booked and a contract won',
    text: 'This is the full cycle: find, write, approve, send, follow up, close. It repeats every week with new businesses.',
    button: 'Restart demo',
    action: 'reset',
    target: 'sec-pipeline',
  },
}
const DEMO_STEPS = [1, 2, 3, 4, 5, 6]

// The other two demos reuse the same 6 steps with their own words
const DEMO_OVERRIDES = {
  quotes: {
    1: { title: 'Your quotes and enquiries', text: 'The agent reads your enquiry inbox and quote list, and finds every customer who asked for a price and went quiet.', button: 'Start agent',
         anim: ['Reading your enquiry inbox', 'Checking the last 30 days of quote requests', 'Found 14 quote requests', 'Checking which ones had no reply or no follow-up', '6 quotes need a follow-up, saving them'] },
    2: { label: 'Scan quotes', title: '6 quotes need a follow-up', text: 'Each one shows the quote, how long it has been silent, and why it is worth chasing. Open any of them for details.', button: 'Write follow-ups',
         anim: ['Reading each quote and customer', 'Writing a polite follow-up for each one', 'Checking tone and length', 'Saving follow-ups for your approval'] },
    3: { title: 'You approve every follow-up', text: 'Read each follow-up, then approve, edit or reject it. Nothing is sent without your approval.' },
    4: { title: 'Approved follow-ups are sent', text: 'Follow-ups go out from your own company email, so customers reply straight to you.', button: 'Send approved follow-ups',
         anim: ['Sending approved follow-ups from your company email', 'Scheduling a reminder for each customer'] },
    5: { title: 'Waiting for customers to reply', text: 'The agent tracks who replies. Customers who stay quiet get one more polite reminder after two days.' },
    6: { title: '2 customers replied', text: 'Replies arrive in your inbox and show here. You confirm the order or book the site visit.' },
    7: { title: 'One week in: an order confirmed and a site visit booked', text: 'No quote is forgotten any more. Every price you send gets followed up until the customer decides.' },
  },
  booking: {
    1: { title: 'Your enquiries', text: 'The agent reads WhatsApp, Instagram, website forms and missed calls, and finds everyone who asked about an appointment but did not book.', button: 'Start agent',
         anim: ['Reading WhatsApp and Instagram messages', 'Checking website forms and missed calls', 'Found 21 enquiries from the last 2 weeks', 'Checking who has not booked yet', '6 people did not book, saving them'] },
    2: { label: 'Scan enquiries', title: '6 people did not book', text: 'Each one shows what they asked about and why they are likely to book if you offer a time. Open any of them for details.', button: 'Write invitations',
         anim: ['Reading each enquiry', 'Offering two free times to each person', 'Checking tone and length', 'Saving invitations for your approval'] },
    3: { title: 'You approve every message', text: 'Read each booking invitation, then approve, edit or reject it. Nothing is sent without your approval.' },
    4: { title: 'Approved invitations are sent', text: 'Messages go out from your clinic WhatsApp, so people reply straight to you.', button: 'Send approved invitations',
         anim: ['Sending approved invitations from your clinic WhatsApp', 'Scheduling a reminder for each person'] },
    5: { title: 'Waiting for replies', text: 'The agent tracks who replies. People who stay quiet get one friendly reminder after two days.' },
    6: { title: '2 people replied', text: 'They picked a time. Your front desk confirms the appointment.' },
    7: { title: 'One week in: an appointment booked and a patient attended', text: 'Every enquiry gets an answer and a time. Fewer lost patients, fuller calendar.' },
  },
}

function getDemo(kind) {
  const extra = DEMO_OVERRIDES[kind]
  if (!extra) return DEMO
  const out = {}
  for (const k of Object.keys(DEMO)) out[k] = { ...DEMO[k], ...(extra[k] || {}) }
  return out
}

const STAGE_LABELS = {
  leadgen: ['Businesses found', 'Contacted', 'Replied', 'Meetings', 'Won'],
  quotes: ['Open quotes', 'Followed up', 'Replied', 'Site visits', 'Orders won'],
  booking: ['Enquiries', 'Invited', 'Replied', 'Booked', 'Attended'],
}

const DEMO_FROM = {
  leadgen: 'sales@gulffacility.example',
  quotes: 'sales@crescentsigns.example',
  booking: 'Clinic WhatsApp +968 9000 0200',
}

const DEMO_TYPE_LABEL = { leadgen: 'Lead generation', quotes: 'Quote follow-up', booking: 'Booking' }
const RADIUS_OPTIONS = [0, 10, 20, 40, 60, 80, 100]
const RADIUS_TOWNS = {
  10: 'Ghala and Azaiba', 20: 'Seeb and Al Mawaleh', 40: 'Al Khoud and Al Amerat',
  60: 'Barka and Al Amerat', 80: 'Quriyat and Samail', 100: 'Nakhal and Al Musanaah',
}

function fmtDate(value) {
  if (!value) return ''
  const d = new Date(value)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function timeAgo(value) {
  if (!value) return ''
  const mins = Math.round((Date.now() - new Date(value).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  return fmtDate(value)
}

function pct(part, whole) {
  if (!whole) return 0
  return Math.round((part / whole) * 100)
}

// Ask the browser for the viewer's location and turn it into an area name.
// Used on screen only; nothing about the location is saved.
async function detectArea() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null
  const pos = await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  })
  if (!pos) return null
  try {
    const { latitude, longitude } = pos.coords
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    )
    const d = await res.json()
    const area = d.locality || d.city || ''
    const city = d.city && d.city !== area ? d.city : d.principalSubdivision || ''
    const name = [area, city].filter(Boolean).join(', ')
    return name ? { area: area || city, label: name } : null
  } catch {
    return null
  }
}

function getDemoStep(leads, outreach) {
  if (leads.length === 0) return 1
  const has = (s) => outreach.some((o) => o.status === s)
  if (leads.some((l) => MEETING.includes(l.status))) return 7
  if (has('replied')) return 6
  if (has('draft')) return 3
  if (has('approved')) return 4
  if (has('sent')) return 5
  return 2
}

export default function Dashboard({
  isAdmin, userEmail, clients, demoClients = [], client, leads, outreach, followups, visitCounts, today, latestRun, events, sentTotal, firstSentAt,
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [anim, setAnim] = useState(null) // { steps: [], i: 0 }
  const [demoError, setDemoError] = useState('')
  const [emailFor, setEmailFor] = useState(null) // lead id, or 'all'
  const [place, setPlace] = useState(null) // { area, label } from the viewer's location, demo only
  const [radius, setRadius] = useState(client.search_radius_km || 0)
  const [reviewStep, setReviewStep] = useState(null) // a finished step the viewer tapped to look at again
  const [radiusNote, setRadiusNote] = useState('')

  const isDemo = client.is_demo
  const kind = client.demo_kind || 'leadgen'
  const DEMO = getDemo(isDemo ? kind : 'leadgen')
  const stageLabels = STAGE_LABELS[isDemo ? kind : 'leadgen']
  const demoStep = isDemo ? getDemoStep(leads, outreach) : null
  const show = (minStep) => !isDemo || demoStep >= minStep

  const liveRunning = latestRun?.status === 'running'
  const running = Boolean(anim) || liveRunning

  // Refresh every 15 s while a real run is live, so clients see progress
  useEffect(() => {
    if (!liveRunning) return
    const t = setInterval(() => router.refresh(), 15000)
    return () => clearInterval(t)
  }, [liveRunning, router])

  // Keep numbers fresh: refresh every 30 s while the tab is visible
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && !anim) router.refresh()
    }, 30000)
    return () => clearInterval(t)
  }, [router, anim])

  // In the demo, bring the section for the current step into view
  useEffect(() => {
    if (!isDemo || anim) return
    const id = DEMO[demoStep]?.target
    const el = id && document.getElementById(id)
    if (el && demoStep > 1) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [isDemo, demoStep, anim])

  async function runDemoStep() {
    const step = DEMO[demoStep]
    if (!step?.action) return
    setDemoError('')

    let steps = step.anim || []
    let here = place
    if (step.action === 'find' && kind === 'leadgen') {
      setAnim({ steps: ['Checking your location (allow it so the agent searches near you)'], i: 0 })
      here = await detectArea()
      if (here) setPlace(here)
      const area = here?.area || 'Muscat'
      steps = [
        'Reading your company profile',
        here ? `Your location: ${here.label}` : 'Location not shared, searching across Muscat',
        radius ? `Searching up to +${radius} km around ${area}` : `Searching business listings near ${area}`,
        'Searching nearby areas across Muscat',
        'Found 38 businesses, reading their customer reviews',
        '6 businesses matched, saving them to your leads',
      ]
    }

    for (let i = 0; i < steps.length; i++) {
      setAnim({ steps, i })
      await new Promise((r) => setTimeout(r, step.action === 'find' ? 2000 : 1600))
    }
    const res = await demoAction(step.action, client.id)
    if (!res?.error && step.action === 'find' && kind === 'leadgen' && here?.area) {
      await demoSetArea(here.area, client.id)
    }
    if (!res?.error && step.action === 'reset') setPlace(null)
    setAnim(null)
    if (res?.error) setDemoError(res.error)
    router.refresh()
  }

  async function changeRadius(km) {
    setRadius(km)
    setRadiusNote('')
    if (!isDemo) {
      const res = await setSearchRadius({ clientId: client.id, km })
      setRadiusNote(res?.error || (km === 0
        ? 'Saved. The agent will search nearby only.'
        : `Saved. The agent will search up to +${km} km in the next run.`))
      return
    }
    if (km === 0) return
    if (demoStep < 2) {
      setRadiusNote(`The agent will search up to +${km} km when you press Start agent.`)
      return
    }
    const base = place?.area || 'Muscat'
    const steps = [
      `Expanding search to +${km} km around ${base}`,
      `Scanning ${RADIUS_TOWNS[km]}`,
      'Reading reviews of the new businesses',
      'Found 2 more businesses, adding them to your leads',
    ]
    for (let i = 0; i < steps.length; i++) {
      setAnim({ steps, i })
      await new Promise((r) => setTimeout(r, 1700))
    }
    const res = await demoExpand(km, client.id)
    setAnim(null)
    if (res?.error) setRadiusNote(res.error)
    router.refresh()
  }

  const outreachByLead = useMemo(() => {
    const map = {}
    for (const o of outreach) (map[o.lead_id] ||= []).push(o)
    return map
  }, [outreach])

  const followupsByLead = useMemo(() => {
    const map = {}
    for (const f of followups) (map[f.lead_id] ||= []).push(f)
    return map
  }, [followups])

  const leadById = useMemo(() => Object.fromEntries(leads.map((l) => [l.id, l])), [leads])

  const active = leads.filter((l) => l.status !== 'skipped')
  const stages = [
    { key: 'found', label: stageLabels[0], count: active.length },
    { key: 'contacted', label: stageLabels[1], count: leads.filter((l) => CONTACTED.includes(l.status)).length },
    { key: 'replied', label: stageLabels[2], count: leads.filter((l) => REPLIED.includes(l.status)).length },
    { key: 'meeting', label: stageLabels[3], count: leads.filter((l) => MEETING.includes(l.status)).length },
    { key: 'won', label: stageLabels[4], count: leads.filter((l) => l.status === 'won').length },
  ]
  const messagesSent = outreach.filter((o) => ['sent', 'replied', 'no_reply'].includes(o.status)).length
  const dueFollowups = followups.filter((f) => !f.done && f.due_date && f.due_date <= today)
  const drafts = outreach.filter((o) => o.status === 'draft')
  const approved = outreach.filter((o) => o.status === 'approved')

  const statusCounts = useMemo(() => {
    const c = {}
    for (const l of leads) c[l.status] = (c[l.status] || 0) + 1
    return c
  }, [leads])

  const visibleLeads = leads.filter((l) => {
    if (filter !== 'all' && l.status !== filter) return false
    if (!query) return true
    const q = query.toLowerCase()
    return [l.business_name, l.area, l.category, l.ref_code].some((v) => v && v.toLowerCase().includes(q))
  })

  const lastContact = (leadId) => {
    const sent = (outreachByLead[leadId] || []).map((o) => o.sent_at).filter(Boolean).sort()
    return sent.length ? sent[sent.length - 1] : null
  }

  const openLead = openId ? leadById[openId] : null
  const viewStep = reviewStep ?? demoStep
  const focusOn = (id) => isDemo && !anim && DEMO[viewStep]?.target === id

  useEffect(() => { setReviewStep(null) }, [demoStep])

  function pickStep(n) {
    if (anim) return
    const next = n === demoStep || (demoStep === 7 && n === 7) ? null : n
    setReviewStep(next)
    const id = DEMO[n]?.target
    const el = id && document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">KS</span>
          <span className="brand-name">KS Tech Leads</span>
        </div>
        <div className="topbar-right">
          {isAdmin ? (
            <label className="client-switch">
              <span className="sr-only">Viewing company</span>
              <select value={client.slug} onChange={(e) => router.push(`/dashboard?client=${e.target.value}`)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </label>
          ) : demoClients.length > 1 ? (
            <DemoSwitch clients={demoClients} current={client.slug} />
          ) : (
            <span className="client-name">{client.name}</span>
          )}
          <ThemeToggle />
          {isAdmin && <Link href="/admin" className="btn btn-ghost">Users</Link>}
          <form action={signOut}>
            <button className="btn btn-ghost" type="submit" title={userEmail}>Sign out</button>
          </form>
        </div>
        <SentCounter key={`c-${client.id}`} total={sentTotal} firstSentAt={firstSentAt} />
        <StatusBadge key={client.id} isDemo={isDemo} />
      </header>

      <main className="content">
        {isDemo && (
          <DemoGuide
            config={DEMO}
            typeLabel={DEMO_TYPE_LABEL[kind]}
            step={demoStep}
            viewStep={viewStep}
            onPick={pickStep}
            busy={Boolean(anim)}
            onNext={runDemoStep}
            error={demoError}
            draftsLeft={drafts.length}
          />
        )}

        <AgentBar
          client={client}
          isAdmin={isAdmin}
          running={running}
          step={anim ? anim.steps[anim.i] : latestRun?.current_step}
          progress={anim ? (anim.i + 1) / anim.steps.length : null}
          latestRun={latestRun}
          place={isDemo ? place : null}
          radius={radius}
          radiusNote={radiusNote}
          onRadius={changeRadius}
          showRadius={!isDemo || kind === 'leadgen'}
          calm={!isDemo}
          focus={focusOn('sec-agent')}
        />

        {isDemo && viewStep === 1 && <DemoProfile kind={kind} name={client.name} description={client.description} place={place} radius={radius} />}

        {show(2) && (
          <SummaryBar
            outreach={outreach}
            leads={leads}
            dueCount={dueFollowups.length}
            draftCount={drafts.length}
            approvedCount={approved.length}
            today={today}
            labels={stageLabels}
          />
        )}

        {show(3) && (drafts.length > 0 || approved.length > 0 || isDemo) && (
          <Approvals
            drafts={drafts}
            approved={approved}
            leadById={leadById}
            isAdmin={isAdmin}
            onOpen={setOpenId}
            onApproveAll={() => setEmailFor('all')}
            isDemo={isDemo}
            focus={focusOn('sec-approvals')}
          />
        )}

        {show(2) && (
          <section id="sec-pipeline" className={focusOn('sec-pipeline') ? 'pipeline focus' : 'pipeline'} aria-label="Lead pipeline">
            <div className="pipeline-head">
              <div className="title-block">
                <h1>{client.name}</h1>
                {client.description && <p className="client-desc">{client.description}</p>}
              </div>
              <div className="pipeline-meta">
                <p className="muted">
                  {messagesSent} messages sent
                  {dueFollowups.length > 0 && <> and {dueFollowups.length} follow-up{dueFollowups.length === 1 ? '' : 's'} due</>}
                </p>
                <ReportButton
                  data={{ client, leads, outreach, followups, events, sentTotal, month: monthNumber(firstSentAt), today }}
                />
              </div>
            </div>
            <ol className="stages">
              {stages.map((s, i) => {
                const prev = i === 0 ? null : stages[i - 1].count
                return (
                  <li key={s.key} className="stage">
                    <span className="stage-count">{isDemo ? <AnimatedNumber value={s.count} /> : s.count}</span>
                    <span className="stage-label">{s.label}</span>
                    <span className="stage-track" aria-hidden="true">
                      <span className="stage-fill" style={{ width: `${Math.max(pct(s.count, stages[0].count), s.count ? 4 : 0)}%` }} />
                    </span>
                    {prev !== null && <span className="stage-rate">{pct(s.count, prev)}% of previous step</span>}
                  </li>
                )
              })}
            </ol>
          </section>
        )}

        {show(2) && (
          <div className="grid">
            <div className="side">
              <section id="sec-activity" className={focusOn('sec-activity') ? 'panel focus' : 'panel'} aria-label="Agent activity">
                <h2>Agent activity</h2>
                {events.length === 0 ? (
                  <p className="empty">The agent's work appears here: searches, drafts, approvals and replies.</p>
                ) : (
                  <ul className="timeline">
                    {events.map((e) => (
                      <li key={e.id} className={`tl tl-${e.kind}`}>
                        <span className="tl-dot" aria-hidden="true" />
                        <span className="tl-msg">{e.message}</span>
                        <span className="tl-time">{timeAgo(e.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {show(5) && (
                <section className="panel" aria-label="Follow-ups due">
                  <h2>Follow-ups due</h2>
                  {dueFollowups.length === 0 ? (
                    <p className="empty">Nothing due today. New follow-ups appear here on their due date.</p>
                  ) : (
                    <ul className="fu-list">
                      {dueFollowups.map((f) => {
                        const lead = leadById[f.lead_id]
                        const overdue = f.due_date < today
                        return (
                          <li key={f.id}>
                            <button className="fu-item" onClick={() => setOpenId(f.lead_id)}>
                              <span className="fu-name">{lead?.business_name || 'Lead'}</span>
                              <span className={overdue ? 'fu-date overdue' : 'fu-date'}>
                                {overdue ? `Overdue since ${fmtDate(f.due_date)}` : 'Due today'}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )}
            </div>

            <div className="main-col">
              <section id="sec-leads" className={focusOn('sec-leads') ? 'panel leads focus' : 'panel leads'} aria-label="Leads">
                <div className="leads-head">
                  <h2>Leads <span className="count">{visibleLeads.length}</span></h2>
                  <div className="leads-tools">
                    <input type="search" placeholder="Search name, area, category" value={query}
                      onChange={(e) => setQuery(e.target.value)} aria-label="Search leads" />
                    <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status">
                      <option value="all">All statuses ({leads.length})</option>
                      {STATUS_ORDER.filter((s) => statusCounts[s]).map((s) => (
                        <option key={s} value={s}>{STATUS[s]} ({statusCounts[s]})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {visibleLeads.length === 0 ? (
                  <p className="empty">
                    {leads.length === 0
                      ? 'No leads yet. Your first researched businesses will appear here.'
                      : 'No leads match this search. Clear the search or pick another status.'}
                  </p>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th scope="col">Business</th>
                          <th scope="col">Why it fits</th>
                          <th scope="col">Status</th>
                          <th scope="col" className="num">Score</th>
                          <th scope="col">Last contact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLeads.map((l) => (
                          <tr key={l.id} onClick={() => setOpenId(l.id)} tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(l.id) }}>
                            <td>
                              <span className="biz">{l.business_name}</span>
                              <span className="sub">{l.area}{l.category ? `, ${l.category.replace(/_/g, ' ')}` : ''}</span>
                              <WhyLead lead={l} />
                            </td>
                            <td>{l.problem_found || <span className="sub">General fit</span>}</td>
                            <td><span className={`pill pill-${l.status}`}>{STATUS[l.status] || l.status}</span></td>
                            <td className="num">{l.score ?? ''}</td>
                            <td>{fmtDate(lastContact(l.id)) || <span className="sub">Not yet</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </main>

      {openLead && (
        <LeadPanel
          key={openLead.id}
          lead={openLead}
          isAdmin={isAdmin}
          outreach={outreachByLead[openLead.id] || []}
          followups={followupsByLead[openLead.id] || []}
          visits={visitCounts[openLead.ref_code] || 0}
          showVisits={isAdmin && client.slug === 'kstech'}
          isDemo={isDemo}
          onEmail={() => setEmailFor(openLead.id)}
          onClose={() => setOpenId(null)}
        />
      )}

      {emailFor && (
        <EmailScreen
          mode={emailFor === 'all' ? 'all' : 'single'}
          lead={emailFor === 'all' ? null : leadById[emailFor]}
          leadOutreach={emailFor === 'all' ? [] : outreachByLead[emailFor] || []}
          drafts={drafts}
          leadById={leadById}
          isDemo={isDemo}
          demoStep={demoStep}
          clientId={client.id}
          kind={kind}
          onClose={() => setEmailFor(null)}
          onRefresh={() => router.refresh()}
        />
      )}
    </div>
  )
}

function LiveBadge() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return (
    <span className={online ? 'live' : 'live live-off'} role="status" aria-label={online ? 'System live' : 'Offline'}>
      <span className="live-dot" aria-hidden="true" />
      {online ? 'Live' : 'Offline'}
    </span>
  )
}

// One-line answer to "is this working?", shown first
function SummaryBar({ outreach, leads, dueCount, draftCount, approvedCount, today, labels }) {
  const monthStart = new Date(today.slice(0, 7) + '-01')
  const inMonth = (d) => d && new Date(d) >= monthStart
  const sent = outreach.filter((o) => inMonth(o.sent_at)).length
  const replies = outreach.filter((o) => inMonth(o.replied_at)).length
  const meetings = leads.filter((l) => MEETING.includes(l.status) && inMonth(l.updated_at)).length
  const monthName = new Date(today).toLocaleDateString('en-GB', { month: 'long' })
  const actions = []
  if (draftCount) actions.push(`${draftCount} waiting for your approval`)
  if (approvedCount) actions.push(`${approvedCount} approved, not sent yet`)
  if (dueCount) actions.push(`${dueCount} follow-up${dueCount === 1 ? '' : 's'} due`)

  return (
    <section className="summary" aria-label="This month">
      <p className="summary-line">
        <span className="summary-month">{monthName}:</span>{' '}
        <strong>{sent}</strong> {sent === 1 ? 'message' : 'messages'} sent, <strong>{replies}</strong> {replies === 1 ? 'reply' : 'replies'},{' '}
        <strong>{meetings}</strong> {labels[3].toLowerCase()}
      </p>
      {actions.length > 0 ? (
        <p className="summary-action">
          <span className="summary-dot" aria-hidden="true" />
          Needs your action: {actions.join(', ')}
        </p>
      ) : (
        <p className="summary-ok">Nothing needs your action right now.</p>
      )}
    </section>
  )
}

// Light / dark switch, remembered on this device
function ThemeToggle() {
  const [theme, setTheme] = useState('dark')
  useEffect(() => {
    try { setTheme(localStorage.getItem('ks-theme') || 'dark') } catch {}
  }, [])
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('ks-theme', next) } catch {}
  }
  return (
    <button type="button" className="btn btn-ghost theme-btn" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
      )}
    </button>
  )
}

// Demo login: switch between the three demo companies
function DemoSwitch({ clients, current }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <label className="client-switch">
      <span className="sr-only">Demo type</span>
      <select value={current} disabled={pending}
        onChange={(e) => {
          const slug = e.target.value
          startTransition(async () => { await switchDemo(slug); router.refresh() })
        }}>
        {clients.map((c) => (
          <option key={c.id} value={c.slug}>{DEMO_TYPE_LABEL[c.demo_kind] || c.name}: {c.name.replace(' (Demo)', '')}</option>
        ))}
      </select>
    </label>
  )
}

// Month colours for the sent counter. Month 1 uses the default look,
// month 2 is blue, 3 brown, 4 green, then the list continues and loops after the last one.
const MONTH_COLORS = [
  null,          // month 1: default
  '#2563eb',     // 2 blue
  '#8b5a2b',     // 3 brown
  '#16a34a',     // 4 green
  '#7c3aed',     // 5 purple
  '#ea580c',     // 6 orange
  '#db2777',     // 7 pink
  '#0891b2',     // 8 cyan
  '#b91c1c',     // 9 red
  '#4d7c0f',     // 10 olive
  '#1e3a8a',     // 11 navy
  '#c026d3',     // 12 magenta
  '#b45309',     // 13 amber
  '#4338ca',     // 14 indigo
  '#e11d48',     // 15 rose
  '#047857',     // 16 emerald
  '#7f1d1d',     // 17 maroon
  '#0369a1',     // 18 ocean
  '#6b21a8',     // 19 plum
  '#a16207',     // 20 mustard
  '#be123c',     // 21 crimson
  '#0f766e',     // 22 teal
  '#9a3412',     // 23 copper
  '#475569',     // 24 slate
]

function monthNumber(firstSentAt) {
  if (!firstSentAt) return 1
  const start = new Date(firstSentAt)
  const now = new Date()
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  return Math.max(1, months + 1)
}

// Running total of emails sent for this company. Counts every email ever sent, never resets.
function SentCounter({ total, firstSentAt }) {
  const [shown, setShown] = useState(total)
  const [bump, setBump] = useState(false)
  const month = monthNumber(firstSentAt)
  const color = MONTH_COLORS[(month - 1) % MONTH_COLORS.length]

  useEffect(() => {
    if (total === shown) return
    if (total < shown) { setShown(total); return }
    setBump(true)
    let n = shown
    const step = Math.max(1, Math.ceil((total - shown) / 20))
    const t = setInterval(() => {
      n = Math.min(total, n + step)
      setShown(n)
      if (n >= total) { clearInterval(t); setTimeout(() => setBump(false), 600) }
    }, 50)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total])

  return (
    <span
      className={`sent-counter${bump ? ' bump' : ''}${color ? ' tinted' : ''}`}
      style={color ? { '--month-color': color } : undefined}
      title={`Total emails sent since the start. Month ${month}.`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="sent-icon">
        <path d="M3 6h18v12H3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M3 7l9 6 9-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <span className="sent-num">{shown.toLocaleString('en-US')}</span>
      <span className="sent-label">emails sent</span>
      <span className="sent-month">M{month}</span>
    </span>
  )
}

function ReportButton({ data }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function run() {
    setBusy(true)
    setError('')
    try {
      const { downloadReport } = await import('@/lib/report')
      await downloadReport(data)
    } catch {
      setError('Could not create the PDF. Try again.')
    }
    setBusy(false)
  }
  return (
    <span className="report-btn-wrap">
      <button className="btn btn-quiet" onClick={run} disabled={busy}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-icon">
          <path d="M12 3v12m0 0l-5-5m5 5l5-5M4 19h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {busy ? 'Creating PDF...' : 'Download report (PDF)'}
      </button>
      {error && <span className="error">{error}</span>}
    </span>
  )
}

// Top-right status light.
// Demo: starts red "AI agent offline", switches to green "AI agent activated" after 3 seconds.
// Both demo and real: turns red when the device loses internet (cable out, data off, Wi-Fi without internet)
// and green again as soon as the connection is back.
function StatusBadge({ isDemo }) {
  const [phase, setPhase] = useState(isDemo ? 'booting' : 'live')
  const [online, setOnline] = useState(true)

  useEffect(() => {
    if (!isDemo) return
    const t = setTimeout(() => setPhase('live'), 3000)
    return () => clearTimeout(t)
  }, [isDemo])

  useEffect(() => {
    let alive = true

    // Real check: ask the server every 8 seconds. Catches "Wi-Fi connected but no internet" too.
    async function ping() {
      if (!navigator.onLine) { if (alive) setOnline(false); return }
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 5000)
        await fetch(`/login?ping=${Date.now()}`, { method: 'HEAD', cache: 'no-store', signal: ctrl.signal })
        clearTimeout(timer)
        if (alive) setOnline(true)
      } catch {
        if (alive) setOnline(false)
      }
    }

    const goOffline = () => setOnline(false)
    const goOnline = () => ping()
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    ping()
    const interval = setInterval(ping, 8000)
    return () => {
      alive = false
      clearInterval(interval)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  const on = online && phase === 'live'
  const label = isDemo
    ? (on ? 'AI agent activated' : 'AI agent offline')
    : (online ? 'Live' : 'Offline')

  return (
    <span className={on ? 'status status-on' : 'status status-off'} role="status" aria-live="polite">
      <span className="status-dot" aria-hidden="true" />
      <span className="status-text">{label}</span>
    </span>
  )
}

function DemoGuide({ config: DEMO, typeLabel, step, viewStep, onPick, busy, onNext, error, draftsLeft }) {
  const reviewing = viewStep !== step
  const s = DEMO[viewStep]
  const current = Math.min(step, 6)
  return (
    <section className={reviewing ? 'guide guide-review' : 'guide'} aria-label="Demo guide">
      <ol className="guide-steps">
        {DEMO_STEPS.map((n) => {
          const reached = n <= step
          const cls = [
            n < step ? 'done' : '',
            n === current && step < 7 ? 'current' : '',
            n === viewStep ? 'viewing' : '',
          ].filter(Boolean).join(' ')
          return (
            <li key={n} className={cls}>
              <button
                type="button"
                className="guide-step-btn"
                onClick={() => onPick(n)}
                disabled={!reached || busy}
                aria-current={n === viewStep ? 'step' : undefined}
                title={reached ? `Show step ${n}: ${DEMO[n].label}` : 'Reach this step first'}
              >
                <span className="guide-num">{n}</span>
                <span className="guide-label">{DEMO[n].label}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <div className="guide-body">
        <div>
          <p className="guide-kicker">
            {reviewing
              ? `Looking back at step ${viewStep} of 6`
              : `${typeLabel} demo, ${step < 7 ? `step ${step} of 6` : 'complete'}`}
          </p>
          <h2>{s.title}</h2>
          <p className="guide-text">{s.text}</p>
          {!reviewing && step === 3 && (
            <p className="guide-hint">
              {draftsLeft} message{draftsLeft === 1 ? '' : 's'} left to review below.
            </p>
          )}
          {error && <p className="error">{error}</p>}
        </div>
        {reviewing ? (
          <button className="btn btn-quiet btn-lg" onClick={() => onPick(step)}>
            Back to {step < 7 ? `step ${step}` : 'the end'}
          </button>
        ) : s.button && (
          <button className={step === 7 ? 'btn btn-plain' : 'btn btn-brass btn-lg'} onClick={onNext} disabled={busy}>
            {busy ? 'Working...' : s.button}
          </button>
        )}
      </div>
    </section>
  )
}

const PROFILE = {
  leadgen: [
    ['Services', 'AC maintenance, cleaning, pest control, kitchen exhaust cleaning'],
    ['Ideal customers', 'Clinics, offices, business centres, restaurants, gyms, training centres'],
    ['Sends from', 'sales@gulffacility.example'],
    ['Per week', 'Up to 30 new businesses, emails only after your approval'],
  ],
  quotes: [
    ['Services', 'Shop signs, vehicle branding, menu boards, exhibition printing'],
    ['What the agent does', 'Tracks every quote request and follows up when a customer goes quiet'],
    ['Reads from', 'Enquiry email inbox, WhatsApp, your quote list'],
    ['Sends from', 'sales@crescentsigns.example'],
    ['Per week', 'Every open quote checked, follow-ups only after your approval'],
  ],
  booking: [
    ['Treatments', 'Check-ups, cleaning, whitening, braces'],
    ['What the agent does', 'Answers appointment enquiries and offers free times'],
    ['Reads from', 'WhatsApp, Instagram, website form, missed calls'],
    ['Sends from', 'Clinic WhatsApp'],
    ['Per week', 'Every enquiry answered the same day, messages only after your approval'],
  ],
}

function DemoProfile({ kind, name, description, place, radius }) {
  const rows = PROFILE[kind] || PROFILE.leadgen
  return (
    <section className="panel profile" aria-label="Company profile">
      <h2>{name}</h2>
      {description && <p className="client-desc">{description}</p>}
      <dl className="facts">
        {rows.map(([k, v]) => (
          <div key={k} className="fact-row"><dt>{k}</dt><dd>{v}</dd></div>
        ))}
        {kind === 'leadgen' && (
          <div className="fact-row">
            <dt>Areas</dt>
            <dd>{place ? `Near you (${place.label}), then ` : 'Near your location, then '}Al Khuwair, Ghubrah, Qurum, Bousher, Ghala, Ruwi{radius ? `, up to +${radius} km` : ''}</dd>
          </div>
        )}
      </dl>
    </section>
  )
}

// Live radar: rotating sweep, rings, and business "blips" that light up as the agent finds them.
const BLIPS = [
  [68, 30], [30, 38], [58, 66], [78, 55], [40, 22], [24, 62], [50, 44], [70, 78], [36, 80], [82, 36],
]

function Radar({ active, progress = null, size = 'md' }) {
  // how many blips to show: follows progress when known, otherwise cycles while active
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!active || progress !== null) return
    const t = setInterval(() => setTick((n) => (n + 1) % (BLIPS.length + 3)), 700)
    return () => clearInterval(t)
  }, [active, progress])
  const shown = !active ? 0 : progress !== null ? Math.round(progress * BLIPS.length) : Math.min(tick, BLIPS.length)

  return (
    <div className={`radar radar-${size}${active ? ' radar-on' : ''}`} aria-hidden="true">
      <span className="radar-ring r1" />
      <span className="radar-ring r2" />
      <span className="radar-ring r3" />
      <span className="radar-cross" />
      <span className="radar-sweep" />
      {BLIPS.map(([x, y], i) => (
        <span key={i} className={i < shown ? 'blip blip-on' : 'blip'} style={{ left: `${x}%`, top: `${y}%` }} />
      ))}
      <span className="radar-core" />
    </div>
  )
}

// Types text out letter by letter, like a live feed
function Typewriter({ text }) {
  const [out, setOut] = useState('')
  useEffect(() => {
    if (!text) { setOut(''); return }
    let i = 0
    setOut('')
    const t = setInterval(() => {
      i += 1
      setOut(text.slice(0, i))
      if (i >= text.length) clearInterval(t)
    }, 18)
    return () => clearInterval(t)
  }, [text])
  return (
    <>
      {out}
      <span className="caret" aria-hidden="true" />
    </>
  )
}

// Counts up from the previous value when a number changes
function AnimatedNumber({ value }) {
  const [shown, setShown] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const from = prev.current
    const to = value
    prev.current = value
    if (from === to) { setShown(to); return }
    const start = performance.now()
    const dur = 900
    let raf
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(from + (to - from) * eased))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{shown}</>
}

function AgentBar({ client, isAdmin, running, step, progress, latestRun, place, radius, radiusNote, onRadius, showRadius, calm, focus }) {
  const [text, setText] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function start() {
    setError('')
    startTransition(async () => {
      const res = await startAgentRun({ clientId: client.id, step: text })
      if (res?.error) setError(res.error)
      setText('')
    })
  }
  function finish() {
    setError('')
    startTransition(async () => {
      const res = await finishAgentRun({ runId: latestRun.id, clientId: client.id, summary: text })
      if (res?.error) setError(res.error)
      setText('')
    })
  }

  return (
    <section id="sec-agent" className={`agent${running ? ' agent-on' : ''}${focus ? ' focus' : ''}`} aria-live="polite">
      <Radar active={running} progress={progress} />
      <div className="agent-text">
        <p className="agent-state">
          <span className="agent-dot" aria-hidden="true" />
          {running ? 'AI agent is working' : 'AI agent is on standby'}
        </p>
        <p className="agent-step">
          {running
            ? (calm ? (step || 'Working on your leads') : <Typewriter text={step || 'Working on your leads'} />)
            : latestRun?.finished_at
              ? `Last run ${fmtDate(latestRun.finished_at)}: ${latestRun.summary || 'completed'}`
              : 'Ready to start'}
        </p>
        {showRadius && <div className="agent-place-row">
          <span className="agent-place">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="pin">
              <path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" fill="currentColor" />
              <circle cx="12" cy="10" r="2.6" fill="var(--bg)" />
            </svg>
            {place ? place.label : client.is_demo ? 'Your location' : 'Your service area'}
          </span>
          <label className="radius">
            <span className="sr-only">Search distance</span>
            <select value={radius} onChange={(e) => onRadius(Number(e.target.value))} disabled={running}>
              {RADIUS_OPTIONS.map((km) => (
                <option key={km} value={km}>{km === 0 ? 'Nearby' : `+${km} km`}</option>
              ))}
            </select>
          </label>
        </div>}
        {showRadius && radiusNote && <p className="radius-note">{radiusNote}</p>}
        {progress !== null && (
          <span className="agent-progress" aria-hidden="true">
            <span style={{ width: `${progress * 100}%` }} />
          </span>
        )}
      </div>

      {isAdmin && !client.is_demo && (
        <div className="agent-actions">
          <div className="agent-admin">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={running ? 'Summary, e.g. 12 leads found, 12 drafts' : 'What is the agent doing?'}
              aria-label={running ? 'Run summary' : 'Current step'}
            />
            {running ? (
              <button className="btn btn-brass" onClick={finish} disabled={pending}>Finish run</button>
            ) : (
              <button className="btn btn-brass" onClick={start} disabled={pending}>Start run</button>
            )}
            {error && <span className="error">{error}</span>}
          </div>
        </div>
      )}
    </section>
  )
}

function Approvals({ drafts, approved, leadById, isAdmin, onOpen, onApproveAll, isDemo, focus }) {

  return (
    <section id="sec-approvals" className={focus ? 'panel approvals focus' : 'panel approvals'} aria-label="Emails waiting for approval">
      <div className="panel-head">
        <h2>Waiting for your approval <span className="count">{drafts.length}</span></h2>
        {drafts.length > 1 && (
          <button className="btn btn-quiet" onClick={onApproveAll}>
            Approve all ({drafts.length})
          </button>
        )}
      </div>
      <p className="muted small">Nothing is sent until you approve it.</p>
      {drafts.length === 0 && approved.length === 0 ? (
        <p className="empty">No emails to review. When the agent writes new emails, they appear here before anything is sent.</p>
      ) : (
        <ul className="drafts">
          {drafts.map((o) => (
            <DraftCard key={o.id} o={o} lead={leadById[o.lead_id]} onOpen={onOpen} />
          ))}
        </ul>
      )}
      {approved.length > 0 && (
        <>
          <h3 className="approved-head">
            {isDemo || isAdmin ? 'Approved, ready to send' : 'Approved, waiting for you to send'}
            <span className="count-badge">{approved.length}</span>
          </h3>
          <ul className="approved-list">
            {approved.map((o) => (
              <ApprovedRow key={o.id} o={o} lead={leadById[o.lead_id]} isAdmin={isAdmin} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

const SOURCE_LABEL = {
  google_maps: 'Google Maps listing and customer reviews',
  kudos_center_list: 'Official KUDOS/IC3 testing centre list',
}

function whyText(lead) {
  if (lead.why_chosen) return lead.why_chosen
  const parts = []
  if (lead.problem_found) parts.push(`We spotted a clear need: ${lead.problem_found.toLowerCase()}.`)
  if (lead.problem_evidence) parts.push(`Evidence: ${lead.problem_evidence}.`)
  if (lead.suggested_service) parts.push(`Your service fits it directly: ${lead.suggested_service.toLowerCase()}.`)
  if (!parts.length) parts.push('This business matches your ideal customer type and service area.')
  return parts.join(' ')
}

function WhyLead({ lead, compact = false }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setOpen(false) } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  if (!lead) return null
  return (
    <>
      <button
        type="button"
        className={compact ? 'why-btn why-compact' : 'why-btn'}
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        aria-label={`Why ${lead.business_name} was chosen`}
      >
        <span className="why-q" aria-hidden="true">?</span>
        Why this lead?
      </button>
      {open && (
        <div className="overlay overlay-top overlay-why" onClick={(e) => { e.stopPropagation(); setOpen(false) }}>
          <div className="why-box" role="dialog" aria-modal="true" aria-label="Why this lead" onClick={(e) => e.stopPropagation()}>
            <p className="why-kicker">Why this lead</p>
            <h2>{lead.business_name}</h2>
            <p className="why-text">{whyText(lead)}</p>
            <dl className="facts why-facts">
              {lead.problem_found && (<><dt>Opportunity</dt><dd>{lead.problem_found}</dd></>)}
              {lead.problem_evidence && (<><dt>Evidence</dt><dd>{lead.problem_evidence}</dd></>)}
              {lead.suggested_service && (<><dt>Our offer</dt><dd>{lead.suggested_service}</dd></>)}
              {lead.score != null && (
                <>
                  <dt>Match score</dt>
                  <dd>
                    <span className="why-score">{lead.score}</span> / 10
                    <span className="why-meter" aria-hidden="true"><span style={{ width: `${lead.score * 10}%` }} /></span>
                  </dd>
                </>
              )}
              {(lead.area || lead.category) && (<><dt>Business</dt><dd>{[lead.category?.replace(/_/g, ' '), lead.area].filter(Boolean).join(', ')}</dd></>)}
              {lead.source && (<><dt>Found via</dt><dd>{SOURCE_LABEL[lead.source] || lead.source.replace(/_/g, ' ')}</dd></>)}
            </dl>
            <button className="btn btn-primary" onClick={() => setOpen(false)}>Got it</button>
          </div>
        </div>
      )}
    </>
  )
}

function DraftCard({ o, lead, onOpen }) {
  const [editing, setEditing] = useState(false)
  const [subject, setSubject] = useState(o.subject || '')
  const [body, setBody] = useState(o.message_draft || '')
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function review(action) {
    setError('')
    startTransition(async () => {
      const res = await reviewOutreach({
        id: o.id,
        action,
        message: editing ? body : null,
        subject: editing ? subject : null,
      })
      if (res?.error) setError(res.error)
    })
  }

  return (
    <li className="draft">
      <div className="draft-head">
        <span className="draft-title">
          <button className="link-btn" onClick={() => onOpen(o.lead_id)}>{lead?.business_name || 'Lead'}</button>
          <WhyLead lead={lead} compact />
        </span>
        <span className="sub">{CHANNEL[o.channel] || o.channel}{lead?.email && o.channel === 'email' ? ` to ${lead.email}` : ''}</span>
      </div>

      {editing ? (
        <div className="edit">
          {o.channel === 'email' && (
            <input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" placeholder="Subject" />
          )}
          <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Message" />
        </div>
      ) : (
        <>
          {o.subject && <p className="draft-subject">{o.subject}</p>}
          <p className={expanded ? 'draft-body' : 'draft-body clamp'}>{o.message_draft}</p>
          <button className="link-btn small" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show less' : 'Read full message'}
          </button>
        </>
      )}

      <div className="draft-actions">
        {editing ? (
          <>
            <button className="btn btn-primary" onClick={() => review('approve')} disabled={pending}>Save and approve</button>
            <button className="btn btn-plain" onClick={() => setEditing(false)} disabled={pending}>Cancel</button>
          </>
        ) : (
          <>
            <button className="btn btn-primary" onClick={() => review('approve')} disabled={pending}>
              {pending ? 'Saving...' : 'Approve'}
            </button>
            <button className="btn btn-quiet" onClick={() => setEditing(true)} disabled={pending}>Edit</button>
            <button className="btn btn-plain" onClick={() => review('reject')} disabled={pending}>Reject</button>
          </>
        )}
        {error && <span className="error">{error}</span>}
      </div>
    </li>
  )
}

function mailtoLink(lead, o) {
  const to = lead?.email || ''
  const params = []
  if (o.subject) params.push(`subject=${encodeURIComponent(o.subject)}`)
  if (o.message_draft) params.push(`body=${encodeURIComponent(o.message_draft)}`)
  return `mailto:${to}${params.length ? '?' + params.join('&') : ''}`
}

function ApprovedRow({ o, lead, isAdmin }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [opened, setOpened] = useState(false)

  function done(fn) {
    setError('')
    startTransition(async () => {
      const res = await fn({ id: o.id })
      if (res?.error) setError(res.error)
    })
  }

  return (
    <li className="approved-row">
      <span className="approved-info">
        <span className="biz">{lead?.business_name || 'Lead'}</span>
        <span className="sub">Approved {fmtDate(o.reviewed_at)}{o.subject ? `, ${o.subject}` : ''}</span>
      </span>
      <span className="approved-actions">
        {lead?.email ? (
          <a className="btn btn-quiet" href={mailtoLink(lead, o)} onClick={() => setOpened(true)}>
            Send from my email
          </a>
        ) : (
          <span className="sub">No email address for this lead</span>
        )}
        <button className={opened ? 'btn btn-primary' : 'btn btn-plain'} disabled={pending}
          onClick={() => done(isAdmin ? markSent : clientMarkSent)}>
          {pending ? 'Saving...' : "I've sent it"}
        </button>
      </span>
      {error && <span className="error">{error}</span>}
    </li>
  )
}

function LeadPanel({ lead, isAdmin, outreach, followups, visits, showVisits, isDemo, onEmail, onClose }) {
  const [status, setStatus] = useState(lead.status)
  const [notes, setNotes] = useState(lead.notes || '')
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function save() {
    setMessage('')
    startTransition(async () => {
      const res = await updateLead({ id: lead.id, status, notes })
      setMessage(res?.error || 'Saved')
    })
  }

  function toggleFollowup(f) {
    startTransition(async () => {
      await setFollowupDone({ id: f.id, done: !f.done })
    })
  }

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={lead.business_name} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <p className="sub">{lead.ref_code}{lead.area ? `, ${lead.area}` : ''}</p>
            <h2>{lead.business_name}</h2>
            <WhyLead lead={lead} />
          </div>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>

        <div className="drawer-body">
          <div className="contact-row">
            <button className="btn btn-primary" onClick={onEmail}>
              {outreach.some((o) => o.status === 'draft') ? 'Email: review draft' : 'Email'}
            </button>
            {!isDemo && lead.phone && <a className="btn btn-quiet" href={`tel:${lead.phone.replace(/\s/g, '')}`}>Call</a>}
            {!isDemo && lead.phone && <a className="btn btn-quiet" href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}
            {!isDemo && lead.google_maps_url && <a className="btn btn-quiet" href={lead.google_maps_url} target="_blank" rel="noreferrer">Map</a>}
            {!isDemo && lead.website && <a className="btn btn-quiet" href={lead.website} target="_blank" rel="noreferrer">Website</a>}
          </div>

          <dl className="facts">
            {lead.category && (<><dt>Type</dt><dd>{lead.category.replace(/_/g, ' ')}</dd></>)}
            {lead.phone && (<><dt>Phone</dt><dd>{lead.phone}</dd></>)}
            {lead.email && (<><dt>Email</dt><dd>{lead.email}</dd></>)}
            {lead.problem_found && (<><dt>Opportunity</dt><dd>{lead.problem_found}</dd></>)}
            {lead.problem_evidence && (<><dt>Evidence</dt><dd>{lead.problem_evidence}</dd></>)}
            {lead.suggested_service && (<><dt>Offer</dt><dd>{lead.suggested_service}</dd></>)}
            {lead.score != null && (<><dt>Score</dt><dd>{lead.score} / 10</dd></>)}
            {showVisits && (<><dt>Link opens</dt><dd>{visits}</dd></>)}
          </dl>

          <section className="drawer-section">
            <h3>Status and notes</h3>
            {isAdmin ? (
              <div className="edit">
                <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Lead status">
                  {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}
                </select>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes about this lead" aria-label="Notes" />
                <div className="edit-actions">
                  <button className="btn btn-primary" onClick={save} disabled={pending}>
                    {pending ? 'Saving...' : 'Save changes'}
                  </button>
                  {message && <span className={message === 'Saved' ? 'ok' : 'error'} role="status">{message}</span>}
                </div>
              </div>
            ) : (
              <>
                <p><span className={`pill pill-${lead.status}`}>{STATUS[lead.status] || lead.status}</span></p>
                {lead.notes && <p className="note">{lead.notes}</p>}
              </>
            )}
          </section>

          <section className="drawer-section">
            <h3>Messages</h3>
            {outreach.length === 0 ? (
              <p className="empty">No message sent yet.</p>
            ) : (
              <ul className="msgs">
                {outreach.map((o) => (
                  <li key={o.id} className="msg">
                    <p className="msg-meta">
                      {CHANNEL[o.channel] || o.channel}
                      {o.sent_at ? `, sent ${fmtDate(o.sent_at)}` : ', draft'}
                      {o.replied_at ? `, replied ${fmtDate(o.replied_at)}` : ''}
                    </p>
                    <p className="msg-text">{o.message_sent || o.message_draft}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="drawer-section">
            <h3>Follow-ups</h3>
            {followups.length === 0 ? (
              <p className="empty">No follow-ups scheduled.</p>
            ) : (
              <ul className="msgs">
                {followups.map((f) => (
                  <li key={f.id} className={f.done ? 'msg done' : 'msg'}>
                    <p className="msg-meta">
                      {f.done ? 'Done' : `Due ${fmtDate(f.due_date)}`}
                    </p>
                    {f.draft_message && <p className="msg-text">{f.draft_message}</p>}
                    {isAdmin && (
                      <button className="btn btn-quiet" onClick={() => toggleFollowup(f)} disabled={pending}>
                        {f.done ? 'Mark not done' : 'Mark done'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}


function EmailScreen({ mode, lead, leadOutreach, drafts, leadById, isDemo, demoStep, clientId, kind, onClose, onRefresh }) {
  const FROM_DEMO = DEMO_FROM[kind] || DEMO_FROM.leadgen
  const leadDraft = leadOutreach.find((o) => o.status === 'draft')
  const history = leadOutreach.filter((o) => o.status !== 'draft')
  const [view, setView] = useState(mode === 'all' ? 'all' : 'single')
  const [editing, setEditing] = useState(false)
  const [subject, setSubject] = useState(leadDraft?.subject || '')
  const [body, setBody] = useState(leadDraft?.message_draft || '')
  const [progress, setProgress] = useState({ done: 0, total: 0, names: [] })
  const [result, setResult] = useState(null) // { kind: 'sent' | 'approved' | 'rejected', names: [] }
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [writing, setWriting] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); if (!busy) onClose() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [busy, onClose])

  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  async function approveList(list, edits) {
    setError('')
    setBusy(true)
    const names = list.map((o) => leadById[o.lead_id]?.business_name || 'Lead')
    setView('sending')
    setProgress({ done: 0, total: list.length, names })

    // Save edits first (approves that one email)
    if (edits) {
      const res = await reviewOutreach({ id: list[0].id, action: 'approve', message: edits.body, subject: edits.subject })
      if (res?.error) { setError(res.error); setBusy(false); setView('single'); return }
    }

    if (isDemo) {
      for (let i = 0; i < list.length; i++) {
        await wait(900)
        setProgress({ done: i + 1, total: list.length, names })
      }
      const res = await demoSend(list.map((o) => o.id))
      if (res?.error) { setError(res.error); setBusy(false); setView('single'); return }
      setResult({ kind: 'sent', names })
    } else {
      for (let i = 0; i < list.length; i++) {
        if (!(edits && i === 0)) {
          const res = await reviewOutreach({ id: list[i].id, action: 'approve' })
          if (res?.error) { setError(res.error); break }
        }
        setProgress({ done: i + 1, total: list.length, names })
      }
      setResult({ kind: 'approved', names })
    }
    setBusy(false)
    setView('done')
    onRefresh()
  }

  async function reject() {
    setBusy(true)
    const res = await reviewOutreach({ id: leadDraft.id, action: 'reject' })
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    setResult({ kind: 'rejected', names: [lead.business_name] })
    setView('done')
    onRefresh()
  }

  async function askAgentToWrite() {
    setWriting(true)
    setError('')
    await wait(2500)
    const res = await demoAction('draft', clientId)
    setWriting(false)
    if (res?.error) setError(res.error)
    onClose()
    onRefresh()
  }

  return (
    <div className="overlay overlay-top" onClick={() => !busy && onClose()}>
      <div className="mail" role="dialog" aria-modal="true" aria-label="Email" onClick={(e) => e.stopPropagation()}>
        <div className="mail-head">
          <h2>
            {view === 'all' ? `Approve all emails (${drafts.length})`
              : view === 'sending' ? (isDemo ? 'Sending' : 'Approving')
              : view === 'done' ? 'Done'
              : `Email to ${lead?.business_name}`}
          </h2>
          <button className="btn btn-plain" onClick={onClose} disabled={busy}>Close</button>
        </div>

        {view === 'single' && (
          <div className="mail-body">
            {leadDraft ? (
              <>
                <div className="mail-top">
                  <p className="badge-wait">Waiting for your approval</p>
                  <WhyLead lead={lead} compact />
                </div>
                <dl className="mail-fields">
                  <dt>From</dt><dd>{isDemo ? FROM_DEMO : 'Your company email'}</dd>
                  <dt>To</dt><dd>{lead.email || lead.business_name}</dd>
                  <dt>Subject</dt>
                  <dd>
                    {editing
                      ? <input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />
                      : subject}
                  </dd>
                </dl>
                {editing
                  ? <textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Message" />
                  : <p className="mail-text">{body}</p>}
                {error && <p className="error">{error}</p>}
                <div className="mail-actions">
                  <button className="btn btn-brass btn-lg" disabled={busy}
                    onClick={() => approveList([leadDraft], editing ? { subject, body } : null)}>
                    {isDemo ? 'Approve and send' : 'Approve'}
                  </button>
                  {!editing && <button className="btn btn-quiet" onClick={() => setEditing(true)} disabled={busy}>Edit</button>}
                  {editing && <button className="btn btn-plain" onClick={() => { setEditing(false); setSubject(leadDraft.subject || ''); setBody(leadDraft.message_draft || '') }}>Cancel edit</button>}
                  <button className="btn btn-plain" onClick={reject} disabled={busy}>Reject</button>
                  {drafts.length > 1 && (
                    <button className="link-btn small push-right" onClick={() => setView('all')} disabled={busy}>
                      Approve all ({drafts.length})
                    </button>
                  )}
                </div>
              </>
            ) : history.length > 0 ? (
              <>
                {history.map((o) => (
                  <div key={o.id} className="mail-sent">
                    <p className={o.status === 'rejected' ? 'badge-reject' : 'badge-sent'}>
                      {o.status === 'rejected' ? 'Rejected'
                        : o.status === 'approved' ? 'Approved, waiting to be sent'
                        : o.status === 'replied' ? `Sent ${fmtDate(o.sent_at)}, replied ${fmtDate(o.replied_at)}`
                        : `Sent ${fmtDate(o.sent_at)}`}
                    </p>
                    {o.subject && <p className="draft-subject">{o.subject}</p>}
                    <p className="mail-text">{o.message_sent || o.message_draft}</p>
                  </div>
                ))}
              </>
            ) : (
              <div className="mail-empty">
                <p>The agent has not written a message for {lead?.business_name} yet.</p>
                {isDemo && demoStep === 2 && (
                  <button className="btn btn-brass btn-lg" onClick={askAgentToWrite} disabled={writing}>
                    {writing ? 'Writing messages...' : 'Ask the agent to write messages'}
                  </button>
                )}
                {error && <p className="error">{error}</p>}
              </div>
            )}
          </div>
        )}

        {view === 'all' && (
          <div className="mail-body">
            <p className="muted">Read through the emails, then approve them together.</p>
            <ul className="mail-list">
              {drafts.map((o) => (
                <li key={o.id}>
                  <details>
                    <summary>
                      <span className="biz">{leadById[o.lead_id]?.business_name}</span>
                      <span className="sub">{o.subject}</span>
                    </summary>
                    <p className="mail-text">{o.message_draft}</p>
                  </details>
                </li>
              ))}
            </ul>
            {error && <p className="error">{error}</p>}
            <div className="mail-actions">
              <button className="btn btn-brass btn-lg" disabled={busy || drafts.length === 0} onClick={() => approveList(drafts, null)}>
                {isDemo ? `Approve and send all ${drafts.length}` : `Approve all ${drafts.length}`}
              </button>
              {lead && <button className="btn btn-plain" onClick={() => setView('single')}>Back</button>}
            </div>
          </div>
        )}

        {view === 'sending' && (
          <div className="mail-body mail-center">
            <Radar active progress={progress.total ? progress.done / progress.total : null} size="lg" />
            <p className="mail-status">
              {isDemo ? `Sending from ${FROM_DEMO}` : 'Saving your approval'}
            </p>
            <ul className="send-list">
              {progress.names.map((n, i) => (
                <li key={n + i} className={i < progress.done ? 'ok-row' : ''}>
                  <span>{n}</span>
                  <span>{i < progress.done ? (isDemo ? 'Sent' : 'Approved') : 'Waiting'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {view === 'done' && result && (
          <div className="mail-body mail-center">
            <span className={result.kind === 'rejected' ? 'done-mark done-mark-muted' : 'done-mark'} aria-hidden="true">
              {result.kind === 'rejected' ? '×' : '✓'}
            </span>
            <p className="mail-status">
              {result.kind === 'sent' && `${result.names.length} email${result.names.length === 1 ? '' : 's'} sent`}
              {result.kind === 'approved' && `${result.names.length} email${result.names.length === 1 ? '' : 's'} approved`}
              {result.kind === 'rejected' && 'Email rejected'}
            </p>
            <p className="muted center">
              {result.kind === 'sent' && 'Replies will come to your inbox. The agent schedules a follow-up in 2 days for anyone who does not reply.'}
              {result.kind === 'approved' && 'Next step: send it from your own email. You will find it under "Approved, waiting for you to send" on your dashboard.'}
              {result.kind === 'rejected' && 'This email will not be sent. The agent will not contact this business unless you ask.'}
            </p>
            <button className="btn btn-primary" onClick={onClose}>Back to dashboard</button>
          </div>
        )}
      </div>
    </div>
  )
}
