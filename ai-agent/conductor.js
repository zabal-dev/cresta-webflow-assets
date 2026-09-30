/* AIA-CONDUCTOR-V2 2026-09-09
   Cresta AI Agent page — "Meet Conductor" section.
   Upload to: https://website-assets.cresta.com/ai-agent/conductor/aia-conductor.js
   Cache-Control: public, max-age=300 (same-URL overwrite + CloudFront invalidation).

   Delta from V1 (ported from "Conductor Animation.dc.html", 2026-09-08 Claude Design export):
   the scripted demo now closes with a green "Complete" chip, fades out, and auto-loops
   (was: play once, freeze on the end state). The chip element is injected by this script —
   no embed markup change. Scroll morph, timeline constants, copy and the aia-conductor-*
   markup contract are unchanged. */
(function () {
  'use strict';

  var CONTENT = window.AIA_CONDUCTOR_CONTENT || {};
  var MSG = CONTENT.messages || {};
  var STATUS = CONTENT.status || {};
  var STATUS_MOBILE = CONTENT.statusMobile || {};

  var M1 = MSG.m1 || "We're building the Care Agent — a patient-support chat agent for MedCare Health that handles appointments, prescription refills, and insurance questions, with a nurse escalation path.";
  var M2 = MSG.m2 || "Before we start building, review the current config and workspace and draft a BLUEPRINT.md so we can align on scope: the triage → specialist routing, guardrails for a HIPAA setting, and what’s still mock vs. real.";
  var AS = MSG.assist || "I'll start by exploring the current agent workspace and config before drafting the blueprint.";
  var M3 = MSG.m3 || "Config mapped — a triage router over appointment, prescription, and insurance specialists. Before drafting, let me ground this in how patients actually reach out.";
  var M4 = MSG.m4 || "Real traffic confirms the four intents. Now grounding the blueprint in the platform's automation flows, knowledge base, and conversation topics.";
  var M5 = MSG.m5 || "Discovery complete. Found the dedicated MedCare Health knowledge base — 40+ published articles across appointments, prescriptions, and coverage — plus defined usecase topics and 10 patient-support automation flows anchoring the four intents. Now writing the blueprint.";
  var M6A = MSG.m6a || 'Blueprint written to ';
  var M6B = MSG.m6b || ' It covers all required sections and closes with open questions and assumptions.';

  // Timeline constants, ported verbatim from the source's condAnim(). tDone/tFadeOut/loopAt
  // are the V2 additions: hold the finished state 5s, fade out, restart the loop.
  var TL = (function () {
    var CPS = 8, CPS2 = 10;
    var t1 = 200, e1 = t1 + M1.length * CPS;
    var t2 = e1 + 320, e2 = t2 + M2.length * CPS;
    var t3 = e2 + 480, e3 = t3 + AS.length * CPS2;
    var tLabel = e3 + 220, tRows = tLabel + 200, tPill = tRows + 5 * 200 + 200;
    var tP2 = tPill + 1600, tSum = tP2 + 260, t4 = tSum + 380, e4 = t4 + M3.length * CPS;
    var tLabel2 = e4 + 220, tRows2 = tLabel2 + 200, tPill2 = tRows2 + 2 * 200 + 200;
    var tP3 = tPill2 + 1800, t5 = tP3 + 480, e5 = t5 + M4.length * CPS;
    var tP4 = e5 + 1200, tCard = tP4 + 300, tLabel3 = tP4 + 700, tRows3 = tLabel3 + 200;
    var tPill4 = tP4 + 400;
    var tP5 = tRows3 + 3 * 200 + 900, tSum2 = tP5 + 260, t6 = tSum2 + 380, e6 = t6 + M5.length * CPS;
    var tPill5 = e6 + 200;
    var tP6 = e6 + 700, tLabel4 = tP6 + 200, tRows4 = tLabel4 + 200;
    var tP7 = tRows4 + 2 * 200 + 1500, t7 = tP7 + 420, e7 = t7 + (M6A.length + M6B.length) * CPS;
    var tPill7 = tP7 + 300, tFindings = e7 + 300;
    var tP8 = tFindings + 1400, tCard2 = tP8 + 250, tBlue = tP8 + 600, tPill8 = tP8 + 900;
    var tDone = tPill8 + 400, tFadeOut = tDone + 5000;
    return {
      t1: t1, t2: t2, t3: t3, t4: t4, t5: t5, t6: t6, t7: t7,
      tLabel: tLabel, tRows: tRows, tPill: tPill, tP2: tP2, tSum: tSum,
      tLabel2: tLabel2, tRows2: tRows2, tPill2: tPill2, tP3: tP3,
      tP4: tP4, tCard: tCard, tLabel3: tLabel3, tRows3: tRows3, tPill4: tPill4,
      tP5: tP5, tSum2: tSum2, tPill5: tPill5,
      tP6: tP6, tLabel4: tLabel4, tRows4: tRows4, tP7: tP7, tPill7: tPill7,
      tFindings: tFindings, tP8: tP8, tCard2: tCard2, tBlue: tBlue, tPill8: tPill8,
      tDone: tDone, tFadeOut: tFadeOut, loopAt: tFadeOut + 900
    };
  })();

  function boot(root) {
    if (root.__aiaConductor) root.__aiaConductor.destroy();
    root.__aiaConductor = new Conductor(root);
  }

  function Conductor(root) {
    this.root = root;
    this.reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.mobile = false;
    this.phrIdx = 0;
    this.maxLeft = 0;
    this.ms = 0;
    this.contentRaf = 0;
    this.scrollRaf = 0;
    this.skipUntil = 0;
    this.visible = true;
    this._destroyed = false;
    this.cache();
    this.injectCompleteChip();
    if (this.reduced) {
      this.renderReduced();
    } else {
      this.bind();
      this.tickScroll();
      this.updatePhrase();
      var self = this;
      if (window.IntersectionObserver && this.pin) {
        this.io = new IntersectionObserver(function (es) { self.visible = es[0].isIntersecting; }, { rootMargin: '200px' });
        this.io.observe(this.pin);
      }
      setTimeout(function () { self.updatePhrase(); }, 300);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { self.updatePhrase(); });
      this.phrTimer = setInterval(function () {
        if (self.visible === false) return;
        self.phrIdx += 1;
        requestAnimationFrame(function () { self.updatePhrase(); });
      }, 2800);
    }
  }

  Conductor.prototype.cache = function () {
    var r = this.root;
    var q = function (sel) { return r.querySelector(sel); };
    this.pin = q('[data-aia-conductor-pin]');
    this.frame = q('[data-aia-conductor-frame]');
    this.sm = q('[data-aia-conductor-sm]');
    this.mbsm = q('[data-aia-conductor-mbsm]');
    this.lg = q('[data-aia-conductor-lg]');
    this.shell = q('[data-aia-conductor-shell]');
    this.nav = q('[data-aia-conductor-nav]');
    this.pad = q('[data-aia-conductor-pad]');
    this.left = q('[data-aia-conductor-left]');
    this.bubble = q('[data-aia-conductor-bubble]');
    this.pill = q('[data-aia-conductor-pill]');
    this.pillText = q('[data-aia-conductor-pilltext]');
    this.cursorFill = q('[data-aia-conductor-cursor-fill]');
    this.chip = q('[data-aia-conductor-chip]');
    this.phraseWraps = Array.prototype.slice.call(r.querySelectorAll('[data-aia-conductor-phrase-wrap]'));

    this.msg = {};
    ['1', '2', '3', '4', '5', '6a', '6b'].forEach(function (k) { this.msg[k] = q('[data-aia-conductor-msg="' + k + '"]'); }, this);
    this.assist = q('[data-aia-conductor-assist]');
    this.labels = {};
    ['1', '2', '3', '4'].forEach(function (k) { this.labels[k] = q('[data-aia-conductor-label="' + k + '"]'); }, this);
    this.summaries = {};
    ['1', '2'].forEach(function (k) { this.summaries[k] = q('[data-aia-conductor-summary="' + k + '"]'); }, this);
    this.phases = {};
    ['1', '2b'].forEach(function (k) { this.phases[k] = q('[data-aia-conductor-phase="' + k + '"]'); }, this);
    this.blocks = {};
    ['c', 'd', 'e', 'h', 'j', 'k', 'l'].forEach(function (k) { this.blocks[k] = q('[data-aia-conductor-block="' + k + '"]'); }, this);
    this.rows = [];
    for (var i = 0; i < 12; i++) this.rows.push(q('[data-aia-conductor-row="' + i + '"]'));
  };

  // V2: the green "Complete" chip lives only in the new source markup — inject it as the last
  // child of the left column (position after the decision card) so no embed edit is needed.
  Conductor.prototype.injectCompleteChip = function () {
    if (!this.left) return;
    this.complete = this.left.querySelector('[data-aia-conductor-complete]');
    if (this.complete) return;
    var d = document.createElement('div');
    d.setAttribute('data-aia-conductor-complete', '');
    d.style.cssText = 'display:flex;align-items:center;gap:6px;width:fit-content;box-sizing:border-box;'
      + 'border:1px solid #C7EBD6;border-radius:999px;background:#EFFBF4;overflow:hidden;'
      + 'transition:opacity 320ms cubic-bezier(.2,.7,.2,1),transform 420ms cubic-bezier(.2,.7,.2,1),margin-top 420ms cubic-bezier(.2,.7,.2,1);'
      + 'opacity:0;padding:0 11px;margin-top:0;transform:translateY(6px);';
    d.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;width:14px;height:14px;flex:none;border-radius:999px;background:#17B26A">'
      + '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 13 10 18 19 7"></polyline></svg></span>'
      + '<span style="font-family:\'Inter\',\'DM Sans\',sans-serif;font-size:10.5px;font-weight:600;letter-spacing:0.01em;color:#0F7C4C">' + (CONTENT.complete || 'Complete') + '</span>';
    this.left.appendChild(d);
    this.complete = d;
  };

  Conductor.prototype.bind = function () {
    var self = this;
    this._onScroll = function () {
      if (!self.scrollRaf) self.scrollRaf = requestAnimationFrame(function () { self.scrollRaf = 0; self.tickScroll(); });
    };
    this._onResizePhrase = function () { self.updatePhrase(); };
    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onScroll);
    window.addEventListener('resize', this._onResizePhrase);
  };

  Conductor.prototype.updatePhrase = function () {
    var i = this.phrIdx % 3;
    var all = this.root.querySelectorAll('[data-aia-conductor-phrase]');
    for (var n = 0; n < all.length; n++) {
      var el = all[n];
      var on = el.getAttribute('data-aia-conductor-phrase') === String(i);
      el.style.opacity = on ? '1' : '0';
      el.style.transform = on ? 'none' : 'translateY(-0.42em)';
    }
    this.phraseWraps.forEach(function (w) {
      var el = w.querySelector('[data-aia-conductor-phrase="' + i + '"]');
      if (!el) return;
      w.style.width = el.offsetWidth + 'px';
      w.style.height = el.offsetHeight + 'px';
    });
  };

  // Scroll-linked morph: a 996x487 rest card grows into a 1161x653 (390x640 on mobile)
  // populated product view while the section is pinned; ported 1:1 from the source's own math.
  Conductor.prototype.tickScroll = function () {
    var vh0 = window.innerHeight;
    var vwNow = document.documentElement.clientWidth;
    var mobile = vwNow < 760;
    this.mobile = mobile;
    var AR_SM = 996 / 487, BASE = 996;
    var MB_W = 390, MB_H = 640;
    var LG_W = mobile ? MB_W : 1161, LG_H = mobile ? MB_H : 653;
    var AR_LG = LG_W / LG_H;

    if (this._lytMobile !== mobile) {
      this._lytMobile = mobile;
      if (this.shell) {
        this.shell.style.width = LG_W + 'px';
        this.shell.style.height = LG_H + 'px';
        this.shell.style.padding = mobile ? '16px' : '10px';
        this.shell.style.borderRadius = mobile ? '18px' : '16px';
      }
      if (this.lg) this.lg.style.width = LG_W + 'px';
      if (this.pad) {
        this.pad.style.paddingLeft = mobile ? '12px' : '26px';
        this.pad.style.paddingRight = mobile ? '12px' : '26px';
      }
      if (this.nav) this.nav.style.display = mobile ? 'none' : 'flex';
      if (this.sm) this.sm.style.display = mobile ? 'none' : 'block';
      if (this.mbsm) this.mbsm.style.display = mobile ? 'block' : 'none';
    }

    var AR_R = mobile ? AR_LG : AR_SM;
    var restW = mobile
      ? Math.max(280, Math.min(vwNow - 20, (vh0 - 56) * AR_LG))
      : Math.min(BASE, Math.max(320, vwNow - 40));
    var restOffset = Math.max(0, (vh0 - restW / AR_R) / 2);
    this.pin.style.marginTop = (40 - restOffset) + 'px';

    var r = this.pin.getBoundingClientRect();
    var span = r.height - window.innerHeight;
    var p = span > 0 ? (-r.top) / span : 0;
    p = Math.max(0, Math.min(1, p));
    var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

    var start = mobile ? restW : Math.min(BASE, Math.max(320, vwNow - 40));
    var target = mobile ? restW : Math.max(start, vwNow - 320);
    var w = start + (target - start) * e;
    var h = (w / AR_R) + ((w / AR_LG) - (w / AR_R)) * e;
    this.frame.style.width = w + 'px';
    this.frame.style.maxWidth = 'none';
    this.frame.style.height = h + 'px';
    var centred = Math.max(0, (vh0 - h) / 2);
    this.frame.style.marginTop = (restOffset + (centred - restOffset) * e) + 'px';

    var ks = w / 996;
    this.sm.style.width = '996px';
    this.sm.style.height = '487px';
    this.sm.style.transform = 'scale(' + ks + ')';
    this.sm.style.top = ((h - 487 * ks) / 2) + 'px';

    this.lg.style.height = (w / AR_LG) + 'px';
    var k = w / LG_W;
    this.lg.style.top = ((h - LG_H * k) / 2) + 'px';

    var fadeMobile = Math.max(0, Math.min(1, (e - 0.16) / 0.40));
    var fadeDesktop = Math.max(0, Math.min(1, (e - 0.12) / 0.38));
    var fade = mobile ? fadeMobile : fadeDesktop;
    var outVal = mobile ? Math.max(0, Math.min(1, (e - 0.04) / 0.26)) : fade;
    this.lg.style.opacity = fade;
    this.lg.style.transform = mobile
      ? 'translateY(' + (12 * (1 - fade)).toFixed(2) + 'px) scale(' + k + ')'
      : 'scale(' + k + ')';
    this.sm.style.opacity = 1 - fade;
    if (this.mbsm && mobile) {
      this.mbsm.style.transform = 'translateY(' + (-10 * outVal).toFixed(2) + 'px) scale(' + k + ')';
      this.mbsm.style.top = ((h - LG_H * k) / 2) + 'px';
      this.mbsm.style.opacity = 1 - outVal;
    }

    // V2: start once; the demo loops on its own from here (no scroll re-arm).
    var threshold = mobile ? 0.46 : 0.3;
    if (e > threshold) this.startContentAnim();
  };

  // Scripted "agent builds the blueprint" playback, triggered once the morph opens, then
  // looping forever: run to tDone, hold 5s, fade out over 700ms, restart after 900ms.
  // The clock freezes while the section is off-screen or the frame loop stalls (tab hidden).
  Conductor.prototype.startContentAnim = function () {
    if (this.contentRaf) return;
    this.ms = 0;
    this.maxLeft = 0;
    this.skipUntil = 0;
    var self = this;
    var t0 = performance.now();
    var last = t0;
    var step = function (now) {
      if (self._destroyed) { self.contentRaf = 0; return; }
      var dt = now - last;
      last = now;
      if (!self.visible || dt > 250) {
        t0 += dt;
        self.contentRaf = requestAnimationFrame(step);
        return;
      }
      var ms = now - t0;
      if (ms > TL.loopAt) {
        t0 = now;
        self.skipUntil = now + 900;
        self.maxLeft = 0;
        ms = 0;
      }
      self.ms = ms;
      if (self.skipUntil && now < self.skipUntil) {
        // Restart window: keep maxLeft at 0 so the left column's reserved min-height
        // collapses instead of pinning the fresh typing at its previous full height.
        self.applyContent(ms);
      } else {
        var lh = self.left ? self.left.offsetHeight : 0;
        if (lh > self.maxLeft) self.maxLeft = lh;
        self.applyContent(ms);
      }
      self.contentRaf = requestAnimationFrame(step);
    };
    this.contentRaf = requestAnimationFrame(step);
  };

  Conductor.prototype.setCollapse = function (el, t, open, max) {
    if (!el) return;
    el.style.opacity = open ? '1' : '0';
    el.style.maxHeight = open ? max + 'px' : '0px';
  };
  Conductor.prototype.setLabel = function (el, t, at) {
    if (!el) return;
    el.style.opacity = Math.max(0, Math.min(1, (t - at) / 260));
  };
  Conductor.prototype.setSummary = function (el, t, at) {
    if (!el) return;
    if (t >= at) { el.style.opacity = Math.max(0, Math.min(1, (t - at) / 300)); el.style.maxHeight = '40px'; }
    else { el.style.opacity = '0'; el.style.maxHeight = '0px'; }
  };
  Conductor.prototype.setActionsCard = function (el, t, open, at, max) {
    if (!el) return;
    if (open) { el.style.opacity = Math.max(0, Math.min(1, (t - at) / 320)); el.style.maxHeight = max + 'px'; el.style.marginTop = '14px'; el.style.borderWidth = ''; }
    else { el.style.opacity = '0'; el.style.maxHeight = '0px'; el.style.marginTop = '0px'; el.style.borderWidth = '0'; }
  };
  Conductor.prototype.setDecisionCard = function (el, t, open, at) {
    if (!el) return;
    if (open) { el.style.opacity = Math.max(0, Math.min(1, (t - at) / 320)); el.style.maxHeight = '220px'; el.style.marginTop = '12px'; el.style.borderWidth = ''; }
    else { el.style.opacity = '0'; el.style.maxHeight = '0px'; el.style.marginTop = '0px'; el.style.borderWidth = '0'; }
  };

  // Content playback: every threshold/timing constant is ported verbatim from the source's
  // condAnim(); row/label/card text is static (baked into the markup) since only opacity,
  // max-height and the typewriter cut() text ever change frame to frame.
  Conductor.prototype.applyContent = function (t) {
    var CPS = 8, CPS2 = 10;

    var cut = function (txt, start, cps) { return txt.slice(0, Math.max(0, Math.min(txt.length, Math.floor((t - start) / cps)))); };
    var fade = function (at, dur) { return Math.max(0, Math.min(1, (t - at) / dur)); };
    var setText = function (el, val) { if (el) el.textContent = val; };

    setText(this.msg['1'], cut(M1, TL.t1, CPS));
    setText(this.msg['2'], cut(M2, TL.t2, CPS));
    setText(this.assist, cut(AS, TL.t3, CPS2));
    setText(this.msg['3'], cut(M3, TL.t4, CPS));
    setText(this.msg['4'], cut(M4, TL.t5, CPS));
    setText(this.msg['5'], cut(M5, TL.t6, CPS));
    setText(this.msg['6a'], cut(M6A, TL.t7, CPS));
    setText(this.msg['6b'], cut(M6B, TL.t7 + M6A.length * CPS + 120, CPS));
    if (this.chip) this.chip.style.opacity = fade(TL.t7 + M6A.length * CPS, 200);

    // V2: past tFadeOut the bubble and the whole left column fade out (700ms) before the
    // loop restarts. Transition durations swap so the fade-out is slower than the fade-in.
    var fading = t > TL.tFadeOut;
    if (this.bubble) {
      this.bubble.style.transition = 'opacity ' + (fading ? 700 : 260) + 'ms cubic-bezier(.2,.7,.2,1)';
      this.bubble.style.opacity = fading ? '0' : (t > 80 ? '1' : '0');
      this.bubble.style.maxWidth = (this.mobile ? 320 : 557) + 'px';
    }

    this.setCollapse(this.phases['1'], t, t < TL.tP2, 220);
    this.setSummary(this.summaries['1'], t, TL.tSum);
    this.setCollapse(this.blocks.c, t, t >= TL.t4 && t < TL.tP4, 260);
    this.setCollapse(this.phases['2b'], t, t >= TL.tLabel2 && t < TL.tP3, 200);
    this.setLabel(this.labels['1'], t, TL.tLabel);
    this.setLabel(this.labels['2'], t, TL.tLabel2);
    this.setLabel(this.labels['3'], t, TL.tLabel3);
    this.setLabel(this.labels['4'], t, TL.tLabel4);
    this.setActionsCard(this.blocks.d, t, t >= TL.tCard, TL.tCard, 90);
    this.setCollapse(this.blocks.e, t, t >= TL.tLabel3 && t < TL.tP5, 200);
    this.setSummary(this.summaries['2'], t, TL.tSum2);
    this.setCollapse(this.blocks.h, t, t >= TL.tLabel4 && t < TL.tP7, 160);
    this.setCollapse(this.blocks.j, t, t >= TL.tFindings, 220);
    this.setActionsCard(this.blocks.k, t, t >= TL.tCard2, TL.tCard2, 90);
    this.setDecisionCard(this.blocks.l, t, t >= TL.tBlue, TL.tBlue);

    if (this.left) {
      this.left.style.transition = 'min-height ' + (t < 900 ? 0 : 500) + 'ms cubic-bezier(.2,.7,.2,1),opacity ' + (fading ? 700 : 200) + 'ms cubic-bezier(.2,.7,.2,1)';
      this.left.style.opacity = fading ? '0' : '1';
      this.left.style.maxWidth = (this.mobile ? 350 : 494) + 'px';
      this.left.style.minHeight = (this.maxLeft || 0) + 'px';
    }

    if (this.complete) {
      var chipOn = t >= TL.tPill8 + 400;
      this.complete.style.opacity = String(fade(TL.tPill8 + 400, 320));
      this.complete.style.padding = chipOn ? '5px 11px 5px 9px' : '0 11px';
      this.complete.style.marginTop = chipOn ? '12px' : '0px';
      this.complete.style.transform = chipOn ? 'none' : 'translateY(6px)';
    }

    var rowStyle = function (el, at) {
      if (!el) return;
      var pr = fade(at, 320);
      el.style.opacity = pr;
      el.style.transform = 'translateY(' + (8 - 8 * pr).toFixed(2) + 'px)';
    };
    for (var i = 0; i < 5; i++) rowStyle(this.rows[i], TL.tRows + i * 200);
    for (var j = 0; j < 2; j++) rowStyle(this.rows[5 + j], TL.tRows2 + j * 200);
    for (var k2 = 0; k2 < 3; k2++) rowStyle(this.rows[7 + k2], TL.tRows3 + k2 * 200);
    for (var l = 0; l < 2; l++) rowStyle(this.rows[10 + l], TL.tRows4 + l * 200);

    var pillTextVal = STATUS.inspecting || 'Discovery — inspecting agent config', pillOn = t >= TL.tPill, pillBottom = 132, green = false;
    if (t >= TL.tPill8) { pillTextVal = STATUS.saved || 'Blueprint generated — saved to BLUEPRINT.md'; pillBottom = 150; green = true; }
    else if (t >= TL.tPill7) { pillTextVal = STATUS.grounding || 'Writing blueprint — grounding in KB & flows'; pillBottom = 190; }
    else if (t >= TL.tPill5) { pillTextVal = STATUS.structuring || 'Writing blueprint — structuring sections'; pillBottom = 190; }
    else if (t >= TL.tPill4) { pillTextVal = STATUS.searching || 'Discovery — searching KB, topics & automations'; pillBottom = 150; }
    else if (t >= TL.tP3 && t < TL.tP4) { pillOn = false; }
    else if (t >= TL.tPill2) { pillTextVal = STATUS.conversations || 'Discovery — analyzing past conversations'; pillBottom = 104; }
    if (t > TL.tFadeOut) pillOn = false;

    var mobilePillText = pillTextVal;
    if (t >= TL.tPill8) mobilePillText = STATUS_MOBILE.saved || 'Blueprint saved';
    else if (t >= TL.tPill7) mobilePillText = STATUS_MOBILE.grounding || 'Grounding in KB & flows';
    else if (t >= TL.tPill5) mobilePillText = STATUS_MOBILE.structuring || 'Structuring blueprint';
    else if (t >= TL.tPill4) mobilePillText = STATUS_MOBILE.searching || 'Searching KB & automations';
    else if (t >= TL.tPill2) mobilePillText = STATUS_MOBILE.conversations || 'Analyzing conversations';
    else mobilePillText = STATUS_MOBILE.inspecting || 'Inspecting agent config';
    setText(this.pillText, this.mobile ? mobilePillText : pillTextVal);
    if (this.cursorFill) this.cursorFill.setAttribute('fill', green ? '#17B26A' : '#205AE3');
    if (this.pill) {
      this.pill.style.transform = 'translate(' + (this.mobile ? (t >= TL.tPill2 ? 116 : 104) : (t >= TL.tPill4 ? 396 : (t >= TL.tPill2 ? 396 : 380))) + 'px,' + (-pillBottom) + 'px)';
      this.pill.style.background = green ? '#17B26A' : '#205AE3';
      this.pill.style.opacity = pillOn ? '1' : '0';
      this.pill.style.maxWidth = this.mobile ? '250px' : '';
      this.pill.style.lineHeight = this.mobile ? '135%' : '';
      this.pill.style.whiteSpace = this.mobile ? 'normal' : 'nowrap';
    }
  };

  // prefers-reduced-motion: skip the pin/scroll morph and the typing playback; paint the
  // finished state once, just after the Complete chip lands (pre-fade-out), fully visible.
  // (The CSS's reduced-motion block also lays the frame out in-flow, static.)
  Conductor.prototype.renderReduced = function () {
    this.mobile = window.innerWidth < 760;
    if (this.sm) this.sm.style.display = 'none';
    if (this.mbsm) this.mbsm.style.display = 'none';
    if (this.lg) { this.lg.style.opacity = '1'; this.lg.style.transform = 'none'; }
    if (this.nav) this.nav.style.display = this.mobile ? 'none' : 'flex';
    this.applyContent(TL.tDone + 400);
    if (this.left) this.left.style.minHeight = '';
    if (this.complete) this.complete.style.transition = 'none';
  };

  Conductor.prototype.destroy = function () {
    this._destroyed = true;
    if (this.scrollRaf) cancelAnimationFrame(this.scrollRaf);
    if (this.contentRaf) cancelAnimationFrame(this.contentRaf);
    if (this.phrTimer) clearInterval(this.phrTimer);
    if (this.io) this.io.disconnect();
    if (this._onScroll) { window.removeEventListener('scroll', this._onScroll); window.removeEventListener('resize', this._onScroll); }
    if (this._onResizePhrase) window.removeEventListener('resize', this._onResizePhrase);
  };

  function initAll() {
    var roots = document.querySelectorAll('[data-aia-conductor-root]');
    for (var i = 0; i < roots.length; i++) boot(roots[i]);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
