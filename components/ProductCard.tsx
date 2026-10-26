/**
 * Card de producto del catalogo — PLAN.md §7 TASK-008 (decision D7).
 *
 * Reproduce literalmente el `card()` del demo original (linea 223 del HTML):
 *
 *   <div class="card" data-open="{k}">
 *     <div class="im">{pic(x)}</div>
 *     <div class="cb">
 *       <small>{categoria}</small>
 *       <h3>{nombre}</h3>
 *       <div class="stars">★★★★★<span>5.0</span></div>
 *       <div class="cr"><span class="pr">${precio}</span><button class="add" data-add="1">Agregar</button></div>
 *     </div>
 *   </div>
 *
 * ## Decision D7 — la card completa es clicable
 *
 * El original delegaba en un unico listener (linea 246 del HTML) que resolvia
 * `data-add` **antes** que `data-open`, de modo que pulsar "Agregar" nunca
 * abria el detalle. En React no existe esa delegacion, y envolver el boton en
 * un `<Link>` genera HTML invalido (interactivo anidado: un `<button>` dentro
 * de un `<a>`).
 *
 * La solucion del plan es: la card es un `<div role="link" tabIndex={0}>` que
 * navega con `router.push()`, y el boton ".add" hace `stopPropagation()` antes
 * de `add(1)`. Se conserva el area clicable total del original **y** se mejora
 * la accesibilidad por teclado (Enter/Espacio), que en el original no exista
 * (un `div` con `data-open` no era enfocable).
 *
 * ## La card agrega la **primera** variante
 *
 * El boton "Agregar" de la card no ofrece selector de variante, asi que
 * agrega el producto con su **primera** opcion del catalogo
 * (`product.options[0]`): es la misma que nace seleccionada en el detalle del
 * producto (`ProductDetail` arranca con `selectedIndex = 0`).
 *
 * La variante forma parte de la **identidad** de la linea del carrito
 * (`producto::variante`, ver `lineIdOf` en `lib/cart.ts`). Sin pasarla, la
 * card creaba la linea `id::`, que **no** coincide con la linea `id::blanco`
 * que crea el detalle al elegir su primera opcion: el mismo producto quedaba
 * repartido en dos lineas distintas del carrito. Pasando la variante, las dos
 * rutas convergen en la misma linea.
 *
 * ## Decisiones de paridad
 *
 *   - `.im` recibe la foto con `next/image` (dimensiones intrinsecas del
 *     manifest, riesgo R3) o el icono vector del set `IC` (`ProductMediaIcon`).
 *     El CSS global ya resuelve el encuadre (`.im img{object-fit:cover}`) y el
 *     tamano del glifo (`.im svg{width:34%}`): aqui no se anade ningun estilo.
 *   - El precio se imprime como `$` + entero, tal cual lo hacia el original
 *     (`'$'+x.p`).
 *   - El atributo `data-add="1"` no se porta: su unico efecto era sumar una
 *     unidad, y eso lo hace ahora `add(1, variante)` del `CartProvider`
 *     (TASK-005).
 *   - `data-open` tampoco se porta: lo sustituye la navegacion por
 *     `router.push('/producto/' + id)`.
 *   - El boton lleva `type="button"`: el original usaba el `type` por defecto
 *     (`submit`), pero no habia ningun `<form>` alrededor.
 *
 * ## Accesibilidad
 *
 *   - `role="link"` + `tabIndex={0}` + `aria-label` con el nombre del producto:
 *     la card expone un nombre accesible propio en vez de concatenar el texto
 *     interno ("categoria, nombre, precio, Agregar").
 *   - `onKeyDown` responde a Enter y Espacio (Espacio con `preventDefault` para
 *     no desplazar la pagina).
 *   - El `onKeyDown` **ignora** los eventos que vienen del boton interior
 *     (`event.target !== event.currentTarget`): si no, activar "Agregar" con
 *     el teclado navegaria al detalle y el contador no se incrementaria.
 *   - El icono vectorial es decorativo: `components/icons` ya lo marca con
 *     `aria-hidden` cuando no tiene nombre accesible.
 *   - La foto lleva `alt` con el nombre del producto, como en el original
 *     (`pic(x)` generaba `alt="{nombre}"`).
 *
 * Este componente lo reutiliza tambien la rejilla de relacionados del detalle
 * (`RelatedProducts`, TASK-009): recibe un `Product` y no depende de donde
 * viene.
 *
 * La decision de accesibilidad del boton interior (`event.target !==
 * event.currentTarget` en `onKeyDown`) vive **aqui**, y por lo tanto Tambie
 * aplica a las cards de `#rel`: "Agregar" nunca navega, ni con raton ni con
 * teclado.
 */

