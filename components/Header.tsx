/**
 * Cabecera sticky del sitio — PLAN.md §7 TASK-006.
 *
 * Reproduce el `<header>` del original (lineas 146-155 del HTML):
 *
 *   <header>
 *     <div class="w hd">
 *       <a class="logo" href="#"><img src="…logo…" alt="JustPlay"><div>JUST<span>PLAY</span> STORE</div></a>
 *       <nav><a href="#">Inicio</a><a href="#">Catálogo</a><a href="#">Servicios</a><a href="#">Contacto</a></nav>
 *       <div class="hr">
 *         <a class="btn" target="_blank" rel="noopener" href="https://wa.me/584129507176">WhatsApp</a>
 *         <div class="ib"><svg …carrito…/><div class="ct" id="cnt">0</div></div>
 *       </div>
 *     </div>
 *   </header>
 *
 * Decisiones de paridad (mapa de equivalencia §6):
 *   - `<header>` y `<nav>` son **elementos semanticos**: el CSS global los
 *     estiliza por etiqueta (`header{position:sticky…}`, `nav{display:flex…}`),
 *     no por clase.
 *   - Las clases `.w`, `.hd`, `.logo`, `.hr`, `.ib` y `.ct` se respetan una a
 *     una: `app/globals.css` depende de ellas y no se toca.
 *   - El texto del logo es literal del original: `JUST` + `<span>PLAY</span>`
 *     (naranja via `.logo span{color:var(--or)}`) + ` STORE`. El `<div>` que
 *     lo envuelve tambien es literal: sin el, el texto no seria hijo directo
 *     del `.logo` y el flex de `.logo` no lo alinearia igual.
 *   - `.ib` era un `div` estatico (no un enlace) en el original. Ahora es un
 *     `<Link href="/carrito">`: el carrito paso a ser una pagina real, asi que
 *     el icono lleva al pedido. La clase `.ib` se respeta igual.
 *   - El icono de carrito es `IconCart` con `size={20}`, el tamano que fijaba
 *     el original; el badge `#cnt` muestra el valor de `useCart()`.
 *
 * Diferencias necesarias (TASK-006):
 *   - En el original los 4 enlaces del nav eran placeholders (`href="#"`) que
 *     señalaban la sección de destino con un atributo `data-*` por enlace, y el
 *     scroll lo delegaba un listener de JS. Aquí cada enlace es un **destino
 *     real** (`/`, `/catalogo`, `/servicios`): el nav ya no usa anclas, solo
 *     rutas del App Router. El botón de WhatsApp conserva `target="_blank"` y
 *     `rel="noopener"`.
 *   - El nav tiene **3 enlaces, no 4**: "Contacto" se retiró del nav superior
 *     por decisión de diseño, porque el catálogo y los servicios pasaron a ser
 *     páginas propias y el nav ya no debe duplicar el contenido de la home. El
 *     contacto se sigue viendo al final de la home y ahora tiene un enlace
 *     explícito en el pie (`components/Footer.tsx`).
 *   - "Inicio" apunta a la raíz `/` en lugar de a un ancla de la home: la
 *     home *es* la raíz, así que el enlace ya no necesita fragmento.
 *   - El logo usa `next/image` con las dimensiones intrinsecas del manifest
 *     (120x120); el CSS `.logo img{width:38px;height:38px;border-radius:8px}`
 *     fija el tamano visual, asi que no se pasan `sizes` ni `fill`.
 */

'use client';

import Image from 'next/image';
import Link from 'next/link';

import { useCart } from '@/components/CartProvider';
import { IconCart } from '@/components/icons';

/** Unico enlace externo del sitio (WhatsApp). */
const WHATSAPP_URL = 'https://wa.me/584129507176';

/** Enlace del nav superior. */
interface NavLink {
  /** Destino real: una ruta del App Router (no un ancla de la home). */
  href: string;
  /** Etiqueta literal del original. */
  label: string;
}

/**
 * Nav superior: los destinos del original, convertidos en enlaces navegables.
 *
 * Hoy son **3**: el original tenía 4 (Inicio, Catálogo, Servicios y
 * Contacto), pero "Contacto" salió del nav por decisión de diseño —el
 * catálogo y los servicios son páginas propias y el contacto se alcanza
 * desde el pie y al final de la home—, así que el nav describe la
 * arquitectura de rutas y no las secciones de la home.
 */
const NAV_LINKS: ReadonlyArray<NavLink> = [
  { href: '/', label: 'Inicio' },
  { href: '/catalogo', label: 'Catálogo' },
  { href: '/servicios', label: 'Servicios' },
];

/** Cabecera del sitio: logo, navegacion, WhatsApp y carrito. */
export function Header() {
  const { count } = useCart();

  return (
    <header>
      <div className="w hd">
        <Link className="logo" href="/">
          <Image src="/images/logo.jpg" alt="JustPlay" width={120} height={120} />
          <div>JUST<span>PLAY</span> STORE</div>
        </Link>
        <nav>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hr">
          <a className="btn" href={WHATSAPP_URL} target="_blank" rel="noopener">
            WhatsApp
          </a>
          <Link href="/carrito" className="ib">
            <IconCart size={20} />
            <div className="ct" id="cnt">
              {count}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
