import type { Metadata, Viewport } from 'next';
import './globals.css';

import { BottomNav } from '@/components/BottomNav';
import { CartProvider } from '@/components/CartProvider';
import { Footer } from '@/components/Footer';
import { HashScroller } from '@/components/HashScroller';
import { Header } from '@/components/Header';
import { Toast } from '@/components/Toast';
import { getCartCatalog } from '@/lib/products';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'JustPlay Store – Demo',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /**
   * Catalogo del carrito, resuelto **en el servidor**.
   *
   * Este layout es un server component, asi que puede leer el manifest sin
   * problema. Lo que se pasa al provider es la forma reducida (`CartProduct[]`):
   * ni la `description` ni las `features` viajan al payload del cliente, que
   * es justo lo que se quiere evitar (el manifest completo en el bundle).
   */
  const cartCatalog = getCartCatalog();

  return (
    <html lang="es">
      <body>
        {/*
          TASK-005: el provider envuelve `{children}` para que el contador del
          carrito sea el mismo en la home y en el detalle. `<Toast/>` va dentro
          del provider (necesita su contexto) pero lo monta el layout, no el
          provider: asi `CartProvider` no importa a `Toast` y no hay
          dependencia circular. El toast queda el ultimo elemento del body,
          igual que en el original (linea 207 del HTML).

          TASK-006: el orden de los hijos reproduce el DOM del original
          (lineas 146-207): `header` -> `main` -> `footer` -> `.bn` -> `.toast`.
          El header y el bottom-nav quedan en el layout raiz, asi que se ven
          igual en `/` y en `/producto/x`; el footer tambien, porque en el
          original vivia fuera de `#home`/`#detail`.

          TASK-010: `<HashScroller/>` va en el layout raiz, NO en `app/page.tsx`.
          Si viviera en la home se desmontaria al navegar a otra pagina y
          perderia el scroll al ancla (por ejemplo, al volver del detalle
          `/producto/x` al enlace "Contacto" del pie, `/#contacto`). No
          produce DOM, no necesita props ni `<Suspense>`, y no depende del
          contexto del carrito, asi que queda fuera de
          `<CartProvider>` y antes de el.
        */}
        <HashScroller />
        <CartProvider catalog={cartCatalog}>
          <Header />
          {children}
          <Footer />
          <BottomNav />
          <Toast />
        </CartProvider>
      </body>
    </html>
  );
}
