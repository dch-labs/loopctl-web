type ThemeVars = Record<string, string>;

const MINUS_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>';

const PLUS_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';

const RESET_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';

const paperVars: ThemeVars = {
  background: '#f3ebd9',
  primaryColor: '#eee0c0',
  primaryTextColor: '#1c1813',
  primaryBorderColor: '#8a2317',
  secondaryColor: '#efe5cc',
  secondaryTextColor: '#1c1813',
  secondaryBorderColor: '#847a64',
  tertiaryColor: '#faf3e2',
  tertiaryTextColor: '#1c1813',
  tertiaryBorderColor: '#c9be9f',
  lineColor: '#847a64',
  textColor: '#1c1813',
  titleColor: '#8a2317',
  clusterBkg: '#faf3e2',
  clusterBorder: '#c9be9f',
  edgeLabelBackground: '#f3ebd9',
  noteBkgColor: '#a87714',
  noteTextColor: '#f3ebd9',
  noteBorderColor: '#a87714',
  actorBkg: '#e9dec3',
  actorTextColor: '#1c1813',
  actorBorder: '#4a4338',
  actorLineColor: '#847a64',
  signalColor: '#4a4338',
  signalTextColor: '#1c1813',
  labelBoxBkgColor: '#e9dec3',
  labelBoxBorderColor: '#847a64',
  labelTextColor: '#1c1813',
  loopTextColor: '#1c1813',
  activationBkgColor: '#faf3e2',
  activationBorderColor: '#847a64',
  sequenceNumberColor: '#f3ebd9',
};

const dimVars: ThemeVars = {
  background: '#181410',
  primaryColor: '#2b2418',
  primaryTextColor: '#f7f1e3',
  primaryBorderColor: '#d8a070',
  secondaryColor: '#1f1a13',
  secondaryTextColor: '#e6dec8',
  secondaryBorderColor: '#7d735a',
  tertiaryColor: '#141009',
  tertiaryTextColor: '#e6dec8',
  tertiaryBorderColor: '#3a3328',
  lineColor: '#7d735a',
  textColor: '#f7f1e3',
  titleColor: '#d8a070',
  clusterBkg: '#141009',
  clusterBorder: '#3a3328',
  edgeLabelBackground: '#181410',
  noteBkgColor: '#d4a83a',
  noteTextColor: '#181410',
  noteBorderColor: '#d4a83a',
  actorBkg: '#2b2418',
  actorTextColor: '#f7f1e3',
  actorBorder: '#d8a070',
  actorLineColor: '#a99c80',
  signalColor: '#d8ccb0',
  signalTextColor: '#f7f1e3',
  labelBoxBkgColor: '#2b2418',
  labelBoxBorderColor: '#d8a070',
  labelTextColor: '#f7f1e3',
  loopTextColor: '#f7f1e3',
  activationBkgColor: '#141009',
  activationBorderColor: '#7d735a',
  sequenceNumberColor: '#181410',
};

interface Diagram {
  figure: HTMLElement;
  holder: HTMLElement;
  source: string;
}

let diagrams: Diagram[] = [];
let counter = 0;
let rendering: Promise<void> = Promise.resolve();
let themeWatchInstalled = false;
let resizeWatchInstalled = false;

const isDark = () => document.documentElement.dataset.theme === 'dark';

const mermaidConfig = () => ({
  startOnLoad: false,
  securityLevel: 'strict' as const,
  suppressErrorRendering: true,
  fontFamily: "'Newsreader Variable', Georgia, serif",
  flowchart: { curve: 'basis' as const, diagramPadding: 14, nodeSpacing: 65, rankSpacing: 80 },
  theme: 'base' as const,
  themeVariables: isDark() ? dimVars : paperVars,
});

const fitCache = new WeakMap<SVGSVGElement, true>();

function ensureContentBox(svgEl: SVGSVGElement) {
  if (fitCache.has(svgEl)) return;
  try {
    const bb = svgEl.getBBox();
    if (!bb.width || !bb.height) return;
    fitCache.set(svgEl, true);
    const pad = Math.max(bb.width, bb.height) * 0.06;
    svgEl.setAttribute(
      'viewBox',
      `${bb.x - pad} ${bb.y - pad} ${bb.width + pad * 2} ${bb.height + pad * 2}`
    );
  } catch {
    /* not renderable yet — retried on the next applyView */
  }
}

