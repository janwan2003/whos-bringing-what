---
slug: whos-bringing-what
stage: launched
priority: 5
url: https://pb-whos-bringing-what.pages.dev
repo: https://github.com/janwan2003/whos-bringing-what
updated: 2026-11-21
---

## Thesis
**Who:** anyone hosting a shared meal: Friendsgiving and Thanksgiving, Christmas dinners, New Year's, BBQs, office and
class potlucks, game nights. **Problem:** "who's bringing what" is coordinated in messy group chats (three people bring
potato salad, nobody brings ice) or in a Google Sheet that is miserable on a phone. Sign-up sites show ads to guests or ask
for emails. **What:** the host makes a list (mains, sides, desserts, drinks, with how many of each) and drops one link in
the group chat. Guests open it on their phone, type a first name and tap "I'll bring it". Duplicates are flagged and
dietary needs are summarised. **Why now:** US Thanksgiving is 26 Nov 2026, then Christmas and New Year: the peak season.

## Market evidence
Checked 2026-11-21 by a research subagent (about 20 web searches, about 14 page fetches). [opened] = the page was fetched;
[snippet] = seen only in search results.
- **Demand:** "potluck sign up sheet" ≈ 16,600 searches/month, "potluck sign up" ≈ 12,900, CPC ≈ $1.24 (Semrush snippet for
  [perfectpotluck.com](https://ja.semrush.com/website/perfectpotluck.com/overview) [snippet; the page 404ed, so the month and region are unknown]).
  Most Friendsgivings are potluck-style, and about a quarter of hosts ask guests to sign up ([Axios 2019](https://www.axios.com/2019/11/28/friendsgiving-increase-popularity-changes-society) [snippet]).
- **Whocan** ([whocan.org Friendsgiving sheet](https://www.whocan.org/en/friendsgiving-potluck-sign-up-sheet/) [opened]):
  "Free, no accounts, ready in 60 seconds", dietary tags/comments, prevents duplicates; founded 2022 in Zurich, 6 languages.
  **The closest competitor; it already has the no-login pitch.** Unverified: ads, how it looks on a phone, any dietary summary.
- **PerfectPotluck** ([perfectpotluck.com](https://www.perfectpotluck.com/) [opened]): "Nobody needs an account"; guests join via
  an email link or password; no dietary features mentioned.
- **SignUpGenius** ([ads page](https://www.signupgenius.com/blog/feature-no-ads-free-tips) [opened]): free sheets show ads to
  people signing up; removing them requires the host to pay. Guests give name + email [snippet].
- **Potluck Coordinator** (iOS, [App Store](https://apps.apple.com/us/app/id6763724451) [opened]): 3.7★ from 26 ratings,
  iPhone-only, dietary tags partly behind a $3.99–7.99/mo Pro tier; a review says "Will not let guests save keeps giving error".
- Others seen: [MealTrain potluck](https://www.mealtrain.com/learn/potluck/) [opened, no dietary features], Grasshopper Signup,
  Evite sign-up sheets (guests need an account), SignUp.com, Cheddar Up, Jotform/Google Sheets templates [snippets].
- Not found: Reddit threads (the search tool returned none), Google Trends seasonality.
- Overlap inside the studio: `signup-sheet` (idea, priority 3) targets the general sign-up-sheet market (SignUpGenius); this
  venture is the food/occasion-specific version. Worth deciding later whether signup-sheet should reuse this code.

## Our edge
- **Loop: needs others.** A list nobody else opens is useless; claiming is the use.
- **K estimate ≈ 1.2–2** = ~10 guests per event × ~85% open and claim (they must, to sign up) × ~15–20% host something
  within weeks (Thanksgiving → Christmas → New Year in 6 weeks). Weakest factor: guest → host. Designed for with a
  "Hosting something too? Start your own list" card on every list page and the menu card footer.
- **vs Whocan/PerfectPotluck:** phone-first page built for the group chat (one tap to claim, bottom-sheet forms, 44 px targets);
  a **live link preview** ("Fri Nov 27 · 5 people in · 5 of 11 covered. Still needed: 3 sides, drinks"); a **dietary summary**
  that cross-checks guests' needs against tagged dishes (nut-allergy alert, "no vegetarian dish yet"); occasion templates;
  live updates; a menu card to screenshot or paste into the chat. No ads, no emails.
- **Honest risk:** "no login + dietary + no duplicates" is not unique (Whocan has it). The bet is UX and the loop, not features.
  Search is crowded (SignUpGenius, SignUp.com, Jotform blogs), so growth must come from links shared in group chats.

## Status
**Live: https://pb-whos-bringing-what.pages.dev** (deploy db8eb27b). Product/support/privacy page on GitHub Pages:
https://janwan2003.github.io/whos-bringing-what/ . Search Console: site verified (META) and sitemap submitted 2026-11-21.

What exists (Cloudflare Pages + Functions + D1 `pb-whos-bringing-what`, free plan, vanilla JS, no build step):
- Home: 7 occasion templates with editable categories and −/+ counts, optional date/time/place, host name. FAQ, How it works, "Your lists on this device".
- List page `/e/<id>`: progress bar + "still needed", share (Web Share API, copy fallback), menu card (screenshot or copy as text),
  claim sheet (name + optional dietary needs on first claim, dish name, tags), "+ Bring something else" extras,
  live duplicate warning, nut-allergy warning, first-come claims with a clear "X just took that one", edit/drop own dish,
  "Add my name" without a dish, dietary summary card, who's coming, personal link (`#k=` token, stripped from URL), leave.
- Host: edit details, add/rename/delete categories, request specific items, rename/delete slots, free up claims, remove people, delete list.
- Link preview rendered per list by `functions/e/[id].js` with live counts. Static og.png (not per list yet).
- Safety: tokens stored as SHA-256; rate limits per IP hash in D1 (create 20/h, join 60/h, writes 600/h); same-origin check on writes;
  CSP + security headers; input caps (12 categories, 150 items, 150 people); lists auto-deleted after 180 days (on create, no cron).

Verified 2026-11-21:
- `npm run test:unit`: 4/4 pass (duplicate matcher: same dish in other words flagged, generic-word pairs not flagged, stemming; templates within limits).
- `tests/e2e/run.mjs` in real Chromium (7 browser contexts: host desktop 1280 px, guests phone 390 px) **passes locally and on
  production** (deploy 28168cf5): template switch, validation, create, host claim, OG text before/after, guest claim with diet,
  live update on the host page without reload, name-only join, duplicate warning appears and clears, nut-allergy warning,
  claim race (second gets "Dee just took that one", stays joined), duplicate name rejected, dietary summary text, edit/drop/re-claim,
  personal link on a new device, menu card, edit mode (remove guest frees their dish, rename category), counts after,
  leave, home "Your lists", delete → "This list is gone" + API 404, zero unexpected console errors. The test deletes its own list
  (prod D1 counts after: 0 events, 0 members, 0 items).
- Screenshots checked by eye: home desktop, list page phone (guest), claim sheet phone, menu card + host page desktop. Fixed a
  render bug found that way (arrays/nulls passed to `replaceChildren`) and a host-delete flow that re-fetched the deleted list.
- Rate limit checked locally: creates returned 201 until 20 in the hour, then 429.
- Live URL checks: `/`, `/privacy`, robots, sitemap, og.png, icons, manifest all 200; CSP and X-Frame-Options headers present.

Not covered yet: real iOS Safari / Android Chrome and WhatsApp/iMessage in-app browsers and preview rendering; per-list OG image;
languages other than English; load beyond a handful of users; accessibility audit beyond labels/roles.

## Next steps
1. **Seed distribution before Thanksgiving (26 Nov) and Christmas:** write `store/launch-posts.md` with honest posts
   (Product Hunt, AlternativeTo as an alternative to SignUpGenius/PerfectPotluck/Whocan, relevant subreddits' rules permitting);
   posting needs the operator's accounts, so ask in the inbox. Never spam.
2. Per-list OG image (PNG from the Function, e.g. "5 of 11 covered · still needed: 3 sides") so the chat preview visibly counts up.
3. SEO landing pages for the searches that exist: `/friendsgiving-sign-up-sheet`, `/christmas-potluck-sign-up`, `/bbq-sign-up-sheet`
   (each opening the right template), add to sitemap.
4. Quality on real devices (in-app browsers), add-to-calendar (.ics) on the list page, print view of the menu card.
5. Weekly `## Metrics` from D1: `SELECT COUNT(*) FROM events WHERE created_at > ?` (creators) and non-host members (joiners).

## Monetization plan
None until the operator enables it (charter rule 4). Later options: premium themes/printable menu cards, a recipe or grocery
partner (affiliate, after registration). Never paywall claiming, list size or dietary features.

## Metrics
- 2026-11-21: launched today; 0 real lists (prod D1 `events` count 0 after the e2e test deleted its own list). Search Console: no data yet.

## Log
- 2026-11-20 (operator session): seeded as a priority-5 idea.
- 2026-11-21 builder: evidence check via research subagent (Whocan found as the closest no-login competitor; demand ≈ 16.6k/mo
  "potluck sign up sheet" from a Semrush snippet). Designed, built and deployed the app on Cloudflare (Pages + Functions + D1, all `pb-`),
  repo + GitHub Pages product/privacy page, Search Console verified + sitemap submitted. Unit 4/4 pass; Playwright e2e (7 contexts)
  passes locally and on production deploy 28168cf5. Stage → launched.
