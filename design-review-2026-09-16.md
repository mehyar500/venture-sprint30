# Sprint30 — Design Review: Sample Pages + Fixes (2026-09-16)

## Buyer monologue
Another 30-day challenge — I've bought these before and quit by day 6.
Show me what a day actually looks like, not the hype.
$37 for 30 days of homework? The days better be real.
I like that days 1–3 are free — let me judge the actual content.
If the missions look sharp and there's a human behind replies, maybe.

## Pass 1 issues
1. **No visual of a mission page.** Buyers saw teaser text only; nothing showed
   what a paid day looks like.
2. **Body font-size 15px** — below the 16px mobile standard.
3. **Nav CTA ~36px tall**; nav text links risked 390px overflow.
4. **Fabricated testimonials.** The "What sprinters say" section contained invented
   quotes — labeled "Sample", but still fabricated; violates the no-fake-testimonials rule.
5. **Unsupported competitor claims.** Pricing compared against "Typical course
   $297+" / "Generic guru $1,997" — unsubstantiated market figures.
6. **Unsubstantiated outcome language.** FAQ said the sprint "starts paying for itself".

## Fixes applied
1. Rendered 3 SAMPLE-marked mission-page PNGs (900x1165) using the real Days 1–3
   content from missions.json; new `#samples` gallery section ("What a mission
   looks like") with dimensions, alt text, loading="lazy", 1-col -> 3-col grid.
2. Body font-size -> 16px.
3. Nav CTA min-height 44px (inline-flex); nav text links hidden at <=640px.
4. Removed the fabricated reviews section entirely.
5. Replaced competitor comparison with factual Free (Days 1–3 on-page) vs Paid
   ($37: all 30 missions by email, dashboard, reply-to-a-human).
6. FAQ rewritten: day 4 is "where the paid missions begin and the 30-day system
   kicks in."

## Pass 2 result
Verified in code: 3 images at 900x1165 with dims/alt/lazy; no testimonial content
remains; no unsupported price/outcome claims; base 16px; tap targets >=44px;
viewport meta present; no 390px overflow risks. Note: screenshots were unavailable
by task constraint, so this was a source-code/mobile CSS review (no browser pass).

## Verdict
SHIP — no material issue remains.
