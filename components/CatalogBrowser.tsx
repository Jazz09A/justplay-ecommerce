/**
 * Navegador del catalogo — extraccion de `CatalogSection` (Fase A).
 *
 * Reune **todo** el markup y toda la logica de filtrado del bloque de
 * catalogo del original (lineas 169-173 y 225-226 del HTML):
 *
 *   <div class="srch"><svg …lupa…/><input id="sq" type="search" …></div>
 *   <div class="sh"><div><h2>…</h2><p>…</p></div><div class="cats" id="cats">…</div></div>
 *   <div class="grid" id="grid">…cards…</div>
 *
 * y de su logica de filtrado:
 *
 *   P.map(…).filter(o => (cur=='Todo'||o.x.c==cur) &&
 *                         o.x.n.toLowerCase().indexOf(($('#sq').value||'').toLowerCase())>-1)
 *
 * ## Por que este componente y no `CatalogSection`
 *
 * El catalogo paso a ser **una pagina propia** (`/catalogo`) y los servicios
 * **otra** (`/servicios`); la home se queda con hero + por que + contacto.
 *
 * Por eso el componente ya **no** envuelve su markup en un
 * `<section id="catalogo">`: el contenedor es de la pagina, no del navegador.
 * Aqui solo queda el contenido del bloque, y por eso el componente devuelve un
 * fragmento: el unico `id="catalogo"` del DOM es el de la pagina.
 *
 * Esa separacion evita el bug que habia en `app/catalogo/page.tsx`: el
 * `<section id="catalogo">` de la pagina envolvia a un `CatalogSection` que
 * renderizaba **otro** `<section id="catalogo">` (id duplicado) y una `.sh`
 * anidada dentro de otra.
 *
 * ## Decisiones de paridad (conservadas de `CatalogSection`)
 *
 *   - El `id="catalogo"` es **obligatorio** en la pagina: el CSS global tiene
 *     `#catalogo .sh{flex-direction:column;align-items:stretch}`, una regla que
 *     solo aplica si el id esta en un ancestro de `.sh`.
 *   - El orden de los hijos de `.sh` se respeta: primero el bloque de titulo
 *     (si hay `title`), despues la tira de chips. `.cats` tiene
 *     `overflow-x:auto` y `flex-wrap:nowrap`, asi que no se anade ningun
 *     envoltorio que rompa el scroll horizontal en movil.
 *   - Los chips se pintan en el orden de `CATEGORIES` (el array `cats` del
 *     original): cada uno es un `<button class="cat">` con el `<i>` del icono
 *     **antes** de la etiqueta, como en `drawCats()`.
 *   - La lupa es `IconSearch` con `size={18}` (el original fijaba
 *     `width="18" height="18"`).
 *   - El buscador conserva su `id="sq"` y su `type="search"`; el `placeholder`
 *     es literal, con la elipsis final (U+2026).
 *
 * ## Estado (mapa §5.2 del plan)
 *
 *   - `cur`  -> `useState<Category>('Todo')`  — categoria activa.
 *   - `#sq`  -> `useState<string>('')`         — texto de busqueda.
 *
 * Los dos filtros se combinan con AND, igual que en el original: primero la
 * categoria y despues el nombre. "Todo" no es una categoria real de producto
 * (`ProductCategory` la excluye), es el filtro que los muestra todos.
 *
 * ## Frontera server -> client (deuda D2)
 *
 * Este componente es un **client component** (necesita estado para los
 * filtros), pero el catalogo **no** se importa aqui: `lib/products.ts`
 * arrastra `public/images/manifest.json` completo —con la `description` y las
 * `features` de cada producto, datos que el grid nunca pinta— y eso acababa
 * dentro del bundle de JavaScript del cliente.
 *
 * El catalogo llega **por prop** desde la pagina (server component), que si
 * puede leer el manifest sin sacarlo del servidor. Aqui solo se importan el
 * **tipo** `Product` y la **constante** `CATEGORIES` de `@/lib/types` (datos
 * minimos, sin el manifest).
 *
 * ## Accesibilidad
 *
 *   - El buscador tiene `aria-label` propio: el `placeholder` no es un nombre
 *     accesible fiable.
 *   - Los chips son `button` nativos con `aria-pressed`, que es el patron de
 *     los filtros de seleccion unica (un grupo de toggles) y evita tener que
 *     montar un `tablist` completo con navegacion por flechas.
 *   - Los iconos de los chips son decorativos: `components/icons` ya los marca
 *     con `aria-hidden` cuando no tienen nombre accesible.
 */

