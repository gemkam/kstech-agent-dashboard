// Builds and downloads the client's activity report as a PDF, in the browser.
// Loaded only when the button is pressed, so the dashboard stays fast.

const SEA = [15, 76, 85]
const BRASS = [184, 134, 43]
const INK = [23, 38, 43]
const SLATE = [94, 115, 120]
const LINE = [214, 224, 225]

const STATUS = {
  new: 'New', approved: 'Approved', contacted: 'Contacted', replied: 'Replied',
  meeting: 'Meeting', won: 'Won', lost: 'Lost', skipped: 'Skipped',
}
const OUT_STATUS = {
  draft: 'Waiting for approval', approved: 'Approved, not sent', rejected: 'Rejected',
  sent: 'Sent', replied: 'Replied', no_reply: 'No reply',
}

function d(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Standard PDF fonts only cover Latin text; strip anything they cannot draw
function safe(text) {
  return String(text ?? '').replace(/[^\x20-\x7E\u00A0-\u00FF\n]/g, '').trim()
}

export async function downloadReport({ client, leads, outreach, followups, events, sentTotal, month, today }) {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  let y = 0

  // Header band
  doc.setFillColor(...SEA)
  doc.rect(0, 0, W, 90, 'F')
  doc.setFillColor(...BRASS)
  doc.roundedRect(M, 26, 38, 38, 6, 6, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('KS', M + 19, 50, { align: 'center' })
  doc.setFontSize(18)
  doc.text('Lead generation report', M + 52, 44)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`${safe(client.name)}   |   Generated ${d(new Date())}   |   Month ${month}`, M + 52, 62)
  y = 120

  // Numbers
  const has = (s) => (o) => o.status === s
  const count = (list, fn) => list.filter(fn).length
  const active = leads.filter((l) => l.status !== 'skipped').length
  const replied = count(outreach, has('replied'))
  const sentNow = count(outreach, (o) => o.sent_at)
  const replyRate = sentNow ? Math.round((replied / sentNow) * 100) : 0
  const monthStart = new Date(today.slice(0, 7) + '-01')
  const sentThisMonth = count(outreach, (o) => o.sent_at && new Date(o.sent_at) >= monthStart)

  const cards = [
    ['Businesses found', active],
    ['Emails sent (all time)', sentTotal],
    ['Sent this month', sentThisMonth],
    ['Waiting for approval', count(outreach, has('draft'))],
    ['Approved, not sent', count(outreach, has('approved'))],
    ['Replies', replied],
    ['Reply rate', `${replyRate}%`],
    ['Meetings', count(leads, (l) => ['meeting', 'won'].includes(l.status))],
    ['Won', count(leads, (l) => l.status === 'won')],
    ['Follow-ups due', count(followups, (f) => !f.done && f.due_date && f.due_date <= today)],
  ]

  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Summary', M, y)
  y += 12

  const cols = 5
  const gap = 8
  const cw = (W - M * 2 - gap * (cols - 1)) / cols
  const ch = 58
  cards.forEach(([label, value], i) => {
    const cx = M + (i % cols) * (cw + gap)
    const cy = y + Math.floor(i / cols) * (ch + gap)
    doc.setDrawColor(...LINE)
    doc.setFillColor(247, 250, 250)
    doc.roundedRect(cx, cy, cw, ch, 6, 6, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(...(i === 1 ? BRASS : SEA))
    doc.text(String(value), cx + 10, cy + 27)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...SLATE)
    doc.text(label, cx + 10, cy + 45)
  })
  y += Math.ceil(cards.length / cols) * (ch + gap) + 18

  const leadById = Object.fromEntries(leads.map((l) => [l.id, l]))
  const tableStyle = {
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: INK, lineColor: LINE, lineWidth: 0.5 },
    headStyles: { fillColor: SEA, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 250, 250] },
    margin: { left: M, right: M },
  }

  function section(title) {
    if (y > doc.internal.pageSize.getHeight() - 90) { doc.addPage(); y = 50 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...INK)
    doc.text(title, M, y)
    y += 8
  }

  // Emails
  section('Emails')
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
  autoTable(doc, {
    ...tableStyle,
    startY: y,
    head: [['Business', 'Subject', 'Status', 'Sent', 'Replied']],
    body: emails.length ? emails : [['No emails yet', '', '', '', '']],
    columnStyles: { 0: { cellWidth: 120 }, 2: { cellWidth: 85 }, 3: { cellWidth: 62 }, 4: { cellWidth: 62 } },
  })
  y = doc.lastAutoTable.finalY + 24

  // Leads
  section('Leads')
  const leadRows = leads.map((l) => [
    safe(l.business_name),
    safe(l.area),
    STATUS[l.status] || l.status,
    safe(l.problem_found || 'General fit'),
    l.score ?? '',
  ])
  autoTable(doc, {
    ...tableStyle,
    startY: y,
    head: [['Business', 'Area', 'Status', 'Why it fits', 'Score']],
    body: leadRows.length ? leadRows : [['No leads yet', '', '', '', '']],
    columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 80 }, 2: { cellWidth: 65 }, 4: { cellWidth: 40, halign: 'right' } },
  })
  y = doc.lastAutoTable.finalY + 24

  // Activity
  if (events.length) {
    section('Recent activity')
    autoTable(doc, {
      ...tableStyle,
      startY: y,
      head: [['Date', 'What happened']],
      body: events.map((e) => [d(e.created_at), safe(e.message)]),
      columnStyles: { 0: { cellWidth: 80 } },
    })
  }

  // Footer on every page
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    const H = doc.internal.pageSize.getHeight()
    doc.setDrawColor(...LINE)
    doc.line(M, H - 36, W - M, H - 36)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...SLATE)
    doc.text('KS TECH LLC, Al Khuwair, Muscat   |   +968 9731 2049   |   kzstech000@gmail.com', M, H - 22)
    doc.text(`Page ${i} of ${pages}`, W - M, H - 22, { align: 'right' })
  }

  const slug = safe(client.name).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client'
  doc.save(`KS-Tech-report-${slug}-${today}.pdf`)
}
