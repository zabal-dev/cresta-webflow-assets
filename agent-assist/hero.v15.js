/* ===========================================================================
   Agent Assist — hero behaviour
   Ported from Agent Assist.dc.html: the scroll morph, the live-call playback,
   the transcript typing, the cue-driven assist windows, the timeline scrubber,
   the toolbar panels and the light/dark toggle.

   No React, no framework. State reaches the DOM through one requestAnimation-
   Frame per change (DCLite, below); the logic writes styles straight onto
   elements it holds by reference, so there is no diffing pass.

   Serve next to hero.css, with the same immutable cache header. Load deferred.
   =========================================================================== */

/* ---------------------------------------------------------------------------
   DCLite — the 4 KB stand-in for the design runtime.

   The hero's logic never builds DOM; it writes styles and text onto elements it
   grabbed through refs. So all a runtime has to do is: keep state, re-run
   renderVals() on a single animation frame, and push the result at the markup.
   No virtual DOM, no diffing, no reconciliation — one rAF, direct writes.

   Markup contract, produced by the exporter:
     data-aa-ref="refUi"       → calls vals.refUi(el) each paint
     data-aa-if="showSearch"   → display:contents when truthy, else none
     data-aa-for="lines"       → repeats its <template> per item
     data-aa-click="openPanel" → delegated; calls vals.openPanel(event)
     data-aa-bind-value="x"    → el.value = vals.x
   --------------------------------------------------------------------------- */
(function (global) {
  'use strict';

  var EVENTS = ['click', 'pointerdown', 'change', 'input', 'wheel', 'touchstart', 'keydown'];

  function resolve(path, scope) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'zero') return 0;
    if (/^-?\d+(\.\d+)?$/.test(path)) return +path;
    var parts = path.split('.'), v = scope;
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return v;
  }

  function interpolate(html, scope) {
    return html.replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (_, p) {
      var v = resolve(p, scope);
      return v == null || v === false ? '' : String(v);
    });
  }

  /* Rows built from a <template> carry refs and handlers that only make sense
     against their own item — bind those directly instead of by name. */
  function bindScoped(node, scope) {
    var els = [node].concat([].slice.call(node.querySelectorAll('*')));
    els.forEach(function (el) {
      if (!el.getAttribute) return;
      var rf = el.getAttribute('data-aa-ref');
      if (rf) {
        var fn = resolve(rf, scope);
        if (typeof fn === 'function') fn(el);
      }
      EVENTS.forEach(function (ev) {
        var h = el.getAttribute('data-aa-' + ev);
        if (!h) return;
        var f = resolve(h, scope);
        if (typeof f === 'function') {
          el.__aaBound = true;
          el.addEventListener(ev, f);
        }
      });
      applyBinds(el, scope);
      var cond = el.getAttribute('data-aa-if');
      if (cond) el.style.display = resolve(cond, scope) ? 'contents' : 'none';
    });
  }

  /* data-aa-bind-<attr>="path" → that attribute (or .value) from the scope */
  function applyBinds(el, scope) {
    if (!el.attributes) return;
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if (a.name.indexOf('data-aa-bind-') !== 0) continue;
      var attr = a.name.slice(13);
      var v = resolve(a.value, scope);
      if (attr === 'value') {
        v = v == null ? '' : String(v);
        if (el.value !== v && document.activeElement !== el) el.value = v;
      } else if (v == null || v === false) {
        el.removeAttribute(attr);
      } else if (el.getAttribute(attr) !== String(v)) {
        el.setAttribute(attr, String(v));
      }
    }
  }

  function DCLite(root) {
    this.root = root;
    this.props = {};
    this.state = {};
    this.r = {};
    this._vals = {};
    this._frame = 0;
    this._mounted = false;
    this._lists = new WeakMap();
  }

  DCLite.prototype.setState = function (patch) {
    var next = typeof patch === 'function' ? patch(this.state) : patch;
    if (!next) return;
    for (var k in next) this.state[k] = next[k];
    this.schedulePaint();
  };

  DCLite.prototype.forceUpdate = function () {
    this.schedulePaint();
  };

  /* One paint per change, on the next frame. The setTimeout is a guard: a
     backgrounded or throttled tab can starve requestAnimationFrame, and state
     that never reaches the DOM shows up as a frozen hero when the tab returns.
     Whichever fires first wins; the other is a no-op. */
  DCLite.prototype.schedulePaint = function () {
    if (this._frame) return;
    var self = this, done = false;
    var run = function () {
      if (done) return;
      done = true;
      self._frame = 0;
      clearTimeout(self._timer);
      self.paint();
    };
    this._frame = requestAnimationFrame(run);
    this._timer = setTimeout(run, 32);
  };

  /* ---- the three markup passes ---------------------------------------- */

  DCLite.prototype._passRefs = function (vals) {
    var nodes = this.root.querySelectorAll('[data-aa-ref]');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].closest('[data-aa-for]')) continue;
      var fn = vals[nodes[i].getAttribute('data-aa-ref')];
      if (typeof fn === 'function') fn(nodes[i]);
    }
  };

  DCLite.prototype._passConditionals = function (vals) {
    var nodes = this.root.querySelectorAll('[data-aa-if]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.closest('[data-aa-for]')) continue;
      var on = !!resolve(el.getAttribute('data-aa-if'), vals);
      var want = on ? 'contents' : 'none';
      if (el.style.display !== want) el.style.display = want;
    }
  };

  DCLite.prototype._passLists = function (vals) {
    var hosts = this.root.querySelectorAll('[data-aa-for]');
    for (var h = 0; h < hosts.length; h++) {
      var host = hosts[h];
      var list = resolve(host.getAttribute('data-aa-for'), vals) || [];
      var as = host.getAttribute('data-aa-as') || 'item';
      var tpl = host.querySelector('template');
      if (!tpl) continue;

      var state = this._lists.get(host);
      if (!state) {
        state = { keys: [], nodes: [] };
        this._lists.set(host, state);
      }

      /* Rebuild only the rows whose data actually changed — the transcript
         retypes one line per tick, not the whole list. */
      for (var i = 0; i < list.length; i++) {
        var scope = {};
        scope[as] = list[i];
        scope.$index = i;
        var key = JSON.stringify(list[i]) + '|' + i;
        if (state.keys[i] === key) continue;

        var frag = document.createElement('div');
        frag.innerHTML = interpolate(tpl.innerHTML, scope);
        var fresh = frag.firstElementChild;
        if (!fresh) continue;

        if (state.nodes[i] && state.nodes[i].parentNode === host) {
          host.replaceChild(fresh, state.nodes[i]);
        } else {
          host.appendChild(fresh);
        }

        bindScoped(fresh, scope);
        state.keys[i] = key;
        state.nodes[i] = fresh;
      }

      /* drop any tail left over from a longer previous list */
      for (var j = list.length; j < state.nodes.length; j++) {
        if (state.nodes[j] && state.nodes[j].parentNode === host) {
          host.removeChild(state.nodes[j]);
        }
      }

      state.keys.length = state.nodes.length = list.length;
    }
  };

  DCLite.prototype._passBinds = function (vals) {
    var nodes = this.root.querySelectorAll(
      '[data-aa-bind-value],[data-aa-bind-style],[data-aa-bind-title]'
    );

    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].closest('[data-aa-for]')) continue;
      applyBinds(nodes[i], vals);
    }
  };

  DCLite.prototype.paint = function () {
    var vals = this.renderVals ? (this.renderVals() || {}) : {};
    this._vals = vals;

    /* set window.AA_DEBUG = true before this file loads to record every paint */
    if (window.AA_DEBUG) {
      (window.__aaPaints = window.__aaPaints || []).push({
        at: Math.round(performance.now()),
        lines: (vals.lines || []).length,
        showT: !!this.state.showTranscripts
      });
    }

    this._passLists(vals);
    this._passBinds(vals);
    this._passConditionals(vals);
    this._passRefs(vals);

    if (this._mounted && this.componentDidUpdate) {
      this.componentDidUpdate(this.props, this.state);
    }
  };

  /* ---- delegated events ------------------------------------------------ */

  DCLite.prototype._bindEvents = function () {
    var self = this;

    EVENTS.forEach(function (ev) {
      self.root.addEventListener(
        ev,
        function (e) {
          var el = e.target.closest
            ? e.target.closest('[data-aa-' + ev + ']')
            : null;

          if (!el || !self.root.contains(el) || el.__aaBound) return;

          var fn = self._vals[el.getAttribute('data-aa-' + ev)];
          if (typeof fn === 'function') fn(e);
        },
        ev === 'wheel' || ev === 'touchstart'
          ? { passive: false }
          : false
      );
    });
  };

  DCLite.prototype.mount = function () {
    this._bindEvents();
    this.paint();
    this._mounted = true;

    if (this.componentDidMount) {
      this.componentDidMount();
    }

    return this;
  };

  DCLite.prototype.unmount = function () {
    if (this._frame) cancelAnimationFrame(this._frame);

    if (this.componentWillUnmount) {
      this.componentWillUnmount();
    }
  };

  global.DCLite = DCLite;
})(window);


