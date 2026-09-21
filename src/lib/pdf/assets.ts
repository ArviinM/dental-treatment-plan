import 'server-only';

import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import path from 'node:path';

import { createAdminClient } from '@/lib/supabase/admin';
import type { Team } from '@/types';

/**
 * Loads the fixed assets the PDF renderer needs — the Nunito faces and the
 * blank templates — and keeps them in module scope.
 *
 * This caching is the main reason generation moved off the browser. Previously
 * every download re-fetched ~1.5 MB of fonts and templates; here a warm
 * function reads them once and reuses the bytes.
 *
 * Promises are cached rather than resolved values, so concurrent requests that
 * arrive before the first read finishes share it instead of starting their own.
 *
 * Templates resolve in two steps: whatever Ericka last uploaded, falling back to
 * the file bundled in public/. The fallback matters — it means a fresh database
 * still renders a correct plan, and a failed upload cannot take the app down.
 */

const PUBLIC_DIR = path.join(process.cwd(), 'public');

const FONT_FILES = {
  regular: 'Nunito-Regular.ttf',
  bold: 'Nunito-Bold.ttf',
} as const;

export type FontWeight = keyof typeof FONT_FILES;

/** Bundled fallbacks, used until something has been uploaded. */
const BUNDLED_TEAM_TEMPLATES: Record<Team, string> = {
  essendon: 'essendon-team.pdf',
  burwood: 'burwood-team.pdf',
  mulgrave: 'mulgrave-team.pdf',
};

const BUNDLED_PLAN_TEMPLATE = 'TreatmentPlanBlank.pdf';

/** Keyed by a stable identity — a storage path or a bundled filename — so a new
 *  upload is a cache miss rather than a stale hit. */
const bytesCache = new Map<string, Promise<Uint8Array>>();

/** How long a warm function may reuse its view of which template is current. */
const TEMPLATE_LOOKUP_TTL_MS = 60_000;

let templateLookup: { at: number; paths: Map<string, string> } | null = null;

function readFromDisk(key: string, relativePath: string): Promise<Uint8Array> {
  let pending = bytesCache.get(key);

  if (!pending) {
    pending = readFile(path.join(PUBLIC_DIR, relativePath))
      .then((buffer) => new Uint8Array(buffer))
      .catch((error: unknown) => {
        // Never cache a failure: a transient read error would otherwise stick
        // for the lifetime of the warm function.
        bytesCache.delete(key);
        throw new Error(
          `Could not read PDF asset "${relativePath}": ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      });

    bytesCache.set(key, pending);
  }

  return pending;
}

function readFromStorage(storagePath: string): Promise<Uint8Array> {
  let pending = bytesCache.get(storagePath);

  if (!pending) {
    // Service role: the plan-templates bucket is private and staff have no read
    // policy on it. They never touch it directly — the server renders for them.
    pending = createAdminClient()
      .storage.from('plan-templates')
      .download(storagePath)
      .then(async ({ data, error }) => {
        if (error || !data) throw new Error(error?.message ?? 'template download failed');
        return new Uint8Array(await data.arrayBuffer());
      })
      .catch((error: unknown) => {
        bytesCache.delete(storagePath);
        throw error;
      });

    bytesCache.set(storagePath, pending);
  }

  return pending;
}

/**
 * Which template is active for each slot, as `kind:clinicSlug` -> storage path.
 * Cached briefly so a burst of downloads is one lookup, not one per request.
 */
async function getActiveTemplatePaths(): Promise<Map<string, string>> {
  if (templateLookup && Date.now() - templateLookup.at < TEMPLATE_LOOKUP_TTL_MS) {
    return templateLookup.paths;
  }

  const paths = new Map<string, string>();

  try {
    const { data } = await createAdminClient()
      .from('templates')
      .select('kind, storage_path, clinics(slug)')
      .eq('is_active', true);

    for (const row of data ?? []) {
      paths.set(`${row.kind}:${row.clinics?.slug ?? 'shared'}`, row.storage_path);
    }
  } catch {
    // A database hiccup must not stop someone printing a plan. An empty map
    // means every slot falls back to its bundled file.
  }

  templateLookup = { at: Date.now(), paths };
  return paths;
}

/** Drops the memoised "which template is current" view after an upload. */
export function invalidateTemplateLookup(): void {
  templateLookup = null;
}

/** A Nunito face, as raw TTF bytes ready for `pdfDoc.embedFont`. */
export function loadFont(weight: FontWeight): Promise<Uint8Array> {
  return readFromDisk(`font:${weight}`, path.join('fonts', FONT_FILES[weight]));
}

export type LoadedTemplate = {
  doc: PDFDocument;
  /** Which file actually ended up in the plan — useful when diagnosing. */
  source: 'uploaded' | 'bundled';
};

/**
 * Opens a PDF, or returns null if it cannot be opened.
 *
 * A download failing and a file failing to PARSE are the same problem from the
 * user's side — the template is unusable — so both fall back the same way.
 * Before this, only the first did: an uploaded file that downloaded fine but
 * would not open failed the whole PDF instead of falling back.
 */
async function openPdf(bytes: Uint8Array): Promise<PDFDocument | null> {
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch {
    return null;
  }
}

/**
 * Tries an uploaded template, and falls back to the bundled original if it is
 * missing, unreachable or unreadable. The bundled file ships with the app and
 * is the one thing guaranteed to render, so a plan can ALWAYS be produced.
 */
async function loadWithFallback(
  uploadedPath: string | undefined,
  bundledKey: string,
  bundledFile: string
): Promise<LoadedTemplate> {
  if (uploadedPath) {
    try {
      const doc = await openPdf(await readFromStorage(uploadedPath));
      if (doc && doc.getPageCount() > 0) return { doc, source: 'uploaded' };

      // Storage path only — never anything from the plan being rendered.
      console.warn('uploaded template could not be opened; using the original', uploadedPath);
    } catch {
      console.warn('uploaded template could not be downloaded; using the original', uploadedPath);
    }
  }

  const doc = await openPdf(await readFromDisk(bundledKey, path.join('templates', bundledFile)));
  if (!doc) throw new Error(`The bundled template ${bundledFile} could not be opened.`);
  return { doc, source: 'bundled' };
}

/**
 * The plan template: cover, first treatment page, continuation.
 *
 * `overridePath` renders against a specific stored file instead of the live
 * one — how a draft is previewed before anyone publishes it.
 */
export async function loadPlanTemplate(overridePath?: string): Promise<LoadedTemplate> {
  const path_ = overridePath ?? (await getActiveTemplatePaths()).get('plan:shared');
  return loadWithFallback(path_, `bundled:${BUNDLED_PLAN_TEMPLATE}`, BUNDLED_PLAN_TEMPLATE);
}

/** The team page appended to the end of a plan, one per clinic. */
export async function loadTeamTemplate(team: Team, overridePath?: string): Promise<LoadedTemplate> {
  const path_ = overridePath ?? (await getActiveTemplatePaths()).get(`team:${team}`);
  const bundled = BUNDLED_TEAM_TEMPLATES[team];
  return loadWithFallback(path_, `bundled:${bundled}`, bundled);
}

/** Drops every cached asset. */
export function clearAssetCache(): void {
  bytesCache.clear();
  templateLookup = null;
}
