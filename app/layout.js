import { Instrument_Sans } from 'next/font/google'
import './globals.css'

const sans = Instrument_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-sans' })

export const metadata = {
  title: 'KS Tech Leads',
  description: 'Lead generation and outreach dashboard by KS Tech LLC',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0F4C55',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  )
}
