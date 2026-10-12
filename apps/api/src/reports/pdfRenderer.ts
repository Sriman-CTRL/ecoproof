import { chromium } from 'playwright';

export interface PdfOptions {
  /** Playwright footer HTML, repeated on every page (inline styles only). */
  footerTemplate: string;
}

/** HTML in, PDF bytes out. One Playwright implementation; deploy can swap in another. */
export interface PdfRenderer {
  render(html: string, opts: PdfOptions): Promise<Buffer>;
  close(): Promise<void>;
}

/** Container-safe flags: no user namespaces for the sandbox, and a small /dev/shm. */
const LAUNCH_ARGS = ['--no-sandbox', '--disable-dev-shm-usage'];

const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

/**
 * Launches Chromium for each PDF and closes it after, so an idle API holds no browser
 * (the free host has 512 MB). PDFs are rare, so the launch cost is acceptable.
 */
export class PlaywrightPdfRenderer implements PdfRenderer {
  private loggedMemory = false;

  async render(html: string, opts: PdfOptions): Promise<Buffer> {
    const browser = await chromium.launch({ args: LAUNCH_ARGS });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: opts.footerTemplate,
        margin: { top: '16mm', right: '14mm', bottom: '26mm', left: '14mm' },
      });
      if (!this.loggedMemory) {
        this.loggedMemory = true;
        const m = process.memoryUsage();
        console.log(
          `PDF render memory (API process, browser open): rss ${mb(m.rss)} MB, heap ${mb(m.heapUsed)} MB`,
        );
      }
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  /** Nothing to release: each render closes its own browser. */
  async close(): Promise<void> {}
}

export const pdfRenderer: PdfRenderer = new PlaywrightPdfRenderer();
