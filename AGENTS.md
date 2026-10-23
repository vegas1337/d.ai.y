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

- AI repair logic lives in `src/lib/repair.functions.ts` (server fns) with prompts versioned via `PROMPT_VERSION`; gateway calls only in `src/lib/ai.server.ts`. Why: keeps prompts traceable and secrets server-side.
- Safety is enforced in code (`detectHazards` before AI, `enforceSafety` after) in `src/lib/repair.schema.ts`, covered by `src/test/safety.test.ts`. Why: AI output must never bypass hazard escalation.
- Product offers are sample data in `src/lib/offers.ts` until real retailer integrations exist. Why: MVP scope.