(function () {
  'use strict';

  /* ------------------------------------------------------------------ config
     window.AA_HERO_CONFIG (set in the Embed) → the prop values the hero logic
     reads. Anything the config omits falls back to the design file's default. */

  var DEFAULTS = {
    "earlyStart": 0.5,
    "scrollDistance": 0.5,
    "endAspect": 1,
    "startGap": 24,
    "startRadius": 20,
    "easingFeel": "smooth",
    "desktopChrome": true,
    "typingSpeed": 190,
    "customerZoom": 2,
    "customerFocalX": 63,
    "customerFocalY": 25,
    "agentZoom": 2,
    "agentFocalX": 33,
    "agentFocalY": 22,
    "sectionRhythm": 1,
    "labelBlur": "corner"
  };

  function buildProps() {
    var c = window.AA_HERO_CONFIG || {};
    var p = {};

    for (var k in DEFAULTS) {
      p[k] = DEFAULTS[k];
    }

    ['agent', 'customer'].forEach(function (who) {
      var v = c[who] || {};

      if (v.zoom != null) {
        p[who + 'Zoom'] = v.zoom;
      }

      if (v.focalX != null) {
        p[who + 'FocalX'] = v.focalX;
      }

      if (v.focalY != null) {
        p[who + 'FocalY'] = v.focalY;
      }
    });

    var mo = c.motion || {};

    [
      'scrollDistance',
      'typingSpeed',
      'easingFeel',
      'earlyStart',
      'endAspect'
    ].forEach(function (k) {
      if (mo[k] != null) {
        p[k] = mo[k];
      }
    });

    return p;
  }

  /* ------------------------------------------------------- video management
     Apply the config's poster, badge and names; stop both streams decoding
     while the hero is off screen; never fight the demo logic — only resume
     what we ourselves paused. */

  function manageVideos(root) {
    var c = window.AA_HERO_CONFIG || {};
    var vids = [].slice.call(root.querySelectorAll('[data-aa-video]'));

    vids.forEach(function (v) {
      var conf = c[v.getAttribute('data-aa-video')] || {};

      if (conf.poster) {
        v.poster = conf.poster;
      }

      v.muted = true;
      v.setAttribute('playsinline', '');
    });

    var badge = c.badge || {};

    Object.keys(badge).forEach(function (k) {
      var el = root.querySelector('[data-aa-badge="' + k + '"]');

      if (el) {
        el.textContent = badge[k];
      }
    });

    ['agent', 'customer'].forEach(function (who) {
      var name = (c[who] || {}).name;
      var el = root.querySelector('[data-aa-name="' + who + '"]');

      if (name && el) {
        el.textContent = name;
      }
    });

    if (!('IntersectionObserver' in window)) return;

    var parked = [];

    new IntersectionObserver(
      function (e) {
        if (!e[0].isIntersecting) {
          parked = vids.filter(function (v) {
            return !v.paused;
          });

          parked.forEach(function (v) {
            v.pause();
          });
        } else {
          parked.forEach(function (v) {
            var p = v.play();

            if (p && p.catch) {
              p.catch(function () {});
            }
          });

          parked = [];
        }
      },
      { rootMargin: '200px 0px' }
    ).observe(root);
  }


  /* =========================================================================
     Hero logic — carried over from the design file unchanged.
     ========================================================================= */

class Component extends DCLite {
  state = {
    openMenu: null,
    openFaq: 0,
    mobileNav: false,
    bg: 0,
    showTranscripts: false,
    showContext: true,
    lines: [],
    activeStory: 0,
    panel: null,
    ka: 0,
    gu: 0,
    wfa: 0,
    sum: 0,
    pick: null,
    done: {},
    tab: 'best',
    vote: 0,
    notesText: '',
    liveText: '',
    searchText:
      (window.AA_HERO_CONTENT &&
        window.AA_HERO_CONTENT.searchDefault) ||
      '',
    secOpen: true
  };

  r = {};
  pos = {
    cluster: { x: 0, y: 0 },
    t: { x: 0, y: 0 },
    c: { x: 0, y: 0 }
  };

  secs = 0;
  gen = 0;
  clockGen = 0;
  paused = false;

  cfg() {
    const p = this.props || {};

    return {
      dist: p.scrollDistance ?? 1.4,
      earlyStart: p.earlyStart ?? 0.6,
      endAspect: p.endAspect ?? 1,
      startGap: p.startGap ?? 24,
      startRadius: p.startRadius ?? 20,
      feel: p.easingFeel ?? 'cresta',
      rhythm: p.sectionRhythm ?? 1,
      zoomC: p.customerZoom ?? 2,
      zoomA: p.agentZoom ?? 2,
      focalCX: p.customerFocalX ?? 63,
      focalCY: p.customerFocalY ?? 25,
      focalAX: p.agentFocalX ?? 33,
      focalAY: p.agentFocalY ?? 22,
      wpm: (p.typingSpeed ?? 190) * 1.2,
      chrome: p.desktopChrome !== false
    };
  }

  componentDidMount() {
    this.ease = bezier(...BEZ.cresta);

    this.onScroll = () => {
      if (this.ticking) return;

      this.ticking = true;

      requestAnimationFrame(() => {
        this.ticking = false;

        // Below-hero fast path: once the runway's last pixel has left the
        // viewport the morph is fully exited and its writes are all at
        // start-state constants, so no frame work is needed.
        if (
          this._heroDocBottom === undefined &&
          this.r.track
        ) {
          const rect = this.r.track.getBoundingClientRect();

          if (rect.height > 0) {
            this._heroDocBottom = Math.round(
              rect.bottom + window.scrollY
            );
          }
        }

        const below =
          this._heroDocBottom !== undefined &&
          window.scrollY > this._heroDocBottom;

        if (below) {
          if (!this._offscreen) {
            this._offscreen = true;
          }

          return;
        }

        if (this._offscreen) {
          // Re-entry: one resync of everything that deferred while off-screen.
          this._offscreen = false;
          this._mValid = false;

          if (this._pendingSync) {
            this._pendingSync = false;
            this.applyWidget();
          }

          if (
            this._autoPaused &&
            this.demoRunning &&
            !this.paused
          ) {
            this._autoPaused = false;
            this.tStart = performance.now();
            this.offsetMs = this.pausedElapsedMs;
            this.startTickLoop();
          }
        }

        this.layout();
        this.paintPowers();
      });
    };

    window.addEventListener(
      'scroll',
      this.onScroll,
      { passive: true }
    );

    this.onResize = () => {
      this._mValid = false;
      this._heroDocBottom = undefined;
      this._natW = 0;
      this._secW = null;
      this._tlx = null;

      // Card width is viewport-derived, so the loop's set width must be
      // remeasured or the wrap thresholds drift and the rail stops looping.
      this.indSetW = null;

      this.layout();

      if (!this.demoRunning) {
        this.paintTimeline(this.secs || 0);
      }

      this.onIndScroll();
    };

    window.addEventListener(
      'resize',
      this.onResize
    );

    this.onKeydown = (e) => {
      if (
        e.code !== 'Space' &&
        e.key !== ' '
      ) {
        return;
      }

      const tag =
        e.target &&
        e.target.tagName;

      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target && e.target.isContentEditable)
      ) {
        return;
      }

      e.preventDefault();
      this.togglePause();
    };

    window.addEventListener(
      'keydown',
      this.onKeydown
    );

    // Windows animate their height open (max-height keyframes); one
    // measurement at state-change time reads a mid-animation size,
    // so re-fit whenever it changes.
    if (
      window.ResizeObserver &&
      this.r.uiCard
    ) {
      this._ro = new ResizeObserver(() => {
        this._mValid = false;

        if (this._offscreen) {
          this._pendingSync = true;
          return;
        }

        this.applyWidget();
      });

      this._ro.observe(this.r.uiCard);
    }

    this.initSizeMorph();

    if (
      document.fonts &&
      document.fonts.ready
    ) {
      document.fonts.ready.then(() => {
        this._mValid = false;
        this._natW = 0;
        this._natFix = null;
        this.layout();
      });
    }

    const logo =
      this.r.headerRow &&
      this.r.headerRow.querySelector('img');

    if (
      logo &&
      !logo.complete
    ) {
      logo.addEventListener(
        'load',
        () => {
          this._mValid = false;
          this._natW = 0;
          this._natFix = null;
          this.layout();
        },
        { once: true }
      );
    }

    if (
      this.r.ui &&
      window.IntersectionObserver
    ) {
      this.io = new IntersectionObserver(
        entries => {
          this.inView = entries.some(
            en => en.isIntersecting
          );

          this.maybeStartDemo();
        },
        { threshold: 0.2 }
      );

      this.io.observe(this.r.ui);
    }

    // The opening exchange sits in the Transcripts window from the very first
    // paint, before any scroll starts the clock.
    this.setState({
      showTranscripts: true,
      lines: this.computeAt(0).lines
    });

    POWERS.forEach((p, i) => {
      const v = this.r['pvid' + i];

      if (p.src && v) {
        v.src = p.src;
        v.muted = true;
        v.style.opacity = '1';
        v.play().catch(() => {});
      }
    });

    this.restoreFeatureVideos();

    this.tabRaf =
      requestAnimationFrame(this.tabTick);
          this.initIndLoop();
    this.onIndScroll();
    this.powerIdx = -1;
    this.paintPowers();

    // hero.v13.css is immutable-cached, so the .aa-s14 will-change drop rides
    // the Lane B CSS bump — but an inline style overrides the stylesheet now.
    // WebKit recomposites the will-change layer on every geometry write of
    // the morph; Chrome keeps the stylesheet hint (zero Chrome behavior change).
    if (
      this.r.stage &&
      /AppleWebKit/.test(navigator.userAgent) &&
      !/Chrome|Chromium|Edg\//.test(navigator.userAgent)
    ) {
      this.r.stage.style.willChange = 'auto';
    }

    this.layout();

    // Park the playhead at section 0 before playback so the unscrolled state
    // shows a correctly aligned ruler with Global Context lit.
    this.paintTimeline(0);

    setTimeout(() => {
      this._mValid = false;
      this.layout();
      this._curSec = null;
      this.paintTimeline(this.secs || 0);
    }, 60);

    const kickPlay = v => {
      if (v) {
        v.muted = true;
        const q = v.play();

        if (q && q.catch) {
          q.catch(() => {});
        }
      }
    };

    // Amal's clip leads and Ben's is held back a beat, so the footage reads as
    // the customer opening the call and the agent answering.
    kickPlay(this.r.vidC);

    if (this.r.vidA) {
      this.r.vidA.pause();
      this.r.vidA.currentTime = 0;
    }

    setTimeout(
      () => kickPlay(this.r.vidA),
      2600
    );

    // src is assigned here rather than in a template hole: the sc-for placeholder
    // pass would otherwise request the literal "{{ f.src }}" string as a URL.
    FEATURES2.forEach((f, i) => {
      const v = this.r['featVid' + i];

      if (v && !v.getAttribute('src')) {
        v.setAttribute('src', f.src);
      }

      kickPlay(v);
    });
  }

  faqToggle(i) {
    this._faqT = this._faqT || [];

    if (!this._faqT[i]) {
      this._faqT[i] = () =>
        this.setState(s => ({
          openFaq:
            s.openFaq === i
              ? -1
              : i
        }));
    }

    return this._faqT[i];
  }

  componentDidUpdate() {
    // Defer while the hero is off-screen: a state change nobody can see does
    // not need a relayout. The scroll handler runs one resync on re-entry.
    if (this._offscreen) {
      this._pendingSync = true;
      return;
    }

    this._mValid = false;
    this._curSec = null;
    this.layout();

    if (!this.demoRunning) {
      this.paintTimeline(this.secs || 0);
    }

    this.pinTranscript();
  }

  // Re-pin after layout AND after paint: a new line's final height (or a shrunk
  // max-height while the AI Summary grows) is only known on the next frame.
  pinTranscript = () => {
    const sc = this.r.scroll;

    if (!sc) return;

    const pin = () => {
      const el = this.r.scroll;

      if (!el) return;

      el.scrollTop = 1e7;
    };

    pin();

    cancelAnimationFrame(this._pinRaf);

    this._pinRaf =
      requestAnimationFrame(pin);
  };

  componentWillUnmount() {
    window.removeEventListener(
      'scroll',
      this.onScroll
    );

    window.removeEventListener(
      'resize',
      this.onResize
    );

    window.removeEventListener(
      'keydown',
      this.onKeydown
    );

    if (this._ro) {
      this._ro.disconnect();
    }

    if (this._sizeRO) {
      this._sizeRO.disconnect();
    }

    if (this._sizeRaf) {
      cancelAnimationFrame(this._sizeRaf);
    }

    window.removeEventListener(
      'pointermove',
      this.onDragMove
    );

    window.removeEventListener(
      'pointerup',
      this.onDragEnd
    );

    window.removeEventListener(
      'pointermove',
      this.tlDragMove
    );

    window.removeEventListener(
      'pointerup',
      this.tlDragEnd
    );

    if (this.io) {
      this.io.disconnect();
    }

    clearInterval(this.clockId);

    this.stopDemo();

    if (this.tabRaf) {
      cancelAnimationFrame(this.tabRaf);
    }
  }


  // =========================================================================
  // Below-fold: feature videos
  // =========================================================================

  vdb() {
    if (this._vdb) {
      return this._vdb;
    }

    this._vdb = new Promise((res, rej) => {
      const req =
        indexedDB.open(
          'aa-landing-videos',
          1
        );

      req.onupgradeneeded = () => {
        if (
          !req.result.objectStoreNames.contains('v')
        ) {
          req.result.createObjectStore('v');
        }
      };

      req.onsuccess = () =>
        res(req.result);

      req.onerror = () =>
        rej(req.error);
    });

    return this._vdb;
  }

  async saveVideoBlob(key, blob) {
    try {
      const db = await this.vdb();

      db
        .transaction('v', 'readwrite')
        .objectStore('v')
        .put(blob, key);
    } catch (e) {}
  }

  async restoreFeatureVideos() {
    try {
      const db = await this.vdb();
      const slots = [];

      for (
        let i = 0;
        i < FEATURES2.length;
        i++
      ) {
        slots.push([
          'feature-' + i,
          'featVid' + i
        ]);
      }

      for (
        let i = 0;
        i < POWERS.length;
        i++
      ) {
        // A shipped default wins over anything stored from an earlier drop.
        if (POWERS[i].src) {
          try {
            db
              .transaction('v', 'readwrite')
              .objectStore('v')
              .delete('power-' + i);
          } catch (e) {}

          continue;
        }

        slots.push([
          'power-' + i,
          'pvid' + i
        ]);
      }

      slots.forEach(([key, ref]) => {
        const req =
          db
            .transaction('v', 'readonly')
            .objectStore('v')
            .get(key);

        req.onsuccess = () => {
          if (req.result) {
            this.showVideoBlob(
              ref,
              req.result
            );
          }
        };
      });
    } catch (e) {}
  }

  showVideoBlob(ref, blob) {
    const v = this.r[ref];

    if (!v) return;

    v.src =
      URL.createObjectURL(blob);

    v.muted = true;
    v.style.opacity = '1';

    v.play().catch(() => {});
  }

  loadFeatureVideo(key, ref, file) {
    this.showVideoBlob(ref, file);
    this.saveVideoBlob(key, file);
  }

  pickVideo(key, ref) {
    const inp =
      document.createElement('input');

    inp.type = 'file';
    inp.accept = 'video/*';

    inp.onchange = () => {
      if (
        inp.files &&
        inp.files[0]
      ) {
        this.loadFeatureVideo(
          key,
          ref,
          inp.files[0]
        );
      }
    };

    inp.click();
  }

  dropVideo(key, ref, e) {
    e.preventDefault();

    const f =
      e.dataTransfer &&
      e.dataTransfer.files &&
      e.dataTransfer.files[0];

    if (f) {
      this.loadFeatureVideo(
        key,
        ref,
        f
      );
    }
  }


  // =========================================================================
  // Below-fold: pinned "superpowers" sequence
  // =========================================================================

  paintPowers = () => {
    const track = this.r.powerTrack;

    if (!track) return;

    const n = POWERS.length;
    const pin = this.r.powerPin;
    const grid = this.r.powerGrid;

    if (!pin) return;

    const vh = window.innerHeight;

    // Park the video + copy row in the middle of the viewport.
    const gridH =
      grid
        ? grid.offsetHeight
        : 558;

    const headH =
      Math.max(
        0,
        pin.offsetHeight - gridH
      );

    const navH = 80;

    const centred =
      Math.round(
        (vh - navH - gridH) / 2
      ) +
      navH -
      headH;

    const off =
      Math.max(
        navH - headH,
        centred
      );

    if (off !== this._powerTop) {
      this._powerTop = off;
      pin.style.top = off + 'px';
    }

    const h = pin.offsetHeight;

    const want =
      Math.round(
        h +
        n * vh * 0.8
      );

    if (
      !this._powerH ||
      Math.abs(
        want - this._powerH
      ) > 8
    ) {
      this._powerH = want;
      track.style.height =
        want + 'px';
    }

    const rect =
      track.getBoundingClientRect();

    const travel =
      Math.max(
        1,
        track.offsetHeight - h
      );

    const p =
      clamp(
        (off - rect.top) / travel,
        0,
        0.999
      );

    const idx =
      Math.min(
        n - 1,
        Math.floor(p * n)
      );

    this.powerIdx = idx;
    this._powerTravel = travel;

    const local =
      clamp(
        p * n - idx,
        0,
        1
      );

    for (
      let i = 0;
      i < n;
      i++
    ) {
      const c = this.r['pcopy' + i];
      const v = this.r['pvis' + i];
      const d = this.r['pdot' + i];
      const f = this.r['pfill' + i];

      const on = i === idx;

      if (c) {
        c.style.opacity =
          on ? '1' : '0';

        c.style.transform =
          on
            ? 'translateY(0)'
            : 'translateY(18px)';

        c.style.pointerEvents =
          on ? 'auto' : 'none';
      }

      if (v) {
        v.style.opacity =
          on ? '1' : '0';

        v.style.transform =
          on
            ? 'scale(1)'
            : 'scale(1.02)';
      }

      if (d) {
        d.style.width =
          on ? '44px' : '10px';

        d.style.background =
          on
            ? '#DEE5EB'
            : (
                i < idx
                  ? '#205AE3'
                  : '#DEE5EB'
              );
      }

      if (f) {
        f.style.width =
          on
            ? Math.max(
                10,
                local * 100
              ) + '%'
            : (
                i < idx
                  ? '100%'
                  : '0%'
              );
      }
    }
  };

  jumpPower(i) {
    const track = this.r.powerTrack;

    if (!track) return;

    const beat =
      (
        this._powerTravel ||
        track.offsetHeight
      ) /
      POWERS.length;

    const top =
      window.scrollY +
      track.getBoundingClientRect().top -
      (this._powerTop || 0);

    window.scrollTo({
      top:
        Math.round(
          top +
          (i + 0.12) * beat
        ),
      behavior: 'smooth'
    });
  }


  // =========================================================================
  // Below-fold: industries rail
  // =========================================================================

  initIndLoop() {
    const rail = this.r.indRail;

    if (
      !rail ||
      rail.dataset.looped
    ) {
      return;
    }

    rail.dataset.looped = '1';

    const originals =
      Array.from(rail.children);

    for (
      let n = 0;
      n < 2;
      n++
    ) {
      originals.forEach(c =>
        rail.appendChild(
          c.cloneNode(true)
        )
      );
    }

    requestAnimationFrame(() => {
      this.indSetW =
        rail.scrollWidth / 3;

      rail.scrollLeft =
        this.indSetW;

      this.onIndScroll();
    });
  }

  onIndScroll = () => {
    const rail = this.r.indRail;
    const thumb = this.r.indThumb;
    const tl = this.r.indTrackL;
    const tr = this.r.indTrackR;

    if (!rail || !thumb) return;

    if (rail.dataset.looped) {
      this.indSetW =
        rail.scrollWidth / 3;
    }

    const set = this.indSetW;

    if (
      set &&
      !this.indAnim
    ) {
      if (
        rail.scrollLeft <
        set * 0.5
      ) {
        rail.scrollLeft += set;
      } else if (
        rail.scrollLeft >
        set * 1.5
      ) {
        rail.scrollLeft -= set;
      }
    }

    const span =
      set ||
      Math.max(
        1,
        rail.scrollWidth -
        rail.clientWidth
      );

    const p =
      clamp(
        (
          (
            rail.scrollLeft %
            span
          ) +
          span
        ) %
          span /
          span,
        0,
        1
      );

    // Three segments: grey run-up, blue thumb, grey run-out.
    const w =
      (90 / 540) * 100;

    const GAP = 2;

    const left =
      p * (100 - w);

    thumb.style.width =
      w + '%';

    thumb.style.left =
      left + '%';

    if (tl) {
      tl.style.width =
        Math.max(
          0,
          left - GAP
        ) + '%';
    }

    if (tr) {
      tr.style.width =
        Math.max(
          0,
          100 -
            left -
            w -
            GAP
        ) + '%';
    }
  };

  indStep(dir) {
    const rail = this.r.indRail;

    if (!rail) return;

    const card =
      rail.querySelector(
        '[data-r="industry-card"]'
      );

    const gap =
      parseFloat(
        getComputedStyle(rail)
          .columnGap ||
        getComputedStyle(rail).gap
      ) || 24;

    const step =
      (card ? card.offsetWidth : 360) +
      gap;

    this.indAnim = true;

    rail.scrollBy({
      left: dir * step,
      behavior: 'smooth'
    });

    clearTimeout(this._indAnimT);

    this._indAnimT =
      setTimeout(() => {
        this.indAnim = false;
        this.onIndScroll();
      }, 520);
  }

  indPrev = () => {
    this.indStep(-1);
  };

  indNext = () => {
    this.indStep(1);
  };


  // =========================================================================
  // Hero geometry helpers
  // =========================================================================

  mz() {
    const r = this.r;

    if (
      this._mValid &&
      this._m
    ) {
      return this._m;
    }

    const m =
      this._m || {};

    m.trackTop =
      r.track
        ? r.track.getBoundingClientRect().top
        : 0;

    m.scCH =
      r.scroll
        ? r.scroll.clientHeight
        : 0;

    this._m = m;
    this._mValid = true;

    return m;
  }

  // Quantized last-value write gate.
  qw(el, prop, val) {
    if (!el) return;

    const q =
      el.__qw ||
      (el.__qw = {});

    if (q[prop] === val) {
      return;
    }

    q[prop] = val;
    el.style[prop] = val;
  }

  layout() {
    const r = this.r;

    if (
      !r.track ||
      !r.sticky ||
      !r.stage ||
      !r.left
    ) {
      return;
    }

    const m = this.mz();
    const c = this.cfg();

    const bez = BEZ[c.feel];

    const ease =
      bez
        ? bezier(...bez)
        : (x => x);

    const W = window.innerWidth;
    const H = window.innerHeight;

    const mobile = W < 860;

    const headerH =
      (
        window.AA_HERO_CONFIG &&
        window.AA_HERO_CONFIG.headerHeight != null
      )
        ? window.AA_HERO_CONFIG.headerHeight
        : 80;

    if (
      mobile &&
      (
        this.pos.cluster.x ||
        this.pos.cluster.y ||
        this.pos.t.x ||
        this.pos.t.y ||
        this.pos.c.x ||
        this.pos.c.y
      )
    ) {
      this.pos = {
        cluster: { x: 0, y: 0 },
        t: { x: 0, y: 0 },
        c: { x: 0, y: 0 }
      };
    }

    if (
      W >= 1100 &&
      this.state.mobileNav
    ) {
      this.setState({
        mobileNav: false
      });
    }

    const availH =
      Math.max(
        360,
        H - headerH
      );

    const margin =
      mobile
        ? 22
        : clamp(
            W * 0.056,
            28,
            96
          );

    const contentW =
      Math.min(
        1760,
        W
      );

    const startW =
      contentW -
      margin * 2;

    const startLeft =
      (W - contentW) / 2 +
      margin;

    const bottomPad = 24;

    const startH =
      Math.max(
        240,
        availH -
          14 -
          bottomPad
      );

    const animDist =
      availH *
      c.dist *
      (mobile ? 0.55 : 1);

    const hold =
      availH *
      (mobile ? 0.16 : 0.3);

    const lead =
      Math.min(
        availH * c.earlyStart,
        animDist * 0.7
      );

    const trackH =
      (
        availH +
        Math.max(
          0,
          animDist - lead
        ) +
        hold +
        animDist
      ) + 'px';

    if (
      this._trackH !== trackH
    ) {
      this._trackH = trackH;
      r.track.style.height = trackH;
      this._heroDocBottom = undefined;
    }

    const stickyT =
      headerH + 'px';

    const stickyH =
      availH + 'px';

    if (
      this._stickyT !== stickyT
    ) {
      this._stickyT = stickyT;
      r.sticky.style.top = stickyT;
    }

    if (
      this._stickyH !== stickyH
    ) {
      this._stickyH = stickyH;
      r.sticky.style.height = stickyH;
    }

    const scrolled =
      lead - m.trackTop;

    let p;

    if (
      scrolled <= animDist
    ) {
      p =
        ease(
          clamp(
            scrolled / animDist,
            0,
            1
          )
        );
    } else if (
      scrolled <=
      animDist + hold
    ) {
      p = 1;
    } else {
      const t2 =
        clamp(
          (
            scrolled -
            animDist -
            hold
          ) /
            animDist,
          0,
          1
        );

      p =
        ease(
          1 - t2
        );
    }

    this.morphP = p;

    const gapEnd =
      mobile ? 2 : 2;

    const gap =
      lerp(
        c.startGap,
        gapEnd,
        p
      );

    const w =
      lerp(
        startW,
        W,
        p
      );

    const h =
      lerp(
        startH,
        availH,
        p
      );

    const rad =
      lerp(
        c.startRadius,
        0,
        p
      );

    const qW =
      Math.round(w / 4) * 4;

    const qH =
      Math.round(h / 4) * 4;

    const qL =
      Math.round(
        lerp(
          startLeft,
          0,
          p
        ) / 4
      ) * 4;

    const qRad =
      Math.round(rad);

    const qGap =
      Math.round(gap);

    const st = r.stage;

    this.qw(
      st,
      'width',
      qW + 'px'
    );

    this.qw(
      st,
      'height',
      qH + 'px'
    );

    this.qw(
      st,
      'left',
      qL + 'px'
    );

    this.qw(
      st,
      'top',
      '0px'
    );

    this.qw(
      st,
      'borderRadius',
      qRad + 'px'
    );

    this.qw(
      st,
      'gap',
      qGap + 'px'
    );

    this.qw(
      st,
      'flexDirection',
      mobile
        ? 'column'
        : 'row'
    );

    const lf = r.left;

    this.qw(
      lf,
      'gap',
      qGap + 'px'
    );

    if (mobile) {
      this.qw(
        lf,
        'flexDirection',
        'row'
      );

      this.qw(
        lf,
        'width',
        '100%'
      );

      this.qw(
        lf,
        'height',
        Math.round(
          lerp(
            startH * 0.38,
            (
              (W - gapEnd) / 2
            ) /
              c.endAspect,
            p
          ) / 4
        ) *
          4 +
          'px'
      );
    } else {
      this.qw(
        lf,
        'flexDirection',
        'column'
      );

      this.qw(
        lf,
        'height',
        ''
      );

      const startLeftWidth =
        startW * 0.476;

      const endLeft =
        (
          (availH - gapEnd) /
          2
        ) *
        c.endAspect;

      this.qw(
        lf,
        'width',
        Math.round(
          lerp(
            startLeftWidth,
            endLeft,
            p
          ) / 4
        ) *
          4 +
          'px'
      );
    }

    [
      r.faceA,
      r.faceB,
      r.ui
    ].forEach(el =>
      this.qw(
        el,
        'borderRadius',
        qRad + 'px'
      )
    );

    const wsig =
      qW +
      '|' +
      qH +
      '|' +
      qGap +
      '|' +
      (mobile ? 1 : 0);

    if (
      this._wsig !== wsig
    ) {
      this._wsig = wsig;
      this._mValid = false;
    }

    this.applyWidget();

    // Focal-anchored crop.
    const crop = (
      el,
      fx,
      fy,
      Z,
      tx,
      ty
    ) => {
      if (!el) return;

      Z = Math.max(1, Z);

      const s = el.style;

      s.width =
        (Z * 100) + '%';

      s.height =
        (Z * 100) + '%';

      s.objectPosition =
        (fx * 100).toFixed(1) +
        '% ' +
        (fy * 100).toFixed(1) +
        '%';

      s.left =
        clamp(
          (tx - fx * Z) * 100,
          (1 - Z) * 100,
          0
        ).toFixed(2) + '%';

      s.top =
        clamp(
          (ty - fy * Z) * 100,
          (1 - Z) * 100,
          0
        ).toFixed(2) + '%';
    };

    crop(
      r.vidC,
      c.focalCX / 100,
      c.focalCY / 100,
      c.zoomC,
      0.5,
      0.3
    );

    crop(
      r.vidA,
      c.focalAX / 100,
      c.focalAY / 100,
      c.zoomA,
      0.5,
      0.32
    );

    if (r.intro) {
      const o =
        clamp(
          window.scrollY /
            (availH * 0.62),
          0,
          1
        );

      this.qw(
        r.intro,
        'transform',
        'translate3d(0,' +
          (-Math.round(o * 190)) +
          'px,0)'
      );

      this.qw(
        r.intro,
        'opacity',
        clamp(
          1 - o * 1.2,
          0,
          1
        ).toFixed(2)
      );

      this.qw(
        r.intro,
        'pointerEvents',
        o > 0.9
          ? 'none'
          : 'auto'
      );
    }

    if (r.below) {
      r.below.style.setProperty(
        '--rhythm-t',
        Math.round(
          120 * c.rhythm
        ) + 'px'
      );

      r.below.style.setProperty(
        '--rhythm-b',
        Math.round(
          120 * c.rhythm
        ) + 'px'
      );
    }

    this.morphHeader(
      mobile,
      margin
    );

    this.applyBackground();
    this.maybeStartDemo();
  }

  naturalHeaderWidth(
    padL,
    padR,
    colGap
  ) {
    const row = this.r.headerRow;
    const shell = this.r.shell;

    if (
      !row ||
      !shell ||
      row.children.length < 3
    ) {
      return 0;
    }

    const imgs =
      row.querySelectorAll('img');

    for (const im of imgs) {
      if (
        !im.complete ||
        !im.naturalWidth
      ) {
        return 0;
      }
    }

    const prev = {
      w: shell.style.width,
      mw: shell.style.maxWidth,
      pl: row.style.paddingLeft,
      pr: row.style.paddingRight,
      g: row.style.gap
    };

    shell.style.maxWidth = 'none';
    shell.style.width = 'max-content';

    row.style.paddingLeft =
      padL + 'px';

    row.style.paddingRight =
      padR + 'px';

    row.style.gap =
      colGap + 'px';

    const width =
      row.scrollWidth;

    Object.assign(
      shell.style,
      {
        width: prev.w,
        maxWidth: prev.mw
      }
    );

    Object.assign(
      row.style,
      {
        paddingLeft: prev.pl,
        paddingRight: prev.pr,
        gap: prev.g
      }
    );

    return width > 200
      ? Math.ceil(width) + 2
      : 0;
  }

  morphHeader(mobile, gutter) {
    const r = this.r;

    if (
      !r.headerPad ||
      !r.shell ||
      !r.headerRow
    ) {
      return;
    }

    // The nav is a fixed white bar with a hairline rule — no scroll morph into
    // a floating pill. Keep the row geometry constant.
    r.headerPad.style.padding = '0';

    r.headerRow.style.paddingLeft =
      (mobile ? 22 : 80) +
      'px';

    r.headerRow.style.paddingRight =
      (mobile ? 22 : 80) +
      'px';

    return;
        const h = bezier(0.2, 0.7, 0.2, 1)(clamp(window.scrollY / 150, 0, 1));
    const rowH = lerp(72, mobile ? 62 : 58, h);
    const padY = lerp(0, mobile ? 8 : 12, h);
    const padX = lerp(0, mobile ? 10 : 18, h);
    r.headerPad.style.padding = padY + 'px ' + padX + 'px 0';

    const menuOpen = !!this.state.openMenu || this.state.mobileNav;
    const s = r.shell.style;
    const floatPad = mobile ? 16 : 22;

    // Filled pill needs less trailing room than the wordmark needs leading room.
    const floatPadR = 7;

    if (!this._natW) {
      this._natW = this.naturalHeaderWidth(floatPad, floatPadR, 36);
    }

    const target =
      mobile || !this._natW
        ? 1760
        : clamp(
            this._natW,
            0,
            Math.min(
              1440,
              window.innerWidth - padX * 2
            )
          );

    s.maxWidth =
      lerp(1760, target, h) + 'px';

    s.borderRadius =
      lerp(
        0,
        menuOpen ? 22 : rowH / 2,
        h
      ) + 'px';

    s.background =
      'rgba(255,255,255,' +
      lerp(
        0.55,
        menuOpen ? 0.9 : 0.6,
        h
      ).toFixed(3) +
      ')';

    s.borderBottomColor =
      'rgba(36,36,42,' +
      (0.07 * (1 - h)).toFixed(3) +
      ')';

    s.boxShadow =
      h < 0.01
        ? 'none'
        : 'inset 0 0 0 1px rgba(255,255,255,' +
          (0.55 * h).toFixed(3) +
          '), 0 ' +
          (h * 10).toFixed(1) +
          'px ' +
          (h * 30).toFixed(1) +
          'px rgba(36,36,42,' +
          (0.11 * h).toFixed(3) +
          ')';

    const rw = r.headerRow.style;

    rw.height =
      rowH + 'px';

    rw.gap =
      lerp(24, 36, h) + 'px';

    rw.paddingLeft =
      lerp(gutter, floatPad, h) + 'px';

    rw.paddingRight =
      lerp(gutter, floatPadR, h) + 'px';

    // Self-heal: if the pill is still narrower than its content, remeasure once.
    if (
      h > 0.5 &&
      r.headerRow.scrollWidth >
        r.headerRow.clientWidth + 1 &&
      this._natFix !== this._natW
    ) {
      this._natFix = this._natW;
      this._natW = 0;

      requestAnimationFrame(() =>
        this.morphHeader(
          mobile,
          gutter
        )
      );
    }
  }


  // =========================================================================
  // Smooth window resizing
  // =========================================================================

  // Every widget window is auto-height, so a content change (an answer landing,
  // a panel swapping in, the toolbar rewrapping) used to snap the box to its new
  // size in one frame. Each watched window remembers its last natural height per
  // slot; when that height changes the box is driven from the old value to the
  // new one over a single beat. The natural target is remeasured every frame, so
  // content that keeps growing mid-morph retargets instead of jumping at the end.

  initSizeMorph() {
    this._sizes = {};
    this._morphing = new Set();

    if (!window.ResizeObserver) {
      return;
    }

    this._sizeRO =
      new ResizeObserver(entries => {
        for (const e of entries) {
          this.startMorph(e.target);
        }
      });
  }

  watchSize(el, slot) {
    if (
      !el ||
      !this._sizeRO
    ) {
      return;
    }

    el.__slot = slot;

    // idempotent for a target this observer already watches
    this._sizeRO.observe(el);
  }

  startMorph(el) {
    const slot = el.__slot;

    if (
      !slot ||
      el.__morph ||
      !el.isConnected
    ) {
      return;
    }

    const h =
      el.offsetHeight;

    if (!h) return;

    const prev =
      this._sizes[slot];

    this._sizes[slot] = h;

    if (
      prev == null ||
      Math.abs(prev - h) < 2
    ) {
      return;
    }

    if (
      window.matchMedia &&
      window
        .matchMedia(
          '(prefers-reduced-motion: reduce)'
        )
        .matches
    ) {
      return;
    }

    el.__morph = {
      from: prev,
      t0: 0,
      ov: el.style.overflow
    };

    el.style.overflow = 'hidden';
    el.style.height = prev + 'px';

    this._morphing.add(el);

    if (!this._sizeRaf) {
      this._sizeRaf =
        requestAnimationFrame(
          this.tickSizeMorph
        );
    }
  }

  tickSizeMorph = ts => {
    const ease =
      bezier(
        0.2,
        0.7,
        0.2,
        1
      );

    for (
      const el of this._morphing
    ) {
      const m =
        el.__morph;

      if (
        !m ||
        !el.isConnected
      ) {
        this._morphing.delete(el);
        continue;
      }

      if (!m.t0) {
        m.t0 = ts;
      }

      // Measure natural height without losing the currently painted height.
      const oldH =
        el.style.height;

      el.style.height = 'auto';

      const target =
        el.offsetHeight;

      el.style.height = oldH;

      const p =
        clamp(
          (ts - m.t0) / 260,
          0,
          1
        );

      const v =
        lerp(
          m.from,
          target,
          ease(p)
        );

      el.style.height =
        Math.round(v) + 'px';

      if (p >= 1) {
        el.style.height = '';
        el.style.overflow = m.ov;
        el.__morph = null;

        this._sizes[el.__slot] =
          el.offsetHeight;

        this._morphing.delete(el);
      }
    }

    if (this._morphing.size) {
      this._sizeRaf =
        requestAnimationFrame(
          this.tickSizeMorph
        );
    } else {
      this._sizeRaf = 0;
    }
  };


  // =========================================================================
  // Dragging
  // =========================================================================

  startDrag(which, e) {
    if (
      e.button !== undefined &&
      e.button !== 0
    ) {
      return;
    }

    const p =
      which === 'cluster'
        ? this.pos.cluster
        : which === 't'
          ? this.pos.t
          : this.pos.c;

    this.drag = {
      which,
      x: e.clientX,
      y: e.clientY,
      ox: p.x,
      oy: p.y
    };

    window.addEventListener(
      'pointermove',
      this.onDragMove
    );

    window.addEventListener(
      'pointerup',
      this.onDragEnd
    );

    e.preventDefault();
  }

  onDragMove = e => {
    const d = this.drag;

    if (!d) return;

    const nx =
      d.ox +
      e.clientX -
      d.x;

    const ny =
      d.oy +
      e.clientY -
      d.y;

    if (d.which === 'cluster') {
      this.pos.cluster.x = nx;
      this.pos.cluster.y = ny;
    } else if (d.which === 't') {
      this.pos.t.x = nx;
      this.pos.t.y = ny;
    } else {
      this.pos.c.x = nx;
      this.pos.c.y = ny;
    }

    this.applyWidget();
  };

  onDragEnd = () => {
    this.drag = null;

    window.removeEventListener(
      'pointermove',
      this.onDragMove
    );

    window.removeEventListener(
      'pointerup',
      this.onDragEnd
    );
  };

  applyWidget() {
    const r = this.r;

    if (!r.ui) return;

    const W =
      window.innerWidth;

    const mobile =
      W < 860;

    const cluster =
      this.pos.cluster;

    const t =
      this.pos.t;

    const c =
      this.pos.c;

    const stack =
      r.stack;

    if (stack) {
      stack.style.transform =
        'translate3d(' +
        Math.round(cluster.x) +
        'px,' +
        Math.round(cluster.y) +
        'px,0)';
    }

    if (r.winT) {
      r.winT.style.transform =
        'translate3d(' +
        Math.round(t.x) +
        'px,' +
        Math.round(t.y) +
        'px,0)';
    }

    if (r.winC) {
      r.winC.style.transform =
        'translate3d(' +
        Math.round(c.x) +
        'px,' +
        Math.round(c.y) +
        'px,0)';
    }

    if (mobile) {
      if (stack) {
        stack.style.maxWidth =
          'calc(100% - 24px)';
      }
    } else if (stack) {
      stack.style.maxWidth = '';
    }
  }


  // =========================================================================
  // Scroll / resize lifecycle
  // =========================================================================

  onResize = () => {
    this._mValid = false;
    this._natW = 0;
    this._powerTop = null;
    this._powerH = null;

    cancelAnimationFrame(
      this._resizeRaf
    );

    this._resizeRaf =
      requestAnimationFrame(() => {
        this.layout();
        this.paintPowers();
        this.onIndScroll();

        this._curSec = null;
        this.paintTimeline(
          this.paused
            ? this.pausedElapsedMs / 1000
            : (
                this.demoRunning
                  ? this.tlPos
                  : this.secs || 0
              )
        );
      });
  };

  onScroll = () => {
    if (this._scrollRaf) {
      return;
    }

    this._scrollRaf =
      requestAnimationFrame(() => {
        this._scrollRaf = 0;

        this._mValid = false;

        this.layout();
        this.paintPowers();

        const track =
          this.r.track;

        if (!track) return;

        const rect =
          track.getBoundingClientRect();

        const off =
          rect.bottom < -120 ||
          rect.top >
            window.innerHeight + 120;

        if (
          off !== this._offscreen
        ) {
          this._offscreen = off;

          if (!off) {
            if (this._pendingSync) {
              this._pendingSync = false;
              this._mValid = false;
              this._curSec = null;
              this.layout();
            }

            if (
              this._autoPaused &&
              this.demoRunning &&
              !this.paused
            ) {
              this._autoPaused = false;
              this.tStart =
                performance.now();

              this.offsetMs =
                this.pausedElapsedMs;

              this.startTickLoop();
            }
          }
        }
      });
  };


  // =========================================================================
  // Demo start / playback
  // =========================================================================

  maybeStartDemo() {
    if (
      this.demoStarted ||
      !this.r.track
    ) {
      return;
    }

    const rect =
      this.r.track.getBoundingClientRect();

    const vh =
      window.innerHeight;

    if (
      rect.top <
        vh * 0.78 &&
      rect.bottom > 0
    ) {
      this.demoStarted = true;
      this.startDemo(0);
    }
  }

  startDemo(at) {
    this.stopDemo();

    const t =
      clamp(
        at || 0,
        0,
        TL_TOTAL
      );

    this.offsetMs =
      t * 1000;

    this.tStart =
      performance.now();

    this.secs =
      Math.floor(t);

    this.tlPos = t;
    this.demoRunning = true;
    this.paused = false;
    this._autoPaused = false;
    this._sig = null;
    this._cueSig = null;

    this.paintPauseBtn();
    this.paintTimer();
    this.paintTimeline(t);
    this.syncAt(t);
    this.startTickLoop();
  }


  // =========================================================================
  // Timeline / transcript state
  // =========================================================================

  computeAt(t) {
    const lines =
      SCRIPT.map((l, i) => {
        const T =
          LINE_T[i];

        let f = 0;

        if (t >= T.type) {
          f = 1;
        } else if (t > T.start) {
          f =
            clamp(
              (t - T.start) /
                (T.type - T.start),
              0,
              1
            );
        }

        return {
          ...l,
          shown:
            lineText(i, f),
          typing:
            f > 0 && f < 1
        };
      }).filter(
        l => l.shown
      );

    const cue = {
      showContext: false,
      ka: 0,
      gu: 0,
      pick: null,
      sum: 0,
      wfa: 0,
      done: {}
    };

    let kaT = null;
    let guT = null;
    let sumT = null;
    let wfaT = null;

    SCRIPT.forEach((l, i) => {
      const ct =
        CUE_T[i];

      if (
        ct == null ||
        t < ct
      ) {
        return;
      }

      if (l.ka) {
        kaT = ct;
        cue.ka = l.ka;
      }

      if (l.guide) {
        guT = ct;
        cue.gu = l.guide;
      }

      if (l.summary) {
        sumT = ct;
        cue.sum = l.summary;
      }

      if (l.wfa) {
        wfaT = ct;
        cue.wfa = l.wfa;
      }

      if (l.pick) {
        cue.pick = l.pick;
      }

      if (l.check) {
        cue.done[l.check] = true;
      }

      if (l.context) {
        cue.showContext = true;
      }
    });

    // Multi-stage UI cues continue progressing after their trigger.
    if (
      kaT !== null
    ) {
      const d = t - kaT;

      cue.ka =
        d < 1.2
          ? 1
          : d < 2.5
            ? 2
            : 3;
    }

    if (
      guT !== null
    ) {
      const d = t - guT;

      cue.gu =
        d < 0.6
          ? 1
          : 2;
    }

    if (
      sumT !== null
    ) {
      const d = t - sumT;

      cue.sum =
        d < 2
          ? 1
          : 2;
    }

    if (
      wfaT !== null
    ) {
      const d = t - wfaT;

      cue.wfa =
        d < 3
          ? 1
          : (
              d < 5.2
                ? 2
                : 3
            );
    }

    return {
      lines,
      cue
    };
  }

  syncAt(t) {
    const res =
      this.computeAt(t);

    const sig =
      res.lines
        .map(
          l =>
            l.shown.length +
            (
              l.typing
                ? 't'
                : 'd'
            )
        )
        .join('|');

    const cueSig =
      JSON.stringify(res.cue);

    if (
      sig === this._sig &&
      cueSig === this._cueSig
    ) {
      return;
    }

    const patch = {
      lines: res.lines
    };

    // Cue fields are only written when they actually change, so a toolbar panel
    // the visitor opened is not stomped on every typing frame.
    if (
      cueSig !== this._cueSig
    ) {
      Object.assign(
        patch,
        res.cue,
        { panel: null }
      );
    }

    this._sig = sig;
    this._cueSig = cueSig;

    this.setState(patch);
  }


  // =========================================================================
  // Main timeline clock
  // =========================================================================

  startTickLoop() {
    const gen =
      ++this.clockGen;

    const step = ts => {
      if (
        gen !== this.clockGen ||
        !this.demoRunning ||
        this.paused
      ) {
        return;
      }

      // Off-screen auto-pause.
      if (this._offscreen) {
        if (!this._autoPaused) {
          this._autoPaused = true;

          this.pausedElapsedMs =
            clamp(
              (
                performance.now() -
                this.tStart
              ) +
                this.offsetMs,
              0,
              TL_TOTAL * 1000
            );

          this.clockGen++;

          cancelAnimationFrame(
            this.rafId
          );
        }

        return;
      }

      const raw =
        Math.min(
          TL_TOTAL * 1000,
          (
            performance.now() -
            this.tStart
          ) +
            this.offsetMs
        );

      const el = raw;

      const s =
        Math.floor(
          raw / 1000
        );

      const atEnd =
        raw >=
        TL_TOTAL * 1000;

      if (s !== this.secs) {
        this.secs = s;
        this.paintTimer();
      }

      this.tlPos =
        el / 1000;

      this.paintTimeline(
        this.tlPos
      );

      this.syncAt(
        raw / 1000
      );

      if (atEnd) {
        this.demoRunning = false;
        return;
      }

      this.rafId =
        requestAnimationFrame(
          step
        );
    };

    this.rafId =
      requestAnimationFrame(
        step
      );
  }


  // =========================================================================
  // Timeline ruler
  // =========================================================================

  sizeTimeline() {
    const r = this.r;

    if (!r.tlWin) {
      return TL_PX_PER_SEC;
    }

    const win =
      this.mz().tlWinW;

    const w =
      Math.round(
        clamp(
          win / 5,
          152,
          230
        )
      );

    if (
      this._secW !== w
    ) {
      this._secW = w;
      this._tlx = null;

      SECTIONS.forEach(
        (_, i) => {
          const el =
            r['sec' + i];

          if (el) {
            el.style.width =
              w + 'px';
          }

          const le =
            r['lsec' + i];

          if (le) {
            le.style.width =
              w + 'px';
          }
        }
      );
    }

    return (
      w /
      SECTION_DUR
    );
  }

  paintTimeline(t) {
    const r = this.r;
    const pps = this.sizeTimeline();

    if (
      r.strip &&
      r.tlWin
    ) {
      const mid =
        t * pps;

      const x =
        Math.round(
          this.mz().tlWinW / 2 -
          mid
        );

      if (
        this._tlx !== x
      ) {
        this._tlx = x;

        r.strip.style.transform =
          'translate3d(' +
          x +
          'px,0,0)';

        const lo =
          (
            mid -
            LENS_HALF
          ).toFixed(2);

        const hi =
          (
            mid +
            LENS_HALF
          ).toFixed(2);

        const hole =
          'linear-gradient(90deg,#000 0,#000 ' +
          lo +
          'px,transparent ' +
          lo +
          'px,transparent ' +
          hi +
          'px,#000 ' +
          hi +
          'px,#000 9999px)';

        r.strip.style.maskImage =
          hole;

        r.strip.style.webkitMaskImage =
          hole;
      }

      if (r.lensCopy) {
        const st =
          r.lensCopy.style;

        if (!this._lensMasked) {
          this._lensMasked = true;

          const w =
            (
              2 *
              LENS_SRC_HALF
            ).toFixed(2);

          const m =
            'linear-gradient(90deg,transparent 0,#000 0,#000 ' +
            w +
            'px,transparent ' +
            w +
            'px)';

          st.maskImage =
            st.webkitMaskImage =
              m;

          st.maskSize =
            st.webkitMaskSize =
              w + 'px 100%';

          st.maskRepeat =
            st.webkitMaskRepeat =
              'no-repeat';
        }

        const lx =
          (
            PILL_INNER_HALF -
            mid * LENS_MAG
          ).toFixed(2);

        if (
          this._lensX !== lx
        ) {
          this._lensX = lx;

          st.transform =
            'translate3d(' +
            lx +
            'px,0,0) scale(' +
            LENS_MAG +
            ')';

          st.maskPosition =
            st.webkitMaskPosition =
              (
                mid -
                LENS_SRC_HALF
              ).toFixed(2) +
              'px 0';
        }
      }
    }

    const cur =
      clamp(
        Math.floor(
          t /
          SECTION_DUR
        ),
        0,
        SECTIONS.length - 1
      );

    if (
      this._curSec !== cur &&
      r[
        'sec' +
        (
          SECTIONS.length - 1
        )
      ]
    ) {
      this._curSec = cur;

      SECTIONS.forEach(
        (_, i) => {
          const el =
            r['sec' + i];

          if (!el) return;

          el.style.color =
            i === cur
              ? 'var(--gw-tl-strong,#FFFFFF)'
              : 'var(--gw-tl-label,#A9B2C0)';

          el.style.opacity =
            i === cur
              ? '1'
              : '0.62';
        }
      );
    }
  }


  // Clicking anywhere on the ruler plays from that exact spot.
  tlClickAt = e => {
    if (
      this._suppressTlClick
    ) {
      this._suppressTlClick = false;
      return;
    }

    const strip =
      this.r.strip;

    if (!strip) return;

    const pps =
      this.sizeTimeline();

    const t =
      clamp(
        (
          e.clientX -
          strip.getBoundingClientRect().left
        ) / pps,
        0,
        TL_TOTAL
      );

    this.seekToTime(t);
  };

  seekToTime = t => {
    const time =
      clamp(
        t,
        0,
        TL_TOTAL
      );

    this.gen++;
    this.clockGen++;

    clearTimeout(this.tid);
    clearTimeout(this._wfaTid);

    cancelAnimationFrame(
      this.rafId
    );

    this.offsetMs =
      time * 1000;

    this.tStart =
      performance.now();

    this.secs =
      Math.floor(time);

    this.tlPos = time;
    this._tlx = null;
    this._sig = null;
    this._cueSig = null;

    this.demoRunning = true;
    this.paused = false;

    this.paintPauseBtn();
    this.paintTimer();
    this.paintTimeline(time);

    // An explicit scrub is a fresh start, so Transcripts comes back up with it.
    this.setState({
      showTranscripts: true
    });

    this.syncAt(time);
    this.startTickLoop();
  };

  seek = i => {
    this.seekToTime(
      clamp(
        i,
        0,
        SECTIONS.length - 1
      ) *
        SECTION_DUR
    );
  };

  step = d => {
    const t =
      Math.min(
        TL_TOTAL,
        this.secs
      );

    this.seek(
      Math.floor(
        t /
        SECTION_DUR
      ) + d
    );
  };

  paintTimerAt(secFloat) {
    if (!this.r.timer) return;

    const secs =
      Math.floor(secFloat);

    const m =
      Math.floor(
        secs / 60
      );

    const s =
      secs % 60;

    this.r.timer.textContent =
      (m < 10 ? '0' : '') +
      m +
      ':' +
      (s < 10 ? '0' : '') +
      s;
  }
    // Drag directly on the ruler to scrub. Freezes the live clock without
  // resetting playback state, previews the scrub position live, then snaps
  // to the nearest section on release (matching the label-click granularity).
  tlDragStart = (e) => {
    if (e.button) return;

    const pps = this.sizeTimeline();

    const startT = this.paused
      ? this.pausedElapsedMs / 1000
      : this.demoRunning
        ? clamp(
            (performance.now() - this.tStart + this.offsetMs) / 1000,
            0,
            TL_TOTAL
          )
        : (this.secs || 0);

    this.tlDrag = {
      startX: e.clientX,
      startT,
      pps,
      moved: false
    };

    if (this.demoRunning && !this.paused) {
      this.clockGen++;
      cancelAnimationFrame(this.rafId);
    }

    if (this.r.tlWin) {
      this.r.tlWin.style.cursor = 'grabbing';
    }

    window.addEventListener(
      'pointermove',
      this.tlDragMove
    );

    window.addEventListener(
      'pointerup',
      this.tlDragEnd
    );

    e.preventDefault();
  };

  tlDragMove = (e) => {
    const d = this.tlDrag;

    if (!d) return;

    const dx =
      e.clientX - d.startX;

    if (Math.abs(dx) > 3) {
      d.moved = true;
    }

    const t =
      clamp(
        d.startT - dx / d.pps,
        0,
        TL_TOTAL
      );

    this._tlPreview = t;

    this.paintTimeline(t);
    this.paintTimerAt(t);
  };

  tlDragEnd = () => {
    const d = this.tlDrag;

    window.removeEventListener(
      'pointermove',
      this.tlDragMove
    );

    window.removeEventListener(
      'pointerup',
      this.tlDragEnd
    );

    this.tlDrag = null;

    if (this.r.tlWin) {
      this.r.tlWin.style.cursor = 'grab';
    }

    if (!d) return;

    if (!d.moved) {
      // No real drag — restore whatever was already playing/paused.
      if (
        this.demoRunning &&
        !this.paused
      ) {
        this.startTickLoop();
      } else {
        this.paintTimeline(
          this.paused
            ? this.pausedElapsedMs / 1000
            : (this.secs || 0)
        );
      }

      return;
    }

    const target =
      this._tlPreview || 0;

    this._tlPreview = null;

    // A real drag is followed by a synthetic click on whichever section button
    // is under the cursor — swallow it, or it would re-seek to that section's start.
    this._suppressTlClick = true;

    this.seekToTime(target);
  };


  // =========================================================================
  // Pause / play
  // =========================================================================

  paintPauseBtn() {
    const showPlay =
      this.paused;

    if (this.r.iconPause) {
      this.r.iconPause.style.opacity =
        showPlay ? '0' : '1';
    }

    if (this.r.iconPlay) {
      this.r.iconPlay.style.opacity =
        showPlay ? '1' : '0';
    }
  }

  togglePause = () => {
    if (
      !this.demoRunning &&
      !this.paused
    ) {
      return;
    }

    if (this.paused) {
      this.paused = false;
      this._autoPaused = false;
      this.tStart = performance.now();
      this.offsetMs =
        this.pausedElapsedMs;

      this.startTickLoop();

    } else if (this._autoPaused) {

      // Already frozen by the off-screen auto-pause:
      // a user pause on top just locks the banked position.
      this.paused = true;

    } else {

      this.paused = true;

      this.pausedElapsedMs =
        clamp(
          (
            performance.now() -
            this.tStart
          ) +
            this.offsetMs,
          0,
          TL_TOTAL * 1000
        );

      this.clockGen++;

      cancelAnimationFrame(
        this.rafId
      );
    }

    this.paintPauseBtn();
  };


  // =========================================================================
  // Timers
  // =========================================================================

  // setTimeout that suspends itself while paused instead of firing on schedule.
  schedule = (fn, delay) =>
    setTimeout(() => {
      if (this.paused) {
        this.tid =
          this.schedule(
            fn,
            150
          );

        return;
      }

      fn();
    }, delay);

  paintClock() {
    if (!this.r.clock) return;

    this.r.clock.textContent =
      new Date().toLocaleTimeString(
        [],
        {
          hour: 'numeric',
          minute: '2-digit'
        }
      );
  }

  paintTimer() {
    if (!this.r.timer) return;

    const m =
      Math.floor(
        this.secs / 60
      );

    const s =
      this.secs % 60;

    this.r.timer.textContent =
      (m < 10 ? '0' : '') +
      m +
      ':' +
      (s < 10 ? '0' : '') +
      s;
  }


  // =========================================================================
  // Scrollbar
  // =========================================================================

  peekScrollbar = (e) => {
    const sc =
      (e && e.currentTarget) ||
      this.r.scroll;

    if (!sc) return;

    sc.style.scrollbarWidth =
      'thin';

    clearTimeout(
      sc.__sbTid
    );

    sc.__sbTid =
      setTimeout(() => {
        sc.style.scrollbarWidth =
          'none';
      }, 1600);
  };


  // =========================================================================
  // Checklist / state helpers
  // =========================================================================

  paintStrike(el, n, baseOpacity) {
    if (!el) return;

    const on =
      !!(this.state.done || {})[n];

    el.style.textDecoration =
      on
        ? 'line-through'
        : 'none';

    el.style.opacity =
      on
        ? baseOpacity * 0.55
        : baseOpacity;
  }

  // Manual windows share one slot; clicking the open one closes it.
  openPanel(name) {
    this.setState(
      s =>
        s.panel === name
          ? {
              panel: null
            }
          : {
              panel: name,
              ka: 0,
              gu: 0,
              wfa: 0
            }
    );
  }

  vote = (v) =>
    this.setState(
      s => ({
        vote:
          s.vote === v
            ? 0
            : v
      })
    );

  paintVote(el, v) {
    if (!el) return;

    const on =
      this.state.vote === v;

    const c =
      v > 0
        ? 'rgba(126,214,168,'
        : 'rgba(248,117,99,';

    el.style.background =
      on
        ? c + '0.24)'
        : 'transparent';

    el.style.borderColor =
      on
        ? c + '0.55)'
        : 'var(--gw-tile-border,rgba(255,255,255,0.12))';

    el.style.color =
      on
        ? 'var(--gw-strong,#FFFFFF)'
        : 'var(--gw-label,#B1BAC4)';
  }

  paintTab(el, id) {
    if (!el) return;

    const on =
      this.state.tab === id;

    el.style.color =
      on
        ? 'var(--gw-strong,#FFFFFF)'
        : 'var(--gw-label,#B1BAC4)';

    el.style.fontWeight =
      on
        ? '600'
        : '500';

    el.style.borderBottomColor =
      on
        ? 'var(--gw-link,#93DEFD)'
        : 'transparent';
  }

  checkPct() {
    const d =
      this.state.done || {};

    return [1, 2, 3]
      .filter(
        n => d[n]
      )
      .length / 3;
  }

  tick = (n) =>
    this.setState(
      s => ({
        done:
          Object.assign(
            {},
            s.done,
            {
              [n]: !s.done[n]
            }
          )
      })
    );

  // Checked styling is painted through the ref so it tracks both the script and
  // manual clicks without a style hole delaying first paint.
  paintCheck(el, n) {
    if (!el) return;

    const on =
      !!(this.state.done || {})[n];

    el.style.background =
      on
        ? '#6B4BD6'
        : 'transparent';

    el.style.borderColor =
      on
        ? '#6B4BD6'
        : 'var(--gw-tile-border,rgba(255,255,255,0.30))';

    el.style.color =
      on
        ? '#FFFFFF'
        : 'transparent';
  }


  // =========================================================================
  // Stop / restart demo
  // =========================================================================

  stopDemo() {
    this.gen++;
    this.clockGen++;
    this.paused = false;

    clearInterval(
      this.clockId
    );

    this.clockId = null;

    clearTimeout(
      this.tid
    );

    cancelAnimationFrame(
      this.rafId
    );

    this.demoRunning = false;
    this._tlx = null;
  }

  restart = () => {
    this.stopDemo();

    this.pos = {
      cluster: {
        x: 0,
        y: 0
      },
      t: {
        x: 0,
        y: 0
      },
      c: {
        x: 0,
        y: 0
      }
    };

    this._curSec = null;

    this.setState(
      {
        showTranscripts: false,
        showContext: true,
        lines:
          this.computeAt(0).lines,
        ka: 0,
        gu: 0,
        pick: null,
        sum: 0,
        wfa: 0,
        done: {},
        panel: null,
        notesText: '',
        liveText: '',
        searchText:
          (
            CONTENT.searchDefault ||
            ''
          ),
        vote: 0,
        tab: 'best',
        secOpen: true
      },
      () =>
        this.startDemo(0)
    );

    if (
      this.r.refresh &&
      this.r.refresh.animate
    ) {
      this.r.refresh.animate(
        [
          {
            transform:
              'rotate(0deg)'
          },
          {
            transform:
              'rotate(-360deg)'
          }
        ],
        {
          duration: 560,
          easing:
            'cubic-bezier(.2,.7,.2,1)'
        }
      );
    }
  };


  // =========================================================================
  // Background
  // =========================================================================

  applyBackground() {
    const active =
      this.state.bg;

    BACKGROUNDS.forEach(
      (_, i) => {
        const layer =
          this.r[
            'bg' + i
          ];

        if (layer) {
          layer.style.opacity =
            i === active
              ? '1'
              : '0';
        }

        const dot =
          this.r[
            'dot' + i
          ];

        if (dot) {
          dot.style.width =
            i === active
              ? '26px'
              : '9px';

          dot.style.background =
            i === active
              ? '#FFFFFF'
              : 'rgba(255,255,255,0.36)';
        }
      }
    );
  }


  // =========================================================================
  // Render values / bindings
  // =========================================================================

  renderVals() {
    const mk =
      k =>
      el => {
        this.r[k] = el;
      };

    // Windows whose height should morph rather than snap when their content changes.
    const mkSized =
      k =>
      el => {
        this.r[k] = el;
        this.watchSize(
          el,
          k
        );
      };

    const labelBlur =
      this.props.labelBlur ??
      'corner';

    const cap =
      this.state.lines[
        this.state.lines.length - 1
      ];

    const open =
      this.state.openMenu;

    const nav =
      NAV.map(
        m => ({
          label: m.label,

          enter: () =>
            this.setState({
              openMenu:
                m.label
            })
        })
      );

    const active =
      NAV.find(
        m =>
          m.label === open
      ) || null;

    return {
      stripBlur:
        labelBlur === 'strip',

      cornerBlur:
        labelBlur === 'corner',

      menus: nav,

      activeMenu:
        active,

      activeCols:
        active
          ? active.cols
          : [],

      closeMenu: () =>
        this.setState({
          openMenu: null
        }),

      mobileNav:
        this.state.mobileNav,

      toggleMobileNav: () =>
        this.setState(
          s => ({
            mobileNav:
              !s.mobileNav,
            openMenu: null
          })
        ),

      mobileSections:
        NAV.map(
          m => ({
            title: m.label,

            items:
              m.cols.reduce(
                (acc, c) =>
                  acc.concat(
                    c.lead
                      ? [
                          {
                            t: c.lead,
                            href:
                              c.leadHref
                          }
                        ]
                      : [],
                    c.items
                  ),
                []
              )
          })
        ),

      features2:
        FEATURES2.map(
          (f, i) => ({
            ...f,

            vref:
              mk(
                'featVid' +
                i
              ),

            pick: () =>
              this.pickVideo(
                'feature-' +
                  i,
                'featVid' +
                  i
              ),

            drop: e =>
              this.dropVideo(
                'feature-' +
                  i,
                'featVid' +
                  i,
                e
              )
          })
        ),

      preventDefault:
        e =>
          e.preventDefault(),

      refPowerTrack:
        mk('powerTrack'),

      refPowerPin:
        mk('powerPin'),

      refPowerGrid:
        mk('powerGrid'),

      powers:
        POWERS.map(
          (p, i) => ({
            ...p,

            cref:
              mk(
                'pcopy' +
                i
              ),

            vref:
              mk(
                'pvis' +
                i
              ),

            dref:
              mk(
                'pdot' +
                i
              ),

            fref:
              mk(
                'pfill' +
                i
              ),

            vidref:
              mk(
                'pvid' +
                i
              ),

            jump: () =>
              this.jumpPower(i),

            pick: () =>
              this.pickVideo(
                'power-' +
                  i,
                'pvid' +
                  i
              ),

            drop: e =>
              this.dropVideo(
                'power-' +
                  i,
                'pvid' +
                  i,
                e
              )
          })
        ),

      industries:
        INDUSTRIES,

      refIndRail:
        mk('indRail'),

      refIndThumb:
        mk('indThumb'),

      refIndTrackL:
        mk('indTrackL'),

      refIndTrackR:
        mk('indTrackR'),

      indPrev: () =>
        this.nudgeIndustries(
          -1
        ),

      indNext: () =>
        this.nudgeIndustries(
          1
        ),

      onIndScroll:
        this.onIndScroll,

      stories:
        STORIES.map(
          (s, i) => ({
            ...s,

            bg:
              this.state
                .activeStory === i
                ? 'rgba(20,22,26,0.5)'
                : 'rgba(20,22,26,0.34)',

            borderA:
              this.state
                .activeStory === i
                ? '0.22'
                : '0.12',

            playBg:
              this.state
                .activeStory === i
                ? '#205AE3'
                : '#1A1D22',

            pick: () =>
              this.setState({
                activeStory: i
              })
          })
        ),

      storyPrev: () =>
        this.setState(
          s => ({
            activeStory:
              (
                s.activeStory +
                STORIES.length -
                1
              ) %
              STORIES.length
          })
        ),

      storyNext: () =>
        this.setState(
          s => ({
            activeStory:
              (
                s.activeStory +
                1
              ) %
              STORIES.length
          })
        ),

      resources:
        RESOURCES,

      pillars:
        PILLARS.map(
          (p, i) => ({
            ...p,

            fref:
              mk(
                'tabFill' +
                i
              ),

            tref:
              mk(
                'tabTitle' +
                i
              ),

            bref:
              mk(
                'tabBody' +
                i
              ),

            pick: () =>
              this.pickTab(i)
          })
        ),

      refBubble:
        mk('bubble'),

      refBubbleFloat:
        mk(
          'bubbleFloat'
        ),

      bubbleDown:
        this.bubbleDown,

      faqs:
        FAQS.map(
          (f, i) => ({
            q: f.q,
            a: f.a,

            open:
              this.state
                .openFaq === i,

            plusOpacity:
              this.state
                .openFaq === i
                ? '0'
                : '1',

            plusRotate:
              this.state
                .openFaq === i
                ? '90deg'
                : '0deg',

            minusOpacity:
              this.state
                .openFaq === i
                ? '1'
                : '0',

            rows:
              this.state
                .openFaq === i
                ? '1fr'
                : '0fr',

            // Cached so the handler identity is stable across renders.
            toggle:
              this.faqToggle(i)
          })
        ),

      refHeader:
        mk('header'),

      refHeaderPad:
        mk('headerPad'),

      refShell:
        mk('shell'),

      refHeaderRow:
        mk('headerRow'),

      refIntro:
        mk('intro'),

      refTrack:
        mk('track'),

      refSticky:
        mk('sticky'),

      refStage:
        mk('stage'),

      refLeft:
        mk('left'),

      refFaceA:
        mk('faceA'),

      refFaceB:
        mk('faceB'),

      refUi:
        mk('ui'),

      refBg0:
        mk('bg0'),

      refBg1:
        mk('bg1'),

      refToolbar:
        mkSized('toolbar'),

      refPill:
        mk('pill'),

      refTimer:
        mk('timer'),

      refBtnT:
        mk('btnT'),

      refWinT:
        mkSized('winT'),

      refWinC:
        mkSized('winC'),

      refScroll:
        mk('scroll'),

      refRefresh:
        mk('refresh'),

      refChrome:
        mk('chrome'),

      refDots:
        mk('dots'),

      refMenubar:
        mk('menubar'),

      refClock:
        mk('clock'),

      refTimelineWrap:
        mk('timelineWrap'),

      showTranscripts:
        this.state
          .showTranscripts,

      showContext:
        false &&
        this.state.showContext &&
        this.state.ka === 0 &&
        this.state.gu === 0 &&
        this.state.sum === 0 &&
        this.state.wfa === 0 &&
        !this.state.panel,

      showGuide:
        this.state.gu > 0 &&
        this.state.sum === 0 &&
        this.state.wfa === 0 &&
        !this.state.panel,

      showWfa: false,

      wfaIdle:
        this.state.wfa === 1,

      wfaRunning:
        this.state.wfa === 2,

      wfaDone:
        this.state.wfa === 3,

      runWfa: () => {
        this.setState({
          wfa: 2
        });

        clearTimeout(
          this._wfaTid
        );

        this._wfaTid =
          setTimeout(
            () =>
              this.setState(
                s =>
                  s.wfa === 2
                    ? {
                        wfa: 3
                      }
                    : null
              ),
            2200
          );
      },

      cancelWfa: () => {
        clearTimeout(
          this._wfaTid
        );

        this.setState({
          wfa: 1
        });
      },

      dismissWfa: () =>
        this.setState({
          wfa: 0,
          gu: 0,
          showContext: false
        }),

      showSummary:
        this.state.panel ===
          'notes' ||
        (
          this.state.sum > 0 &&
          this.state.wfa === 0 &&
          this.state.ka === 0 &&
          this.state.gu === 0 &&
          !this.state.panel
        ),

      showLive:
        this.state.panel ===
        'live',

      showList:
        this.state.panel ===
        'list',

      showSearch:
        this.state.panel ===
          'search' ||
        (
          this.state.ka > 0 &&
          this.state.gu === 0 &&
          this.state.wfa === 0 &&
          !this.state.panel
        ),

      searchText:
        this.state.searchText,

      setSearch: e =>
        this.setState({
          searchText:
            e.target.value
        }),

      clearSearch: () =>
        this.setState({
          searchText: ''
        }),

      // Manual opens land on Best Match until a GenAI answer actually exists.
      toggleSearch: () =>
        this.setState(
          s =>
            (
              s.panel ===
                'search' ||
              s.ka > 0
            )
              ? {
                  panel: null,
                  ka: 0
                }
              : {
                  panel:
                    'search',
                  tab:
                    s.ka > 0
                      ? 'genai'
                      : 'best',
                  gu: 0,
                  wfa: 0
                }
        ),

      closeSearch: () =>
        this.setState({
          panel: null,
          ka: 0
        }),

      showKb:
        this.state.panel ===
        'search',

      showDrafted:
        this.state.panel !==
        'search',

      showSearchBar:
        this.state.panel ===
        'search',

      refResults: el => {
        this.r.results = el;

        if (!el) return;

        el.style.height = '';

        const manual =
          this.state.panel ===
          'search';

        el.style.maxHeight =
          manual
            ? (
                this._resMax ||
                188
              ) + 'px'
            : '';

        el.style.overflowY =
          manual
            ? 'auto'
            : 'visible';
      },

      sectionOpen:
        this.state.secOpen !==
        false,

      toggleSection: () =>
        this.setState(
          s => ({
            secOpen:
              s.secOpen ===
              false
          })
        ),

      refCaret: el => {
        if (el) {
          el.style.transform =
            this.state
              .secOpen === false
              ? 'rotate(-90deg)'
              : 'rotate(0deg)';
        }
      },

      toggleWfaPanel: () =>
        this.setState(
          s =>
            s.wfa > 0
              ? {
                  wfa: 0
                }
              : {
                  wfa: 1,
                  panel: null,
                  gu: 0,
                  ka: 0
                }
        ),

      toggleList: () =>
        this.openPanel(
          'list'
        ),

      closeList: () =>
        this.setState({
          panel: null
        }),

      toggleL1: () =>
        this.tick(1),

      toggleL2: () =>
        this.tick(2),

      toggleL3: () =>
        this.tick(3),

      refProg: el => {
        if (!el) return;

        const arc =
          el.querySelectorAll(
            'circle'
          )[1];

        if (arc) {
          arc.setAttribute(
            'stroke-dashoffset',
            String(
              50.3 *
              (
                1 -
                this.checkPct()
              )
            )
          );
        }
      },

      refT1: el =>
        this.paintStrike(
          el,
          1,
          1
        ),

      refD1: el =>
        this.paintStrike(
          el,
          1,
          0.8
        ),

      refT2: el =>
        this.paintStrike(
          el,
          2,
          1
        ),

      refD2: el =>
        this.paintStrike(
          el,
          2,
          0.8
        ),

      refT3: el =>
        this.paintStrike(
          el,
          3,
          1
        ),

      refD3: el =>
        this.paintStrike(
          el,
          3,
          0.8
        ),

      refL1: el =>
        this.paintCheck(
          el,
          1
        ),

      refL2: el =>
        this.paintCheck(
          el,
          2
        ),

      refL3: el =>
        this.paintCheck(
          el,
          3
        ),

      liveText:
        this.state.liveText,

      setLive: e =>
        this.setState({
          liveText:
            e.target.value
        }),

      refSend: el => {
        if (!el) return;

        const on =
          !!this.state
            .liveText
            .trim();

        el.style.background =
          on
            ? '#6B4BD6'
            : 'var(--gw-chip,rgba(255,255,255,0.13))';

        el.style.color =
          on
            ? '#FFFFFF'
            : 'var(--gw-label,#B1BAC4)';

        el.style.cursor =
          on
            ? 'pointer'
            : 'default';

        el.style.pointerEvents =
          on
            ? 'auto'
            : 'none';
      },

      sendLive: () =>
        this.setState({
          liveText: ''
        }),

      toggleLive: () =>
        this.openPanel(
          'live'
        ),

      closeLive: () =>
        this.setState({
          panel: null
        }),

      notesText:
        this.state.notesText,

      setNotes: e =>
        this.setState({
          notesText:
            e.target.value
        }),

      toggleNotes: () =>
        this.openPanel(
          'notes'
        ),

      notesFieldOn:
        this.state.sum === 0 ||
        (
          this.state.sum === 2 &&
          !!this.state.notesText
        ) ||
        (
          this.state.sum === 1 &&
          !!this.state.notesText
        ),

      refSumBody: el => {
        if (!el) return;

        const withNotes =
          !!this.state
            .notesText;

        el.style.paddingTop =
          withNotes
            ? '10px'
            : '0';

        el.style.borderTop =
          withNotes
            ? '1px solid var(--gw-tile-border,rgba(255,255,255,0.12))'
            : '0';
      },

      refGenRow: el => {
        if (!el) return;

        const withNotes =
          !!this.state
            .notesText;

        el.style.paddingTop =
          withNotes
            ? '10px'
            : '0';

        el.style.borderTop =
          withNotes
            ? '1px solid var(--gw-tile-border,rgba(255,255,255,0.12))'
            : '0';
      },

      summaryLoading:
        this.state.sum === 1,

      summaryReady:
        this.state.sum === 2,

      dismissSummary: () =>
        this.setState({
          panel: null,
          sum: 0,
          gu: 0,
          ka: 0,
          showContext: false
        }),

      toggleSummary: () =>
        this.setState(
          s => ({
            sum:
              s.sum > 0
                ? 0
                : 2
          })
        ),

      pickedEarly:
        this.state.pick ===
        'early',

      pickedLater:
        this.state.pick ===
        'later',

      pickEarly: () =>
        this.setState({
          pick: 'early'
        }),

      pickLater: () =>
        this.setState({
          pick: 'later'
        }),

      dismissGuide: () =>
        this.setState({
          gu: 0,
          ka: 0,
          showContext: false
        }),

      refAnswer: el => {
        if (
          !el ||
          this.state.panel !==
            'search'
        ) {
          return;
        }

        el.style.animation =
          'none';

        el.querySelectorAll('*')
          .forEach(n => {
            if (
              n.style &&
              n.style.animation
            ) {
              n.style.animation =
                'none';
            }
          });
      },

      refKaGroup: el => {
        if (!el) return;

        const on =
          this.state.panel ===
          'search';

        el.style.padding =
          on
            ? '12px 13px'
            : '0';

        el.style.borderRadius =
          on
            ? '12px'
            : '0';

        el.style.background =
          on
            ? 'var(--gw-tile,rgba(255,255,255,0.09))'
            : 'transparent';

        el.style.border =
          on
            ? '1px solid var(--gw-tile-border,rgba(255,255,255,0.12))'
            : '0';
      },

      kaContext:
        this.state.ka === 1,

      kaTile:
        this.state.ka !== 1,

      kaPills:
        this.state.ka === 0 ||
        this.state.ka >= 2,

      kaLoading:
        this.state.ka === 2,

      refPillLast: el => {
        if (!el) return;

        const m =
          this.state.panel ===
          'search';

        el.style.minWidth =
          m ? '0' : '';

        el.style.flex =
          m
            ? '0 1 auto'
            : 'none';
      },

      refPillLastText: el => {
        if (!el) return;

        const m =
          this.state.panel ===
          'search';

        el.style.overflow =
          m ? 'hidden' : '';

        el.style.textOverflow =
          m
            ? 'ellipsis'
            : '';

        el.style.whiteSpace =
          m
            ? 'nowrap'
            : '';
      },

      kaAnswer:
        this.state.ka === 0 ||
        this.state.ka >= 3,

      peekScrollbar:
        this.peekScrollbar,

      lines:
        this.state.lines.map(
          l => {
            const key =
              l.key || '';

            const at =
              key
                ? l.shown.indexOf(
                    key
                  )
                : -1;

            if (at < 0) {
              return {
                name: l.name,
                avatar:
                  l.avatar,
                pre:
                  l.shown,
                key: '',
                post: '',
                hasKey: false,
                typing:
                  !!l.typing
              };
            }

            return {
              name: l.name,
              avatar:
                l.avatar,
              hasKey: true,
              typing:
                !!l.typing,
              pre:
                l.shown.slice(
                  0,
                  at
                ),
              key,
              post:
                l.shown.slice(
                  at +
                  key.length
                )
            };
          }
        ),

      toggleContext: () =>
        this.setState(
          s => ({
            showContext:
              !s.showContext,
            ka: 0,
            gu: 0,
            wfa: 0,
            sum: 0,
            panel: null
          })
        ),

      restart:
        this.restart,

      tlDragStart:
        this.tlDragStart,

      dragCluster: e =>
        this.startDrag(
          'cluster',
          e
        ),

      dragTranscripts: e =>
        this.startDrag(
          't',
          e
        ),

      dragContext: e =>
        this.startDrag(
          'c',
          e
        ),

      refTlWin:
        mk('tlWin'),

      refStrip:
        mk('strip'),

      refStack:
        mk('stack'),

      refLens:
        mk('lens'),

      refLensCopy:
        mk('lensCopy'),

      refPause:
        mk('pauseBtn'),

      refIconPause:
        mk('iconPause'),

      refIconPlay:
        mk('iconPlay'),

      togglePause:
        this.togglePause,

      tlSections:
        SECTIONS.map(
          (s, i) => ({
            l1: s.l1,
            l2: s.l2,

            title:
              s.l1 +
              ' ' +
              s.l2,

            ref:
              mk(
                'sec' + i
              ),

            lref:
              mk(
                'lsec' + i
              ),

            select: () => {
              if (
                this._suppressTlClick
              ) {
                this._suppressTlClick =
                  false;

                return;
              }

              this.seek(i);
            }
          })
        ),

      tlPrev: () =>
        this.step(-1),

      tlNext: () =>
        this.step(1),

      isDark:
        this.state.bg === 0,

      isLight:
        this.state.bg !== 0,

      toggleTheme: () =>
        this.setState(
          s => ({
            bg:
              s.bg === 0
                ? 1
                : 0
          })
        ),

      refUiCard:
        mk('uiCard'),

      refVidC:
        mk('vidC'),

      refVidA:
        mk('vidA'),

      refBelow:
        mk('below')
    };
  }
}
const BEZ = {
  cresta: [0.2, 0.7, 0.2, 1],
  smooth: [0.45, 0, 0.25, 1],
  linear: null
};

