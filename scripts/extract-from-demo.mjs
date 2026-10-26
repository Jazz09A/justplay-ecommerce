#!/usr/bin/env node
/**
 * scripts/extract-from-demo.mjs
 *
 * TASK-002 del PLAN.md — extraccion programatica de los datos y las imagenes del
 * demo original "JustPlay Store - Demo.html".
 *
 * Por que es un script y no una transcripcion manual (riesgo R1):
 * los productos con foto viven en las lineas 213-215 del HTML, cada una con
 * miles de caracteres (payloads base64). Cualquier lectura por vista previa
 * trunca a 2000 caracteres y hace creer que faltan `options`/`description`/
 * `features`. Aqui el array se localiza y se evalua en un sandbox de Node
 * (`node:vm`), de modo que los datos nunca pasan por el canal humano.
 *
 * Salidas:
 *   - public/images/<6 jpeg>   (los 6 data URI del HTML, decodificados)
 *   - public/images/manifest.json  (inventario de imagenes + datos de producto)
 *
 * El script es idempotente: al reejecutarlo produce exactamente los mismos
 * bytes y no duplica ni corrompe archivos.
 *
 * Uso:  node scripts/extract-from-demo.mjs
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

/* ------------------------------------------------------------------ */
/* Configuracion                                                       */
/* ------------------------------------------------------------------ */

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const SOURCE_HTML = path.join(ROOT_DIR, 'JustPlay Store – Demo.html');
const IMAGES_DIR = path.join(ROOT_DIR, 'public', 'images');
const MANIFEST_FILE = path.join(IMAGES_DIR, 'manifest.json');

/** El demo original define exactamente 6 productos. */
const EXPECTED_PRODUCT_COUNT = 6;

/** Magic bytes de un JPEG (SOI + inicio de marcador). */
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

/**
 * Los 3 <img> sueltos del HTML original (fuera del array P) y su archivo.
 * El contexto se busca hacia atras en el HTML para no depender del orden.
 * Plan §4 (estructura de carpetas).
 */
const BODY_IMAGE_SLOTS = [
  { slot: 'logo', file: 'logo.jpg', context: /class="logo"/ },
  { slot: 'hero', file: 'hero.jpg', context: /class="hi"/ },
  { slot: 'servicios', file: 'servicios.jpg', context: /class="svc"/ },
];

/**
 * Fotos de producto -> archivo, indexadas por legacyIndex (p0, p1, p2).
 * El resto de productos usan icono SVG y no generan archivo.
 * Plan §4 y §5.1.
 */
const PRODUCT_IMAGE_FILES = [
  'ps5-slim.jpg',
  'control-dualsense-ps5.jpg',
  'mantenimiento-ps5.jpg',
];

/** Marcadores SOF (Start Of Frame) de JPEG: los que llevan dimensiones. */
const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

/* ------------------------------------------------------------------ */
/* 1. Extraccion del literal del array P                              */
/* ------------------------------------------------------------------ */

/**
 * Localiza `var P=[` y devuelve el literal completo del array, respetando
 * cadenas y escapes (no se puede partir por comas: el interior de los data URI
 * base64 es opaco pero el codigo JS alrededor tiene comas estructurales).
 */
function extractArrayLiteral(html, marker) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`No se encontro el marcador "${marker}" en el HTML original`);
  }

  const start = markerIndex + marker.length - 1; // indice del '['
  let depth = 0;
  let quote = null;
  let index = start;

  while (index < html.length) {
    const char = html[index];

    if (quote !== null) {
      if (char === '\\') {
        index += 2;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      index += 1;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      index += 1;
      continue;
    }

    if (char === '[' || char === '{' || char === '(') {
      depth += 1;
      index += 1;
      continue;
    }

    if (char === ']' || char === '}' || char === ')') {
      depth -= 1;
      index += 1;
      if (depth === 0) {
        return html.slice(start, index);
      }
      continue;
    }

    index += 1;
  }

  throw new Error('El literal del array no se cerro correctamente');
}

/**
 * Evalua el array de productos en un sandbox sin acceso a `require`, `process`
 * ni a la red, y normaliza el resultado a objetos planos del realm actual.
 */
function parseProducts(html) {
  const literal = extractArrayLiteral(html, 'var P=[');
  const context = vm.createContext(Object.create(null));
  const evaluated = vm.runInContext(`(${literal})`, context, { timeout: 10_000 });

  if (!Array.isArray(evaluated)) {
    throw new Error('El literal del array P no evalua a un array');
  }

  return JSON.parse(JSON.stringify(evaluated));
}

/* ------------------------------------------------------------------ */
/* 2. Busqueda de los data URI de imagen                                */
/* ------------------------------------------------------------------ */

