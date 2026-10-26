/**
 * Modelo del carrito — Fase C del plan (variante por linea + persistencia).
 *
 * Este modulo lo importan **el servidor** (`lib/products.ts`) y **el cliente**
 * (`components/CartProvider.tsx`), asi que **no** puede importar el manifest:
 * si lo hiciera, el catalogo completo (`description` y `features`) entraria en
 * el bundle del cliente. Por eso aqui solo viven tipos y funciones puras, sin
 * dependencias de `lib/products.ts`.
 *
 * La forma persistida (`CartLine`) es deliberadamente pobre: solo guarda el
 * `productId`, la cantidad y la variante. El catalogo es la fuente de verdad y
 * se resuelve en el servidor, de modo que el cliente nunca necesita el
 * manifest para repintar el carrito.
 *
 * ## Variante: se compara normalizada, se muestra original
 *
 * La identidad de una linea es `producto::variante`. La variante se compara
 * **normalizada** (recortada y sin distinguir mayusculas), de modo que
 * `"Blanco"`, `"blanco"` y `" blanco "` son siempre la misma linea; pero se
 * **guarda y se muestra** el texto tal cual lo escribe el catalogo. El pedido
 * que ve el cliente tiene que ser fiel a lo que pone la ficha del producto,
 * no una version normalizada.
 */

import type { Product, ProductCategory, ProductMedia } from './types';

/* ------------------------------------------------------------------ */
/* Contrato publico                                                    */
/* ------------------------------------------------------------------ */

/**
 * Producto en su forma reducida para el carrito.
 *
 * Es la proyeccion de `Product` que el carrito necesita: sin descripcion ni
 * features, que son justo los campos pesados del manifest.
 */
export interface CartProduct {
  /** Slug estable del producto (mismo id que en el catalogo). */
  id: string;
  name: string;
  category: ProductCategory;
  /** Precio referencial en USD (entero). */
  price: number;
  media: ProductMedia;
}

/**
 * Linea persistida del carrito.
 *
 * Es lo que se serializa en `localStorage`: nunca el producto entero.
 */
export interface CartLine {
  /** Id del producto en el catalogo. */
  productId: string;
  /** Cantidad de unidades (entero >= 1). */
  quantity: number;
  /**
   * Variante elegida, si la hubo.
   *
   * Es el texto **tal como lo muestra el catalogo** (con su capitalizacion):
   * se persiste y se muestra. Para comparar lineas se usa la forma
   * normalizada (ver `lineIdOf`).
   */
  option?: string;
}

/**
 * Clave de persistencia en `localStorage`.
 *
 * Versionada (`v1`) para poder migrar el formato mas adelante sin romper los
 * carritos que ya haya guardado un usuario.
 */
export const CART_STORAGE_KEY = 'justplay.cart.v1';

/**
 * Separador entre producto y variante dentro de un identificador de linea.
 *
 * No aparece en los ids del catalogo (son slugs `kebab-case`), asi que el
 * identificador es unívoco.
 */
const LINE_ID_SEPARATOR = '::';

/* ------------------------------------------------------------------ */
/* Identidad de linea                                                  */
/* ------------------------------------------------------------------ */

/**
 * Identificador de linea: producto + variante.
 *
 * La variante forma parte de la identidad: "DualSense (Blanco)" y
 * "DualSense (Negro)" son dos lineas distintas del carrito.
 *
 * La variante se normaliza **solo para la clave**: se recorta y se compara sin
 * distinguir mayusculas, de modo que `"Blanco"`, `"blanco"` y `" blanco "`
 * son la **misma** linea. El texto que se guarda y se muestra (`CartLine.option`)
 * es el original del catalogo, con su capitalizacion intacta: el texto del
 * pedido que ve el cliente tiene que ser fiel a lo que pone el catalogo.
 *
 *   lineIdOf('ps5-slim', 'Digital') -> 'ps5-slim::digital'
 *   lineIdOf('ps5-slim', ' Digital ') -> 'ps5-slim::digital'
 *   lineIdOf('ps5-slim')            -> 'ps5-slim::'
 */
export function lineIdOf(productId: string, option?: string): string {
  return `${productId}${LINE_ID_SEPARATOR}${normalizeOptionKey(option)}`;
}

/* ------------------------------------------------------------------ */
/* Normalizacion de la variante                                       */
/* ------------------------------------------------------------------ */

/**
 * Forma normalizada de una variante: **clave de identidad**, no texto visible.
 *
 * Recorta los espacios de los extremos y baja las mayusculas, de modo que dos
 * variantes que solo difieren en espacios o en capitalizacion son la misma
 * linea del carrito. Es la unica fuente de la comparacion: el texto que se
 * persiste y se muestra en `CartLine.option` es el original.
 *
 * Una variante ausente (`undefined`) y una variante vacia (`''`) producen la
 * misma clave: ambas son "sin variante".
 */
function normalizeOptionKey(option?: string): string {
  return (option ?? '').trim().toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Proyeccion de producto                                              */
/* ------------------------------------------------------------------ */

/**
 * Proyecta un `Product` completo a su forma de carrito.
 *
 * Se descarta todo lo que el carrito no usa (`legacyIndex`, `options`,
 * `description`, `features`).
 */
export function toCartProduct(product: Product): CartProduct {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.price,
    media: product.media,
  };
}

/* ------------------------------------------------------------------ */
/* Validacion de lo persistido                                         */
/* ------------------------------------------------------------------ */

/**
 * Normaliza una cantidad persistida.
 *
 * Tolera el string numerico ("2" -> 2) porque `localStorage` guarda JSON y
 * cualquiera puede editarlo a mano. Exige un entero >= 1: cualquier otra cosa
 * es una linea corrupta.
 */
function normalizeQuantity(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 1 ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
  }
  return null;
}

/**
 * Normaliza una linea persistida (valida cantidad y opcion).
 *
 * Es la **unica** barrera contra datos corruptos o manipulados en
 * `localStorage`: no se confía en nada de lo que haya guardado. Devuelve
 * `null` para cualquier cosa que no sea `{ productId: string no vacio,
 * quantity: entero >= 1, option?: string }`, de modo que la linea se descarta
 * en lugar de contaminar el carrito.
 *
 * La `option` se recorta; una `option` vacia se normaliza a "sin variante"
 * (mismo `lineId` que la linea sin opcion). Una `option` presente pero que no
 * es texto invalida la linea completa: es datos manipulados, no una variante
 * real del catalogo.
 *
 * El mismo criterio de identidad que usa `lineIdOf` se aplica aqui: una
 * variante que solo difiere en espacios o en mayusculas es la misma linea. El
 * texto que se devuelve conserva la capitalizacion original (recortado de los
 * espacios de los extremos), porque es el que se muestra en el carrito y el
 * que viaja al pedido de WhatsApp.
 */
export function sanitizeLine(line: unknown): CartLine | null {
  if (typeof line !== 'object' || line === null || Array.isArray(line)) {
    return null;
  }

  const record = line as Record<string, unknown>;

  const rawProductId = record['productId'];
  if (typeof rawProductId !== 'string') {
    return null;
  }
  const productId = rawProductId.trim();
  if (productId === '') {
    return null;
  }

  const quantity = normalizeQuantity(record['quantity']);
  if (quantity === null) {
    return null;
  }

  const rawOption = record['option'];
  if (rawOption !== undefined && rawOption !== null && typeof rawOption !== 'string') {
    return null;
  }
  const option = typeof rawOption === 'string' ? rawOption.trim() : '';

  return option === '' ? { productId, quantity } : { productId, quantity, option };
}
