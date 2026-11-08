import { defineConfig, fontProviders } from 'astro/config';

// One property per build. scripts/run.mjs sets PROPERTY_SLUG.
const slug = process.env.PROPERTY_SLUG || 'kramim-bagalil';

// Subset ranges so the Latin file is never downloaded on a Hebrew-only page.
const HEBREW = ['U+0590-05FF', 'U+200C-2010', 'U+20AA', 'U+25CC', 'U+FB1D-FB4F'];
const LATIN = ['U+0000-00FF', 'U+0131', 'U+0152-0153', 'U+02BB-02BC', 'U+2000-206F', 'U+2122', 'U+2212', 'U+FEFF'];

const localFamily = (name, cssVariable, pkg, file, fallbacks) => ({
  provider: fontProviders.local(),
  name,
  cssVariable,
  fallbacks,
  optimizedFallbacks: true,
  display: 'swap',
  options: {
    variants: [
      { weight: '300 900', style: 'normal', unicodeRange: HEBREW, src: [`${pkg}/files/${file}-hebrew-wght-normal.woff2`] },
      { weight: '300 900', style: 'normal', unicodeRange: LATIN, src: [`${pkg}/files/${file}-latin-wght-normal.woff2`] },
    ],
  },
});

export default defineConfig({
  outDir: `./dist/${slug}`,
  site: process.env.SITE_URL || `https://${slug}.pages.dev`,
  // 'directory' so /gallery/ and /booking/ are real URLs on any static host.
  build: { inlineStylesheets: 'always', format: 'directory' },
  compressHTML: true,
  fonts: [
    // Display: Frank Ruhl Libre (SIL OFL). Body: Heebo (SIL OFL). Both self-hosted from npm.
    localFamily('Frank Ruhl Libre', '--font-display', '@fontsource-variable/frank-ruhl-libre', 'frank-ruhl-libre',
      ['David', 'Narkisim', 'Times New Roman', 'serif']),
    localFamily('Heebo', '--font-body', '@fontsource-variable/heebo', 'heebo',
      ['Arial Hebrew', 'Segoe UI', 'system-ui', 'sans-serif']),
  ],
});
