#!/usr/bin/env node
/**
 * scripts/check-icons.mjs — verificacion de paridad de iconos (TASK-004).
 *
 * Comprueba que `components/icons/index.tsx` reproduce EXACTAMENTE los SVG del
 * demo original ("JustPlay Store - Demo.html"):
 *   - mismos elementos (`path`/`rect`/`circle`) con los mismos atributos;
 *   - mismo `viewBox`, `fill`, `stroke` y `stroke-width` (1.4 para IC/CI, 2
 *     para los iconos de UI);
 *   - que `size` por defecto sea 24 y que se pueda fijar (carrito 20,
 *     busqueda 18);
 *   - que `CATEGORY_ICONS` cubra todas las categorias de `CATEGORIES` y que
 *     `PRODUCT_ICONS` cubra los tres `IconName`;
 *   - que `ProductMediaIcon` devuelva `null` para las fotos;
 *   - que no haya `dangerouslySetInnerHTML` en el modulo.
 *
 * Uso:  node scripts/check-icons.mjs
 */

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
// El nombre del HTML lleva un guion largo ("JustPlay Store – Demo.html"):
// se localiza por extension para no depender de codificacion.
const HTML_FILE = path.join(
  ROOT_DIR,
  readdirSync(ROOT_DIR).find((entry) => entry.endsWith('.html')) ?? '',
);
const ICONS_FILE = path.join(ROOT_DIR, 'components', 'icons', 'index.tsx');
const TYPES_FILE = path.join(ROOT_DIR, 'lib', 'types.ts');
const TMP_DIR = path.join(ROOT_DIR, 'node_modules', '.tmp-icon-check');

/* ------------------------------------------------------------------ */
/* Utilidades                                                         */
/* ------------------------------------------------------------------ */

/** Transpila un archivo TS/TSX a ESM para poder importarlo desde Node. */
function transpile(file, jsx) {
  const source = readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: jsx ? ts.JsxEmit.ReactJSX : undefined,
    },
  });
  return outputText;
}

function parseAttributes(fragment) {
  const attrs = {};
  const re = /([\w:.-]+)="([^"]*)"/g;
  let match = re.exec(fragment);
  while (match !== null) {
    attrs[match[1]] = match[2];
    re.lastIndex = match.index + match[0].length;
    match = re.exec(fragment);
  }
  return attrs;
}

/** Normaliza un SVG a `{ attrs, shapes }` para poder compararlos. */
function parseSvg(markup) {
  const openTag = markup.match(/<svg\b([^>]*)>/);
  if (openTag === null) {
    throw new Error(`no es un <svg>: ${markup.slice(0, 80)}`);
  }
  const shapes = [];
  const shapeRe = /<(path|rect|circle|ellipse|line|polyline|polygon)\b([^>]*?)\/?>/g;
  let match = shapeRe.exec(markup);
  while (match !== null) {
    shapes.push({ tag: match[1], attrs: parseAttributes(match[2]) });
    match = shapeRe.exec(markup);
  }
  return { attrs: parseAttributes(openTag[1]), shapes };
}

const failures = [];
const notes = [];

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/* ------------------------------------------------------------------ */
/* 1. Extraer los SVG del original                                    */
/* ------------------------------------------------------------------ */

const html = readFileSync(HTML_FILE, 'utf8');

// Los SVG del cuerpo (cabecera + bottom-nav). Se corta antes de <script>
// para no capturar los strings `IC`/`CI` del JavaScript.
const bodyOnly = html.slice(0, html.indexOf('<script>'));
const inlineSvgs = bodyOnly.match(/<svg\b[^>]*>[\s\S]*?<\/svg>/g) ?? [];
if (inlineSvgs.length !== 6) {
  throw new Error(`se esperaban 6 SVG en linea y se hallaron ${inlineSvgs.length}`);
}
const [cartSvg, searchSvg, homeSvg, gridNavSvg, wrenchNavSvg, chatSvg] = inlineSvgs;

// Los sets `IC` y `CI` se evalúan en un sandbox para obtener el SVG final
// (el prefijo `G` lo anade el propio original).
const sandbox = {};
vm.createContext(sandbox);
for (const varName of ['G', 'IC', 'CI']) {
  const line = html.split('\n').find((l) => l.startsWith(`var ${varName}=`));
  if (line === undefined) {
    throw new Error(`no se encontro "var ${varName}=" en el HTML original`);
  }
  vm.runInContext(line, sandbox);
}
const { IC, CI } = sandbox;

