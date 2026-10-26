/**
 * Catalogo de productos y helpers — PLAN.md §5.1 / TASK-003.
 *
 * El contenido (nombre, categoria, precio, opciones, descripcion y features)
 * NO esta escrito a mano: se toma del manifest generado por
 * `scripts/extract-from-demo.mjs` a partir del HTML original, de modo que no
 * puede desviarse de la fuente (riesgo R1).
 *
 * Lo unico que se define aqui es el mapeo `legacyIndex -> slug de ruta`, que es
 * metadato de navegacion y no existe en el HTML original.
 */

import manifestJson from '../public/images/manifest.json';
import { toCartProduct, type CartProduct } from '@/lib/cart';
import {
  CATEGORIES,
  type Category,
  type IconName,
  type Product,
  type ProductCategory,
  type ProductMedia,
} from './types';

export { CATEGORIES };
export type { Category, IconName, Product, ProductCategory, ProductMedia };

/* ------------------------------------------------------------------ */
/* Slugs de ruta (PLAN.md §5.1)                                        */
/* ------------------------------------------------------------------ */

/**
 * `legacyIndex` del demo original (`#p0`..`#p5`) -> slug de `/producto/[id]`.
 * El `legacyIndex` es ademas el orden de catalogo.
 */
const ID_BY_LEGACY_INDEX: ReadonlyMap<number, string> = new Map([
  [0, 'ps5-slim'],
  [1, 'control-dualsense-ps5'],
  [2, 'mantenimiento-ps5'],
  [3, 'audifonos-gamer-71'],
  [4, 'juego-fisico-ps5'],
  [5, 'control-ps4-dualshock-4'],
]);

/* ------------------------------------------------------------------ */
/* Forma del manifest (validada en tiempo de carga)                   */
/* ------------------------------------------------------------------ */

interface RawMedia {
  kind: string;
  src?: string;
  width?: number;
  height?: number;
  icon?: string;
}

interface RawProduct {
  legacyIndex: number;
  name: string;
  category: string;
  price: number;
  options: string[];
  description: string;
  features: string[];
  media: RawMedia;
}

interface ManifestImage {
  slot: string;
  file: string;
  path: string;
  src: string;
  bytes: number;
  sha256: string;
  width: number;
  height: number;
  duplicateOf: string | null;
}

interface Manifest {
  source: string;
  generator: string;
  productCount: number;
  images: ManifestImage[];
  products: RawProduct[];
}

/* ------------------------------------------------------------------ */
/* Validacion del manifest                                             */
/* ------------------------------------------------------------------ */

const ICON_NAMES: readonly IconName[] = ['head', 'disc', 'pad'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

function isIconName(value: string): value is IconName {
  return (ICON_NAMES as readonly string[]).includes(value);
}

function parseMedia(value: unknown, where: string): RawMedia {
  if (!isRecord(value)) {
    throw new Error(`manifest invalido: ${where} no es un objeto`);
  }
  const media: RawMedia = { kind: String(value['kind']) };
  const src = value['src'];
  const width = value['width'];
  const height = value['height'];
  const icon = value['icon'];

  if (typeof src === 'string') {
    media.src = src;
  }
  if (typeof width === 'number') {
    media.width = width;
  }
  if (typeof height === 'number') {
    media.height = height;
  }
  if (typeof icon === 'string') {
    media.icon = icon;
  }

  return media;
}

function parseProduct(value: unknown, index: number): RawProduct {
  const where = `products[${index}]`;
  if (!isRecord(value)) {
    throw new Error(`manifest invalido: ${where} no es un objeto`);
  }

  const { legacyIndex, name, category, price, options, description, features, media } = value;

  if (typeof legacyIndex !== 'number') {
    throw new Error(`manifest invalido: ${where}.legacyIndex no es un numero`);
  }
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error(`manifest invalido: ${where}.name esta vacio`);
  }
  if (typeof category !== 'string' || category.trim() === '') {
    throw new Error(`manifest invalido: ${where}.category esta vacia`);
  }
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    throw new Error(`manifest invalido: ${where}.price no es un numero`);
  }
  if (!isStringArray(options)) {
    throw new Error(`manifest invalido: ${where}.options no es un array de texto`);
  }
  if (typeof description !== 'string') {
    throw new Error(`manifest invalido: ${where}.description no es un texto`);
  }
  if (!isStringArray(features)) {
    throw new Error(`manifest invalido: ${where}.features no es un array de texto`);
  }

  return {
    legacyIndex,
    name,
    category,
    price,
    options,
    description,
    features,
    media: parseMedia(media, `${where}.media`),
  };
}

