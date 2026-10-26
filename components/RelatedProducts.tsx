/**
 * Bloque "Productos relacionados" del detalle — PLAN.md §7 TASK-009.
 *
 * Reproduce las dos ultimas lineas del `<main id="detail">` del original
 * (lineas 201-202 del HTML):
 *
 *   <div class="sh"><h2 style="font-size:22px">Productos relacionados</h2></div>
 *   <div class="grid" id="rel" style="margin-bottom:56px"></div>
 *
 * y las cards que `show(k)` metia en `#rel` (linea 235), generadas con la
 * misma funcion `card()` del catalogo (linea 223):
 *
 *   <div class="card" data-open="k">
 *     <div class="im">{pic(x)}</div>
 *     <div class="cb">
 *       <small>{c}</small>
 *       <h3>{n}</h3>
 *       <div class="stars">★★★★★<span>5.0</span></div>
 *       <div class="cr"><span class="pr">${p}</span><button class="add" data-add="1">Agregar</button></div>
 *     </div>
 *   </div>
 *
 * ## La card de `#rel` es la misma del catalogo
 *
 * Este bloque **no** tiene una card propia: reutiliza `ProductCard`
 * (`components/ProductCard.tsx`), el componente que ya pinta el grid del
 * catalogo (`#grid`, TASK-008). Las dos rejillas del sitio salen de la misma
 * funcion `card()` del original (linea 223), asi que mantener dos markups
 * identicos solo garantizaria que una de las dos copias se quedara desfasada
 * en el primer retoque de estilo o de accesibilidad.
 *
 * La copia que existio aqui mientras TASK-008 se implementaba en paralelo
 * (para no acoplarse a un componente aun sin API estable) se elimino al
 * cerrarse esa tarea. Lo que queda es una dependencia en la direccion
 * contraria y sin coste: `ProductCard` no sabe nada de `#rel`.
 *
 * ## Donde vive la interactividad de la card
 *
 * La decision D7 del plan (la card entera es clicable, decision de paridad
 * R7) y el filtro de teclado viven **en `ProductCard`**, no aqui:
 *
 *   - `useCart()` → el boton "Agregar" llama `add(1)` (contador + toast).
 *   - `useRouter()` → la navegacion a `/producto/{id}`.
 *   - `onKeyDown` ignora los eventos que vienen del boton interior
 *     (`event.target !== event.currentTarget`): sin ese filtro, activar
 *     "Agregar" con el teclado sumaria al carrito **y** navegaria al detalle.
 *
 * ## Por que este archivo es un server component
 *
 * `RelatedProducts` no usa estado, efectos, handlers ni APIs de navegador:
 * solo pinta un encabezado y mapea productos a `ProductCard`. La
 * interactividad la aporta `ProductCard`, que es un client component y se
 * puede importar sin problema desde un server component (sus props — el
 * `Product` — son datos planos y serializables).
 */

import { ProductCard } from '@/components/ProductCard';
import type { Product } from '@/lib/types';

/** Props de `RelatedProducts`. */
export interface RelatedProductsProps {
  /** Productos relacionados, en orden de catalogo. */
  products: Product[];
}

/** Bloque de relacionados: encabezado `.sh` + reticula `.grid#rel`. */
export function RelatedProducts({ products }: RelatedProductsProps) {
  return (
    <>
      <div className="sh">
        <h2 style={{ fontSize: 22 }}>Productos relacionados</h2>
      </div>
      <div className="grid" id="rel" style={{ marginBottom: 56 }}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </>
  );
}
