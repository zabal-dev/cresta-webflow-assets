/* =====================================================================
   CRESTA · HOME HERO
   - no intro: headline, form and slider are visible from the first paint
   - desktop (≥992px): pinned scroll expansion of the slider (unchanged)
   - slider: drag / swipe / click a side card, auto-advance
   - UI overlays: a 1:1 port of the prototype's timelines (Automate chat,
     Augment transcript + Agent Assist rail, Analyze widgets + cursor)
   - progress ring doubles as play / pause
   Requires GSAP + ScrollTrigger loaded before this script.
   ===================================================================== */
(() => {
  /* ------------------------------------------------------------------
     ASSETS — paste the Webflow asset URLs here
     ------------------------------------------------------------------ */
  const HERO_UI_ASSETS = {
    loaderGif: '',   // cresta-loader.gif
    loaderStill: '', // cresta-loader-still.png
    agentAvatar: '', // agent-neda-avatar.jpg
  };

  /* how many times each clip plays before the slide may move on
     (a slide holds for max(clip × loops, its conversation length)) */
  const VIDEO_LOOPS = [2, 1, 1];

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
      { lead: 1.2, tail: 5.4, seq: [0, 3.4, 7.1, 10.6, 13.9, 17.5, 19.9] },
      { lead: 1.0, tail: 4.8, seq: [0, 2.8, 10.6, 13.6], seqR: [5.4, 15.2] },
      { lead: 1.0, tail: 9.2, seq: [0, 3.4, 13.2], max: 3 },
    ];
    const OV_RISE = 1.05;
    const OV_MAX = 4;
    const MORPH_HOLD = 1.7;
    const MORPH_DUR = 0.52;
    const ANZ_CLICK_S = [5.4, 11.8, 18.0];
    const ANZ_TYPE_S = [14.2, 17.6];

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
      const gap = Math.max(9, Math.round(H * 0.026));
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
          tk, tkOff, tkS: [], cr: b.querySelector('[data-cr]'),
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
        baseline: H - Math.max(24, Math.round(H * 0.07)),
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
        const sw = cl((dt - pd - 1.9) / 0.26);
        if (pl._ld) pl._ld.style.opacity = (1 - sw).toFixed(3);
        if (pl._dn) pl._dn.style.opacity = sw.toFixed(3);
        if (pl._mk) pl._mk.style.strokeDashoffset = (24 * Math.pow(1 - cl((dt - pd - 2.1) / 0.38), 5)).toFixed(1);
      }
      return shrink0;
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
      const scroll = from + (bot(last) - from) * ez(cl((t - beats[last]) / OV_RISE)) - baseline;

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
        o *= cl((y + 4) / 34) * cl((H - 6 - y) / 34);
        const dx = (1 - sp) * m.dx0[k];
        const sc = 0.965 + 0.035 * sp;
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
      paintChat(ov, beatsOf(0, 'seq'), t, narrow ? 2 : null);
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
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  function forcePageTop() {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
  forcePageTop();
  window.addEventListener('pageshow', () => { forcePageTop(); requestAnimationFrame(forcePageTop); });
  window.addEventListener('beforeunload', forcePageTop);

  function initHomeHero() {
    const component = document.querySelector('.home-hero_component');
    if (!component || component.dataset.heroInitialized === 'true') return;
    if (typeof gsap === 'undefined') { console.error('Home Hero: GSAP is not loaded.'); return; }
    if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);
    component.dataset.heroInitialized = 'true';

    const desktopMedia = window.matchMedia('(min-width: 992px)');
    const isDesktop = desktopMedia.matches;

    const content = component.querySelector('.home-hero_content');
    const slider = component.querySelector('.home-hero_slider');
    const track = component.querySelector('.home-hero_track');
    const slides = Array.from(component.querySelectorAll('.home-hero_slide'));
    const videos = slides.map((s) => s.querySelector('.home-hero_video'));
    const rings = slides.map((s) => s.querySelector('.home-hero_progress'));
    if (!slider || !track || !slides.length) { console.error('Home Hero: required elements are missing.'); return; }

    /* the intro is gone — make sure nothing of it can show or hide the content */
    const leftoverIntro = component.querySelector('.home-hero_intro');
    if (leftoverIntro) leftoverIntro.style.display = 'none';
    document.documentElement.classList.remove('is-home-hero-intro');
    if (content) gsap.set(content, { autoAlpha: 1, y: 0 });
    gsap.set(slider, { autoAlpha: 1 });

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
    const poster = (v) => { if (!v) return; const d = v.duration; if (!d || !isFinite(d)) return; try { v.currentTime = d * 0.45; } catch (e) {} };
    videos.forEach((v, i) => {
      if (!v) return;
      v.muted = true; v.loop = true; v.playsInline = true;
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      v.removeAttribute('autoplay');
      safePause(v);
      if (v.readyState >= 1 && i !== 0) poster(v);
      v.addEventListener('loadedmetadata', () => { if (i !== activeSlideIndex) poster(v); });
    });

    /* ---------------- clock ---------------- */

    const holdFor = (i) => {
      const v = videos[i];
      const d = v && v.duration;
      const clip = d && isFinite(d) ? d * (VIDEO_LOOPS[i] || 1) : 0;
      return Math.max(clip, ui.need(i));
    };
    const running = () => !userPaused && !offscreen && !document.hidden;

    function armCheck() {
      if (armed) return true;
      const r = slider.getBoundingClientRect(), H = window.innerHeight;
      if (r.height < 40) return false;
      const vis = Math.min(r.bottom, H) - Math.max(r.top, 0);
      if (vis >= Math.min(r.height, H * 0.95) * 0.85 || vis >= H * 0.75) {
        armed = true;
        clockT0 = performance.now();
        const v = videos[clockIndex];
        if (v) { try { v.currentTime = 0; } catch (e) {} }
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
      const t = (performance.now() - clockT0) / 1000;
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

    function startClock(i, delayMs = 0) {
      cancelAnimationFrame(raf); raf = 0;
      clockIndex = i;
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
      const v = videos[activeSlideIndex];
      if (running()) {
        if (frozenAt) { clockT0 += performance.now() - frozenAt; frozenAt = 0; }
        safePlay(v);
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
      const targetX = sr.left + sr.width / 2 - (r.left + r.width / 2);
      gsap.set(track, { x: currentX });
      return targetX;
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
          if (index !== activeSlideIndex) { e.preventDefault(); goToSlide(index); }
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
      const rect = slider.getBoundingClientRect();
      calculateFinalHeight();
      restingHeight = Math.min(Math.max(120, window.innerHeight - rect.top - BOTTOM_GAP), finalHeight);
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
    function setupScrollTrigger() {
      if (scrollTrigger) { scrollTrigger.kill(); scrollTrigger = null; }
      if (scrollTimeline) { scrollTimeline.kill(); scrollTimeline = null; }
      calculateFinalHeight();
      const scrollDistance = Math.max(1, window.innerHeight * EXPANSION_SCROLL);
      gsap.set(pinWrapper, { height: finalHeight, y: 0 });
      gsap.set(slider, { height: restingHeight, y: 0 });
      removeSliderMaxHeight();
      const sliderTop = slider.getBoundingClientRect().top;
      const restingY = window.innerHeight - BOTTOM_GAP - sliderTop - restingHeight;
      const finalY = window.innerHeight - BOTTOM_GAP - sliderTop - finalHeight;
      gsap.set(slider, { y: restingY });
      removeSliderMaxHeight();
      const restingPinTop = pinWrapper.getBoundingClientRect().top;
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
      requestAnimationFrame(() => { removeSliderMaxHeight(); ScrollTrigger.refresh(); });
    }
    function setupScrollStage() {
      if (typeof ScrollTrigger === 'undefined') { console.warn('Home Hero: ScrollTrigger is not loaded.'); return; }
      createPinWrapper();
      setupScrollTrigger();
    }

    function handleResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        ui.setNarrow(window.innerWidth <= 720);
        if (desktopMedia.matches !== isDesktop) { forcePageTop(); window.location.reload(); return; }
        if (!isDesktop) { gsap.set(track, { x: getTrackXForSlide(activeSlideIndex) }); ui.invalidate(); return; }
        if (scrollTrigger) { scrollTrigger.kill(); scrollTrigger = null; }
        if (scrollTimeline) { scrollTimeline.kill(); scrollTimeline = null; }
        gsap.set(slider, { clearProps: 'height,y' });
        removeSliderMaxHeight();
        if (pinWrapper) gsap.set(pinWrapper, { height: 'auto' });
        requestAnimationFrame(() => {
          const rect = slider.getBoundingClientRect();
          calculateFinalHeight();
          restingHeight = Math.min(Math.max(120, window.innerHeight - rect.top - BOTTOM_GAP), finalHeight);
          gsap.set(slider, { height: restingHeight, y: 0 });
          removeSliderMaxHeight();
          setupScrollStage();
          requestAnimationFrame(() => { gsap.set(track, { x: getTrackXForSlide(activeSlideIndex) }); ui.invalidate(); });
        });
      }, 150);
    }
    window.addEventListener('resize', handleResize, { passive: true });

    /* clock + video stop while the hero is off screen or the tab is hidden */
    document.addEventListener('visibilitychange', syncRunning);
    if (window.IntersectionObserver) {
      new IntersectionObserver((entries) => {
        offscreen = !entries[entries.length - 1].isIntersecting;
        syncRunning();
      }).observe(slider);
    }

    /* ---------------- start ---------------- */
    function start() {
      requestAnimationFrame(() => {
        forcePageTop();
        removeSliderMaxHeight();
        if (isDesktop) {
          establishRestingGeometry();
          setupScrollStage();
        } else {
          gsap.set(slider, { clearProps: 'height,y' });
          removeSliderMaxHeight();
        }
        setupSlider();
        requestAnimationFrame(() => {
          activeSlideIndex = -1;
          goToSlide(0, { immediate: true, restartVideoOnChange: true });
        });
      });
    }
    resetAllProgress();
    updateActiveState(0, { play: false });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();

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