function applyView(figure: HTMLElement, svgEl: SVGSVGElement, scale: number) {
  const view = figure.querySelector('.mermaid-view') as HTMLElement;
  if (!view) return;
  ensureContentBox(svgEl);
  const vb = svgEl.viewBox.baseVal;
  if (!vb.width || !vb.height) return;

  const viewW = view.clientWidth || 1;
  if (!figure.dataset.viewHeight) {
    const kFit = Math.min(viewW / vb.width, (window.innerHeight * 0.85) / vb.height);
    figure.dataset.viewHeight = String(Math.max(60, Math.round(vb.height * kFit)));
  }
  const viewH = Number(figure.dataset.viewHeight);
  view.style.height = `${viewH}px`;

  const k = (Math.min(viewW / vb.width, viewH / vb.height) / 1) * scale;
  const w = vb.width * k;
  const h = vb.height * k;
  svgEl.style.maxWidth = 'none';
  svgEl.style.margin = '0';
  svgEl.style.width = `${w}px`;
  svgEl.style.height = `${h}px`;

  const vr = view.getBoundingClientRect();
  const minTX = Math.min(0, vr.width - w);
  const maxTX = Math.max(0, vr.width - w);
  const minTY = Math.min(0, vr.height - h);
  const maxTY = Math.max(0, vr.height - h);
  const panX = Number(figure.dataset.panX ?? '0');
  const panY = Number(figure.dataset.panY ?? '0');
  const tx = Math.min(maxTX, Math.max(minTX, (vr.width - w) / 2 + panX));
  const ty = Math.min(maxTY, Math.max(minTY, (vr.height - h) / 2 + panY));
  svgEl.style.transform = `translate(${tx}px, ${ty}px)`;
  svgEl.style.position = 'relative';
  figure.dataset.panX = String(tx - (vr.width - w) / 2);
  figure.dataset.panY = String(ty - (vr.height - h) / 2);
}

function relayoutAll() {
  document.querySelectorAll('.mermaid-figure').forEach((figure) => {
    const svgEl = figure.querySelector('.mermaid-view svg');
    if (svgEl) applyView(figure, svgEl as SVGSVGElement, Number(figure.dataset.zoom ?? '1'));
  });
}

function ensureZoomControls(figure: HTMLElement, svgEl: SVGSVGElement) {
  const existing = figure.querySelector('.mermaid-zoom');
  const scale = Number(figure.dataset.zoom ?? '1');
  applyView(figure, svgEl, scale);
  if (existing) return;

  const zoomGroup = document.createElement('div');
  zoomGroup.className = 'mermaid-zoom';

  const value = document.createElement('span');
  value.className = 'mermaid-zoom-value';
  value.textContent = `${Math.round(scale * 100)}%`;

  const setScale = (next: number) => {
    figure.dataset.zoom = String(next);
    figure.dataset.panX = '0';
    figure.dataset.panY = '0';
    const svgEl = figure.querySelector('.mermaid-view svg');
    if (svgEl) applyView(figure, svgEl as SVGSVGElement, next);
    value.textContent = `${Math.round(next * 100)}%`;
    minus.disabled = next <= 0.5;
    plus.disabled = next >= 3;
  };

  const makeButton = (icon: string, title: string) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = icon;
    btn.setAttribute('aria-label', title);
    btn.title = title;
    return btn;
  };

  const minus = makeButton(MINUS_ICON, 'Zoom diagram out');
  const plus = makeButton(PLUS_ICON, 'Zoom diagram in');
  const reset = makeButton(RESET_ICON, 'Reset diagram zoom');
  minus.disabled = scale <= 0.5;
  plus.disabled = scale >= 3;

  minus.addEventListener('click', () => setScale(Math.max(0.5, Number(figure.dataset.zoom ?? '1') / 1.25)));
  plus.addEventListener('click', () => setScale(Math.min(3, Number(figure.dataset.zoom ?? '1') * 1.25)));
  reset.addEventListener('click', () => {
    figure.dataset.panX = '0';
    figure.dataset.panY = '0';
    setScale(1);
  });

  zoomGroup.append(value, minus, plus, reset);

  const fullscreen = makeButton('', 'Toggle fullscreen diagram');
  fullscreen.className = 'mermaid-fullscreen-btn';
  fullscreen.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>';
  fullscreen.addEventListener('click', () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void figure.requestFullscreen();
    }
  });
  document.addEventListener('fullscreenchange', () => {
    fullscreen.setAttribute('aria-pressed', document.fullscreenElement === figure ? 'true' : 'false');
  });

  figure.appendChild(zoomGroup);
  figure.appendChild(fullscreen);
  enablePanning(figure.querySelector('.mermaid-view') as HTMLElement, figure);
}

