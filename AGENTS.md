<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- All app data flows through `src/lib/store.tsx` (loads from the database, optimistic actions, realtime for messages/notifications) over UI types in `src/lib/types.ts`; pages never query the database directly so data access stays in one place.
- Every app page lives under `src/routes/_authenticated/` (client-only sign-in gate + onboarding redirect); only `/auth` and `/reset-password` are public, because the whole app needs a signed-in user.
- Media lives in a private `media` storage bucket under `<user_id>/...`; the DB stores paths and the store turns them into signed URLs, because the workspace blocks public buckets.
- Like/comment/follower counts and notifications are maintained by DB triggers, and a trigger blocks users from editing counters/verified, so clients never write them.
- Reusable UI lives in `src/components/shyfft/`.
- Admin permissions/reports data access lives in `src/lib/admin.ts`; backend functions (`has_admin_perm`, `set_admin_permissions`) enforce who can do what.