const IMG_TAG_PATTERN = /<img\b[^>]*\bsrc="data:image\/jpeg;base64,([A-Za-z0-9+/=]+)"[^>]*>/g;

/**
 * Devuelve los <img> del HTML original (los 3 de la pagina; los de los
 * productos viven dentro del literal JS y se resuelven aparte), clasificando
 * cada uno por el contexto que lo precede.
 */
function extractBodyImages(html) {
  const matches = [...html.matchAll(IMG_TAG_PATTERN)];
  const found = [];

  for (const match of matches) {
    const before = html.slice(Math.max(0, match.index - 200), match.index);
    const candidates = BODY_IMAGE_SLOTS.filter((slot) => slot.context.test(before));

    if (candidates.length === 0) {
      throw new Error(
        'No se pudo identificar el hueco del DOM de un <img> con data URI ' +
          `(contexto previo: ${JSON.stringify(before.slice(-80))})`,
      );
    }
    if (candidates.length > 1) {
      throw new Error(
        'El contexto previo de un <img> con data URI es ambiguo: ' +
          candidates.map((slot) => slot.slot).join(', '),
      );
    }

    found.push({ ...candidates[0], base64: match[1] });
  }

  return found;
}

/* ------------------------------------------------------------------ */
/* 3. Validacion y analisis de JPEG                                    */
/* ------------------------------------------------------------------ */

/**
 * Valida la estructura completa del JPEG (SOI -> segmentos -> scan -> EOI) y
 * devuelve sus dimensiones reales, leidas del marcador SOF. No se asumen: se
 * parsean.
 */
function analyzeJpeg(buffer, label) {
  if (buffer.length < 4) {
    throw new Error(`${label}: el archivo es demasiado corto (${buffer.length} bytes)`);
  }
  if (!buffer.subarray(0, 3).equals(JPEG_MAGIC)) {
    throw new Error(
      `${label}: magic bytes invalidos (${buffer.subarray(0, 3).toString('hex')}), se esperaba ffd8ff`,
    );
  }

  let width = 0;
  let height = 0;
  let components = 0;
  let sawSof = false;
  let sawEoi = false;
  let offset = 2; // despues de SOI

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      throw new Error(
        `${label}: byte inesperado 0x${buffer[offset].toString(16)} en el offset ${offset} ` +
          '(se esperaba un marcador JPEG)',
      );
    }

    let marker = buffer[offset + 1];
    while (marker === 0xff) {
      offset += 1;
      if (offset + 1 >= buffer.length) {
        throw new Error(`${label}: el archivo termina dentro de un marcador`);
      }
      marker = buffer[offset + 1];
    }
    offset += 2; // ahora `offset` apunta a la longitud del segmento

    if (marker === 0xd9) {
      sawEoi = true;
      break;
    }

    // Marcadores sin payload: TEM (0x01) y RSTn (0xd0-0xd7).
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    if (offset + 1 >= buffer.length) {
      throw new Error(`${label}: segmento truncado en el offset ${offset}`);
    }

    const length = buffer.readUInt16BE(offset);
    if (length < 2) {
      throw new Error(`${label}: longitud de segmento invalida (${length}) en el offset ${offset}`);
    }

    const payloadStart = offset + 2;
    const nextOffset = payloadStart + length - 2;
    if (nextOffset > buffer.length) {
      throw new Error(
        `${label}: segmento truncado en el offset ${offset} (longitud ${length}, archivo de ${buffer.length} bytes)`,
      );
    }

    if (SOF_MARKERS.has(marker)) {
      if (payloadStart + 6 > buffer.length) {
        throw new Error(`${label}: marcador SOF truncado`);
      }
      height = buffer.readUInt16BE(payloadStart + 1);
      width = buffer.readUInt16BE(payloadStart + 3);
      components = buffer[payloadStart + 5];
      sawSof = true;
    }

    if (marker === 0xda) {
      // SOS: a partir de aqui van los datos codificados con entropia.
      // Se avanza hasta el siguiente marcador real (fin del scan).
      offset = nextOffset;
      while (offset < buffer.length - 1) {
        if (buffer[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const next = buffer[offset + 1];
        if (next === 0x00) {
          offset += 2; // byte stuffing
          continue;
        }
        if (next >= 0xd0 && next <= 0xd7) {
          offset += 2; // marcador de reinicio
          continue;
        }
        break; // fin del scan: el loop exterior leera este marcador
      }
      continue;
    }

    offset = nextOffset;
  }

  if (!sawSof) {
    throw new Error(`${label}: el JPEG no contiene ningun marcador SOF (no se pueden leer las dimensiones)`);
  }
  if (!sawEoi) {
    throw new Error(`${label}: el JPEG esta truncado (no se encontro el marcador EOI)`);
  }
  if (width <= 0 || height <= 0) {
    throw new Error(`${label}: dimensiones invalidas (${width}x${height})`);
  }
  if (components <= 0) {
    throw new Error(`${label}: numero de componentes invalido (${components})`);
  }

  return { width, height, components };
}

