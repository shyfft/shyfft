-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  name text not null default '',
  bio text not null default '',
  avatar_url text,
  is_private boolean not null default false,
  verified boolean not null default false,
  onboarded boolean not null default false,
  followers_count int not null default 0,
  following_count int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by signed in" on public.profiles for select to authenticated using (true);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text; candidate text;
begin
  base := lower(regexp_replace(coalesce(split_part(new.email, '@', 1), 'user'), '[^a-z0-9._]', '', 'gi'));
  if length(base) < 3 then base := 'user' || base; end if;
  candidate := left(base, 22) || '_' || substr(md5(new.id::text), 1, 5);
  insert into public.profiles (id, username, name, avatar_url)
  values (new.id, candidate,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- FOLLOWS
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
grant select, insert, delete on public.follows to authenticated;
grant all on public.follows to service_role;
alter table public.follows enable row level security;
create policy "follows readable" on public.follows for select to authenticated using (true);
create policy "follow as self" on public.follows for insert to authenticated with check (auth.uid() = follower_id);
create policy "unfollow as self" on public.follows for delete to authenticated using (auth.uid() = follower_id);

create or replace function public.can_view_user(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select target = auth.uid()
    or exists (select 1 from profiles p where p.id = target and not p.is_private)
    or exists (select 1 from follows f where f.follower_id = auth.uid() and f.following_id = target);
$$;

-- POSTS
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  media_type text not null default 'image' check (media_type in ('image','video')),
  kind text not null default 'post' check (kind in ('post','reel')),
  caption text not null default '',
  location text,
  like_count int not null default 0,
  comment_count int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.posts (created_at desc);
grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "posts visible" on public.posts for select to authenticated using (public.can_view_user(user_id));
create policy "own posts insert" on public.posts for insert to authenticated with check (auth.uid() = user_id);
create policy "own posts update" on public.posts for update to authenticated using (auth.uid() = user_id);
create policy "own posts delete" on public.posts for delete to authenticated using (auth.uid() = user_id);

-- COMMENTS
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (length(text) between 1 and 2200),
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.comments to authenticated;
grant all on public.comments to service_role;
alter table public.comments enable row level security;
create policy "comments visible" on public.comments for select to authenticated
  using (exists (select 1 from posts p where p.id = post_id));
create policy "comment as self" on public.comments for insert to authenticated with check (auth.uid() = user_id);
create policy "delete own comment" on public.comments for delete to authenticated using (auth.uid() = user_id);

-- LIKES / SAVES
create table public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
grant select, insert, delete on public.likes to authenticated;
grant all on public.likes to service_role;
alter table public.likes enable row level security;
create policy "own likes read" on public.likes for select to authenticated using (auth.uid() = user_id);
create policy "like as self" on public.likes for insert to authenticated with check (auth.uid() = user_id);
create policy "unlike as self" on public.likes for delete to authenticated using (auth.uid() = user_id);

create table public.saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
grant select, insert, delete on public.saves to authenticated;
grant all on public.saves to service_role;
alter table public.saves enable row level security;
create policy "own saves" on public.saves for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- STORIES
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.stories to authenticated;
grant all on public.stories to service_role;
alter table public.stories enable row level security;
create policy "stories visible 24h" on public.stories for select to authenticated
  using (created_at > now() - interval '24 hours' and public.can_view_user(user_id));
create policy "own story insert" on public.stories for insert to authenticated with check (auth.uid() = user_id);
create policy "own story delete" on public.stories for delete to authenticated using (auth.uid() = user_id);

-- BLOCKS / REPORTS
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
grant select, insert, delete on public.blocks to authenticated;
grant all on public.blocks to service_role;
alter table public.blocks enable row level security;
create policy "own blocks" on public.blocks for all to authenticated using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete set null,
  post_id uuid references public.posts(id) on delete set null,
  reason text not null,
  created_at timestamptz not null default now()
);
grant insert on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "report as self" on public.reports for insert to authenticated with check (auth.uid() = reporter_id);

-- MESSAGES
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (length(text) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.messages (sender_id, recipient_id, created_at);
grant select, insert, update on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "participants read" on public.messages for select to authenticated using (auth.uid() in (sender_id, recipient_id));
create policy "send as self" on public.messages for insert to authenticated with check (
  auth.uid() = sender_id and not exists (select 1 from blocks b where b.blocker_id = recipient_id and b.blocked_id = sender_id));
create policy "recipient marks read" on public.messages for update to authenticated using (auth.uid() = recipient_id);

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('like','comment','follow','mention')),
  post_id uuid references public.posts(id) on delete cascade,
  text text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "mark own read" on public.notifications for update to authenticated using (auth.uid() = user_id);

-- COUNTERS + NOTIFICATION TRIGGERS
create or replace function public.on_like_change() returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if tg_op = 'INSERT' then
    update posts set like_count = like_count + 1 where id = new.post_id returning user_id into owner;
    if owner is not null and owner <> new.user_id then
      insert into notifications (user_id, actor_id, type, post_id) values (owner, new.user_id, 'like', new.post_id);
    end if;
    return new;
  else
    update posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end $$;
create trigger likes_change after insert or delete on public.likes for each row execute function public.on_like_change();

create or replace function public.on_comment_change() returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if tg_op = 'INSERT' then
    update posts set comment_count = comment_count + 1 where id = new.post_id returning user_id into owner;
    if owner is not null and owner <> new.user_id then
      insert into notifications (user_id, actor_id, type, post_id, text) values (owner, new.user_id, 'comment', new.post_id, left(new.text, 140));
    end if;
    return new;
  else
    update posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end $$;
create trigger comments_change after insert or delete on public.comments for each row execute function public.on_comment_change();

create or replace function public.on_follow_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update profiles set followers_count = followers_count + 1 where id = new.following_id;
    update profiles set following_count = following_count + 1 where id = new.follower_id;
    insert into notifications (user_id, actor_id, type) values (new.following_id, new.follower_id, 'follow');
    return new;
  else
    update profiles set followers_count = greatest(followers_count - 1, 0) where id = old.following_id;
    update profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    return old;
  end if;
end $$;
create trigger follows_change after insert or delete on public.follows for each row execute function public.on_follow_change();

-- Blocking removes follows both ways
create or replace function public.on_block() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from follows where (follower_id = new.blocker_id and following_id = new.blocked_id)
    or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end $$;
create trigger blocks_insert after insert on public.blocks for each row execute function public.on_block();

-- Prevent users from self-granting verified badge or editing counters
create or replace function public.protect_profile_fields() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' then
    new.verified := old.verified;
    new.followers_count := old.followers_count;
    new.following_count := old.following_count;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_fields();

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
