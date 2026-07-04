const revealables = Array.from(document.querySelectorAll(".section, .proof-strip, .footer, .metric"));

for (const node of revealables) {
  node.setAttribute("data-reveal", "");
}

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }
}, { threshold: 0.14 });

revealables.forEach((node) => observer.observe(node));

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

async function renderMilestones() {
  const target = document.getElementById("milestones-list");
  if (!target) return;

  try {
    const milestones = await loadJSON("./data/milestones.json");
    target.innerHTML = milestones.map((item) => `
      <article class="timeline-entry">
        <small>${item.date}</small>
        <h3>${item.title}</h3>
        <p>${item.summary}</p>
        <span class="evidence">${item.evidence}</span>
      </article>
    `).join("");
  } catch (error) {
    target.innerHTML = `<article class="timeline-entry"><h3>时间线加载失败</h3><p>${error.message}</p></article>`;
  }
}

async function renderBuildLedger() {
  const target = document.getElementById("build-ledger-list");
  if (!target) return;

  try {
    const payload = await loadJSON("./data/build-ledger.json");
    const entries = payload.entries || [];
    target.innerHTML = entries.map((item) => `
      <article class="ledger-entry">
        <div>
          <small>${formatDate(item.ts)}</small>
          <strong>${item.message}</strong>
        </div>
        <div class="meta">
          <span class="ledger-chip">${item.type}</span>
          <span class="ledger-chip">#${item.hash}</span>
          <span class="ledger-chip">${item.files_changed} files</span>
        </div>
      </article>
    `).join("");
  } catch (error) {
    target.innerHTML = `<article class="ledger-entry"><strong>构建账本加载失败</strong><small>${error.message}</small></article>`;
  }
}

async function renderReleaseNotes() {
  const target = document.getElementById("release-note-list");
  if (!target) return;

  try {
    const notes = await loadJSON("./data/release-notes.json");
    target.innerHTML = notes.map((item) => `
      <article class="release-note">
        <div class="release-note-head">
          <strong>${item.label}</strong>
          <span class="release-status">${item.status}</span>
        </div>
        <ul>
          ${(item.notes || []).map((note) => `<li>${note}</li>`).join("")}
        </ul>
      </article>
    `).join("");
  } catch (error) {
    target.innerHTML = `<article class="release-note"><strong>发布说明加载失败</strong><p>${error.message}</p></article>`;
  }
}

renderMilestones();
renderBuildLedger();
renderReleaseNotes();

function loadMatter() {
  if (window.Matter) return Promise.resolve(window.Matter);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => window.Matter ? resolve(window.Matter) : reject(new Error("matter-js missing"));
    script.onerror = () => reject(new Error("matter-js load failed"));
    document.head.appendChild(script);
  });
}

