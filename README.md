# Figics workforce

Human resource management for organizations — attendance, leave, payroll, and org roster. Built with Next.js App Router, MongoDB, Auth.js, and a dark zinc + teal UI.

## Stack

- Next.js 16 (App Router) + TypeScript
- MongoDB + Mongoose
- Auth.js (NextAuth v5) credentials
- Tailwind CSS + Radix primitives
- SWR for client data fetching
- Zod + react-hook-form patterns

## Roles (`user.type`)

| Type | Access |
|------|--------|
| `superAdmin` | Everything across all orgs; registers clients |
| `orgAdmin` (`primary: true`) | Orgs in `orgIds` only; can add secondary orgAdmins, PMs, members |
| `orgAdmin` (`primary: false`) | Assigned `orgIds` only |
| `projectManager` | Assigned projects (roster/leave); HR records still org-scoped |
| `member` | Self attendance, leave, payslips |

**Client onboarding (superAdmin):** creates Organization + primary orgAdmin with `orgIds=[that org]`. That admin signs in with the org selected by default.

Attendance, leave, and payslips are always keyed by `orgId`. Project assignment (`scope` / `projIds`) does not split those records.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env and set MongoDB URI:

```bash
cp .env.example .env.local
```

3. **Start MongoDB** locally on `27017` (or set `MONGODB_URI` to Atlas / remote). Seed and the app require a running database.

```bash
# example if MongoDB is installed as a Windows service
net start MongoDB
```

4. Seed demo data:

```bash
npm run seed
```

5. Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo logins

Password for all: `password123`

| Email | Type |
|-------|------|
| `super@hrm.local` | superAdmin |
| `primary@hrm.local` | orgAdmin (primary) |
| `orgadmin@hrm.local` | orgAdmin (Figics Labs only) |
| `pm@hrm.local` | projectManager |
| `member@hrm.local` | member (org-wide) |
| `member2@hrm.local` | member (project-only) |

## Main routes

- `/login`
- `/dashboard`
- `/dashboard/admins` — orgAdmins
- `/dashboard/orgs` — organizations
- `/dashboard/projects`
- `/dashboard/members`
- `/dashboard/attendance`
- `/dashboard/leave`
- `/dashboard/payroll`
- `/dashboard/reports`

## Currency

Each organization has:
- `currency` — base (amounts stored in this)
- `secondaryCurrency` — optional display conversion
- `fxRate` — base units per 1 secondary

Footer **Change currency** updates these for the selected org. Profiles and payroll show dual amounts when secondary is set.

## Clients

SuperAdmin / primary orgAdmin: **Clients** registers a new organization + orgAdmin together (`POST /api/clients`).