/** Decodifica un data URI JPEG validando el alfabeto base64. */
function decodeJpegDataUri(dataUri, label) {
  const prefix = 'data:image/jpeg;base64,';
  if (!dataUri.startsWith(prefix)) {
    throw new Error(`${label}: el data URI no es un JPEG base64`);
  }

  const base64 = dataUri.slice(prefix.length);
  if (base64.length === 0 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new Error(`${label}: el payload base64 no es valido`);
  }

  return Buffer.from(base64, 'base64');
}

/* ------------------------------------------------------------------ */
/* 4. Validaciones de negocio (fallan ruidosamente)                   */
/* ------------------------------------------------------------------ */

function validateProducts(products) {
  if (products.length !== EXPECTED_PRODUCT_COUNT) {
    throw new Error(
      `Se esperaban ${EXPECTED_PRODUCT_COUNT} productos en el HTML original y se encontraron ${products.length}`,
    );
  }

  products.forEach((product, index) => {
    const label = `producto[${index}]`;
    if (typeof product.n !== 'string' || product.n.trim() === '') {
      throw new Error(`${label}: falta el nombre`);
    }
    if (typeof product.c !== 'string' || product.c.trim() === '') {
      throw new Error(`${label} (${product.n}): falta la categoria`);
    }
    if (typeof product.p !== 'number' || !Number.isFinite(product.p)) {
      throw new Error(`${label} (${product.n}): el precio no es un numero`);
    }
    if (!Array.isArray(product.o) || product.o.length === 0) {
      throw new Error(`${label} (${product.n}): "options" esta vacio`);
    }
    if (typeof product.d !== 'string' || product.d.trim() === '') {
      throw new Error(`${label} (${product.n}): "description" esta vacia`);
    }
    if (!Array.isArray(product.f) || product.f.length === 0) {
      throw new Error(`${label} (${product.n}): "features" esta vacio`);
    }
    const hasPhoto = typeof product.img === 'string' && product.img !== '';
    const hasIcon = typeof product.ic === 'string' && product.ic !== '';
    if (!hasPhoto && !hasIcon) {
      throw new Error(`${label} (${product.n}): no tiene ni "img" (foto) ni "ic" (icono)`);
    }
    if (hasPhoto && hasIcon) {
      throw new Error(`${label} (${product.n}): tiene a la vez "img" (foto) e "ic" (icono)`);
    }
  });
}

/* ------------------------------------------------------------------ */
/* 5. Escritura idempotente                                           */
/* ------------------------------------------------------------------ */

