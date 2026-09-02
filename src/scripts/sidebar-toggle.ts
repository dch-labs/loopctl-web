const KEY = 'loopctl-sidebars';

const DOUBLE_CHEVRON_LEFT =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/></svg>';

const DOUBLE_CHEVRON_RIGHT =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m13 17 5-5-5-5"/><path d="m6 17 5-5-5-5"/></svg>';

interface SideState {
  left: boolean;
  right: boolean;
}

function iconFor(side: 'left' | 'right', hidden: boolean) {
  if (side === 'left') return hidden ? DOUBLE_CHEVRON_RIGHT : DOUBLE_CHEVRON_LEFT;
  return hidden ? DOUBLE_CHEVRON_LEFT : DOUBLE_CHEVRON_RIGHT;
}

function readState(): SideState {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? '{}');
    return { left: raw.left === true, right: raw.right === true };
  } catch {
    return { left: false, right: false };
  }
}

function writeState(state: SideState) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

function applyState(state: SideState) {
  const root = document.documentElement;
  if (state.left) root.dataset.hideLeft = '1';
  else delete root.dataset.hideLeft;
  if (state.right) root.dataset.hideRight = '1';
  else delete root.dataset.hideRight;
}

export function initSidebarToggle() {
  const mainFrame = document.querySelector('.main-frame');
  if (!mainFrame || document.getElementById('sidebar-toggle-left')) return;

  const state = readState();
  applyState(state);

  const panes: Record<'left' | 'right', HTMLElement | null> = {
    left: document.getElementById('starlight__sidebar'),
    right: document.querySelector('.right-sidebar-container'),
  };
  const buttons: Record<'left' | 'right', HTMLButtonElement> = {} as never;

  const sync = (side: 'left' | 'right') => {
    const btn = buttons[side];
    const hidden = state[side];
    btn.innerHTML = iconFor(side, hidden);
    btn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
    const pane = panes[side];
    if (!hidden && pane) pane.prepend(btn);
    else mainFrame.appendChild(btn);
  };

  const makeToggle = (id: string, side: 'left' | 'right', title: string) => {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'sidebar-toggle-btn';
    btn.dataset.side = side;
    btn.type = 'button';
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.addEventListener('click', () => {
      state[side] = !state[side];
      writeState(state);
      applyState(state);
      sync(side);
    });
    return btn;
  };

  buttons.left = makeToggle('sidebar-toggle-left', 'left', 'Toggle navigation sidebar');
  buttons.right = makeToggle('sidebar-toggle-right', 'right', 'Toggle page outline');
  sync('left');
  sync('right');
}
