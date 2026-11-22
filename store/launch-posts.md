# Launch posts: Who's Bringing What

Ready-to-paste copy for the operator to post **from their own accounts**. Nothing here has been posted. Written 2026-11-22.

Ground rules (apply to every section):
- One post per community, by a real person who will answer comments. No sockpuppets, no asking friends to upvote, no
  cross-posting the same text to many subreddits on one day.
- 0 real users so far (prod D1 count 0, VENTURE.md 2026-11-22). Never imply traction, reviews or testimonials.
- These drafts were written with an AI assistant. r/webdev bans "LLM generated content" (rule 8), and HN readers notice it, so
  **rewrite each post in your own words before posting**. The app itself was built with an AI coding assistant (commit
  co-author); say so if asked.
- Product facts come from the repo (`README.md`, `VENTURE.md`, `functions/api/[[path]].js`) and the live site's meta tags (curl,
  2026-11-22). External facts carry a source tag: **[opened]** = I fetched the page, **[snippet]** = search result only,
  **[archive]** = Wayback Machine copy, because the live page blocked automated fetches.

Links: app https://pb-whos-bringing-what.pages.dev · about/support https://janwan2003.github.io/whos-bringing-what/ ·
source https://github.com/janwan2003/whos-bringing-what

---

## 1. Product Hunt

**When:** Tue 1 Dec 2026, 00:01 PT (Christmas-potluck planning season). Mon 23 Nov would catch Thanksgiving but leaves
almost no time to react. This timing is my judgment, not sourced.

- **Name:** Who's Bringing What
- **Tagline (49 chars):** `Potluck sign-up in one link. No accounts, no ads.`
- **Description (247 chars):**
  `Make a potluck list, drop one link in the group chat, and guests claim a dish with just a first name. It warns about duplicate dishes, sums up dietary needs (like a nut allergy next to a nut dish) and shows what's still needed. Free, no app, no ads.`
- **Topics:** Events, Food & Drink, Productivity (all three topic pages exist, [opened] producthunt.com/topics/events,
  /topics/food-drink, /topics/productivity, 2026-11-22).

**First maker comment:**

