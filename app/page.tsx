/**
 * Home de JustPlay Store — Fase A.
 *
 * El catálogo y los servicios se movieron a sus propias rutas (`/catalogo` y
 * `/servicios`), así que la home queda en **hero + por qué + contacto**:
 *
 *   <main id="home">
 *     <div class="hero" id="top">…</div>              → <Hero/>
 *     <section><div class="w why">…</div></section>    → <WhySection/>
 *     <section id="contacto">…</section>              → <ContactSection/>
 *   </main>
 *
 * El `id="home"` se conserva porque el CSS global lo referencia (supuesto S3).
 *
 * La home ya no necesita datos de producto: no importa `getAllProducts()` ni
 * monta `CatalogBrowser`, así que el manifest completo (`lib/products.ts`)
 * queda fuera de esta ruta por completo.
 */

import { ContactSection } from '@/components/ContactSection';
import { Hero } from '@/components/Hero';
import { WhySection } from '@/components/WhySection';

export default function HomePage() {
  return (
    <main id="home">
      <Hero />
      <WhySection />
      <ContactSection />
    </main>
  );
}