function bezier(p1x, p1y, p2x, p2y) {
  const A = (a, b) => 1 - 3 * b + 3 * a;
  const B = (a, b) => 3 * b - 6 * a;
  const C = a => 3 * a;

  const calc = (t, a, b) =>
    ((A(a, b) * t + B(a, b)) * t + C(a)) * t;

  const slope = (t, a, b) =>
    3 * A(a, b) * t * t +
    2 * B(a, b) * t +
    C(a);

  return function (x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    let t = x;

    for (let i = 0; i < 6; i++) {
      const d = slope(t, p1x, p2x);

      if (Math.abs(d) < 1e-6) break;

      t -=
        (calc(t, p1x, p2x) - x) /
        d;
    }

    return calc(
      t,
      p1y,
      p2y
    );
  };
}

function clamp(v, a, b) {
  return v < a
    ? a
    : v > b
      ? b
      : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}


// ============================================================================
// Background options
// ============================================================================

// Background options for the Agent UI panel — add an entry plus a matching
// layer div + refBgN in the template to extend the carousel.
const BACKGROUNDS = [
  {
    label: 'Dark mode'
  },
  {
    label: 'Light mode'
  }
];


// Glass theme per background option: dark glass over the moody wallpaper,
// white glass over the bright cobalt one so the widget never blends in.
const UI_THEMES = [
  {
    fill:
      'rgba(26,28,38,0.30)',

    border:
      'rgba(255,255,255,0.17)',

    inset:
      'rgba(255,255,255,0.11)',

    shadow:
      '0 22px 48px rgba(6,6,12,0.26)',

    btn:
      'rgba(30,32,42,0.34)',

    'btn-border':
      'rgba(255,255,255,0.19)',

    icon:
      '#EEF0F5',

    text:
      '#EDEFF4',

    strong:
      '#FFFFFF',

    label:
      '#C2C9D6',

    muted:
      '#D9DCE4',

    tile:
      'rgba(255,255,255,0.10)',

    'tile-border':
      'rgba(255,255,255,0.12)',

    chip:
      'rgba(255,255,255,0.15)',

    'chip-text':
      '#E9ECF2',

    alert:
      'rgba(248,117,99,0.24)',

    'alert-text':
      '#FFC9C0',

    'ok-text':
      '#CBEEDB',

    link:
      '#93DEFD',

    hover:
      'rgba(255,255,255,0.09)',

    'glow-a':
      'rgba(147,222,253,0.32)',

    'glow-b':
      'rgba(147,222,253,0.52)',

    mark:
      'none',

    bar:
      'rgba(24,26,34,0.72)',

    tick:
      'rgba(255,255,255,0.30)',

    'tick-major':
      'rgba(255,255,255,0.55)',

    'tl-chip':
      'rgba(30,32,42,0.34)',

    'tl-tick':
      'rgba(255,255,255,0.30)',

    'tl-tick-major':
      'rgba(255,255,255,0.55)',

    'tl-label':
      'rgba(255,255,255,0.55)',

    'tl-strong':
      '#FFFFFF',

    'tl-playhead-border':
      'rgba(255,255,255,0.30)',

    'tl-playhead-fill':
      '#FFFFFF'
  },

  {
    fill:
      'rgba(255,255,255,0.90)',

    border:
      'rgba(255,255,255,0.92)',

    inset:
      'rgba(255,255,255,0.95)',

    shadow:
      '0 22px 48px rgba(10,26,72,0.24)',

    btn:
      'rgba(255,255,255,0.90)',

    'btn-border':
      'rgba(255,255,255,0.92)',

    icon:
      '#24242A',

    text:
      '#1E1F27',

    strong:
      '#0E0E13',

    label:
      '#5A616C',

    muted:
      '#3C3C47',

    tile:
      'rgba(255,255,255,0.52)',

    'tile-border':
      'rgba(36,36,42,0.10)',

    chip:
      'rgba(36,36,42,0.09)',

    'chip-text':
      '#3C3C47',

    alert:
      'rgba(248,117,99,0.30)',

    'alert-text':
      '#8C2C1B',

    'ok-text':
      '#155B39',

    link:
      '#205AE3',

    hover:
      'rgba(36,36,42,0.07)',

    'glow-a':
      'rgba(32,89,227,0.42)',

    'glow-b':
      'rgba(32,89,227,0.72)',

    mark:
      'invert(1) brightness(0.18)',

    bar:
      'rgba(24,26,34,0.72)',

    tick:
      'rgba(255,255,255,0.30)',

    'tick-major':
      'rgba(255,255,255,0.55)',

    'tl-chip':
      'rgba(255,255,255,0.62)',

    'tl-tick':
      'rgba(36,36,42,0.26)',

    'tl-tick-major':
      'rgba(36,36,42,0.5)',

    'tl-label':
      'rgba(36,36,42,0.45)',

    'tl-strong':
      '#20212B',

    'tl-playhead-border':
      'rgba(36,36,42,0.32)',

    'tl-playhead-fill':
      '#20212B'
  }
];