function parseImage(value: unknown, index: number): ManifestImage {
  const where = `images[${index}]`;
  if (!isRecord(value)) {
    throw new Error(`manifest invalido: ${where} no es un objeto`);
  }

  const { slot, file, path, src, bytes, sha256, width, height, duplicateOf } = value;

  if (typeof slot !== 'string' || typeof file !== 'string' || typeof path !== 'string') {
    throw new Error(`manifest invalido: ${where} no tiene "slot", "file" y "path"`);
  }
  if (typeof src !== 'string' || typeof sha256 !== 'string') {
    throw new Error(`manifest invalido: ${where} no tiene "src" y "sha256"`);
  }
  if (typeof bytes !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
    throw new Error(`manifest invalido: ${where} no tiene "bytes", "width" y "height"`);
  }
  if (duplicateOf !== null && typeof duplicateOf !== 'string') {
    throw new Error(`manifest invalido: ${where} tiene un "duplicateOf" invalido`);
  }

  return { slot, file, path, src, bytes, sha256, width, height, duplicateOf };
}

function parseManifest(value: unknown): Manifest {
  if (!isRecord(value)) {
    throw new Error('manifest invalido: la raiz no es un objeto');
  }
  const { source, generator, productCount, images, products } = value;

  if (typeof source !== 'string' || typeof generator !== 'string') {
    throw new Error('manifest invalido: faltan "source" o "generator"');
  }
  if (typeof productCount !== 'number') {
    throw new Error('manifest invalido: "productCount" no es un numero');
  }
  if (!Array.isArray(images)) {
    throw new Error('manifest invalido: "images" no es un array');
  }
  if (!Array.isArray(products)) {
    throw new Error('manifest invalido: "products" no es un array');
  }

  return {
    source,
    generator,
    productCount,
    images: images.map((image, index) => parseImage(image, index)),
    products: products.map((product, index) => parseProduct(product, index)),
  };
}

/* ------------------------------------------------------------------ */
/* Construccion del catalogo                                            */
/* ------------------------------------------------------------------ */

function toProductCategory(value: string, where: string): ProductCategory {
  if (!isCategory(value) || value === 'Todo') {
    throw new Error(`categoria invalida en ${where}: "${value}"`);
  }
  return value;
}

function toProductMedia(media: RawMedia, where: string): ProductMedia {
  if (media.kind === 'photo') {
    if (typeof media.src !== 'string' || media.src === '') {
      throw new Error(`media invalido en ${where}: falta "src" de la foto`);
    }
    if (typeof media.width !== 'number' || typeof media.height !== 'number') {
      throw new Error(`media invalido en ${where}: faltan las dimensiones de la foto`);
    }
    return { kind: 'photo', src: media.src, width: media.width, height: media.height };
  }

  if (media.kind === 'icon') {
    if (typeof media.icon !== 'string' || !isIconName(media.icon)) {
      throw new Error(`media invalido en ${where}: icono desconocido "${String(media.icon)}"`);
    }
    return { kind: 'icon', icon: media.icon };
  }

  throw new Error(`media invalido en ${where}: kind desconocido "${media.kind}"`);
}

function toProduct(raw: RawProduct): Product {
  const where = `producto[${raw.legacyIndex}] "${raw.name}"`;

  const id = ID_BY_LEGACY_INDEX.get(raw.legacyIndex);
  if (id === undefined) {
    throw new Error(`${where}: legacyIndex sin slug asignado`);
  }

  // Invariantes de D1: un dato incompleto rompe el build, no el render.
  if (raw.options.length === 0) {
    throw new Error(`${where}: "options" esta vacio`);
  }
  if (raw.description.trim() === '') {
    throw new Error(`${where}: "description" esta vacia`);
  }
  if (raw.features.length === 0) {
    throw new Error(`${where}: "features" esta vacio`);
  }

  return {
    id,
    legacyIndex: raw.legacyIndex,
    name: raw.name,
    category: toProductCategory(raw.category, where),
    price: raw.price,
    media: toProductMedia(raw.media, where),
    options: [...raw.options],
    description: raw.description,
    features: [...raw.features],
  };
}

const MANIFEST = parseManifest(manifestJson);

const PRODUCTS: readonly Product[] = MANIFEST.products
  .slice()
  .sort((a, b) => a.legacyIndex - b.legacyIndex)
  .map(toProduct);

/* ------------------------------------------------------------------ */
/* Helpers publicos                                                    */
/* ------------------------------------------------------------------ */

/** Los 6 productos en orden de catalogo (el `legacyIndex` del demo original). */
export function getAllProducts(): readonly Product[] {
  return PRODUCTS;
}

/** Busca un producto por su slug de ruta. `undefined` si no existe. */
export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((product) => product.id === id);
}

/**
 * Catalogo reducido para el carrito.
 *
 * El carrito solo necesita `id`, `name`, `category`, `price` y `media`. Al
 * resolverlo **aqui** (en el servidor) y pasarlo por prop al provider, la
 * `description` y las `features` —el grueso del manifest— no viajan al
 * bundle del cliente: el provider recibe solo `CartProduct[]`.
 */
export function getCartCatalog(): CartProduct[] {
  return getAllProducts().map(toCartProduct);
}

/**
 * Productos relacionados: los siguientes en orden de catalogo, excluyendo el
 * propio. Por defecto devuelve 4 (los que caben en la retícula del original).
 */
export function getRelated(id: string, limit = 4): Product[] {
  const related = PRODUCTS.filter((product) => product.id !== id);
  return related.slice(0, Math.max(0, limit));
}
