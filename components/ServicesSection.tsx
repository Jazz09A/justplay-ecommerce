/**
 * Seccion de servicios — PLAN.md §7 TASK-007.
 *
 * Reproduce el bloque `<section class="svc" id="servicios">` del original
 * (lineas 175-184 del HTML):
 *
 *   <section class="svc" id="servicios"><div class="w sg">
 *     <img src="…servicios…">
 *     <div>
 *       <div class="eyebrow">Servicio técnico</div>
 *       <h2 style="font-size:30px;margin:8px 0 8px">Mantenimiento especial PS5</h2>
 *       <p style="color:var(--mu)">Devuélvele el rendimiento a tu consola con una limpieza completa y cambio de metal líquido.</p>
 *       <ul class="ck"><li>Limpieza de disipador</li>…8 ítems…</ul>
 *       <a class="btn" href="#p2">Ver detalle</a>
 *     </div>
 *   </div></section>
 *
 * Decisiones de paridad (mapa de equivalencia §6):
 *   - `<section class="svc" id="servicios">` conserva etiqueta, clases e `id`
 *     (el `id` es el destino del enlace "Servicios" del header y del boton
 *     "Mantenimiento PS5" del hero).
 *   - `.w` + `.sg` se respetan: `.sg` es el grid `.8fr 1.2fr` que colapsa a 1
 *     columna a 960px; `.sg img` aplica borde, `border-radius` y
 *     `max-width:420px`.
 *   - `.ck` es el checklist de 2 columnas (1 columna a 700px) con el `✓`
 *     naranja del pseudo-elemento `.ck li:before`. Los 8 ítems son **literales**
 *     del original y se conservan en el mismo orden.
 *   - Los estilos inline del original se preservan tal cual: `font-size:30px`
 *     y `margin:8px 0 8px` en el `h2`, `color:var(--mu)` en el `p`.
 *
 * Diferencias necesarias (TASK-007):
 *   - "Ver detalle" apuntaba a `href="#p2"` (ancla interna del detalle). Al
 *     ser el detalle su propia ruta (D5), apunta a `/producto/mantenimiento-ps5`
 *     mediante `next/link` (mapa §5.1: `p2` -> `/producto/mantenimiento-ps5`).
 *   - La imagen usa `next/image` con las dimensiones intrinsecas del manifest
 *     (589x589). Se anade `style={{ height: 'auto' }}` para preservar el
 *     encuadre del original (riesgo R3): el `<img>` original no declaraba
 *     `width`/`height`, asi que conservaba su proporcion intrinseca (1:1) y
 *     `.sg img{width:100%;max-width:420px}` lo dejaba en 420x420. Los atributos
 *     `width`/`height` que emite `next/image` son *hints* de presentacion, y sin
 *     `height:auto` el navegador los aplicaria como alto fijo (420x589:
 *     deformado). `height:auto` devuelve la caja al cuadrado original sin
 *     tocar `app/globals.css`.
 */

import Image from 'next/image';
import Link from 'next/link';

/** Los 8 ítems del checklist del original, en el mismo orden. */
const CHECKLIST = [
  'Limpieza de disipador',
  'Limpieza de ventilador',
  'Limpieza de placa y componentes',
  'Limpieza de puertos USB y HDMI',
  'Inspección de ventilación',
  'Metal líquido del procesador',
  'Garantía de 30 días',
  'Atención personalizada',
] as const;

/** Seccion del servicio tecnico de PlayStation 5. */
export function ServicesSection() {
  return (
    <section className="svc" id="servicios">
      <div className="w sg">
        <Image
          src="/images/servicios.jpg"
          alt="Pieza promocional del mantenimiento especial para PlayStation 5: consola y control DualSense junto a la lista de trabajos incluidos, el WhatsApp y la dirección en Chacao."
          width={589}
          height={589}
          style={{ height: 'auto' }}
          sizes="(max-width: 960px) 92vw, 420px"
        />
        <div>
          <div className="eyebrow">Servicio técnico</div>
          <h2 style={{ fontSize: '30px', margin: '8px 0 8px' }}>
            Mantenimiento especial PS5
          </h2>
          <p style={{ color: 'var(--mu)' }}>
            Devuélvele el rendimiento a tu consola con una limpieza completa y
            cambio de metal líquido.
          </p>
          <ul className="ck">
            {CHECKLIST.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Link className="btn" href="/producto/mantenimiento-ps5">
            Ver detalle
          </Link>
        </div>
      </div>
    </section>
  );
}
