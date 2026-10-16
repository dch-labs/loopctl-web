/**
 * Keep vertical scrolling vertical.
 *
 * A code block with one long line is a horizontal scroll container, and Chrome
 * hands an entire wheel gesture to the first element that can scroll along any
 * axis the gesture touches. Two fingers travelling straight down rarely drift
 * by exactly zero pixels sideways, so an ordinary scroll across a wide block
 * became a horizontal scroll of that block and the page did not move at all —
 * measured at 0px of page scroll for a wheel of (deltaX 40, deltaY 240) over a
 * block 688px wide holding 891px of code. Tables, which this site lays out as
 * `display: block; overflow-x: auto`, have the same problem.
 *
 * So the gesture is split along the axis it is actually on: a vertical-dominant
 * wheel over a block that cannot scroll vertically belongs to the page, and a
 * horizontal-dominant one belongs to the block, which is what it is for. The
 * page is moved by the same delta the block would have absorbed, so the scroll
 * speed still matches the rest of the document.
 */

/** The scrollable regions prose creates: code blocks and wide tables. */
const SCROLLERS = '.sl-markdown-content pre, .sl-markdown-content table';

let installed = false;

function toPixels(e: WheelEvent) {
  if (e.deltaMode === 1) return e.deltaY * 16; // lines
  if (e.deltaMode === 2) return e.deltaY * window.innerHeight; // pages
  return e.deltaY;
}

function onWheel(e: WheelEvent) {
  // A modifier means the chord meant something else (pinch-zoom, tab browsing),
  // and someone earlier in the chain already decided the outcome.
  if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;

  const block = (e.target as Element | null)?.closest?.(SCROLLERS) as HTMLElement | null;
  if (!block) return;

  const canScrollX = block.scrollWidth - block.clientWidth > 1;
  const canScrollY = block.scrollHeight - block.clientHeight > 1;
  // If it can scroll vertically there is nothing to arbitrate: let it, and the
  // leftovers chain to the page on their own.
  if (!canScrollX || canScrollY) return;

  // Horizontal intent is the block's to keep.
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

  e.preventDefault();
  window.scrollBy(0, toPixels(e));
}

export function initWheelPassthrough() {
  if (installed) return;
  installed = true;
  // One delegated listener for the whole document rather than one per block, so
  // Astro swapping the page out cannot leave handlers behind. Not passive: the
  // whole point is that this handler may take the gesture back.
  document.addEventListener('wheel', onWheel, { passive: false });
}
