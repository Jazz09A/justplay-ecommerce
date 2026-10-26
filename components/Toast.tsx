/**
 * Toast del carrito — PLAN.md §7 TASK-005.
 *
 * Reproduce el elemento del original (linea 207 del HTML):
 *
 *   <div class="toast" id="toast">Agregado al carrito</div>
 *
 * y el mecanismo de visibilidad del original (linea 228): se anade la clase
 * `s` y se quita 1300 ms despues. El CSS global hace el resto:
 *
 *   .toast{display:none}      → oculto
 *   .toast.s{display:block}   → visible
 *
 * Por eso la clase `s` es el **unico** mecanismo de visibilidad: el `<div>`
 * esta siempre en el DOM y lo que cambia es su `className`. No se usa
 * `hidden`, `style` inline ni montaje/desmontaje condicional.
 *
 * ## Diferencia deliberada respecto del original: el enlace al carrito
 *
 * El toast del original era un texto plano. Ahora el carrito es una
 * **pagina real** (`/carrito`), asi que el toast incluye un enlace "Ver
 * carrito" para que el usuario pueda ir al pedido sin tener que buscar el
 * icono del carrito en la cabecera. El DOM final **ya no es identico** al
 * del original: es una mejora consciente, no un descuido.
 *
 * El separador entre el mensaje y el enlace es un "·" (U+00B7) con un
 * espacio a cada lado. El texto del mensaje sigue viniendo de
 * `TOAST_MESSAGE` (`components/CartProvider.tsx`), que no se re-declara
 * aqui: hay una sola fuente de verdad para el texto.
 *
 * Este componente es un consumidor puro: no managea estado ni temporizadores
 * (eso vive en `CartProvider`, que es el unico origen del toast). Se monta en
 * el layout raiz; `CartProvider` no lo importa, asi que no hay dependencia
 * circular.
 */

'use client';

import Link from 'next/link';

import { TOAST_MESSAGE, useToast } from './CartProvider';

/** Toast de confirmacion al agregar productos al carrito. */
export function Toast() {
  const { visible } = useToast();

  return (
    <div className={visible ? 'toast s' : 'toast'} id="toast">
      {TOAST_MESSAGE} · <Link href="/carrito">Ver carrito</Link>
    </div>
  );
}
