begin;

alter table public.task_comments
  add column parent_comment_id uuid references public.task_comments(id) on delete cascade;

alter table public.task_comments
  add constraint task_comment_not_self_parent check (parent_comment_id is null or parent_comment_id <> id);

create or replace function private.validate_task_comment_parent()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.parent_comment_id is not null and not exists (
    select 1 from public.task_comments parent
    where parent.id = new.parent_comment_id
      and parent.task_id = new.task_id
  ) then
    raise exception 'Reply parent must belong to the same task';
  end if;
  return new;
end;
$$;

create trigger task_comment_parent_consistency
before insert or update of task_id, parent_comment_id on public.task_comments
for each row execute function private.validate_task_comment_parent();

create index task_comments_parent_idx on public.task_comments (parent_comment_id, created_at);

alter function private.validate_task_comment_parent() owner to postgres;

commit;