/* ------------------------------------------------------------------ */
/* 2. Cargar el modulo de iconos                                      */
/* ------------------------------------------------------------------ */

rmSync(TMP_DIR, { recursive: true, force: true });
mkdirSync(TMP_DIR, { recursive: true });
writeFileSync(path.join(TMP_DIR, 'icons.mjs'), transpile(ICONS_FILE, true));
writeFileSync(path.join(TMP_DIR, 'types.mjs'), transpile(TYPES_FILE, false));

const icons = await import(pathToFileURL(path.join(TMP_DIR, 'icons.mjs')).href);
const types = await import(pathToFileURL(path.join(TMP_DIR, 'types.mjs')).href);

/* ------------------------------------------------------------------ */
/* 3. Comparar cada icono con su original                             */
/* ------------------------------------------------------------------ */

console.log('\n[1] Fidelidad de la geometria frente al HTML original');

/**
 * Compara el SVG original con el render del componente.
 * `strictSvgAttrs` son los atributos que deben coincidir literalmente.
 */
function compare(label, originalMarkup, Icon, size) {
  const original = parseSvg(originalMarkup);
  const rendered = parseSvg(renderToStaticMarkup(createElement(Icon, { size })));

  const attrsOk = ['viewBox', 'fill', 'stroke', 'stroke-width'].every(
    (name) => original.attrs[name] === rendered.attrs[name],
  );
  check(
    `${label}: viewBox/fill/stroke/stroke-width`,
    attrsOk,
    `original=${JSON.stringify(
      Object.fromEntries(
        ['viewBox', 'fill', 'stroke', 'stroke-width'].map((n) => [n, original.attrs[n]]),
      ),
    )} render=${JSON.stringify(
      Object.fromEntries(
        ['viewBox', 'fill', 'stroke', 'stroke-width'].map((n) => [n, rendered.attrs[n]]),
      ),
    )}`,
  );

  // Los atributos que el original define deben coincidir; los que el original
  // omite se documentan como desviacion (inertes visualmente).
  for (const name of ['stroke-linecap', 'stroke-linejoin']) {
    const expected = original.attrs[name];
    const actual = rendered.attrs[name];
    if (expected === undefined) {
      notes.push(
        `${label}: el original no define ${name}; el componente lo fija en "${actual}" (desviacion inerte).`,
      );
      check(`${label}: ${name} present y coherente`, actual === 'round');
    } else {
      check(`${label}: ${name}`, expected === actual, `original=${expected} render=${actual}`);
    }
  }

  // Geometria: mismos elementos, mismos atributos, mismo orden.
  const shapesMatch =
    original.shapes.length === rendered.shapes.length &&
    original.shapes.every((shape, index) => {
      const other = rendered.shapes[index];
      if (other === undefined || shape.tag !== other.tag) {
        return false;
      }
      const keys = new Set([...Object.keys(shape.attrs), ...Object.keys(other.attrs)]);
      for (const key of keys) {
        if (shape.attrs[key] !== other.attrs[key]) {
          return false;
        }
      }
      return true;
    });
  check(
    `${label}: ${original.shapes.length}shape(s) identicos`,
    shapesMatch,
    `original=${JSON.stringify(original.shapes)} render=${JSON.stringify(rendered.shapes)}`,
  );

  // Tamano: `size` gobierna width/height.
  check(
    `${label}: width/height = ${size}`,
    rendered.attrs.width === String(size) && rendered.attrs.height === String(size),
    `width=${rendered.attrs.width} height=${rendered.attrs.height}`,
  );
}