function bootGravityBoard(Matter, stage, cards) {
  const { Engine, Runner, World, Bodies, Body, Mouse, MouseConstraint, Events } = Matter;

  const cs = getComputedStyle(stage);
  const pl = parseFloat(cs.paddingLeft) || 0;
  const pr = parseFloat(cs.paddingRight) || 0;
  const pt = parseFloat(cs.paddingTop) || 0;
  const pb = parseFloat(cs.paddingBottom) || 0;

  const baseHeight = Math.max(760, stage.clientHeight || 0);
  stage.style.height = baseHeight + "px";
  stage.classList.add("is-enhanced");

  const innerW = stage.clientWidth - pl - pr;
  const innerH = baseHeight - pt - pb;

  for (const leftover of stage.querySelectorAll('[data-gravity-basket], [data-gravity-water], .gravity-fish')) {
    leftover.remove();
  }

  for (const card of cards) {
    const w = Number(card.dataset.cardWidth) || 180;
    card.style.left = "0";
    card.style.top = "0";
    card.style.width = w + "px";
    card.style.willChange = "transform";
  }
  void stage.offsetHeight;

  const baseGravityY = 0.82;
  const engine = Engine.create({ gravity: { x: 0, y: baseGravityY } });
  const world = engine.world;

  const wallT = 400;
  World.add(world, [
    Bodies.rectangle(innerW / 2, -wallT / 2, innerW + wallT * 2, wallT, { isStatic: true }),
    Bodies.rectangle(innerW / 2, innerH + wallT / 2, innerW + wallT * 2, wallT,
      { isStatic: true, friction: 0.4, restitution: 0.2 }),
    Bodies.rectangle(-wallT / 2, innerH / 2, wallT, innerH + wallT * 2, { isStatic: true }),
    Bodies.rectangle(innerW + wallT / 2, innerH / 2, wallT, innerH + wallT * 2, { isStatic: true }),
  ]);

  const items = cards.map((card, idx) => {
    const rect = card.getBoundingClientRect();
    const w = rect.width || Number(card.dataset.cardWidth) || 180;
    const h = rect.height || Number(card.dataset.cardHeight) || 60;

    const sxPct = Number(card.dataset.startX);
    const syPct = Number(card.dataset.startY);
    const sx = Number.isFinite(sxPct) ? (sxPct / 100) * innerW + w / 2 : 60 + idx * 70;
    const sy = Number.isFinite(syPct) ? (syPct / 100) * innerH + h / 2 : 60;
    const cx = Math.min(Math.max(sx, w / 2 + 6), innerW - w / 2 - 6);
    const cy = Math.min(Math.max(sy, h / 2 + 6), innerH - h / 2 - 6);
    const angle = (Number(card.dataset.angle) || 0) * Math.PI / 180;
    const density = Number(card.dataset.density) || 0.01;

    const body = Bodies.rectangle(cx, cy, w, h, {
      restitution: 0.5,
      friction: 0.1,
      frictionAir: 0.028,
      density,
      angle,
      chamfer: { radius: 12 },
    });
    World.add(world, body);
    return { card, body, w, h };
  });

  const mouse = Mouse.create(stage);
  Mouse.setOffset(mouse, { x: -pl, y: -pt });
  if (mouse.mousewheel) {
    stage.removeEventListener("wheel", mouse.mousewheel);
    stage.removeEventListener("mousewheel", mouse.mousewheel);
    stage.removeEventListener("DOMMouseScroll", mouse.mousewheel);
  }

  const mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: { stiffness: 0.2, damping: 0.08, render: { visible: false } },
  });
  World.add(world, mouseConstraint);

  Events.on(mouseConstraint, "startdrag", (evt) => {
    const hit = items.find((i) => i.body === evt.body);
    if (hit) hit.card.classList.add("is-dragging");
  });
  Events.on(mouseConstraint, "enddrag", (evt) => {
    const hit = items.find((i) => i.body === evt.body);
    if (hit) hit.card.classList.remove("is-dragging");
  });

  const runner = Runner.create();
  Runner.run(runner, engine);

  const sync = () => {
    for (const { card, body, w, h } of items) {
      const x = body.position.x - w / 2;
      const y = body.position.y - h / 2;
      card.style.transform = `translate(${x}px, ${y}px) rotate(${body.angle}rad)`;
    }
    requestAnimationFrame(sync);
  };
  requestAnimationFrame(sync);

  let isRunning = true;
  const visObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        Runner.start(runner, engine);
        isRunning = true;
      } else {
        Runner.stop(runner);
        isRunning = false;
      }
    }
  }, { threshold: 0 });
  visObserver.observe(stage);

  let scrollAccel = 0;
  let lastScrollY = window.scrollY;
  window.addEventListener("scroll", () => {
    const dy = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    scrollAccel += dy;
  }, { passive: true });

  Events.on(engine, "beforeUpdate", () => {
    if (!isRunning) {
      scrollAccel = 0;
      engine.gravity.y = baseGravityY;
      return;
    }
    const boost = Math.max(-1.6, Math.min(1.6, scrollAccel * 0.04));
    engine.gravity.y = baseGravityY + boost;
    if (Math.abs(scrollAccel) > 4) {
      const jitter = scrollAccel * 0.0005;
      for (const { body } of items) {
        Body.applyForce(body, body.position, {
          x: (Math.random() - 0.5) * Math.abs(jitter),
          y: 0,
        });
      }
    }
    scrollAccel *= 0.78;
  });
}

function initGravityBoard() {
  const stage = document.querySelector("[data-gravity-board]");
  if (!stage) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || window.innerWidth < 720) return;

  const cards = Array.from(stage.querySelectorAll(".gravity-card"));
  if (cards.length === 0) return;

  const startObserver = new IntersectionObserver((entries, obs) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      obs.disconnect();
      loadMatter()
        .then((Matter) => bootGravityBoard(Matter, stage, cards))
        .catch((err) => console.warn("gravity board disabled:", err));
    }
  }, { threshold: 0.1 });
  startObserver.observe(stage);
}

initGravityBoard();
