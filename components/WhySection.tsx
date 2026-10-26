/**
 * Seccion "por que" — PLAN.md §7 TASK-007.
 *
 * Reproduce el bloque `<section><div class="w why">` del original (lineas
 * 186-190 del HTML):
 *
 *   <section><div class="w why">
 *     <div><h3>Productos originales</h3><p>Consolas, controles y juegos con respaldo de la tienda.</p></div>
 *     <div><h3>Garantía</h3><p>Todos nuestros servicios incluyen 30 días de garantía.</p></div>
 *     <div><h3>Atención directa</h3><p>Te atendemos por WhatsApp y en nuestro local en Chacao.</p></div>
 *   </div></section>
 *
 * Decisiones de paridad (mapa de equivalencia §6):
 *   - `<section>` **sin `id`**: el original no le daba ninguno y el CSS global
 *     lo estiliza por etiqueta (`section{padding:56px 0}`).
 *   - `.w` + `.why` se respetan: `.why` es el grid de 3 columnas (`repeat(3,1fr)`)
 *     que colapsa a 1 columna a 960px.
 *   - Cada hijo de `.why` contiene **exactamente** un `<h3>` y un `<p>`, sin
 *     `<div>` intermedios: la regla `.why div{border:…;padding:24px}` aplica a
 *     todo `div` descendiente, asi que cualquier envoltorio extra dibujaria un
 *     segundo borde dentro de la tarjeta.
 *   - El copy es literal del original, con sus tildes ("Garantía", "Atención
 *     directa", "Chacao") y su punto final.
 */

interface WhyItem {
  /** Titulo de la tarjeta. */
  title: string;
  /** Texto descriptivo de la tarjeta. */
  description: string;
}

/** Las 3 razones del original, en el mismo orden. */
const WHY_ITEMS: ReadonlyArray<WhyItem> = [
  {
    title: 'Productos originales',
    description: 'Consolas, controles y juegos con respaldo de la tienda.',
  },
  {
    title: 'Garantía',
    description: 'Todos nuestros servicios incluyen 30 días de garantía.',
  },
  {
    title: 'Atención directa',
    description: 'Te atendemos por WhatsApp y en nuestro local en Chacao.',
  },
];

/** Bloque de razones para elegir JustPlay Store. */
export function WhySection() {
  return (
    <section>
      <div className="w why">
        {WHY_ITEMS.map((item) => (
          <div key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
