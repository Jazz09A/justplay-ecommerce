/**
 * Barra de navegacion inferior (movil) — PLAN.md §7 TASK-006.
 *
 * Reproduce el bloque `.bn` del original (linea 206 del HTML):
 *
 *   <div class="bn">
 *     <a href="#"><svg …home…/>Inicio</a>
 *     <a href="#"><svg …rejilla…/>Catálogo</a>
 *     <a href="#"><svg …herramienta…/>Servicios</a>
 *     <a href="#"><svg …bocadillo…/>Contacto</a>
 *   </div>
 *
 * Decisiones de paridad (mapa de equivalencia §6):
 *   - `.bn` es un `div` (no un elemento `nav`): en el original es una barra
 *     fija que duplica el nav superior para pantallas <= 700px, y asi se
 *     mantiene para no alterar la semantica de la pagina.
 *   - Las clases `.bn`, `.bn a` y `.bn svg` se respetan: el CSS global las
 *     estiliza (`display:none` por defecto y `display:flex` en el breakpoint
 *     de 700px).
 *   - Los glifos son los del set de iconos de UI (`components/icons`), que ya
 *     reproduce la geometria del original con `stroke-width="2"`. El tamano
 *     lo fija el CSS (`.bn svg{width:22px;height:22px}`), asi que no se pasa
 *     `size`.
 *   - El texto va **detras** del icono, igual que en el original; el `gap:3px`
 *     del CSS separa los dos.
 *
 * Diferencia necesaria (TASK-006): los `href="#"` del original eran
 * placeholders que delegaban el scroll en JS; aqui cada item apunta a su
 * destino real (`/`, `/catalogo`, `/servicios`, `/carrito`).
 *
 * La barra tiene **4 items**: el original tenia 4 (Inicio, Catálogo, Servicios
 * y Contacto) y este proyecto añade Carrito como quinto; con la retirada de
 * "Contacto" del nav (decisión de diseño, ver `components/Header.tsx`) vuelve
 * a tener 4. El orden y el numero de items no se tocan.
 *
 * ## Estado activo (Fase F)
 *
 * El CSS heredado del demo tiene `.bn a:first-child{color:var(--or)}`: pinta
 * "Inicio" de naranja **siempre**, tambien en `/catalogo` o `/servicios`.
 * Con 4 items eso se lee como un "activo" que no es real: el usuario no
 * sabe en que pagina esta.
 *
 * Aqui el estado activo es **real**: el item activo es el cuya ruta coincide
 * con la ruta actual, y se marca con dos señales:
 *
 *   - `className="on"`, que el CSS global pinta de naranja (`.bn a.on`) y
 *     que **anula** el `:first-child` heredado (`.bn a:first-child{color:
 *     var(--mu)}`): "Inicio" solo es naranja cuando esta activo.
 *   - `aria-current="page"`, para que un lector de pantalla anuncie en que
 *     seccion esta el usuario y no dependa del color.
 *
 * La comparacion es de **ruta exacta** (`pathname === href`): `usePathname()`
 * devuelve la ruta sin query ni hash, asi que `/catalogo?ref=bn` sigue
 * apuntando a "Catalogo" y `/producto/5` no marca ninguno de los 4 items
 * (es una pagina que no esta en la barra inferior).
 *
 * Esto convierte el componente en un **client component**: `usePathname` es
 * un hook del router del App Router, que solo existe en el cliente. El
 * componente no managea estado propio ni efectos: el unico dato que lee es
 * la ruta actual, y el resto es `next/link` con iconos presentacionales
 * (`components/icons`, que tampoco es cliente).
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { IconCart, IconCatalog, IconHome, IconServices } from '@/components/icons';
import type { IconComponent } from '@/components/icons';

/** Item de la barra inferior: icono + etiqueta. */
interface BottomNavItem {
  /** Destino real: una ruta del App Router (no un ancla de la home). */
  href: string;
  /** Etiqueta visible del item. */
  label: string;
  /** Glifo del item. */
  Icon: IconComponent;
}

/** Los 4 items del bottom nav, en el mismo orden. */
const BOTTOM_NAV_ITEMS: ReadonlyArray<BottomNavItem> = [
  { href: '/', label: 'Inicio', Icon: IconHome },
  { href: '/catalogo', label: 'Catálogo', Icon: IconCatalog },
  { href: '/servicios', label: 'Servicios', Icon: IconServices },
  { href: '/carrito', label: 'Carrito', Icon: IconCart },
];

/** Barra de navegacion inferior, visible solo en movil. */
export function BottomNav() {
  /** Ruta actual (sin query ni hash). */
  const pathname = usePathname();

  return (
    <div className="bn">
      {BOTTOM_NAV_ITEMS.map(({ href, label, Icon }) => {
        /** `true` si este item es la pagina actual. */
        const isActive = pathname === href;

        return (
          <Link
            key={href}
            href={href}
            className={isActive ? 'on' : undefined}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
