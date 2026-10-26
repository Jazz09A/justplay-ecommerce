/**
 * Tipos del dominio — PLAN.md §5.1.
 *
 * La foto es la unica fuente de verdad del contenido (opciones, descripcion y
 * features). Este archivo solo define la forma; los valores viven en
 * `lib/products.ts`.
 */

/**
 * Categorias del catalogo, en el orden exacto en que las pintaba el demo
 * original: Todo, Consolas, Juegos, Accesorios, Audifonos, Servicio tecnico.
 */
export const CATEGORIES = [
  'Todo',
  'Consolas',
  'Juegos',
  'Accesorios',
  'Audífonos',
  'Servicio técnico',
] as const;

/** Cualquier categoria del catalogo, incluido el filtro "Todo". */
export type Category = (typeof CATEGORIES)[number];

/** Categorias que puede tener un producto ("Todo" es solo un filtro de UI). */
export type ProductCategory = Exclude<Category, 'Todo'>;

/** Iconos SVG disponibles para los productos sin foto (set `IC` del original). */
export type IconName = 'head' | 'disc' | 'pad';

/** Imagen del producto: foto raster servida desde `public/images` o icono vector. */
export type ProductMedia =
  | { kind: 'photo'; src: string; width: number; height: number }
  | { kind: 'icon'; icon: IconName };

/**
 * Producto del catalogo.
 *
 * Todos los campos son obligatorios (decision D1): `options`, `description` y
 * `features` nunca estan vacios, de modo que un dato faltante rompe el build
 * en vez de renderizarse como `undefined`.
 */
export interface Product {
  /** Slug estable de la ruta `/producto/[id]`. */
  id: string;
  /** 0..5 — equivalencia con los hashes `#p0`..`#p5` del demo original. */
  legacyIndex: number;
  name: string;
  category: ProductCategory;
  /** Precio referencial en USD (entero). */
  price: number;
  media: ProductMedia;
  /** Opciones seleccionables. Siempre al menos una. */
  options: string[];
  /** Descripcion del producto. Nunca vacia. */
  description: string;
  /** Caracteristicas del producto. Siempre al menos una. */
  features: string[];
}
