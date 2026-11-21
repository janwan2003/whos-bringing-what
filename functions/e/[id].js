// Serves the list page with a link preview (Open Graph) that shows live state, e.g.
// "Friendsgiving at Sam's · 9 of 14 covered · still needed: 2 sides, drinks".
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00Z');
  if (isNaN(dt)) return '';
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export async function onRequestGet({ request, env, params }) {
  const url = new URL(request.url);
  const page = await env.ASSETS.fetch(new URL('/e', url.origin));
  let html = await page.text();
  let title = "Who's bringing what? · Claim a dish";
  let desc = 'Tap to see the list and claim what you will bring. No sign-up, no app.';
  try {
    const id = String(params.id || '');
    if (/^[A-Za-z0-9]{6,16}$/.test(id)) {
      const ev = await env.DB.prepare('SELECT name, event_date FROM events WHERE id = ?1').bind(id).first();
      if (ev) {
        const [cats, its, people] = await env.DB.batch([
          env.DB.prepare('SELECT id, name FROM categories WHERE event_id = ?1 ORDER BY position, rowid').bind(id),
          env.DB.prepare('SELECT category_id, label, claimed_by FROM items WHERE event_id = ?1 AND is_slot = 1').bind(id),
          env.DB.prepare('SELECT COUNT(*) AS c FROM members WHERE event_id = ?1').bind(id),
        ]);
        const total = its.results.length;
        const openItems = its.results.filter((i) => !i.claimed_by);
        const open = openItems.length;
        const need = [];
        for (const c of cats.results) {
          const o = openItems.filter((i) => i.category_id === c.id);
          if (o.length) need.push(o.length === 1 ? o[0].label.toLowerCase() : `${o.length} ${c.name.toLowerCase()}`);
        }
        title = `${ev.name} · Who's bringing what?`;
        const bits = [];
        if (ev.event_date) bits.push(fmtDate(ev.event_date));
        const n = people.results[0] ? people.results[0].c : 0;
        bits.push(`${n} ${n === 1 ? 'person' : 'people'} in`);
        if (total) bits.push(open ? `${total - open} of ${total} covered` : `all ${total} covered`);
        desc = bits.join(' · ') + '.';
        if (need.length) desc += ` Still needed: ${need.slice(0, 4).join(', ')}${need.length > 4 ? '…' : ''}.`;
        desc += ' Tap to claim a dish, no sign-up.';
      }
    }
  } catch (e) {
    console.error(e);
  }
  const canonical = `${url.origin}${url.pathname}`;
  const meta = `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Who's Bringing What">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${url.origin}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="noindex">`;
  html = html.replace(/<!--META-->[\s\S]*?<!--\/META-->/, meta);
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