// ============================================================================
// Localized transcript/demo content
// ============================================================================

const AV_AGENT =
  'linear-gradient(140deg,#6E95F0,#AE95DD)';

const AV_CUST =
  'linear-gradient(140deg,#FCB56C,#F87563)';


// Localizable demo copy lives in the Webflow Embed, not this behaviour file.
// This keeps one shared hero.js across every locale.
const CONTENT =
  window.AA_HERO_CONTENT || {};

const SECTIONS =
  Array.isArray(CONTENT.sections)
    ? CONTENT.sections
    : [];

const SCRIPT =
  (
    Array.isArray(CONTENT.script)
      ? CONTENT.script
      : []
  ).map(l => ({
    ...l,

    avatar:
      l.avatar ||
      (
        l.speaker === 'agent'
          ? AV_AGENT
          : AV_CUST
      )
  }));


if (
  !SECTIONS.length ||
  !SCRIPT.length
) {
  console.error(
    'Agent Assist hero: window.AA_HERO_CONTENT.sections and .script are required before hero.js loads.'
  );
}


const WORDS =
  SCRIPT.map(
    l =>
      l.text
        .split(' ')
        .length
  );


// Words appear in 1-3 word chunks. Seeded, so the same instant always renders
// the same text — randomness here would make scrubbing flicker.
const WORD_STEPS =
  WORDS.map(
    (n, i) => {
      let seed =
        (i + 7) * 9301;

      let w = 0;

      const steps = [];

      while (w < n) {
        seed =
          (
            seed * 9301 +
            49297
          ) %
          233280;

        w =
          Math.min(
            n,
            w +
              1 +
              Math.floor(
                (
                  seed /
                  233280
                ) * 3
              )
          );

        steps.push(w);
      }

      return steps;
    }
  );


