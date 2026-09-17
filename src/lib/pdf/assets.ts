import 'server-only';

import { readFile } from 'node:fs/promises';
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

/** The blank plan template: cover, first treatment page, continuation. */
export async function loadTemplatePdf(): Promise<Uint8Array> {
  const uploaded = (await getActiveTemplatePaths()).get('plan:shared');

  if (uploaded) {
    try {
      return await readFromStorage(uploaded);
    } catch {
      // Fall through to the bundled copy rather than failing the download.
    }
  }

  return readFromDisk(`bundled:${BUNDLED_PLAN_TEMPLATE}`, path.join('templates', BUNDLED_PLAN_TEMPLATE));
}

/** The team page appended to the end of a plan, one per clinic. */
export async function loadTeamPdf(team: Team): Promise<Uint8Array> {
  const uploaded = (await getActiveTemplatePaths()).get(`team:${team}`);

  if (uploaded) {
    try {
      return await readFromStorage(uploaded);
    } catch {
      // As above: a stale-but-working team page beats a failed download.
    }
  }

  const bundled = BUNDLED_TEAM_TEMPLATES[team];
  return readFromDisk(`bundled:${bundled}`, path.join('templates', bundled));
}

/** Drops every cached asset. */
export function clearAssetCache(): void {
  bytesCache.clear();
  templateLookup = null;
}
