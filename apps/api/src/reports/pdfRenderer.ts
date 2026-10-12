import { chromium, type Browser } from 'playwright';

export interface PdfOptions {
  /** Playwright footer HTML, repeated on every page (inline styles only). */
  footerTemplate: string;
}

/** HTML in, PDF bytes out. One Playwright implementation; deploy can swap in another. */
export interface PdfRenderer {
  render(html: string, opts: PdfOptions): Promise<Buffer>;
  close(): Promise<void>;
}

export class PlaywrightPdfRenderer implements PdfRenderer {
  private browser: Promise<Browser> | null = null;

  private launch(): Promise<Browser> {
    this.browser ??= chromium.launch().catch((e: unknown) => {
      this.browser = null;
      throw e;
    });
    return this.browser;
  }

  async render(html: string, opts: PdfOptions): Promise<Buffer> {
    const browser = await this.launch();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: opts.footerTemplate,
        margin: { top: '16mm', right: '14mm', bottom: '26mm', left: '14mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    const b = this.browser;
    this.browser = null;
    if (b) await (await b).close();
  }
}

export const pdfRenderer: PdfRenderer = new PlaywrightPdfRenderer();