// The word count at which a line's trigger phrase is fully on screen — snapped
// up to a typing chunk boundary, so the cue can never fire mid-phrase.
const KEY_W =
  SCRIPT.map(
    (l, i) => {
      if (!l.key) {
        return null;
      }

      const words =
        l.text.split(' ');

      let k =
        words.length;

      for (
        let n = 1;
        n <= words.length;
        n++
      ) {
        if (
          words
            .slice(0, n)
            .join(' ')
            .indexOf(l.key) >
          -1
        ) {
          k = n;
          break;
        }
      }

      for (
        const st of
        WORD_STEPS[i]
      ) {
        if (st >= k) {
          return st;
        }
      }

      return k;
    }
  );


// Every line owns a slice of its chapter band, proportional to its length:
// 82% typing, the rest a beat before the next line. Timing is data, not a chain
// of setTimeouts, so any position on the ruler resolves to an exact state.
// A line carrying `cueAt` is stretched or squeezed so that its trigger phrase
// finishes typing exactly `cueAt` of the way into the chapter — the window and
// the transcript therefore land on the same frame.
const LINE_T = (() => {
  const out = [];
  const bands = {};

  SCRIPT.forEach(
    (l, i) => {
      (
        bands[l.sec] =
          bands[l.sec] ||
          []
      ).push(i);
    }
  );

  Object.keys(
    bands
  ).forEach(k => {
    const idxs =
      bands[k];

    const base =
      (+k) *
      SECTION_DUR;

    // The final chapter's lines only fill part of its band, so the summary has
    // room to finish generating before the playhead reaches the end.
    const span =
      (+k) ===
      SECTIONS.length - 1
        ? SECTION_DUR * 0.62
        : SECTION_DUR;

    const len = {};

    let free = span;
    let freeWords = 0;

    idxs.forEach(i => {
      const l =
        SCRIPT[i];

      if (
        l.cueAt &&
        i === idxs[0] &&
        KEY_W[i]
      ) {
        // start + (kb / words) * 0.82 * len === base + cueAt * span
        len[i] =
          clamp(
            (
              l.cueAt *
              span *
              WORDS[i]
            ) /
            (
              KEY_W[i] *
              0.82
            ),
            span * 0.15,
            span * 0.85
          );

        free -=
          len[i];

      } else {
        freeWords +=
          WORDS[i];
      }
    });

    idxs.forEach(i => {
      if (
        len[i] ===
        undefined
      ) {
        len[i] =
          free *
          (
            WORDS[i] /
            (
              freeWords ||
              1
            )
          );
      }
    });

    let acc =
      base;

    idxs.forEach(i => {
      const start =
        acc;

      acc +=
        len[i];

      out[i] = {
        start:
          start,

        end:
          acc,

        type:
          start +
          len[i] *
            0.82,

        words:
          WORDS[i]
      };
    });
  });

  return out;
})();


