/**
 * Keep the left index honest about where you are.
 *
 * Starlight marks the current page's entry with `aria-current="page"` but
 * leaves the pane scrolled wherever the last visit left it: land on a deep
 * File-reference page from search and the index still shows its very top,
 * with the entry you are on a screen and a half below. This scrolls the pane
 * so the current entry sits centered — on every load, every swap, and every
 * arrival by link, menu click, or search result.
 *
 * Runs from `boot()` in `src/overrides/Head.astro`, so `astro:after-swap`
 * re-runs it after each client-side navigation. Synchronous and listener-free
 * on purpose: nothing here needs to outlive the page it ran on.
 */

/** The nearest ancestor that actually scrolls (the pane, in every breakpoint). */
function scrollParentOf(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node instanceof HTMLElement; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
  }
  return null;
}

export function initSidebarSync() {
  const active = document.querySelector<HTMLElement>(
    'nav.sidebar a[aria-current="page"]',
  );
  if (!active) return;

  // A collapsed group hides its entries, and a hidden entry cannot be scrolled
  // to. Open every `<details>` between the entry and the pane root before
  // measuring — Starlight already renders the current group open, so this is
  // the safety net, not the fix.
  for (
    let group = active.closest('details');
    group instanceof HTMLDetailsElement;
    group = group.parentElement?.closest('details') ?? null
  ) {
    if (!group.open) group.open = true;
  }

  const pane = scrollParentOf(active);
  if (!pane || pane.clientHeight === 0) return;

  // `visibility: hidden` (the mobile pane before its button is pressed) keeps
  // layout, so the scroll lands even while the pane is closed and the index is
  // already where it should be when the menu opens. A `display: none` pane
  // (the desktop `[` toggle) collapses instead, and `clientHeight === 0`
  // above stepped out before we got here.
  const paneBox = pane.getBoundingClientRect();
  const entryBox = active.getBoundingClientRect();
  if (entryBox.height === 0) return;

  const centered =
    pane.scrollTop + (entryBox.top - paneBox.top) - (paneBox.height - entryBox.height) / 2;
  pane.scrollTop = Math.max(
    0,
    Math.min(pane.scrollHeight - pane.clientHeight, centered),
  );
}
