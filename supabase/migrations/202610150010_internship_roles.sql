begin;

create table public.internship_roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint internship_role_slug_present check (length(btrim(slug)) >= 3),
  constraint internship_role_name_present check (length(btrim(name)) >= 3)
);

insert into public.internship_roles (slug, name, sort_order) values
  ('frontend-developer', 'Frontend Developer', 1),
  ('backend-developer', 'Backend Developer', 2),
  ('ui-ux-developer', 'UI/UX Developer', 3),
  ('ui-ux-designer', 'UI/UX Designer', 4),
  ('data-researcher', 'Data Researcher', 5),
  ('graphic-designer', 'Graphic Designer', 6);

alter table public.internship_roles enable row level security;
alter table public.internship_roles force row level security;
revoke all on public.internship_roles from anon, authenticated;

commit;
