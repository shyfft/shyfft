alter table public.messages add column delivered_at timestamp with time zone;
alter table public.messages add column media_url text;
alter table public.messages add column media_type text;
alter table public.messages add column post_id uuid references public.posts(id) on delete set null;

comment on column public.messages.delivered_at is 'Set by the recipient app when the message reaches their device';
comment on column public.messages.media_url is 'Storage path in the private media bucket for photo/video attachments';
comment on column public.messages.post_id is 'Shared post/reel reference; chat renders a preview card linking to the original';

-- recipients may mark delivered as well as read (existing UPDATE policy already covers recipient updates)
create index messages_recipient_unread_idx on public.messages (recipient_id) where read_at is null;