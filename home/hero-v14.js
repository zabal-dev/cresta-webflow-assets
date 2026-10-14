/* =====================================================================
   CRESTA · HOME HERO
   - intro (from the client prototype): the sentence in .home-hero_intro is
     wedged apart by a growing video deck that riffles the three clips, then
     spreads into the slider row while the headline blows out. Runs on a fresh
     load at the top of the page only (skipped on back/forward, with a #hash,
     mid-page, with reduced motion, in the Designer, or with
     data-intro="off" on .home-hero_component)
   - desktop (≥992px): pinned scroll expansion of the slider (unchanged)
   - slider: drag / swipe / click a side card, auto-advance
   - UI overlays: a 1:1 port of the prototype's timelines (Automate chat,
     Augment transcript + Agent Assist rail, Analyze widgets + cursor)
   - progress ring doubles as play / pause
   Requires GSAP + ScrollTrigger loaded before this script.
   ===================================================================== */
(() => {
  /* ------------------------------------------------------------------
     ASSETS — Webflow asset URLs (already filled in)
     ------------------------------------------------------------------ */
  const HERO_UI_ASSETS = {
    loaderGif: 'https://cdn.prod.website-files.com/67fe49bf21b9f9d5b910d3c9/6ac8c81ee0cc34638a56b203_cresta-loader.gif',
    loaderStill: 'https://cdn.prod.website-files.com/67fe49bf21b9f9d5b910d3c9/6ac8c81db3b8089125af93e9_cresta-loader-still.png',
    agentAvatar: 'https://cdn.prod.website-files.com/67fe49bf21b9f9d5b910d3c9/6ac8c81eb5cf5ce1b0e4bc45_agent-neda-avatar.jpg',
  };

  /* how many times each clip plays while its story runs. The stories are cut to the
     clips (Grace's lines match the bubbles), so every clip plays once, from 0, in step
     with its thread; a slide holds for max(clip length × loops, its thread length). */
  const VIDEO_LOOPS = [1, 1, 1];

  /* video framing (from the prototype): `focal` is the point of interest in the clip
     (0–1 of its width / height), `aim` is where that point should sit in the card;
     `aimTall` is used when the card is taller than it is wide (phones) */
  const VIDEO_FRAMING = [
    { focal: [0.33, 0.3], aim: [0.38, 0.42], aimTall: [0.5, 0.4] }, // Automate
    { focal: [0.56, 0.36], aim: [0.5, 0.42], aimTall: [0.5, 0.4] }, // Augment
    { focal: [0.68, 0.32], aim: [0.5, 0.42], aimTall: [0.5, 0.4] }, // Analyze
  ];

  /* ==================================================================
     UI ENGINE  (ported from the prototype)
     ================================================================== */
  function createHeroUI(component) {
    const cl = (v) => Math.max(0, Math.min(1, v));
    const ez = (v) => 1 - Math.pow(1 - v, 5);
    const spring = (v) => (v >= 1 ? 1 : 1 - Math.pow(2, -9 * v) * Math.cos(v * 7.6));

    const roots = {
      automate: component.querySelector('[data-hui="automate"]'),
      augment: component.querySelector('[data-hui="augment"]'),
      analyze: component.querySelector('[data-hui="analyze"]'),
    };
    const ov = roots.automate && roots.automate.querySelector('[data-hui-col]');
    const augL = roots.augment && roots.augment.querySelector('[data-hui-col="left"]');
    const augR = roots.augment && roots.augment.querySelector('[data-hui-col="right"]');
    const anz = roots.analyze && roots.analyze.querySelector('[data-hui-col]');
    const anzCursor = roots.analyze && roots.analyze.querySelector('[data-hui-cursor]');
    const anzRipple = roots.analyze && roots.analyze.querySelector('[data-hui-ripple]');

    /* assets */
    const A = HERO_UI_ASSETS;
    component.querySelectorAll('[data-morph-gif]').forEach((img) => { if (A.loaderStill) img.src = A.loaderStill; });
    component.querySelectorAll('[data-hui-gif]').forEach((img) => { if (A.loaderGif) img.src = A.loaderGif; });
    component.querySelectorAll('[data-hui-avatar]').forEach((img) => { if (A.agentAvatar) img.src = A.agentAvatar; });
    let markBlob = null;
    if (A.loaderGif && window.fetch) {
      const warm = () => fetch(A.loaderGif).then((r) => r.blob()).then((b) => { markBlob = b; }).catch(() => {});
      if (window.requestIdleCallback) requestIdleCallback(warm, { timeout: 4000 }); else setTimeout(warm, 2400);
    }

    /* cadence, in seconds */
    const CHAT = [
      // patient / AI review / patient / AI / email / thanks / call ended / 8h later upload / Deputy / next-day SMS
      { lead: 1.2, tail: 8.0, seq: [0, 2.8, 7.4, 10.0, 12.2, 16.0, 17.8, 19.6, 24.4, 29.4] },
      // rail: Knowledge -> Deputy (files the claim) -> Summary Agent
      { lead: 1.0, tail: 4.8, seq: [0, 2.8, 10.6, 16.2], seqR: [5.4, 11.9, 18.9] },
      // three widgets, two on screen at a time; the tail covers the send click
      { lead: 1.0, tail: 7.6, seq: [0, 3.4, 13.2], max: 3 },
    ];
    const OV_RISE = 1.05;
    const OV_MAX = 4;
    const MORPH_HOLD = 1.7;
    const MORPH_DUR = 0.52;
    const ANZ_CLICK_S = [5.4, 11.8, 17.0];
    const ANZ_TYPE_S = [14.2, 16.6];
    const DEP_HOPS = [[0.6, 1.05, 0, 1], [1.7, 2.1, 1, 2], [2.8, 3.2, 2, 3], [4.4, 4.95, 3, 0]];
    const io = (v) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);

    let narrow = window.innerWidth <= 720;
    let measEpoch = 0;
    const invalidate = () => { measEpoch++; };

    const need = (i) => {
      const c = CHAT[i];
      if (!c) return 0;
      const last = Math.max(c.seq[c.seq.length - 1], c.seqR ? c.seqR[c.seqR.length - 1] : 0);
      return c.lead + last + c.tail;
    };
    const beatsOf = (i, key) => {
      const c = CHAT[i];
      return (c[key] || c.seq).map((s) => c.lead + s);
    };

    function hideThread(wrap) {
      if (!wrap) return;
      wrap._lock = null; wrap._rel = false;
      for (const el of wrap.children) { el._v = 'h'; el.style.visibility = 'hidden'; }
    }

    /* ---------- measurement (once per layout change, never per frame) ---------- */
    function chatMeas(wrap) {
      const n = wrap.children.length;
      let m = wrap._m;
      if (m && m.epoch === measEpoch && m.n === n) return m;
      const els = [...wrap.children];
      const H = wrap.offsetHeight || 420;
      const gap = Math.round(Math.max(9, H * 0.026) * (parseFloat(wrap.dataset.gap) || 1));
      const morphs = els.map((e) => {
        const box = e.querySelector('[data-morph]');
        const a = box && box.querySelector('[data-morph-a]');
        const b = box && box.querySelector('[data-morph-b]');
        if (!a || !b) return null;
        const row = e;
        let pad = 0, cap = Infinity;
        for (let p = box.parentElement; p && p !== row; p = p.parentElement) {
          const s = getComputedStyle(p);
          pad += parseFloat(s.paddingLeft) + parseFloat(s.paddingRight) + parseFloat(s.borderLeftWidth) + parseFloat(s.borderRightWidth);
          const mx = s.maxWidth;
          if (mx && mx !== 'none') cap = Math.min(cap, mx.indexOf('%') > -1 ? row.clientWidth * parseFloat(mx) / 100 : parseFloat(mx));
        }
        const avail = Math.max(80, Math.min(cap, row.clientWidth) - pad);
        const measure = (node) => {
          if (node.hasAttribute('data-morph-full')) { node.style.width = avail + 'px'; return avail; }
          node.style.maxWidth = avail + 'px';
          return Math.min(avail, Math.ceil(node.offsetWidth) + 1);
        };
        const wa = measure(a), wb = measure(b);
        const ha = Math.max(16, a.offsetHeight), hb = Math.max(16, b.offsetHeight);
        box.style.width = wb + 'px';
        box.style.height = hb + 'px';
        const tk = [...b.querySelectorAll('[data-tk]')];
        let acc = 0;
        const tkOff = tk.map((_, i) => {
          const v = acc;
          acc += 0.034 + (((i * 37) % 7) / 7) * 0.03 + (i % 6 === 5 ? 0.075 : 0);
          return v;
        });
        const prev = box._mo;
        const mo = {
          box, a, b, ha, hb, wa, wb,
          gif: box.querySelector('[data-morph-gif]'),
          ring: box.querySelector('[data-check-ring]'),
          mark: box.querySelector('[data-check-mark]'),
          tk, tkOff, tkS: [], cr: b.querySelector('[data-cr]'), bar: b.querySelector('[data-bar]'),
          delay: parseFloat(box.dataset.morphDelay) || 0,
          _live: prev ? prev._live : undefined, _u: prev ? prev._u : null,
        };
        box._mo = mo;
        return mo;
      });
      const grows = els.map((e, i) => {
        const g = e.querySelector('[data-grow]');
        if (!g) return null;
        const inner = g.querySelector('[data-grow-in]') || g;
        g.style.height = 'auto';
        const h = Math.max(0, inner.offsetHeight);
        const mo = morphs[i];
        return { el: g, h, base: Math.max(0, h - (mo ? mo.hb : 0)), at: 2.0 };
      });
      const hs = els.map((e) => e.offsetHeight || 60);
      grows.forEach((g) => { if (g) g.el.style.height = g.el._lastH || '0px'; });
      const tops = []; let acc = 0;
      for (let k = 0; k < hs.length; k++) { tops.push(acc); acc += hs[k] + gap; }
      m = {
        epoch: measEpoch, n, els, H, hs, tops, gap, morphs, grows,
        baseline: H - (wrap.dataset.base != null ? parseFloat(wrap.dataset.base) || 0 : Math.max(24, Math.round(H * 0.07))),
        inners: els.map((e) => e.firstElementChild),
        rings: els.map((e) => { const r = e.querySelector('[data-check-ring]'); return r && !r.closest('[data-morph]') ? r : null; }),
        marks: els.map((e) => { const r = e.querySelector('[data-check-mark]'); return r && !r.closest('[data-morph]') ? r : null; }),
        checks: els.map((e) => e.querySelector('[data-check]')),
        pills: els.map((e) => {
          const p = e.querySelector('[data-claim-pill]');
          if (!p) return null;
          p._ld = p.querySelector('[data-claim-load]');
          p._dn = p.querySelector('[data-claim-done]');
          p._mk = p.querySelector('[data-claim-mark]');
          return p;
        }),
        // Deputy widget: an orb leaves the title and hops field to field as it fills the form
        deps: els.map((e) => {
          const card = e.querySelector('[data-dep]');
          if (!card) return null;
          const off = (n) => { let x = 0, y = 0; while (n && n !== card) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return { x, y }; };
          const q = (sel) => card.querySelector(sel);
          const home = q('[data-dep-home]'), ho = off(home);
          const tiles = [0, 1, 2].map((i) => q('[data-dep-tile="' + i + '"]')).filter(Boolean);
          return {
            orb: q('[data-dep-orb]'), spin: q('[data-dep-spin]'), trail: q('[data-dep-trail]'),
            pts: [{ x: ho.x + 8, y: ho.y + 8, s: 16 }].concat(tiles.map((t) => { const o = off(t); return { x: o.x + t.offsetWidth - 18, y: o.y + t.offsetHeight / 2, s: 18 }; })),
            tiles,
            skel: [0, 1, 2].map((i) => q('[data-dep-skel="' + i + '"]')),
            val: q('[data-dep-val="0"]'), val2: q('[data-dep-val="2"]'),
            chips: [...card.querySelectorAll('[data-dep-chip]')],
            sub: q('[data-dep-sub]'), done: q('[data-dep-done]'), ring: q('[data-dep-ring]'), mark: q('[data-dep-mark]'),
            delay: parseFloat(card.dataset.depDelay) || 0,
            hops: card.dataset.depHops ? JSON.parse(card.dataset.depHops) : null,
            dec: parseFloat(card.dataset.depDec) || 0,
          };
        }),
        // drag-and-drop upload card
        ups: els.map((e) => {
          const u = e.querySelector('[data-up]');
          if (!u) return null;
          const q = (sel) => u.querySelector(sel);
          const off = (n) => { let x = 0, y = 0; while (n && n !== u) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return { x, y }; };
          const file = q('[data-up-file]'), fo = off(file);
          return {
            bar: q('[data-up-bar]'), pct: q('[data-up-pct]'), ld: q('[data-up-load]'), dn: q('[data-up-done]'), ring: q('[data-up-ring]'), mk: q('[data-up-mark]'),
            zone: q('[data-up-zone]'), prompt: q('[data-up-prompt]'), filel: q('[data-up-filel]'), ghost: q('[data-up-ghost]'), chip: q('[data-up-chip]'), cur: q('[data-up-cursor]'),
            orb: q('[data-up-orb]'), spin: q('[data-up-spin]'), file,
            pts: [{ x: u.offsetWidth - 16, y: 16 }, { x: fo.x + file.offsetWidth / 2, y: fo.y + file.offsetHeight / 2 }, { x: 8, y: u.offsetHeight + 36 }],
          };
        }),
        // SMS bubble: plane flies off, then the status flips to "SMS sent"
        sms: els.map((e) => {
          const sm = e.querySelector('[data-sms]');
          if (!sm) return null;
          const q = (x) => sm.querySelector(x);
          return { plane: q('[data-sms-plane]'), ld: q('[data-sms-load]'), dn: q('[data-sms-done]'), ring: q('[data-sms-ring]'), mk: q('[data-sms-mark]') };
        }),
        // email card: recipient, subject and link fill in, then it goes out
        mails: els.map((e) => {
          const c = e.querySelector('[data-mail]');
          if (!c) return null;
          const q = (sel) => c.querySelector(sel);
          const off = (n) => { let x = 0, y = 0; while (n && n !== c) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return { x, y }; };
          const home = q('[data-mail-home]'), ho = off(home), env = q('[data-mail-env]'), eo = off(env);
          const rows = [0, 1, 2].map((i) => q('[data-mail-row="' + i + '"]'));
          const pts = [{ x: ho.x + 7.5, y: ho.y + 7.5 }].concat(rows.map((r) => { const o = off(r.parentElement); return { x: eo.x + env.offsetWidth - 16, y: o.y + r.parentElement.offsetHeight / 2 }; }));
          pts.push({ x: c.offsetWidth + 40, y: eo.y + 14 });
          return {
            orb: q('[data-mail-orb]'), spin: q('[data-mail-spin]'), env, sweep: q('[data-mail-sweep]'), ew: env.offsetWidth,
            rows, skel: [0, 1, 2].map((i) => q('[data-mail-skel="' + i + '"]')),
            ld: q('[data-mail-load]'), dn: q('[data-mail-done]'), ring: q('[data-mail-ring]'), mk: q('[data-mail-mark]'), pts,
          };
        }),
        buzz: els.map((e) => e.querySelector('[data-buzz]')),
        dx0: els.map((e) => (e.getAttribute('data-side') === 'r' ? 16 : -12)),
      };
      wrap._m = m;
      return m;
    }

    /* ---------- "searching…" grows into the answer ---------- */
    function paintMorph(mo, dt) {
      const q = cl((dt - MORPH_HOLD) / MORPH_DUR);
      const e = 1 - Math.pow(1 - q, 3);
      const hv = mo.ha + (mo.hb - mo.ha) * e;
      mo._hv = hv;
      const shrink = mo.hb - hv;
      const h = hv.toFixed(1) + 'px';
      if (mo._h !== h) { mo._h = h; mo.box.style.height = h; }
      if (mo.wa) {
        const w = (mo.wa + (mo.wb - mo.wa) * e).toFixed(1) + 'px';
        if (mo._w !== w) { mo._w = w; mo.box.style.width = w; }
      }
      mo.a.style.opacity = Math.max(0, 1 - q / 0.5).toFixed(3);
      mo.a.style.transform = 'translate3d(0,' + (-4 * e).toFixed(1) + 'px,0)';
      mo.b.style.opacity = cl((q - 0.34) / 0.66).toFixed(3);
      mo.b.style.transform = 'translate3d(0,' + (7 * (1 - e)).toFixed(1) + 'px,0)';
      if (mo.tk && mo.tk.length) {
        const t0 = MORPH_HOLD + 0.3, off = mo.tkOff;
        let fr = -1;
        for (let i = 0; i < mo.tk.length; i++) {
          const on = dt >= t0 + off[i] ? 1 : 0;
          if (on) fr = i;
          if (mo.tkS[i] === on) continue;
          mo.tkS[i] = on;
          mo.tk[i].style.opacity = on ? '1' : '0';
        }
        if (mo.cr) {
          if (fr !== mo._fr) {
            mo._fr = fr;
            if (fr >= 0 && mo.tk[fr].nextSibling !== mo.cr) mo.tk[fr].after(mo.cr);
          }
          const over = dt - (t0 + off[off.length - 1]);
          const o = fr < 0 ? 0 : (over < 0.22 ? 1 : Math.max(0, 1 - (over - 0.22) / 0.22));
          const r = Math.round(o * 12);
          if (mo._cro !== r) { mo._cro = r; mo.cr.style.opacity = o.toFixed(2); }
        }
      }
      if (mo.ring) {
        const rq = cl((dt - MORPH_HOLD - 0.2) / 0.5);
        const sp = rq >= 1 ? 1 : 1 - Math.pow(2, -9 * rq) * Math.cos(rq * 7.6);
        mo.ring.style.transform = 'scale(' + (0.32 + 0.68 * sp).toFixed(3) + ')';
      }
      if (mo.bar) {
        // the result bar fills left to right once the answer has landed
        const bq = cl((dt - MORPH_HOLD - MORPH_DUR - 0.1) / 1.1);
        const be = 1 - Math.pow(1 - bq, 4);
        const bs = 'inset(0 ' + ((1 - be) * 100).toFixed(2) + '% 0 0 round 6px)';
        if (mo.bar._s !== bs) { mo.bar._s = bs; mo.bar.style.clipPath = bs; }
      }
      if (mo.mark) {
        const mq = cl((dt - MORPH_HOLD - 0.36) / 0.38);
        mo.mark.style.strokeDashoffset = (24 * Math.pow(1 - mq, 5)).toFixed(1);
      }
      if (!mo.gif) return shrink;
      // the mark loops the loader GIF while it searches, then rests on its still frame
      const live = dt >= 0 && q < 1;
      if (mo._live === live) return shrink;
      mo._live = live;
      if (!live) { if (A.loaderStill) mo.gif.src = A.loaderStill; return shrink; }
      if (mo._u) URL.revokeObjectURL(mo._u);
      mo._u = markBlob ? URL.createObjectURL(markBlob) : null;
      if (mo._u || A.loaderGif) mo.gif.src = mo._u || A.loaderGif;
      return shrink;
    }

    function paintExtras(m, k, dt) {
      const dp = m.deps && m.deps[k];
      if (dp) paintDeputy(dp, dt - dp.delay);
      const up = m.ups && m.ups[k];
      if (up) paintUpload(up, dt * 1.22);
      const ml = m.mails && m.mails[k];
      if (ml) paintMail(ml, dt);
      const sm = m.sms && m.sms[k];
      if (sm) {
        const t = dt;
        if (sm.plane) {
          const fq = cl((t - 1.15) / 0.45), fe = fq * fq;
          const bob = Math.sin(t * 9) * 1.2 * (1 - fq);
          sm.plane.style.transform = 'translate(' + (fe * 30).toFixed(1) + 'px,' + (bob - fe * 18).toFixed(1) + 'px) scale(' + (1 - 0.3 * fe).toFixed(3) + ')';
          sm.plane.style.opacity = (1 - cl((t - 1.35) / 0.25)).toFixed(3);
        }
        const sw = cl((t - 2.2) / 0.26);
        if (sm.ld) sm.ld.style.opacity = (1 - sw).toFixed(3);
        if (sm.dn) sm.dn.style.opacity = sw.toFixed(3);
        if (sm.ring) sm.ring.style.transform = 'scale(' + (0.32 + 0.68 * spring(cl((t - 2.2) / 0.5))).toFixed(3) + ')';
        if (sm.mk) sm.mk.style.strokeDashoffset = (24 * Math.pow(1 - cl((t - 2.35) / 0.38), 5)).toFixed(1);
      }
      const bz = m.buzz && m.buzz[k];
      if (bz) {
        // the phone buzzes twice as the text lands
        const w = (t0) => { const q = cl((dt - t0) / 0.32); return q > 0 && q < 1 ? Math.sin(q * Math.PI * 6) * (1 - q) : 0; };
        const v = w(2.4) + w(2.85);
        const tf = 'translateX(' + (v * 3).toFixed(2) + 'px) rotate(' + (v * 0.8).toFixed(2) + 'deg)';
        if (bz._t !== tf) { bz._t = tf; bz.style.transform = tf; }
      }
      const mo0 = m.morphs[k];
      const shrink0 = mo0 ? paintMorph(mo0, dt - (mo0.delay || 0)) : 0;
      const gr = m.grows && m.grows[k];
      if (gr) {
        const op = cl((dt - gr.at) / 0.54);
        const e = 1 - Math.pow(1 - op, 3);
        const h = Math.max(0, gr.base + (mo0 ? mo0._hv || 0 : 0)) * e;
        const hs2 = h.toFixed(1) + 'px';
        if (gr._h !== hs2) { gr._h = hs2; gr.el.style.height = hs2; gr.el._lastH = hs2; }
        const o = cl(op * 1.8).toFixed(3);
        if (gr._o !== o) { gr._o = o; gr.el.style.opacity = o; }
        return Math.max(0, gr.h - h);
      }
      const rg = m.rings[k];
      if (rg) {
        const rd = parseFloat(rg.dataset.checkDelay) || 0;
        const rq = cl((dt - rd - 0.3) / 0.5);
        const rs = rq >= 1 ? 1 : 1 - Math.pow(2, -9 * rq) * Math.cos(rq * 7.6);
        rg.style.transform = 'scale(' + (0.32 + 0.68 * rs).toFixed(3) + ')';
        rg.style.opacity = cl(rq / 0.35).toFixed(3);
      }
      const mk = m.marks[k];
      if (mk) {
        const md = parseFloat(mk.dataset.checkDelay) || 0;
        mk.style.strokeDashoffset = (24 * Math.pow(1 - cl((dt - md - 0.46) / 0.38), 5)).toFixed(1);
      }
      const pl = m.pills && m.pills[k];
      if (pl) {
        const pd = parseFloat(pl.dataset.claimDelay) || 0;
        const pq = cl((dt - pd - 0.3) / 0.5);
        const ps = pq >= 1 ? 1 : 1 - Math.pow(2, -9 * pq) * Math.cos(pq * 7.6);
        pl.style.transform = 'scale(' + (0.32 + 0.68 * ps).toFixed(3) + ')';
        pl.style.opacity = cl(pq / 0.35).toFixed(3);
        const sw = pl._ld ? cl((dt - pd - 1.9) / 0.26) : 1;
        if (pl._ld) pl._ld.style.opacity = (1 - sw).toFixed(3);
        if (pl._dn) pl._dn.style.opacity = sw.toFixed(3);
        if (pl._mk) pl._mk.style.strokeDashoffset = (24 * Math.pow(1 - cl((dt - pd - (pl._ld ? 2.1 : 0.45)) / 0.38), 5)).toFixed(1);
      }
      return shrink0;
    }

    /* ---------- email card ---------- */
    function paintMail(u, t) {
      const P = u.pts;
      const HOPS = [[0.45, 0.42], [1.15, 0.38], [1.8, 0.38], [2.5, 0.5]]; // home->to->subject->link->out
      let x = P[0].x, y = P[0].y, v = 0;
      HOPS.forEach((h, i) => {
        const raw = cl((t - h[0]) / h[1]), e = i === 3 ? raw * raw * raw : io(raw);
        x += (P[i + 1].x - P[i].x) * e;
        y += (P[i + 1].y - P[i].y) * e - Math.sin(Math.PI * e) * (i === 3 ? 4 : 9);
        v = Math.max(v, Math.sin(Math.PI * raw));
      });
      if (u.orb) {
        const pop = spring(cl((t - 0.1) / 0.45));
        const out = cl((t - 2.5) / 0.5);
        const sc = pop * (1 + 0.18 * v) * (1 - 0.35 * out) * (1 + 0.6 * out * (1 - out));
        u.orb.style.transform = 'translate3d(' + (x - 9).toFixed(1) + 'px,' + (y - 9).toFixed(1) + 'px,0) scale(' + sc.toFixed(3) + ')';
        u.orb.style.opacity = (cl((t - 0.1) / 0.2) * (1 - cl((t - 2.78) / 0.22))).toFixed(3);
        if (u.spin) u.spin.style.transform = 'rotate(' + ((t * 140) % 360).toFixed(1) + 'deg)';
      }
      // each field resolves in turn
      [0.82, 1.48, 2.13].forEach((t0, i) => {
        const q = cl((t - t0) / 0.3);
        const r = u.rows[i];
        if (r) {
          r.style.opacity = q.toFixed(3);
          r.style.transform = i === 2 ? 'scale(' + (0.6 + 0.4 * spring(cl((t - t0) / 0.5))).toFixed(3) + ')' : 'translate3d(0,' + ((1 - q) * 3).toFixed(1) + 'px,0)';
          if (i === 2) r.style.transformOrigin = '0 50%';
        }
        if (u.skel[i]) u.skel[i].style.opacity = (1 - q).toFixed(3);
      });
      // send: a light sweep crosses the envelope and the card nudges after it
      const sw = cl((t - 2.5) / 0.55);
      if (u.sweep) {
        u.sweep.style.opacity = Math.sin(Math.PI * sw).toFixed(3);
        u.sweep.style.transform = 'translate3d(' + (-0.5 * u.ew + sw * 1.6 * u.ew).toFixed(1) + 'px,0,0)';
      }
      if (u.env) u.env.style.transform = 'translate3d(' + (Math.sin(Math.PI * cl((t - 2.55) / 0.5)) * 5).toFixed(1) + 'px,0,0)';
      const st = cl((t - 2.95) / 0.26);
      if (u.ld) u.ld.style.opacity = (1 - st).toFixed(3);
      if (u.dn) u.dn.style.opacity = st.toFixed(3);
      if (u.ring) u.ring.style.transform = 'scale(' + (0.32 + 0.68 * spring(cl((t - 2.95) / 0.5))).toFixed(3) + ')';
      if (u.mk) u.mk.style.strokeDashoffset = (24 * Math.pow(1 - cl((t - 3.1) / 0.38), 5)).toFixed(1);
    }

    /* ---------- drag-and-drop upload, then Deputy's orb reads the file ---------- */
    function paintUpload(u, t) {
      const e = io(cl((t - 0.5) / 1.0));
      const lift = Math.sin(Math.PI * e) * 10;
      if (u.ghost) {
        u.ghost.style.transform = 'translate3d(' + (58 * (1 - e)).toFixed(1) + 'px,' + (54 * (1 - e) - lift).toFixed(1) + 'px,0) rotate(' + (7 * (1 - e)).toFixed(2) + 'deg)';
        u.ghost.style.opacity = (cl((t - 0.42) / 0.25) * (1 - cl((t - 1.68) / 0.3))).toFixed(3);
      }
      if (u.chip) u.chip.style.transform = 'translate(-50%,-50%) scale(' + (1 - 0.32 * io(cl((t - 1.58) / 0.36))).toFixed(3) + ')';
      if (u.cur) {
        const pr = cl((t - 1.45) / 0.12) * (1 - cl((t - 1.62) / 0.14));
        const aw = io(cl((t - 1.62) / 0.4));
        u.cur.style.transform = 'translate(' + (aw * 14).toFixed(1) + 'px,' + (aw * 10).toFixed(1) + 'px) scale(' + (1 - 0.14 * pr).toFixed(3) + ')';
      }
      if (u.zone) {
        const hl = cl((t - 1.1) / 0.3) * (1 - cl((t - 1.85) / 0.4));
        const settle = cl((t - 1.9) / 0.5);
        u.zone.style.background = 'rgba(255,255,255,' + (0.06 + 0.1 * hl).toFixed(3) + ')';
        u.zone.style.borderColor = 'rgba(255,255,255,' + (0.42 + 0.48 * hl - 0.2 * settle).toFixed(3) + ')';
        u.zone.style.transform = 'scale(' + (1 + 0.025 * hl).toFixed(4) + ')';
      }
      if (u.prompt) u.prompt.style.opacity = (1 - cl((t - 1.55) / 0.22)).toFixed(3);
      if (u.filel) {
        const q = cl((t - 1.72) / 0.3);
        u.filel.style.opacity = q.toFixed(3);
        u.filel.style.transform = 'translate3d(0,' + ((1 - q) * 4).toFixed(1) + 'px,0)';
      }
      const r = cl((t - 1.9) / 1.35);
      const f = r < 0.45 ? (r / 0.45) * 0.62 : r < 0.6 ? 0.62 + ((r - 0.45) / 0.15) * 0.04 : 0.66 + (1 - Math.pow(1 - (r - 0.6) / 0.4, 2)) * 0.34;
      if (u.bar) u.bar.style.transform = 'scaleX(' + f.toFixed(3) + ')';
      const ps = Math.round(f * 100) + '%';
      if (u.pct && u.pct._t !== ps) { u.pct._t = ps; u.pct.textContent = ps; }
      const sw = cl((t - 3.3) / 0.26);
      if (u.ld) u.ld.style.opacity = (1 - sw).toFixed(3);
      if (u.dn) u.dn.style.opacity = sw.toFixed(3);
      if (u.ring) u.ring.style.transform = 'scale(' + (0.32 + 0.68 * spring(cl((t - 3.3) / 0.5))).toFixed(3) + ')';
      if (u.mk) u.mk.style.strokeDashoffset = (24 * Math.pow(1 - cl((t - 3.45) / 0.38), 5)).toFixed(1);
      // Deputy orb: pops in top-right, hops onto the file, reads it, then drops out toward the widget below
      if (u.orb) {
        const P = u.pts;
        const pop = spring(cl((t - 3.8) / 0.5));
        const h1 = io(cl((t - 4.15) / 0.45)), h2 = io(cl((t - 5.05) / 0.5));
        let x = P[0].x + (P[1].x - P[0].x) * h1, y = P[0].y + (P[1].y - P[0].y) * h1 - Math.sin(Math.PI * h1) * 12;
        x += (P[2].x - P[1].x) * h2; y += (P[2].y - P[1].y) * h2 - Math.sin(Math.PI * h2) * 8;
        const v = Math.max(Math.sin(Math.PI * cl((t - 4.15) / 0.45)), Math.sin(Math.PI * cl((t - 5.05) / 0.5)));
        const sc = pop * (1 - 0.3 * h2) * (1 + 0.18 * v);
        u.orb.style.transform = 'translate3d(' + (x - 9).toFixed(1) + 'px,' + (y - 9).toFixed(1) + 'px,0) scale(' + sc.toFixed(3) + ')';
        u.orb.style.opacity = (cl((t - 3.8) / 0.2) * (1 - cl((t - 5.25) / 0.3))).toFixed(3);
        const g = 9 + 3 * Math.sin(t * 4.2) + v * 6;
        u.orb.style.boxShadow = '0 0 ' + g.toFixed(1) + 'px ' + (2 + v * 2).toFixed(1) + 'px rgba(64,110,240,' + (0.5 + 0.25 * v).toFixed(2) + ')';
        if (u.spin) u.spin.style.transform = 'rotate(' + ((t * 140) % 360).toFixed(1) + 'deg)';
        if (u.file) {
          const rd = cl((t - 4.5) / 0.2) * (1 - cl((t - 5.05) / 0.3));
          u.file.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,.2), 0 0 0 ' + (2 * rd).toFixed(2) + 'px rgba(147,222,253,' + (0.7 * rd).toFixed(3) + ')';
        }
      }
    }

    /* ---------- Deputy: the orb hops field to field and fills the form ---------- */
    function paintDeputy(d, t) {
      const Hh = d.hops || DEP_HOPS, P = d.pts, td = t - d.dec;
      const at = (tt) => {
        let p = P[Hh[0][2]], v = 0, a = 0;
        for (const h of Hh) {
          if (tt < h[0]) break;
          const A2 = P[h[2]], B = P[h[3]];
          if (!A2 || !B) break;
          if (tt >= h[1]) { p = B; continue; }
          const q = (tt - h[0]) / (h[1] - h[0]), e = io(q);
          const lift = Math.sin(Math.PI * e) * Math.min(14, Math.abs(B.y - A2.y) * 0.3 + 6);
          p = { x: A2.x + (B.x - A2.x) * e, y: A2.y + (B.y - A2.y) * e - lift, s: A2.s + (B.s - A2.s) * e };
          v = Math.sin(Math.PI * q);
          a = Math.atan2(B.y - A2.y, B.x - A2.x);
          break;
        }
        return { p, v, a };
      };
      const tr = (o, p, v, a, k) => {
        const sc = p.s / 20;
        o.style.transform = 'translate3d(' + (p.x - 10).toFixed(1) + 'px,' + (p.y - 10).toFixed(1) + 'px,0) rotate(' + a.toFixed(3) + 'rad) scale(' + (sc * (1 + k * v)).toFixed(3) + ',' + (sc * (1 - k * 0.4 * v)).toFixed(3) + ') rotate(' + (-a).toFixed(3) + 'rad)';
      };
      const c = at(t);
      if (d.orb) {
        tr(d.orb, c.p, c.v, c.a, 0.38);
        const g = 9 + 3 * Math.sin(t * 4.2) + c.v * 6;
        d.orb.style.boxShadow = '0 0 ' + g.toFixed(1) + 'px ' + (2 + c.v * 2).toFixed(1) + 'px rgba(64,110,240,' + (0.5 + 0.25 * c.v).toFixed(2) + ')';
      }
      if (d.spin) d.spin.style.transform = 'rotate(' + ((t * 140) % 360).toFixed(1) + 'deg)';
      if (d.trail) {
        const g = at(t - 0.08);
        tr(d.trail, g.p, g.v, g.a, 1.1);
        d.trail.style.opacity = (c.v * 0.75).toFixed(3);
      }
      // the field the orb is parked on lights up
      d.tiles.forEach((tile, i) => {
        if (!tile || !Hh[i] || !Hh[i + 1]) return;
        const arr = Hh[i][1], dep = Hh[i + 1][0];
        const pr = cl((t - arr + 0.15) / 0.25) * (1 - cl((t - dep) / 0.3));
        const ps = pr.toFixed(3);
        if (tile._p === ps) return;
        tile._p = ps;
        if (tile._lt == null) tile._lt = !!tile.closest('[data-dep-light]');
        if (tile._lt) {
          const bl = 'rgba(32,90,227,' + (0.06 * pr).toFixed(3) + ')';
          tile.style.background = 'linear-gradient(' + bl + ',' + bl + '), rgba(11,11,11,.035)';
          tile.style.boxShadow = 'inset 0 0 0 1px rgba(32,90,227,' + (0.32 * pr).toFixed(3) + ')';
        } else {
          tile.style.background = 'rgba(255,255,255,' + (0.07 + 0.06 * pr).toFixed(3) + ')';
          tile.style.boxShadow = 'inset 0 0 0 1px rgba(147,222,253,' + (0.42 * pr).toFixed(3) + ')';
        }
      });
      const fade = (el, t0, dur, dy, out) => {
        if (!el) return;
        const q = cl((t - t0) / (dur || 0.35));
        const o = out != null ? q * (1 - cl((t - out) / 0.2)) : q;
        el.style.opacity = o.toFixed(3);
        el.style.transform = 'translate3d(0,' + ((1 - q) * (dy || 5)).toFixed(1) + 'px,0)';
        el.style.filter = q < 1 ? 'blur(' + ((1 - q) * 3).toFixed(2) + 'px)' : 'none';
      };
      const skelOut = (el, t0) => { if (el) el.style.opacity = (1 - cl((t - t0) / 0.2)).toFixed(3); };
      skelOut(d.skel[0], 1.1); fade(d.val, 1.1, 0.4);
      skelOut(d.skel[1], 2.15);
      d.chips.forEach((chp, i) => {
        const q = cl((t - 2.2 - i * 0.15) / 0.4);
        chp.style.opacity = cl(q / 0.4).toFixed(3);
        chp.style.transform = 'scale(' + (0.8 + 0.2 * spring(q)).toFixed(3) + ')';
      });
      skelOut(d.skel[2], 3.25 + d.dec);
      fade(d.val2, 3.25 + d.dec, 0.4);
      fade(d.sub, 3.25 + d.dec, 0.3, 4, 3.9 + d.dec);
      fade(d.done, 3.95 + d.dec, 0.3, 4);
      if (d.ring) d.ring.style.transform = 'scale(' + (0.32 + 0.68 * spring(cl((td - 3.95) / 0.5))).toFixed(3) + ')';
      if (d.mark) d.mark.style.strokeDashoffset = (24 * Math.pow(1 - cl((td - 4.1) / 0.38), 5)).toFixed(1);
    }

    /* reset everything a painter touched, so a replay starts clean */
    function resetExtras(wrap) {
      if (!wrap) return;
      const m = chatMeas(wrap);
      m.els.forEach((_, k) => paintExtras(m, k, -999));
      if (m.inners) m.inners.forEach((inner) => { if (inner) { inner._o = null; inner.style.opacity = '0'; } });
    }

    /* ---------- a thread: messages rise from the baseline, older ones ride up and dim ---------- */
    function paintChat(wrap, beats, t, maxVis) {
      const MAXV = maxVis || OV_MAX;
      const m = chatMeas(wrap);
      const els = m.els, hs = m.hs, H = m.H, baseline = m.baseline;
      if (!els.length) return;
      const def = [];
      for (let j = 0; j < els.length; j++) {
        const d = t >= beats[j] ? paintExtras(m, j, t - beats[j]) : 0;
        def[j] = m.grows && m.grows[j] ? d : 0;
      }
      const ch = (j) => hs[j] - def[j];
      const tops2 = []; let acc2 = 0;
      for (let j = 0; j < els.length; j++) { tops2.push(acc2); acc2 += ch(j) + m.gap; }
      const bot = (j) => tops2[j] + ch(j);

      let last = -1;
      for (let k = 0; k < els.length; k++) if (t >= beats[k]) last = k;
      if (last < 0) { hideThread(wrap); return; }
      const from = last === 0 ? tops2[0] : bot(last - 1);
      let scroll = from + (bot(last) - from) * ez(cl((t - beats[last]) / OV_RISE)) - baseline;
      // a row taller than the column pins its top edge instead of scrolling out the top
      const fitOf = (j) => Math.min(1, (H - 12) / Math.max(1, ch(j)));
      if (ch(last) * fitOf(last) > baseline - 8) scroll = Math.min(scroll, tops2[last] - 6);

      wrap._auto = scroll;
      wrap._min = bot(0) - baseline;
      let eff = scroll;
      if (wrap._lock != null) {
        if (wrap._rel) {
          wrap._lock += (scroll - wrap._lock) * 0.14;
          if (Math.abs(scroll - wrap._lock) < 1.5) { wrap._lock = null; wrap._rel = false; }
        }
        if (wrap._lock != null) {
          if (wrap._lock >= scroll - 0.5) { wrap._lock = null; wrap._rel = false; }
          else eff = wrap._lock;
        }
      }
      const back = cl((scroll - eff) / 40);

      for (let k = 0; k < els.length; k++) {
        const el = els[k];
        if (t < beats[k]) { if (el._v !== 'h') { el._v = 'h'; el.style.visibility = 'hidden'; } continue; }
        const ap = cl((t - beats[k]) / 0.62);
        const sp = spring(cl((t - beats[k]) / 0.9));
        const y = tops2[k] - eff + (1 - sp) * 20;
        let newer = 0;
        for (let j = k + 1; j < els.length; j++) newer += cl((t - beats[j]) / OV_RISE);
        const cap = cl(MAXV - 1.05 - newer) * (1 - 0.09 * Math.min(newer, 3));
        let o = ez(ap) * (cap + (1 - cap) * back);
        if (wrap._fades && wrap._fades[k] != null) o *= wrap._fades[k];
        // a transient marker (e.g. "Call ended") dissolves as the next row lands
        if (k + 1 < els.length && el.hasAttribute('data-fade-next')) o *= 1 - cl((t - beats[k + 1]) / 0.7);
        const pinned = k === last && ch(k) * fitOf(k) > baseline - 8 && y >= 0;
        o *= (pinned ? 1 : cl((y + 4) / 34)) * (pinned ? 1 : cl((H - 6 - y) / 34));
        const dx = (1 - sp) * m.dx0[k];
        const fit = fitOf(k);
        const sc = (0.965 + 0.035 * sp) * fit;
        if (fit < 1 && el._fo !== 1) { el._fo = 1; el.style.transformOrigin = '50% 0'; }
        const vis = o <= 0.01 ? 'h' : 'v';
        if (el._v !== vis) { el._v = vis; el.style.visibility = vis === 'h' ? 'hidden' : 'visible'; }
        if (vis === 'h') continue;
        el.style.transform = 'translate3d(' + dx.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + sc.toFixed(3) + ')';
        const inner = m.inners[k];
        if (inner) {
          const os = o.toFixed(3);
          if (inner._o !== os) { inner._o = os; inner.style.opacity = os; }
          const bl = (1 - cl((t - beats[k]) / 0.5)) * 5;
          const fl = bl > 0.05 ? 'blur(' + bl.toFixed(2) + 'px)' : 'none';
          if (inner._f !== fl) { inner._f = fl; inner.style.filter = fl; }
        }
        const chk = m.checks[k];
        if (chk) chk.style.strokeDashoffset = (24 * (1 - ez(cl((t - beats[k] - 0.18) / 0.42)))).toFixed(1);
      }
    }

    /* ---------- a solo column: one panel at a time, anchored to the same bottom edge ---------- */
    function paintSolo(wrap, beats, t) {
      const m = chatMeas(wrap);
      const els = m.els;
      if (!els.length) return;
      let last = -1;
      for (let k = 0; k < els.length; k++) if (t >= beats[k]) last = k;
      if (last < 0) { hideThread(wrap); return; }
      for (let k = 0; k < els.length; k++) {
        const el = els[k];
        if (t < beats[k]) { if (el._v !== 'h') { el._v = 'h'; el.style.visibility = 'hidden'; } continue; }
        const ap = cl((t - beats[k]) / 0.62);
        const sp = spring(cl((t - beats[k]) / 0.9));
        const out = k + 1 < els.length ? cl((t - beats[k + 1] + 0.3) / 0.55) : 0;
        const o = ez(ap) * (1 - out);
        const vis = o <= 0.01 ? 'h' : 'v';
        if (el._v !== vis) { el._v = vis; el.style.visibility = vis === 'h' ? 'hidden' : 'visible'; }
        if (vis === 'h') continue;
        const shrink = paintExtras(m, k, t - beats[k]);
        const y = m.baseline - m.hs[k] + shrink + (1 - sp) * 18 - out * 14;
        el.style.transform = 'translate3d(' + ((1 - sp) * m.dx0[k]).toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + (0.965 + 0.035 * sp - out * 0.02).toFixed(3) + ')';
        const inner = m.inners[k];
        if (inner) {
          const os = o.toFixed(3);
          if (inner._o !== os) { inner._o = os; inner.style.opacity = os; }
          const bl = (1 - cl((t - beats[k]) / 0.5)) * 5 + out * 4;
          const fl = bl > 0.05 ? 'blur(' + bl.toFixed(2) + 'px)' : 'none';
          if (inner._f !== fl) { inner._f = fl; inner.style.filter = fl; }
        }
      }
    }

    /* ---------- wheel over a transcript walks it back (mouse / trackpad only) ---------- */
    const coarse = () => window.matchMedia && (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 860px)').matches);
    function bindChat(wrap) {
      if (!wrap || wrap._bound) return;
      const panel = wrap.closest('.home-hero_slide') || wrap.closest('[data-hui]');
      if (!panel) return;
      wrap._bound = true;
      (panel._chats = panel._chats || []).push(wrap);
      // selecting text in a bubble never reaches the slide's click / drag
      wrap.addEventListener('click', (e) => e.stopPropagation());
      if (panel._chatBound) return;
      panel._chatBound = true;
      panel.addEventListener('wheel', (e) => {
        if (coarse()) return;
        const wraps = (panel._chats || []).filter((w) => w._auto != null && w.offsetParent);
        let hit = null;
        for (const w of wraps) {
          const r = w.getBoundingClientRect();
          if (e.clientX >= r.left - 16 && e.clientX <= r.right + 16) { hit = w; break; }
        }
        if (!hit) return;
        const cur = hit._lock != null ? hit._lock : hit._auto;
        const next = Math.max(hit._min || 0, Math.min(hit._auto, cur + e.deltaY));
        if (Math.abs(next - cur) < 0.5) return;
        e.preventDefault();
        hit._lock = next;
        hit._rel = false;
      }, { passive: false });
      panel.addEventListener('mouseleave', () => (panel._chats || []).forEach((c) => { if (c._lock != null) c._rel = true; }));
    }
    [ov, augL, augR, anz].forEach(bindChat);

    /* ---------- AUTOMATE ---------- */
    function paintAutomate(t) {
      if (!ov) return;
      paintChat(ov, beatsOf(0, 'seq'), t, narrow ? 2 : 3);
    }

    /* ---------- AUGMENT ---------- */
    let augCols = null, augMerged = false, augBeats = null;
    function augMerge(on) {
      if (!augL || !augR || augMerged === !!on) return;
      if (!augCols) {
        augCols = { l: [...augL.children], r: [...augR.children] };
        if (!augCols.r.length) { augCols = null; return; }
      }
      if (on) {
        const seq = CHAT[1].seq, seqR = CHAT[1].seqR;
        const pairs = augCols.l.map((el, i) => ({ el, b: seq[i] }))
          .concat(augCols.r.map((el, i) => ({ el, b: seqR[i] })))
          .sort((a, b) => a.b - b.b);
        pairs.forEach((p) => augL.appendChild(p.el));
        augBeats = pairs.map((p) => p.b + CHAT[1].lead);
        augR.style.display = 'none';
      } else {
        augCols.l.forEach((el) => augL.appendChild(el));
        augCols.r.forEach((el) => augR.appendChild(el));
        augR.style.display = '';
        augBeats = null;
      }
      augMerged = !!on;
      augL._m = null; augR._m = null;
      invalidate();
      hideThread(augL); hideThread(augR);
    }
    function paintAugment(t) {
      if (!augL || !augR) return;
      augMerge(narrow);
      if (augMerged && augBeats) paintChat(augL, augBeats, t, 2);
      else {
        paintChat(augL, beatsOf(1, 'seq'), t, null);
        paintSolo(augR, beatsOf(1, 'seqR'), t);
      }
      const hl = augL.querySelector('[data-hl]');
      if (hl) {
        const lead = CHAT[1].lead, t0 = lead + 4.0, t1 = lead + 5.3;
        hl.style.backgroundSize = (cl((t - t0) / (t1 - t0)) * 100).toFixed(1) + '% 100%';
      }
    }

    /* ---------- ANALYZE ---------- */
    let typeBuilt = false, tSpans = [], tWins = [], tShown = 0;
    function buildType() {
      if (!anz || typeBuilt) return;
      const ps = anz.querySelectorAll('[data-type]');
      if (!ps.length) return;
      typeBuilt = true;
      ps.forEach((p) => {
        const txt = p.getAttribute('data-type');
        p.textContent = '';
        const frag = document.createDocumentFragment();
        const own = p.dataset.typeFrom ? { spans: [], t0: parseFloat(p.dataset.typeFrom), t1: parseFloat(p.dataset.typeTo), n: 0 } : null;
        for (const chr of txt) {
          const sp = document.createElement('span');
          sp.textContent = chr;
          sp.style.opacity = '0';
          frag.appendChild(sp);
          (own ? own.spans : tSpans).push(sp);
        }
        if (own) tWins.push(own);
        p.appendChild(frag);
      });
      invalidate();
    }
    const runType = (spans, prev, q) => {
      const shown = Math.round(cl(q) * spans.length);
      if (shown === prev) return prev;
      for (let i = Math.min(prev, shown); i < Math.max(prev, shown); i++) spans[i].style.opacity = i < shown ? '1' : '0';
      return shown;
    };
    buildType();

    let anzBtns = null, anzSend = null;
    function paintSend(t, at2) {
      if (!anzSend) anzSend = { btn: anz.querySelector('[data-send-btn]'), chip: anz.querySelector('[data-sent-chip]'), mark: anz.querySelector('[data-sent-mark]') };
      const sd = anzSend;
      if (!sd.btn || !sd.chip) return;
      const q = cl((t - at2 - 0.16) / 0.24);
      if (sd._q !== q) { sd._q = q; sd.btn.style.opacity = (1 - q).toFixed(3); sd.chip.style.opacity = q.toFixed(3); }
      if (sd.mark) {
        const mq = cl((t - at2 - 0.3) / 0.4);
        const off = (26 * Math.pow(1 - mq, 4)).toFixed(2);
        if (sd._mq !== off) { sd._mq = off; sd.mark.style.strokeDashoffset = off; }
      }
    }
    function paintAnalyze(t) {
      if (!anz) return;
      buildType();
      const lead = CHAT[2].lead;
      paintChat(anz, beatsOf(2, 'seq'), t, narrow ? 2 : CHAT[2].max);

      if (tSpans.length) tShown = runType(tSpans, tShown, (t - (lead + ANZ_TYPE_S[0])) / (ANZ_TYPE_S[1] - ANZ_TYPE_S[0]));
      tWins.forEach((g) => { const a = lead + g.t0, b = lead + g.t1; g.n = runType(g.spans, g.n, (t - a) / (b - a)); });

      const cur = anzCursor;
      if (!cur) return;
      if (!anzBtns) anzBtns = [0, 1, 2].map((n) => anz.querySelector('[data-anz-btn="' + n + '"]'));
      const btns = anzBtns;
      const host = anz.parentElement || anz;
      const hostR = host.getBoundingClientRect();
      const at = (n) => {
        const b = btns[n];
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { x: r.left - hostR.left + r.width * 0.52, y: r.top - hostR.top + r.height * 0.6 };
      };
      const cls = ANZ_CLICK_S.map((s) => lead + s);
      const TRAVEL = 1.5, PRESS = 0.42;
      paintSend(t, cls[2]);
      if (t < cls[cls.length - 1] - 0.5) { if (anz._fades) anz._fades = null; }
      else anz._fades = { 1: cl(1 - (t - cls[2] - 0.9) / 0.9) };

      let seg = -1;
      for (let n = 0; n < cls.length; n++) if (t >= cls[n] - TRAVEL - 0.3) seg = n;
      if (seg < 0) { cur.style.visibility = 'hidden'; btns.forEach((b) => { if (b) b.style.transform = ''; }); hideRipple(); return; }
      const to = at(seg);
      if (!to) { cur.style.visibility = 'hidden'; return; }
      const from = seg === 0 ? { x: to.x + 62, y: to.y + 104 } : (at(seg - 1) || to);
      const st = cls[seg] - TRAVEL;
      const u = cl((t - st) / TRAVEL);
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      const dx2 = to.x - from.x, dy2 = to.y - from.y;
      const len = Math.hypot(dx2, dy2) || 1;
      const bow = (seg % 2 ? -1 : 1) * Math.min(42, len * 0.2);
      const cx2 = from.x + dx2 / 2 + (-dy2 / len) * bow;
      const cy2 = from.y + dy2 / 2 + (dx2 / len) * bow;
      const mt = 1 - e;
      let x = mt * mt * from.x + 2 * mt * e * cx2 + e * e * to.x;
      let y = mt * mt * from.y + 2 * mt * e * cy2 + e * e * to.y;
      x += Math.sin(t * 2.2 + seg * 1.7) * 0.8 + Math.sin(t * 5.3) * 0.25;
      y += Math.cos(t * 1.8 + seg) * 0.7;
      const after = t - cls[seg];
      const leave = cl((after - 0.4) / 0.62);
      if (leave > 0) { const l2 = leave * leave; x += 30 * l2; y += 40 * l2; }
      const d = Math.abs(after);
      const press = d < PRESS ? 1 - 0.2 * (1 - d / PRESS) : 1;
      const op = Math.min(cl((t - (st - 0.3)) / 0.55), 1 - leave);
      cur.style.visibility = op <= 0.02 ? 'hidden' : 'visible';
      cur.style.opacity = op.toFixed(2);
      cur.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + press.toFixed(3) + ')';
      btns.forEach((b, n) => {
        if (!b) return;
        const dd = Math.abs(t - cls[n]);
        b.style.transform = 'scale(' + (dd < PRESS ? 1 - 0.07 * (1 - dd / PRESS) : 1).toFixed(3) + ')';
      });
      const rip = anzRipple;
      if (rip) {
        let rq = -1, ri = 0;
        for (let n = 0; n < cls.length; n++) {
          const uu = (t - cls[n]) / 0.52;
          if (uu >= 0 && uu <= 1) { rq = uu; ri = n; }
        }
        if (rq < 0) hideRipple();
        else {
          const pt = at(ri) || to;
          rip._on = 1;
          rip.style.visibility = 'visible';
          rip.style.opacity = (1 - rq).toFixed(2);
          rip.style.transform = 'translate3d(' + pt.x.toFixed(1) + 'px,' + pt.y.toFixed(1) + 'px,0) scale(' + (0.34 + 1.05 * rq).toFixed(3) + ')';
        }
      }
    }
    function hideRipple() {
      if (anzRipple && anzRipple._on !== 0) { anzRipple._on = 0; anzRipple.style.visibility = 'hidden'; }
    }

    /* ---------- public ---------- */
    const painters = [paintAutomate, paintAugment, paintAnalyze];
    const hidden = [false, false, false];

    function hide(i) {
      if (hidden[i]) return;
      hidden[i] = true;
      if (i === 0) { hideThread(ov); }
      if (i === 1) { hideThread(augL); hideThread(augR); }
      if (i === 2) {
        hideThread(anz);
        if (anzCursor) anzCursor.style.visibility = 'hidden';
        hideRipple();
      }
    }

    /* rewind a slide to its first frame (called before it plays again) */
    function reset(i) {
      if (i === 0) resetExtras(ov);
      if (i === 1) {
        resetExtras(augL); resetExtras(augR);
        const hl = augL && augL.querySelector('[data-hl]');
        if (hl) hl.style.backgroundSize = '0% 100%';
      }
      if (i === 2 && anz) {
        resetExtras(anz);
        tShown = runType(tSpans, tShown, 0);
        tWins.forEach((g) => { g.n = runType(g.spans, g.n, 0); });
        anz._fades = null;
        if (anzSend) { anzSend._q = null; anzSend._mq = null; }
        paintSend(-999, 0);
        if (anzBtns) anzBtns.forEach((b) => { if (b) b.style.transform = ''; });
      }
      hidden[i] = false;
      hide(i);
    }

    function paint(i, t) {
      hidden[i] = false;
      painters[i] && painters[i](t);
    }

    function setNarrow(n) {
      if (n === narrow) return;
      narrow = n;
      invalidate();
    }

    /* any size change of a column re-measures it (scroll expansion, resize, fonts) */
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => invalidate());
      [ov, augL, augR, anz].forEach((c) => c && ro.observe(c));
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(invalidate);

    return { need, paint, hide, reset, invalidate, setNarrow, hasSlide: (i) => !!painters[i] };
  }

  /* ==================================================================
     CONTROLLER
     ================================================================== */
  /* all pin geometry is measured in page coordinates (rect.top + scrollY), so the
     hero sets itself up correctly whatever the scroll position on load / reload */
  const pageTop = (el) => el.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0);

  function initHomeHero() {
    const component = document.querySelector('.home-hero_component');
    if (!component || component.dataset.heroInitialized === 'true') return;
    if (typeof gsap === 'undefined') { console.error('Home Hero: GSAP is not loaded.'); return; }
    if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);
    component.dataset.heroInitialized = 'true';

    const desktopMedia = window.matchMedia('(min-width: 992px)');
    let isDesktop = desktopMedia.matches;

    const content = component.querySelector('.home-hero_content');
    const slider = component.querySelector('.home-hero_slider');
    const track = component.querySelector('.home-hero_track');
    const slides = Array.from(component.querySelectorAll('.home-hero_slide'));
    const videos = slides.map((s) => s.querySelector('.home-hero_video'));
    const rings = slides.map((s) => s.querySelector('.home-hero_progress'));
    if (!slider || !track || !slides.length) { console.error('Home Hero: required elements are missing.'); return; }

    /* ---------------- intro: decided up front, before anything is shown ---------------- */
    const introEl = component.querySelector('.home-hero_intro');
    const introHeading = introEl && introEl.querySelector('.home-hero_intro-heading');
    const introL = introEl && introEl.querySelector('.home-hero_intro-text.is-left');
    const introR = introEl && introEl.querySelector('.home-hero_intro-text.is-right');
    let introWanted = (() => {
      if (!introHeading || !introL || !introR) return false;
      if (component.dataset.intro === 'off') return false;
      if (document.documentElement.classList.contains('wf-design-mode')) return false;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      if (location.hash && location.hash.length > 1) return false;
      if ((window.scrollY || window.pageYOffset || 0) > 10) return false;
      try {
        const nav = performance.getEntriesByType('navigation')[0];
        if (nav && nav.type === 'back_forward') return false;
      } catch (e) {}
      return true;
    })();
    document.documentElement.classList.remove('is-home-hero-intro'); // old interaction class
    if (content) gsap.set(content, { autoAlpha: 1, y: 0 });
    gsap.set(slider, { autoAlpha: 1 });
    if (introWanted) {
      // stays dark until the intro's first frame is laid out
      if (content) { content.style.opacity = '0'; content.style.pointerEvents = 'none'; }
      slider.style.visibility = 'hidden';
    }
    // lifts the pre-script CSS hide (hero.css)
    document.documentElement.classList.add('is-hero-ready');

    const ui = createHeroUI(component);

    /* ---------------- state ---------------- */
    let activeSlideIndex = 0;
    let clockIndex = -1;       // slide whose UI is on the clock
    let clockT0 = 0;           // performance.now() at t = 0
    let frozenAt = 0;          // set while the clock is stopped
    let raf = 0;
    let armed = false;         // the first thread waits until the slider is in view
    let userPaused = false;
    let offscreen = false;
    let introRunning = false;  // the intro owns the slider, videos and scroll
    let resizeAfterIntro = false;

    /* ---------------- progress ring = play / pause ---------------- */
    const RING_C = 2 * Math.PI * 15;
    const arcs = rings.map((ring) => {
      if (!ring) return null;
      ring.innerHTML =
        '<span class="hui-ring_hit"></span>' +
        '<svg class="hui-ring_svg" viewBox="0 0 34 34" aria-hidden="true"><circle class="hui-ring_track" cx="17" cy="17" r="15"></circle><circle class="hui-ring_arc" cx="17" cy="17" r="15"></circle></svg>' +
        '<span class="hui-ring_glyphs" aria-hidden="true">' +
        '<svg class="hui-ring_pause" viewBox="0 0 24 24"><rect x="14" y="3" width="5" height="18" rx="1.4"></rect><rect x="5" y="3" width="5" height="18" rx="1.4"></rect></svg>' +
        '<svg class="hui-ring_play" viewBox="0 0 24 24"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"></path></svg>' +
        '</span>';
      ring.setAttribute('role', 'button');
      ring.setAttribute('tabindex', '0');
      ring.setAttribute('aria-label', 'Pause');
      ring.removeAttribute('aria-valuenow');
      const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
      ring.addEventListener('pointerdown', (e) => e.stopPropagation());
      ring.addEventListener('click', (e) => { stop(e); togglePause(); });
      ring.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { stop(e); togglePause(); } });
      return ring.querySelector('.hui-ring_arc');
    });
    function setSlideProgress(index, value) {
      const v = Math.max(0, Math.min(1, Number(value) || 0));
      const arc = arcs[index];
      if (arc) arc.style.strokeDashoffset = (RING_C * (1 - v)).toFixed(2);
      if (rings[index]) rings[index].style.setProperty('--hero-slide-progress', v);
    }
    const resetAllProgress = () => slides.forEach((_, i) => setSlideProgress(i, 0));

    /* ---------------- videos ---------------- */
    const safePlay = (v) => { if (!v) return; v.muted = true; const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    const safePause = (v) => { if (!v) return; try { v.pause(); } catch (e) {} };
    // side cards rest on a mid-clip frame — frame 0 is black on some clips
    const poster = (v) => {
      if (!v) return;
      const d = v.duration;
      // on a slow connection the length isn't known yet and a seek to 45% fails silently
      if (!d || !isFinite(d)) { v.addEventListener('loadedmetadata', () => { if (v.paused && videos.indexOf(v) !== activeSlideIndex) poster(v); }, { once: true }); return; }
      if (Math.abs(v.currentTime - d * 0.45) < 0.05) return;
      try { v.currentTime = d * 0.45; } catch (e) {}
    };
    videos.forEach((v, i) => {
      if (!v) return;
      v.muted = true; v.loop = true; v.playsInline = true;
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      v.removeAttribute('autoplay');
      safePause(v);
      if (v.readyState >= 1 && i !== 0) poster(v);
      v.addEventListener('loadedmetadata', () => { fitVideo(i); if (i !== activeSlideIndex && !introRunning) poster(v); });
      if (v.readyState >= 1) fitVideo(i);
    });

    /* object-position solved so the clip's focal point lands on its aim point in the card */
    function fitVideo(i) {
      const v = videos[i], f = VIDEO_FRAMING[i];
      if (!v || !f) return;
      const W = v.clientWidth, H = v.clientHeight, vw = v.videoWidth, vh = v.videoHeight;
      if (!W || !H || !vw || !vh) return;
      const k = Math.max(W / vw, H / vh), rw = vw * k, rh = vh * k;
      const aim = W / H < 0.9 ? f.aimTall : f.aim;
      const solve = (F, R, fo, a) => (Math.abs(F - R) < 0.5 ? 0.5 : Math.min(1, Math.max(0, (a * F - fo * R) / (F - R))));
      const pos = (solve(W, rw, f.focal[0], aim[0]) * 100).toFixed(2) + '% ' + (solve(H, rh, f.focal[1], aim[1]) * 100).toFixed(2) + '%';
      if (v._op !== pos) { v._op = pos; v.style.objectPosition = pos; }
      // the intro's zoom pivots on the focal point, so the face never leaves the frame
      const px = solve(W, rw, f.focal[0], aim[0]), py = solve(H, rh, f.focal[1], aim[1]);
      const ox = ((W - rw) * px + f.focal[0] * rw) / W * 100, oy = ((H - rh) * py + f.focal[1] * rh) / H * 100;
      v.style.transformOrigin = ox.toFixed(1) + '% ' + oy.toFixed(1) + '%';
    }
    if (window.ResizeObserver) {
      const fitRO = new ResizeObserver(() => videos.forEach((_, i) => fitVideo(i)));
      videos.forEach((v) => v && fitRO.observe(v));
    }

    /* ---------------- clock ---------------- */

    /* the ring and the auto-advance follow the UI thread, not the clip: a long clip played
       twice used to hold the slide ~20s after its conversation had finished */
    const clipLen = (i) => { const v = videos[i], d = v && v.duration; return d && isFinite(d) ? d : 0; };
    const holdFor = (i) => Math.max(clipLen(i) * (VIDEO_LOOPS[i] || 1), ui.need(i)) || 8;

    /* story time. A single-pass clip drives its story through the playhead, so the bubbles
       stay on Grace's words through stalls and buffering; once the clip has ended (or for a
       looping / missing clip) the wall clock takes over. */
    let endedAt = 0;
    function storyTime(i, now) {
      const v = videos[i], d = clipLen(i);
      if (!v || !d || (VIDEO_LOOPS[i] || 1) !== 1) return (now - clockT0) / 1000;
      if (v.ended || v.currentTime >= d - 0.04) {
        if (!endedAt) endedAt = now;
        return d + (now - endedAt) / 1000;
      }
      endedAt = 0;
      return v.currentTime;
    }
    const running = () => !userPaused && !offscreen && !document.hidden;

    /* the UI threads wait for the visitor's first scroll (or a click / swipe on the slider);
       until then the clip plays, the ring sits at 0 and the overlays stay hidden */
    let engaged = (window.scrollY || window.pageYOffset || 0) > 0;
    const engage = () => { if (!engaged && !introRunning) engaged = true; };
    window.addEventListener('scroll', () => { if ((window.scrollY || window.pageYOffset || 0) > 0) engage(); }, { passive: true });
    // a wheel or swipe counts even when the page can't move (e.g. at the very top)
    window.addEventListener('wheel', engage, { passive: true });
    window.addEventListener('touchmove', engage, { passive: true });
    window.addEventListener('keydown', (e) => {
      if (/^(ArrowDown|ArrowUp|PageDown|PageUp|Space| |End|Home)$/.test(e.key) && !(e.target.closest && e.target.closest('input, textarea, select'))) engage();
    });
    function armCheck() {
      if (armed) return true;
      // desktop waits for the visitor's first scroll / swipe / click; below 992px there is
      // no expansion to wait for, so the story starts as soon as the slider is in view
      // (right after the intro, when it plays)
      if (!engaged && isDesktop) return false;
      const r = slider.getBoundingClientRect(), H = window.innerHeight;
      if (r.height < 40) return false;
      const vis = Math.min(r.bottom, H) - Math.max(r.top, 0);
      // phones/tablets: half the slider in view is enough (on a short phone it runs past the fold)
      if (!isDesktop ? vis >= r.height * 0.5 : vis >= Math.min(r.height, H * 0.95) * 0.85 || vis >= H * 0.75) {
        armed = true;
        clockT0 = performance.now();
        // until now the clip looped freely, so its playhead is anywhere. The story is cut to
        // the clip, so both start together: the clip restarts and plays once.
        startClip(clockIndex);
      }
      return armed;
    }

    function frame() {
      raf = 0;
      if (clockIndex < 0 || !running()) return;
      raf = requestAnimationFrame(frame);
      const i = clockIndex;
      if (!armCheck()) {
        clockT0 = performance.now();
        setSlideProgress(i, 0);
        ui.hide(i);
        return;
      }
      const t = storyTime(i, performance.now());
      const hold = holdFor(i);
      const pct = Math.min(1, Math.max(0, t / hold));
      setSlideProgress(i, pct);
      ui.paint(i, t);
      if (pct >= 1) {
        cancelAnimationFrame(raf); raf = 0;
        clockIndex = -1;
        goToSlide((i + 1) % slides.length, { restartVideoOnChange: true });
      }
    }

    // play the active clip once, from 0 (before the story is armed it just loops)
    function startClip(i) {
      const v = videos[i];
      if (!v) return;
      v.loop = (VIDEO_LOOPS[i] || 1) > 1;
      endedAt = 0;
      try { v.currentTime = 0; } catch (e) {}
      if (running()) safePlay(v);
    }

    function startClock(i, delayMs = 0) {
      cancelAnimationFrame(raf); raf = 0;
      clockIndex = i;
      endedAt = 0;
      const cv = videos[i];
      if (cv) cv.loop = !armed || (VIDEO_LOOPS[i] || 1) > 1;
      ui.reset(i);
      setSlideProgress(i, 0);
      clockT0 = performance.now() + delayMs;
      frozenAt = running() ? 0 : performance.now();
      if (running()) raf = requestAnimationFrame(frame);
      else ui.paint(i, Math.max(0, -delayMs / 1000)); // paused: show the first frame state
    }
    function stopClock() {
      cancelAnimationFrame(raf); raf = 0;
      slides.forEach((_, i) => ui.hide(i));
      clockIndex = -1;
    }
    /* freeze / thaw — the clock shifts by the frozen span so nothing jumps */
    function syncRunning() {
      if (introRunning) return;
      const v = videos[activeSlideIndex];
      if (running()) {
        if (frozenAt) {
          const span = performance.now() - frozenAt;
          clockT0 += span;
          if (endedAt) endedAt += span;
          frozenAt = 0;
        }
        // a finished single-pass clip holds its last frame — play() would restart it
        if (v && !(v.ended && !v.loop)) safePlay(v);
        if (clockIndex >= 0 && !raf) raf = requestAnimationFrame(frame);
      } else {
        if (!frozenAt) frozenAt = performance.now();
        cancelAnimationFrame(raf); raf = 0;
        videos.forEach(safePause);
      }
    }
    function togglePause() {
      userPaused = !userPaused;
      component.classList.toggle('is-hero-paused', userPaused);
      slider.classList.toggle('is-hero-paused', userPaused); // the pin can reparent the slider out of the component
      rings.forEach((r) => { if (r) { r.setAttribute('aria-label', userPaused ? 'Play' : 'Pause'); r.setAttribute('aria-pressed', String(userPaused)); } });
      syncRunning();
    }

    /* ---------------- slider ---------------- */
    function removeSliderMaxHeight() { slider.style.setProperty('max-height', 'none', 'important'); }
    new MutationObserver(() => {
      if (slider.style.getPropertyValue('max-height') !== 'none') removeSliderMaxHeight();
    }).observe(slider, { attributes: true, attributeFilter: ['style'] });
    gsap.set(track, { height: '100%' });

    function getTrackXForSlide(index) {
      const slide = slides[index];
      if (!slide) return 0;
      const currentX = Number(gsap.getProperty(track, 'x')) || 0;
      gsap.set(track, { x: 0 });
      const sr = slider.getBoundingClientRect(), r = slide.getBoundingClientRect();
      const first = slides[0].getBoundingClientRect(), last = slides[slides.length - 1].getBoundingClientRect();
      gsap.set(track, { x: currentX });
      // the active card is centred, but the row never pulls away from the page gutter: the
      // first card sits on the left gutter (so the next one peeks in wide on the right) and
      // the last one on the right gutter (from the prototype)
      const gutter = Math.min(110, Math.max(16, Math.round(sr.width * 0.055)));
      const centred = sr.left + sr.width / 2 - (r.left + r.width / 2);
      const maxX = sr.left + gutter - first.left;
      const minX = sr.right - gutter - last.right;
      return minX > maxX ? centred : Math.min(maxX, Math.max(minX, centred));
    }
    function positionTrackAtFirstSlide() { gsap.set(track, { x: getTrackXForSlide(0) }); }
    function getTrackBounds() { return { maxX: getTrackXForSlide(0), minX: getTrackXForSlide(slides.length - 1) }; }

    function updateActiveState(index, { restart = false, play = true } = {}) {
      activeSlideIndex = Math.max(0, Math.min(slides.length - 1, index));
      slides.forEach((slide, i) => {
        const isActive = i === activeSlideIndex;
        slide.classList.toggle('is-active', isActive);
        const v = videos[i];
        if (!v) return;
        if (isActive && play) {
          if (restart) { try { v.currentTime = 0; } catch (e) {} }
          if (running()) safePlay(v); else safePause(v);
        } else {
          safePause(v);
          if (!isActive) poster(v);
        }
      });
    }

    function goToSlide(index, { immediate = false, restartVideoOnChange = true } = {}) {
      const next = Math.max(0, Math.min(slides.length - 1, index));
      const changed = next !== activeSlideIndex || clockIndex < 0;
      const targetX = getTrackXForSlide(next);
      gsap.killTweensOf(track);
      if (changed) {
        stopClock();
        resetAllProgress();
      }
      updateActiveState(next, { restart: changed && restartVideoOnChange, play: true });
      if (immediate) {
        gsap.set(track, { x: targetX });
        if (changed) startClock(next);
        return;
      }
      if (changed) startClock(next, 560); // the thread opens once the card has settled
      gsap.to(track, { x: targetX, duration: 0.65, ease: 'power3.inOut', overwrite: true });
    }

    /* a click on a card brings the slider to its full size: on desktop that is the end of
       the pinned expansion; on smaller screens, the whole slider in view under the nav */
    function revealSlider() {
      let target;
      if (isDesktop && scrollTrigger) {
        target = scrollTrigger.end;
      } else {
        const r = slider.getBoundingClientRect(), H = window.innerHeight, navB = navBottom();
        if (r.top >= navB && r.bottom <= H) return;
        target = getY() + r.top - navB - Math.max(0, Math.min(24, (H - navB - r.height) / 2));
      }
      target = Math.max(0, Math.round(target));
      if (Math.abs(getY() - target) < 2) return;
      window.scrollTo({ top: target, left: 0, behavior: 'smooth' });
    }

    function getClosestSlideIndex(x) {
      let best = 0, dist = Infinity;
      slides.forEach((_, i) => { const d = Math.abs(x - getTrackXForSlide(i)); if (d < dist) { dist = d; best = i; } });
      return best;
    }

    let dragStartX = 0, dragStartTrackX = 0, dragCurrentX = 0, isDragging = false, didDrag = false, downIndex = -1;
    function setupSlider() {
      slider.style.touchAction = 'pan-y';
      slider.style.userSelect = 'none';
      slides.forEach((slide, index) => {
        slide.style.cursor = 'pointer';
        slide.addEventListener('click', (e) => {
          if (didDrag) { e.preventDefault(); e.stopPropagation(); return; }
          if (e.target.closest && e.target.closest('.home-hero_progress')) return; // play / pause
          engage();
          if (index !== activeSlideIndex) { e.preventDefault(); goToSlide(index); }
          revealSlider();
        }, true);
        slide.addEventListener('dragstart', (e) => e.preventDefault());
      });
      slider.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        // a mouse press on a bubble selects text instead of dragging
        if (e.pointerType === 'mouse' && e.target.closest && e.target.closest('.hui_bubble, .hui_panel')) return;
        gsap.killTweensOf(track);
        dragStartX = dragCurrentX = e.clientX;
        dragStartTrackX = Number(gsap.getProperty(track, 'x')) || 0;
        isDragging = true;
        didDrag = false;
        const hit = document.elementFromPoint(e.clientX, e.clientY);
        const s = hit && hit.closest ? hit.closest('.home-hero_slide') : null;
        downIndex = s && track.contains(s) ? slides.indexOf(s) : -1;
      });
      slider.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX;
        dragCurrentX = e.clientX;
        if (Math.abs(dx) > 6 && !didDrag) {
          didDrag = true;
          if (slider.setPointerCapture) { try { slider.setPointerCapture(e.pointerId); } catch (err) {} }
        }
        if (!didDrag) return;
        const b = getTrackBounds();
        let x = dragStartTrackX + dx;
        if (x > b.maxX) x = b.maxX + (x - b.maxX) * 0.18;
        if (x < b.minX) x = b.minX + (x - b.minX) * 0.18;
        gsap.set(track, { x });
      });
      function finishDrag(e) {
        if (!isDragging) return;
        isDragging = false;
        if (slider.hasPointerCapture && slider.hasPointerCapture(e.pointerId)) slider.releasePointerCapture(e.pointerId);
        if (!didDrag) {
          const idx = downIndex;
          downIndex = -1;
          if (idx >= 0 && idx !== activeSlideIndex) goToSlide(idx);
          return;
        }
        downIndex = -1;
        engage();
        const dx = dragCurrentX - dragStartX;
        const threshold = Math.min(90, Math.max(45, slider.clientWidth * 0.055));
        let next;
        if (dx <= -threshold && activeSlideIndex < slides.length - 1) next = activeSlideIndex + 1;
        else if (dx >= threshold && activeSlideIndex > 0) next = activeSlideIndex - 1;
        else next = getClosestSlideIndex(Number(gsap.getProperty(track, 'x')) || 0);
        if (next === activeSlideIndex) {
          // snap back without restarting the conversation
          gsap.to(track, { x: getTrackXForSlide(next), duration: 0.45, ease: 'power3.out', overwrite: true });
        } else goToSlide(next);
        setTimeout(() => { didDrag = false; }, 0);
      }
      slider.addEventListener('pointerup', finishDrag);
      slider.addEventListener('pointercancel', finishDrag);
    }

    /* ---------------- desktop: pinned scroll expansion ---------------- */
    const NAV_HEIGHT = 72, NAV_GAP = 32, BOTTOM_GAP = 32;
    const FINAL_VERTICAL_SPACE = NAV_HEIGHT + NAV_GAP + BOTTOM_GAP;
    const EXPANSION_SCROLL = 0.75;
    let pinWrapper = null, scrollTrigger = null, scrollTimeline = null;
    let restingHeight = 0, finalHeight = 0, resizeTimer = null;

    const calculateFinalHeight = () => (finalHeight = Math.max(120, window.innerHeight - FINAL_VERTICAL_SPACE));
    function establishRestingGeometry() {
      gsap.set(slider, { clearProps: 'height,y' });
      removeSliderMaxHeight();
      calculateFinalHeight();
      restingHeight = Math.min(Math.max(120, window.innerHeight - pageTop(slider) - BOTTOM_GAP), finalHeight);
      gsap.set(slider, { height: restingHeight, y: 0 });
      removeSliderMaxHeight();
      positionTrackAtFirstSlide();
    }
    function createPinWrapper() {
      if (pinWrapper) return;
      pinWrapper = document.createElement('div');
      pinWrapper.className = 'home-hero_pin-wrapper';
      slider.parentNode.insertBefore(pinWrapper, slider);
      pinWrapper.appendChild(slider);
      Object.assign(pinWrapper.style, { display: 'flow-root', width: '100%', height: restingHeight + 'px', position: 'relative', overflow: 'visible' });
    }
    /* unpin and put everything back in the flow BEFORE measuring again —
       a pinned (fixed) wrapper reports its screen position, not its page position */
    function teardownPin() {
      if (scrollTrigger) { scrollTrigger.kill(true); scrollTrigger = null; }
      if (scrollTimeline) { scrollTimeline.kill(); scrollTimeline = null; }
    }
    function setupScrollTrigger() {
      teardownPin();
      calculateFinalHeight();
      const scrollDistance = Math.max(1, window.innerHeight * EXPANSION_SCROLL);
      gsap.set(pinWrapper, { height: finalHeight, y: 0 });
      gsap.set(slider, { height: restingHeight, y: 0 });
      removeSliderMaxHeight();
      const sliderTop = pageTop(slider);
      const restingY = window.innerHeight - BOTTOM_GAP - sliderTop - restingHeight;
      const finalY = window.innerHeight - BOTTOM_GAP - sliderTop - finalHeight;
      gsap.set(slider, { y: restingY });
      removeSliderMaxHeight();
      const restingPinTop = pageTop(pinWrapper);
      scrollTimeline = gsap.timeline({ paused: true });
      scrollTimeline.to(slider, { height: finalHeight, y: finalY, duration: 1, ease: 'none', onUpdate: removeSliderMaxHeight });
      scrollTrigger = ScrollTrigger.create({
        trigger: pinWrapper,
        pin: pinWrapper,
        start: () => `top ${restingPinTop}px`,
        end: () => `+=${Math.max(0, scrollDistance - 240)}`,
        animation: scrollTimeline,
        scrub: true,
        pinSpacing: true,
        pinReparent: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: removeSliderMaxHeight,
        onLeave: () => { gsap.set(slider, { height: finalHeight, y: finalY }); removeSliderMaxHeight(); },
        onLeaveBack: () => { gsap.set(slider, { height: restingHeight, y: restingY }); removeSliderMaxHeight(); },
      });
      ScrollTrigger.refresh();
      removeSliderMaxHeight();
    }
    /* ScrollTrigger (with pinReparent) records the pin position wrongly when it is built
       while the page is scrolled — e.g. a reload in the middle of the page. So the pin is
       always built as if the page were at the top: jump to 0, build, jump back. It all
       happens synchronously in one frame, so nothing visibly moves. */
    const getY = () => window.scrollY || window.pageYOffset || 0;
    const jumpTo = (y) => window.scrollTo({ top: y, left: 0, behavior: 'instant' });
    function atTop(fn) {
      const y = getY();
      if (y > 0) jumpTo(0);
      fn();
      if (y > 0) jumpTo(y);
    }
    function setupScrollStage() {
      if (typeof ScrollTrigger === 'undefined') { console.warn('Home Hero: ScrollTrigger is not loaded.'); return; }
      createPinWrapper();
      setupScrollTrigger();
    }

    /* below 992px there is no pinned expansion: the slider simply runs from under the
       headline to the bottom of the screen, so the video is always above the fold.
       Phones change the viewport height while the URL bar slides in and out, so the
       height used here only follows a width change or a big height change (rotation). */
    // tall enough for the tallest overlay panel (Augment's Deputy card, ~245px in a phone-width
    // column, which gets the slider height minus 104px) — on short phones the slider then runs
    // a little past the fold rather than dropping panels it can't fit
    const MOBILE_MIN_H = 380;
    let mobileW = 0, mobileH = 0;
    function sizeMobileSlider() {
      const W = window.innerWidth, H = document.documentElement.clientHeight || window.innerHeight;
      if (W !== mobileW || !mobileH || Math.abs(H - mobileH) > 120) { mobileW = W; mobileH = H; }
      gsap.set(slider, { clearProps: 'height,y' });
      slider.style.setProperty('min-height', '0px', 'important');
      removeSliderMaxHeight();
      const gy = Math.min(40, Math.max(14, Math.round(mobileH * 0.03)));
      gsap.set(slider, { height: Math.max(MOBILE_MIN_H, Math.round(mobileH - pageTop(slider) - gy)) });
      removeSliderMaxHeight();
    }

    function handleResize() {
      if (introRunning) { resizeAfterIntro = true; return; }
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        ui.setNarrow(window.innerWidth <= 720);
        // crossing the 992px breakpoint switches between the pinned and the plain slider in place
        isDesktop = desktopMedia.matches;
        if (!isDesktop) {
          teardownPin();
          if (pinWrapper) gsap.set(pinWrapper, { height: 'auto', clearProps: 'y,transform' });
          sizeMobileSlider();
          gsap.set(track, { x: getTrackXForSlide(activeSlideIndex) });
          ui.invalidate();
          return;
        }
        atTop(() => {
          teardownPin();
          gsap.set(slider, { clearProps: 'height,y' });
          slider.style.removeProperty('min-height');
          removeSliderMaxHeight();
          if (pinWrapper) gsap.set(pinWrapper, { height: 'auto' });
          calculateFinalHeight();
          restingHeight = Math.min(Math.max(120, window.innerHeight - pageTop(slider) - BOTTOM_GAP), finalHeight);
          gsap.set(slider, { height: restingHeight, y: 0 });
          removeSliderMaxHeight();
          setupScrollStage();
        });
        gsap.set(track, { x: getTrackXForSlide(activeSlideIndex) });
        ui.invalidate();
      }, 150);
    }
    window.addEventListener('resize', () => {
      // a real window resize mid-intro skips straight to the resting slider
      if (introRunning && (window.innerWidth !== introSize.w || Math.abs(window.innerHeight - introSize.h) > 120)) endIntro();
      handleResize();
    }, { passive: true });
    window.addEventListener('load', handleResize);
    if (content && window.ResizeObserver) {
      let lastH = content.offsetHeight;
      new ResizeObserver(() => {
        const h = content.offsetHeight;
        if (Math.abs(h - lastH) < 1) return;
        lastH = h;
        handleResize();
      }).observe(content);
    }

    /* clock + video stop while the hero is off screen or the tab is hidden */
    document.addEventListener('visibilitychange', syncRunning);
    if (window.IntersectionObserver) {
      new IntersectionObserver((entries) => {
        offscreen = !entries[entries.length - 1].isIntersecting;
        syncRunning();
      }).observe(slider);
    }

    /* ---------------- intro ----------------
       A replica of the prototype's runIntro, played on the real Webflow elements:
       stage 1  the sentence reads unbroken, the deck is a zero-size point in its gap
       stage 2  the deck opens in the gap (w2 × w2/1.55) and riffles the three clips
       stage 4  the deck spreads into the slider row at its resting size
       The track/slides only get inline styles while it runs; the hand-off clears them
       and the normal slider takes over from exactly the same picture. */
    const IEZ = 'cubic-bezier(.22,.72,.16,1)';
    const CREEP_MAX = 1.13;
    const introSize = { w: 0, h: 0 };
    const titles = slides.map((s) => s.querySelector('.home-hero_slide-title'));
    let introTimers = [], G = null, introGap = null;

    const introBlockKeys = { ' ': 1, Spacebar: 1, PageDown: 1, PageUp: 1, ArrowDown: 1, ArrowUp: 1, Home: 1, End: 1 };
    const introStop = (e) => { if (e.cancelable) e.preventDefault(); };
    const introStopKey = (e) => {
      const t = e.target;
      if (introBlockKeys[e.key] && !(t && t.closest && t.closest('input, textarea, select, [contenteditable]'))) e.preventDefault();
    };
    // anything that still scrolls the page (an anchor, the browser restoring a position) ends the intro
    const introOnScroll = () => { if (getY() > 2) endIntro(); };
    function introLock(on) {
      const m = on ? 'addEventListener' : 'removeEventListener';
      window[m]('wheel', introStop, { passive: false });
      window[m]('touchmove', introStop, { passive: false });
      window[m]('keydown', introStopKey);
      window[m]('scroll', introOnScroll, { passive: true });
    }

    function navBottom() {
      const n = document.querySelector('[data-nav="component"]') || document.querySelector('.nav_component, .navbar, header');
      const b = n ? n.getBoundingClientRect().bottom : NAV_HEIGHT;
      return Math.max(0, Math.min(160, Math.round(isFinite(b) ? b : NAV_HEIGHT)));
    }

    function introPlay(k) {
      // one clip at a time — two or more playing clips drop Chrome on 120Hz screens to the
      // clips' 30fps for the whole page. The hidden ones also settle on their peek frame now,
      // so nothing jumps when the deck spreads into the row.
      videos.forEach((v, j) => { if (!v || j === k) return; if (!v.paused) safePause(v); poster(v); });
      const v = videos[k];
      if (!v) return;
      try { v.currentTime = 0; } catch (e) {}
      safePlay(v);
    }
    // riffle: only the stacking order changes, so the frame keeps opening underneath
    function introFlip(k) {
      introPlay(k);
      const n = slides.length;
      slides.forEach((s, j) => { s.style.zIndex = String(9 - (((j - k) % n) + n) % n); });
    }

    function introStage(stage, ms) {
      const g = G;
      let w, h, tx, ty, rad;
      if (stage <= 1) { w = 0; h = 0; tx = g.gx - g.sr.left; ty = g.gy - g.sr.top; rad = 4; }
      else if (stage === 2) { w = g.w2; h = g.h2; tx = g.gx - g.sr.left - g.w2 / 2; ty = g.gy - g.sr.top - g.h2 / 2; rad = 12; }
      else { w = g.cardW; h = g.sliderH; tx = g.restX; ty = 0; rad = g.radius; }
      track.style.transition = ms ? 'transform ' + ms + 'ms ' + IEZ + ', height ' + ms + 'ms ' + IEZ : 'none';
      track.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0)';
      track.style.height = h + 'px';
      slider.classList.toggle('is-hero-deck', stage <= 2);
      slides.forEach((s, k) => {
        // while the deck is stacked its offset is a % of the live width, so it must not tween
        const tf = stage <= 2 ? '' : 'transform ' + ms + 'ms ' + IEZ + ', ';
        s.style.transition = ms ? 'width ' + ms + 'ms ' + IEZ + ', ' + tf + 'filter ' + ms + 'ms ease, border-radius ' + ms + 'ms ease' : 'none';
        s.style.flex = '0 0 auto';
        s.style.width = w + 'px';
        s.style.borderRadius = rad + 'px';
        if (stage <= 2) {
          // every card parked on card 0's slot: one frame, the clips swapping behind it
          s.style.transform = 'translate3d(calc(' + (-k * 100) + '% - ' + (k * g.gap).toFixed(1) + 'px),0,0)';
          s.style.zIndex = String(9 - k);
        } else {
          s.style.transform = 'translate3d(0,0,0)';
          s.style.zIndex = k === activeSlideIndex ? '2' : '1';
        }
        const v = videos[k];
        if (v) {
          v.style.transition = ms ? 'transform ' + ms + 'ms ' + IEZ : 'none';
          // the footage keeps zooming out as the frame opens, so the picture is never static
          v.style.transform = 'scale(' + (stage <= 1 ? 1.55 : stage === 2 ? 1.18 : 1) + ')';
        }
      });
      // the two halves slide apart on transforms (animating the gap's width would reflow the text)
      // phones stack the halves, so they part vertically around the frame instead
      const frame = g.vertical ? g.h2 : g.w2, far = g.vertical ? g.H * 0.6 : g.W * 0.6;
      const want = stage <= 1 ? g.gapW : stage === 2 ? frame + Math.round(frame * 0.28) : Math.round(far);
      const dx = Math.max(0, (want - g.gapW) / 2);
      [introL, introR].forEach((el, k) => {
        el.style.transition = ms ? 'transform ' + ms + 'ms ' + IEZ : 'none';
        const d = (k ? dx : -dx).toFixed(1) + 'px';
        el.style.transform = g.vertical ? 'translate3d(0,' + d + ',0)' : 'translate3d(' + d + ',0,0)';
      });
    }

    function introRevealLabels() {
      slider.classList.remove('is-hero-labels-off');
      slides.forEach((_, k) => {
        [titles[k], rings[k]].forEach((el) => { if (el) el.style.transition = 'opacity 620ms ease ' + k * 80 + 'ms'; });
      });
      setTimeout(() => { titles.concat(rings).forEach((el) => { if (el) el.style.transition = ''; }); }, 1000);
    }

    function runIntro() {
      introRunning = true;
      introSize.w = window.innerWidth; introSize.h = window.innerHeight;
      const de = document.documentElement;
      const W = de.clientWidth;

      /* headline: shown, laid out flat, font capped so both halves stay on screen at peak spread */
      if (!introGap) {
        introGap = document.createElement('span');
        introGap.className = 'home-hero_intro-gap';
        introGap.setAttribute('aria-hidden', 'true');
        introL.after(introGap);
      }
      introEl.setAttribute('aria-hidden', 'true');
      const top = navBottom();
      introEl.style.top = top + 'px';
      introEl.style.height = Math.max(200, window.innerHeight - top) + 'px';
      introHeading.style.transition = 'none';
      introHeading.style.transform = 'none';
      introHeading.style.opacity = '0';
      introHeading.style.fontSize = '';
      de.classList.add('is-hero-intro');
      // below 768px the sentence is stacked (hero.css) and the frame opens between the lines
      const vertical = window.matchMedia('(max-width: 767px)').matches;
      const w2 = vertical
        ? Math.round(Math.max(150, Math.min(260, W * 0.5)))
        : Math.round(Math.max(110, Math.min(250, W * 0.165)));
      const L = introL.offsetWidth, R = introR.offsetWidth;
      if (L && R) {
        const side = Math.min(110, Math.max(16, Math.round(W * 0.055)));
        const room = W - 2 * Math.max(16, side * 0.5);
        const k = vertical
          ? room / (Math.max(L, R) * CREEP_MAX)  // each line on its own must fit
          : (room - (w2 + Math.round(w2 * 0.28)) * CREEP_MAX) / ((L + R) * CREEP_MAX);
        if (k < 1) introHeading.style.fontSize = (parseFloat(getComputedStyle(introHeading).fontSize) * Math.max(0.4, k)).toFixed(2) + 'px';
      }
      const gr = introGap.getBoundingClientRect(), hr = introHeading.getBoundingClientRect();
      const gx = gr.left + gr.width / 2, gy = gr.top + gr.height / 2;
      // the type scales about the gap's centre, so the gap never drifts while it grows
      introHeading.style.transformOrigin = (gx - hr.left).toFixed(1) + 'px ' + (gy - hr.top).toFixed(1) + 'px';

      /* slider: everything the deck grows into, measured at rest */
      const restX = getTrackXForSlide(0);
      const cardW = slides[0].getBoundingClientRect().width;
      const tcs = getComputedStyle(track);
      G = {
        W, H: window.innerHeight, vertical, gx, gy, w2, h2: Math.round(w2 / 1.55),
        gapW: vertical ? introGap.offsetHeight : introGap.offsetWidth,
        sr: slider.getBoundingClientRect(), sliderH: slider.clientHeight,
        restX, cardW, gap: parseFloat(tcs.columnGap || tcs.gap) || 12,
        radius: parseFloat(getComputedStyle(slides[0]).borderTopLeftRadius) || 16,
      };

      stopClock();
      resetAllProgress();
      gsap.killTweensOf(track);
      gsap.set(track, { clearProps: 'transform' });
      slider.classList.add('is-hero-labels-off');
      slider.style.overflow = 'visible';
      slider.style.pointerEvents = 'none';
      introStage(1, 0);
      slider.style.visibility = '';
      introLock(true);

      /* the type creeps up the whole way, right into the blow-out */
      void introHeading.offsetWidth;
      introHeading.style.transition = 'opacity 420ms linear, transform 1600ms cubic-bezier(.25,.33,.6,.78)';
      introHeading.style.opacity = '1';
      introHeading.style.transform = 'translateZ(0) scale(' + CREEP_MAX + ')';

      const at = (ms, fn) => introTimers.push(setTimeout(fn, ms));
      // the frame wedges the sentence apart as the type arrives…
      at(200, () => { introStage(2, 900); introPlay(0); });
      // …riffling the three clips as a stacked deck while it opens…
      [1, 2, 0, 1, 2, 0].forEach((k, n) => at(380 + n * 170, () => introFlip(k)));
      // …then spreads into the row as the headline + form come up and the words blow out
      at(1550, () => {
        introStage(4, 1180);
        videos.forEach((v, k) => { if (v && k !== 0) safePause(v); });
        if (content) {
          content.style.transition = 'opacity 700ms ease 120ms';
          content.style.opacity = '1';
          content.style.pointerEvents = '';
        }
        introHeading.style.transition = 'opacity 420ms ease 260ms, transform 760ms cubic-bezier(.32,0,.34,1)';
        void introHeading.offsetWidth;
        requestAnimationFrame(() => {
          introHeading.style.opacity = '0';
          introHeading.style.transform = 'translateZ(0) scale(3.8)';
        });
      });
      at(2810, introRevealLabels);
      at(3150, endIntro);
    }

    /* hand-off: drop every inline intro style — the resting slider is the same picture */
    function endIntro() {
      if (!introRunning) return;
      introTimers.forEach(clearTimeout);
      introTimers = [];
      introLock(false);
      document.documentElement.classList.remove('is-hero-intro');
      if (slider.classList.contains('is-hero-labels-off')) introRevealLabels();
      slider.classList.remove('is-hero-deck');
      [introHeading, introL, introR].forEach((el) => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; });
      introHeading.style.fontSize = '';
      introHeading.style.transformOrigin = '';
      introEl.style.top = ''; introEl.style.height = '';
      if (content) { content.style.transition = ''; content.style.opacity = '1'; content.style.pointerEvents = ''; }
      slides.forEach((s) => { ['transition', 'flex', 'width', 'borderRadius', 'transform', 'zIndex'].forEach((p) => { s.style[p] = ''; }); });
      videos.forEach((v) => { if (v) { v.style.transition = ''; v.style.transform = ''; } });
      track.style.transition = '';
      track.style.transform = '';
      gsap.set(track, { clearProps: 'transform' });
      gsap.set(track, { height: '100%' });
      slider.style.overflow = '';
      slider.style.pointerEvents = '';
      slider.style.visibility = '';
      introRunning = false;
      activeSlideIndex = -1;
      goToSlide(0, { immediate: true, restartVideoOnChange: false });
      syncRunning();
      if (resizeAfterIntro) { resizeAfterIntro = false; handleResize(); }
    }

    function revealWithoutIntro() {
      introWanted = false;
      if (content) { content.style.opacity = '1'; content.style.pointerEvents = ''; }
      slider.style.visibility = '';
    }

    /* ---------------- start ---------------- */
    function start() {
      requestAnimationFrame(() => {
        // the user may have scrolled while the fonts loaded — no intro then
        if (introWanted && getY() > 10) revealWithoutIntro();
        if (introWanted) jumpTo(0);
        removeSliderMaxHeight();
        if (isDesktop) {
          atTop(() => {
            establishRestingGeometry();
            setupScrollStage();
          });
        } else {
          sizeMobileSlider();
        }
        // the hero now has its real height — drop the placeholder height from hero.css
        document.documentElement.classList.add('is-hero-sized');
        setupSlider();
        if (introWanted) {
          try { runIntro(); return; } catch (e) {
            console.error('Home Hero intro:', e);
            if (introRunning) { endIntro(); return; }
            revealWithoutIntro();
          }
        }
        requestAnimationFrame(() => {
          activeSlideIndex = -1;
          goToSlide(0, { immediate: true, restartVideoOnChange: true });
        });
      });
    }
    /* loading: the lead clip first; the other two once it can play through (or after 1.5s),
       so the first visit downloads one clip up front instead of all three */
    (function loadClips() {
      const lead = videos[0];
      const rest = () => videos.forEach((v, i) => { if (v && i > 0 && v.preload !== 'auto') v.preload = 'auto'; });
      if (!lead) return rest();
      lead.preload = 'auto';
      videos.forEach((v, i) => { if (v && i > 0 && v.preload === 'auto') v.preload = 'metadata'; });
      let done = false;
      const go = () => { if (!done) { done = true; rest(); } };
      if (lead.readyState >= 4) go();
      else { lead.addEventListener('canplaythrough', go, { once: true }); setTimeout(go, 1500); }
    })();
    resetAllProgress();
    updateActiveState(0, { play: false });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();

    /* ---------------- Beast Mode: hovering the button jolts the page ----------------
       (from the prototype) 0.9s of the chat widget's beast-mode keyframes on the page
       wrapper, plus a decaying rattle on up to 10 blocks in view. Translate only, no
       rotation (a full-page wrapper's far edges would swing 30px+). Skipped for reduced motion. */
    const beast = component.querySelector('.home-hero_beast, [data-hero="beast"]');
    if (beast) {
      const QUAKE_DUR = 0.9;
      const QUAKE_KF = [[0, 0], [-9, 4], [8, -6], [-11, -3], [9, 5], [-6, -5], [6, 4], [-4, -3], [3, 2], [-2, -1], [0, 0]];
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let qRaf = 0, qT = 0, qLast = 0, ground = null, extra = [], targets = [];
      // cubic-bezier(.36,.07,.19,.97)
      const qEase = (p) => {
        let t = p;
        for (let n = 0; n < 6; n++) {
          const u = 1 - t;
          const dx = 3 * u * u * 0.36 + 6 * u * t * (0.19 - 0.36) + 3 * t * t * (1 - 0.19);
          if (Math.abs(dx) < 1e-6) break;
          t -= (3 * u * u * t * 0.36 + 3 * u * t * t * 0.19 + t * t * t - p) / dx;
        }
        const u = 1 - t;
        return 3 * u * u * t * 0.07 + 3 * u * t * t * 0.97 + t * t * t;
      };
      const pickTargets = () => {
        const out = [], vh = window.innerHeight, vw = window.innerWidth;
        const SKIP = { SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, BR: 1, SOURCE: 1, VIDEO: 1, IFRAME: 1 };
        const scan = (node, depth) => {
          const kids = node.children;
          for (let n = 0; n < kids.length && out.length < 10; n++) {
            const el = kids[n];
            if (!el.style || SKIP[el.tagName] || el === slider || slider.contains(el) || el.contains(slider)) {
              if (el.contains && el.contains(slider) && el !== slider && depth < 4) scan(el, depth + 1);
              continue;
            }
            const r = el.getBoundingClientRect();
            if (r.bottom < 0 || r.top > vh || r.width < 40 || r.height < 24) continue;
            const managed = (el.style.transform && el.style.transform !== 'none') || getComputedStyle(el).position === 'fixed';
            if (!managed && depth >= 1 && r.height <= vh * 0.7 && r.width <= vw * 0.96) {
              out.push({ el, f: 36 + Math.random() * 38, p: Math.random() * 6.28, a: 0.4 + Math.random() * 0.8 });
              continue;
            }
            if (depth < 4) scan(el, depth + 1);
          }
        };
        scan(document.body, 0);
        return out;
      };
      const endQuake = () => {
        cancelAnimationFrame(qRaf); qRaf = 0; qT = 0; qLast = 0;
        [ground].concat(extra).forEach((el) => { if (el) { el.style.transform = ''; el.style.willChange = ''; } });
        targets.forEach((q) => { q.el.style.transform = ''; q.el.style.willChange = ''; });
        ground = null; extra = []; targets = [];
      };
      const tick = (now) => {
        // frame deltas, not wall time: a throttled background tab pauses the jolt instead of skipping it
        const dt = Math.min(0.05, qLast ? (now - qLast) / 1000 : 0.016);
        qLast = now;
        qT += dt;
        if (qT >= QUAKE_DUR) { endQuake(); return; }
        const e = qEase(qT / QUAKE_DUR) * 10, k = Math.min(9, Math.floor(e)), f = e - k;
        const a = QUAKE_KF[k], b = QUAKE_KF[k + 1];
        const tf = 'translate3d(' + (a[0] + (b[0] - a[0]) * f).toFixed(2) + 'px,' + (a[1] + (b[1] - a[1]) * f).toFixed(2) + 'px,0)';
        if (ground) ground.style.transform = tf;
        extra.forEach((el) => { el.style.transform = tf; });
        const env = 1 - qT / QUAKE_DUR;
        targets.forEach((q) => {
          const amp = q.a * env;
          q.el.style.transform = 'translate3d(' + (Math.sin(qT * q.f + q.p) * 6 * amp).toFixed(2) + 'px,' + (Math.cos(qT * q.f * 1.17 + q.p) * 5 * amp).toFixed(2) + 'px,0)';
        });
        qRaf = requestAnimationFrame(tick);
      };
      beast.addEventListener('mouseenter', () => {
        if (reduce || qRaf || introRunning) return;
        // the page wrapper = the tallest in-flow child of <body> (on Webflow the first child is a 0px widget host)
        ground = Array.from(document.body.children)
          .filter((el) => el.style && !/^(SCRIPT|STYLE|LINK|IFRAME|NOSCRIPT)$/.test(el.tagName) && getComputedStyle(el).position !== 'fixed')
          .reduce((best, el) => (!best || el.offsetHeight > best.offsetHeight ? el : best), null);
        // while pinned, the slider lives outside the wrapper (fixed): its cards jolt with the ground
        extra = ground && !ground.contains(slider) ? slides.slice() : [];
        targets = pickTargets();
        [ground].concat(extra).forEach((el) => { if (el) el.style.willChange = 'transform'; });
        targets.forEach((q) => { q.el.style.willChange = 'transform'; });
        qT = 0; qLast = 0;
        qRaf = requestAnimationFrame(tick);
      });
    }

    window.CrestaHeroUI = {
      goTo: (i) => goToSlide(i),
      pause: () => { if (!userPaused) togglePause(); },
      play: () => { if (userPaused) togglePause(); },
      togglePause,
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHomeHero);
  else initHomeHero();
})();
