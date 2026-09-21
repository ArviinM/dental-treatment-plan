type PdfJs = typeof import('pdfjs-dist');

let pdfJsPromise: Promise<PdfJs> | null = null;

/**
 * Loads PDF.js on first use rather than at module scope. Browser only.
 *
 * Importing it eagerly breaks the production build: modules that reach it are
 * reachable from pages Next prerenders, and PDF.js touches browser-only globals
 * (`DOMMatrix`) the moment it is evaluated. Deferring the import also keeps a
 * large dependency out of the initial bundle, since importing a plan or
 * uploading a template are occasional actions.
 *
 * Shared by plan import and template previews so there is one worker setup.
 * The worker is resolved relative to this module — Vite's `?url` import does
 * not exist under Next, but both Turbopack and webpack understand `new URL`.
 */
export async function getPdfJs(): Promise<PdfJs> {
  pdfJsPromise ??= import('pdfjs-dist').then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    return lib;
  });

  return pdfJsPromise;
}
