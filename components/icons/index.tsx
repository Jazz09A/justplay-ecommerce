/**
 * Set de iconos SVG del demo original, portados a componentes React.
 *
 * PLAN.md §7 TASK-004 (decision D4): los iconos del original son cadenas SVG
 * (`var IC`, `var CI` y cuatro SVG en linea). Copiarlas tal cual exigiria
 * `dangerouslySetInnerHTML`, que abre una superficie XSS que aqui no existe
 * (todos los paths son literales de este repositorio). Aqui cada glifo es JSX:
 * el `d`, `x`, `y`, `width`, `height`, `r`, `cx`, `cy` y `rx` son **identicos**
 * al original, y el `stroke-width` tambien (`1.4` en los sets `IC`/`CI`,
 * `2` en los iconos de UI).
 *
 * Tamano: `size` en px (24 por defecto, el lado del `viewBox` del original).
 * El CSS global manda sobre los atributos de presentacion — `.im svg` deja el
 * glifo al 34%, `.dimg svg` al 30%, `.cat i svg` a 26px y `.bn svg` a 22px —
 * asi que `size` es un valor por defecto, no un contrato de layout. Donde el
 * original fijaba un tamano explicito hay que pasarlo: carrito `20` y
 * busqueda `18` en el header.
 *
 * Este modulo **no** lleva `'use client'`: son componentes presentacionales
 * puros (sin estado ni efectos), importables desde server components y desde
 * client components.
 */

import type { JSX, ReactNode, SVGProps } from 'react';

import type { Category, IconName, ProductMedia } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Contrato de props                                                  */
/* ------------------------------------------------------------------ */

/**
 * Props comunes a todos los iconos.
 *
 * `width`/`height` se omiten a proposito: el tamano se controla con `size`,
 * para no tener dos fuentes de verdad que se contradigan.
 */
export interface IconProps
  extends Omit<SVGProps<SVGSVGElement>, 'children' | 'width' | 'height'> {
  /** Clase CSS del `<svg>`. El CSS global puede sobrescribir el tamano. */
  className?: string;
  /** Ancho y alto en px. Por defecto 24 (el lado del `viewBox` del original). */
  size?: number;
}

/** Tipo de un componente de icono de este modulo. */
export type IconComponent = (props: IconProps) => JSX.Element;

/* ------------------------------------------------------------------ */
/* Grosor de trazo (identico al original)                             */
/* ------------------------------------------------------------------ */

/** `stroke-width` del set `IC`/`CI` del original (linea 210 del HTML). */
const STROKE_THIN = 1.4;

/** `stroke-width` de los iconos de UI del original (header y bottom-nav). */
const STROKE_BOLD = 2;

/* ------------------------------------------------------------------ */
/* Fabrica de iconos                                                  */
/* ------------------------------------------------------------------ */

/**
 * Crea un componente de icono a partir de su geometria.
 *
 * Todos los iconos heredan los mismos atributos de presentacion del
 * original: `fill="none"`, `stroke="currentColor"`, `stroke-linecap="round"`
 * y `stroke-linejoin="round"`.
 */
function createIcon(displayName: string, strokeWidth: number, shape: ReactNode): IconComponent {
  function Icon({ className, size = 24, ...rest }: IconProps): JSX.Element {
    const {
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-hidden': ariaHidden,
      ...svgProps
    } = rest;

    // Sin nombre accesible el glifo es decorativo y se oculta del arbol de
    // accesibilidad. Con `aria-label`/`aria-labelledby` (o `aria-hidden`
    // explicito) manda el consumidor.
    const hasAccessibleName = ariaLabel !== undefined || ariaLabelledBy !== undefined;
    const decorative = ariaHidden !== undefined ? ariaHidden !== false : !hasAccessibleName;

    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        role={decorative ? undefined : 'img'}
        aria-hidden={decorative ? true : undefined}
        focusable={decorative ? 'false' : undefined}
        {...svgProps}
      >
        {shape}
      </svg>
    );
  }

  Icon.displayName = displayName;
  return Icon;
}

/* ------------------------------------------------------------------ */
/* Geometria (verbatim del original)                                  */
/* ------------------------------------------------------------------ */

/** `IC.head` — tambien `CI['Audífonos']` (lineas 211 y 224 del HTML). */
const HEAD_SHAPE = (
  <>
    <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
    <rect x="3" y="14" width="4" height="6" rx="1.5" />
    <rect x="17" y="14" width="4" height="6" rx="1.5" />
  </>
);

/** `IC.disc` — tambien `CI['Juegos']` (lineas 211 y 224 del HTML). */
const DISC_SHAPE = (
  <>
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <circle cx="12" cy="10" r="4" />
    <path d="M8 18h8" />
  </>
);

/** `IC.pad` — tambien `CI['Accesorios']` (lineas 211 y 224 del HTML). */
const PAD_SHAPE = (
  <>
    <path d="M7 8h10c3 0 4 3 5 7 .5 2-1.5 3-3 1.5L17 14H7l-2 2.5C3.5 18 1.500 17 2 15c1-4 2-7 5-7z" />
    <path d="M8 11v2M7 12h2" />
  </>
);

/** `CI['Todo']` — tambien el icono de "Catálogo" del bottom-nav (misma forma). */
const GRID_SHAPE = (
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </>
);

/** `CI['Consolas']` (linea 224 del HTML). */
const CONSOLE_SHAPE = (
  <>
    <rect x="8" y="3" width="8" height="18" rx="3" />
    <path d="M11 7v8" />
  </>
);

