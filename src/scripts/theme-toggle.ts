const SUN_ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>';

const MOON_ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';

function iconFor(theme: string | undefined) {
  return theme === 'dark' ? SUN_ICON : MOON_ICON;
}

const MOBILE_QUERY = '(max-width: calc(50rem - 0.01rem))';

let themeWatchInstalled = false;

/**
 * Place the toggle where the current viewport can show it: inside the
 * right-side group on desktop (the header grid has exactly three columns
 * and a fourth child would wrap), or on the header's own container on
 * mobile, where Starlight hides the right-side group and the mobile grid
 * places the button in its last column. Re-mounting an existing node
 * moves it and keeps its listeners attached.
 */
function mountToggle(btn: HTMLElement) {
  const headerHost = document.querySelector('header .header') ?? document.querySelector('header');
  if (!headerHost) return;
  const mobile = window.matchMedia(MOBILE_QUERY).matches;
  const rightGroup = document.querySelector<HTMLElement>('header .right-group');
  if (!mobile && rightGroup) {
    rightGroup.prepend(btn);
  } else {
    headerHost.appendChild(btn);
  }
}

export function initThemeToggle() {
  if (document.getElementById('theme-icon-toggle')) return;
  const headerHost = document.querySelector('header .header') ?? document.querySelector('header');
  if (!headerHost) return;

  const root = document.documentElement;
  const btn = document.createElement('button');
  btn.id = 'theme-icon-toggle';
  btn.className = 'theme-icon-btn';
  btn.setAttribute('aria-label', 'Toggle dark mode');
  btn.innerHTML = iconFor(root.dataset.theme);
  btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('starlight-theme', next);
    } catch {}
    btn.innerHTML = iconFor(next);
  });
  mountToggle(btn);

  if (themeWatchInstalled) return;
  themeWatchInstalled = true;
  let currentButton = btn;
  new MutationObserver(() => {
    const active = document.getElementById('theme-icon-toggle');
    if (active) currentButton = active;
    currentButton.innerHTML = iconFor(root.dataset.theme);
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  // Re-home the toggle whenever the mobile/desktop breakpoint flips, so
  // resizing across it needs no reload: desktop keeps the three-column
  // header grid intact, mobile keeps the toggle visible outside the
  // hidden right-side group.
  window.matchMedia(MOBILE_QUERY).addEventListener('change', () => {
    const active = document.getElementById('theme-icon-toggle');
    if (active) mountToggle(active);
  });
}
