/* Keep keyboard focus and held movement inside the three workshop dialogs. */
(() => {
  'use strict';
  const closeIds = {smithFx: 'smithClose', enchFx: 'enchClose', smeltFx: 'smeltClose', ledgerFx: 'ledgerClose'};
  for (const [id, closeId] of Object.entries(closeIds)) {
    const panel = document.getElementById(id), box = panel?.querySelector('.craft-box');
    if (!panel || !box) continue;
    box.tabIndex = -1;
    let open = false, returnFocus = null, controlId = '';
    const focusable = () => [...box.querySelectorAll('button:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex="0"]')]
      .filter(el => el.getClientRects().length && !el.closest('[hidden]'));
    const sync = () => {
      const visible = panel.style.display === 'flex';
      if (visible === open) return;
      open = visible;
      if (open) {
        returnFocus = document.activeElement;
        for (const key of Object.keys(keys)) keys[key] = false;
        if (hero) {hero.moveTo = null; hero.pendingDoor = null; hero.moving = false;}
        holdMove = null;
        (focusable()[0] || box).focus({preventScroll: true});
      } else if (returnFocus?.isConnected) returnFocus.focus({preventScroll: true});
    };
    new MutationObserver(sync).observe(panel, {attributes: true, attributeFilter: ['style']});
    box.addEventListener('focusin', event => {controlId = event.target.id || '';});
    // Cutting, binding or choosing an ingredient rebuilds its controls. Keep keyboard
    // input in the workshop when the focused button is replaced or disabled.
    new MutationObserver(() => {
      if (!open || document.activeElement !== document.body && !document.activeElement?.disabled) return;
      const items = focusable(), replacement = items.find(el => el.id === controlId);
      (replacement || items[0] || box).focus({preventScroll: true});
    }).observe(box, {childList: true, subtree: true, attributes: true, attributeFilter: ['disabled']});
    panel.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        if (id === 'enchFx' && document.getElementById('enchCraftFx')?.classList.contains('open')) enchCeremonyEnd();
        else document.getElementById(closeId)?.click();
      } else if (event.key === 'Tab') {
        const items = focusable(), first = items[0], last = items.at(-1);
        if (!first) {event.preventDefault(); box.focus();}
        else if (event.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    });
    for (const type of ['pointerdown', 'mousedown', 'click']) panel.addEventListener(type, event => event.stopPropagation());
    sync();
  }
})();
