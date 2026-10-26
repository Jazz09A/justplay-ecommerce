/**
 * Pie de pagina — PLAN.md §7 TASK-006.
 *
 * Reproduce el `<footer>` del original (linea 205 del HTML), con su copy
 * literal:
 *
 *   <footer><div class="w ft">
 *     <span>© 2026 JustPlay Store · Demo de diseño</span>
 *     <span>@justplaystorevzla</span>
 *   </div></footer>
 *
 * Decisiones de paridad (mapa de equivalencia §6):
 *   - `<footer>` es un elemento semantico: el CSS global lo estiliza por
 *     etiqueta (`footer{border-top:1px solid var(--ln);…}`).
 *   - `.w` (ancho de contenido) y `.ft` (fila con `justify-content:space-between`)
 *     se respetan una a una; `app/globals.css` no se toca.
 *   - El handle de Instagram es un `<span>` plano en el original (no un
 *     enlace): se mantiene, y no se anade ningun destino externo que el
 *     original no tenia.
 *
 * Cambio de navegacion (Fase B):
 *   - Se anade un **tercer** hijo a `.w.ft`: un enlace **interno** a la
 *     seccion de contacto de la home. "Contacto" salio del nav superior y de
 *     la barra inferior por decision de diseno, asi que el pie es ahora su
 *     via de acceso a ese contenido. El copy del copyright y el handle no se
 *     tocan.
 *   - El enlace hereda `color:var(--mu)` del `footer` (regla `a{color:inherit}`
 *     del CSS global), de modo que sin un tratamiento propio seria
 *     indistinguible de los dos `<span>` vecinos. Se le aplica
 *     `color:var(--or)` **en linea**, sin tocar el CSS global: es el mismo
 *     tratamiento que da `.crumb a{color:var(--or)}` a los enlaces de accion
 *     del sitio, y mantiene el contraste en ~7.5:1 sobre `--bg` (AA para
 *     texto normal).
 *   - El desplazamiento al ancla lo resuelve `HashScroller` (TASK-010), que
 *     sigue montado en el layout raiz; por eso el enlace es el unico `href`
 *     con fragmento que queda en el sitio.
 *
 * Es un **server component**: no necesita estado ni efectos, asi que se
 * renderiza en el servidor y no arrastra JavaScript al cliente. `next/link`
 * no lo convierte en cliente.
 */

import Link from 'next/link';

/** Pie de pagina de la tienda. */
export function Footer() {
  return (
    <footer>
      <div className="w ft">
        <span>© 2026 JustPlay Store · Demo de diseño</span>
        <span>@justplaystorevzla</span>
        <Link href="/#contacto" style={{ color: 'var(--or)' }}>
          Contacto
        </Link>
      </div>
    </footer>
  );
}
