import { Plus_Jakarta_Sans, Sora } from 'next/font/google'
import './globals.css'

const sans = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-sans' })
const serif = Sora({ subsets: ['latin'], weight: ['500', '600', '700'], display: 'swap', variable: '--font-serif' })

export const metadata = {
  title: 'KS Tech Leads',
  description: 'Lead generation and outreach dashboard by KS Tech LLC',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F7FB' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1020' },
  ],
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