'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { KeyboardEvent, MouseEvent } from 'react';

import { useCart } from '@/components/CartProvider';
import { ProductMediaIcon } from '@/components/icons';
import type { Product } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Contrato publico                                                    */
/* ------------------------------------------------------------------ */

/** Props de `ProductCard`. */
export interface ProductCardProps {
  /** Producto a mostrar. Su `id` es el slug de `/producto/[id]`. */
  product: Product;
}

/**
 * Tamano reservado de la imagen de la card.
 *
 * El grid es de 4 columnas por encima de 960px y de 2 por debajo, asi que la
 * foto de la card ocupa como maximo la cuarta parte del ancho en escritorio y
 * la mitad en movil. No cambia el render (el CSS manda sobre el `width`/`height`
 * intrinsecos) pero evita que el navegador descargue una imagen mas grande de
 * la necesaria.
 */
const CARD_IMAGE_SIZES = '(max-width: 700px) 50vw, (max-width: 960px) 50vw, 25vw';

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

/** Card de producto: navegable por completo y con boton "Agregar" propio. */
export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const { add } = useCart();

  /**
   * Variante con la que agrega la card: la **primera** opcion del producto.
   *
   * El boton "Agregar" no tiene selector de variante, asi que usa la primera
   * del catalogo —la misma que nace activa en el detalle. Sin ella, la linea
   * del carrito se identificaria como `id::` y no coincidiria con la que crea
   * el detalle al elegir su primera opcion: el mismo producto quedaria en dos
   * lineas.
   *
   * `options` nunca esta vacio (invariante de `Product`: al menos una
   * opcion, validada al cargar el manifest), asi que el indice 0 siempre
   * existe; el `??` solo apacigua el `noUncheckedIndexedAccess` del
   * `tsconfig`.
   */
  const defaultOption = product.options[0] ?? '';

  /** Abre el detalle del producto (equivale a `data-open` del original). */
  const openDetail = (): void => {
    router.push(`/producto/${product.id}`);
  };

  /**
   * Equivalente de teclado del clic en la card.
   *
   * Enter y Espacio activan el enlace (WCAG 2.1.1). El `preventDefault` de
   * Espacio evita que la pagina se desplace al pulsar la barra espaciadora.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // Los eventos que vienen del boton ".add" se ignoran: su activacion la
    // gestiona el propio boton (y su `stopPropagation` impide la navegacion).
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDetail();
    }
  };

  /**
   * "Agregar": suma una unidad y **no** navega.
   *
   * El `stopPropagation` es el equivalente directo de la rama `data-add` del
   * listener unico del original (linea 248 del HTML), que devolvia antes de
   * llegar a `data-open`.
   *
   * La variante que se envia es la primera del catalogo (ver
   * `defaultOption`): la linea resultante es la misma que crea el detalle con
   * su primera opcion seleccionada.
   */
  const handleAdd = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    add(product, 1, defaultOption);
  };

  return (
    <div
      className="card"
      role="link"
      tabIndex={0}
      aria-label={`Ver detalle de ${product.name}`}
      onClick={openDetail}
      onKeyDown={handleKeyDown}
    >
      <div className="im">
        {product.media.kind === 'photo' ? (
          <Image
            src={product.media.src}
            alt={product.name}
            width={product.media.width}
            height={product.media.height}
            sizes={CARD_IMAGE_SIZES}
          />
        ) : (
          <ProductMediaIcon media={product.media} />
        )}
      </div>
      <div className="cb">
        <small>{product.category}</small>
        <h3>{product.name}</h3>
        <div className="stars">
          ★★★★★<span>5.0</span>
        </div>
        <div className="cr">
          <span className="pr">{`$${product.price}`}</span>
          <button
            type="button"
            className="add"
            onClick={handleAdd}
            aria-label={`Agregar ${product.name} al carrito`}
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