function lineText(i, f) {
  const words =
    SCRIPT[i]
      .text
      .split(' ');

  if (f >= 1) {
    return SCRIPT[i].text;
  }

  const target =
    f * words.length;

  let shown = 0;

  for (
    const s of
    WORD_STEPS[i]
  ) {
    if (s <= target) {
      shown = s;
    } else {
      break;
    }
  }

  return shown
    ? words
        .slice(0, shown)
        .join(' ')
    : '';
}


// A cue lands as its trigger phrase is spoken, not at line end.
const CUE_T =
  SCRIPT.map(
    (l, i) => {
      if (
        !(
          l.ka ||
          l.guide ||
          l.wfa ||
          l.summary ||
          l.pick ||
          l.check
        )
      ) {
        return null;
      }

      const T =
        LINE_T[i];

      if (!l.key) {
        return T.type;
      }

      const kb =
        KEY_W[i];

      return kb
        ? T.start +
            (
              kb /
              WORDS[i]
            ) *
            (
              T.type -
              T.start
            )
        : T.type;
    }
  );


// ============================================================================
// Legacy non-hero page data
// ============================================================================

const L = (t, href) => ({
  t,
  href
});

const NAV = [
  {
    label: 'Products',
    cols: [
      {
        title: 'Platform',
        lead: 'Platform Overview',
        leadDesc: 'Integrate, build, and scale with trust in the enterprise AI platform built for CX.',
        leadHref: 'https://cresta.com/platform-overview',
        items: [
          L('Opera', 'https://cresta.com/opera'),
          L('Integrations', 'https://cresta.com/integrations'),
          L('Responsible AI', 'https://cresta.com/responsible-ai')
        ]
      },
      {
        title: 'AI Agent',
        lead: 'AI Agent',
        leadDesc: 'Cut costs, not quality, with human-centric AI agents you can trust.',
        leadHref: 'https://cresta.com/ai-agent',
        items: [
          L('Discover', 'https://cresta.com/ai-agent-discover'),
          L('Build', 'https://cresta.com/ai-agent-build'),
          L('Test & Deploy', 'https://cresta.com/ai-agent-test-and-deploy'),
          L('Optimize', 'https://cresta.com/ai-agent-optimize'),
          L('Omnichannel', 'https://cresta.com/ai-agent-omnichannel'),
          L('Agent Operations Center', 'https://cresta.com/agent-operations-center'),
          L('AI Receptionist', 'https://cresta.com/ai-receptionist')
        ]
      },
      {
        title: 'Agent Assist',
        lead: 'Agent Assist',
        leadDesc: 'Harness real-time generative AI to empower agents with unmatched precision.',
        leadHref: 'https://cresta.com/agent-assist',
        items: [
          L('Knowledge Agent', 'https://cresta.com/knowledge-agent'),
          L('AI Summaries', 'https://cresta.com/ai-summaries'),
          L('Behavioral Guidance', 'https://cresta.com/cresta-behavioral-guidance'),
          L('Typing Efficiency', 'https://cresta.com/cresta-typing-efficiency'),
          L('Real-Time Translation', 'https://cresta.com/real-time-translation')
        ]
      },
      {
        title: 'Conversation Intelligence',
        lead: 'Conversation Intelligence',
        leadDesc: 'Discover and act on the true drivers of exceptional customer experience.',
        leadHref: 'https://cresta.com/conversation-intelligence',
        items: [
          L('Insights', 'https://cresta.com/cresta-insights'),
          L('AI Analyst™', 'https://cresta.com/cresta-ai-analyst'),
          L('Automation Discovery', 'https://cresta.com/cresta-automation-discovery'),
          L('Coach', 'https://cresta.com/cresta-coach'),
          L('Quality Management', 'https://cresta.com/cresta-quality-management'),
          L('Training Simulator', 'https://cresta.com/training-simulator')
        ]
      }
    ]
  },

  {
    label: 'Solutions',
    cols: [
      {
        title: 'Use cases',
        items: [
          L('Sales', 'https://cresta.com/sales'),
          L('Customer Care', 'https://cresta.com/customer-care'),
          L('Retention', 'https://cresta.com/retention'),
          L('Collections', 'https://cresta.com/collections')
        ]
      },
      {
        title: 'Industries',
        items: [
          L('Airlines', 'https://cresta.com/airlines'),
          L('Automotive', 'https://cresta.com/automotive'),
          L('Finance', 'https://cresta.com/financial-services'),
          L('Healthcare', 'https://cresta.com/healthcare'),
          L('Home Services', 'https://cresta.com/home-services')
        ]
      },
      {
        title: 'More industries',
        items: [
          L('Insurance', 'https://cresta.com/insurance'),
          L('Retail', 'https://cresta.com/retail'),
          L('Telecommunications', 'https://cresta.com/telecommunications'),
          L('Travel & Hospitality', 'https://cresta.com/travel-hospitality')
        ]
      }
    ]
  },

  {
    label: 'Customers',
    cols: [
      {
        title: 'Our customers',
        lead: 'Customer Stories',
        leadDesc: 'Learn how Cresta is delivering lasting value for our customers.',
        leadHref: 'https://cresta.com/customer-stories',
        items: [
          L('United Airlines', 'https://cresta.com/videos/united-airlines-cresta'),
          L('Aqua Finance', 'https://cresta.com/customers/aqua-finance'),
          L('Achieve', 'https://cresta.com/videos/achieve-cresta'),
          L('Alaska Airlines', 'https://cresta.com/customers/alaska-airlines')
        ]
      },
      {
        title: 'More stories',
        items: [
          L('Propel Holdings', 'https://cresta.com/customers/propel-holdings'),
          L('Cox Communications', 'https://cresta.com/customers/cox'),
          L('Brinks Home', 'https://cresta.com/customers/brinks-home'),
          L('Windstar Cruises', 'https://cresta.com/videos/windstar-cruises-cresta'),
          L('View all case studies', 'https://cresta.com/customer-stories')
        ]
      }
    ]
  },

  {
    label: 'Resources',
    cols: [
      {
        title: 'Learn with Cresta',
        lead: 'Resource Library',
        leadDesc: 'Webinars, videos, reports, and data sheets from the Cresta team.',
        leadHref: 'https://cresta.com/resources',
        items: [
          L('Webinars', 'https://cresta.com/resources/webinars'),
          L('Videos', 'https://cresta.com/resources/videos'),
          L('Ebooks', 'https://cresta.com/resources/ebooks'),
          L('Infographics', 'https://cresta.com/resources/infographics')
        ]
      },
      {
        title: 'Reading',
        items: [
          L('Reports', 'https://cresta.com/resources/reports'),
          L('Media Coverage', 'https://cresta.com/resources/media-coverage'),
          L('Press Releases', 'https://cresta.com/press'),
          L('Data Sheets', 'https://cresta.com/resources/datasheets'),
          L('Guides', 'https://cresta.com/guides')
        ]
      },
      {
        title: 'Additional information',
        items: [
          L('Blog', 'https://cresta.com/blog'),
          L('Industry News', 'https://www.cxcurrent.com/'),
          L('Help Center', 'https://docs.cresta.com/')
        ]
      }
    ]
  },

  {
    label: 'Company',
    cols: [
      {
        title: 'Our company',
        items: [
          L('About Cresta', 'https://cresta.com/about-us'),
          L('Careers', 'https://cresta.com/careers'),
          L('Press Releases', 'https://cresta.com/press'),
          L('Partners', 'https://cresta.com/partner')
        ]
      },
      {
        title: 'Support',
        items: [
          L('Help Center', 'https://docs.cresta.com/'),
          L('Trust & Security', 'https://cresta.com/trust'),
          L('AI Agent Implementation', 'https://cresta.com/ai-agent-implementation')
        ]
      }
    ]
  }
];


