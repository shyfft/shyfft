create or replace function public.protect_post_counters() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' then
    new.like_count := old.like_count;
    new.comment_count := old.comment_count;
    new.user_id := old.user_id;
  end if;
  return new;
end $$;
create trigger posts_protect before update on public.posts for each row execute function public.protect_post_counters();

create policy "media public read" on storage.objects for select using (bucket_id = 'media');
create policy "media upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
