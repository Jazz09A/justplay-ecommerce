/**
 * Página del carrito de compras — Fase D (rediseño con checkout a WhatsApp).
 *
 * Sustituye a la versión anterior, que resolvía **todo** con ~200 atributos
 * `style` inline: no era responsive (`gridTemplateColumns:'auto 1fr auto'`
 * fijo, que se rompe en móvil), usaba un emoji 🛒 (el original no tiene
 * emojis) y armaba el mensaje de WhatsApp sin ningún dato del cliente.
 *
 * Reparto de responsabilidades:
 *
 *   - `CartPage` (container) → lee `useCart()`, decide qué pintar (vacío,
 *     pedido enviado o carrito lleno) y reparte los datos.
 *   - `CartLine` (presentacional) → una fila: imagen, datos, cantidad y
 *     eliminar.
 *   - `CheckoutForm` (presentacional con estado propio) → los datos del
 *     cliente, la validación en cliente y el mensaje de WhatsApp.
 *
 * Decisiones de diseño:
 *
 *   - **Cero estilos inline.** Todo el layout, color, borde, espaciado y
 *     tipografía vive en clases de `app/globals.css`: las que ya existen
 *     (`.w`, `.sh`, `.pbox`, `.qty`, `.btn`, `.buy`, `.pr`, `.big`) y las
 *     nuevas que implementa el agente de CSS (`.cartlist`, `.cartrow*`,
 *     `.cart-label`, `.cart-total`, `.cartempty`, `.checkout`, `.field`,
 *     `.formerror`).
 *   - **La variante es parte del pedido.** `item.option` se muestra en la
 *     fila (`· Blanco`) y viaja al mensaje de WhatsApp: es el dato que el
 *     cliente necesita para saber exactamente qué se está llevando.
 *   - **El total se calcula una sola vez.** `useCart().total` es la suma de
 *     `price * quantity`; no se recalcula aquí, para que el número del
 *     resumen y el del mensaje de WhatsApp nunca discrepen.
 *   - **La identidad de la línea es `lineId`, no el id del producto.** Dos
 *     variantes del mismo producto son dos líneas distintas y pueden estar en
 *     el carrito a la vez.
 *   - **Vaciar el carrito es un acto explícito:** sólo al enviar el pedido o
 *     al pulsar "Vaciar carrito". Nunca al navegar.
 */

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, MouseEvent } from 'react';

import { useCart } from '@/components/CartProvider';
import { IconCart, IconContact, ProductMediaIcon } from '@/components/icons';
import type { CartItem } from '@/components/CartProvider';

/* ------------------------------------------------------------------ */
/* Constantes y helpers                                               */
/* ------------------------------------------------------------------ */

/**
 * Base del enlace de WhatsApp.
 *
 * El numero `584129507176` es el del negocio: el mismo que usan el header,
 * la home y el detalle de producto. Es el unico enlace externo del sitio.
 */
const WHATSAPP_BASE_URL = 'https://wa.me/584129507176?text=';

/** Id del mensaje de error del checkout (referenciado por `aria-describedby`). */
const FORM_ERROR_ID = 'cart-form-error';

/** Id del encabezado de la pagina (referenciado por `aria-labelledby`). */
const PAGE_TITLE_ID = 'cartpage-title';

/** Datos del cliente que viajan al pedido. */
interface CheckoutFields {
  /** Nombre del cliente. Obligatorio. */
  name: string;
  /** Telefono de contacto. Obligatorio. */
  phone: string;
  /** Direccion de entrega. Opcional. */
  address: string;
  /** Notas libres. Opcional. */
  notes: string;
}

/** Clave de un campo del formulario. */
type CheckoutFieldKey = keyof CheckoutFields;

/** Estado inicial del formulario. */
const EMPTY_CHECKOUT_FIELDS: CheckoutFields = {
  name: '',
  phone: '',
  address: '',
  notes: '',
};

/**
 * Formatea un importe: `$150`.
 *
 * Los precios del catalogo son enteros en USD, asi que no hace falta
 * formateador de moneda: con un prefijo `$` el mensaje es legible tanto en
 * WhatsApp como en la pantalla.
 */
