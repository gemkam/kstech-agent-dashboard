'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  updateLead,
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
  completeFollowup,
  setDoNotContact,
  clearDuplicate,
  saveMailboxSetup,
  setBaseArea,
  checkDuplicates,
  addLead,
  addDraft,
  setResult,
  addFoundLeads,
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
// Once a lead has replied or is closed, follow-ups stop
const CLOSED = ['replied', 'meeting', 'won', 'lost', 'skipped']
const FOLLOWUP_DAYS = 3
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
    text: 'The agent tracks who replies. Businesses that do not reply get a polite follow-up after three days.',
    button: 'Show 3 days later',
    action: 'replies',
    anim: ['Three days later', 'Checking replies'],
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
    5: { title: 'Waiting for customers to reply', text: 'The agent tracks who replies. Customers who stay quiet get one more polite reminder after three days.' },
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
    5: { title: 'Waiting for replies', text: 'The agent tracks who replies. People who stay quiet get one friendly reminder after three days.' },
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
const SERVICE_KEYS = ['leadgen', 'quotes', 'booking']
const LANG_LABEL = { en: 'English', ar: 'Arabic', ur: 'Urdu' }
const RTL = ['ar', 'ur']

// Admin company list: demo companies are named by the service they show
function companyLabel(c) {
  if (!c.is_demo) return c.name
  return `Demo: ${DEMO_TYPE_LABEL[c.demo_kind] || 'Lead generation'}`
}

