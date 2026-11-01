-- PHASE 2 (not wired up yet): employer & job-seeker accounts.
-- Concepts carried over from the Ohio hub, written fresh for Michigan:
--   * company profile stored once on the employer and reused on every post
--   * jobs expire after 60 days and show a clear "closed" state
--   * job seekers keep one resume that reliably saves, and see the jobs they applied to
--   * employers see applicants (and their resumes) only for their own jobs
-- New for Michigan: aggregated listings live in data/jobs.json; this schema is only for
-- jobs posted directly on the site and for accounts/applications.

create type public.app_role as enum ('employer', 'seeker');
create type public.org_type as enum ('district', 'charter', 'isd', 'private', 'agency');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.employers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  org_type public.org_type not null,
  website text,
  contact_email text not null,
  logo_path text,
  city text,
  county text,
  plan text not null default 'free' check (plan in ('free', 'district', 'agency')),
  verified boolean not null default false, -- set by an admin before posts go live
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  title text not null check (length(title) between 3 and 140),
  county text not null,
  job_type text not null,
  categories text[] not null check (cardinality(categories) > 0),
  description text not null,
  apply_url text, -- null = apply on-site with resume
  screening_questions jsonb not null default '[]',
  status text not null default 'pending' check (status in ('draft', 'pending', 'active', 'closed')),
  featured_until timestamptz,
  expires_at timestamptz not null default (now() + interval '60 days'),
  created_at timestamptz not null default now()
);
create index jobs_public_idx on public.jobs (status, expires_at);

create table public.resumes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  headline text,
  county text,
  education text,
  experience text,
  links text,
  file_path text,
  content text not null default '',
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  applicant_id uuid not null references auth.users(id) on delete cascade,
  cover_note text,
  answers jsonb not null default '[]',
  status text not null default 'submitted' check (status in ('submitted', 'reviewed', 'interview', 'rejected', 'hired')),
  created_at timestamptz not null default now(),
  unique (job_id, applicant_id)
);

alter table public.profiles enable row level security;
alter table public.employers enable row level security;
alter table public.jobs enable row level security;
alter table public.resumes enable row level security;
alter table public.applications enable row level security;

create policy "own profile" on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "employers readable" on public.employers for select using (true);
create policy "employer manages own org" on public.employers for insert to authenticated with check (owner_id = auth.uid() and verified = false);
create policy "employer updates own org" on public.employers for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "active jobs public" on public.jobs for select using (status = 'active' and expires_at > now());
create policy "employer reads own jobs" on public.jobs for select to authenticated
  using (employer_id in (select id from public.employers where owner_id = auth.uid()));
create policy "employer creates jobs" on public.jobs for insert to authenticated
  with check (employer_id in (select id from public.employers where owner_id = auth.uid()) and status in ('draft', 'pending') and featured_until is null);
create policy "employer edits own jobs" on public.jobs for update to authenticated
  using (employer_id in (select id from public.employers where owner_id = auth.uid()))
  with check (status in ('draft', 'pending', 'closed'));

create policy "own resume" on public.resumes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "employer sees applicant resumes" on public.resumes for select to authenticated using (
  user_id in (select a.applicant_id from public.applications a join public.jobs j on j.id = a.job_id
              join public.employers e on e.id = j.employer_id where e.owner_id = auth.uid()));

create policy "seeker applies" on public.applications for insert to authenticated with check (applicant_id = auth.uid() and status = 'submitted');
create policy "seeker sees own applications" on public.applications for select to authenticated using (applicant_id = auth.uid());
create policy "employer sees applications to own jobs" on public.applications for select to authenticated using (
  job_id in (select j.id from public.jobs j join public.employers e on e.id = j.employer_id where e.owner_id = auth.uid()));
create policy "employer updates application status" on public.applications for update to authenticated using (
  job_id in (select j.id from public.jobs j join public.employers e on e.id = j.employer_id where e.owner_id = auth.uid()));

-- Paid / admin-controlled fields can only be changed by the backend (service role, e.g. a Stripe webhook),
-- never by an employer editing their own row.
create function public.protect_employer_fields() returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and (new.plan is distinct from old.plan or new.verified is distinct from old.verified) then
    raise exception 'plan and verified can only be changed by an admin';
  end if;
  return new;
end $$;

create function public.protect_job_fields() returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and (new.featured_until is distinct from old.featured_until
          or new.expires_at is distinct from old.expires_at
          or (new.status = 'active' and old.status <> 'active')) then
    raise exception 'featuring, extending, or activating a job is done by an admin';
  end if;
  return new;
end $$;

create trigger employers_protect before update on public.employers for each row execute function public.protect_employer_fields();
create trigger jobs_protect before update on public.jobs for each row execute function public.protect_job_fields();
