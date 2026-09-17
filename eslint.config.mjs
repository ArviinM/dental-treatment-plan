import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

/**
 * eslint-config-next 16 ships flat configs, so they are spread directly rather
 * than bridged through FlatCompat.
 */
const config = [
  ...nextCoreWebVitals,
  ...nextTypeScript,

  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'public/**'],
  },

  {
    rules: {
      // Purely about writing ' and " as HTML entities inside JSX text. React
      // renders the literal characters correctly, and enforcing it means
      // rewriting user-facing copy to satisfy a linter.
      'react/no-unescaped-entities': 'off',
    },
  },

  {
    // The frozen legacy surface: the original single-page generator and the
    // services it depends on. This code predates the Next migration, works, and
    // is deliberately not being refactored — Ericka's team has habits built on
    // it. These rules stay visible as warnings so nothing is hidden, but they
    // do not fail the build for code we have chosen not to touch.
    //
    // Anything NEW must satisfy them as errors. Do not widen this list.
    files: [
      'src/components/legacy/**',
      'src/components/forms/**',
      'src/components/preview/**',
      'src/components/settings/**',
      'src/services/**',
    ],
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@next/next/no-img-element': 'warn',
    },
  },
];

export default config;
