# Haircut Booking (Instagram Bio Link)

## Run locally
1) Install dependencies:
```bash
npm install
```

2) Create `.env.local` in the project root and fill in:
```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_PASSWORD=...
ADMIN_AUTH_SECRET=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
BARBER_NOTIFY_NUMBER=+1...
SEND_CUSTOMER_SMS=true
```

3) Start:
```bash
npm run dev
```

Open:
- http://localhost:3000 (public booking page)
- http://localhost:3000/admin (admin page)

## Supabase SQL
Run this in Supabase SQL editor:

```sql
create extension if not exists pgcrypto;

create table if not exists public.slots (
  id uuid primary key default gen_random_uuid(),
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint slots_time_valid check (end_time > start_time)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots(id) on delete cascade,
  customer_name text not null,
  customer_contact text not null,
  customer_phone text,
  sms_opt_in boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists bookings_unique_slot on public.bookings(slot_id);
create index if not exists slots_start_time_idx on public.slots(start_time);
create index if not exists bookings_created_at_idx on public.bookings(created_at);
```
