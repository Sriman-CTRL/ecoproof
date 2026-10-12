/**
 * Latin fonts load with the app (main.tsx). Telugu and Devanagari files load only when that
 * language is chosen, so an English user never downloads them.
 */
const loaded = new Set<string>();

/** Latin Extended (rupee sign) and the rest of the Latin families: after first paint. */
export const loadFullFonts = () => import('./fonts-full');

export function loadScriptFonts(lng: string): Promise<unknown> {
  if (loaded.has(lng)) return Promise.resolve();
  loaded.add(lng);
  if (lng === 'te') {
    return Promise.all([
      import('@fontsource-variable/anek-telugu'),
      import('@fontsource-variable/noto-sans-telugu'),
    ]);
  }
  if (lng === 'hi') {
    return Promise.all([
      import('@fontsource-variable/anek-devanagari'),
      import('@fontsource-variable/noto-sans-devanagari'),
    ]);
  }
  return Promise.resolve();
}

/** Screen readers and the browser's line breaking need the right <html lang>. */
export function applyLanguage(lng: string): void {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
  void loadScriptFonts(lng).catch(() => loaded.delete(lng));
}
