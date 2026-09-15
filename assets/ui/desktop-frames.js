/* Electron can still throttle Windows compositor frames while hidden/minimized even with
   backgroundThrottling disabled. Keep one shared frame queue alive for combat and chest reels.
   Native RAF wins at normal refresh rates; its timer fallback runs at most 30 times/second.
   This changes scheduling only: the game's explicit pause and tutorial remain in charge. */
(function (root) {
 'use strict';
 if (!root.desktop) return;
 const nativeFrame = root.requestAnimationFrame.bind(root);
 const nativeCancel = root.cancelAnimationFrame.bind(root);
 const later = root.setTimeout.bind(root), cancelLater = root.clearTimeout.bind(root);
 const callbacks = new Map();
 let nextId = 1, scheduled = null, dispatching = false;

 function cancelPending() {
  if (!scheduled) return;
  nativeCancel(scheduled.frame);
  cancelLater(scheduled.timer);
  scheduled = null;
 }

 function schedule() {
  if (scheduled || dispatching || !callbacks.size) return;
  const ticket = {};
  scheduled = ticket;
  ticket.frame = nativeFrame(() => flush(ticket));
  ticket.timer = later(() => flush(ticket), 1000 / 30);
 }

 function flush(ticket) {
  if (scheduled !== ticket) return; // The losing callback can already be queued by Chromium.
  cancelPending();
  dispatching = true;
  // One monotonic clock for both paths, so resuming native paint cannot move time backwards.
  const timestamp = root.performance.now(), batch = Array.from(callbacks.keys());
  for (const id of batch) {
   const callback = callbacks.get(id);
   if (!callback) continue; // An earlier callback may have cancelled this one.
   callbacks.delete(id);
   try { callback(timestamp); }
   catch (error) { later(() => { throw error; }, 0); }
  }
  dispatching = false;
  schedule(); // Requests made during a frame belong to the next frame, just like native RAF.
 }

 root.requestAnimationFrame = function (callback) {
  if (typeof callback !== 'function') throw new TypeError('Animation frame callback must be a function');
  const id = nextId++;
  callbacks.set(id, callback);
  schedule();
  return id;
 };
 root.cancelAnimationFrame = function (id) {
  callbacks.delete(Number(id));
  if (!callbacks.size && !dispatching) cancelPending();
 };
})(window);