// When a lead has the same message in several languages, keep one per lead (English first)
function onePerLead(list) {
  const pick = {}
  for (const o of list) {
    const cur = pick[o.lead_id]
    if (!cur || ((o.language || 'en') === 'en' && (cur.language || 'en') !== 'en')) pick[o.lead_id] = o
  }
  return list.filter((o) => pick[o.lead_id] === o)
}
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
    return name ? { area: area || city, label: name, lat: latitude, lon: longitude } : null
  } catch {
    const { latitude, longitude } = pos.coords
    return { area: 'Muscat', label: 'Your location', lat: latitude, lon: longitude }
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
  isAdmin, userEmail, clients, demoClients = [], client, leads: allLeads, outreach: allOutreach, followups: allFollowups,
  visitCounts, today, latestRun, events, sentTotal, firstSentAt, mailbox,
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
  const [adding, setAdding] = useState(false)
  const [live, setLive] = useState({ status: 'idle', items: [], where: '' }) // live map search results
  const lastSearch = useRef(null)

  const isDemo = client.is_demo
  const kind = client.demo_kind || 'leadgen'
  const services = SERVICE_KEYS.filter((k) => (client.services || ['leadgen']).includes(k))
  const [service, setService] = useState(services[0] || 'leadgen')

  // Real companies: show one service at a time (lead generation, quote follow-up, booking)
  const leads = useMemo(
    () => (isDemo ? allLeads : allLeads.filter((l) => (l.service || 'leadgen') === service)),
    [allLeads, isDemo, service]
  )
  const shownIds = useMemo(() => new Set(leads.map((l) => l.id)), [leads])
  const outreach = useMemo(() => allOutreach.filter((o) => shownIds.has(o.lead_id)), [allOutreach, shownIds])
  const followups = useMemo(() => allFollowups.filter((f) => shownIds.has(f.lead_id)), [allFollowups, shownIds])
  const serviceCounts = useMemo(() => {
    const c = {}
    for (const l of allLeads) c[l.service || 'leadgen'] = (c[l.service || 'leadgen'] || 0) + 1
    return c
  }, [allLeads])

  const DEMO = getDemo(isDemo ? kind : 'leadgen')
  const stageLabels = STAGE_LABELS[isDemo ? kind : service]
  const demoStep = isDemo ? getDemoStep(leads, outreach) : null
  const show = (minStep) => !isDemo || demoStep >= minStep

  const liveRunning = latestRun?.status === 'running'
  const [searchStep, setSearchStep] = useState(null) // text shown while a live map search runs
  const running = Boolean(anim) || liveRunning || Boolean(searchStep)

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
    let livePromise = null
    if (step.action === 'find' && kind === 'leadgen') {
      setAnim({ steps: ['Checking your location (allow it so the agent searches near you)'], i: 0 })
      here = await detectArea()
      if (here) setPlace(here)
      const area = here?.area || 'Muscat'
      livePromise = runLiveSearch(here, radius)
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
    if (livePromise) {
      const found = await livePromise
      setAnim({ steps: [found > 0 ? `${found} real businesses found near you, showing them live` : 'Live search finished'], i: 0 })
      await new Promise((r) => setTimeout(r, 1400))
    }
    const res = await demoAction(step.action, client.id)
    if (!res?.error && step.action === 'find' && kind === 'leadgen' && here?.area) {
      await demoSetArea(here.area, client.id)
    }
    if (!res?.error && step.action === 'reset') { setPlace(null); setLive({ status: 'idle', items: [], where: '' }) }
    setAnim(null)
    if (res?.error) setDemoError(res.error)
    router.refresh()
  }

  // Real search of public map listings (OpenStreetMap). Demo: shown only. Admin: pick results to save as leads.
  // text: optional, e.g. "find clinics near Al Khuwair +10 km". here: a known point (demo location).
  async function runLiveSearch(here, km, text = '', preset = null) {
    const lib = await import('@/lib/liveSearch')
    const q = lib.parseQuery(text)
    if (preset) Object.assign(q, lib.presetFor(preset.labels, preset.custom), { everything: false, cuisine: null })
    const dist = q.km ?? km ?? 0
    if (q.km != null && RADIUS_OPTIONS.includes(q.km)) setRadius(q.km)
    setLive({ status: 'loading', items: [], where: q.place || here?.label || client.base_area || 'your area', label: q.label, km: dist })

    setSearchStep(q.place ? `Finding ${q.place} on the map` : 'Finding your area on the map')
    let runId = null
    const realRun = isAdmin && !isDemo
    if (realRun) {
      const r = await startAgentRun({ clientId: client.id, step: `${DEMO_TYPE_LABEL[service]}: searching ${q.label}${q.place ? ` near ${q.place}` : ''}${dist ? ` (+${dist} km)` : ''}` })
      runId = r?.runId || null
      router.refresh()
    }
    const finish = async (summary) => {
      if (realRun && runId) { await finishAgentRun({ runId, clientId: client.id, summary }); router.refresh() }
    }

    try {
      let point = null
      if (q.place) {
        point = await lib.geocode(q.place)
        if (!point) {
          setLive({ status: 'noplace', items: [], where: q.place, label: q.label, km: dist })
          await finish(`Place "${q.place}" not found on the map`)
          setSearchStep(null)
          return 0
        }
      } else if (here?.lat != null) {
        point = here
      } else if (!isDemo && client.base_area) {
        point = await lib.geocode(client.base_area)
      }
      if (!point) {
        const mine = await detectArea()
        point = mine?.lat != null ? mine : null
      }
      const fallback = !point
      if (fallback) point = { lat: 23.5880, lon: 58.4060, label: 'Al Khuwair, Muscat' }
      const where = fallback ? 'Al Khuwair, Muscat (location not shared)' : point.label

      setSearchStep(`Searching ${q.label} near ${point.label}${dist ? ` (+${dist} km)` : ''}`)
      const items = await lib.searchNearby({
        lat: point.lat, lon: point.lon, km: dist, sel: q.sel, cuisine: q.cuisine, max: q.everything ? 120 : 60, custom: q.custom || [],
        onProgress: (done, total) => {
          if (total > 1 && done < total) setSearchStep(`Searching ${q.label} near ${point.label}: part ${done + 1} of ${total}`)
        },
      })
      setSearchStep(`Found ${items.length} ${q.label}, sorting best matches first`)
      setLive({ status: 'done', items, where, label: q.label, km: dist, near: point.label, partial: items.partial })
      await finish(`Found ${items.length} ${q.label} near ${point.label}${dist ? ` (+${dist} km)` : ''}`)
      setSearchStep(null)
      return items.length
    } catch (e) {
      setLive((l) => ({ ...l, status: 'error', items: [], detail: String(e?.message || '').slice(0, 160) }))
      await finish('Search stopped: the map service did not answer')
      setSearchStep(null)
      return 0
    }
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
    if (kind === 'leadgen' && demoStep >= 2 && live.status !== 'idle') runLiveSearch(place, km)
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
  const followupOpen = (f) => {
    const l = leadById[f.lead_id]
    return !f.done && f.due_date && (!l || (!l.do_not_contact && !CLOSED.includes(l.status)))
  }
  const dueFollowups = followups.filter((f) => followupOpen(f) && f.due_date <= today)
  const dueLeadIds = new Set(dueFollowups.map((f) => f.lead_id))
  const dncCount = leads.filter((l) => l.do_not_contact).length
  const dupCount = leads.filter((l) => l.duplicate_of).length
  const setup = mailboxProgress(mailbox)
  const drafts = outreach.filter((o) => o.status === 'draft')
  const approved = outreach.filter((o) => o.status === 'approved')

  const statusCounts = useMemo(() => {
    const c = {}
    for (const l of leads) c[l.status] = (c[l.status] || 0) + 1
    return c
  }, [leads])

  const visibleLeads = leads.filter((l) => {
    if (filter === 'dnc') { if (!l.do_not_contact) return false }
    else if (filter === 'dup') { if (!l.duplicate_of) return false }
    else if (filter === 'due') { if (!dueLeadIds.has(l.id)) return false }
    else if (filter !== 'all' && l.status !== filter) return false
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
                {[...clients.filter((c) => !c.is_demo), ...clients.filter((c) => c.is_demo)
                  .sort((x, y) => SERVICE_KEYS.indexOf(x.demo_kind) - SERVICE_KEYS.indexOf(y.demo_kind))].map((c) => (
                  <option key={c.id} value={c.slug}>{companyLabel(c)}</option>
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
          {!isDemo && <Link href="/account" className="btn btn-ghost" title="Change password">Account</Link>}
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

        {!isDemo && services.length > 1 && (
          <ServiceTabs services={services} current={service} counts={serviceCounts}
            onPick={(s) => { setService(s); setFilter('all'); setOpenId(null) }} />
        )}

        <AgentBar
          client={client}
          service={isDemo ? kind : service}
          isAdmin={isAdmin}
          running={running}
          step={anim ? anim.steps[anim.i] : searchStep || latestRun?.current_step}
          progress={anim ? (anim.i + 1) / anim.steps.length : null}
          latestRun={latestRun}
          place={isDemo ? place : null}
          radius={radius}
          radiusNote={radiusNote}
          onRadius={changeRadius}
          showRadius={!isDemo || kind === 'leadgen'}
          isDemo={isDemo}
          canSearch={(isAdmin && !isDemo) || (isDemo && kind === 'leadgen' && demoStep >= 2)}
          searching={live.status === 'loading'}
          onSearch={(text, preset) => { lastSearch.current = { text, preset }; return runLiveSearch(place, radius, text, preset) }}
          calm={!isDemo}
          focus={focusOn('sec-agent')}
        />

        {isDemo && demoStep === 7 && !anim && <DemoPrices kind={kind} />}

        {isDemo && viewStep === 1 && <DemoProfile kind={kind} name={client.name} description={client.description} place={place} radius={radius} />}

        {!isDemo && !setup.complete && (
          <a href="#sec-mailbox" className="setup-banner" role="status">
            <span className="setup-banner-dot" aria-hidden="true" />
            <span>
              <strong>Email setup {setup.done} of {setup.total} done.</strong>{' '}
              Until it is finished, emails may land in spam. {isAdmin ? 'Finish the checklist.' : 'KS Tech is completing it with you.'}
            </span>
          </a>
        )}

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

        {((isDemo && kind === 'leadgen' && show(2)) || (!isDemo && isAdmin)) && live.status !== 'idle' && (
          <LiveResults live={live} isDemo={isDemo} service={service} clientId={client.id}
            onRetry={() => runLiveSearch(place, radius, lastSearch.current?.text || '', lastSearch.current?.preset || null)}
            onClear={() => setLive({ status: 'idle', items: [], where: '' })}
            onSaved={() => router.refresh()} />
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

              <MailboxPanel key={`mb-${client.id}`} clientId={client.id} mailbox={mailbox} isAdmin={isAdmin} isDemo={isDemo} />

              {show(5) && (
                <section className="panel" aria-label="Follow-ups due">
                  <h2>Follow-ups due</h2>
                  {dueFollowups.length === 0 ? (
                    <p className="empty">Nothing due today. {FOLLOWUP_DAYS} days after an email is sent, a follow-up appears here if the business has not replied.</p>
                  ) : (
                    <ul className="fu-list">
                      {dueFollowups.map((f) => {
                        const lead = leadById[f.lead_id]
                        const overdue = f.due_date < today
                        return (
                          <li key={f.id} className="fu-row">
                            <button className="fu-item" onClick={() => setOpenId(f.lead_id)}>
                              <span className="fu-name">{lead?.business_name || 'Lead'}</span>
                              <span className={overdue ? 'fu-date overdue' : 'fu-date'}>
                                {overdue ? `Overdue since ${fmtDate(f.due_date)}` : 'Due today'}
                              </span>
                            </button>
                            {!isDemo && <FollowupDone id={f.id} />}
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
                    {isAdmin && !isDemo && !adding && (
                      <button className="btn btn-brass" onClick={() => setAdding(true)}>+ Add lead</button>
                    )}
                    <input type="search" placeholder="Search name, area, category" value={query}
                      onChange={(e) => setQuery(e.target.value)} aria-label="Search leads" />
                    <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status">
                      <option value="all">All statuses ({leads.length})</option>
                      {STATUS_ORDER.filter((s) => statusCounts[s]).map((s) => (
                        <option key={s} value={s}>{STATUS[s]} ({statusCounts[s]})</option>
                      ))}
                      {dueLeadIds.size > 0 && <option value="due">Follow-up due ({dueLeadIds.size})</option>}
                      {dupCount > 0 && <option value="dup">Possible duplicates ({dupCount})</option>}
                      {dncCount > 0 && <option value="dnc">Do not contact ({dncCount})</option>}
                    </select>
                  </div>
                </div>

                {adding && (
                  <AddLeadForm clientId={client.id} service={service} onOpenLead={setOpenId}
                    onDone={(id) => { setAdding(false); if (id) setOpenId(id) }} />
                )}

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
                            className={l.do_not_contact ? 'row-dnc' : undefined}
                            onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(l.id) }}>
                            <td>
                              <span className="biz">{l.business_name}</span>
                              <span className="sub">{l.area}{l.category ? `, ${l.category.replace(/_/g, ' ')}` : ''}</span>
                              <LeadTags lead={l} dueToday={dueLeadIds.has(l.id)} dupOf={l.duplicate_of ? leadById[l.duplicate_of] : null} isAdmin={isAdmin} />
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
          dupOf={openLead.duplicate_of ? leadById[openLead.duplicate_of] : null}
          onOpenLead={setOpenId}
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

function AgentBar({ client, service, isAdmin, isDemo, canSearch, searching, onSearch, running, step, progress, latestRun, place, radius, radiusNote, onRadius, showRadius, calm, focus }) {
  const router = useRouter()
  const [locating, setLocating] = useState(false)
  const [locNote, setLocNote] = useState('')

  async function useMyLocation() {
    setLocNote('')
    setLocating(true)
    const here = await detectArea()
    if (!here) {
      setLocating(false)
      setLocNote('Location not available. Allow location for this site in your browser, then try again.')
      return
    }
    const res = await setBaseArea({ clientId: client.id, area: here.label })
    setLocating(false)
    setLocNote(res?.error || `Nearby now means around ${here.label}.`)
    router.refresh()
  }
  const [text, setText] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function search() {
    setError('')
    const t = text.trim()
    if (!t) { setError('Type what to find, e.g. find clinics near Al Khuwair +10 km'); return }
    startTransition(async () => { await onSearch(t) })
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
            {place ? place.label : client.is_demo ? 'Your location' : client.base_area || 'Your service area'}
          </span>
          {!isDemo && (
            <button type="button" className="btn btn-plain loc-btn" onClick={useMyLocation} disabled={locating || running}>
              {locating ? 'Finding you...' : client.base_area ? 'Update location' : 'Use my location'}
            </button>
          )}
          <label className="radius">
            <span className="sr-only">Search distance</span>
            <select value={radius} onChange={(e) => onRadius(Number(e.target.value))} disabled={running && isDemo}>
              {RADIUS_OPTIONS.map((km) => (
                <option key={km} value={km}>{km === 0 ? 'Nearby' : `+${km} km`}</option>
              ))}
            </select>
          </label>
        </div>}
        {showRadius && radiusNote && <p className="radius-note">{radiusNote}</p>}
        {locNote && <p className="radius-note">{locNote}</p>}
        {progress !== null && (
          <span className="agent-progress" aria-hidden="true">
            <span style={{ width: `${progress * 100}%` }} />
          </span>
        )}
      </div>

      {canSearch && (
        <div className="agent-actions">
          <form className="agent-admin" onSubmit={(e) => { e.preventDefault(); if (!pending && !searching) search() }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. find clinics near Al Khuwair +10 km"
              aria-label="What should the agent find?"
              enterKeyHint="search"
            />
            <button type="submit" className="btn btn-brass" disabled={pending || searching}>{searching ? 'Searching...' : 'Search'}</button>
            {error && <span className="error">{error}</span>}
          </form>
          {isAdmin && !isDemo && running && !searching && (
            <button type="button" className="link-btn small" onClick={finish} disabled={pending}>Stop the old run</button>
          )}
        </div>
      )}

      {canSearch && isAdmin && !isDemo && (
        <SearchHelp
          area={(client.base_area || 'Al Khuwair').split(',')[0]}
          km={radius || 10}
          disabled={pending || searching}
          onPick={(q) => { setText(q); setError(''); startTransition(async () => { await onSearch(q) }) }}
          onPreset={(labels, custom, textLine) => { setText(textLine); setError(''); startTransition(async () => { await onSearch(textLine, { labels, custom }) }) }}
        />
      )}
    </section>
  )
}

function Approvals({ drafts, approved, leadById, isAdmin, onOpen, onApproveAll, isDemo, focus }) {

  return (
    <section id="sec-approvals" className={focus ? 'panel approvals focus' : 'panel approvals'} aria-label="Emails waiting for approval">
      <div className="panel-head">
        <h2>Waiting for your approval <span className="count">{drafts.length}</span></h2>
        {onePerLead(drafts).length > 1 && (
          <button className="btn btn-quiet" onClick={onApproveAll}>
            Approve all ({onePerLead(drafts).length})
          </button>
        )}
      </div>
      <p className="muted small">Nothing is sent until you approve it.{drafts.some((o) => o.language && o.language !== 'en') ? ' Where a message has two languages, approve the one you want; the other is cancelled.' : ''}</p>
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
        <span className="sub">
          {o.language && o.language !== 'en' && <span className="tag tag-lang">{LANG_LABEL[o.language] || o.language}</span>}{' '}
          {CHANNEL[o.channel] || o.channel}{lead?.email && o.channel === 'email' ? ` to ${lead.email}` : ''}
        </span>
      </div>

      {editing ? (
        <div className="edit">
          {o.channel === 'email' && (
            <input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" placeholder="Subject" />
          )}
          <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Message" dir={RTL.includes(o.language) ? 'rtl' : undefined} />
        </div>
      ) : (
        <>
          {o.subject && <p className="draft-subject">{o.subject}</p>}
          <p className={expanded ? 'draft-body' : 'draft-body clamp'} dir={RTL.includes(o.language) ? 'rtl' : undefined} lang={o.language || 'en'}>{o.message_draft}</p>
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

function whatsappLink(lead, o) {
  let num = String(lead.whatsapp || lead.phone || '').replace(/\D/g, '')
  if (num.length === 8) num = '968' + num
  return `https://wa.me/${num}?text=${encodeURIComponent(o.message_draft || '')}`
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
        {o.channel === 'whatsapp' && (lead?.whatsapp || lead?.phone) ? (
          <a className="btn btn-quiet" href={whatsappLink(lead, o)} target="_blank" rel="noreferrer" onClick={() => setOpened(true)}>
            Send on WhatsApp{o.language === 'ur' ? ' (Urdu)' : ''}
          </a>
        ) : lead?.email ? (
          <a className="btn btn-quiet" href={mailtoLink(lead, o)} onClick={() => setOpened(true)}>
            Send from my email
          </a>
        ) : (
          <span className="sub">No {o.channel === 'whatsapp' ? 'WhatsApp number' : 'email address'} for this lead</span>
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

function LeadPanel({ lead, isAdmin, outreach, followups, dupOf, onOpenLead, visits, showVisits, isDemo, onEmail, onClose }) {
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
      await completeFollowup({ id: f.id, done: !f.done })
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
          {lead.do_not_contact && (
            <p className="dnc-note" role="status">
              <strong>Do not contact.</strong> {lead.dnc_reason || 'Asked not to be contacted'}
              {lead.dnc_at ? ` (since ${fmtDate(lead.dnc_at)})` : ''}. No emails or follow-ups will be written for this business.
            </p>
          )}
          {dupOf && <DuplicateNote lead={lead} dupOf={dupOf} isAdmin={isAdmin} onOpenLead={onOpenLead} />}

          <div className="contact-row">
            {!lead.do_not_contact && (
              <button className="btn btn-primary" onClick={onEmail}>
                {outreach.some((o) => o.status === 'draft') ? 'Email: review draft' : 'Email'}
              </button>
            )}
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

          {!isDemo && !lead.do_not_contact && <ResultButtons lead={lead} />}

          {isAdmin && !isDemo && !lead.do_not_contact && <DraftForm lead={lead} />}

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
                      {o.language && o.language !== 'en' ? `, ${LANG_LABEL[o.language] || o.language}` : ''}
                      {o.sent_at ? `, sent ${fmtDate(o.sent_at)}` : o.status === 'rejected' ? ', cancelled' : ', draft'}
                      {o.replied_at ? `, replied ${fmtDate(o.replied_at)}` : ''}
                    </p>
                    <p className="msg-text" dir={RTL.includes(o.language) ? 'rtl' : undefined}>{o.message_sent || o.message_draft}</p>
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
                    {!isDemo && (
                      <button className="btn btn-quiet" onClick={() => toggleFollowup(f)} disabled={pending}>
                        {f.done ? 'Mark not done' : 'Mark done'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {!isDemo && <DncSection lead={lead} isAdmin={isAdmin} />}
        </div>
      </aside>
    </div>
  )
}

// Pilot and package prices shown at the end of the demo. Change the numbers here.
const PLANS = [
  { name: 'Starter', price: 'from 60 OMR', per: 'per month', points: ['1 service', 'Up to 40 businesses or enquiries a month', 'You approve every message', 'Monthly PDF report'] },
  { name: 'Growth', price: 'from 120 OMR', per: 'per month', featured: true, points: ['2 services', 'Up to 100 businesses or enquiries a month', 'Follow-ups handled for you', 'Weekly results'] },
  { name: 'Pro', price: 'from 200 OMR', per: 'per month', points: ['All 3 services', 'Up to 200 businesses or enquiries a month', 'English, Arabic and Urdu messages', 'Priority support'] },
]
const PILOT_TEXT = 'Good day Kamran, I saw the KS Tech agent demo and would like to start a pilot.'

function DemoPrices({ kind }) {
  return (
    <section className="panel prices" aria-label="Packages">
      <p className="guide-kicker">Ready to start?</p>
      <h2>Start with a one-month pilot</h2>
      <p className="muted">Setup from 30 OMR, 3-month minimum after the pilot. We guarantee the work gets done every week; the sales are yours to close.</p>
      <div className="plan-grid">
        {PLANS.map((p) => (
          <div key={p.name} className={p.featured ? 'plan plan-featured' : 'plan'}>
            {p.featured && <span className="plan-badge">Most chosen</span>}
            <h3>{p.name}</h3>
            <p className="plan-price">{p.price}</p>
            <p className="sub">{p.per}</p>
            <ul>{p.points.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        ))}
      </div>
      <div className="plan-cta">
        <a className="btn btn-brass btn-lg" href={`https://wa.me/96897312049?text=${encodeURIComponent(PILOT_TEXT)}`} target="_blank" rel="noreferrer">
          Start a pilot on WhatsApp
        </a>
        <a className="btn btn-quiet" href="tel:+96897312049">Call +968 9731 2049</a>
      </div>
    </section>
  )
}

const RESULTS = [
  { status: 'replied', label: 'They replied' },
  { status: 'meeting', label: 'Meeting booked' },
  { status: 'won', label: 'Won' },
  { status: 'lost', label: 'Not interested' },
]

function ResultButtons({ lead }) {
  const [pick, setPick] = useState(null)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const [pending, startTransition] = useTransition()
  const contacted = CONTACTED.includes(lead.status)

  function save() {
    setMsg('')
    startTransition(async () => {
      const res = await setResult({ id: lead.id, status: pick, note })
      if (res?.error) setMsg(res.error)
      else { setMsg('Saved'); setPick(null); setNote('') }
    })
  }

  return (
    <section className="drawer-section">
      <h3>What happened?</h3>
      {!contacted && <p className="muted small">Use these after the message is sent.</p>}
      <div className="result-row">
        {RESULTS.map((r) => (
          <button key={r.status} type="button"
            className={pick === r.status ? 'btn btn-primary' : lead.status === r.status ? 'btn btn-quiet is-current' : 'btn btn-plain'}
            onClick={() => { setPick(r.status); setMsg('') }} disabled={pending}>
            {r.label}
          </button>
        ))}
      </div>
      {pick && (
        <div className="edit">
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300}
            placeholder={pick === 'meeting' ? 'When, e.g. Tuesday 11am at their office' : 'Short note (optional)'} aria-label="Note" />
          <div className="edit-actions">
            <button className="btn btn-primary" onClick={save} disabled={pending}>{pending ? 'Saving...' : 'Save'}</button>
            <button className="btn btn-plain" onClick={() => setPick(null)} disabled={pending}>Cancel</button>
          </div>
        </div>
      )}
      {pick === 'lost' && <p className="muted small">If they asked you to stop contacting them, use "Do not contact" below instead.</p>}
      {msg && <p className={msg === 'Saved' ? 'ok' : 'error'} role="status">{msg}</p>}
    </section>
  )
}

function DraftForm({ lead }) {
  const hasPhone = Boolean(lead.whatsapp || lead.phone)
  const [open, setOpen] = useState(false)
  const [channel, setChannel] = useState(lead.email ? 'email' : hasPhone ? 'whatsapp' : 'email')
  const [language, setLanguage] = useState('en')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [msg, setMsg] = useState('')
  const [pending, startTransition] = useTransition()

  function save() {
    setMsg('')
    startTransition(async () => {
      const res = await addDraft({ leadId: lead.id, channel, language, subject, message })
      if (res?.error) setMsg(res.error)
      else { setMsg('Draft saved. It is waiting for approval.'); setMessage(''); setSubject(''); setOpen(false) }
    })
  }

  return (
    <section className="drawer-section">
      <h3>Write a message</h3>
      {!open ? (
        <>
          <button className="btn btn-quiet" onClick={() => { setOpen(true); setMsg('') }}>+ New draft</button>
          {msg && <p className="ok" role="status">{msg}</p>}
        </>
      ) : (
        <div className="edit">
          <div className="inline-fields">
            <select value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel">
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language">
              <option value="en">English</option>
              <option value="ar">Arabic</option>
              <option value="ur">Urdu</option>
            </select>
          </div>
          {channel === 'email' && (
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" maxLength={200} />
          )}
          <textarea rows={7} value={message} onChange={(e) => setMessage(e.target.value)} aria-label="Message"
            dir={RTL.includes(language) ? 'rtl' : undefined} placeholder="Good day. I'm Kamran Zia Siddiquee, owner of KS TECH LLC..." />
          {channel === 'email' && !lead.email && <p className="muted small">This lead has no email address yet. Add it before sending.</p>}
          {channel === 'whatsapp' && !hasPhone && <p className="muted small">This lead has no phone number yet.</p>}
          <div className="edit-actions">
            <button className="btn btn-primary" onClick={save} disabled={pending || !message.trim()}>
              {pending ? 'Saving...' : 'Save draft for approval'}
            </button>
            <button className="btn btn-plain" onClick={() => setOpen(false)} disabled={pending}>Cancel</button>
          </div>
          {msg && <p className="error" role="alert">{msg}</p>}
        </div>
      )}
    </section>
  )
}

const LEAD_FIELDS = [
  ['business_name', 'Business name *', 'text'],
  ['category', 'Type, e.g. restaurant, clinic', 'text'],
  ['area', 'Area, e.g. Al Khuwair', 'text'],
  ['phone', 'Phone', 'tel'],
  ['email', 'Email', 'email'],
  ['website', 'Website', 'url'],
  ['google_maps_url', 'Google Maps link', 'url'],
]

function AddLeadForm({ clientId, service, onDone, onOpenLead }) {
  const [f, setF] = useState({ source: 'google_maps', score: '7' })
  const [matches, setMatches] = useState(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setMatches(null) }

  function submit(force) {
    setError('')
    startTransition(async () => {
      if (!force) {
        const chk = await checkDuplicates({ clientId, name: f.business_name, phone: f.phone, email: f.email })
        if (chk?.matches?.length) { setMatches(chk.matches); return }
      }
      const res = await addLead({ ...f, clientId, service })
      if (res?.error) { setError(res.error); return }
      onDone(res.lead?.id)
    })
  }

  return (
    <div className="add-lead">
      <div className="panel-head">
        <h3>New lead: {DEMO_TYPE_LABEL[service]}</h3>
        <button className="btn btn-plain" onClick={() => onDone(null)} disabled={pending}>Cancel</button>
      </div>
      <div className="add-grid">
        {LEAD_FIELDS.map(([k, label, type]) => (
          <label key={k}>
            <span>{label}</span>
            <input type={type} value={f[k] || ''} onChange={set(k)} required={k === 'business_name'} />
          </label>
        ))}
        <label>
          <span>Found via</span>
          <select value={f.source} onChange={set('source')}>
            <option value="google_maps">Google Maps and reviews</option>
            <option value="instagram">Instagram</option>
            <option value="website">Their website</option>
            <option value="visit">In-person visit</option>
            <option value="referral">Referral</option>
          </select>
        </label>
        <label>
          <span>Match score (1 to 10)</span>
          <input type="number" min={1} max={10} value={f.score || ''} onChange={set('score')} />
        </label>
      </div>
      <div className="add-grid add-wide">
        <label><span>Problem spotted</span><input value={f.problem_found || ''} onChange={set('problem_found')} placeholder="e.g. Customers complain they cannot book online" /></label>
        <label><span>Evidence</span><input value={f.problem_evidence || ''} onChange={set('problem_evidence')} placeholder="e.g. 4 Google reviews mention no reply on WhatsApp" /></label>
        <label><span>What we offer them</span><input value={f.suggested_service || ''} onChange={set('suggested_service')} /></label>
        <label><span>Why this lead (shown to the client)</span><textarea rows={2} value={f.why_chosen || ''} onChange={set('why_chosen')} /></label>
      </div>

      {matches && (
        <div className="dup-note" role="alert">
          <p><strong>This may already be in your leads:</strong></p>
          <ul className="plain-list">
            {matches.map((m) => (
              <li key={m.id}>
                <button className="link-btn" onClick={() => onOpenLead(m.id)}>{m.ref_code}, {m.business_name}</button>
                {' '}<span className="sub">(same {m.matched_on}{m.do_not_contact ? ', on do-not-contact list' : ''})</span>
              </li>
            ))}
          </ul>
          <button className="btn btn-plain" onClick={() => submit(true)} disabled={pending}>It is a different business, add anyway</button>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {!matches && (
        <div className="edit-actions">
          <button className="btn btn-primary" onClick={() => submit(false)} disabled={pending || !f.business_name?.trim()}>
            {pending ? 'Checking...' : 'Add lead'}
          </button>
        </div>
      )}
    </div>
  )
}

function LiveResults({ live, isDemo, service, clientId, onRetry, onClear, onSaved }) {
  const [all, setAll] = useState(false)
  const [picked, setPicked] = useState({})
  const [withDrafts, setWithDrafts] = useState(true)
  const [msg, setMsg] = useState('')
  const [pending, startTransition] = useTransition()
  const items = all ? live.items : live.items.slice(0, 8)
  const pickedList = live.items.filter((b) => picked[b.id])

  // new results: pre-tick the strong matches
  useEffect(() => {
    const p = {}
    for (const b of live.items) if (b.score >= 8) p[b.id] = true
    setPicked(p)
    setMsg('')
  }, [live.items])

  function save() {
    setMsg('')
    startTransition(async () => {
      const res = await addFoundLeads({ clientId, service, items: pickedList, withDrafts, searchedNear: live.near || live.where })
      if (res?.error) { setMsg(res.error); return }
      setMsg(`Saved ${res.added} lead${res.added === 1 ? '' : 's'}${res.drafts ? ` and ${res.drafts} draft${res.drafts === 1 ? '' : 's'} for approval` : ''}${res.dup ? `. ${res.dup} look like duplicates, check the tags` : ''}.`)
      setPicked({})
      onSaved()
    })
  }

  const title = live.status === 'noplace' ? `"${live.where}" not found`
    : `Real ${live.label || 'businesses'} near ${live.where}`

  return (
    <section className="panel live-results" aria-label="Live search results">
      <div className="panel-head">
        <h2>
          <span className="live-pill"><span className="live-pill-dot" aria-hidden="true" />Live</span>{' '}
          {title}
        </h2>
        <span className="inline-fields">
          <button className="btn btn-plain" onClick={onRetry} disabled={live.status === 'loading'}>
            {live.status === 'loading' ? 'Searching...' : 'Search again'}
          </button>
          {!isDemo && <button className="btn btn-plain" onClick={onClear} disabled={live.status === 'loading'}>Close</button>}
        </span>
      </div>
      <p className="muted small">
        Found right now from public map listings{live.km ? ` up to ${live.km} km` : ' within about 2 km'}.{' '}
        {isDemo
          ? 'Shown for this demo only, nothing is saved. The 6 leads below are worked examples of what the agent does next.'
          : 'Tick the ones you want and save them as leads. Nothing is saved until you do.'}
      </p>

      {live.status === 'loading' && <p className="empty">Finding the place and searching map listings...</p>}
      {live.status === 'noplace' && (
        <p className="error">The map does not know that place name. Check the spelling, e.g. Al Khuwair, Qurum, Ghubrah, Bousher, Ruwi, Seeb, Al Mawaleh.</p>
      )}
      {live.status === 'error' && (
        <p className="error">
          The free map service did not answer. Wait about 30 seconds, then press "Search again".
          {live.detail && <span className="sub"> Details: {live.detail}</span>}
        </p>
      )}
      {live.status === 'done' && live.partial && <p className="muted small">Part of the search timed out, so a few niches may be missing. Search again to fill them in.</p>}
      {live.status === 'done' && live.items.length === 0 && (
        <p className="empty">No listed {live.label || 'businesses'} found here. Try a bigger distance, e.g. +20 km.</p>
      )}

      {live.items.length > 0 && (
        <>
          <ul className="live-list">
            {items.map((b) => (
              <li key={b.id} className={picked[b.id] ? 'live-item live-picked' : 'live-item'}>
                {!isDemo && (
                  <input type="checkbox" className="live-check" checked={Boolean(picked[b.id])}
                    onChange={(e) => setPicked({ ...picked, [b.id]: e.target.checked })} aria-label={`Select ${b.name}`} />
                )}
                <div className="live-main">
                  <a className="biz" href={b.mapUrl} target="_blank" rel="noreferrer">{b.name}</a>
                  <span className="sub">{b.type}{b.area ? `, ${b.area}` : ''}, {b.km < 1 ? `${Math.round(b.km * 1000)} m` : `${b.km.toFixed(1)} km`} away</span>
                  {isDemo
                    ? <span className="live-offer">Fit: {b.offer}</span>
                    : (b.phone || b.email) && <span className="live-offer">{[b.phone, b.email].filter(Boolean).join(', ')}</span>}
                  {b.gaps.length > 0 && (
                    <span className="tags">{b.gaps.map((g) => <span key={g} className="tag tag-due">{g}</span>)}</span>
                  )}
                </div>
                <span className="live-score" title="Match score">{b.score}<span className="sub">/10</span></span>
              </li>
            ))}
          </ul>
          {live.items.length > 8 && (
            <button className="link-btn small" onClick={() => setAll(!all)}>
              {all ? 'Show fewer' : `Show all ${live.items.length}`}
            </button>
          )}
        </>
      )}
      {!isDemo && live.items.length > 0 && (
        <div className="live-save">
          <label className="mb-check">
            <input type="checkbox" checked={withDrafts} onChange={(e) => setWithDrafts(e.target.checked)} />
            <span>Also write a first message for each (WhatsApp if a phone is listed, else email). You approve them before anything is sent.</span>
          </label>
          <div className="edit-actions">
            <button className="btn btn-brass" onClick={save} disabled={pending || pickedList.length === 0}>
              {pending ? 'Saving...' : `Save ${pickedList.length} as ${DEMO_TYPE_LABEL[service].toLowerCase()} leads`}
            </button>
            <button className="link-btn small" onClick={() => {
              const p = {}; for (const b of live.items) p[b.id] = true; setPicked(p)
            }}>Select all {live.items.length}</button>
          </div>
          {msg && <p className="ok" role="status">{msg}</p>}
        </div>
      )}
      <p className="fine">Map data: OpenStreetMap contributors.</p>
    </section>
  )
}

// Admin: example, one-tap niche searches, and a search for every niche at once
const NICHE_LIST = [
  'clinics', 'restaurants', 'cafes', 'gyms', 'schools', 'training centres', 'hotels', 'pharmacies',
  'car businesses', 'supermarkets', 'bakeries', "men's barbers", 'travel agencies', 'furniture and interiors',
  'printing and signage', 'real estate offices', 'offices', 'hospitals',
]

const MAX_NICHES = 4
const CUSTOM_KEY = 'ks-custom-niches'

function SearchHelp({ area, km, disabled, onPick, onPreset }) {
  const q = (what) => `find ${what} near ${area} +${km} km`
  const [custom, setCustom] = useState([]) // niches the admin added, remembered on this device
  const [picked, setPicked] = useState([])
  const [choice, setChoice] = useState('')
  const [newNiche, setNewNiche] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    try { setCustom(JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]')) } catch {}
  }, [])
  function saveCustom(list) {
    setCustom(list)
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)) } catch {}
  }

  function add(n) {
    setNote('')
    if (!n || picked.includes(n)) return
    if (picked.length >= MAX_NICHES) { setNote(`Up to ${MAX_NICHES} niches at a time.`); return }
    setPicked([...picked, n])
    setChoice('')
  }
  function addOwn(e) {
    e.preventDefault()
    const n = newNiche.trim().toLowerCase().slice(0, 30)
    if (!n) return
    if (!NICHE_LIST.includes(n) && !custom.includes(n)) saveCustom([...custom, n])
    setNewNiche('')
    add(n)
  }
  function search() {
    if (!picked.length) { setNote('Pick at least one niche from the list.'); return }
    const labels = picked.filter((n) => NICHE_LIST.includes(n))
    const own = picked.filter((n) => !NICHE_LIST.includes(n))
    onPreset(labels, own, q(picked.join(', ')))
  }

  return (
    <div className="search-help">
      <p className="sub">
        Example: <button type="button" className="link-btn small" disabled={disabled} onClick={() => onPick(q('clinics'))}>{q('clinics')}</button>
        {' '}You can also type a cuisine, e.g. "Pakistani restaurants".
      </p>

      <div className="niche-pick">
        <label className="niche-select">
          <span className="sr-only">Niche</span>
          <select value={choice} disabled={disabled || picked.length >= MAX_NICHES} onChange={(e) => add(e.target.value)}>
            <option value="">{picked.length >= MAX_NICHES ? `${MAX_NICHES} niches picked` : 'Choose a niche...'}</option>
            <optgroup label="Niches">
              {NICHE_LIST.filter((n) => !picked.includes(n)).map((n) => <option key={n} value={n}>{n}</option>)}
            </optgroup>
            {custom.filter((n) => !picked.includes(n)).length > 0 && (
              <optgroup label="Your own niches">
                {custom.filter((n) => !picked.includes(n)).map((n) => <option key={n} value={n}>{n}</option>)}
              </optgroup>
            )}
          </select>
        </label>
        <form className="niche-own" onSubmit={addOwn}>
          <input value={newNiche} onChange={(e) => setNewNiche(e.target.value)} placeholder="Add your own, e.g. curtains"
            aria-label="Add your own niche" maxLength={30} disabled={disabled} />
          <button type="submit" className="btn btn-plain" disabled={disabled || !newNiche.trim()}>+ Add</button>
        </form>
      </div>

      {picked.length > 0 && (
        <div className="niche-row" role="list" aria-label="Picked niches">
          {picked.map((n) => (
            <span key={n} className="chip chip-on" role="listitem">
              {n}
              <button type="button" className="chip-x" aria-label={`Remove ${n}`} disabled={disabled}
                onClick={() => { setPicked(picked.filter((x) => x !== n)); setNote('') }}>×</button>
            </span>
          ))}
          <span className="sub">{picked.length} of {MAX_NICHES}</span>
        </div>
      )}

      <div className="niche-actions">
        <button type="button" className="btn btn-brass" disabled={disabled || !picked.length} onClick={search}>
          {picked.length > 1 ? `Search these ${picked.length} niches` : 'Search this niche'}
        </button>
        <span className="sub">near {area} (+{km} km). Change the distance above.</span>
        {custom.length > 0 && (
          <button type="button" className="link-btn small push-right" disabled={disabled}
            onClick={() => { if (confirm('Remove your own niches from this list?')) saveCustom([]) }}>
            Clear my own niches
          </button>
        )}
      </div>
      {note && <p className="error">{note}</p>}
    </div>
  )
}

function ServiceTabs({ services, current, counts, onPick }) {
  return (
    <nav className="svc-tabs" aria-label="Service">
      {services.map((s) => (
        <button key={s} type="button" className={s === current ? 'svc-tab svc-on' : 'svc-tab'}
          aria-pressed={s === current} onClick={() => onPick(s)}>
          {DEMO_TYPE_LABEL[s]}
          <span className="svc-count">{counts[s] || 0}</span>
        </button>
      ))}
    </nav>
  )
}

// Small tags on a lead row: do not contact, possible duplicate, follow-up due, missing reason
function LeadTags({ lead, dueToday, dupOf, isAdmin }) {
  const tags = []
  if (lead.do_not_contact) tags.push(<span key="dnc" className="tag tag-dnc">Do not contact</span>)
  if (dupOf) tags.push(<span key="dup" className="tag tag-dup">Possible duplicate of {dupOf.ref_code || dupOf.business_name}</span>)
  if (dueToday && !lead.do_not_contact) tags.push(<span key="due" className="tag tag-due">Follow-up due</span>)
  if (isAdmin && !lead.why_chosen && !lead.problem_found) tags.push(<span key="why" className="tag tag-dup">No reason written</span>)
  if (!tags.length) return null
  return <span className="tags">{tags}</span>
}

function FollowupDone({ id }) {
  const [pending, startTransition] = useTransition()
  return (
    <button className="btn btn-plain fu-done" disabled={pending}
      onClick={() => startTransition(async () => { await completeFollowup({ id, done: true }) })}>
      {pending ? 'Saving...' : 'Done'}
    </button>
  )
}

function DuplicateNote({ lead, dupOf, isAdmin, onOpenLead }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  return (
    <div className="dup-note" role="status">
      <p>
        <strong>Possible duplicate.</strong> This looks like the same business as{' '}
        <button className="link-btn" onClick={() => onOpenLead(dupOf.id)}>
          {dupOf.ref_code ? `${dupOf.ref_code}, ` : ''}{dupOf.business_name}
        </button>{' '}
        ({STATUS[dupOf.status] || dupOf.status}). Check before contacting them again.
      </p>
      {isAdmin && (
        <button className="btn btn-plain" disabled={pending}
          onClick={() => startTransition(async () => {
            const res = await clearDuplicate({ id: lead.id })
            if (res?.error) setError(res.error)
          })}>
          Not a duplicate
        </button>
      )}
      {error && <span className="error">{error}</span>}
    </div>
  )
}

const DNC_REASONS = ['Asked us to stop', 'Not interested', 'Wrong contact person', 'Already a customer', 'Other']

function DncSection({ lead, isAdmin }) {
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState(DNC_REASONS[0])
  const [other, setOther] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function save(on) {
    setError('')
    startTransition(async () => {
      const text = reason === 'Other' ? other : reason
      const res = await setDoNotContact({ id: lead.id, on, reason: text })
      if (res?.error) setError(res.error)
      else setAsking(false)
    })
  }

  if (lead.do_not_contact) {
    return isAdmin ? (
      <section className="drawer-section">
        <h3>Do-not-contact list</h3>
        <p className="muted small">Only take a business off this list if they asked to hear from you again.</p>
        <button className="btn btn-plain" onClick={() => save(false)} disabled={pending}>
          {pending ? 'Saving...' : 'Remove from do-not-contact list'}
        </button>
        {error && <p className="error">{error}</p>}
      </section>
    ) : null
  }

  return (
    <section className="drawer-section">
      <h3>Do not contact</h3>
      {!asking ? (
        <>
          <p className="muted small">If this business said stop or not interested, add it here. Open drafts and follow-ups are cancelled and nobody will write to them again.</p>
          <button className="btn btn-plain btn-danger" onClick={() => setAsking(true)}>Do not contact this business</button>
        </>
      ) : (
        <div className="edit">
          <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason">
            {DNC_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {reason === 'Other' && (
            <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Short reason" aria-label="Other reason" maxLength={200} />
          )}
          <div className="edit-actions">
            <button className="btn btn-primary btn-danger-solid" onClick={() => save(true)} disabled={pending}>
              {pending ? 'Saving...' : 'Confirm: do not contact'}
            </button>
            <button className="btn btn-plain" onClick={() => setAsking(false)} disabled={pending}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  )
}

// Outreach mailbox checklist. Without SPF, DKIM and DMARC, emails go to spam.
const MAILBOX_STEPS = [
  { key: 'mailbox_created', label: 'Outreach mailbox created', help: 'A separate address on your own domain, for example sales@yourcompany.com, so your main email stays safe.' },
  { key: 'spf', label: 'SPF record added', help: 'A DNS record that tells inboxes which servers may send email for your domain.' },
  { key: 'dkim', label: 'DKIM signing turned on', help: 'Adds a digital signature to every email, switched on in your email provider and added to DNS.' },
  { key: 'dmarc', label: 'DMARC record added', help: 'A DNS record that tells inboxes what to do with emails that fail SPF or DKIM. Start with p=none.' },
  { key: 'test_passed', label: 'Test email reached the inbox', help: 'A test email sent to Gmail and Outlook arrived in the inbox, not in spam.' },
]

function mailboxProgress(m) {
  const done = MAILBOX_STEPS.filter((s) => m?.[s.key]).length
  return { done, total: MAILBOX_STEPS.length, complete: done === MAILBOX_STEPS.length }
}

function MailboxPanel({ clientId, mailbox, isAdmin, isDemo }) {
  const blank = { outreach_email: '', provider: '', notes: '', ...Object.fromEntries(MAILBOX_STEPS.map((s) => [s.key, false])) }
  const [form, setForm] = useState({ ...blank, ...(mailbox || {}) })
  const [editing, setEditing] = useState(false)
  const [msg, setMsg] = useState('')
  const [pending, startTransition] = useTransition()
  const m = editing ? form : { ...blank, ...(mailbox || {}) }
  const prog = mailboxProgress(m)
  const canEdit = isAdmin && !isDemo

  function save() {
    setMsg('')
    startTransition(async () => {
      const res = await saveMailboxSetup({ clientId, ...form })
      if (res?.error) setMsg(res.error)
      else { setMsg('Saved'); setEditing(false) }
    })
  }

  return (
    <section id="sec-mailbox" className="panel mailbox" aria-label="Email setup">
      <div className="panel-head">
        <h2>Email setup</h2>
        <span className={prog.complete ? 'tag tag-ok' : 'tag tag-due'}>{prog.done} of {prog.total}</span>
      </div>
      <span className="mb-track" aria-hidden="true"><span style={{ width: `${(prog.done / prog.total) * 100}%` }} /></span>
      {m.outreach_email && !editing && <p className="sub">Sends from {m.outreach_email}{m.provider ? `, ${m.provider}` : ''}</p>}

      {editing && (
        <div className="edit mb-fields">
          <input value={form.outreach_email || ''} onChange={(e) => setForm({ ...form, outreach_email: e.target.value })}
            placeholder="Outreach email, e.g. sales@company.com" aria-label="Outreach email" />
          <input value={form.provider || ''} onChange={(e) => setForm({ ...form, provider: e.target.value })}
            placeholder="Provider, e.g. Google Workspace, Zoho, Microsoft 365" aria-label="Email provider" />
        </div>
      )}

      <ul className="mb-list">
        {MAILBOX_STEPS.map((s) => (
          <li key={s.key} className={m[s.key] ? 'mb-item mb-done' : 'mb-item'}>
            {editing ? (
              <label className="mb-check">
                <input type="checkbox" checked={Boolean(form[s.key])} onChange={(e) => setForm({ ...form, [s.key]: e.target.checked })} />
                <span>{s.label}</span>
              </label>
            ) : (
              <span className="mb-check">
                <span className="mb-mark" aria-hidden="true">{m[s.key] ? '✓' : ''}</span>
                <span>{s.label}<span className="sr-only">{m[s.key] ? ', done' : ', not done'}</span></span>
              </span>
            )}
            {!m[s.key] && <span className="mb-help">{s.help}</span>}
          </li>
        ))}
      </ul>

      {editing && (
        <textarea rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Notes, e.g. waiting for client's IT to add DNS records" aria-label="Notes" />
      )}
      {!editing && m.notes && <p className="note small">{m.notes}</p>}

      {!prog.complete && !editing && !isAdmin && (
        <p className="muted small">KS Tech finishes these steps with you before the first emails go out.</p>
      )}

      {canEdit && (
        <div className="edit-actions">
          {editing ? (
            <>
              <button className="btn btn-primary" onClick={save} disabled={pending}>{pending ? 'Saving...' : 'Save'}</button>
              <button className="btn btn-plain" onClick={() => { setEditing(false); setForm({ ...blank, ...(mailbox || {}) }) }} disabled={pending}>Cancel</button>
            </>
          ) : (
            <button className="btn btn-quiet" onClick={() => setEditing(true)}>Update checklist</button>
          )}
          {msg && <span className={msg === 'Saved' ? 'ok' : 'error'} role="status">{msg}</span>}
        </div>
      )}
    </section>
  )
}


function EmailScreen({ mode, lead, leadOutreach, drafts, leadById, isDemo, demoStep, clientId, kind, onClose, onRefresh }) {
  const FROM_DEMO = DEMO_FROM[kind] || DEMO_FROM.leadgen
  const leadDrafts = leadOutreach.filter((o) => o.status === 'draft')
  const [lang, setLang] = useState(leadDrafts.find((o) => (o.language || 'en') === 'en') ? 'en' : leadDrafts[0]?.language || 'en')
  const leadDraft = leadDrafts.find((o) => (o.language || 'en') === lang) || leadDrafts[0]
  const history = leadOutreach.filter((o) => o.status !== 'draft')
  const allDrafts = onePerLead(drafts)
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
            {view === 'all' ? `Approve all messages (${allDrafts.length})`
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
                {leadDrafts.length > 1 && (
                  <div className="lang-switch" role="group" aria-label="Message language">
                    {leadDrafts.map((d) => {
                      const l = d.language || 'en'
                      return (
                        <button key={d.id} type="button" className={l === (leadDraft.language || 'en') ? 'btn btn-primary' : 'btn btn-plain'}
                          disabled={busy || editing}
                          onClick={() => { setLang(l); setSubject(d.subject || ''); setBody(d.message_draft || '') }}>
                          {LANG_LABEL[l] || l}
                        </button>
                      )
                    })}
                    <span className="sub">Approve one version; the other is cancelled.</span>
                  </div>
                )}
                <dl className="mail-fields">
                  <dt>From</dt><dd>{isDemo ? FROM_DEMO : leadDraft.channel === 'whatsapp' ? 'Your WhatsApp' : 'Your company email'}</dd>
                  <dt>To</dt><dd>{lead.email || lead.business_name}</dd>
                  <dt>Subject</dt>
                  <dd>
                    {editing
                      ? <input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />
                      : subject}
                  </dd>
                </dl>
                {editing
                  ? <textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Message" dir={RTL.includes(leadDraft.language) ? 'rtl' : undefined} />
                  : <p className="mail-text" dir={RTL.includes(leadDraft.language) ? 'rtl' : undefined}>{body}</p>}
                {error && <p className="error">{error}</p>}
                <div className="mail-actions">
                  <button className="btn btn-brass btn-lg" disabled={busy}
                    onClick={() => approveList([leadDraft], editing ? { subject, body } : null)}>
                    {isDemo ? 'Approve and send' : 'Approve'}
                  </button>
                  {!editing && <button className="btn btn-quiet" onClick={() => setEditing(true)} disabled={busy}>Edit</button>}
                  {editing && <button className="btn btn-plain" onClick={() => { setEditing(false); setSubject(leadDraft.subject || ''); setBody(leadDraft.message_draft || '') }}>Cancel edit</button>}
                  <button className="btn btn-plain" onClick={reject} disabled={busy}>Reject</button>
                  {allDrafts.length > 1 && (
                    <button className="link-btn small push-right" onClick={() => setView('all')} disabled={busy}>
                      Approve all ({allDrafts.length})
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
            <p className="muted">Read through the messages, then approve them together.{allDrafts.length < drafts.length ? ' Where a lead has two languages, the English version is used.' : ''}</p>
            <ul className="mail-list">
              {allDrafts.map((o) => (
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
              <button className="btn btn-brass btn-lg" disabled={busy || allDrafts.length === 0} onClick={() => approveList(allDrafts, null)}>
                {isDemo ? `Approve and send all ${allDrafts.length}` : `Approve all ${allDrafts.length}`}
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
              {result.kind === 'sent' && 'Replies will come to your inbox. The agent schedules a follow-up in 3 days for anyone who does not reply.'}
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
