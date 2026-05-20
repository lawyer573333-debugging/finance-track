import { supabase } from '../lib/supabase';

export interface SupabaseStatus {
  configured: boolean;
  connected: boolean;
  error?: string;
  tables: {
    users: boolean;
    transactions: boolean;
    budgets: boolean;
    tasks: boolean;
  };
  sqlSchema: string;
}

export async function checkSupabaseConnection(): Promise<SupabaseStatus> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const configured = !!(url && !url.includes('placeholder') && url !== 'PASTE_SUPABASE_PROJECT_URL' && anonKey && !anonKey.includes('placeholder') && anonKey !== 'PASTE_SUPABASE_ANON_KEY');

  const status: SupabaseStatus = {
    configured,
    connected: false,
    tables: {
      users: false,
      transactions: false,
      budgets: false,
      tasks: false,
    },
    sqlSchema: getSqlSchema(),
  };

  if (!configured) {
    return status;
  }

  try {
    // Check tables. A test query of selecting 1 row.
    const [uRes, tRes, bRes, kRes] = await Promise.allSettled([
      supabase.from('users').select('id').limit(1),
      supabase.from('transactions').select('id').limit(1),
      supabase.from('budgets').select('id').limit(1),
      supabase.from('tasks').select('id').limit(1),
    ]);

    status.connected = true;

    // Check users table Status
    if (uRes.status === 'fulfilled') {
      const err = uRes.value.error;
      // If error is null or it is just a 'no rows returned' type PGRST116, the table exists.
      // If it is 'relation does not exist' or code '42P01', the table does NOT exist.
      if (!err || (err.code !== '42P01' && !err.message.includes('relation "public.users" does not exist'))) {
        status.tables.users = true;
      }
    }

    // Check transactions table Status
    if (tRes.status === 'fulfilled') {
      const err = tRes.value.error;
      if (!err || (err.code !== '42P01' && !err.message.includes('relation "public.transactions" does not exist'))) {
        status.tables.transactions = true;
      }
    }

    // Check budgets table Status
    if (bRes.status === 'fulfilled') {
      const err = bRes.value.error;
      if (!err || (err.code !== '42P01' && !err.message.includes('relation "public.budgets" does not exist'))) {
        status.tables.budgets = true;
      }
    }

    // Check tasks table Status
    if (kRes.status === 'fulfilled') {
      const err = kRes.value.error;
      if (!err || (err.code !== '42P01' && !err.message.includes('relation "public.tasks" does not exist'))) {
        status.tables.tasks = true;
      }
    }

    // Check overall authentication key validity
    // If we gets an explicit status 400/401, or error says invalid API key / jwt
    const hasAuthError = [uRes, tRes, bRes, kRes].some(r => {
      if (r.status === 'fulfilled' && r.value.error) {
        const msg = r.value.error.message.toLowerCase();
        return (r.value.error as any).status === 401 || msg.includes('jwt') || msg.includes('anon key') || msg.includes('invalid api key') || msg.includes('invalid credentials');
      }
      return false;
    });

    if (hasAuthError) {
      status.connected = false;
      status.error = "Authentication failed. The Supabase Web app was unable to verify your API Key. Please make sure VITE_SUPABASE_ANON_KEY is set correctly.";
    }

  } catch (err: any) {
    status.connected = false;
    status.error = err?.message || "Connection timed out. Check your project URL.";
  }

  return status;
}

function getSqlSchema(): string {
  return `-- COPY AND RUN THIS CODE IN YOUR SUPABASE SQL EDITOR TO CREATE TABLES:

-- 1. Create 'users' table
create table if not exists public.users (
  id text primary key,
  name text not null,
  email text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS and setup permissive policy for simplicity
alter table public.users enable row level security;
create policy "Allow public access to users" on public.users for all using (true) with check (true);

-- 2. Create 'transactions' table
create table if not exists public.transactions (
  id text primary key,
  user_id text references public.users(id) on delete cascade,
  type text check (type in ('Income', 'Expense')) not null,
  amount numeric not null,
  category text not null,
  title text not null,
  date text not null,
  payment_method text not null,
  notes text,
  recurring boolean default false,
  recurring_frequency text,
  tags text[] default '{}'::text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.transactions enable row level security;
create policy "Allow public access to transactions" on public.transactions for all using (true) with check (true);

-- 3. Create 'budgets' table
create table if not exists public.budgets (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.users(id) on delete cascade,
  category text not null,
  "limit" numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, category)
);

alter table public.budgets enable row level security;
create policy "Allow public access to budgets" on public.budgets for all using (true) with check (true);

-- 4. Create 'tasks' table
create table if not exists public.tasks (
  id text primary key,
  user_id text references public.users(id) on delete cascade,
  title text not null,
  priority text check (priority in ('Low', 'Medium', 'High')) not null,
  due_date text not null,
  status text check (status in ('Pending', 'In Progress', 'Done')) not null,
  is_auto_generated boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.tasks enable row level security;
create policy "Allow public access to tasks" on public.tasks for all using (true) with check (true);
`;
}