function enablePanning(view: HTMLElement, figure: HTMLElement) {
  if (view.dataset.panInit) return;
  view.dataset.panInit = '1';
  let active = false;
  let startX = 0;
  let startY = 0;
  let startPanX = 0;
  let startPanY = 0;

  view.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    active = true;
    startX = e.clientX;
    startY = e.clientY;
    startPanX = Number(figure.dataset.panX ?? '0');
    startPanY = Number(figure.dataset.panY ?? '0');
    view.classList.add('panning');
    view.setPointerCapture(e.pointerId);
  });
  view.addEventListener('pointermove', (e) => {
    if (!active) return;
    figure.dataset.panX = String(startPanX + (e.clientX - startX));
    figure.dataset.panY = String(startPanY + (e.clientY - startY));
    const svgEl = view.querySelector('svg');
    if (svgEl) applyView(figure, svgEl as SVGSVGElement, Number(figure.dataset.zoom ?? '1'));
  });
  const stop = () => {
    active = false;
    view.classList.remove('panning');
  };
  view.addEventListener('pointerup', stop);
  view.addEventListener('pointercancel', stop);
  const panBy = (dx: number, dy: number) => {
    figure.dataset.panX = String(Number(figure.dataset.panX ?? '0') + dx);
    figure.dataset.panY = String(Number(figure.dataset.panY ?? '0') + dy);
    const svgEl = view.querySelector('svg');
    if (svgEl) applyView(figure, svgEl as SVGSVGElement, Number(figure.dataset.zoom ?? '1'));
  };

  const zoomBy = (factor: number) => {
    const next = Math.min(3, Math.max(0.5, Number(figure.dataset.zoom ?? '1') * factor));
    figure.dataset.zoom = String(next);
    figure.dataset.panX = '0';
    figure.dataset.panY = '0';
    const svgEl = view.querySelector('svg');
    if (svgEl) applyView(figure, svgEl as SVGSVGElement, next);
    const value = figure.querySelector('.mermaid-zoom-value');
    if (value) value.textContent = `${Math.round(next * 100)}%`;
    const minus = figure.querySelector<HTMLButtonElement>('.mermaid-zoom button[aria-label="Zoom diagram out"]');
    const plus = figure.querySelector<HTMLButtonElement>('.mermaid-zoom button[aria-label="Zoom diagram in"]');
    if (minus) minus.disabled = next <= 0.5;
    if (plus) plus.disabled = next >= 3;
  };

  view.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const units = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomBy(Math.exp(-units * 0.0022));
      return;
    }
    if (e.deltaX !== 0 || view.scrollHeight > view.clientHeight || view.scrollWidth > view.clientWidth) {
      e.preventDefault();
      panBy(e.deltaX, e.deltaY);
    }
  }, { passive: false });
}

function watchResize() {
  if (resizeWatchInstalled) return;
  resizeWatchInstalled = true;
  let frame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(relayoutAll);
  });
}

