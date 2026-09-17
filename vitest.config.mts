import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

// The integration suite talks to the real Supabase project, so it needs the
// same credentials the app uses.
config({ path: '.env.local', quiet: true });

export default defineConfig({
  // Vite resolves the "@/*" tsconfig paths natively; no plugin needed.
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The integration tests share one database. Running files in parallel would
    // let one file's cleanup delete another file's fixtures.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
