/* ==========================================================
   Purbeli Masu Ko Achar — main script
   1. Contact links (WhatsApp, call, social)
   2. Header + hamburger menu
   3. The floating jar: fills with ingredients, turns as you scroll
   ========================================================== */
(function () {
  "use strict";

  const S = window.SITE || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- 1. Contact links ---------- */
  const waUrl = "https://wa.me/" + S.phoneInternational + "?text=" + encodeURIComponent(S.whatsappMessage || "");
  const telUrl = "tel:+" + S.phoneInternational;

  $$("[data-wa]").forEach((a) => (a.href = waUrl));
  $$("[data-call]").forEach((a) => (a.href = telUrl));
  $$("[data-phone-text]").forEach((el) => (el.textContent = S.phoneDisplay));

  $$("[data-social]").forEach((a) => {
    const url = S.social && S.social[a.dataset.social];
    if (url) a.href = url;
    else a.hidden = true;
  });

  const yr = $("#year");
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- 2. Header + menu ---------- */
  const header = $(".site-header");
  const onScrollHeader = () => header.classList.toggle("solid", window.scrollY > 24);
  onScrollHeader();
  window.addEventListener("scroll", onScrollHeader, { passive: true });

  const btn = $("#menuBtn");
  const panel = $("#menuPanel");
  const backdrop = $("#menuBackdrop");

  function setMenu(open) {
    btn.setAttribute("aria-expanded", String(open));
    panel.setAttribute("aria-hidden", String(!open));
    panel.inert = !open;
    if (open) {
      backdrop.hidden = false;
      requestAnimationFrame(() => backdrop.classList.add("show"));
      panel.classList.add("open");
      document.body.classList.add("menu-open");
      document.body.style.overflow = "hidden";
      setTimeout(() => { const first = $("a", panel); if (first) first.focus({ preventScroll: true }); }, 60);
    } else {
      backdrop.classList.remove("show");
      panel.classList.remove("open");
      document.body.classList.remove("menu-open");
      document.body.style.overflow = "";
      setTimeout(() => { if (!panel.classList.contains("open")) backdrop.hidden = true; }, 350);
    }
  }
  btn.addEventListener("click", () => setMenu(btn.getAttribute("aria-expanded") !== "true"));
  backdrop.addEventListener("click", () => { setMenu(false); btn.focus(); });
  $$("a", panel).forEach((a) => a.addEventListener("click", () => setMenu(false)));

  document.addEventListener("keydown", (e) => {
    if (btn.getAttribute("aria-expanded") !== "true") return;
    if (e.key === "Escape") { setMenu(false); btn.focus(); return; }
    if (e.key === "Tab") {
      const f = $$("a, button", panel).concat([btn]).filter((el) => !el.hidden && el.offsetParent !== null);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // highlight the menu link of the section on screen
  const links = $$(".menu-links a");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#" + en.target.id));
        }
      });
    }, { rootMargin: "-45% 0px -45% 0px" });
    $$("main section[id]").forEach((s) => io.observe(s));
  }

  /* ---------- 3. The floating jar ---------- */
  const canvas = $("#jar");
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ASPECT = 845 / 560;            // jar height / width in the artwork
  const TAU = Math.PI * 2;

  const strip = new Image();
  strip.decoding = "async";
  strip.src = "images/jar-strip.webp";
  const mask = new Image();            // the jar's outline, which never changes as it turns
  mask.decoding = "async";
  mask.src = "images/jar-mask.webp";

  const jc = document.createElement("canvas");   // jar rendered at current rotation
  const jctx = jc.getContext("2d");

  let dpr = 1, vw = 0, vh = 0, mobile = false;
  let anchors = [], maxW = 300, cw = 0, ch = 0, headroom = 0;
  let orderBottom = 0;

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeInOut = (t) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOutBack = (t) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  function measure() {
    vw = window.innerWidth; vh = window.innerHeight;
    mobile = vw <= 860;
    dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2);
    const sx = window.scrollX, sy = window.scrollY;

    anchors = $$("[data-jar-anchor]").map((el) => {
      const r = el.getBoundingClientRect();
      const w = clamp(Math.min(r.width * (mobile ? 0.56 : 0.66), (r.height * 0.8) / ASPECT), 140, 430);
      return { x: r.left + sx + r.width / 2, y: r.top + sy + r.height / 2, w };
    });
    maxW = Math.max.apply(null, anchors.map((a) => a.w).concat([150]));
    const order = $("#order");
    orderBottom = order ? order.getBoundingClientRect().bottom + sy : 1e9;

    cw = Math.round(maxW * 2.2);
    headroom = Math.round(maxW * ASPECT * 0.42);
    ch = Math.round(headroom + maxW * ASPECT + maxW * ASPECT * 0.16);
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }

  /* --- ingredient sprites, drawn with plain canvas paths --- */
  const KINDS = ["meat", "meat", "meat", "chilli", "chilli", "chilli", "garlic", "garlic", "ginger", "ginger", "leaf", "masala", "masala", "cinnamon"];

  function drawIngredient(c, p) {
    const s = p.s;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.rot);
    switch (p.kind) {
      case "chilli":
        c.fillStyle = "#d71f27";
        c.beginPath();
        c.moveTo(-s * .18, -s * .9);
        c.bezierCurveTo(s * .55, -s * .5, s * .5, s * .45, -s * .12, s * 1.05);
        c.bezierCurveTo(-s * .2, s * .3, -s * .55, -s * .4, -s * .18, -s * .9);
        c.fill();
        c.fillStyle = "#2f7d32";
        c.fillRect(-s * .3, -s * 1.05, s * .26, s * .3);
        c.fillStyle = "rgba(255,255,255,.28)";
        c.beginPath(); c.ellipse(-s * .12, -s * .2, s * .06, s * .4, .1, 0, TAU); c.fill();
        break;
      case "garlic":
        c.fillStyle = "#f7ecd3"; c.strokeStyle = "#d3bd90"; c.lineWidth = Math.max(1, s * .06);
        c.beginPath();
        c.moveTo(0, -s * .95);
        c.bezierCurveTo(s * .25, -s * .5, s * .75, -s * .2, s * .6, s * .35);
        c.bezierCurveTo(s * .5, s * .8, -s * .5, s * .8, -s * .6, s * .35);
        c.bezierCurveTo(-s * .75, -s * .2, -s * .25, -s * .5, 0, -s * .95);
        c.fill(); c.stroke();
        c.beginPath(); c.moveTo(0, -s * .7); c.quadraticCurveTo(s * .12, 0, 0, s * .7); c.stroke();
        break;
      case "ginger":
        c.fillStyle = "#c9985a";
        [[-.45, .1, .42], [0, -.1, .5], [.45, .15, .4], [.1, .4, .35]].forEach((b) => {
          c.beginPath(); c.arc(b[0] * s, b[1] * s, b[2] * s, 0, TAU); c.fill();
        });
        c.fillStyle = "rgba(255,240,200,.35)";
        c.beginPath(); c.arc(-.05 * s, -.2 * s, .18 * s, 0, TAU); c.fill();
        break;
      case "leaf":
        c.fillStyle = "#3f9440";
        c.beginPath(); c.ellipse(-s * .25, 0, s * .55, s * .25, -.5, 0, TAU); c.fill();
        c.beginPath(); c.ellipse(s * .28, -s * .05, s * .5, s * .22, .6, 0, TAU); c.fill();
        break;
      case "cinnamon":
        c.fillStyle = "#a45a28";
        c.beginPath();
        if (c.roundRect) c.roundRect(-s * .85, -s * .2, s * 1.7, s * .4, s * .2); else c.rect(-s * .85, -s * .2, s * 1.7, s * .4);
        c.fill();
        c.strokeStyle = "#6d3515"; c.lineWidth = Math.max(1, s * .06);
        c.beginPath(); c.moveTo(-s * .7, 0); c.lineTo(s * .7, 0); c.stroke();
        break;
      case "masala":
        [["#f5b82e", -.3, -.1], ["#e24a14", .25, -.2], ["#a02510", .05, .3], ["#f5b82e", .4, .25]].forEach((d) => {
          c.fillStyle = d[0]; c.beginPath(); c.arc(d[1] * s, d[2] * s, s * .22, 0, TAU); c.fill();
        });
        break;
      default: // meat
        c.fillStyle = "#7d3517";
        c.beginPath();
        c.moveTo(-s * .8, -s * .1);
        c.bezierCurveTo(-s * .7, -s * .8, s * .3, -s * .9, s * .75, -s * .2);
        c.bezierCurveTo(s * 1, s * .4, s * .2, s * .85, -s * .4, s * .7);
        c.bezierCurveTo(-s * .85, s * .55, -s * .9, s * .2, -s * .8, -s * .1);
        c.fill();
        c.fillStyle = "rgba(255,190,130,.3)";
        c.beginPath(); c.ellipse(-s * .15, -s * .3, s * .3, s * .14, -.3, 0, TAU); c.fill();
    }
    c.restore();
  }

  /* --- fill sequence state --- */
  const FILL = { start: -1, particles: [], lastSpawn: 0, bump: 0, level: reduce ? 1 : 0, lid: reduce ? 0 : 1, running: false };
  const T_OPEN = 0.5, T_FILL0 = 0.4, T_FILL1 = 4.6, T_CLOSE0 = 4.6, T_CLOSE1 = 5.3;

  function startFill(now) {
    if (reduce) return;
    FILL.start = now; FILL.particles.length = 0; FILL.running = true; FILL.lastSpawn = 0; FILL.bump = 0;
  }

  function updateFill(now, dt, jw, jh) {
    if (reduce || FILL.start < 0) return;
    const t = now - FILL.start;
    if (t < 0) return;
    // lid: opens at the start, closes with a small bounce at the end
    if (t < T_OPEN) FILL.lid = easeInOut(t / T_OPEN);
    else if (t < T_CLOSE0) FILL.lid = 1;
    else if (t < T_CLOSE1) FILL.lid = 1 - easeOutBack((t - T_CLOSE0) / (T_CLOSE1 - T_CLOSE0));
    else { FILL.lid = 0; FILL.running = false; }
    FILL.level = easeInOut(clamp((t - T_FILL0) / (T_FILL1 - T_FILL0), 0, 1));
    if (!FILL.running && FILL.level >= 1 && !FILL.particles.length) { FILL.start = -1; FILL.level = 1; FILL.lid = 0; return; }

    // spawn ingredients above the open jar
    if (t > T_FILL0 && t < T_FILL1 - 0.3) {
      const every = 0.055;
      if (!FILL.lastSpawn) FILL.lastSpawn = now;
      while (now - FILL.lastSpawn > every) {
        FILL.lastSpawn += every;
        const k = KINDS[(Math.random() * KINDS.length) | 0];
        FILL.particles.push({
          kind: k, s: jw * (0.05 + Math.random() * 0.045),
          x: (Math.random() - .5) * jw * .5, y: -jh * (.62 + Math.random() * .35),
          vx: (Math.random() - .5) * jw * .06, vy: jh * (.25 + Math.random() * .25),
          rot: Math.random() * TAU, vr: (Math.random() - .5) * 6
        });
      }
    }
    const surfaceY = jh * lerp(0.93, 0.2, FILL.level) - jh / 2;
    const g = jh * 1.5;
    FILL.particles = FILL.particles.filter((p) => {
      p.vy += g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      p.x = clamp(p.x, -jw * .3, jw * .3);       // funnel into the jar neck
      if (p.y > surfaceY && p.y > -jh * .32) { FILL.bump = Math.min(FILL.bump + 0.35, 1); return false; }
      return p.y < jh;
    });
    FILL.bump *= Math.pow(0.02, dt);
  }

  /* --- jar rendering at a given rotation --- */
  function renderJar(jcw, jch, phi) {
    const SW = strip.naturalWidth, SH = strip.naturalHeight, k = SW / TAU;
    jctx.clearRect(0, 0, jcw, jch);
    for (let dx = 0; dx < jcw; dx++) {
      const sx = ((dx + 0.5) / jcw) * 2 - 1;
      const a = Math.asin(sx);
      const t = a + phi;
      const u = ((((t + Math.PI) / TAU) % 1) + 1) % 1 * SW;
      const da = (2 / jcw) / Math.sqrt(Math.max(1 - sx * sx, 0.0025));
      const w = clamp(da * k, 1, 40);
      const x0 = clamp(u - w / 2, 0, SW - w);
      jctx.drawImage(strip, x0, 0, w, SH, dx, 0, 1, jch);
    }
    // round the glass: dark at the sides, one fixed highlight
    jctx.globalCompositeOperation = "source-atop";
    let g = jctx.createLinearGradient(0, 0, jcw, 0);
    g.addColorStop(0, "rgba(30,0,0,.55)"); g.addColorStop(.2, "rgba(30,0,0,0)");
    g.addColorStop(.78, "rgba(30,0,0,0)"); g.addColorStop(1, "rgba(30,0,0,.6)");
    jctx.fillStyle = g; jctx.fillRect(0, 0, jcw, jch);
    g = jctx.createLinearGradient(jcw * .22, 0, jcw * .40, 0);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(.5, "rgba(255,255,255,.2)"); g.addColorStop(1, "rgba(255,255,255,0)");
    jctx.fillStyle = g; jctx.fillRect(0, 0, jcw, jch);
    // cut to the jar's outline
    jctx.globalCompositeOperation = "destination-in";
    jctx.drawImage(mask, 0, 0, jcw, jch);
    jctx.globalCompositeOperation = "source-over";
  }

  /* --- scroll-linked position, size and spin --- */
  const J = { x: 0, y: 0, w: 200, o: 0, phi: 0, init: false, rect: { x: 0, y: 0, w: 0, h: 0 } };

  function target(scrollY) {
    if (!anchors.length) return null;
    const mid = scrollY + vh / 2;
    let i = 0;
    for (let n = 0; n < anchors.length; n++) if (anchors[n].y <= mid) i = n;
    const a = anchors[i], b = anchors[Math.min(i + 1, anchors.length - 1)];
    let e = 0;
    if (b !== a) e = mobile ? smooth(0.3, 0.7, (mid - a.y) / (b.y - a.y)) : smooth(0.25, 0.75, (mid - a.y) / (b.y - a.y));
    const x = lerp(a.x, b.x, e), docY = lerp(a.y, b.y, e), w = lerp(a.w, b.w, e);
    let y, o = 1;
    if (mobile) { y = docY - scrollY; o = 1 - 4 * e * (1 - e); }
    else { y = vh / 2 + (docY - scrollY - vh / 2) * 0.22; }
    o *= clamp((orderBottom - (scrollY + vh * 0.5)) / (vh * 0.35), 0, 1);
    return { x: x - window.scrollX, y, w, o };
  }

  let last = performance.now() / 1000;
  let started = false;

  function frame(ts) {
    requestAnimationFrame(frame);
    const now = ts / 1000;
    const dt = Math.min(now - last, 0.05); last = now;
    if (!strip.complete || !strip.naturalWidth || !mask.complete || !mask.naturalWidth) return;
    if (!started) { started = true; startFill(now + 0.3); }

    const sy = window.scrollY;
    const tg = target(sy);
    if (!tg) return;
    if (!J.init) { Object.assign(J, { x: tg.x, y: tg.y, w: tg.w, o: 0, init: true }); }
    const k = 1 - Math.pow(0.0005, dt);   // smoothing factor
    J.x = lerp(J.x, tg.x, mobile ? 1 : k);
    J.y = lerp(J.y, tg.y, mobile ? 1 : Math.min(k * 1.2, 1));
    J.w = lerp(J.w, tg.w, k);
    J.o = lerp(J.o, tg.o, Math.min(k * 1.5, 1));

    // spin: scroll turns the jar, plus a slow idle turn
    const phiT = reduce ? 0 : sy * 0.0052 + now * 0.42;
    J.phi = lerp(J.phi, phiT, 1 - Math.pow(0.001, dt));

    const jw = J.w, jh = jw * ASPECT;
    const visible = J.o > 0.01 && J.y + jh > -200 && J.y - jh < vh + 200;
    canvas.style.opacity = J.o.toFixed(3);
    if (!visible) { canvas.style.visibility = "hidden"; return; }
    canvas.style.visibility = "visible";

    const cyc = headroom + maxW * ASPECT / 2;                   // jar centre inside canvas
    canvas.style.transform = "translate3d(" + (J.x - cw / 2).toFixed(1) + "px," + (J.y - cyc).toFixed(1) + "px,0)";
    J.rect = { x: J.x - jw / 2, y: J.y - jh / 2, w: jw, h: jh };

    // offscreen jar at the right resolution
    const jcw = Math.max(16, Math.ceil((jw * dpr) / 16) * 16), jch = Math.round(jcw * ASPECT);
    if (jc.width !== jcw) { jc.width = jcw; jc.height = jch; }
    renderJar(jcw, jch, J.phi);

    updateFill(now, dt, jw, jh);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    const fy = reduce ? 0 : Math.sin(now * 1.3) * jh * 0.016;
    const tilt = reduce ? 0 : Math.sin(now * 0.9) * 0.028;

    // shadow on the "floor" under the jar
    const sh = ctx.createRadialGradient(cw / 2, cyc + jh / 2 + jh * 0.06, 2, cw / 2, cyc + jh / 2 + jh * 0.06, jw * 0.55);
    const sa = 0.38 - fy / jh * 4;
    sh.addColorStop(0, "rgba(30,0,4," + sa.toFixed(3) + ")"); sh.addColorStop(1, "rgba(30,0,4,0)");
    ctx.save(); ctx.translate(cw / 2, 0); ctx.scale(1, 0.22); ctx.translate(-cw / 2, (cyc + jh / 2 + jh * 0.06) * (1 / 0.22 - 1));
    ctx.fillStyle = sh; ctx.fillRect(0, 0, cw, ch / 0.22); ctx.restore();

    ctx.save();
    ctx.translate(cw / 2, cyc + fy);
    ctx.rotate(tilt);

    const L = -jw / 2, T = -jh / 2;
    const lidH = jh * 0.19, labelTop = jh * 0.40, labelBot = jh * 0.815;
    const full = FILL.level >= 0.999;

    // 1. empty glass
    if (!full) { ctx.globalAlpha = 0.17; ctx.drawImage(jc, L, T, jw, jh); ctx.globalAlpha = 1; }

    // 2. ingredients falling in (behind the label, in front of the glass)
    FILL.particles.forEach((p) => drawIngredient(ctx, p));

    // 3. the filled part of the jar, with a moving surface
    if (full) ctx.drawImage(jc, L, T, jw, jh);
    else if (FILL.level > 0.001) {
      const surf = T + jh * lerp(0.93, 0.2, FILL.level);
      const amp = jh * 0.006 * (0.4 + FILL.bump * 2);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(L, surf);
      for (let x = 0; x <= jw; x += 6) ctx.lineTo(L + x, surf + Math.sin(x * 0.07 + now * 4) * amp);
      ctx.lineTo(L + jw, T + jh); ctx.lineTo(L, T + jh); ctx.closePath();
      ctx.clip();
      ctx.drawImage(jc, L, T, jw, jh);
      ctx.restore();
    }

    // 4. the label always stays on the jar
    if (!full) {
      ctx.save(); ctx.beginPath(); ctx.rect(L, T + labelTop, jw, labelBot - labelTop); ctx.clip();
      ctx.drawImage(jc, L, T, jw, jh); ctx.restore();
    }

    // 5. the lid: swings away while the jar fills, then snaps back on
    ctx.save();
    const lc = T + lidH / 2, lo = FILL.lid;
    ctx.translate(-lo * jw * 0.55, -lo * jh * 0.3);
    ctx.translate(0, lc); ctx.rotate(-lo * 0.55); ctx.translate(0, -lc);
    ctx.beginPath(); ctx.rect(L - 4, T - 4, jw + 8, lidH + 4); ctx.clip();
    ctx.drawImage(jc, L, T, jw, jh);
    ctx.restore();

    ctx.restore();
  }

  // tap or click the jar to fill it again
  document.addEventListener("click", (e) => {
    if (e.target.closest("a, button, nav")) return;
    const r = J.rect;
    if (!r.w || J.o < 0.5) return;
    if (e.clientX > r.x && e.clientX < r.x + r.w && e.clientY > r.y && e.clientY < r.y + r.h) {
      if (!FILL.running && FILL.start < 0) startFill(performance.now() / 1000);
    }
  });

  // fill again the first time the "What goes in the jar" section is reached
  const ing = $("#ingredients");
  if (ing && "IntersectionObserver" in window) {
    const io2 = new IntersectionObserver((entries, obs) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          obs.disconnect();
          setTimeout(() => { if (!FILL.running && FILL.start < 0) startFill(performance.now() / 1000); }, 500);
        }
      });
    }, { threshold: 0.6 });
    io2.observe(ing);
  }

  let rz;
  const remeasure = () => { clearTimeout(rz); rz = setTimeout(measure, 120); };
  window.addEventListener("resize", remeasure);
  window.addEventListener("load", () => { measure(); setTimeout(measure, 400); });
  if ("ResizeObserver" in window) new ResizeObserver(remeasure).observe(document.body);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  measure();
  requestAnimationFrame((ts) => { last = ts / 1000; frame(ts); });
})();
