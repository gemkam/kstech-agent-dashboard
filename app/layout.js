import { Instrument_Sans, Cormorant_Garamond } from 'next/font/google'
import './globals.css'

const sans = Instrument_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-sans' })
const serif = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], display: 'swap', variable: '--font-serif' })

export const metadata = {
  title: 'KS Tech Leads',
  description: 'Lead generation and outreach dashboard by KS Tech LLC',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#071F24',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        {/* apply the saved light/dark choice before the page paints */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('ks-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}" }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
