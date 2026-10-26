/**
 * Detalle de producto — PLAN.md §7 TASK-009.
 *
 * Reproduce el bloque que el original inyectaba con `show(k)` (linea 234 del
 * HTML) dentro de `<main id="detail">`:
 *
 *   <div class="crumb"><a href="#">Inicio</a> / <span id="bc"></span></div>
 *   <div class="dg"><div class="dimg" id="dimg"></div><div class="di" id="di"></div></div>
 *
 * y el HTML que `show()` metia en `#dimg` y en `#di`:
 *
 *   #dimg → pic(x)  →  <img src="…">  o  <svg …>
 *   #di   → <small>{c}</small>
 *           <h1>{n}</h1>
 *           <div class="stars">★★★★★<span>5.0 · Clientes satisfechos</span></div>
 *           <p style="margin-top:12px">{d}</p>
 *           <div class="pbox">
 *             <div class="big">${p}<span>Precio referencial</span></div>
 *             <h4>Elige una opción</h4>
 *             <div class="opts" id="opts">{botones .opt, el primero con .on}</div>
 *             <div class="buy">
 *               <div class="qty"><button id="m">−</button><span id="q">1</span><button id="pl">+</button></div>
 *               <button class="btn" id="addc">Agregar al carrito</button>
 *               <a class="btn g" id="wa" target="_blank" rel="noopener">Comprar por WhatsApp</a>
 *             </div>
 *           </div>
 *           <h4>Incluye</h4>
 *           <ul class="fl">{f.map(f => <li>{f}</li>)}</ul>
 *
 * Es un **client component** porque reproduce el estado local del original
 * (`sel`, la opcion elegida, y `qty`, la cantidad):
 *
 *   - `sel` → `useState` con el indice de la opcion; la primera (indice 0)
 *     nace activa, igual que `'<button class="opt'+(i?'':' on')+'">'`.
 *   - `qty` → `useState` con 1; el boton `−` no baja de 1
 *     (`if(qty>1){qty--;…}` en el original).
 *
 * El reinicio de ambos valores al cambiar de producto lo resuelve la pagina
 * con `key={product.id}` (ver `app/producto/[id]/page.tsx`).
 *
 * Paridad de clases: `.crumb`, `.dg`, `.dimg`, `.di`, `.stars`, `.pbox`,
 * `.big`, `.opts`, `.opt` (+`.on`), `.buy`, `.qty`, `.fl` y los ids `#bc`,
 * `#dimg`, `#di`, `#opts`, `#m`, `#q`, `#pl`, `#addc`, `#wa` se respetan uno a
 * uno, porque `app/globals.css` los estiliza y no se toca.
 *
 * Diferencias necesarias (y solo estas):
 *   - El "volver al inicio" del breadcrumb era `href="#"`; aqui es un
 *     `<Link href="/">` real (TASK-009, mapa de equivalencia §6).
 *   - El texto de WhatsApp se calcula en React en vez de mutando
 *     `$('#wa').href` a mano, pero con el **mismo formato exacto** (linea 229
 *     del original): `encodeURIComponent('Hola JustPlay, me interesa: ' + n +
 *     ' (' + opcion + ') x' + qty)`.
 *   - La foto se pinta con `next/image` pasando las dimensiones intrinsecas
 *     del manifest (riesgo R3), y el icono de producto con el componente SVG
 *     del set `IC`. La foto de `.dimg` lleva `priority` porque es el LCP de la
 *     pagina: reproduce la carga inmediata del `<img>` original (el original
 *     no tenia `loading="lazy"`) y evita el retardo de un LCP tardio.
 */

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { useCart } from '@/components/CartProvider';
import { ProductMediaIcon } from '@/components/icons';
import type { Product } from '@/lib/types';

/**
 * Base del enlace de WhatsApp.
 *
 * El numero `584129507176` es el del original (linea 229 del HTML) y tambien
 * el del boton "WhatsApp" del header: es el unico enlace externo del sitio.
 */
const WHATSAPP_BASE_URL = 'https://wa.me/584129507176?text=';

/** Props de `ProductDetail`. */
export interface ProductDetailProps {
  /** Producto a mostrar. Serializable: lo pasa el server component. */
  product: Product;
}

/** Detalle de un producto: imagen, datos, opciones, compra y caracteristicas. */
export function ProductDetail({ product }: ProductDetailProps) {
  /** Indice de la opcion seleccionada. 0 = la primera, como en el original. */
  const [selectedIndex, setSelectedIndex] = useState(0);
  /** Cantidad a agregar. Empieza en 1 y nunca baja de 1. */
  const [quantity, setQuantity] = useState(1);

  const { add } = useCart();

  /**
   * Opcion seleccionada. `options` nunca esta vacio (invariante D1 de
   * PLAN.md §5.1), asi que el indice 0 siempre existe; los `??` solo
   * apaciguan el `noUncheckedIndexedAccess` del `tsconfig`.
   */
  const selectedOption = product.options[selectedIndex] ?? product.options[0] ?? '';

  /**
   * Enlace de WhatsApp, recalculado en cada cambio de opcion o cantidad.
   *
   * Formato EXACTO del original (linea 229):
   *   'Hola JustPlay, me interesa: ' + nombre + ' (' + opcion + ') x' + cantidad
   *
   * Es el unico string contractual con el exterior de la app: el espacio antes
   * de `x` y los parentesis alrededor de la opcion son parte del formato.
   */
  const whatsappHref =
    WHATSAPP_BASE_URL +
    encodeURIComponent(
      `Hola JustPlay, me interesa: ${product.name} (${selectedOption}) x${quantity}`,
    );

  return (
    <>
      <div className="crumb">
        <Link href="/">Inicio</Link>
        {' / '}
        <span id="bc">{product.name}</span>
      </div>

      <div className="dg">
        <div className="dimg" id="dimg">
          {product.media.kind === 'photo' ? (
            <Image
              src={product.media.src}
              alt={product.name}
              width={product.media.width}
              height={product.media.height}
              priority
              sizes="(max-width: 960px) 92vw, 536px"
            />
          ) : (
            <ProductMediaIcon media={product.media} />
          )}
        </div>

        <div className="di" id="di">
          <small>{product.category}</small>
          <h1>{product.name}</h1>
          <div className="stars">★★★★★<span>5.0 · Clientes satisfechos</span></div>
          <p style={{ marginTop: 12 }}>{product.description}</p>

          <div className="pbox">
            <div className="big">
              {`$${product.price}`}
              <span>Precio referencial</span>
            </div>

            <h4>Elige una opción</h4>
            <div className="opts" id="opts">
              {product.options.map((option, index) => (
                <button
                  key={option}
                  type="button"
                  className={index === selectedIndex ? 'opt on' : 'opt'}
                  aria-pressed={index === selectedIndex}
                  onClick={() => setSelectedIndex(index)}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="buy">
              <div className="qty">
                <button
                  type="button"
                  id="m"
                  aria-label="Disminuir cantidad"
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                >
                  −
                </button>
                <span id="q" aria-live="polite">
                  {quantity}
                </span>
                <button
                  type="button"
                  id="pl"
                  aria-label="Aumentar cantidad"
                  onClick={() => setQuantity((current) => current + 1)}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className="btn"
                id="addc"
                onClick={() => add(product, quantity, selectedOption)}
              >
                Agregar al carrito
              </button>
              <a className="btn g" id="wa" href={whatsappHref} target="_blank" rel="noopener">
                Comprar por WhatsApp
              </a>
            </div>
          </div>

          <h4>Incluye</h4>
          <ul className="fl">
            {product.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
