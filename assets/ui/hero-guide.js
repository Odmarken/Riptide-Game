/* First steps for a newly created hero. The game owns pausing and save state;
   this view owns only its modal, focus and the live AUTO button callout. */
(function (root) {
 'use strict';
 let overlay = null, readyCallback = null, previousFocus = null, observer = null, layoutFrame = 0;
 let inertNodes = [], settleUntil = 0;
 const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
 const icon = path => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
 const icons = {
  auto: icon('M12 3a9 9 0 1 1-7.8 4.5M3 3v5h5M10 8l6 4-6 4z'),
  map: icon('m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16'),
  controls: icon('M4 5h16v14H4zM8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01M8 16h8'),
  shop: icon('M4 9h16l-2-5H6zM5 9v11h14V9M9 20v-7h6v7')
 };

 function createView() {
  const element = document.createElement('div');
  element.id = 'heroGuide';
  element.innerHTML = `
   <svg class="hero-guide-callout" aria-hidden="true">
    <defs><marker id="heroGuideArrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M1 1 6 4 1 7"/></marker></defs>
    <path class="hero-guide-shade" fill-rule="evenodd"/>
    <rect class="hero-guide-highlight" rx="12"/>
    <path class="hero-guide-arrow" marker-end="url(#heroGuideArrowhead)"/>
   </svg>
   <section class="hero-guide-card" role="dialog" aria-modal="true" aria-labelledby="heroGuideTitle" aria-describedby="heroGuideIntro">
    <header class="hero-guide-heading">
     <span class="hero-guide-crest" aria-hidden="true">${icons.map}</span>
     <div><div class="hero-guide-eyebrow">YOUR ADVENTURE BEGINS</div><h1 id="heroGuideTitle">Welcome to Riptide</h1></div>
     <span class="hero-guide-paused"><i aria-hidden="true"></i>Paused</span>
    </header>
    <p id="heroGuideIntro">Take a moment to get your bearings. Your hero will wait until you are ready.</p>
    <div class="hero-guide-content" tabindex="0" aria-label="Getting started tips">
     <div class="hero-guide-grid">
      <section class="hero-guide-tip hero-guide-auto">
       <h2><span class="hero-guide-icon">${icons.auto}</span>Auto play</h2>
       <p><strong>AUTO starts on.</strong> Your hero finds enemies, walks and fights, and uses enabled spells and potions. Press the highlighted <strong>AUTO</strong> button to switch it off and play manually.</p>
       <span class="hero-guide-small">Dungeon and raid fights are manual. Odin and Thor still allow AUTO.</span>
      </section>
      <section class="hero-guide-tip">
       <h2><span class="hero-guide-icon">${icons.map}</span>Explore &amp; level up</h2>
       <p>Gain up to <strong>5 levels per zone</strong>. Finish its quests or boss and meet the next zone's level requirement, then use <strong>Continue</strong> or the portal to move on.</p>
       <span class="hero-guide-small">The quest bar shows your current objective and progress.</span>
      </section>
      <section class="hero-guide-tip">
       <h2><span class="hero-guide-icon">${icons.controls}</span>Basic controls</h2>
       <dl class="hero-guide-controls">
        <div><dt><kbd>WASD</kbd> / <kbd>Arrows</kbd></dt><dd>Move, or click the ground</dd></div>
        <div><dt><kbd>Click a foe</kbd></dt><dd>Attack that enemy</dd></div>
        <div><dt><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></dt><dd>Use your spells</dd></div>
        <div><dt><kbd>4</kbd> / <kbd>5</kbd></dt><dd>Health / mana potion</dd></div>
        <div><dt><kbd>B</kbd> / <kbd>Esc</kbd></dt><dd>Side panel / settings</dd></div>
       </dl>
      </section>
      <section class="hero-guide-tip">
       <h2><span class="hero-guide-icon">${icons.shop}</span>Gear &amp; supplies</h2>
       <p>Open <strong>Shop</strong> to spend gold on potions, upgrades and chests. Open <strong>Bag</strong> to inspect and equip the gear you find.</p>
       <span class="hero-guide-small">Keep health and mana potions stocked as enemies grow stronger.</span>
      </section>
     </div>
    </div>
    <footer class="hero-guide-footer"><span>Resume when you are ready.</span><button type="button" id="heroGuideReady">Okej, ready <span aria-hidden="true">→</span></button></footer>
   </section>`;
  return element;
 }

 function layout() {
  layoutFrame = 0;
  if (!overlay) return;
  const width = document.documentElement.clientWidth || root.innerWidth;
  const height = root.innerHeight;
  const margin = width < 600 ? 12 : 24;
  const target = document.getElementById('autoBtn');
  const targetRect = target?.getBoundingClientRect();
  const visible = !!(targetRect?.width && targetRect?.height && targetRect.bottom > 0 && targetRect.top < height && targetRect.right > 0 && targetRect.left < width && !target.hidden && getComputedStyle(target).visibility !== 'hidden');
  const card = overlay.querySelector('.hero-guide-card');
  const field = document.getElementById('stageWrap')?.getBoundingClientRect();
  const fieldWide = field?.width >= 820;
  const cardWidth = Math.min(760, width - margin * 2);
  const centerX = fieldWide ? field.left + field.width / 2 : width / 2;
  const left = clamp(centerX - cardWidth / 2, margin, width - cardWidth - margin);
  // Keep the real AUTO control visible below the guide, even on short screens.
  // If a custom HUD places it high up, use the larger region below it instead.
  let safeTop = margin, safeBottom = height - margin;
  if (visible) {
   const above = targetRect.top - 42, below = height - targetRect.bottom - 42;
   if (above >= below) safeBottom = Math.max(margin + 120, above);
   else safeTop = Math.min(height - margin - 120, targetRect.bottom + 42);
  }
  card.style.width = `${cardWidth}px`;
  card.style.maxHeight = `${Math.max(120, safeBottom - safeTop)}px`;
  card.style.left = `${left}px`;
  card.style.top = `${safeTop}px`;
  const cardHeight = card.getBoundingClientRect().height;
  card.style.top = `${safeTop + Math.max(0, (safeBottom - safeTop - cardHeight) / 2)}px`;
  const svg = overlay.querySelector('.hero-guide-callout');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const shade = overlay.querySelector('.hero-guide-shade');
  const highlight = overlay.querySelector('.hero-guide-highlight');
  const arrow = overlay.querySelector('.hero-guide-arrow');
  let shadePath = `M0 0H${width}V${height}H0Z`;
  highlight.style.display = arrow.style.display = visible ? '' : 'none';
  if (visible) {
   const x = targetRect.left - 5, y = targetRect.top - 5, w = targetRect.width + 10, h = targetRect.height + 10;
   shadePath += `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
   for (const [name, value] of Object.entries({x, y, width:w, height:h})) highlight.setAttribute(name, value);
   const r = card.getBoundingClientRect();
   const targetX = targetRect.left + targetRect.width / 2;
   const belowCard = targetRect.top >= r.bottom;
   const startX = clamp(targetX, r.left + 26, r.right - 26);
   const startY = belowCard ? r.bottom + 5 : r.top - 5;
   const endY = belowCard ? y - 8 : y + h + 8;
   const midY = (startY + endY) / 2;
   arrow.setAttribute('d', `M${startX} ${startY}C${startX} ${midY} ${targetX} ${midY} ${targetX} ${endY}`);
  }
  shade.setAttribute('d', shadePath);
  if (performance.now() < settleUntil) layoutFrame = requestAnimationFrame(layout);
 }

 function scheduleLayout() {
  // Follow the desktop side panel's 250 ms grid transition, including changes
  // in the target's position that do not resize the target itself.
  settleUntil = performance.now() + 400;
  if (!layoutFrame && overlay) layoutFrame = requestAnimationFrame(layout);
 }

 function trapKeys(event) {
  event.stopPropagation();
  if (event.key === 'Escape') { event.preventDefault(); return; }
  if (event.key !== 'Tab') return;
  const focusable = [...overlay.querySelectorAll('button, [tabindex="0"]')];
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
   event.preventDefault(); last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) {
   event.preventDefault(); first.focus();
  }
 }

 function keepFocus(event) {
  if (overlay && !overlay.contains(event.target)) overlay.querySelector('#heroGuideReady').focus({preventScroll:true});
 }

 function close() {
  if (!overlay) return false;
  const old = overlay;
  overlay = null;
  readyCallback = null;
  observer?.disconnect(); observer = null;
  if (layoutFrame) cancelAnimationFrame(layoutFrame);
  layoutFrame = 0;
  settleUntil = 0;
  root.removeEventListener('resize', scheduleLayout);
  root.removeEventListener('scroll', scheduleLayout, true);
  root.visualViewport?.removeEventListener('resize', scheduleLayout);
  document.removeEventListener('focusin', keepFocus, true);
  old.remove();
  for (const [node, wasInert] of inertNodes) node.inert = wasInert;
  inertNodes = [];
  if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus({preventScroll:true});
  previousFocus = null;
  return true;
 }

 function open(options = {}) {
  if (overlay) return false;
  previousFocus = document.activeElement;
  readyCallback = typeof options.onReady === 'function' ? options.onReady : null;
  overlay = createView();
  document.body.appendChild(overlay);
  inertNodes = [...document.body.children].filter(node => node !== overlay && !/^(SCRIPT|STYLE|LINK)$/.test(node.tagName)).map(node => [node, !!node.inert]);
  for (const [node] of inertNodes) node.inert = true;
  overlay.addEventListener('keydown', trapKeys);
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'keyup']) overlay.addEventListener(type, event => event.stopPropagation());
  overlay.querySelector('#heroGuideReady').addEventListener('click', event => {
   event.preventDefault(); event.stopPropagation();
   const callback = readyCallback;
   close();
   callback?.();
  });
  root.addEventListener('resize', scheduleLayout);
  root.addEventListener('scroll', scheduleLayout, true);
  root.visualViewport?.addEventListener('resize', scheduleLayout);
  document.addEventListener('focusin', keepFocus, true);
  if (typeof ResizeObserver !== 'undefined') {
   observer = new ResizeObserver(scheduleLayout);
   for (const node of [document.getElementById('autoBtn'), document.getElementById('stageWrap'), overlay.querySelector('.hero-guide-card')]) if (node) observer.observe(node);
  }
  layout();
  overlay.querySelector('#heroGuideReady').focus({preventScroll:true});
  return true;
 }

 root.HeroGuide = Object.freeze({open, close, isOpen:() => !!overlay});
})(window);
