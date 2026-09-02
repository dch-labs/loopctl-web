import sourceSerif from '@fontsource-variable/source-serif-4/index.css?url';
import sourceSerifItalic from '@fontsource-variable/source-serif-4/wght-italic.css?url';
import lora from '@fontsource-variable/lora/index.css?url';
import loraItalic from '@fontsource-variable/lora/wght-italic.css?url';
import literata from '@fontsource-variable/literata/index.css?url';
import literataItalic from '@fontsource-variable/literata/wght-italic.css?url';
import crimsonPro from '@fontsource-variable/crimson-pro/index.css?url';
import crimsonProItalic from '@fontsource-variable/crimson-pro/wght-italic.css?url';
import vollkorn from '@fontsource-variable/vollkorn/index.css?url';
import vollkornItalic from '@fontsource-variable/vollkorn/wght-italic.css?url';
import ebGaramond from '@fontsource-variable/eb-garamond/index.css?url';
import ebGaramondItalic from '@fontsource-variable/eb-garamond/wght-italic.css?url';
import inter from '@fontsource-variable/inter/index.css?url';
import interItalic from '@fontsource-variable/inter/wght-italic.css?url';
import spectral from '@fontsource/spectral/400.css?url';
import spectralItalic from '@fontsource/spectral/400-italic.css?url';
import spectral600 from '@fontsource/spectral/600.css?url';
import spectral700 from '@fontsource/spectral/700.css?url';
import atkinson from '@fontsource/atkinson-hyperlegible/400.css?url';
import atkinsonItalic from '@fontsource/atkinson-hyperlegible/400-italic.css?url';
import atkinson700 from '@fontsource/atkinson-hyperlegible/700.css?url';
import plexMono from '@fontsource/ibm-plex-mono/400.css?url';
import plexMono600 from '@fontsource/ibm-plex-mono/600.css?url';
import firaCode from '@fontsource-variable/fira-code/index.css?url';
import sourceCodePro from '@fontsource-variable/source-code-pro/index.css?url';

export interface ReadingSettings {
  body: string;
  code: string;
  scale: number;
  leading: number;
  measure: number;
}

export const DEFAULTS: ReadingSettings = {
  body: 'newsreader',
  code: 'jetbrains',
  scale: 1,
  leading: 1,
  measure: 1,
};

const KEY = 'loopctl-reading';

export const BODY_FONTS: { id: string; name: string; sample: string; css: string[] }[] = [
  { id: 'newsreader', name: 'Newsreader', sample: 'Newsreader', css: [] },
  { id: 'source-serif', name: 'Source Serif 4', sample: 'Source Serif', css: [sourceSerif, sourceSerifItalic] },
  { id: 'lora', name: 'Lora', sample: 'Lora', css: [lora, loraItalic] },
  { id: 'literata', name: 'Literata', sample: 'Literata', css: [literata, literataItalic] },
  { id: 'spectral', name: 'Spectral', sample: 'Spectral', css: [spectral, spectralItalic, spectral600, spectral700] },
  { id: 'crimson-pro', name: 'Crimson Pro', sample: 'Crimson Pro', css: [crimsonPro, crimsonProItalic] },
  { id: 'vollkorn', name: 'Vollkorn', sample: 'Vollkorn', css: [vollkorn, vollkornItalic] },
  { id: 'eb-garamond', name: 'EB Garamond', sample: 'EB Garamond', css: [ebGaramond, ebGaramondItalic] },
  { id: 'inter', name: 'Inter', sample: 'Inter', css: [inter, interItalic] },
  { id: 'atkinson', name: 'Atkinson', sample: 'Atkinson', css: [atkinson, atkinsonItalic, atkinson700] },
];

export const CODE_FONTS: { id: string; name: string; sample: string; css: string[] }[] = [
  { id: 'jetbrains', name: 'JetBrains Mono', sample: 'JetBrains', css: [] },
  { id: 'plex', name: 'IBM Plex Mono', sample: 'Plex Mono', css: [plexMono, plexMono600] },
  { id: 'fira', name: 'Fira Code', sample: 'Fira Code', css: [firaCode] },
  { id: 'source-code', name: 'Source Code Pro', sample: 'Source Code', css: [sourceCodePro] },
];

const LEADING_STEPS = [
  { label: 'tight', value: 0.88 },
  { label: 'normal', value: 1 },
  { label: 'relaxed', value: 1.08 },
  { label: 'airy', value: 1.16 },
];

const MEASURE_STEPS = [
  { label: 'narrow', value: 0.9 },
  { label: 'normal', value: 1 },
  { label: 'wide', value: 1.12 },
];

const loadedHrefs = new Set<string>();
let escapeBound = false;
let closeActivePanel: () => void = () => {};

