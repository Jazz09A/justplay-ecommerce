/**
 * Hero de la home — PLAN.md §7 TASK-007.
 *
 * Reproduce el bloque `.hero` del original (lineas 158-167 del HTML):
 *
 *   <div class="hero" id="top"><div class="w hg">
 *     <div>
 *       <div class="eyebrow">Tienda gamer · Caracas</div>
 *       <h1>Consolas, juegos y servicio técnico en un solo lugar</h1>
 *       <p>Compra tus accesorios favoritos y mantén tu PlayStation en perfecto estado con garantía real y atención personalizada.</p>
 *       <div class="cta"><a class="btn" href="#">Ver catálogo</a><a class="btn l" href="#">Mantenimiento PS5</a></div>
 *       <div class="stats"><div><b>30 días</b><span>de garantía en servicio</span></div><div><b>100%</b><span>garantizado</span></div><div><b>Chacao</b><span>local físico</span></div></div>
 *     </div>
 *     <div class="hi"><img src="…hero…"></div>
 *   </div></div>
 *
 * Decisiones de paridad (mapa de equivalencia §6):
 *   - `.hero` es un `<div>` en el original (no un `<section>`) y lo sigue
 *     siendo: el CSS global lo estiliza por clase, pero `section{padding:56px 0}`
 *     no debe aplicarse aqui, porque `.hero` ya define su propio padding
 *     (`56px 0 48px`) y su borde inferior.
 *   - `.w` + `.hg` se respetan tal cual: `.hg` es el grid de 2 columnas que
 *     colapsa a 1 columna a 960px, y `.hi` conserva `aspect-ratio:4/5` y
 *     `max-height:480px` (riesgo R4: el `max-height` rompe el ratio igual que
 *     en el original, no se "corrige").
 *   - El copy es literal del original, incluido el punto medio del eyebrow
 *     (`·`), las tildes y el orden de las 3 stats.
 *   - `.stats` tiene 3 hijos `<div>` con un `<b>` y un `<span>` cada uno: se
 *     mapean con `key` para conservar el orden del DOM.
 *
 * Diferencias necesarias (TASK-007):
 *   - Los CTA apuntan a las rutas reales `/catalogo` y `/servicios` —el
 *     catálogo y los servicios son ahora páginas propias— en vez de a las
 *     anclas de la home. Son enlaces de ruta, no de fragmento, asi que no
 *     dependen de `HashScroller` (TASK-010) para el scroll.
 *   - El `id="top"` del `.hero` se conserva (es markup literal del original y
 *     sigue sirviendo como enlace profundo), aunque "Inicio" ya no lo use:
 *     apunta a la raíz `/`.
 *   - La imagen usa `next/image` con las dimensiones intrinsecas del manifest
 *     (194x378). El CSS `.hi img{width:100%;height:100%;object-fit:cover}` manda
 *     sobre los atributos `width`/`height`, asi que el encuadre es identico al
 *     del original (riesgo R3). Ademas el optimizador de Next no agranda la
 *     imagen (`withoutEnlargement`), de modo que se sirve el mismo archivo de
 *     194x378 que servia el data URI.
 *   - `priority` reproduce la carga inmediata del `<img>` original (el hero es
 *     el LCP) y evita que el navegador aplique `loading="lazy"`.
 *   - El original no declaraba `alt` en ninguna imagen; aqui se anade un texto
 *     descriptivo en espanol, que es lo unico que faltaba para no dejar la
 *     imagen sin nombre accesible.
 */

import Image from 'next/image';
import Link from 'next/link';

/** Pares valor/etiqueta de las 3 stats del original, en el mismo orden. */
const STATS = [
  { value: '30 días', label: 'de garantía en servicio' },
  { value: '100%', label: 'garantizado' },
  { value: 'Chacao', label: 'local físico' },
] as const;

/** Bloque de cabecera de la home: mensaje principal, CTAs, stats e imagen. */
export function Hero() {
  return (
    <div className="hero" id="top">
      <div className="w hg">
        <div>
          <div className="eyebrow">Tienda gamer · Caracas</div>
          <h1>Consolas, juegos y servicio técnico en un solo lugar</h1>
          <p>
            Compra tus accesorios favoritos y mantén tu PlayStation en perfecto
            estado con garantía real y atención personalizada.
          </p>
          <div className="cta">
            <Link className="btn" href="/catalogo">
              Ver catálogo
            </Link>
            <Link className="btn l" href="/servicios">
              Mantenimiento PS5
            </Link>
          </div>
          <div className="stats">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <b>{stat.value}</b>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="hi">
          <Image
            src="/images/hero.jpg"
            alt="Consola PlayStation 5 blanca junto a un control DualSense, sobre fondo oscuro con detalle naranja."
            width={194}
            height={378}
            priority
            sizes="(max-width: 960px) 92vw, 480px"
          />
        </div>
      </div>
    </div>
  );
}
