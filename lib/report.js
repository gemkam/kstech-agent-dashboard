// Premium client report, generated in the browser and downloaded as a PDF.
// Loaded only when the button is pressed.

const DEEP = [11, 49, 57]        // cover background, deep petrol
const SEA = [15, 76, 85]
const GOLD = [191, 151, 72]      // foil gold
const GOLD_SOFT = [232, 213, 168]
const INK = [23, 38, 43]
const SLATE = [104, 122, 127]
const HAIR = [226, 232, 233]
const MIST = [169, 195, 198]
const WON = [47, 122, 85]
const LOST = [164, 71, 58]

const STATUS = {
  new: 'New', approved: 'Approved', contacted: 'Contacted', replied: 'Replied',
  meeting: 'Meeting', won: 'Won', lost: 'Lost', skipped: 'Skipped',
}
const OUT_STATUS = {
  draft: 'Awaiting approval', approved: 'Approved', rejected: 'Rejected',
  sent: 'Sent', replied: 'Replied', no_reply: 'No reply',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function d(value, long = false) {
  if (!value) return ''
  const x = new Date(value)
  if (long) return x.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  return `${x.getDate()} ${MONTHS[x.getMonth()]} ${String(x.getFullYear()).slice(2)}`
}

// Standard PDF fonts only cover Latin text; drop characters they cannot draw
function safe(text) {
  return String(text ?? '').replace(/[^\x20-\x7E\u00A0-\u00FF\n]/g, '').trim()
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

export async function downloadReport({ client, leads, outreach, followups, events, sentTotal, month, today }) {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 56
  const clientName = safe(client.name) || 'Client'

  // ---------- numbers ----------
  const count = (list, fn) => list.filter(fn).length
  const found = count(leads, (l) => l.status !== 'skipped')
  const contacted = count(leads, (l) => ['contacted', 'replied', 'meeting', 'won', 'lost'].includes(l.status))
  const repliedLeads = count(leads, (l) => ['replied', 'meeting', 'won'].includes(l.status))
  const meetings = count(leads, (l) => ['meeting', 'won'].includes(l.status))
  const won = count(leads, (l) => l.status === 'won')
  const sentList = outreach.filter((o) => o.sent_at)
  const replies = count(outreach, (o) => o.status === 'replied')
  const rate = sentTotal ? Math.round((replies / sentTotal) * 100) : 0
  const awaiting = count(outreach, (o) => o.status === 'draft')
  const approvedNotSent = count(outreach, (o) => o.status === 'approved')
  const due = count(followups, (f) => !f.done && f.due_date && f.due_date <= today)
  const monthStart = new Date(today.slice(0, 7) + '-01')
  const sentThisMonth = count(sentList, (o) => new Date(o.sent_at) >= monthStart)

  // ---------- helpers ----------
  function spaced(text, x, y, opts = {}) {
    const space = opts.space ?? 1.6
    let tx = x
    const width = doc.getTextWidth(text) + space * (text.length - 1)
    if (opts.align === 'center') tx = x - width / 2
    if (opts.align === 'right') tx = x - width
    doc.setCharSpace(space)
    doc.text(text, tx, y)
    doc.setCharSpace(0)
  }

  function pageHeader(title) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...GOLD)
    spaced('KS TECH LLC', M, 44)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...SLATE)
    doc.text(clientName, W - M, 44, { align: 'right' })
    doc.setDrawColor(...GOLD)
    doc.setLineWidth(0.6)
    doc.line(M, 54, W - M, 54)

    doc.setFont('times', 'normal')
    doc.setFontSize(28)
    doc.setTextColor(...INK)
    doc.text(title, M, 104)
    return 150
  }

  function sectionTitle(title, y) {
    if (y > H - 150) { doc.addPage(); y = pageHeader('Report details') }
    doc.setFont('times', 'normal')
    doc.setFontSize(17)
    doc.setTextColor(...INK)
    doc.text(title, M, y)
    doc.setDrawColor(...GOLD)
    doc.setLineWidth(0.8)
    doc.line(M, y + 8, M + 28, y + 8)
    return y + 24
  }

  // ---------- page 1: cover ----------
  doc.setFillColor(...DEEP)
  doc.rect(0, 0, W, H, 'F')

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.8)
  doc.rect(24, 24, W - 48, H - 48)
  doc.setLineWidth(0.3)
  doc.rect(30, 30, W - 60, H - 60)

  // monogram
  const cx = W / 2
  doc.setLineWidth(1)
  doc.circle(cx, 210, 38)
  doc.setLineWidth(0.3)
  doc.circle(cx, 210, 44)
  doc.setFont('times', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(...GOLD)
  doc.text('KS', cx, 220, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...GOLD_SOFT)
  spaced('KS TECH LLC   MUSCAT', cx, 282, { align: 'center', space: 3 })

  doc.setFont('times', 'normal')
  doc.setFontSize(36)
  doc.setTextColor(255, 255, 255)
  doc.text('Client Performance', cx, 382, { align: 'center' })
  doc.text('Report', cx, 424, { align: 'center' })

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(1)
  doc.line(cx - 34, 450, cx + 34, 450)

  doc.setFont('times', 'italic')
  doc.setFontSize(20)
  doc.setTextColor(...GOLD_SOFT)
  doc.text(clientName, cx, 486, { align: 'center', maxWidth: W - 160 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MIST)
  doc.text(`Month ${month} of service`, cx, 520, { align: 'center' })
  doc.text(d(new Date(), true), cx, 536, { align: 'center' })

  // cover hero number
  doc.setFont('times', 'bold')
  doc.setFontSize(54)
  doc.setTextColor(...GOLD)
  doc.text(String(sentTotal), cx, 640, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MIST)
  spaced('emails sent on your behalf', cx, 662, { align: 'center', space: 1.2 })

  doc.setFontSize(7.5)
  doc.setTextColor(...MIST)
  doc.text(`Prepared exclusively for ${clientName}. Confidential.`, cx, H - 52, { align: 'center' })

  // ---------- page 2: executive summary ----------
  doc.addPage()
  let y = pageHeader('Executive summary')

  // hero row
  doc.setFont('times', 'bold')
  doc.setFontSize(66)
  doc.setTextColor(...GOLD)
  doc.text(String(sentTotal), M, y + 58)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...SLATE)
  doc.text('Emails sent since the start', M, y + 80)
  doc.text(`${sentThisMonth} of them this month`, M, y + 94)

  const heroRight = [
    [String(replies), 'Replies received'],
    [`${rate}%`, 'Reply rate'],
    [String(won), won === 1 ? 'Contract won' : 'Contracts won'],
  ]
  const rx = W / 2 + 10
  heroRight.forEach(([v, l], i) => {
    const yy = y + 14 + i * 34
    doc.setFont('times', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(...SEA)
    doc.text(v, rx, yy + 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...SLATE)
    doc.text(l, rx + 70, yy + 12)
    if (i < 2) {
      doc.setDrawColor(...HAIR)
      doc.setLineWidth(0.5)
      doc.line(rx, yy + 26, W - M, yy + 26)
    }
  })
  y += 124

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.6)
  doc.line(M, y, W - M, y)
  y += 30

  // metric strip
  const metrics = [
    [found, 'Businesses researched'],
    [meetings, 'Meetings booked'],
    [awaiting, 'Awaiting your approval'],
    [due, 'Follow-ups due'],
  ]
  const colW = (W - M * 2) / metrics.length
  metrics.forEach(([v, l], i) => {
    const x = M + i * colW
    if (i > 0) {
      doc.setDrawColor(...HAIR)
      doc.setLineWidth(0.5)
      doc.line(x, y - 6, x, y + 40)
    }
    const tx = i === 0 ? x : x + 14
    doc.setFont('times', 'bold')
    doc.setFontSize(24)
    doc.setTextColor(...INK)
    doc.text(String(v), tx, y + 18)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...SLATE)
    doc.text(l, tx, y + 34)
  })
  y += 76

  // funnel
  y = sectionTitle('From research to results', y)
  const stages = [
    ['Researched', found],
    ['Contacted', contacted],
    ['Replied', repliedLeads],
    ['Meeting', meetings],
    ['Won', won],
  ]
  const barX = M + 92
  const barMax = W - M - barX - 40
  stages.forEach(([label, v], i) => {
    const yy = y + i * 28
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...INK)
    doc.text(label, M, yy + 11)
    doc.setFillColor(...HAIR)
    doc.rect(barX, yy + 3, barMax, 10, 'F')
    const w = found ? Math.max(v ? 3 : 0, (v / found) * barMax) : 0
    doc.setFillColor(...(i === stages.length - 1 ? GOLD : SEA))
    if (w > 0) doc.rect(barX, yy + 3, w, 10, 'F')
    doc.setFont('times', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...(i === stages.length - 1 ? GOLD : SEA))
    doc.text(String(v), W - M, yy + 12, { align: 'right' })
  })
  y += stages.length * 28 + 26

  // highlights in words
  y = sectionTitle('Highlights', y)
  const lines = []
  lines.push(`We researched ${plural(found, 'business', 'businesses')} that match your ideal customer.`)
  if (sentTotal) lines.push(`${plural(sentTotal, 'personalized email was', 'personalized emails were')} sent, and ${plural(replies, 'business', 'businesses')} replied (${rate}% reply rate).`)
  if (meetings || won) lines.push(`${plural(won, 'contract', 'contracts')} won and ${plural(meetings - won, 'further meeting', 'further meetings')} booked.`)
  if (awaiting) lines.push(`${plural(awaiting, 'email is', 'emails are')} ready and waiting for your approval.`)
  if (approvedNotSent) lines.push(`${plural(approvedNotSent, 'approved email has', 'approved emails have')} not been sent yet.`)
  if (due) lines.push(`${plural(due, 'follow-up is', 'follow-ups are')} due, to keep conversations moving.`)
  doc.setFont('times', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(...INK)
  lines.forEach((t) => {
    doc.setFillColor(...GOLD)
    doc.circle(M + 3, y - 4, 2, 'F')
    const wrapped = doc.splitTextToSize(t, W - M * 2 - 18)
    doc.text(wrapped, M + 16, y)
    y += wrapped.length * 16 + 6
  })

  // ---------- details pages ----------
  doc.addPage()
  y = pageHeader('Report details')

  const leadById = Object.fromEntries(leads.map((l) => [l.id, l]))
  const table = (head, body, columnStyles, statusCol) => ({
    theme: 'plain',
    startY: y,
    head: [head],
    body,
    margin: { left: M, right: M, top: 70, bottom: 70 },
    styles: { font: 'helvetica', fontSize: 9, textColor: INK, cellPadding: { top: 8, bottom: 8, left: 4, right: 6 } },
    headStyles: { font: 'helvetica', fontStyle: 'bold', fontSize: 8, textColor: SLATE },
    columnStyles,
    didParseCell: (c) => {
      if (c.section === 'body' && c.column.index === statusCol) {
        const v = String(c.cell.raw)
        if (['Won', 'Replied', 'Meeting'].includes(v)) c.cell.styles.textColor = WON
        else if (['Rejected', 'Lost'].includes(v)) c.cell.styles.textColor = LOST
        else if (['Awaiting approval', 'Approved'].includes(v)) c.cell.styles.textColor = GOLD
        c.cell.styles.fontStyle = 'bold'
      }
      if (c.section === 'body' && c.column.index === 0) c.cell.styles.fontStyle = 'bold'
    },
    didDrawCell: (c) => {
      const yb = c.cell.y + c.cell.height
      if (c.section === 'head') {
        doc.setDrawColor(...GOLD)
        doc.setLineWidth(0.8)
      } else {
        doc.setDrawColor(...HAIR)
        doc.setLineWidth(0.5)
      }
      doc.line(c.cell.x, yb, c.cell.x + c.cell.width, yb)
    },
    didDrawPage: () => {
      // repeat the slim header on continuation pages
      if (doc.getCurrentPageInfo().pageNumber > 3) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.setTextColor(...GOLD)
        spaced('KS TECH LLC', M, 44)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...SLATE)
        doc.text(clientName, W - M, 44, { align: 'right' })
        doc.setDrawColor(...GOLD)
        doc.setLineWidth(0.6)
        doc.line(M, 54, W - M, 54)
      }
    },
  })

  y = sectionTitle('Emails', y)
  const emails = outreach
    .slice()
    .sort((a, b) => new Date(b.sent_at || b.created_at) - new Date(a.sent_at || a.created_at))
    .map((o) => [
      safe(leadById[o.lead_id]?.business_name),
      safe(o.subject || ''),
      OUT_STATUS[o.status] || o.status,
      d(o.sent_at),
      d(o.replied_at),
    ])
  autoTable(doc, table(
    ['Business', 'Subject', 'Status', 'Sent', 'Replied'],
    emails.length ? emails : [['No emails yet', '', '', '', '']],
    { 0: { cellWidth: 118 }, 2: { cellWidth: 90 }, 3: { cellWidth: 56 }, 4: { cellWidth: 56 } },
    2,
  ))
  y = doc.lastAutoTable.finalY + 40

  y = sectionTitle('Businesses researched', y)
  const leadRows = leads.map((l) => [
    safe(l.business_name),
    safe(l.area),
    STATUS[l.status] || l.status,
    safe(l.problem_found || 'General fit'),
    l.score ?? '',
  ])
  autoTable(doc, table(
    ['Business', 'Area', 'Status', 'Opportunity', 'Score'],
    leadRows.length ? leadRows : [['No leads yet', '', '', '', '']],
    { 0: { cellWidth: 128 }, 1: { cellWidth: 78 }, 2: { cellWidth: 62 }, 4: { cellWidth: 38, halign: 'right' } },
    2,
  ))
  y = doc.lastAutoTable.finalY + 40

  if (events.length) {
    y = sectionTitle('Recent activity', y)
    events.slice(0, 20).forEach((e) => {
      if (y > H - 100) { doc.addPage(); y = pageHeader('Report details') }
      doc.setFillColor(...GOLD)
      doc.circle(M + 3, y - 3, 2.2, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...SLATE)
      doc.text(d(e.created_at), M + 14, y)
      doc.setFont('times', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(...INK)
      const wrapped = doc.splitTextToSize(safe(e.message), W - M * 2 - 100)
      doc.text(wrapped, M + 100, y)
      y += wrapped.length * 14 + 8
    })
    y += 20
  }

  // closing and signature
  if (y > H - 190) { doc.addPage(); y = pageHeader('Report details') }
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.6)
  doc.line(M, y, W - M, y)
  y += 34
  doc.setFont('times', 'italic')
  doc.setFontSize(13)
  doc.setTextColor(...INK)
  doc.text(doc.splitTextToSize('Thank you for your trust. We will keep finding the right businesses and keeping every conversation moving.', W - M * 2), M, y)
  y += 52
  doc.setFont('times', 'bold')
  doc.setFontSize(13)
  doc.text('Kamran Zia Siddiquee', M, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...SLATE)
  doc.text('Founder, KS TECH LLC', M, y + 15)
  doc.text('Al Khuwair 33, Muscat   |   +968 9731 2049   |   kzstech000@gmail.com', M, y + 29)

  // footers (all pages except the cover)
  const pages = doc.getNumberOfPages()
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...HAIR)
    doc.setLineWidth(0.5)
    doc.line(M, H - 44, W - M, H - 44)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...SLATE)
    doc.text(`Confidential report for ${clientName}`, M, H - 30)
    doc.setFont('times', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GOLD)
    doc.text(`${String(i).padStart(2, '0')} / ${String(pages).padStart(2, '0')}`, W - M, H - 30, { align: 'right' })
  }

  const slug = clientName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client'
  doc.save(`KS-Tech-Report-${slug}-${today}.pdf`)
}
