import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const paper = {
  name: 'paper',
  type: 'light',
  colors: {
    'editor.background': '#efe5cc',
    'editor.foreground': '#1c1813',
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#847a64', fontStyle: 'italic' } },
    { scope: ['keyword', 'keyword.operator', 'storage', 'storage.type'], settings: { foreground: '#8a2317' } },
    { scope: ['string', 'punctuation.definition.string'], settings: { foreground: '#5d7440' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character.escape'], settings: { foreground: '#a87714' } },
    { scope: ['entity.name.function', 'support.function', 'meta.function-call'], settings: { foreground: '#6b1c12' } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class'], settings: { foreground: '#1c1813', fontStyle: 'bold' } },
    { scope: ['variable', 'variable.other'], settings: { foreground: '#1c1813' } },
    { scope: ['punctuation', 'meta.brace'], settings: { foreground: '#4a4338' } },
  ],
};

const dim = {
  name: 'dim',
  type: 'dark',
  colors: {
    'editor.background': '#1f1a13',
    'editor.foreground': '#e6dec8',
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#7d735a', fontStyle: 'italic' } },
    { scope: ['keyword', 'keyword.operator', 'storage', 'storage.type'], settings: { foreground: '#d8a070' } },
    { scope: ['string', 'punctuation.definition.string'], settings: { foreground: '#9ab068' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character.escape'], settings: { foreground: '#d4a83a' } },
    { scope: ['entity.name.function', 'support.function', 'meta.function-call'], settings: { foreground: '#e0b98a' } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class'], settings: { foreground: '#e6dec8', fontStyle: 'bold' } },
    { scope: ['variable', 'variable.other'], settings: { foreground: '#e6dec8' } },
    { scope: ['punctuation', 'meta.brace'], settings: { foreground: '#b8ad94' } },
  ],
};

export default defineConfig({
  site: 'https://loopctl.rs',
  vite: {
    build: {
      cssCodeSplit: false,
    },
  },
  server: { allowedHosts: ['fedora'] },
  preview: { allowedHosts: ['fedora'] },
  integrations: [
    starlight({
      title: 'loopctl',
      description:
        'A Rust framework for building agents: a sans-IO engine that runs the loop, pluggable model providers, plain-Rust tools, and the safety systems to keep runs alive.',
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/dch-labs/loopctl' }],
      customCss: ['./src/styles/custom.css'],
      components: { Head: './src/overrides/Head.astro' },
      expressiveCode: {
        themes: [paper, dim],
        styleOverrides: {
          borderRadius: '0px',
          codeFontSize: '0.85rem',
        },
      },
      sidebar: [
        { slug: 'guide', label: 'The Knowledge Base' },
        { label: 'Start here', items: [{ autogenerate: { directory: 'start-here' } }] },
        { label: 'Core data', items: [{ autogenerate: { directory: 'core-data' } }] },
        { label: 'The engine', items: [{ autogenerate: { directory: 'engine' } }] },
        { label: 'Safety systems', items: [{ autogenerate: { directory: 'safety' } }] },
        { label: 'Extensions', items: [{ autogenerate: { directory: 'extensions' } }] },
        { label: 'Providers', items: [{ autogenerate: { directory: 'providers' } }] },
        { label: 'Integration', items: [{ autogenerate: { directory: 'integration' } }] },
        { label: 'File reference', items: [{ autogenerate: { directory: 'file-reference', collapsed: true } }] },
        { label: 'Cookbook', items: [{ autogenerate: { directory: 'cookbook' } }] },
        { label: 'Principles', items: [{ autogenerate: { directory: 'principles' } }] },
        { slug: 'glossary', label: 'Glossary' },
      ],
    }),
  ],
});
