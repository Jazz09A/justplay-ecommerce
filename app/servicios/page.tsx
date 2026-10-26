/**
 * Página de servicios — Fase A.
 *
 * Los servicios dejan de ser una sección de la home y pasan a ser una página
 * propia (`/servicios`).
 *
 * Se reutilizan los componentes que ya existen, sin inventar copy:
 *   - `ServicesSection` → `<section class="svc" id="servicios">` con la
 *     imagen, el checklist de 8 ítems y el botón "Ver detalle" →
 *     `/producto/mantenimiento-ps5`.
 *   - `WhySection` → las 3 razones ("Productos originales", "Garantía",
 *     "Atención directa"), que encajan también en una página de servicios.
 *
 * Ambas páginas son server components: no hay estado ni handlers, así que el
 * HTML se genera en el servidor y no necesita hidratarse. Sin `paddingTop`
 * inline: el `<header>` es `position:sticky` y ya ocupa espacio en el flujo.
 */

import { ServicesSection } from '@/components/ServicesSection';
import { WhySection } from '@/components/WhySection';

export default function ServiciosPage() {
  return (
    <main>
      <ServicesSection />
      <WhySection />
    </main>
  );
}
