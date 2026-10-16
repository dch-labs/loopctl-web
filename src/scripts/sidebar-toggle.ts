const KEY = 'loopctl-sidebars';

/**
 * The collapsed index is remembered for this browser tab, never across visits:
 * someone who hid it an hour ago should not meet an index-less page when they
 * come back looking for navigation. An early build persisted it in
 * localStorage, which is exactly that trap, so residue is cleared on read.
 */
function readHidden(): boolean {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). The default
    // — index shown — is the safe answer in every one of those cases.
  }
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function writeHidden(hidden: boolean) {
  try {
    sessionStorage.setItem(KEY, hidden ? '1' : '0');
  } catch {
    // As above: the attribute still toggles for this page, it just is not kept.
  }
}

/**
 * A panel with its index cell filled is the open state; the same panel hollow is
 * the closed state, so the glyph reports what is true rather than only which way
 * the click goes. Deliberately spare: this sheet hides every other icon, so this
 * one has to read as a hairline mark, not as product chrome.
 */
function icon(hidden: boolean) {
  const cell = hidden
    ? ''
    : '<rect x="2.7" y="3.5" width="4.9" height="13" fill="currentColor" stroke="none"></rect>';
  return (
    '<svg width="18" height="18" viewBox="0 0 22 20" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="1.8" y="2.6" width="18.4" height="14.8"></rect>' +
    '<path d="M8.2 2.6v14.8"></path>' +
    cell +
    '</svg>'
  );
}

/** Whether `[` is free to act as the shortcut rather than as a typed character. */
function shortcutIsFree(e: KeyboardEvent) {
  if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return false;
  // The search dialog owns the keyboard while it is open, and a bare bracket
  // is ordinary input anywhere you can type.
  if (document.querySelector('dialog[open]')) return false;
  const target = e.target as HTMLElement | null;
  return !target?.closest('input, textarea, select, [contenteditable], [role="dialog"]');
}

/**
 * Collapse the desktop index on demand.
 *
 * The control is fixed to the index's own edge. docs.css reserves a lane at the
 * column's right for it and, when the index closes, narrows `--sl-sidebar-width`
 * to that same lane, so the text column and the control move together and the
 * control is always exactly where it was. Fixed rather than placed inside the
 * pane because the pane is `display: none` when collapsed — a control that
 * disappears with the thing it restores is the exact failure this feature has to
 * avoid. `src/overrides/Head.astro` applies the stored state before paint, so a
 * collapsed visit does not flash an index first.
 */
export function initSidebarToggle() {
  if (document.getElementById('sidebar-toggle-left')) return;

  const root = document.documentElement;
  let hidden = readHidden();

  const btn = document.createElement('button');
  btn.id = 'sidebar-toggle-left';
  btn.className = 'sidebar-toggle-btn';
  btn.type = 'button';
  btn.setAttribute('aria-controls', 'starlight__sidebar');

  const render = () => {
    if (hidden) root.dataset.hideLeft = '1';
    else delete root.dataset.hideLeft;
    // The glyph carries the state; the words carry the action, in the accessible
    // name and the tooltip, where they cannot collide with the layout.
    btn.innerHTML = icon(hidden);
    btn.title = hidden ? 'Show the index ( [ )' : 'Hide the index ( [ )';
    btn.setAttribute('aria-label', hidden ? 'Show navigation index' : 'Hide navigation index');
    btn.setAttribute('aria-expanded', hidden ? 'false' : 'true');
  };

  const toggle = () => {
    hidden = !hidden;
    writeHidden(hidden);
    render();
  };

  btn.addEventListener('click', toggle);
  document.addEventListener('keydown', (e) => {
    if (!shortcutIsFree(e)) return;
    e.preventDefault();
    toggle();
  });

  // The body, because the button is fixed: keeping it out of Starlight's own
  // subtrees means a page swap cannot strand it.
  document.body.append(btn);
  render();
}
