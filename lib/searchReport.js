// PDFs for one search, made in the browser (loaded only when a button is pressed).
// 1. downloadSearchResults: every business a live search found, with phone, WhatsApp, email, website.
// 2. downloadSearchReport: what happened to the leads saved from one search (sent, replied, no reply), with charts.

const DEEP = [11, 49, 57]
const SEA = [15, 76, 85]
const GOLD = [191, 151, 72]
const INK = [23, 38, 43]
const SLATE = [104, 122, 127]
const HAIR = [226, 232, 233]
const PALETTE = [[15, 76, 85], [191, 151, 72], [47, 122, 85], [164, 71, 58], [110, 140, 200], [150, 110, 170], [120, 160, 150], [200, 140, 90]]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const day = (v) => { const x = v ? new Date(v) : new Date(); return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}` }
// Standard PDF fonts only draw Latin text; Arabic names are shown with their English name if there is one
const safe = (t) => String(t ?? '').replace(/[^\x20-\x7E -ÿ\n]/g, '').replace(/\s+/g, ' ').trim()
const fileName = (t) => safe(t).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'search'

// Oman mobiles (WhatsApp) are 8 digits starting with 7 or 9
export function whatsappOf(phone) {
  if (!phone) return ''
  const first = String(phone).split(/[;,/]/)[0]
  let d = first.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 8) d = '968' + d
  if (/^968[79]\d{7}$/.test(d)) return '+' + d
  return ''
}

async function load() {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  return { jsPDF, autoTable }
}

function header(doc, W, title, sub, clientName) {
  doc.setFillColor(...DEEP)
  doc.rect(0, 0, W, 92, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, 92, W, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('times', 'bold')
  doc.setFontSize(20)
  doc.text(safe(title), 40, 42, { maxWidth: W - 80 })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(232, 213, 168)
  doc.text(safe(sub), 40, 66, { maxWidth: W - 80 })
  doc.setTextColor(200, 215, 217)
  doc.text(`${safe(clientName) || 'KS Tech'}  |  ${day()}`, W - 40, 66, { align: 'right' })
}

function tiles(doc, x, y, W, items) {
  const gap = 10
  const w = (W - gap * (items.length - 1)) / items.length
  items.forEach(([label, value, color], i) => {
    const tx = x + i * (w + gap)
    doc.setFillColor(247, 249, 249)
    doc.setDrawColor(...HAIR)
    doc.roundedRect(tx, y, w, 62, 6, 6, 'FD')
    doc.setFillColor(...(color || SEA))
    doc.rect(tx, y + 8, 3, 46, 'F')
    doc.setTextColor(...INK)
    doc.setFont('times', 'bold')
    doc.setFontSize(22)
    doc.text(String(value), tx + 14, y + 32)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...SLATE)
    doc.text(safe(label), tx + 14, y + 50, { maxWidth: w - 20 })
  })
  return y + 62
}

function sectionTitle(doc, x, y, text) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text(safe(text), x, y)
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.8)
  doc.line(x, y + 5, x + 40, y + 5)
}

// Horizontal bars: rows = [[label, value]]
function bars(doc, x, y, w, rows, colorFor) {
  const max = Math.max(1, ...rows.map((r) => r[1]))
  const labelW = 150
  rows.forEach(([label, value], i) => {
    const yy = y + i * 20
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...INK)
    doc.text(safe(label), x, yy + 10, { maxWidth: labelW - 8 })
    doc.setFillColor(...HAIR)
    doc.rect(x + labelW, yy + 3, w - labelW - 34, 10, 'F')
    const bw = ((w - labelW - 34) * value) / max
    doc.setFillColor(...(colorFor ? colorFor(i) : SEA))
    if (bw > 0) doc.rect(x + labelW, yy + 3, bw, 10, 'F')
    doc.setFont('helvetica', 'bold')
    doc.text(String(value), x + w - 28, yy + 11)
  })
  return y + rows.length * 20
}

// Pie chart drawn as thin triangles; slices = [[label, value, color]]
function pie(doc, cx, cy, r, slices) {
  const total = slices.reduce((a, s) => a + s[1], 0)
  if (!total) {
    doc.setDrawColor(...HAIR); doc.setLineWidth(10); doc.circle(cx, cy, r - 5, 'S'); doc.setLineWidth(0.5)
  } else {
    let a = -Math.PI / 2
    for (const [, v, color] of slices) {
      if (!v) continue
      const end = a + (v / total) * Math.PI * 2
      doc.setFillColor(...color)
      doc.setDrawColor(...color)
      const step = Math.PI / 90
      for (let t = a; t < end; t += step) {
        const t2 = Math.min(end, t + step + 0.002)
        doc.triangle(cx, cy, cx + r * Math.cos(t), cy + r * Math.sin(t), cx + r * Math.cos(t2), cy + r * Math.sin(t2), 'FD')
      }
      a = end
    }
    // donut hole
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(255, 255, 255)
    doc.circle(cx, cy, r * 0.55, 'F')
  }
  doc.setTextColor(...INK)
  doc.setFont('times', 'bold')
  doc.setFontSize(20)
  doc.text(String(total), cx, cy + 4, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...SLATE)
  doc.text('messages', cx, cy + 16, { align: 'center' })
  // legend
  let ly = cy - r + 6
  const lx = cx + r + 24
  for (const [label, v, color] of slices) {
    doc.setFillColor(...color)
    doc.rect(lx, ly - 7, 9, 9, 'F')
    doc.setFontSize(9.5)
    doc.setTextColor(...INK)
    const pct = total ? Math.round((v / total) * 100) : 0
    doc.text(`${safe(label)}: ${v} (${pct}%)`, lx + 15, ly + 1)
    ly += 17
  }
}

function footer(doc, W, H) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...SLATE)
    doc.text('Map data: Google Maps and OpenStreetMap contributors. Prepared by KS TECH LLC, Muscat.', 40, H - 22)
    doc.text(`Page ${i} of ${pages}`, W - 40, H - 22, { align: 'right' })
  }
}

export async function downloadSearchResults({ live, clientName }) {
  const { jsPDF, autoTable } = await load()
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const items = live.items || []
  const label = live.searchLabel || `${live.label || 'Businesses'} near ${live.where || ''}`
  header(doc, W, `Search results: ${label}`, `${items.length} businesses found${live.km ? ` within ${live.km} km` : ''} of ${live.near || live.where || 'the search area'}${live.stopped ? ' (search stopped early)' : ''}`, clientName)

  const withPhone = items.filter((b) => b.phone).length
  const withWa = items.filter((b) => whatsappOf(b.phone)).length
  const withEmail = items.filter((b) => b.email).length
  const withWeb = items.filter((b) => b.website).length
  let y = tiles(doc, 40, 112, W - 80, [
    ['Businesses found', items.length, SEA],
    ['With a phone number', withPhone, GOLD],
    ['WhatsApp (mobile) numbers', withWa, [47, 122, 85]],
    ['With an email', withEmail, [110, 140, 200]],
    ['With a website', withWeb, [150, 110, 170]],
  ])

  // by type
  const byType = {}
  for (const b of items) byType[b.type] = (byType[b.type] || 0) + 1
  const rows = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 10)
  y += 26
  sectionTitle(doc, 40, y, 'Businesses by type')
  y = bars(doc, 40, y + 16, (W - 80) / 2, rows, (i) => PALETTE[i % PALETTE.length])

  autoTable(doc, {
    startY: Math.max(y + 20, 300),
    margin: { left: 40, right: 40, bottom: 40 },
    head: [['#', 'Business', 'Type', 'Why they buy', 'Area', 'Km', 'Phone', 'WhatsApp', 'Email', 'Website']],
    body: items.map((b, i) => [
      i + 1, safe(b.name) || '(Arabic name)', safe(b.type), safe(b.audienceFor ? b.offer : ''), safe(b.area),
      b.km == null ? 'Yellow Pages' : b.km < 1 ? `${Math.round(b.km * 1000)} m` : b.km.toFixed(1), safe(b.phone), whatsappOf(b.phone), safe(b.email), safe(b.website),
    ]),
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 3.5, textColor: INK, lineColor: HAIR, lineWidth: 0.4, overflow: 'linebreak' },
    headStyles: { fillColor: SEA, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 249, 249] },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 120 }, 3: { cellWidth: 120 }, 5: { cellWidth: 30 }, 9: { cellWidth: 100 } },
  })
  footer(doc, W, H)
  doc.save(`search-results-${fileName(label)}.pdf`)
}

const SENT = ['sent', 'replied', 'no_reply']

export async function downloadSearchReport({ clientName, label, leads, outreach }) {
  const { jsPDF, autoTable } = await load()
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const ids = new Set(leads.map((l) => l.id))
  const msgs = outreach.filter((o) => ids.has(o.lead_id))
  const n = (fn) => msgs.filter(fn).length
  const sent = n((o) => SENT.includes(o.status) || o.sent_at)
  const replied = n((o) => o.status === 'replied')
  const noReply = sent - replied
  const awaiting = n((o) => o.status === 'draft')
  const approved = n((o) => o.status === 'approved')
  const rejected = n((o) => o.status === 'rejected')
  const rate = sent ? Math.round((replied / sent) * 100) : 0
  const meetings = leads.filter((l) => ['meeting', 'won'].includes(l.status)).length
  const won = leads.filter((l) => l.status === 'won').length
  const first = leads.map((l) => l.created_at).filter(Boolean).sort()[0]

  header(doc, W, 'Search report', `${label}  |  searched ${day(first)}`, clientName)
  let y = tiles(doc, 40, 112, W - 80, [
    ['Leads saved', leads.length, SEA],
    ['Messages sent', sent, GOLD],
    ['Replies', replied, [47, 122, 85]],
    ['No reply yet', noReply, [164, 71, 58]],
  ])
  y = tiles(doc, 40, y + 10, W - 80, [
    ['Reply rate', `${rate}%`, [47, 122, 85]],
    ['Waiting for approval', awaiting, SLATE],
    ['Meetings booked', meetings, [110, 140, 200]],
    ['Deals won', won, GOLD],
  ])

  y += 34
  sectionTitle(doc, 40, y, 'Where every message stands')
  pie(doc, 120, y + 90, 66, [
    ['Replied', replied, [47, 122, 85]],
    ['Sent, no reply yet', noReply, [164, 71, 58]],
    ['Approved, not sent', approved, GOLD],
    ['Waiting for approval', awaiting, SLATE],
    ['Rejected', rejected, [200, 205, 206]],
  ])

  y += 190
  sectionTitle(doc, 40, y, 'From search to deal')
  y = bars(doc, 40, y + 16, W - 80, [
    ['Leads saved', leads.length], ['Messages sent', sent], ['Replied', replied], ['Meetings', meetings], ['Won', won],
  ], (i) => PALETTE[i % PALETTE.length])

  const byLead = {}
  for (const o of msgs) (byLead[o.lead_id] ||= []).push(o)
  const STATUS = { new: 'New', approved: 'Approved', contacted: 'Contacted', replied: 'Replied', meeting: 'Meeting', won: 'Won', lost: 'Lost', skipped: 'Skipped' }
  const OUT = { draft: 'Waiting for approval', approved: 'Approved', rejected: 'Rejected', sent: 'Sent, no reply', replied: 'Replied', no_reply: 'No reply' }
  autoTable(doc, {
    startY: y + 24,
    margin: { left: 40, right: 40, bottom: 40 },
    head: [['Business', 'Phone / email', 'Lead status', 'Message', 'Sent', 'Replied']],
    body: leads.map((l) => {
      const list = (byLead[l.id] || []).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      const o = list.find((x) => x.status !== 'rejected') || list[0]
      return [
        safe(l.business_name) || '(Arabic name)', safe([l.phone, l.email].filter(Boolean).join(', ')),
        STATUS[l.status] || l.status, o ? (OUT[o.status] || o.status) : 'No message yet',
        o?.sent_at ? day(o.sent_at) : '', o?.replied_at ? day(o.replied_at) : '',
      ]
    }),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, textColor: INK, lineColor: HAIR, lineWidth: 0.4 },
    headStyles: { fillColor: SEA, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 249, 249] },
  })
  footer(doc, W, H)
  doc.save(`search-report-${fileName(label)}.pdf`)
}
