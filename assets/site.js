/* TopExpo site behaviour. Classic script, no dependencies. */
(function () {
  var doc = document.documentElement;
  doc.classList.remove('no-js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CFG = {};
  try { CFG = JSON.parse(document.getElementById('te-cfg').textContent); } catch (e) {}
  var C = CFG.contacts || {};
  var H = CFG.hours || { open: '00:00', close: '24:00', timezone: 'Asia/Dubai' };
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  window.TE = { cfg: CFG, esc: esc };

  /* Header: shadow line once scrolled, hide on the way down, return on the way up */
  var header = $('[data-header]');
  if (header) {
    var lastY = window.scrollY, ticking = false;
    var onScroll = function () {
      var y = window.scrollY;
      header.classList.toggle('scrolled', y > 8);
      if (!doc.classList.contains('nav-open')) {
        if (y > 260 && y > lastY + 4) header.classList.add('away');
        else if (y < lastY - 4 || y < 120) header.classList.remove('away');
      }
      lastY = y; ticking = false;
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
    header.addEventListener('focusin', function () { header.classList.remove('away'); });
  }

  /* Mobile menu */
  var toggle = $('[data-nav-toggle]');
  function setNav(open) {
    doc.classList.toggle('nav-open', open);
    if (toggle) { toggle.setAttribute('aria-expanded', open ? 'true' : 'false'); toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); }
    var m = $('#mnav'); if (m) m.inert = !open;
    /* While the menu covers the screen, everything behind it leaves the Tab order */
    $$('body > *').forEach(function (el) { if (el !== header && el !== m && el.tagName !== 'SCRIPT') el.inert = open; });
  }
  if (toggle) {
    setNav(false);
    toggle.addEventListener('click', function () { setNav(!doc.classList.contains('nav-open')); });
    $$('#mnav a').forEach(function (a) { a.addEventListener('click', function () { setNav(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && doc.classList.contains('nav-open')) { setNav(false); toggle.focus(); } });
    window.addEventListener('resize', function () { if (window.innerWidth > 1080 && doc.classList.contains('nav-open')) setNav(false); });
  }

  /* Reveal on scroll */
  var rev = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        /* Reveal on entry, and at once for anything already scrolled past (anchor jumps, restored scroll) */
        if (x.isIntersecting || x.boundingClientRect.bottom < 0) { x.target.classList.add('in'); io.unobserve(x.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    rev.forEach(function (el) { io.observe(el); });
  } else rev.forEach(function (el) { el.classList.add('in'); });

  /* Opening status. Hours live in config.json; 00:00 to 24:00 means always open. */
  function toMin(s) { var p = String(s).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function openState(now) {
    var o = toMin(H.open), c = toMin(H.close);
    if (o === 0 && c >= 1440) return { open: true, label: 'Open 24/7' };
    var p = {};
    try { new Intl.DateTimeFormat('en-GB', { timeZone: H.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).forEach(function (x) { p[x.type] = x.value; }); } catch (e) { return { open: true, label: 'Open daily' }; }
    var m = (+p.hour) * 60 + (+p.minute);
    var open = c > o ? (m >= o && m < c) : (m >= o || m < c);
    return { open: open, label: open ? 'Open now' : 'Closed, opens ' + H.open };
  }
  function tick() {
    var st = openState(new Date());
    $$('[data-open-label]').forEach(function (el) { el.textContent = st.label; });
    $$('[data-open-dot]').forEach(function (el) { el.classList.toggle('off', !st.open); });
  }
  tick();
  setInterval(tick, 60000);

  /* Copy helpers */
  function copyText(text, btn) {
    var done = function () {
      if (!btn) return;
      var old = btn.getAttribute('data-label') || btn.textContent;
      btn.setAttribute('data-label', old); btn.textContent = 'Copied';
      setTimeout(function () { btn.textContent = old; }, 1600);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, done);
    else {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta); done();
    }
  }
  window.TE.copy = copyText;
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (!b) return;
    var v = b.getAttribute('data-copy');
    var src = v.charAt(0) === '#' ? $(v) : null;
    copyText(src ? (src.value || src.textContent) : v, b);
  });

  /* Show index: floating preview follows the cursor */
  var idx = $('.idx'), flo = $('.idx-float');
  var fineMQ = window.matchMedia('(hover: hover) and (min-width: 861px)');
  if (idx && flo) {
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, imgs = $$('img', flo);
    var loop = function () {
      cx += (tx - cx) * 0.16; cy += (ty - cy) * 0.16;
      flo.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.5 ? requestAnimationFrame(loop) : 0;
    };
    var place = function (e, jump) {
      tx = e.clientX + 28; ty = e.clientY - flo.offsetHeight / 2;
      if (tx + flo.offsetWidth > window.innerWidth - 16) tx = e.clientX - flo.offsetWidth - 28;
      if (jump) { cx = tx; cy = ty; flo.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)'; }
      if (!raf) raf = requestAnimationFrame(loop);
    };
    idx.addEventListener('mousemove', function (e) { if (fineMQ.matches) place(e, !flo.classList.contains('on')); });
    $$('a', idx).forEach(function (a) {
      a.addEventListener('mouseenter', function (ev) {
        if (!fineMQ.matches) return;
        place(ev, !flo.classList.contains('on'));
        var k = a.getAttribute('data-k');
        var has = false;
        imgs.forEach(function (im) { var on = im.getAttribute('data-k') === k; im.classList.toggle('on', on); if (on) has = true; });
        flo.classList.toggle('on', has);
      });
    });
    idx.addEventListener('mouseleave', function () { flo.classList.remove('on'); });
  }

  /* Filters: catalogue and press */
  $$('[data-filter]').forEach(function (group) {
    var target = $(group.getAttribute('data-filter'));
    if (!target) return;
    var chips = $$('.chip', group);
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        chips.forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
        var f = c.getAttribute('data-f');
        $$('[data-f]', target).forEach(function (it) {
          var show = f === 'all' || (' ' + it.getAttribute('data-f') + ' ').indexOf(' ' + f + ' ') > -1;
          it.hidden = !show;
          if (show && !reduce) { it.classList.remove('in'); void it.offsetWidth; it.classList.add('in'); }
        });
      });
    });
  });

  /* Lightbox */
  var lb = $('#lb');
  if (lb) {
    var items = $$('[data-lb]'), cur = 0, box = $('.lb-img', lb), big = $('img', lb);
    var show = function (i) {
      cur = (i + items.length) % items.length;
      var it = items[cur];
      box.classList.remove('zoomed');
      var full = it.getAttribute('data-lb'), th = $('img', it);
      /* The thumbnail shows whether this browser took the WebP source; the full image follows it */
      if (th && /\.webp(\?|$)/.test(th.currentSrc)) full = full.replace(/\.jpg$/, '.webp');
      big.src = full; big.alt = it.getAttribute('data-lb-alt') || '';
      $('.mono', lb).textContent = it.getAttribute('data-lb-meta') || '';
      $('h3', lb).textContent = it.getAttribute('data-lb-title') || '';
      $('.lb-body', lb).textContent = it.getAttribute('data-lb-text') || '';
      $('.lb-src', lb).textContent = it.getAttribute('data-lb-src') ? 'Source: ' + it.getAttribute('data-lb-src') : '';
      var nav = $('.lb-nav', lb); nav.hidden = items.length < 2;
    };
    items.forEach(function (it, i) {
      it.addEventListener('click', function (e) { e.preventDefault(); show(i); if (lb.showModal) lb.showModal(); else lb.setAttribute('open', ''); });
    });
    box.addEventListener('click', function (e) {
      if (window.innerWidth < 760) return;
      var z = !box.classList.contains('zoomed');
      var r = big.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      box.classList.toggle('zoomed', z);
      if (z) { box.scrollLeft = fx * box.scrollWidth - box.clientWidth / 2; box.scrollTop = fy * box.scrollHeight - box.clientHeight / 2; }
    });
    $('[data-lb-prev]', lb).addEventListener('click', function () { show(cur - 1); });
    $('[data-lb-next]', lb).addEventListener('click', function () { show(cur + 1); });
    $('.x-btn', lb).addEventListener('click', function () { lb.close(); });
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
    lb.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') show(cur + 1); if (e.key === 'ArrowLeft') show(cur - 1); });
  }

  /* Reach map */
  var mapEl = $('#map');
  if (mapEl && window.TE_MAP) {
    var M = window.TE_MAP, NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + M.W + ' ' + M.H); svg.setAttribute('aria-hidden', 'true');
    var el = function (tag, at, parent) { var n = document.createElementNS(NS, tag); for (var k in at) n.setAttribute(k, at[k]); (parent || svg).appendChild(n); return n; };
    el('path', { d: M.land, 'class': 'land' });
    var cts = {}, arcs = {}, pts = {};
    Object.keys(M.countries).forEach(function (k) { if (M.countries[k]) cts[k] = el('path', { d: M.countries[k], 'class': 'ct' }); });
    var hub = M.points.kw;
    var labels = { kw: [0, -22, 'middle', 'Kuwait'], bh: [-14, -8, 'end', 'Bahrain'], qa: [14, 6, 'start', 'Qatar'], ae: [16, 12, 'start', 'UAE'], sa: [-6, 34, 'middle', 'Saudi Arabia'], om: [16, 10, 'start', 'Oman'], jo: [0, -20, 'middle', 'Jordan'], eg: [0, 34, 'middle', 'Egypt'] };
    Object.keys(M.points).forEach(function (k) {
      if (k === 'kw') return;
      var p = M.points[k], mx = (hub[0] + p[0]) / 2, my = (hub[1] + p[1]) / 2 - Math.max(30, Math.abs(hub[0] - p[0]) * .28);
      arcs[k] = el('path', { d: 'M' + hub[0] + ' ' + hub[1] + 'Q' + mx + ' ' + my + ' ' + p[0] + ' ' + p[1], 'class': 'arc' });
    });
    arcs.ca = el('path', { d: 'M' + hub[0] + ' ' + hub[1] + 'Q 300 -10 0 70', 'class': 'arc' });
    el('text', { x: 14, y: 52, 'class': 'lbl' }).textContent = '← Toronto, Canada';
    Object.keys(M.points).forEach(function (k) {
      var p = M.points[k];
      pts[k] = el('circle', { cx: p[0], cy: p[1], r: k === 'kw' ? 9 : 6.5, 'class': 'pt' + (k === 'kw' ? ' hub' : '') });
      var L = labels[k]; if (!L) return;
      el('text', { x: p[0] + L[0], y: p[1] + L[1], 'text-anchor': L[2], 'class': 'lbl' + (k === 'kw' ? ' hub-l' : '') }).textContent = L[3];
    });
    mapEl.appendChild(svg);
    var rows = $$('#places button');
    var pick = function (k) {
      [cts, arcs, pts].forEach(function (set) { Object.keys(set).forEach(function (c) { set[c].classList.toggle('on', c === k); }); });
      rows.forEach(function (r) { r.classList.toggle('on', r.getAttribute('data-k') === k); r.setAttribute('aria-pressed', r.getAttribute('data-k') === k ? 'true' : 'false'); });
    };
    rows.forEach(function (r) {
      ['mouseenter', 'focus', 'click'].forEach(function (ev) { r.addEventListener(ev, function () { pick(r.getAttribute('data-k')); }); });
    });
    Object.keys(pts).forEach(function (k) { pts[k].addEventListener('mouseenter', function () { pick(k); }); });
    pick('kw');
  }

  /* History: big sticky year follows the entry in view */
  var vt = $('.vt');
  if (vt) {
    var yb = $('.vt-year b', vt), bar = $('.vt-year .bar i', vt), list = $$('.vt-list li', vt);
    var setCur = function (li) {
      list.forEach(function (x) { x.classList.toggle('cur', x === li); });
      if (yb.textContent !== li.getAttribute('data-year')) yb.textContent = li.getAttribute('data-year');
    };
    var upd = function () {
      var mid = window.innerHeight * 0.42, best = list[0];
      list.forEach(function (li) { if (li.getBoundingClientRect().top < mid) best = li; });
      setCur(best);
      var r = $('.vt-list', vt).getBoundingClientRect();
      var p = Math.min(1, Math.max(0, (mid - r.top) / r.height));
      bar.style.width = (p * 100).toFixed(1) + '%';
    };
    window.addEventListener('scroll', function () { requestAnimationFrame(upd); }, { passive: true });
    upd();
  }

  /* Enquiry form */
  var form = $('form.enq');
  if (form) {
    var need = new URLSearchParams(location.search).get('need');
    if (need) $$('input[name="need"]', form).forEach(function (r) { if (r.value === need) r.checked = true; });

    var err = function (name, msg) {
      var box = form.querySelector('[data-err="' + name + '"]');
      if (box) { box.textContent = msg || ''; var w = box.closest('[data-field]'); if (w) w.classList.toggle('bad', !!msg); }
      var f = form.elements[name]; if (f && f.setAttribute) f.setAttribute('aria-invalid', msg ? 'true' : 'false');
    };
    var val = function (n) { var f = form.elements[n]; if (!f) return ''; if (f.length && f[0] && f[0].type === 'radio') { var c = $$('input[name="' + n + '"]', form).filter(function (r) { return r.checked; })[0]; return c ? c.value : ''; } return (f.value || '').trim(); };
    var validate = function () {
      var ok = true;
      var name = val('name'), email = val('email'), phone = val('phone').replace(/[\s().-]/g, '');
      var phoneOk = /^\+?\d{7,15}$/.test(phone);
      err('name', name ? '' : 'Please add your name.'); if (!name) ok = false;
      if (!email && !phone) { err('phone', 'Add a phone number or an email so we can reply.'); ok = false; }
      else err('phone', phone && !phoneOk ? 'Use digits, with the country code, for example +965 2222 3333.' : '');
      if (phone && !phoneOk) ok = false;
      err('email', email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? 'This email address looks incomplete.' : '');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) ok = false;
      return ok;
    };
    ['name', 'email', 'phone'].forEach(function (n) { var f = form.elements[n]; if (f) f.addEventListener('blur', function () { if (form.classList.contains('tried')) validate(); }); });
    var compose = function () {
      var lines = [
        ['Enquiry for', 'TopExpo Group'], ['Request', val('need')], ['Name', val('name')], ['Organisation', val('org')],
        ['Phone', val('phone')], ['Email', val('email')], ['City or country', val('city')], ['Approximate dates', val('dates')],
        ['Expected exhibitors', val('size')], ['About the event', val('msg')]
      ];
      return lines.filter(function (l) { return l[1]; }).map(function (l) { return l[0] + ': ' + l[1]; }).join('\n');
    };
    var done = $('[data-form-done]');
    var finish = function (title, text, body, showText) {
      $('.h3', done).textContent = title;
      $('[data-done-text]', done).textContent = text;
      var pre = $('pre', done); pre.textContent = body; pre.hidden = !showText;
      $('[data-done-copy]', done).hidden = !showText;
      form.hidden = true; done.hidden = false;
      done.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      form.classList.add('tried');
      if (!validate()) { var b = form.querySelector('.bad input, .bad select'); if (b) b.focus(); return; }
      var body = compose();
      var btn = form.querySelector('[type="submit"]');
      if (CFG.form_endpoint) {
        btn.disabled = true; btn.textContent = 'Sending…';
        var data = {}; $$('input, select, textarea', form).forEach(function (f) { if (!f.name || (f.type === 'radio' && !f.checked)) return; data[f.name] = f.value; });
        data._subject = 'Enquiry for TopExpo: ' + (val('need') || 'event'); data.message_text = body;
        fetch(CFG.form_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) })
          .then(function (r) { if (!r.ok) throw new Error(r.status); finish('Thank you, ' + val('name').split(' ')[0] + '.', 'Your enquiry is with our team.', body, false); })
          .catch(function () { btn.disabled = false; btn.textContent = 'Send enquiry'; finish('The form did not go through.', 'Copy the text below and send it to us by email.', body, true); });
        return;
      }
      if (C.email) { location.href = 'mailto:' + C.email + '?subject=' + encodeURIComponent('Enquiry for TopExpo') + '&body=' + encodeURIComponent(body); finish('Your email is ready.', 'Your mail app has opened with the enquiry. Press send there.', body, true); return; }
      if (CFG.prod) finish('Your enquiry is ready.', 'Copy the text below and send it to TopExpo.', body, true);
      else finish('Your enquiry is ready.', 'Preview build: contact details are not connected yet, so nothing has been sent. The text below is what TopExpo will receive.', body, true);
    });
    var again = $('[data-done-again]');
    if (again) again.addEventListener('click', function () { done.hidden = true; form.hidden = false; form.querySelector('input, select').focus(); });
    var dc = $('[data-done-copy]');
    if (dc) dc.addEventListener('click', function () { copyText($('pre', done).textContent, dc); });
  }

  /* Sources mode, for reviewing facts: open any page with ?sources */
  var wantReview = false;
  try {
    if (/[?&]sources\b/.test(location.search)) sessionStorage.setItem('te-sources', '1');
    wantReview = CFG.sources_mode && sessionStorage.getItem('te-sources') === '1';
  } catch (e) { wantReview = CFG.sources_mode && /[?&]sources\b/.test(location.search); }
  if (wantReview) {
    var facts = $$('[data-src]'), gaps = $$('.tbd');
    var barEl = document.createElement('div');
    barEl.className = 'kit-review';
    barEl.innerHTML = '<button type="button" class="kit-review-btn" aria-pressed="false"><span class="kit-dot" aria-hidden="true"></span>Sources</button>' +
      '<div class="kit-review-panel" hidden><p><b>Review mode</b></p><p><b>' + facts.length + '</b> facts on this page carry a source. Hover one to read it.</p><p><b>' + gaps.length + '</b> placeholders wait for approved content.</p>' +
      (gaps.length ? '<button type="button" class="kit-review-next">Go to next placeholder</button>' : '') + '</div>';
    document.body.appendChild(barEl);
    var rb = $('.kit-review-btn', barEl), panel = $('.kit-review-panel', barEl);
    var tip = document.createElement('div'); tip.className = 'kit-tip'; tip.hidden = true; document.body.appendChild(tip);
    rb.addEventListener('click', function () { var on = doc.classList.toggle('review'); rb.setAttribute('aria-pressed', on ? 'true' : 'false'); panel.hidden = !on; if (!on) tip.hidden = true; });
    var gi = 0, nx = $('.kit-review-next', barEl);
    if (nx) nx.addEventListener('click', function () { var g = gaps[gi % gaps.length]; gi++; g.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); g.classList.remove('kit-flash'); void g.offsetWidth; g.classList.add('kit-flash'); });
    facts.forEach(function (f) {
      f.addEventListener('mouseenter', function () {
        if (!doc.classList.contains('review')) return;
        tip.textContent = 'Source: ' + f.getAttribute('data-src'); tip.hidden = false;
        var r = f.getBoundingClientRect(), top = r.bottom + 8, left = Math.min(Math.max(12, r.left), window.innerWidth - tip.offsetWidth - 12);
        if (top + tip.offsetHeight > window.innerHeight - 12) top = r.top - tip.offsetHeight - 8;
        tip.style.top = top + 'px'; tip.style.left = left + 'px';
      });
      f.addEventListener('mouseleave', function () { tip.hidden = true; });
    });
    window.addEventListener('scroll', function () { tip.hidden = true; }, { passive: true });
  }
})();