const FEATURES2 = [
  {
    title: 'Turn every agent into a top performer',
    body: 'Real-time guidance built from top performer behaviors. It follows the whole conversation, not keywords.',
    href: 'https://cresta.com/cresta-behavioral-guidance',
    src: 'assets/feature-behavioral-guidance.mp4'
  },
  {
    title: 'Solve customer questions faster',
    body: 'Knowledge Agent reads the conversation and screen, delivering the exact answer for that customer.',
    href: 'https://cresta.com/knowledge-agent',
    src: 'assets/feature-knowledge-agent.mp4'
  },
  {
    title: 'Customers never repeat themselves',
    body: 'AI summaries, tuned to your business, carry context through every handoff and sync to CRM in seconds.',
    href: 'https://cresta.com/ai-summaries',
    src: 'assets/feature-ai-summary.mp4'
  },
  {
    title: 'Scale digital conversations, on brand',
    body: 'Suggestions trained on your top chats and emails. Agents handle more, faster, without losing your voice.',
    href: 'https://cresta.com/cresta-typing-efficiency',
    src: 'assets/feature-digital-channels.mp4'
  }
];


const POWERS = [
  {
    title: 'Turn every agent into a top performer',
    body: 'Real-time guidance built from top performer behaviors. It follows the whole conversation, not keywords.',
    href: 'https://cresta.com/agent-assist',
    src: 'assets/power-behavioral-guidance.mp4',
    imgId: 'power-visual-1',
    placeholder: 'Behavioral guidance visual'
  },
  {
    title: 'Solve customer questions faster',
    body: 'Knowledge Agent reads the conversation and screen, delivering the exact answer for that customer.',
    href: 'https://cresta.com/knowledge-assist',
    src: 'assets/power-knowledge-agent.mp4',
    imgId: 'power-visual-2',
    placeholder: 'Knowledge Assist visual'
  },
  {
    title: 'Customers never repeat themselves',
    body: 'AI summaries, tuned to your business, carry context through every handoff and sync to CRM in seconds.',
    href: 'https://cresta.com/ai-summaries',
    src: 'assets/power-ai-summary.mp4',
    imgId: 'power-visual-3',
    placeholder: 'AI summary visual'
  },
  {
    title: 'Scale digital conversations, on brand',
    body: 'Suggestions trained on your top chats and emails. Agents handle more, faster, without losing your voice.',
    href: 'https://cresta.com/digital-channels',
    src: 'assets/power-suggested-response.mp4',
    imgId: 'power-visual-4',
    placeholder: 'Digital channels visual'
  }
];


