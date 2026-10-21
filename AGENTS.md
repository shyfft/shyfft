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
- All app data flows through `src/lib/store.tsx` actions over types in `src/lib/types.ts`; swap action bodies for backend calls when Cloud is connected so pages don't change.
- Reusable UI lives in `src/components/shyfft/`; pages in `src/routes/`.
