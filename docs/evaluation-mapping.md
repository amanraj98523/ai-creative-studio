# Evaluation Mapping (Rubric → Evidence)

| Evaluation Criteria | What was implemented | Where to verify |
|---|---|---|
| Functionality: both workflows end-to-end | Text workflow + Image workflow complete with generation outputs | App UI (`/`), demo video sections 0:30–3:20 |
| API Integration: number/variety | Multiple Lovable AI-backed function flows (enhancement, text-image generation, image analysis, image-based generation) | `supabase/functions/*` |
| UI/UX clarity | Two clear tabs, status states, result cards, history panel, validation toasts | `src/pages/Index.tsx` |
| Hosting & deployment | Ready for published link + repo link in README | README “Live & Repository” section |
| Documentation quality | Setup, architecture, API usage, screenshots checklist, known limits | `README.md` |
| Execution video quality | Minute-by-minute script covering both workflows and rubric points | `docs/video-script.md` |
| Bonus potential | Variation/similar modes, run history, prompt reuse actions | `src/pages/Index.tsx` |

## Security & Reliability Notes

- Server-side API calls only (no private keys in client).
- Input validation on client and backend.
- Friendly surfaced errors for rate limits and credit issues.