/** `CI['Servicio técnico']` — tambien el icono de "Servicios" del bottom-nav. */
const WRENCH_SHAPE = (
  <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z" />
);

/** Icono del carrito del header (linea 152 del HTML). */
const CART_SHAPE = (
  <>
    <circle cx="9" cy="20" r="1.5" />
    <circle cx="18" cy="20" r="1.5" />
    <path d="M2 3h3l2.7 11.5a2 2 0 0 0 2 1.5h7.6a2 2 0 0 0 2-1.5L21 7H6" />
  </>
);

/** Icono de busqueda del header (linea 170 del HTML). */
const SEARCH_SHAPE = (
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>
);

/** Icono de "Inicio" del bottom-nav (linea 206 del HTML). */
const HOME_SHAPE = <path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z" />;

/** Icono de "Contacto" del bottom-nav (linea 206 del HTML). */
const CHAT_SHAPE = <path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-5.5A8 8 0 1 1 21 12z" />;

/* ------------------------------------------------------------------ */
/* Set de producto y categoria (`IC`/`CI`, stroke-width 1.4)          */
/* ------------------------------------------------------------------ */

/** Auriculares — `IC.head`, categoria "Audífonos". */
export const IconHead = createIcon('IconHead', STROKE_THIN, HEAD_SHAPE);

/** Disco — `IC.disc`, categoria "Juegos". */
export const IconDisc = createIcon('IconDisc', STROKE_THIN, DISC_SHAPE);

/** Mando — `IC.pad`, categoria "Accesorios". */
export const IconPad = createIcon('IconPad', STROKE_THIN, PAD_SHAPE);

/** Rejilla de 4 cuadrados — `CI['Todo']`. */
export const IconGrid = createIcon('IconGrid', STROKE_THIN, GRID_SHAPE);

/** Consola vertical — `CI['Consolas']`. */
export const IconConsole = createIcon('IconConsole', STROKE_THIN, CONSOLE_SHAPE);

/** Herramienta — `CI['Servicio técnico']`. */
export const IconWrench = createIcon('IconWrench', STROKE_THIN, WRENCH_SHAPE);

/* ------------------------------------------------------------------ */
/* Iconos de UI (stroke-width 2)                                      */
/* ------------------------------------------------------------------ */

/** Carrito del header. El original lo fijaba a 20x20: usar `size={20}`. */
export const IconCart = createIcon('IconCart', STROKE_BOLD, CART_SHAPE);

/** Lupa del buscador. El original la fijaba a 18x18: usar `size={18}`. */
export const IconSearch = createIcon('IconSearch', STROKE_BOLD, SEARCH_SHAPE);

/** "Inicio" del bottom-nav. El CSS global lo deja a 22px. */
export const IconHome = createIcon('IconHome', STROKE_BOLD, HOME_SHAPE);

/** "Catálogo" del bottom-nav (misma rejilla que `CI['Todo']`, trazo 2). */
export const IconCatalog = createIcon('IconCatalog', STROKE_BOLD, GRID_SHAPE);

/** "Servicios" del bottom-nav (misma herramienta que `CI`, trazo 2). */
export const IconServices = createIcon('IconServices', STROKE_BOLD, WRENCH_SHAPE);

/** "Contacto" del bottom-nav (bocadillo de chat). */
export const IconContact = createIcon('IconContact', STROKE_BOLD, CHAT_SHAPE);

/* ------------------------------------------------------------------ */
/* Mapas y helpers                                                    */
/* ------------------------------------------------------------------ */

/** Icono de producto por nombre logico (`IconName` del demo original). */
export const PRODUCT_ICONS: Readonly<Record<IconName, IconComponent>> = {
  head: IconHead,
  disc: IconDisc,
  pad: IconPad,
};

/**
 * Icono de cada categoria del catalogo, en el mismo orden que `CATEGORIES`.
 *
 * El tipo `Record<Category, IconComponent>` obliga a que el mapa cubra
 * **todas** las categorias (incluido "Todo"): anadir una categoria a
 * `CATEGORIES` rompe el typecheck hasta que se anade su icono aqui.
 */
export const CATEGORY_ICONS: Readonly<Record<Category, IconComponent>> = {
  Todo: IconGrid,
  Consolas: IconConsole,
  Juegos: IconDisc,
  Accesorios: IconPad,
  'Audífonos': IconHead,
  'Servicio técnico': IconWrench,
};

/** Props de `ProductMediaIcon`. */
export interface ProductMediaIconProps {
  /** Media del producto: foto o icono vector. */
  media: ProductMedia;
  /** Clase CSS del `<svg>`. */
  className?: string;
  /** Ancho y alto en px. Por defecto 24. */
  size?: number;
}

/**
 * Renderiza el icono vector de un producto.
 *
 * Si el producto tiene foto (`kind: 'photo'`) no se dibuja nada: la foto la
 * pinta el componente de card/detalle con `next/image` (TASK-008 / TASK-009).
 * Devolver `null` en ese caso evita duplicar la imagen y mantiene la
 * logica de "icono vs foto" en un unico sitio.
 */
export function ProductMediaIcon({
  media,
  className,
  size = 24,
}: ProductMediaIconProps): JSX.Element | null {
  if (media.kind !== 'icon') {
    return null;
  }

  const Icon = PRODUCT_ICONS[media.icon];
  return <Icon className={className} size={size} />;
}
