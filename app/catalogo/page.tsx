/**
 * Página de catálogo completo — Fase A.
 *
 * El catálogo deja de ser una sección de la home y pasa a ser una página
 * propia: aquí vive el único `<section id="catalogo">` del sitio.
 *
 * `CatalogBrowser` devuelve un fragmento (buscador + encabezado + chips +
 * rejilla) y **no** envuelve nada, así que el `id="catalogo"` existe una sola
 * vez en el DOM. Antes esta página envolvía a `CatalogSection` —que ya
 * renderizaba su propio `<section id="catalogo">`— dentro de otro
 * `<section id="catalogo">`: id duplicado y `.sh` anidada.
 *
 * No hay `paddingTop` artificial: el `<header>` del layout es `position:sticky`
 * y ya ocupa espacio en el flujo, y `section{padding:64px 0}` da el aire
 * vertical.
 *
 * El catálogo se resuelve **aquí**, en el servidor: esta página es un server
 * component, así que `getAllProducts()` puede leer `public/images/manifest.json`
 * sin sacarlo del bundle del cliente (deuda D2). El array es la misma
 * referencia de módulo en cada render, de modo que la prop `products` es
 * estable para el `useMemo` del cliente.
 */

import { CatalogBrowser } from '@/components/CatalogBrowser';
import { getAllProducts } from '@/lib/products';

export default function CatalogoPage() {
  /**
   * Catálogo completo, resuelto en el servidor.
   *
   * `getAllProducts()` devuelve siempre la misma referencia (array de módulo),
   * de modo que la prop `products` es estable para el `useMemo` del cliente.
   */
  const products = getAllProducts();

  return (
    <main>
      <section id="catalogo">
        <div className="w">
          <CatalogBrowser
            products={products}
            title="Catálogo Completo"
            subtitle="Explora toda nuestra selección de productos"
          />
        </div>
      </section>
    </main>
  );
}