const INDUSTRIES = [
  {
    id: 'industry-airlines',
    label: 'Airlines',
    placeholder: 'Airlines image'
  },
  {
    id: 'industry-travel',
    label: 'Travel + Hospitality',
    placeholder: 'Travel image'
  },
  {
    id: 'industry-finance',
    label: 'Finance',
    placeholder: 'Finance image'
  },
  {
    id: 'industry-home',
    label: 'Home Services',
    placeholder: 'Home services image'
  },
  {
    id: 'industry-insurance',
    label: 'Insurance',
    placeholder: 'Insurance image'
  }
];


const STORIES = [
  {
    name: 'Windstar Cruises',
    imgId: 'story-thumb-1'
  },
  {
    name: 'Achieve',
    imgId: 'story-thumb-2'
  },
  {
    name: 'Oportun',
    imgId: 'story-thumb-3'
  }
];


const RESOURCES = [
  {
    imgId: 'resource-1',
    tag: 'Data Sheets',
    tagColor: '#12A87A',
    title: 'Introducing Knowledge Agent: Real-Time Answers, Right When Needed',
    body: 'Learn about Knowledge Agent, an innovation that eliminates the need for human agents to search during live conversations.',
    href: 'https://cresta.com/resources/datasheets'
  },
  {
    imgId: 'resource-2',
    tag: 'Webinars',
    tagColor: '#1E86D6',
    title: 'Cresta Expands Global Reach with Real-Time Voice Translation',
    body: 'Cresta’s latest launch makes global CX effortless — with real-time voice translation, multilingual AI, and insights across every channel.',
    href: 'https://cresta.com/resources/webinars'
  },
  {
    imgId: 'resource-3',
    tag: 'Ebook',
    tagColor: '#D9752B',
    title: 'Introducing Synthetic Customers: A Living Model of Your Customer Base',
    body: 'A new way to test AI agents, train human agents, pressure-test decisions, and understand customer behavior at scale.',
    href: 'https://cresta.com/resources/ebooks'
  }
];


const PILLARS = [
  {
    t: 'Precision performance',
    d: 'Powered by advanced models and systems, Cresta delivers unmatched accuracy and seamless scalability with task-specific models for optimal outcomes and near-zero latency.'
  },
  {
    t: 'Unified intelligence',
    d: 'Cresta unifies your tech stack by integrating with telephony, chat, CRM, and knowledge systems — a single intelligent layer for data, insights, and AI workflows.'
  },
  {
    t: 'Responsible AI',
    d: 'An enterprise-grade approach to security, privacy, and responsible AI with leading certifications, custom PII redaction, and advanced guardrails to prevent hallucination.'
  }
];


const FAQS = [
  {
    q: 'What is Cresta?',
    a: 'Cresta unlocks the true potential of the customer experience, turning every conversation into a competitive advantage. Cresta’s unified AI platform combines conversational AI agents, real-time human agent augmentation, and comprehensive conversation intelligence to drive revenue and efficiency gains across every channel. Companies like United Airlines, Cox Communications, and Marriott use Cresta to power world-class customer experiences every day.'
  },
  {
    q: 'Who was Cresta built for?',
    a: 'Cresta is built for large, high-volume customer operations that want to improve every customer conversation, not just automate a narrow slice of them. It is especially suited to enterprises with large teams of agents and leaders across CX, customer care, operations, and enablement. The strongest fit is organizations that run complex contact centers in industries like financial services, insurance, hospitality, telecom, and travel, where scale, compliance, and service quality all matter at once.'
  },
  {
    q: 'What is Cresta Agent Assist?',
    a: 'Cresta Agent Assist is real-time AI that augments human representatives during live customer conversations. It listens to every conversation as it happens, interprets the full context — not just keywords — and surfaces precise answers, outcome-driven hints, and guided workflows directly inside existing tools, so representatives never have to search or switch systems. It is built on models trained on your own conversations, so the guidance reflects what actually works in your operation, not generic best practice. It is part of Cresta’s Customer Experience AI platform.'
  },
  {
    q: 'What does Agent Assist actually do during a live call or chat?',
    a: 'Cresta Agent Assist proactively identifies knowledge moments and surfaces instant, source-backed answers based on live conversation and on-screen context so representatives stop searching mid-conversation. It detects the moments that matter — a churn signal, a compliance trigger, a revenue opportunity — and delivers targeted guidance designed to drive a specific outcome, not a generic hint. And it generates complete, context-aware reply suggestions for chat and email. The agent stays in control. Agent Assist recommends, the human decides.'
  },
  {
    q: 'How is Cresta Agent Assist different from others?',
    a: 'Most Agent Assist solutions can surface information. Cresta is built around behavioral recognition, identifying specific representative behaviors and customer signals as they happen, and responding with targeted guidance designed to drive a specific outcome. Not a generic hint — a precise intervention, triggered by what’s actually occurring in that conversation. It also sits inside one platform alongside AI Agent and Conversation Intelligence, so guidance, automation, analytics, and QA share the same intelligence layer instead of stitched-together tools.'
  },
  {
    q: 'Does Agent Assist handle after-call work and call summaries?',
    a: 'Yes. After-call work is one of the most consistent drains on representative capacity, and manual summaries introduce errors that cause downstream problems. Agent Assist automates both: live summaries update continuously during the conversation, and accurate, customizable summaries sync directly into your CRM within seconds after. For any handoff from another human or AI agent, the receiving representative gets full context instantly, without asking the customer to repeat themselves.'
  }
];


// ============================================================================
// Bootstrap
// ============================================================================

function boot() {
  var root =
    document.querySelector(
      '.aa-hero-root'
    );

  if (
    !root ||
    root.getAttribute(
      'data-aa-booted'
    )
  ) {
    return;
  }

  root.setAttribute(
    'data-aa-booted',
    '1'
  );

  var hero =
    new Component(root);

  hero.props =
    buildProps();

  hero.mount();

  manageVideos(root);

  window.AAHero =
    hero;
}


if (
  document.readyState ===
  'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    boot
  );
} else {
  boot();
}

})();