'use client';

import { useMemo, useState } from 'react';

import { ProductCard } from '@/components/ProductCard';
import { CATEGORY_ICONS, IconSearch } from '@/components/icons';
import { CATEGORIES, type Category, type Product } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Constantes                                                          */
/* ------------------------------------------------------------------ */

/** Placeholder literal del buscador original (incluye la elipsis U+2026). */
const SEARCH_PLACEHOLDER = 'Buscar consolas, juegos, accesorios…';

/** Tamano de la lupa: el original fijaba `width="18" height="18"`. */
const SEARCH_ICON_SIZE = 18;

/* ------------------------------------------------------------------ */
/* Contrato publico                                                    */
/* ------------------------------------------------------------------ */

/** Props de `CatalogBrowser`. */
export interface CatalogBrowserProps {
  /** Catalogo completo, resuelto en el servidor. */
  products: readonly Product[];
  /** Titulo opcional del encabezado. Si se omite, no se pinta el bloque de titulo. */
  title?: string;
  /** Subtitulo opcional del encabezado. */
  subtitle?: string;
}

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

/**
 * Bloque de navegacion del catalogo: buscador, chips de categoria y rejilla
 * de cards.
 *
 * No envuelve su contenido en ningun elemento: devuelve un fragmento para que
 * la pagina sea la unica que decide el contenedor (`<section id="catalogo">`
 * en `/catalogo`) y el `id="catalogo"` exista una sola vez en el DOM.
 */
export function CatalogBrowser({ products, title, subtitle }: CatalogBrowserProps) {
  /** Categoria activa. "Todo" = sin filtro de categoria. */
  const [category, setCategory] = useState<Category>('Todo');

  /** Texto del buscador (`#sq`). */
  const [query, setQuery] = useState('');

  /**
   * Productos visibles: filtro de categoria AND filtro por nombre.
   *
   * Equivale a la cadena de filtros de `drawGrid()` del original:
   * `(cur=='Todo'||x.c==cur) && x.n.toLowerCase().indexOf(q.toLowerCase())>-1`.
   *
   * La comparacion es sin distinguir mayusculas y el texto **no** se recorta:
   * se compara exactamente lo que el usuario escribio, igual que en el
   * original. El `useMemo` se invalida en cada pulsacion, de modo que el
   * filtro se reevalua siempre.
   */
  const visibleProducts = useMemo(() => {
    const needle = query.toLowerCase();

    return products.filter((product) => {
      const matchesCategory = category === 'Todo' || product.category === category;
      const matchesQuery = product.name.toLowerCase().includes(needle);
      return matchesCategory && matchesQuery;
    });
  }, [category, products, query]);

  return (
    <>
      <div className="srch">
        <IconSearch size={SEARCH_ICON_SIZE} />
        <input
          id="sq"
          type="search"
          placeholder={SEARCH_PLACEHOLDER}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Buscar productos"
        />
      </div>

      <div className="sh">
        {title ? (
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        ) : null}

        <div className="cats" id="cats">
          {CATEGORIES.map((name) => {
            const Icon = CATEGORY_ICONS[name];
            const isActive = name === category;

            return (
              <button
                key={name}
                type="button"
                className={isActive ? 'cat on' : 'cat'}
                onClick={() => setCategory(name)}
                aria-pressed={isActive}
              >
                <i>
                  <Icon />
                </i>
                {name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid" id="grid">
        {visibleProducts.length > 0 ? (
          visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))
        ) : (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '60px 20px',
              color: 'var(--mu)',
            }}
          >
            <p style={{ fontSize: '18px', marginBottom: '8px' }}>
              No se encontraron productos
            </p>
            <p style={{ fontSize: '14px' }}>
              Intenta con otra búsqueda o categoría
            </p>
          </div>
        )}
      </div>
    </>
  );
}
