'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
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
    text: 'We start by learning what you sell and who you want as customers. The agent uses this to search for the right businesses.',
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

function getDemoStep(leads, outreach) {
  if (leads.length === 0) return 1
  const has = (s) => outreach.some((o) => o.status === s)
  if (leads.some((l) => MEETING.includes(l.status))) return 7
  if (has('replied')) return 6
  if (has('sent')) return 5
  if (has('draft')) return 3
  if (has('approved')) return 4
  return 2
}

export default function Dashboard({
  isAdmin, userEmail, clients, client, leads, outreach, followups, visitCounts, today, latestRun, events,
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [anim, setAnim] = useState(null) // { steps: [], i: 0 }
  const [demoError, setDemoError] = useState('')

  const isDemo = client.is_demo
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
    const steps = step.anim || []
    for (let i = 0; i < steps.length; i++) {
      setAnim({ steps, i })
      await new Promise((r) => setTimeout(r, step.action === 'find' ? 2000 : 1600))
    }
    const res = await demoAction(step.action)
    setAnim(null)
    if (res?.error) setDemoError(res.error)
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
    { key: 'found', label: 'Businesses found', count: active.length },
    { key: 'contacted', label: 'Contacted', count: leads.filter((l) => CONTACTED.includes(l.status)).length },
    { key: 'replied', label: 'Replied', count: leads.filter((l) => REPLIED.includes(l.status)).length },
    { key: 'meeting', label: 'Meetings', count: leads.filter((l) => MEETING.includes(l.status)).length },
    { key: 'won', label: 'Won', count: leads.filter((l) => l.status === 'won').length },
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
  const focusOn = (id) => isDemo && !anim && DEMO[demoStep]?.target === id

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
          ) : (
            <span className="client-name">{client.name}</span>
          )}
          {isAdmin && <Link href="/admin" className="btn btn-ghost">Users</Link>}
          <form action={signOut}>
            <button className="btn btn-ghost" type="submit" title={userEmail}>Sign out</button>
          </form>
        </div>
      </header>

      <main className="content">
        {isDemo && (
          <DemoGuide
            step={demoStep}
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
          focus={focusOn('sec-agent')}
        />

        {isDemo && demoStep === 1 && <DemoProfile name={client.name} />}

        {show(2) && (
          <section id="sec-pipeline" className={focusOn('sec-pipeline') ? 'pipeline focus' : 'pipeline'} aria-label="Lead pipeline">
            <div className="pipeline-head">
              <h1>{client.name}</h1>
              <p className="muted">
                {messagesSent} messages sent
                {dueFollowups.length > 0 && <> and {dueFollowups.length} follow-up{dueFollowups.length === 1 ? '' : 's'} due</>}
              </p>
            </div>
            <ol className="stages">
              {stages.map((s, i) => {
                const prev = i === 0 ? null : stages[i - 1].count
                return (
                  <li key={s.key} className="stage">
                    <span className="stage-count">{s.count}</span>
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
              {show(3) && (
                <Approvals
                  drafts={drafts}
                  approved={approved}
                  leadById={leadById}
                  isAdmin={isAdmin}
                  onOpen={setOpenId}
                  focus={focusOn('sec-approvals')}
                />
              )}

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
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

function DemoGuide({ step, busy, onNext, error, draftsLeft }) {
  const s = DEMO[step]
  const current = Math.min(step, 6)
  return (
    <section className="guide" aria-label="Demo guide">
      <ol className="guide-steps">
        {DEMO_STEPS.map((n) => (
          <li key={n} className={n < step ? 'done' : n === current && step < 7 ? 'current' : ''}>
            <span className="guide-num">{n}</span>
            <span className="guide-label">{DEMO[n].label}</span>
          </li>
        ))}
      </ol>
      <div className="guide-body">
        <div>
          <p className="guide-kicker">{step < 7 ? `Step ${step} of 6` : 'Demo complete'}</p>
          <h2>{s.title}</h2>
          <p className="guide-text">{s.text}</p>
          {step === 3 && (
            <p className="guide-hint">
              {draftsLeft} email{draftsLeft === 1 ? '' : 's'} left to review below.
            </p>
          )}
          {error && <p className="error">{error}</p>}
        </div>
        {s.button && (
          <button className={step === 7 ? 'btn btn-plain' : 'btn btn-brass btn-lg'} onClick={onNext} disabled={busy}>
            {busy ? 'Working...' : s.button}
          </button>
        )}
      </div>
    </section>
  )
}

function DemoProfile({ name }) {
  return (
    <section className="panel profile" aria-label="Company profile">
      <h2>{name}</h2>
      <dl className="facts">
        <dt>Services</dt>
        <dd>AC maintenance, cleaning, pest control, kitchen exhaust cleaning</dd>
        <dt>Ideal customers</dt>
        <dd>Clinics, offices, business centres, restaurants, gyms, training centres</dd>
        <dt>Areas</dt>
        <dd>Al Khuwair, Ghubrah, Qurum, Bousher, Ghala, Ruwi</dd>
        <dt>Sends from</dt>
        <dd>sales@gulffacility.example</dd>
        <dt>Per week</dt>
        <dd>Up to 30 new businesses, emails only after your approval</dd>
      </dl>
    </section>
  )
}

function Gears({ spinning }) {
  const big = Array.from({ length: 10 }, (_, i) => i * 36)
  const small = Array.from({ length: 7 }, (_, i) => i * (360 / 7))
  return (
    <svg className={spinning ? 'gears spinning' : 'gears'} viewBox="0 0 96 72" aria-hidden="true">
      <g className="gear-big">
        {big.map((a) => (
          <rect key={a} x="33" y="6" width="8" height="10" rx="2" transform={`rotate(${a} 37 36)`} />
        ))}
        <circle cx="37" cy="36" r="22" />
        <circle cx="37" cy="36" r="8" className="gear-hole" />
      </g>
      <g className="gear-small">
        {small.map((a) => (
          <rect key={a} x="72.5" y="5" width="7" height="8" rx="2" transform={`rotate(${a} 76 20)`} />
        ))}
        <circle cx="76" cy="20" r="11" />
        <circle cx="76" cy="20" r="4" className="gear-hole" />
      </g>
    </svg>
  )
}

function AgentBar({ client, isAdmin, running, step, progress, latestRun, focus }) {
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
      <Gears spinning={running} />
      <div className="agent-text">
        <p className="agent-state">
          <span className="agent-dot" aria-hidden="true" />
          {running ? 'AI agent is working' : 'AI agent is on standby'}
        </p>
        <p className="agent-step">
          {running
            ? step || 'Working on your leads'
            : latestRun?.finished_at
              ? `Last run ${fmtDate(latestRun.finished_at)}: ${latestRun.summary || 'completed'}`
              : 'Ready to start'}
        </p>
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

function Approvals({ drafts, approved, leadById, isAdmin, onOpen, focus }) {
  const [pending, startTransition] = useTransition()

  function approveAll() {
    startTransition(async () => {
      for (const o of drafts) {
        await reviewOutreach({ id: o.id, action: 'approve' })
      }
    })
  }

  return (
    <section id="sec-approvals" className={focus ? 'panel approvals focus' : 'panel approvals'} aria-label="Emails waiting for approval">
      <div className="panel-head">
        <h2>Waiting for your approval <span className="count">{drafts.length}</span></h2>
        {drafts.length > 1 && (
          <button className="btn btn-quiet" onClick={approveAll} disabled={pending}>
            {pending ? 'Approving...' : 'Approve all'}
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
          <h3 className="approved-head">Approved, ready to send <span className="count">{approved.length}</span></h3>
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
        <button className="link-btn" onClick={() => onOpen(o.lead_id)}>{lead?.business_name || 'Lead'}</button>
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

function ApprovedRow({ o, lead, isAdmin }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  return (
    <li className="approved-row">
      <span>
        <span className="biz">{lead?.business_name || 'Lead'}</span>
        <span className="sub">Approved {fmtDate(o.reviewed_at)}{o.subject ? `, ${o.subject}` : ''}</span>
      </span>
      {isAdmin && (
        <button
          className="btn btn-quiet"
          disabled={pending}
          onClick={() => startTransition(async () => {
            const res = await markSent({ id: o.id })
            if (res?.error) setError(res.error)
          })}
        >
          {pending ? 'Saving...' : 'Mark sent'}
        </button>
      )}
      {error && <span className="error">{error}</span>}
    </li>
  )
}

function LeadPanel({ lead, isAdmin, outreach, followups, visits, showVisits, onClose }) {
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
          </div>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>

        <div className="drawer-body">
          <div className="contact-row">
            {lead.phone && <a className="btn btn-quiet" href={`tel:${lead.phone.replace(/\s/g, '')}`}>Call</a>}
            {lead.phone && <a className="btn btn-quiet" href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}
            {lead.email && <a className="btn btn-quiet" href={`mailto:${lead.email}`}>Email</a>}
            {lead.google_maps_url && <a className="btn btn-quiet" href={lead.google_maps_url} target="_blank" rel="noreferrer">Map</a>}
            {lead.website && <a className="btn btn-quiet" href={lead.website} target="_blank" rel="noreferrer">Website</a>}
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
