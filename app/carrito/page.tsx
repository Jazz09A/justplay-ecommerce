/**
 * Página del carrito de compras — Fase D.
 *
 * La ruta es un **server component**: no tiene estado ni handlers, así que el
 * HTML se genera en el servidor y solo `CartPage` (client) se hidrata.
 *
 * El reparto sigue el mismo patrón que `/catalogo` y `/producto/[id]`:
 *
 *   - `page.tsx` (server) → `<main>` + `<section>` + el contenedor `.w` y el
 *     reparto de los bloques. Es la única pieza que conoce la ruta.
 *   - `CartPage` (client) → el contenido: estado vacío / lista de líneas /
 *     resumen / checkout. Necesita `useCart()` y estado propio (el formulario
 *     de checkout), por eso es un client component.
 *
 * `<section>` aporta el aire vertical con la regla global
 * `section{padding:64px 0}` (y `40px 0` por debajo de 700px): el `<header>`
 * del layout es `position:sticky` y ya ocupa espacio en el flujo, así que no
 * hace falta ningún `paddingTop` artificial.
 */

import { CartPage } from '@/components/CartPage';

export default function CarritoPage() {
  return (
    <main>
      <section aria-labelledby="cartpage-title">
        <div className="w">
          <CartPage />
        </div>
      </section>
    </main>
  );
}
