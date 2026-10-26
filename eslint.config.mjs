/**
 * ESLint 9 — configuracion flat nativa de JustPlay Store.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE ARCHIVO NO USA `extends: 'next/core-web-vitals'`
 * ---------------------------------------------------------------------------
 * `eslint-config-next@15.5.28` se publica en formato **eslintrc (legacy)** y
 * delega su migracion a flat config en `@rushstack/eslint-patch@1.16.1`.
 * Ese parche localiza el cargador de configuracion buscando en la pila un
 * frame terminado en `eslint.js`, pero ESLint 9 movio ese cargador a
 * `lib/config/config-loader.js`; por eso `eslint .` moria con
 *
 *   "Failed to patch ESLint because the calling module was not recognized"
 *
 * ANTES de analizar un solo archivo. No era un problema del codigo fuente,
 * era incompatibilidad de toolchain.
 *
 * Aqui se sustituye `FlatCompat` por flat config nativa: se importan los
 * plugins directamente y se replican las reglas que aplicaban
 * `next/core-web-vitals` + `next/typescript`.
 *
 * ---------------------------------------------------------------------------
 * DEPENDENCIAS TRANSITIVAS (pendiente de declarar en `package.json`)
 * ---------------------------------------------------------------------------
 * Ninguno de los paquetes de abajo figura hoy en `package.json`: todos llegan
 * como dependencias transitivas de `eslint-config-next`. Si alguien reinstala
 * con `--omit=dev`, cambia de gestor de paquetes o sube `eslint-config-next` a
 * una version que deje de exponerlos, ESTE ARCHIVO DEJA DE CARGAR y
 * `npm run lint` vuelve a romperse.
 *
 * Pendiente (fase aparte, con el arbol quieto): declararlos como
 * `devDependencies` explicitos, con estos rangos:
 *
 *   @next/eslint-plugin-next        15.5.28  -> "^15.5.28"
 *   eslint-plugin-react-hooks       5.2.0    -> "^5.2.0"
 *   @typescript-eslint/eslint-plugin 8.72.0  -> "^8.72.0"
 *   @typescript-eslint/parser       8.72.0   -> "^8.72.0"
 *   globals                         14.0.0   -> "^14.0.0"
 *
 * (Los rangos son los de las versiones ya instaladas; conviene comprobar que
 * siguen satisfaciendose cuando se declare `eslint-config-next`.)
 */

import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

// Ficheros TypeScript. El parser de TS y el de TSX se configuran por separado
// porque `@typescript-eslint/parser` NO detecta la extension: lee el flag
// `ecmaFeatures.jsx` y, si esta activo, interpretaria los genericos de un
// `.ts` como JSX.
const TS_FILES = ['**/*.ts', '**/*.mts', '**/*.cts'];
const TSX_FILES = ['**/*.tsx'];

// Reglas de `plugin:@typescript-eslint/recommended`, que es lo que activaba
// `next/typescript`. Se leen del preset flat del propio plugin para no
// duplicar la lista a mano.
const tsFlatRecommended = tsPlugin.configs['flat/recommended'];
const tsEslintRecommended = tsFlatRecommended.find(
  (config) => config.name === 'typescript-eslint/eslint-recommended',
);
const tsRecommended = tsFlatRecommended.find(
  (config) => config.name === 'typescript-eslint/recommended',
);

const tsRules = {
  // `typescript-eslint/eslint-recommended` desactiva las reglas base de ESLint
  // que TypeScript ya cubre (evita reportes duplicados).
  ...tsEslintRecommended.rules,
  // `typescript-eslint/recommended`.
  ...tsRecommended.rules,
  // `next/typescript` bajaba estas dos reglas a "warn" (nivel 1) sobre el
  // "error" que pone el preset recomendado.
  '@typescript-eslint/no-unused-vars': 'warn',
  '@typescript-eslint/no-unused-expressions': 'warn',
};

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'public/**',
    ],
  },

  // Globales y ajustes base para todo lo que se analice. Equivale al
  // `env: { browser: true, node: true }` que declaraba la base eslintrc de
  // `eslint-config-next`.
  {
    name: 'justplay-store/base',
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  // --- Next.js -------------------------------------------------------------
  // `recommended` primero y `core-web-vitals` despues: el segundo pisa al
  // primero y sube a "error" `no-html-link-for-pages` y `no-sync-scripts`
  // (mismo resultado que `next/core-web-vitals` en formato legacy).
  // El preset flat de core-web-vitals ya incluye todas las reglas de
  // `recommended` (entre ellas `@next/next/no-img-element`).
  nextPlugin.flatConfig.recommended,
  nextPlugin.flatConfig.coreWebVitals,

  // --- React Hooks 5.x -----------------------------------------------------
  // `eslint-plugin-react-hooks@5` expone su config flat en
  // `configs['recommended-latest']`; no existe `configs.flat`.
  reactHooks.configs['recommended-latest'],

  // --- TypeScript ----------------------------------------------------------
  {
    name: 'justplay-store/typescript',
    files: TS_FILES,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: false },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: tsRules,
  },
  {
    name: 'justplay-store/typescript-jsx',
    files: TSX_FILES,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: tsRules,
  },

  // El script de extraccion corre en Node, no en el navegador.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        URL: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
];