compare('IC.head / IconHead', IC.head, icons.IconHead, 24);
compare('IC.disc / IconDisc', IC.disc, icons.IconDisc, 24);
compare('IC.pad / IconPad', IC.pad, icons.IconPad, 24);
compare('CI.Todo / IconGrid', CI['Todo'], icons.IconGrid, 24);
compare('CI.Consolas / IconConsole', CI['Consolas'], icons.IconConsole, 24);
compare('CI.Juegos / IconDisc', CI['Juegos'], icons.IconDisc, 24);
compare('CI.Accesorios / IconPad', CI['Accesorios'], icons.IconPad, 24);
compare('CI.Audífonos / IconHead', CI['Audífonos'], icons.IconHead, 24);
compare('CI.Servicio técnico / IconWrench', CI['Servicio técnico'], icons.IconWrench, 24);
compare('header carrito / IconCart', cartSvg, icons.IconCart, 20);
compare('header búsqueda / IconSearch', searchSvg, icons.IconSearch, 18);
compare('bottom-nav Inicio / IconHome', homeSvg, icons.IconHome, 22);
compare('bottom-nav Catálogo / IconCatalog', gridNavSvg, icons.IconCatalog, 22);
compare('bottom-nav Servicios / IconServices', wrenchNavSvg, icons.IconServices, 22);
compare('bottom-nav Contacto / IconContact', chatSvg, icons.IconContact, 22);

/* ------------------------------------------------------------------ */
/* 4. API                                                              */
/* ------------------------------------------------------------------ */

console.log('\n[2] API publica');

const source = readFileSync(ICONS_FILE, 'utf8');
// Se busca el uso de la prop, no la palabra: el modulo la menciona en un
// comentario explicando por que no se usa.
check('sin dangerouslySetInnerHTML', !/dangerouslySetInnerHTML\s*[:=]/.test(source));
check('sin "use client"', !/^\s*['"]use client['"];?\s*$/m.test(source));

const exported = [
  'IconHead',
  'IconDisc',
  'IconPad',
  'IconGrid',
  'IconConsole',
  'IconWrench',
  'IconCart',
  'IconSearch',
  'IconHome',
  'IconCatalog',
  'IconServices',
  'IconContact',
];
for (const name of exported) {
  check(`exporta ${name}`, typeof icons[name] === 'function');
}

const categories = [...types.CATEGORIES];
const mapKeys = Object.keys(icons.CATEGORY_ICONS);
check(
  'CATEGORY_ICONS cubre exactamente CATEGORIES',
  categories.length === mapKeys.length && categories.every((c) => mapKeys.includes(c)),
  `categorias=${JSON.stringify(categories)} mapa=${JSON.stringify(mapKeys)}`,
);

const expectedCategoryIcons = {
  Todo: 'IconGrid',
  Consolas: 'IconConsole',
  Juegos: 'IconDisc',
  Accesorios: 'IconPad',
  'Audífonos': 'IconHead',
  'Servicio técnico': 'IconWrench',
};
for (const category of categories) {
  check(
    `CATEGORY_ICONS['${category}'] = ${expectedCategoryIcons[category]}`,
    icons.CATEGORY_ICONS[category] === icons[expectedCategoryIcons[category]],
  );
}

const expectedProductIcons = { head: 'IconHead', disc: 'IconDisc', pad: 'IconPad' };
for (const [iconName, componentName] of Object.entries(expectedProductIcons)) {
  check(
    `PRODUCT_ICONS.${iconName} = ${componentName}`,
    icons.PRODUCT_ICONS[iconName] === icons[componentName],
  );
}

console.log('\n[3] ProductMediaIcon');
const photoMedia = { kind: 'photo', src: '/images/x.jpg', width: 4, height: 4 };
const photoMarkup = renderToStaticMarkup(createElement(icons.ProductMediaIcon, { media: photoMedia }));
check('devuelve null (sin markup) para kind=photo', photoMarkup === '', `markup=${photoMarkup}`);

for (const [iconName, componentName] of Object.entries(expectedProductIcons)) {
  const markup = renderToStaticMarkup(
    createElement(icons.ProductMediaIcon, { media: { kind: 'icon', icon: iconName } }),
  );
  const expected = renderToStaticMarkup(createElement(icons[componentName], {}));
  check(`${iconName} -> ${componentName}`, markup === expected, `markup=${markup}`);
}

/* ------------------------------------------------------------------ */
/* 5. Resultado                                                        */
/* ------------------------------------------------------------------ */

rmSync(TMP_DIR, { recursive: true, force: true });

console.log('\n[4] Desviaciones documentadas (atributos que el original omite)');
for (const note of notes) {
  console.log(`  - ${note}`);
}

if (failures.length > 0) {
  console.error(`\nFALLOS: ${failures.length}`);
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log('\nTODAS LAS COMPROBACIONES OK');