function formatPrice(amount: number): string {
  return `$${amount}`;
}

/**
 * Arma el mensaje del pedido.
 *
 * Formato (una linea por articulo, la variante entre parentesis **solo** si
 * la hay, y las lineas de direccion/notas **solo** si estan rellenadas):
 *
 * ```
 * Hola JustPlay, quiero confirmar este pedido:
 *
 * 1. Control DualSense PS5 (Blanco) x2 — $150
 * 2. Mantenimiento especial PS5 x1 — $35
 *
 * Total: $185
 *
 * Nombre: Juan Pérez
 * Teléfono: 0412 950 7176
 * ```
 *
 * El separador entre la linea del articulo y su importe es una raya
 * (U+2014) y el total va precedido por `Total: `.
 */
function buildOrderMessage(
  items: CartItem[],
  total: number,
  fields: CheckoutFields,
): string {
  const lines: string[] = ['Hola JustPlay, quiero confirmar este pedido:', ''];

  items.forEach((item, index) => {
    const variant = item.option?.trim() ?? '';
    const label =
      variant === '' ? item.product.name : `${item.product.name} (${variant})`;
    const amount = item.product.price * item.quantity;

    lines.push(
      `${index + 1}. ${label} x${item.quantity} — ${formatPrice(amount)}`,
    );
  });

  lines.push('', `Total: ${formatPrice(total)}`, '');

  lines.push(`Nombre: ${fields.name.trim()}`);
  lines.push(`Teléfono: ${fields.phone.trim()}`);

  const address = fields.address.trim();
  if (address !== '') {
    lines.push(`Dirección: ${address}`);
  }

  const notes = fields.notes.trim();
  if (notes !== '') {
    lines.push(`Notas: ${notes}`);
  }

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Contenedor                                                         */
/* ------------------------------------------------------------------ */

/** Página del carrito: lista de líneas, resumen y checkout por WhatsApp. */
export function CartPage() {
  const { items, count, total, remove, updateQuantity, clear } = useCart();

  /**
   * `true` cuando el pedido ya se ha enviado a WhatsApp.
   *
   * Vive en el contenedor (y no en `CheckoutForm`) porque el carrito se
   * vacia al enviar: sin este flag, `items.length === 0` no distinguiria
   * "el usuario nunca compro nada" de "el pedido ya salio".
   */
  const [orderSent, setOrderSent] = useState(false);

  /** Vacia el carrito desde el boton "Vaciar carrito" (estado vacio normal). */
  const handleClear = (): void => {
    clear();
    setOrderSent(false);
  };

  /** Cierra el pedido: vacia el carrito y muestra la confirmacion. */
  const handleOrderSent = (): void => {
    clear();
    setOrderSent(true);
  };

  if (items.length === 0) {
    return orderSent ? <OrderSentState /> : <EmptyState />;
  }

  return (
    <>
      <div className="sh">
        <div>
          <h2 id={PAGE_TITLE_ID}>Carrito de Compras</h2>
          <p>
            {items.length} {items.length === 1 ? 'producto' : 'productos'}
          </p>
        </div>
        <button type="button" className="btn l" onClick={handleClear}>
          Vaciar carrito
        </button>
      </div>

      <div className="cartlist">
        {items.map((item) => (
          <CartLine
            key={item.lineId}
            item={item}
            onRemove={() => remove(item.lineId)}
            onDecrease={() => updateQuantity(item.lineId, item.quantity - 1)}
            onIncrease={() => updateQuantity(item.lineId, item.quantity + 1)}
          />
        ))}
      </div>

      <div className="pbox">
        <p className="cart-label">Total a pagar</p>
        <div className="big cart-total">
          {formatPrice(total)}
          <span>
            {count} {count === 1 ? 'unidad' : 'unidades'}
          </span>
        </div>
        <div className="buy">
          <Link href="/catalogo" className="btn l">
            Seguir comprando
          </Link>
        </div>
      </div>

      <CheckoutForm items={items} total={total} onOrderSent={handleOrderSent} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Estados vacios                                                     */
/* ------------------------------------------------------------------ */

/** Carrito sin productos: icono, mensaje y salida hacia el catalogo. */
function EmptyState() {
  return (
    <div className="cartempty">
      <IconCart size={48} />
      <h2 id={PAGE_TITLE_ID}>Tu carrito está vacío</h2>
      <p>Agrega productos para comenzar tu compra</p>
      <Link href="/catalogo" className="btn">
        Ver catálogo
      </Link>
    </div>
  );
}

/**
 * Pedido ya enviado.
 *
 * El carrito esta vacio, pero no es lo mismo que "no has comprado nada":
 * aqui el usuario ya tiene el pedido en el chat de WhatsApp y solo le falta
 * la confirmacion de la tienda.
 */
function OrderSentState() {
  return (
    <div className="cartempty">
      <IconContact size={48} />
      <h2 id={PAGE_TITLE_ID}>Pedido enviado a WhatsApp</h2>
      <p>
        Revisa el chat de WhatsApp: te confirmamos disponibilidad, forma de
        entrega y pago.
      </p>
      <Link href="/catalogo" className="btn">
        Seguir comprando
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Linea del carrito                                                   */
/* ------------------------------------------------------------------ */

/** Props de `CartLine`. */
interface CartLineProps {
  /** Linea a pintar. */
  item: CartItem;
  /** Elimina la linea. */
  onRemove: () => void;
  /** Resta una unidad (el provider borra la linea si la cantidad llega a 0). */
  onDecrease: () => void;
  /** Suma una unidad. */
  onIncrease: () => void;
}

/**
 * Una fila del carrito: imagen, datos, control de cantidad y eliminar.
 *
 * El nombre enlaza al detalle del producto (`/producto/{id}`) para poder
 * volver atras sin usar el navegador: es el mismo destino que el boton
 * "Agregar al carrito" del catalogo.
 */
function CartLine({ item, onRemove, onDecrease, onIncrease }: CartLineProps) {
  const { product, quantity } = item;
  const variant = item.option?.trim() ?? '';

  return (
    <article className="cartrow">
      <div className="cartrow-img">
        {product.media.kind === 'photo' ? (
          <Image
            src={product.media.src}
            alt={product.name}
            width={product.media.width}
            height={product.media.height}
            sizes="80px"
          />
        ) : (
          <ProductMediaIcon media={product.media} />
        )}
      </div>

      <div className="cartrow-body">
        <small className="cartrow-cat">{product.category}</small>
        <h3 className="cartrow-title">
          <Link href={`/producto/${product.id}`}>{product.name}</Link>
        </h3>
        {variant !== '' && <p className="cartrow-variant">· {variant}</p>}
        <p className="pr">{formatPrice(product.price)}</p>
      </div>

      <div className="cartrow-side">
        <div className="qty">
          <button
            type="button"
            aria-label="Restar"
            onClick={onDecrease}
            disabled={quantity <= 1}
          >
            −
          </button>
          <span aria-live="polite">{quantity}</span>
          <button type="button" aria-label="Sumar" onClick={onIncrease}>
            +
          </button>
        </div>
        <button type="button" className="cartrow-remove" onClick={onRemove}>
          Eliminar
        </button>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Checkout                                                           */
/* ------------------------------------------------------------------ */

/** Props de `CheckoutForm`. */
interface CheckoutFormProps {
  /** Lineas del pedido que se envian a WhatsApp. */
  items: CartItem[];
  /** Total del pedido. */
  total: number;
  /** Callback: el pedido salio y el carrito se vacia. */
  onOrderSent: () => void;
}

/**
 * Formulario de checkout: recoge los datos del cliente y arma el pedido.
 *
 * El envio **no** es un `<form>` con submit: el destino es WhatsApp, asi que
 * la accion es un enlace (`<a href target="_blank">`) que abre el chat con el
 * pedido ya escrito. El `<form>` se mantiene para agrupar los campos (y para
 * que el navegador gestione el autocompletado), y su `onSubmit` cubre el
 * envio por teclado.
 */
function CheckoutForm({ items, total, onOrderSent }: CheckoutFormProps) {
  const [fields, setFields] = useState<CheckoutFields>(EMPTY_CHECKOUT_FIELDS);

  /** Refs para llevar el foco al primer campo que falta. */
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const nameMissing = fields.name.trim() === '';
  const phoneMissing = fields.phone.trim() === '';
  const isValid = !nameMissing && !phoneMissing;

  /** Mensaje del pedido, ya con los datos del cliente. */
  const message = buildOrderMessage(items, total, fields);

  /** Enlace de WhatsApp con el pedido completo. */
  const whatsappHref = WHATSAPP_BASE_URL + encodeURIComponent(message);

  /** Error contextual: dice **que** falta, no solo que algo falta. */
  const errorMessage = nameMissing && phoneMissing
    ? 'Completa tu nombre y tu teléfono para confirmar el pedido.'
    : nameMissing
      ? 'Completa tu nombre para confirmar el pedido.'
      : phoneMissing
        ? 'Completa tu teléfono para confirmar el pedido.'
        : '';

  /** Actualiza un campo del formulario. */
  const updateField = (field: CheckoutFieldKey, value: string): void => {
    setFields((current) => ({ ...current, [field]: value }));
  };

  /** Envia el pedido: abre WhatsApp con el mensaje y vacia el carrito. */
  const sendOrder = (): void => {
    if (!isValid) {
      // Foco en el primer campo que falta: el error se anuncia y el teclado
      // va directo a donde hay que corregir.
      (nameMissing ? nameRef : phoneRef).current?.focus();
      return;
    }

    // La apertura la hacemos nosotros (`window.open`) en vez de dejar que la
    // haga el navegador por el `<a>`: al vaciar el carrito, esta se desmonta
    // en el mismo clic y el navegador podria no procesar la accion por
    // defecto.
    window.open(whatsappHref, '_blank', 'noopener');
    onOrderSent();
  };

  /** Submit del formulario (Enter en un campo). */
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    sendOrder();
  };

  /** Clic en el boton de WhatsApp. */
  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    sendOrder();
  };

  return (
    <form className="checkout" onSubmit={handleSubmit} noValidate>
      <h3>Datos del cliente</h3>

      <div className="field">
        <label htmlFor="checkout-name">Nombre</label>
        <input
          id="checkout-name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Juan Pérez"
          value={fields.name}
          ref={nameRef}
          required
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            updateField('name', event.target.value)
          }
          aria-invalid={nameMissing ? true : undefined}
          aria-describedby={nameMissing ? FORM_ERROR_ID : undefined}
        />
      </div>

      <div className="field">
        <label htmlFor="checkout-phone">Teléfono</label>
        <input
          id="checkout-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0412 950 7176"
          value={fields.phone}
          ref={phoneRef}
          required
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            updateField('phone', event.target.value)
          }
          aria-invalid={phoneMissing ? true : undefined}
          aria-describedby={phoneMissing ? FORM_ERROR_ID : undefined}
        />
      </div>

      <div className="field">
        <label htmlFor="checkout-address">Dirección (opcional)</label>
        <input
          id="checkout-address"
          name="address"
          type="text"
          autoComplete="street-address"
          placeholder="Chacao, Caracas"
          value={fields.address}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            updateField('address', event.target.value)
          }
        />
      </div>

      <div className="field">
        <label htmlFor="checkout-notes">Notas (opcional)</label>
        <textarea
          id="checkout-notes"
          name="notes"
          rows={4}
          placeholder="Entrega en la tarde, punto de referencia…"
          value={fields.notes}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
            updateField('notes', event.target.value)
          }
        />
      </div>

      {errorMessage !== '' && (
        <p className="formerror" id={FORM_ERROR_ID} role="alert">
          {errorMessage}
        </p>
      )}

      <div className="buy">
        <a
          className="btn g"
          href={whatsappHref}
          target="_blank"
          rel="noopener"
          aria-disabled={isValid ? undefined : true}
          onClick={handleClick}
        >
          Finalizar compra por WhatsApp
        </a>
      </div>
    </form>
  );
}