> Hi PH, I'm with Plainbyte, a small studio. We made this because every Friendsgiving group chat ends with three potato
> salads and no ice.
>
> How it works: the host picks an occasion (Friendsgiving, Christmas dinner, potluck, BBQ, party, New Year's Eve), sets
> how many mains, sides, desserts and drinks are needed, and shares one link. Guests open it on their phone, type a first
> name and tap "I'll bring it". It warns you while you type if someone already has that dish. Dishes can be tagged
> vegetarian, vegan, gluten-free, dairy-free or contains nuts, and a summary flags clashes like a nut allergy next to a nut
> dish. The chat link preview shows live progress ("5 of 11 covered · still needed: 3 sides").
>
> It's free: no accounts, no emails, no ads. Lists delete themselves after 180 days. It's brand new and nobody has used it
> for a real dinner yet, so I'd really like to hear what breaks or what's missing for your gathering.

---

## 2. AlternativeTo

**Listing:**
- **Name:** Who's Bringing What
- **URL:** https://pb-whos-bringing-what.pages.dev
- **Short description:** `Free potluck sign-up list: share one link, guests claim a dish with just a first name. No accounts, no ads.`
- **Long description:**
  > Who's Bringing What is a free potluck sign-up list built for group chats. The host picks an occasion template
  > (Friendsgiving, Christmas dinner, potluck, BBQ, party, New Year's Eve), sets how many mains, sides, desserts and drinks
  > are needed, and shares one link. Guests open it on a phone, type a first name and tap "I'll bring it". There are no
  > accounts, no emails, no app and no ads.
  >
  > It warns about duplicate dishes while you type, lets guests tag dishes (vegetarian, vegan, gluten-free, dairy-free,
  > contains nuts), and shows a dietary summary that flags clashes like a nut-allergy guest next to a nut dish. The page
  > updates live, the link preview shows what's still needed, and there's a menu card to screenshot. Lists auto-delete
  > after 180 days.
- **Platform:** Web / Online. **License:** Free (the source is public on GitHub but has no license file, so don't call it
  "Open Source").
- **Tags (suggestions; I did not check AlternativeTo's tag vocabulary):** potluck, sign-up-sheet, event-planning,
  party-planning, no-registration-required, ad-free, mobile-friendly.

**List it as an alternative to:**

| App | On AlternativeTo? | Source |
|---|---|---|
| SignUpGenius | Yes, `/software/signupgenius/`, 22 alternatives | [opened] https://alternativeto.net/software/signupgenius/about/ |
| Whocan | Yes, `/software/whocan/`; describes itself as "who brings what" polls, no account | [opened] https://alternativeto.net/software/whocan/about/ |
| Evite | Yes, `/software/evite/`, 50 alternatives | [opened] https://alternativeto.net/software/evite/about/ |
| SignUp.com | Yes, slug `/software/mysignup/` | seen in the alternatives list on [opened] https://alternativeto.net/software/signupgenius/ (I did not open its own page) |
| PerfectPotluck | **No.** `/software/perfectpotluck/` and `/software/perfect-potluck/` both 404 | [opened] 2026-11-22 |

Close no-login potluck tools already listed there as SignUpGenius alternatives: Signappy, Venuva, Clipform, SameTeam
([opened] the SignUpGenius alternatives page above). Expect to be compared with them and with Whocan.

---

## 3. Reddit

**What I could verify:** Reddit blocked every live fetch (HTTP 403 from curl, and the fetch tool refused reddit.com and
old.reddit.com), and the redlib mirrors didn't resolve. So every rule below comes from a **Wayback Machine snapshot**
[archive] with the date given. **Re-read the live sidebar and rules before posting**, because they may have changed since.

| Subreddit | Verdict | Rules as archived | Best day/thread |
|---|---|---|---|
| r/SideProject | **Post** | Sidebar: "a subreddit for sharing and receiving constructive feedback on side projects". Link titles use the format "[Project name] - [Short description]". The rules page listed no rules. Snapshot 2026-08-28. A search snippet says pinned 2026 announcements added self-promo and "what are you building" rules; **not verified**. | Any weekday. Mon 23 Nov. |
| r/Thanksgiving | **Post, carefully** | Old-Reddit sidebar: "Understand Reddiquette before posting. Spam will be removed." No explicit self-promo rule. Snapshot 2026-08-29. I could not see new-Reddit rules. | Mon 23 or Tue 24 Nov (planning days). Text post, not a bare link. |
| r/webdev | **Post on Showoff Saturday only** | Rule 3 "No self-promotion" (9:1 ratio). Rule 4 "no commercial promotion". Rule 5: showing off a project or asking for feedback "is limited to Showoff Saturday… must be tagged with the correct flair… Think project, not product. Focus on the technical details". Rule 8 removes "LLM generated content". Snapshot 2026-07-16. | **Sat 28 Nov 2026**, with Showoff Saturday flair. |
| r/Cooking | **Do not post** | "No social media/blog/YouTube channel spamming or advertisements of any kind… No other advertisement is allowed, even cooking related." Promotion is only allowed for cooking content channels, in the weekly round-up thread. Snapshot 2026-02-19. | n/a |
| r/InternetIsBeautiful | **Do not post** (the rules don't fit) | Self-promo is allowed under a 90/10 rule. But rule 6 bans sites that need "an email address, name, or any other personal information to fully experience", and claiming a dish needs a first name. Rule 2 bans sites that are "very basic" or "very similar to previous submissions". Snapshot 2026-08-28. | n/a |
| r/Potluck | **Do not post** (off-topic) | Sidebar: "A place to share your favorit take-a-long recipes." It's a recipe sub. Snapshot 2025-08-01. | n/a |

Snapshot URLs (all [archive], opened 2026-11-22):
- r/SideProject: https://web.archive.org/web/20260828184531/https://old.reddit.com/r/SideProject/about/rules
- r/Thanksgiving: https://web.archive.org/web/20260829025701/https://old.reddit.com/r/thanksgiving/
- r/webdev: https://web.archive.org/web/20260716085342/https://old.reddit.com/r/webdev/about/rules
- r/Cooking: https://web.archive.org/web/20260219181345/https://old.reddit.com/r/Cooking/
- r/InternetIsBeautiful: https://web.archive.org/web/20260828184634/https://old.reddit.com/r/InternetIsBeautiful/about/rules
- r/Potluck: https://web.archive.org/web/20250801233725/https://old.reddit.com/r/Potluck/
- The r/SideProject 2026 rules claim [snippet]: search "r/SideProject rules self-promotion", results from teract.ai and
  saascity.io guides.

### r/SideProject draft
**Title:** `Who's Bringing What - a potluck sign-up list you share as one link (no accounts)`

> I built this for the "who's bringing what" mess in group chats before Friendsgiving and Christmas dinners.
>
> The host picks an occasion, sets how many mains, sides, desserts and drinks are needed, and drops the link in the chat.
> Guests type a first name and tap "I'll bring it". There's no account, email, app or ads. It flags duplicate dishes while
> you type, lets you tag dishes (vegetarian, vegan, GF, DF, nuts), and sums up dietary needs. The link preview shows
> what's still missing.
>
> It's free and brand new: nobody has used it for a real dinner yet. Feedback I'd find useful: does the claim flow make
> sense on your phone, and what's missing for your kind of gathering?
>
> https://pb-whos-bringing-what.pages.dev

### r/Thanksgiving draft
**Title:** `I made a free sign-up list for who's bringing what to Thanksgiving, and I'd like feedback before Thursday`

> Disclosure: I made this (a small studio, Plainbyte). It's free with no ads, and I'm not selling anything.
>
> Every year our group chat ends up with three mashed potatoes and no rolls. So I made a list you share as one link. You
> set how many mains, sides, desserts and drinks you need. Guests type a first name and tap a dish, and it warns them if
> someone else already has it. You can tag dishes vegetarian, GF, contains nuts and so on, and it'll flag a nut dish if a
> guest has a nut allergy. Lists delete themselves after 180 days.
>
> If you're hosting this week and try it, I'd like to hear what was confusing or missing. If this isn't OK here, mods,
> please remove it.
>
> https://pb-whos-bringing-what.pages.dev

### r/webdev Showoff Saturday draft (Sat 28 Nov, flair: Showoff Saturday)
**Title:** `Showoff Saturday: a no-account potluck sign-up list on Cloudflare Pages + D1, vanilla JS, no build step`

> A small project: a list you share as one link, where guests claim dishes for a potluck. The technical bits:
> - Static HTML/vanilla JS on Cloudflare Pages, Pages Functions for the API, D1 (SQLite) for storage. No framework, no
>   build step, free plan.
> - No accounts. Each person gets a random token, and only its SHA-256 hash is stored. Your "personal link" carries the
>   token in the URL fragment (`#k=`), so it never reaches the server in the request line. The page strips it from the
>   address bar after reading it.
> - Live updates are a cheap version poll every 10 s, not WebSockets.
> - The link preview (OG tags) is rendered per list by a Function, so a chat shows "5 of 11 covered · still needed: 3 sides".
> - Rate limits are keyed on a hashed IP and stored in D1. Same-origin check on writes, CSP. Lists older than 180 days are purged
>   lazily, whenever a new list is created (no cron).
> - The duplicate-dish warning is a small fuzzy matcher with stemming. "Mashed potato" matches "Mashed potatoes", but
>   sharing one generic word doesn't count, so "Green salad" doesn't match "Potato salad".
>
> Feedback I'd like: is polling a sensible trade-off at this size, and does the claim flow hold up on your phone?
> https://pb-whos-bringing-what.pages.dev · source: https://github.com/janwan2003/whos-bringing-what

---

## 4. Hacker News

Show HN rules ([opened] https://news.ycombinator.com/showhn.html, 2026-11-22): it must be something people can try
"without signups or emails", that you built and are around to discuss; no landing pages; "Don't ask friends to upvote or
comment." It qualifies. Post on a weekday morning US time, and don't share the HN link asking for votes.

**Title:** `Show HN: Who's Bringing What – potluck sign-up list, no accounts`

**URL:** https://pb-whos-bringing-what.pages.dev

**First comment:**

> I made this for coordinating Friendsgiving and Christmas potlucks without a spreadsheet or a sign-up site that asks
> guests for an email. The host makes a list with counts per category and shares the link. Guests type a first name and
> claim a dish.
>
> Stack: Cloudflare Pages serving static HTML and vanilla JS, with no build step. The API runs on Pages Functions and data
> lives in D1. No accounts: on join, the server issues a random token and stores only its SHA-256. The client keeps the
> token in localStorage, and the "personal link" for another device puts it in the URL fragment. Rate limits are per
> hashed IP, in D1. Live updates are a version-number poll every 10 s. The OG tags are rendered per list so the chat
> preview shows current counts. The OG image is still static. Lists are deleted 180 days after creation.
>
> Not done yet: testing in real iOS/Android in-app browsers (WhatsApp, iMessage), other languages, and any load testing.
> I wrote it with a lot of help from an AI coding assistant. It has no users yet, so bug reports are very welcome.
>
> Source: https://github.com/janwan2003/whos-bringing-what

---

## 5. Message to a friend hosting Friendsgiving

> Hey! Are you hosting Friendsgiving this year? I helped make a little thing for exactly the "who's bringing what" chaos:
> you make a list (how many sides, desserts, drinks…), drop one link in the group chat, and people just tap a dish with
> their first name. No app or sign-up. It also warns about duplicate dishes and flags things like nut allergies.
> https://pb-whos-bringing-what.pages.dev
> Totally fine if you'd rather stick with the chat. But if you try it, I'd love to hear what was annoying. You'd be the
> first real dinner on it!