function addLabelPadding(svgEl: SVGSVGElement) {
  const vb = svgEl.viewBox.baseVal;
  const bounds = svgEl.getBoundingClientRect();
  if (!bounds.width || !vb.width) return;
  const scale = bounds.width / vb.width;
  const padScreenX = 10;
  const padScreenY = 4;
  const padX = padScreenX / scale;
  const padY = padScreenY / scale;
  svgEl.querySelectorAll('.edgeLabel').forEach((group) => {
    const fo = group.querySelector('foreignObject');
    const div = (fo?.querySelector('div') as HTMLElement) ?? null;
    if (!fo || !div || !(div.textContent || '').trim()) return;
    if (group.dataset.padded === '1') return;
    group.dataset.padded = '1';
    const oldW = Number(fo.getAttribute('width'));
    const oldH = Number(fo.getAttribute('height'));
    if (!oldW || !oldH) return;
    div.style.padding = `${padScreenY}px ${padScreenX}px ${Math.max(0, padScreenY - 2)}px`;
    div.style.boxSizing = 'content-box';
    div.style.borderRadius = '6px';
    div.style.border = 'none';
    fo.setAttribute('width', String(oldW + 2 * padX));
    fo.setAttribute('height', String(oldH + 2 * padY));
    const match = /translate\(([-\d.]+)[, ]+([-\d.]+)\)/.exec(group.getAttribute('transform') ?? '');
    if (match) {
      group.setAttribute(
        'transform',
        `translate(${Number(match[1]) - padX}, ${Number(match[2]) - padY})`
      );
    }
  });
}

async function renderOne(mermaid: typeof import('mermaid').default, diagram: Diagram, id: string) {
  const { svg } = await mermaid.render(id, diagram.source);
  if (/Syntax error in text/.test(svg)) throw new Error('mermaid reported a parse error');
  diagram.holder.innerHTML = svg;
  const svgEl = diagram.holder.querySelector('svg');
  if (svgEl) {
    addLabelPadding(svgEl as SVGSVGElement);
    ensureZoomControls(diagram.figure, svgEl as SVGSVGElement);
  }
}

async function renderAll() {
  if (!diagrams.length) return;
  const pending = rendering.then(async () => {
    const mermaid = (await import('mermaid')).default;
    mermaid.initialize(mermaidConfig());
    for (const diagram of diagrams) {
      const id = `loopctl-mermaid-${++counter}`;
      try {
        await renderOne(mermaid, diagram, id);
      } catch (firstError) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        try {
          await renderOne(mermaid, diagram, `loopctl-mermaid-${++counter}`);
        } catch (secondError) {
          const message = secondError instanceof Error ? secondError.message : String(secondError);
          diagram.figure.dataset.renderError = message.slice(0, 300);
          const first =
            firstError instanceof Error ? firstError.message : String(firstError);
          console.warn('loopctl: mermaid render failed twice —', first);
          diagram.holder.innerHTML = '';
          const pre = document.createElement('pre');
          pre.textContent = diagram.source;
          diagram.holder.appendChild(pre);
        }
      }
    }
  });
  rendering = pending.catch(() => {});
  await pending;
}

function watchTheme() {
  if (themeWatchInstalled) return;
  themeWatchInstalled = true;
  let current = document.documentElement.dataset.theme;
  new MutationObserver(() => {
    const next = document.documentElement.dataset.theme;
    if (next !== current) {
      current = next;
      void renderAll();
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

function extractSource(pre: HTMLElement): string {
  const lines = pre.querySelectorAll('.ec-line .code');
  if (!lines.length) return pre.textContent ?? '';
  const parts: string[] = [];
  lines.forEach((line) => parts.push(line.textContent ?? ''));
  return parts.join('\n').trim();
}

export function initMermaid() {
  diagrams = diagrams.filter((diagram) => diagram.figure.isConnected);
  const blocks = document.querySelectorAll<HTMLElement>(
    'pre[data-language="mermaid"], pre > code.language-mermaid'
  );
  if (!blocks.length) return;

  for (const block of blocks) {
    const pre = block.matches('pre') ? block : (block.closest('pre') as HTMLElement);
    const source = extractSource(pre);
    if (!source) continue;

    const figure = document.createElement('figure');
    figure.className = 'mermaid-figure';
    const view = document.createElement('div');
    view.className = 'mermaid-view';
    figure.appendChild(view);
    const frame = pre.closest('.expressive-code') ?? pre;
    if (frame !== pre) {
      frame
        .querySelectorAll('link[rel="stylesheet"], style, script')
        .forEach((asset) => document.head.appendChild(asset));
    }
    frame.replaceWith(figure);
    diagrams.push({ figure, holder: view, source });
  }

  watchTheme();
  watchResize();
  void renderAll();
}
