drop policy "media public read" on storage.objects;
create policy "media read signed in" on storage.objects for select to authenticated using (bucket_id = 'media');