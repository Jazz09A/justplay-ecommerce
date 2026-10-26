/**
 * Ruta de detalle de producto — PLAN.md §7 TASK-009.
 *
 * Reproduce el `<main id="detail">` del original (lineas 198-203 del HTML):
 *
 *   <main id="detail"><div class="w">
 *     <div class="crumb"><a href="#">Inicio</a> / <span id="bc"></span></div>
 *     <div class="dg"><div class="dimg" id="dimg"></div><div class="di" id="di"></div></div>
 *     <div class="sh"><h2 style="font-size:22px">Productos relacionados</h2></div>
 *     <div class="grid" id="rel" style="margin-bottom:56px"></div>
 *   </div></main>
 *
 * El `id="detail"` se conserva (supuesto S3 del plan): el CSS global lo
 * referencia y TASK-010 lo dejara en el DOM aunque la regla que lo ocultaba
 * (`#detail{display:none}`) ya no exista.
 *
 * Division de responsabilidades (todo el DOM del original, sin anadir nada):
 *
 *   - `page.tsx` (server) → `<main id="detail">` + `.w` + el reparto de los
 *     bloques. Es la unica pieza que conoce la ruta.
 *   - `ProductDetail` (client) → `.crumb` + `.dg` (`.dimg` y `.di`). Necesita
 *     estado de cliente (opcion y cantidad), por eso es un client component.
 *   - `RelatedProducts` (server) → `.sh` + `.grid#rel`. No necesita `useCart()`:
 *     delega en `ProductCard` (client), que es quien pinta cada card y quien
 *     llama a `add(1)` desde el boton "Agregar".
 *
 * El bloque `#dimg` / `#di` se reparte en dos mitades porque el original
 * inyectaba HTML en dos contenedores distintos (`$('#dimg').innerHTML=...` y
 * `$('#di').innerHTML=...`); en React es un solo arbol, pero se conservan los
 * mismos contenedores y clases.
 *
 * Por que el estado del detalle se reinicia al cambiar de producto:
 * `show(k)` del original hacia `sel=k; qty=1` en cada navegacion. En el App
 * Router, navegar de `/producto/a` a `/producto/b` reutiliza el mismo client
 * component (React conserva el estado si el arbol no cambia), asi que la
 * pagina pasa `key={product.id}`: al cambiar el id, React desmonta y vuelve a
 * montar `ProductDetail`, y sus `useState` vuelven al valor inicial (opcion
 * 0, cantidad 1). Es la forma idiomatica de reiniciar estado por parametro,
 * y evita el parpadeo de renderizar un frame con la opcion anterior.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProductDetail } from '@/components/ProductDetail';
import { RelatedProducts } from '@/components/RelatedProducts';
import { getAllProducts, getProduct, getRelated } from '@/lib/products';

/**
 * Solo existen las rutas generadas por `generateStaticParams`: cualquier otro
 * `id` responde 404 (PLAN.md §7 TASK-009, riesgo R14).
 */
export const dynamicParams = false;

/**
 * Genera estaticamente las 6 rutas `/producto/[id]` del catalogo.
 *
 * La lista sale de `getAllProducts()` (que ya aplica el mapa
 * `legacyIndex -> slug` de PLAN.md §5.1), de modo que no puede desincronizarse
 * del catalogo.
 */
export function generateStaticParams(): Array<{ id: string }> {
  return getAllProducts().map((product) => ({ id: product.id }));
}

/** Props de la pagina de detalle. En Next 15 `params` es una promesa. */
interface ProductPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Titulo de la pagina: el nombre del producto.
 *
 * `generateMetadata` corre antes que el componente de la pagina, asi que no
 * puede lanzar `notFound()`; si el producto no existe devuelve el titulo
 * generico y la pagina responde 404 igualmente.
 */
export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = getProduct(id);

  return {
    title:
      product === undefined ? 'JustPlay Store – Demo' : `${product.name} – JustPlay Store`,
  };
}

/** Pagina de detalle de un producto. */
export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = getProduct(id);

  // Guarda explicita del 404. `notFound()` lanza, asi que el `return` solo
  // sirve para que TypeScript estreche `product` a `Product` en el resto de
  // la funcion sin depender de la regla de "funciones que nunca regresan".
  // (`dynamicParams = false` ya devuelve 404 antes de llegar aqui, pero la
  // guarda hace que el contrato no dependa solo de esa configuracion.)
  if (product === undefined) {
    return notFound();
  }

  // Los 4 relacionados en orden de catalogo, excluyendo el propio producto
  // (`getRelated` = "los siguientes en orden de catalogo", PLAN.md §5.1).
  const related = getRelated(product.id, 4);

  return (
    <main id="detail">
      <div className="w">
        <ProductDetail key={product.id} product={product} />
        <RelatedProducts products={related} />
      </div>
    </main>
  );
}