async function writeIfChanged(filePath, buffer) {
  try {
    const current = await readFile(filePath);
    if (current.equals(buffer)) {
      return false;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
    // El archivo no existe todavia: se escribe.
  }
  await writeFile(filePath, buffer);
  return true;
}

/* ------------------------------------------------------------------ */
/* Programa principal                                                  */
/* ------------------------------------------------------------------ */

async function main() {
  const html = await readFile(SOURCE_HTML, 'utf8');

  const products = parseProducts(html);
  validateProducts(products);

  const bodyImages = extractBodyImages(html);

  const photoEntries = products
    .map((product, legacyIndex) => ({ product, legacyIndex }))
    .filter(({ product }) => typeof product.img === 'string' && product.img !== '');
  if (photoEntries.length !== PRODUCT_IMAGE_FILES.length) {
    throw new Error(
      `Se esperaban ${PRODUCT_IMAGE_FILES.length} productos con foto y se encontraron ${photoEntries.length}`,
    );
  }

  await mkdir(IMAGES_DIR, { recursive: true });

  /** @type {Map<string, Buffer>} archivo -> bytes decodificados */
  const imageBuffers = new Map();

  // --- Imagenes sueltas del HTML original (logo, hero, servicios) ---
  for (const slot of BODY_IMAGE_SLOTS) {
    const found = bodyImages.find((image) => image.slot === slot.slot);
    if (!found) {
      throw new Error(`No se encontro el <img> del hueco "${slot.slot}" en el HTML original`);
    }
    imageBuffers.set(slot.file, decodeJpegDataUri(`data:image/jpeg;base64,${found.base64}`, slot.slot));
  }

  // --- Fotos de producto (p0, p1, p2) ---
  photoEntries.forEach(({ product, legacyIndex }, index) => {
    imageBuffers.set(
      PRODUCT_IMAGE_FILES[index],
      decodeJpegDataUri(product.img, `producto[${legacyIndex}] ${product.n}`),
    );
  });

  /** @type {Array<{slot: string, file: string, path: string, src: string, bytes: number, sha256: string, width: number, height: number, duplicateOf: string | null}>} */
  const images = [];
  const bySha = new Map();

  const registerImage = (slot, file, buffer) => {
    const dimensions = analyzeJpeg(buffer, file);
    const digest = sha256(buffer);
    const relativePath = toPosix(path.relative(ROOT_DIR, path.join(IMAGES_DIR, file)));

    const duplicateOf = bySha.has(digest) ? bySha.get(digest) : null;
    if (!duplicateOf) {
      bySha.set(digest, relativePath);
    }

    images.push({
      slot,
      file,
      path: relativePath,
      src: `/images/${file}`,
      bytes: buffer.length,
      sha256: digest,
      width: dimensions.width,
      height: dimensions.height,
      components: dimensions.components,
      duplicateOf,
    });
  };

  for (const slot of BODY_IMAGE_SLOTS) {
    registerImage(slot.slot, slot.file, imageBuffers.get(slot.file));
  }
  photoEntries.forEach(({ product }, index) => {
    registerImage(`producto:${product.n}`, PRODUCT_IMAGE_FILES[index], imageBuffers.get(PRODUCT_IMAGE_FILES[index]));
  });

  // --- Manifest de productos ---
  const photoFileByLegacyIndex = new Map();
  photoEntries.forEach(({ legacyIndex }, index) => {
    photoFileByLegacyIndex.set(legacyIndex, PRODUCT_IMAGE_FILES[index]);
  });

  const manifestProducts = products.map((product, legacyIndex) => {
    const photoFile = photoFileByLegacyIndex.get(legacyIndex);
    let media;

    if (photoFile !== undefined) {
      const image = images.find((entry) => entry.file === photoFile);
      media = { kind: 'photo', src: `/images/${photoFile}`, width: image.width, height: image.height };
    } else {
      media = { kind: 'icon', icon: product.ic };
    }

    return {
      legacyIndex,
      name: product.n,
      category: product.c,
      price: product.p,
      options: product.o,
      description: product.d,
      features: product.f,
      media,
    };
  });

  const manifest = {
    source: path.basename(SOURCE_HTML),
    generator: 'scripts/extract-from-demo.mjs',
    productCount: manifestProducts.length,
    images: images.map(({ slot, file, path: relativePath, src, bytes, sha256: digest, width, height, duplicateOf }) => ({
      slot,
      file,
      path: relativePath,
      src,
      bytes,
      sha256: digest,
      width,
      height,
      duplicateOf,
    })),
    products: manifestProducts,
  };

  // --- Escritura (idempotente) ---
  const written = [];
  for (const [file, buffer] of imageBuffers) {
    const changed = await writeIfChanged(path.join(IMAGES_DIR, file), buffer);
    written.push({ file, changed, bytes: buffer.length });
  }

  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestChanged = await writeIfChanged(MANIFEST_FILE, Buffer.from(manifestJson, 'utf8'));

  // --- Reporte ---
  console.log('Extraccion completada.');
  console.log(`  HTML origen : ${path.basename(SOURCE_HTML)}`);
  console.log(`  Productos   : ${manifestProducts.length}`);
  console.log(`  Imagenes    : ${images.length}`);
  console.log('');
  console.log('IMAGENES');
  console.log('  ruta                      bytes   sha256(8)  dims        duplicado');
  for (const image of images) {
    console.log(
      `  ${image.path.padEnd(25)} ${String(image.bytes).padStart(6)}   ` +
        `${image.sha256.slice(0, 8)}      ${`${image.width}x${image.height}`.padEnd(11)} ` +
        `${image.duplicateOf ?? 'no'}`,
    );
  }
  console.log('');
  console.log('PRODUCTOS');
  console.log('  #  nombre                             categoria          precio  options  features  desc');
  manifestProducts.forEach((product) => {
    console.log(
      `  ${product.legacyIndex}  ${product.name.padEnd(33)} ${product.category.padEnd(18)} ` +
        `${String(product.price).padStart(5)}  ${String(product.options.length).padStart(7)}  ` +
        `${String(product.features.length).padStart(8)}  ${String(product.description.length).padStart(4)}`,
    );
  });
  console.log('');
  for (const entry of written) {
    console.log(`  ${entry.changed ? 'escrito ' : 'sin cambios'} ${entry.file} (${entry.bytes} bytes)`);
  }
  console.log(`  ${manifestChanged ? 'escrito ' : 'sin cambios'} manifest.json`);
}

main().catch((error) => {
  console.error('\nERROR en la extraccion:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
