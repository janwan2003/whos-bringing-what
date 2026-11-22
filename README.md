# Who's Bringing What: potluck sign-up in one link

Free at **https://pb-whos-bringing-what.pages.dev**. The host picks an occasion (Friendsgiving, Christmas dinner, potluck, BBQ,
party, New Year's Eve, blank), says how many mains/sides/desserts/drinks are needed, and shares one link in the group chat.
Guests open it on their phone, type a first name and tap "I'll bring it". No accounts, no app, no ads.

- Claims are first-come (a second claim gets "Dee just took that one"); guests can add extras.
- Duplicate warning while typing ("Ana is already bringing Mashed potatoes"), dish tags (V, VG, GF, DF, Nuts).
- Dietary summary: guests' needs vs. tagged dishes, nut-allergy and "no vegetarian dish yet" alerts.
- Live updates (cheap version poll every 10 s), link preview with live state ("5 of 11 covered · still needed: 3 sides").
- Menu card (screenshot or copy as text), personal link per person (`#k=` token), host edit mode, leave, delete.

## Stack
Cloudflare Pages (static `public/`) + Pages Functions (`functions/`) + D1 (`schema.sql`), free plan, no build step.
Rate limits per IP hash in D1 (create 20/h, join 60/h, writes 600/h). Lists auto-delete 180 days after creation.

## Develop
```
npx -y pnpm@9 install
npx wrangler d1 execute pb-whos-bringing-what --local --file=schema.sql
npx wrangler pages dev --port 8788 --ip 127.0.0.1
npm run test:unit
BASE=http://127.0.0.1:8788 node tests/e2e/run.mjs     # real Chromium, 7 browser contexts, 390/320 px overflow checks, screenshots in shots/
node tools/render-images.mjs                           # og.png + icons
```

## Deploy
```
set -a; . ../../.env; set +a
npx wrangler pages deploy --branch main
BASE=https://pb-whos-bringing-what.pages.dev node tests/e2e/run.mjs   # deletes its own test list
```
