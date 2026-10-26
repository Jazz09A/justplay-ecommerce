/**
 * Seccion de contacto — PLAN.md §7 TASK-007.
 *
 * Reproduce el bloque `<section id="contacto" style="padding-top:0">` del
 * original (lineas 192-195 del HTML):
 *
 *   <section id="contacto" style="padding-top:0"><div class="w ct2">
 *     <div class="box"><h3>Escríbenos</h3><p><b>WhatsApp:</b> 0412 950 7176</p><p><b>Instagram:</b> @justplaystorevzla</p><div style="margin-top:18px"><a class="btn g" target="_blank" rel="noopener" href="https://wa.me/584129507176">Abrir WhatsApp</a></div></div>
 *     <div class="box"><h3>Visítanos</h3><p>Caracas, Chacao, Av. Guaicaipuro</p><p>C.C. Metropolitano, PB, Local 14</p></div>
 *   </div></section>
 *
 * Decisiones de paridad (mapa de equivalencia §6):
 *   - `<section id="contacto">` conserva el `id` (destino del enlace
 *     "Contacto" del header y del bottom nav) y el estilo inline
 *     `padding-top:0`, que anula el padding superior de `section{padding:56px 0}`
 *     para que la seccion quede pegada a la anterior.
 *   - `.w` + `.ct2` se respetan: grid de 2 columnas que colapsa a 1 columna a
 *     960px; cada hijo es un `.box` con borde, `border-radius` y padding.
 *   - `.box p` es texto secundario (`--mu`) y `.box p b` vuelve a `--tx`: por eso
 *     "WhatsApp:" e "Instagram:" van en `<b>` y el resto en texto plano.
 *   - Se conserva el `<div style="margin-top:18px">` que envuelve al boton: el
 *     margen separa el boton verde del bloque de datos.
 *   - El boton de WhatsApp es un `<a>` plano (no `next/link`) porque es el
 *     unico enlace externo del sitio: abre en pestaña nueva con
 *     `target="_blank" rel="noopener"`.
 */

/**
 * Enlace de WhatsApp de la tienda (unico enlace externo del sitio).
 * Se declara aqui, y no se importa del header, para no acoplar esta seccion
 * (server component) al modulo cliente del header.
 */
const WHATSAPP_URL = 'https://wa.me/584129507176';

/** Seccion de contacto: datos de contacto y direccion del local. */
export function ContactSection() {
  return (
    <section id="contacto" style={{ paddingTop: 0 }}>
      <div className="w ct2">
        <div className="box">
          <h3>Escríbenos</h3>
          <p>
            <b>WhatsApp:</b> 0412 950 7176
          </p>
          <p>
            <b>Instagram:</b> @justplaystorevzla
          </p>
          <div style={{ marginTop: 18 }}>
            <a
              className="btn g"
              target="_blank"
              rel="noopener"
              href={WHATSAPP_URL}
            >
              Abrir WhatsApp
            </a>
          </div>
        </div>
        <div className="box">
          <h3>Visítanos</h3>
          <p>Caracas, Chacao, Av. Guaicaipuro</p>
          <p>C.C. Metropolitano, PB, Local 14</p>
        </div>
      </div>
    </section>
  );
}
