# JustPlay Store

Tienda gamer en Caracas (Chacao): consolas, juegos, accesorios y servicio técnico de PlayStation 5.

Es una **demo local** migrada desde `JustPlay Store – Demo.html`, un HTML autocontenido (HTML + CSS + JS vanilla, con las imágenes incrustadas como *data URI*) que se conserva en la raíz del repositorio como referencia. Esta versión está reescrita con Next.js 15 (App Router) + React 19 + TypeScript, y **ampliada** con un carrito real, páginas separadas para catálogo y servicios, y checkout por WhatsApp.

No hay backend, no hay base de datos y no hay APIs externas: toda la información del catálogo se extrae del HTML original en tiempo de build y se sirve desde el propio repositorio. El **único enlace externo del sitio** es el WhatsApp del negocio (`https://wa.me/584129507176`).

---

## Stack y requisitos

| Pieza | Versión / detalle |
|---|---|
| Next.js | 15.5.28, App Router |
| React | 19 |
| TypeScript | 5.9 en modo estricto (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`) |
| ESLint | 9 con **flat config nativa** (`eslint.config.mjs`), sin `next lint` |
| Node.js | **≥ 20.9.0** (`engines` en `package.json`) |

Deliberadamente **no** hay: Tailwind ni ninguna librería de componentes de UI (el CSS es un único archivo global escrito a mano), backend, base de datos, cliente HTTP, pasarela de pago ni suite de tests automatizados.

## Puesta en marcha

```bash
npm install
npm run dev
```

Abrir <http://localhost:3000>.

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en `http://localhost:3000` |
| `npm run build` | Build de producción (genera las páginas estáticas) |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | ESLint sobre todo el repositorio (`eslint .`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run extract` | Re-extrae los datos y las imágenes del HTML original a `public/images/` |

`npm run extract` **no es necesario** para arrancar: `public/images/` está versionado en el repositorio a propósito (ver el comentario de `.gitignore`), de modo que `npm install && npm run dev` funciona en un clon limpio. Solo hace falta si se modifica el HTML original.

## Estructura de carpetas

```
JustPlayStore/
├── app/                                  # Rutas (App Router)
│   ├── globals.css                       # CSS global: bloque heredado (1-151) + bloque nuevo del carrito (152-237)
│   ├── layout.tsx                        # <html lang="es">, viewport, CartProvider, Header, children, Footer, BottomNav, Toast
│   ├── page.tsx                          # Ruta "/" — server component
│   ├── catalogo/page.tsx                 # Ruta "/catalogo" — server component
│   ├── servicios/page.tsx                # Ruta "/servicios" — server component
│   ├── carrito/page.tsx                  # Ruta "/carrito" — server component
│   └── producto/[id]/page.tsx            # Ruta "/producto/[id]" — server component + generateStaticParams
├── components/                           # Componentes de React
│   ├── CartProvider.tsx                  # 'use client' — estado del carrito (context) + del toast + persistencia
│   ├── CartPage.tsx                      # 'use client' — líneas del carrito, total y checkout a WhatsApp
│   ├── CatalogBrowser.tsx                # 'use client' — buscador, chips de categoría y grid de productos
│   ├── ProductCard.tsx                   # 'use client' — card clicable + botón "Agregar"
│   ├── ProductDetail.tsx                 # 'use client' — opciones, cantidad y compra desde la ficha
│   ├── Header.tsx                        # 'use client' — cabecera, navegación y badge del carrito
│   ├── BottomNav.tsx                     # 'use client' — barra inferior (solo móvil) con estado activo
│   ├── Toast.tsx                         # 'use client' — aviso "Agregado al carrito · Ver carrito"
│   ├── HashScroller.tsx                  # 'use client' — desplazamiento a #ancla tras navegar
│   ├── Hero.tsx                          # server component
│   ├── ServicesSection.tsx               # server component — imagen + checklist de 8 ítems
│   ├── WhySection.tsx                    # server component — las 3 razones
│   ├── ContactSection.tsx                # server component — datos de contacto y dirección
│   ├── RelatedProducts.tsx               # server component — grid de productos relacionados
│   └── icons/index.tsx                   # Set de iconos SVG como componentes React (sin 'use client')
├── lib/                                  # Lógica de dominio (sin 'use client')
│   ├── types.ts                          # Tipos y categorías del catálogo
│   ├── products.ts                       # Catálogo + helpers; lee public/images/manifest.json
│   └── cart.ts                           # Modelo del carrito: CartProduct, CartLine, lineIdOf, sanitizeLine
├── scripts/
│   ├── extract-from-demo.mjs             # Extrae datos e imágenes del HTML original (idempotente)
│   └── check-icons.mjs                   # Comprueba que los SVG de components/icons/ coincidan con los del original
├── public/images/                        # 6 JPEG + manifest.json (artefactos de `npm run extract`, versionados)
├── JustPlay Store – Demo.html            # El original. No se borra ni se modifica: es la referencia
├── PLAN.md                               # Plan de migración, decisiones D1-D7 y desviaciones vigentes
└── next.config.ts  package.json  tsconfig.json  eslint.config.mjs  .gitignore
```

### Server components y client components

En el App Router, un componente sin `'use client'` se renderiza **en el servidor** y su HTML se genera sin JavaScript en el navegador. Un componente con `'use client'` se renderiza también en el servidor, pero además se **hidrata** en el navegador, y a partir de ahí puede usar estado, efectos y hooks del router.

La frontera se ha puesto donde el estado lo exige:

- **Server components** (sin JS en el cliente): `Hero`, `ServicesSection`, `WhySection`, `ContactSection`, `RelatedProducts`, `Footer` y todas las `page.tsx`. Son markup estático: no necesitan hidratarse.
- **Client components**: los que tienen estado o handlers — `CartProvider`, `CartPage`, `CatalogBrowser`, `ProductCard`, `ProductDetail`, `Header`, `BottomNav`, `Toast`, `HashScroller`.

El motivo de la separación no es cosmético: `lib/products.ts` importa `public/images/manifest.json`, que contiene la descripción y las características de los 6 productos. Si un *client component* lo importara, ese catálogo completo entraría en el bundle de JavaScript del navegador. Por eso el catálogo se resuelve en los *server components* (`app/catalogo/page.tsx`, `app/producto/[id]/page.tsx`) y llega al cliente **por prop**, y para el carrito se pasa un catálogo **reducido** (ver más abajo).

## Rutas

| Ruta | Tipo | Contenido |
|---|---|---|
| `/` | Estática | `<main id="home">`: hero (`#top`), la sección "por qué" y la sección de contacto (`#contacto`). El catálogo y los servicios **no** están aquí: son páginas propias |
| `/catalogo` | Estática | `<section id="catalogo">`: buscador (`#sq`), tira de chips de categoría (`#cats`) y grid de 6 productos (`#grid`) |
| `/servicios` | Estática | Mantenimiento especial PS5 (imagen + checklist de 8 ítems) y las 3 razones de "por qué" |
| `/carrito` | Estática | Carrito: líneas con su variante, cantidad, total y formulario de checkout a WhatsApp |
| `/producto/[id]` | SSG | Ficha de producto: precio, opciones, cantidad, compra por WhatsApp, características y 4 relacionados. Se generan **6** rutas estáticas |
| `/producto/<otro-slug>` | — | **404 determinista** |

En total son **10 direcciones** prerenderizadas (4 páginas + 6 fichas de producto), más la página `/_not-found`. El build de Next informa `Generating static pages (13/13)`.

### Generación estática y 404 determinista

`app/producto/[id]/page.tsx` exporta `generateStaticParams()` (que devuelve los 6 ids del catálogo, así que no puede desincronizarse de él) y `dynamicParams = false`. La combinación hace que **cualquier slug que no exista en el catálogo responda 404 de forma determinista**, sin depender de lógica en tiempo de ejecución. Hay además una guarda explícita con `notFound()` por si el slug llegara a la función de página.

## Mapa `legacyIndex` → ruta

El HTML original identificaba los productos por su posición (`#p0`..`#p5`). Esa posición se conserva como `legacyIndex` y se mapea a un slug estable:

| legacyIndex | Id / ruta | Nombre | Categoría | Precio |
|---|---|---|---|---|
| p0 | `/producto/ps5-slim` | Consola PlayStation 5 Slim | Consolas | $520 |
| p1 | `/producto/control-dualsense-ps5` | Control DualSense PS5 | Accesorios | $75 |
| p2 | `/producto/mantenimiento-ps5` | Mantenimiento especial PS5 | Servicio técnico | $35 |
| p3 | `/producto/audifonos-gamer-71` | Audífonos gamer 7.1 | Audífonos | $48 |
| p4 | `/producto/juego-fisico-ps5` | Juego físico PS5 | Juegos | $60 |
| p5 | `/producto/control-ps4-dualshock-4` | Control PS4 DualShock 4 | Accesorios | $42 |

El botón "Ver detalle" de la sección de servicios, que en el original apuntaba a `#p2`, apunta a `/producto/mantenimiento-ps5`.

## El carrito

El carrito es una **funcionalidad real**, no un contador. Su estado vive en `CartProvider`, un Context de React montado en el layout raíz (`app/layout.tsx`), de modo que la cabecera, el catálogo, la ficha de producto y la página del carrito comparten la misma instancia.

### Modelo: una línea es un producto **y** una variante

```
CartItem = { lineId, product: CartProduct, quantity, option? }
lineId   = `${productId}::${claveNormalizada(opcion)}`
```

La variante forma parte de la identidad de la línea. "Control DualSense PS5 (Blanco)" y "Control DualSense PS5 (Negro)" son **dos líneas distintas** y pueden estar en el carrito a la vez; agregar dos veces el mismo producto con la **misma** variante suma la cantidad a la línea existente.

La clave de identidad (`lineIdOf`, en `lib/cart.ts`) normaliza la variante: la recorta y la pasa a minúsculas, de modo que `"Blanco"`, `"blanco"` y `" blanco "` son **la misma línea**. El texto que se guarda y se muestra (`option`) conserva la capitalización original del catálogo, porque es el que viaja al pedido de WhatsApp.

La API del contexto es:

| Miembro | Descripción |
|---|---|
| `count` | Unidades agregadas (suma de las cantidades de todas las líneas) |
| `items` | Líneas del carrito |
| `total` | `Σ precio × cantidad` de todas las líneas |
| `add(product, quantity?, option?)` | Agrega un producto (con su variante opcional) y muestra el toast |
| `remove(lineId)` | Elimina la línea |
| `updateQuantity(lineId, quantity)` | Cambia la cantidad; si llega a `≤ 0`, la línea se elimina |
| `clear()` | Vacía el carrito |

### Persistencia

- **Clave**: `justplay.cart.v1` (versionada, para poder migrar el formato más adelante).
- **Qué se guarda**: únicamente `{ productId, quantity, option }`. **Nunca** el producto entero.
- **Qué se lee**: al montar, en un `useEffect` — **nunca durante el render**. El servidor renderiza siempre un carrito vacío (`items = []`), así que el HTML del servidor y el del cliente coinciden y **no hay *hydration mismatch***.
- **Cuándo se escribe**: solo **después de hidratar**. Dos guardas lo aseguran: una bandera de hidratación y una comparación con el estado inicial. Sin ellas, el primer render guardaría un carrito vacío y **borraría** el pedido que el usuario ya tenía (y el doble montaje de `reactStrictMode` en desarrollo lo dispararía).

### Por qué el catálogo se resuelve en el servidor

El producto de una línea se reconstruye a partir del `productId` guardado, contra un **catálogo reducido** (`CartProduct`: `id`, `name`, `category`, `price`, `media`) que el *layout server* lee del manifest y pasa como prop al provider. Así, la descripción y las características de los productos —el grueso del manifest— **no llegan nunca al bundle del cliente**, y una línea guardada que apunte a un producto retirado del catálogo se descarta en lugar de romper el render.

### `localStorage` inválido o manipulado

Un `localStorage` corrupto **no rompe la app**. Hay tres barreras, todas en `lib/cart.ts` y `components/CartProvider.tsx`:

1. `JSON.parse` va en `try/catch`: si el JSON no es válido, el carrito se trata como vacío.
2. Cada línea pasa por `sanitizeLine`, que descarta lo que no sea `{ productId: string no vacío, quantity: entero ≥ 1, option?: string }`. Una cantidad `0`, negativa o fraccionaria, o una `option` que no sea texto, invalidan la línea.
3. Las líneas cuyo `productId` no exista en el catálogo se ignoran.

La escritura también va en `try/catch`: si el almacenamiento falla (cuota agotada, permisos), el carrito sigue funcionando en memoria.

## Flujo de compra a WhatsApp

**No hay pasarela de pago.** El pago se coordina por WhatsApp, que es como funciona el negocio: el cliente manda su pedido por el chat y la tienda le confirma disponibilidad, forma de entrega y forma de pago. El sitio no cobra ni registra transacciones.

El checkout de `/carrito` es un formulario con cuatro campos:

| Campo | Requerido | Notas |
|---|---|---|
| Nombre | Sí | `required`, `autocomplete="name"` |
| Teléfono | Sí | `required`, `type="tel"` |
| Dirección | No | `autocomplete="street-address"` |
| Notas | No | área de texto |

Si falta el nombre o el teléfono, el botón "Finalizar compra por WhatsApp" queda deshabilitado (`aria-disabled="true"`), aparece un mensaje de error contextual (`.formerror`, con `role="alert"`) que dice **qué** falta, y el foco se lleva al primer campo inválido.

Al enviar, se abre el chat de WhatsApp con este texto:

```
Hola JustPlay, quiero confirmar este pedido:

1. Control DualSense PS5 (Blanco) x2 — $150
2. Mantenimiento especial PS5 x1 — $35

Total: $185

Nombre: Juan Pérez
Teléfono: 0412 950 7176
Dirección: Chacao, Caracas
Notas: Entrega en la tarde
```

Formato exacto:

- Una línea por artículo, numerada, con `x<cantidad>` y el importe de esa línea.
- El separador entre el artículo y su importe es una **raya** `—` (U+2014), con espacios a ambos lados.
- La variante va entre paréntesis **solo si el artículo tiene variante**.
- `Dirección:` y `Notas:` se **omiten** si están vacías.
- El total es la suma de los importes de las líneas (`Σ precio × cantidad`), el mismo valor que muestra el resumen de la página.
- La base del enlace es `https://wa.me/584129507176?text=` + `encodeURIComponent(mensaje)`.

Al enviar, el carrito **se vacía** y la página muestra el estado "Pedido enviado a WhatsApp" (que es distinto del estado "tu carrito está vacío": en el primero el pedido ya está en el chat y solo falta la confirmación de la tienda).

## Extracción de datos e imágenes

`npm run extract` ejecuta `scripts/extract-from-demo.mjs`, que reconstruye los datos y los binarios del catálogo a partir de `JustPlay Store – Demo.html`:

- **Imágenes**: decodifica los 6 *data URI* JPEG del HTML y los escribe como `.jpg` en `public/images/`. No copia el base64: lo decodifica, valida la estructura del JPEG (marcadores SOI/SOF/SOS/EOI) y **lee las dimensiones reales** del marcador SOF.
- **Datos**: localiza el array `P` del HTML y lo evalúa en un sandbox de Node (`node:vm`), sin `require`, sin `process` y sin red. De ahí salen los 6 productos con su nombre, categoría, precio, opciones, descripción y características.
- **Manifest**: escribe `public/images/manifest.json` con el inventario de imágenes (ruta, bytes, sha256, dimensiones, duplicados) y los datos de los 6 productos.

El script **falla ruidosamente** (código de salida ≠ 0) si:

- un producto no tiene `options` no vacío, `description` no vacía o `features` no vacías;
- un data URI no es un JPEG base64 válido, o el payload no decodifica;
- un JPEG está truncado, no tiene marcador SOF o no tiene EOI;
- el número de productos o de fotos no es el esperado.

Es **idempotente**: reejecutarlo produce exactamente los mismos bytes y no reescribe los archivos que no cambian (`writeIfChanged`). Los archivos de `public/images/` están versionados a propósito, para que `npm run build` funcione en un clon limpio.

### Por qué existe el script

En el HTML original, los productos con foto viven en líneas de varios miles de caracteres que contienen el payload base64. Cualquier lectura con vista previa **trunca** esas líneas y hace creer que faltan los campos `options`, `description` y `features` — el "hueco" que parecía en el brief. Al leerlas a mano se transcribe mal o se inventan datos. El script elimina esa categoría de error: los datos **no pasan por el canal humano**, y si algo falta, el script falla en lugar de dejar que el build se adelante con un dato inventado.

### Imágenes duplicadas

`servicios.jpg` y `mantenimiento-ps5.jpg` son **el mismo archivo** (mismo sha256 `8de143e2…`, 589×589): el HTML original reutiliza esa misma foto en los dos huecos. Se conservan los dos archivos para poder sustituirlos por separado, y el manifest lo declara en `duplicateOf`.

## Desviaciones respecto al original

Estas diferencias con `JustPlay Store – Demo.html` son **deliberadas**. El original se conserva sin modificar como referencia.

**(a) El CSS fue reestilizado.** Ya no es una copia literal del `<style>` del original. En términos medidos: unas 30 reglas de nivel superior cambiaron (≈52 declaraciones), 3 se eliminaron y 3 se añadieron. Los cambios visibles: los chips de categoría pasaron de circulares a cuadrados, el botón "Agregar" lleva degradado y el hover de la card levanta la tarjeta con sombra, el fondo de la imagen de la card es un degradado lineal en lugar de radial, y se ajustaron espaciados y tipografías. Motivo: el CSS se rediseñó junto con las nuevas funcionalidades, por decisión del usuario. **La paridad pixel-perfect con el original ya no es el objetivo.**

**(b) Se eliminaron 3 reglas de CSS.** `#detail{display:none}`, `body.det #home{display:none}` y `body.det #detail{display:block}`. Motivo: la ficha de producto dejó de ser un estado del `<body>` y pasó a ser su propia ruta; esas reglas quedaban muertas y la primera ocultaría la página entera.

**(c) La imagen de servicios lleva `height:auto` en línea.** Es la única desviación de estilo en línea del proyecto. Motivo: `next/image` emite los atributos `width`/`height` como pistas de presentación, y sin `height:auto` el navegador aplicaría el alto intrínseco y deformaría la caja a 420×589.

**(d) Hay un bloque de CSS nuevo de 86 líneas** (líneas 152–237 de `app/globals.css`: 1–18 es el comentario de cabecera y 19–151 el CSS heredado), añadido al final sin tocar lo anterior. Aporta las clases de la página del carrito y del checkout (`.cartlist`, `.cartrow*`, `.cartempty`, `.checkout`, `.field`, `.formerror`), el estado activo de la barra inferior (`.bn a.on`), el enlace del toast, los estados deshabilitados y el anillo de foco. En el original no existían porque el carrito se resolvía con atributos `style` en línea y no era responsive.

**(e) El toast lleva un enlace al carrito.** Pasa de ser un texto plano a `Agregado al carrito · Ver carrito`. Motivo: el carrito es ahora una página real y el enlace permite ir al pedido sin buscar el icono en la cabecera. Su DOM ya no es idéntico al del original; el resto del mecanismo (la clase `s` como único mecanismo de visibilidad, 1300 ms) se conserva.

**(f) El carrito persiste en `localStorage`.** El original no persistía y un `F5` lo vaciaba. Motivo: con el checkout, el pedido se arma a lo largo de varias sesiones y el sitio no debe perderlo al recargar.

Además, dos cambios de navegación que también son deliberados: el catálogo y los servicios son **páginas propias** (la home es hero + "por qué" + contacto), y la navegación se reestructuró — el nav superior tiene 3 enlaces (Inicio, Catálogo, Servicios), la barra inferior tiene 4 (Inicio, Catálogo, Servicios, Carrito) y "Contacto" sale de la navegación y queda accesible desde el pie de página.

## Accesibilidad

- **Card de producto**: es un `div[role="link"][tabIndex={0}]` con un `<button>` "Agregar" dentro. Es la decisión D7 del plan: envolver el botón en un `<Link>` generaría HTML inválido (interactivo anidado). El precio de esta decisión es que **axe reporta `nested-interactive` como *needs review***: hay un elemento con rol de enlace que contiene un control. El teclado funciona en los dos niveles — Enter y Espacio abren la ficha, y el botón "Agregar" se activa sin navegar (el `onKeyDown` ignora los eventos que vienen del botón interior). El original no era enfocable en absoluto: era un `<div data-open>` sin `tabindex`.
- **Estado activo de la barra inferior**: se marca con **color y con `aria-current="page"`**, no solo con el color. El CSS heredado pintaba "Inicio" de naranja en cualquier ruta; ahora el naranja lo lleva solo el item cuya ruta coincide con la actual.
- **Campos del checkout**: los `<input>` y el `<textarea>` tienen `<label>` asociado por `htmlFor`/`id`, anillo de foco visible (`.field input:focus`, `.field textarea:focus`), `aria-invalid` en los dos campos requeridos cuando falta su valor y `aria-describedby` apuntando al mensaje de error.
- **Mensaje de error**: `.formerror` con `role="alert"`, y el foco se mueve al primer campo inválido al intentar enviar.
- **Buscador**: lleva `aria-label` propio (el `placeholder` no es un nombre accesible fiable).
- **Chips de categoría y opciones**: `<button>` nativos con `aria-pressed`, que es el patrón correcto para filtros de selección única.
- **Iconos**: los glifos sin nombre accesible se marcan con `aria-hidden`; los que sí lo tienen (el carrito, la lupa) llevan `aria-label`.

## Verificación

Comandos que pasan:

```bash
npm run typecheck   # tsc --noEmit → exit 0
npm run lint        # eslint .     → exit 0
npm run build       # next build   → exit 0, "Generating static pages (13/13)"
```

### Checklist funcional

- [ ] `/` responde 200 y renderiza `<main id="home">` con hero, "por qué" y contacto; **no** contiene `id="catalogo"` ni `id="servicios"`.
- [ ] `/catalogo` responde 200 con un único `<section id="catalogo">`, buscador, chips y 6 productos.
- [ ] `/servicios` responde 200 con la imagen, el checklist de 8 ítems y las 3 razones.
- [ ] `/carrito` responde 200 y renderiza el estado vacío en el HTML del servidor.
- [ ] Los 6 `/producto/<slug>` responden 200; `/producto/no-existe` responde **404**.
- [ ] El nav superior tiene 3 enlaces; el bottom-nav tiene 4; el activo lleva clase `on` y `aria-current="page"`.
- [ ] "Contacto" no está en la navegación y es el único fragmento del sitio (`/#contacto`, en el footer).
- [ ] "Agregar" suma 1 unidad, **no** navega al detalle y muestra el toast.
- [ ] El mismo producto con dos variantes genera 2 líneas; con la misma variante, suma cantidad.
- [ ] `+` / `−` ajustan la cantidad; `−` se deshabilita en 1; "Eliminar" quita la línea; "Vaciar carrito" vacía.
- [ ] Un `F5` mantiene el carrito; la clave es `justplay.cart.v1` y solo contiene `{ productId, quantity, option }`.
- [ ] El HTML del servidor muestra el carrito vacío aunque `localStorage` tenga contenido, y la consola **no** reporta errores de hidratación.
- [ ] Un `localStorage` manipulado (JSON inválido, cantidad `0`, `productId` inexistente) no rompe la app: las líneas inválidas se descartan.
- [ ] El botón de WhatsApp queda deshabilitado si falta Nombre o Teléfono, aparece el `.formerror` y el foco va al campo inválido.
- [ ] Con los datos rellenos, el `href` decodificado es exactamente el texto del pedido documentado arriba.
- [ ] Al enviar, se abre WhatsApp, el carrito se vacía y aparece el estado "Pedido enviado".

## Deuda conocida

Puntos abiertos, sin impacto en el funcionamiento:

1. **Avisos de `next/image` en desarrollo.** Next.js puede emitir avisos sobre el uso de `next/image` al ejecutar `npm run dev`. No aparecen en el build de producción.
2. **Objetivo táctil en el control de cantidad.** `.qty button` mide 40×42 px (`app/globals.css`), por debajo del objetivo de 44×44 px recomendado.
3. **`prefers-reduced-motion` no está contemplado.** El CSS no tiene ninguna regla para `prefers-reduced-motion`, así que las transiciones (hover de la card, degradados) no se desactivan cuando el sistema pide reducir el movimiento.
4. **`next build` y `next dev` chocan en el mismo directorio.** Con un `npm run dev` corriendo en la carpeta del proyecto, `npm run build` falla. Para compilar, detén el servidor de desarrollo o compila en otra copia del directorio.
5. **El lint dependía de 5 paquetes que no estaban declarados.** `eslint.config.mjs` importa `@next/eslint-plugin-next`, `eslint-plugin-react-hooks`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` y `globals`, que hasta hace poco llegaban solo como dependencias transitivas de `eslint-config-next`. **Resuelto el 2026-10-25**: los cinco están ya declarados explícitamente en `devDependencies`. Lo que **queda desfasado** es el comentario de cabecera de `eslint.config.mjs`, que sigue diciendo que "ninguno de los paquetes de abajo figura hoy en `package.json`".
6. **Un aviso de `autoprefixer` en el build.** En un build en frío, `app/globals.css:54` emite `end value has mixed support, consider using flex-end instead` por `align-items:end`. Es una regla heredada del HTML original y no impide el build (exit 0).
7. **El comentario de cabecera de `app/globals.css` está desfasado.** Sigue diciendo que el CSS es una copia "VERBATIM" del original, y ya no lo es (ver la desviación (a)). Está registrado en `PLAN.md` §12.

## Referencia al original

- `JustPlay Store – Demo.html` — el HTML autocontenido original, en la raíz del repositorio. **No se borra ni se modifica**: es la referencia contra la que se contrastó la migración y de la que `npm run extract` saca los datos y las imágenes.
- `PLAN.md` — el plan de migración completo: qué entendía el plan, los supuestos (S1–S6), las decisiones (D1–D7, con la reversión de D3 documentada como D3-bis), el mapa de equivalencia HTML → TSX, las tareas (TASK-001 a TASK-013), el plan de verificación, los riesgos (R1–R20) y las **desviaciones vigentes**.
# justplay-ecommerce
