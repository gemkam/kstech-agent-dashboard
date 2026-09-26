# KS Tech Leads Dashboard

Lead generation dashboard for KS Tech LLC and its clients.
Next.js 14 + Supabase (project: kstech-agents) + Vercel.

## Roles
- Admin (kzstech000@gmail.com): sees every company, switches company at the top, edits lead status and notes, marks follow-ups done, manages users at /admin.
- Client: sees only their own company's leads, messages and follow-ups (read only).
Security is enforced by Supabase row-level security, not by the app.

## Setup
1. Create GitHub repo `kstech-agent-dashboard`, copy these files in, commit and push (GitHub Desktop).
2. Vercel: Add New Project, import the repo.
3. Environment variables in Vercel:
   - NEXT_PUBLIC_SUPABASE_URL = https://cenmztxrxkmkdbbiuhiz.supabase.co
   - NEXT_PUBLIC_SUPABASE_ANON_KEY = anon public key (Supabase: Project Settings, API)
   Never use the service_role key here.
4. Deploy.

## Supabase settings (once)
- Authentication, Sign In / Providers: turn OFF "Allow new users to sign up" (you create all logins yourself).
- Authentication, URL Configuration: Site URL = your Vercel URL.
- Authentication, Users, Add user: create your own login with kzstech000@gmail.com (becomes admin automatically).
- Add a demo login (e.g. demo@kstech.om), then in /admin link it to "Gulf Facility Services (Demo)".

## How the agent flow works
1. Agent run: admin clicks Start run (or Claude sets it from chat). Gear spins for the client, activity shows each step.
2. Drafts: emails are saved as drafts. Client sees them under "Waiting for your approval".
3. Client clicks Approve, Edit or Reject. Nothing is sent before approval.
4. Admin sends the approved email, then clicks Mark sent. Lead becomes Contacted and a follow-up is scheduled in 4 days.
5. Demo company: "Start agent" plays a full animated run and adds 3 sample drafts.

## Before a client's first email
- Email setup panel (right side of the dashboard): tick each step as it is done. Outreach mailbox, SPF, DKIM, DMARC, test email in inbox. A red banner shows until all 5 are done.
- Do not contact: open a lead, "Do not contact this business". Cancels drafts and follow-ups; the database refuses any new draft for that business. Only admin can undo.
- Duplicates: every new lead is checked against the same company's leads (name, phone last 8 digits, email). A match is tagged "Possible duplicate"; if the older one is on the do-not-contact list, the new one is too.
- Follow-ups: due 3 days after "I've sent it". Closed automatically when the lead is marked Replied, Meeting, Won or Lost. Clients can mark them done.

## Adding a client
1. /admin: Add company.
2. Supabase: Add user with the client's email and a password.
3. /admin: set that user's company. Send them the link and password.

## Local run
npm install
copy .env.example to .env.local and fill the anon key
npm run dev