function loadFontCss(urls: string[]) {
  for (const href of urls) {
    if (loadedHrefs.has(href)) continue;
    loadedHrefs.add(href);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}

export function loadSettings(): ReadingSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      body: raw.body ?? DEFAULTS.body,
      code: raw.code ?? DEFAULTS.code,
      scale: raw.scale ?? DEFAULTS.scale,
      leading: raw.leading ?? DEFAULTS.leading,
      measure: raw.measure ?? DEFAULTS.measure,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: ReadingSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {}
}

export function clearSettings() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function applySettings(settings: ReadingSettings) {
  const root = document.documentElement;
  if (settings.body === DEFAULTS.body) delete root.dataset.readBody;
  else root.dataset.readBody = settings.body;
  if (settings.code === DEFAULTS.code) delete root.dataset.readCode;
  else root.dataset.readCode = settings.code;
  root.style.setProperty('--read-scale', String(settings.scale));
  root.style.setProperty('--read-leading', String(settings.leading));
  root.style.setProperty('--read-measure', String(settings.measure));

  for (const font of BODY_FONTS) {
    if (font.id === settings.body) loadFontCss(font.css);
  }
  for (const font of CODE_FONTS) {
    if (font.id === settings.code) loadFontCss(font.css);
  }
}

function settingsSummary(settings: ReadingSettings): string {
  const parts: string[] = [];
  if (settings.body !== DEFAULTS.body) parts.push(`body=${settings.body}`);
  if (settings.code !== DEFAULTS.code) parts.push(`code=${settings.code}`);
  if (settings.scale !== DEFAULTS.scale) parts.push(`scale=${settings.scale}`);
  if (settings.leading !== DEFAULTS.leading) parts.push(`leading=${settings.leading}`);
  if (settings.measure !== DEFAULTS.measure) parts.push(`width=${settings.measure}`);
  return parts.length ? parts.join(' · ') : 'site defaults';
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function pressed(node: HTMLElement, on: boolean) {
  if (on) node.setAttribute('aria-pressed', 'true');
  else node.setAttribute('aria-pressed', 'false');
}

function segmented<T extends { label: string; value: number }>(
  parent: HTMLElement,
  steps: T[],
  get: () => number,
  onPick: (value: number) => void
): () => void {
  const row = el('div', 'rp-seg');
  row.setAttribute('role', 'group');
  const buttons: { node: HTMLButtonElement; value: number }[] = [];
  for (const step of steps) {
    const btn = el('button', undefined, step.label) as HTMLButtonElement;
    pressed(btn, step.value === get());
    btn.addEventListener('click', () => {
      row.querySelectorAll('button').forEach((b) => pressed(b, b === btn));
      onPick(step.value);
    });
    buttons.push({ node: btn, value: step.value });
    row.appendChild(btn);
  }
  parent.appendChild(row);
  return () => {
    for (const { node, value } of buttons) pressed(node, value === get());
  };
}

export function initReadingPanel() {
  if (document.getElementById('rp-trigger')) return;

  const settings = loadSettings();
  applySettings(settings);
  const segRefresh: (() => void)[] = [];

  const trigger = el('button', 'rp-trigger');
  trigger.id = 'rp-trigger';
  trigger.textContent = 'Aa';
  trigger.setAttribute('aria-label', 'Reading settings');
  document.body.appendChild(trigger);

  const overlay = el('div', 'rp-overlay');
  const drawer = el('aside', 'rp-drawer');
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-label', 'Reading settings');

  const head = el('div', 'rp-head');
  head.appendChild(el('div', 'rp-title', 'Reading settings'));
  const close = el('button', 'rp-close');
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close reading settings');
  head.appendChild(close);
  drawer.appendChild(head);

  const openPanel = (allFonts: boolean) => {
    if (allFonts) {
      for (const font of BODY_FONTS) loadFontCss(font.css);
      for (const font of CODE_FONTS) loadFontCss(font.css);
    }
    overlay.classList.add('open');
    drawer.classList.add('open');
  };
  const closePanel = () => {
    overlay.classList.remove('open');
    drawer.classList.remove('open');
  };

  const bodySection = el('div', 'rp-section');
  bodySection.appendChild(el('div', 'rp-label', 'Font for text'));
  const bodyGrid = el('div', 'rp-fonts');
  const bodyButtons = new Map<string, HTMLElement>();
  for (const font of BODY_FONTS) {
    const btn = el('button', 'rp-font');
    const sample = el('span', 'rp-sample', font.sample);
    sample.style.fontFamily = getStackFor(font.id);
    const name = el('span', 'rp-name', font.name);
    btn.appendChild(sample);
    btn.appendChild(name);
    pressed(btn, font.id === settings.body);
    btn.addEventListener('click', () => {
      settings.body = font.id;
      commit();
      bodyButtons.forEach((b, id) => pressed(b, id === font.id));
    });
    bodyButtons.set(font.id, btn);
    bodyGrid.appendChild(btn);
  }
  bodySection.appendChild(bodyGrid);
  drawer.appendChild(bodySection);

  const codeSection = el('div', 'rp-section');
  codeSection.appendChild(el('div', 'rp-label', 'Font for code'));
  const codeGrid = el('div', 'rp-fonts');
  const codeButtons = new Map<string, HTMLElement>();
  for (const font of CODE_FONTS) {
    const btn = el('button', 'rp-font');
    const sample = el('span', 'rp-sample', font.sample);
    sample.style.fontFamily = getMonoStackFor(font.id);
    sample.style.fontSize = '14px';
    const name = el('span', 'rp-name', font.name);
    btn.appendChild(sample);
    btn.appendChild(name);
    pressed(btn, font.id === settings.code);
    btn.addEventListener('click', () => {
      settings.code = font.id;
      commit();
      codeButtons.forEach((b, id) => pressed(b, id === font.id));
    });
    codeButtons.set(font.id, btn);
    codeGrid.appendChild(btn);
  }
  codeSection.appendChild(codeGrid);
  drawer.appendChild(codeSection);

  const sizeSection = el('div', 'rp-section');
  sizeSection.appendChild(el('div', 'rp-label', 'Text size'));
  const sliderRow = el('div', 'rp-slider-row');
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'rp-slider';
  slider.min = '0.85';
  slider.max = '1.3';
  slider.step = '0.01';
  slider.value = String(settings.scale);
  slider.setAttribute('aria-label', 'Text size');
  const sliderValue = el('span', 'rp-slider-value', `${Math.round(settings.scale * 100)}%`);
  slider.addEventListener('input', () => {
    settings.scale = Number.parseFloat(slider.value);
    sliderValue.textContent = `${Math.round(settings.scale * 100)}%`;
    commit();
  });
  sliderRow.appendChild(slider);
  sliderRow.appendChild(sliderValue);
  sizeSection.appendChild(sliderRow);
  segRefresh.push(() => {
    slider.value = String(settings.scale);
    sliderValue.textContent = `${Math.round(settings.scale * 100)}%`;
  });
  drawer.appendChild(sizeSection);

  const leadingSection = el('div', 'rp-section');
  leadingSection.appendChild(el('div', 'rp-label', 'Line spacing'));
  segRefresh.push(
    segmented(leadingSection, LEADING_STEPS, () => settings.leading, (value) => {
      settings.leading = value;
      commit();
    })
  );
  drawer.appendChild(leadingSection);

  const measureSection = el('div', 'rp-section');
  measureSection.appendChild(el('div', 'rp-label', 'Content width'));
  segRefresh.push(
    segmented(measureSection, MEASURE_STEPS, () => settings.measure, (value) => {
      settings.measure = value;
      commit();
    })
  );
  drawer.appendChild(measureSection);

  const foot = el('div', 'rp-foot');
  const reset = el('button', 'rp-reset', 'Reset');
  reset.addEventListener('click', () => {
    clearSettings();
    Object.assign(settings, DEFAULTS);
    applySettings(settings);
    summary.textContent = settingsSummary(settings);
    bodyButtons.forEach((b, id) => pressed(b, id === settings.body));
    codeButtons.forEach((b, id) => pressed(b, id === settings.code));
    segRefresh.forEach((fn) => fn());
  });
  const note = el('div', 'rp-note', 'Saved in this browser.');
  foot.appendChild(note);
  foot.appendChild(reset);
  drawer.appendChild(foot);

  const summary = el('div', 'rp-note');
  summary.style.marginTop = '10px';
  drawer.appendChild(summary);

  const commit = () => {
    saveSettings(settings);
    applySettings(settings);
    summary.textContent = settingsSummary(settings);
  };

  trigger.addEventListener('click', () => openPanel(true));
  close.addEventListener('click', closePanel);
  overlay.addEventListener('click', closePanel);
  closeActivePanel = closePanel;
  if (!escapeBound) {
    escapeBound = true;
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeActivePanel();
    });
  }

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);
  commit();
}

function getStackFor(id: string): string {
  const stacks: Record<string, string> = {
    newsreader: "'Newsreader Variable', Georgia, serif",
    'source-serif': "'Source Serif 4 Variable', Georgia, serif",
    lora: "'Lora Variable', Georgia, serif",
    literata: "'Literata Variable', Georgia, serif",
    spectral: "'Spectral', Georgia, serif",
    'crimson-pro': "'Crimson Pro Variable', Georgia, serif",
    vollkorn: "'Vollkorn Variable', Georgia, serif",
    'eb-garamond': "'EB Garamond Variable', Georgia, serif",
    inter: "'Inter Variable', system-ui, sans-serif",
    atkinson: "'Atkinson Hyperlegible', system-ui, sans-serif",
  };
  return stacks[id] ?? 'var(--font-body)';
}

function getMonoStackFor(id: string): string {
  const stacks: Record<string, string> = {
    jetbrains: 'var(--font-mono-ui)',
    plex: "'IBM Plex Mono', ui-monospace, monospace",
    fira: "'Fira Code Variable', ui-monospace, monospace",
    'source-code': "'Source Code Pro Variable', ui-monospace, monospace",
  };
  return stacks[id] ?? 'var(--font-mono-ui)';
}
