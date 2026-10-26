# Plan de ejecución — Migración JustPlay Store a Next.js

**Fecha:** 2026-10-25 · **Estado:** **Ejecutado y ampliado** — TASK-001 a TASK-013 completados el 2026-10-25; segunda tanda (Fases A–F) ejecutada el 2026-10-25

> **Correcciones posteriores a la ejecución (2026-10-25).** Al contrastar el plan con el HTML original y con la implementación se corrigieron tres afirmaciones que habían quedado desfasadas: §9 R13 (número de estrellas de la card), §7 TASK-006 (clase del footer: `.ft`, no `.footer`) y §8.2 (checklist de estrellas de card y detalle). Se corrigieron **en el sitio**, conservando la estructura y los identificadores del documento. El anexo de evidencia se mantiene intacto.

> **Ampliación del alcance (2026-10-25).** El alcance original de este plan era una **migración fiel**: el HTML del demo pasado a Next.js con el CSS *verbatim*. Ese alcance se **amplió** con una **segunda tanda** de trabajo (Fases A–F) que, por decisión del usuario, añadió: el catálogo y los servicios como **páginas propias** (`/catalogo`, `/servicios`), un **carrito real** con página `/carrito` y **checkout a WhatsApp**, y un **reestilizado del CSS**, que dejó de ser *verbatim*. Como consecuencia, **D3 fue revertida** (§3, D3-bis), **S4 quedó obsoleto** (§2) y la **paridad pixel-perfect con el original dejó de ser el objetivo** (§8.2). Las desviaciones vigentes están en **§11**. Este documento conserva íntegro el plan original y su historial: lo que se planeó, lo que se ejecutó y lo que cambió después.

---

## ⚠️ Hallazgo previo: el "hueco" de `o`/`d`/`f` NO existe

El brief dice que los 3 productos con foto carecen de `o`, `d`, `f`. Es un **artefacto del preview truncado a 2000 caracteres**, no la realidad del archivo.

**Prueba:** el alfabeto base64 (`A–Z a–z 0–9 + / =`) no contiene `,`, `'`, `[` ni `}`. Por tanto cualquier coincidencia de esos caracteres dentro de una línea debe estar en el literal JS, nunca dentro del payload base64. Los greps sobre el archivo real devuelven:

| Patrón | Líneas que coinciden |
|---|---|
| `,o:\[` | 213, 214, 215, 216, 217, 218 |
| `,o:\['[^']+'` (array **no vacío**) | 213, 214, 215, 216, 217, 218 |
| `,d:'` | 213, 214, 215, 216, 217, 218 |
| `,f:\[` | 213, 214, 215, 216, 217, 218 |

**Conclusión:** los 6 productos tienen `options` (no vacías), `description` y `features`. El demo **no está roto**, no hay campos `undefined` renderizados, y `x.o.map()` nunca lanza `TypeError`. **No hay que inventar copy ni rellenar defaults.**

**Consecuencia crítica para la ejecución:** las líneas 213–215 miden miles de caracteres y cualquier agente que las lea con `read` verá el mismo truncamiento y puede (a) transcribir mal o (b) "reparar" datos que no están rotos. Por eso el plan **no permite transcripción manual**: los datos y las imágenes se extraen con un script programático (TASK-002), que además valida completitud y falla ruidosamente.

---

# PLAN DE EJECUCIÓN — JustPlay Store (Next.js App Router)

## 1. Qué entendí

Migrar la landing de e-commerce "JustPlay Store" (HTML/CSS/JS vanilla, tema oscuro `#ff7a00`) a **Next.js 15 App Router + React 19 + TypeScript**, sin backend, sin BD, sin APIs externas. Fidelidad visual 100% (CSS verbatim), detalle de producto como ruta real `/producto/[id]`, secciones como anclas en la home, imágenes base64 extraídas a `public/images/` servidas con `next/image`, iconos SVG inline convertidos a componentes React.

**Tipo de trabajo:** migración/port completo (no refactor incremental). **Complejidad:** media-alta — 12-13 tareas atómicas.

> **Estado actual (2026-10-25).** Este párrafo describe el alcance **original** del plan. La ampliación posterior (páginas propias, carrito real, checkout a WhatsApp y reestilizado del CSS) está en §11, y las decisiones que cambiaron están señaladas en su punto (§2 S4, §3 D3/D3-bis, §8.2, §10).

## 2. Supuestos del plan

Los supuestos se validaron durante la ejecución (2026-10-25): S1, S2, S3, S5 y S6 se cumplen tal como estaban escritos. **S4 quedó obsoleto** al ampliarse el alcance: el carrito dejó de ser un contador y pasó a ser una funcionalidad real con persistencia. Ver la nota de alcance al final de `10` y §11.

- S1 — `npm install` tiene acceso al registro (riesgo de entorno: ver `7`). Si no hay red, la tarea 001 se bloquea.
- S2 — Next.js 15.x + React 19, scaffold **escrito a mano** (no `create-next-app`, que es interactivo).
- S3 — Se conservan los `id` del DOM original (`#home`, `#detail`, `#top`, `#catalogo`, `#servicios`, `#contacto`, `#sq`, `#cats`, `#grid`, `#rel`, `#bc`, `#dimg`, `#di`, `#cnt`, `#toast`, `#opts`) porque el CSS global los referencia.
- S4 — El carrito sigue siendo **solo un contador** (sin lista, sin página de carrito), igual que el original. **→ OBSOLETO (2026-10-25):** el carrito pasó a ser una funcionalidad real (lista de líneas, página `/carrito`, checkout a WhatsApp y persistencia en `localStorage`). Ver §3 (D3-bis) y §11.
- S5 — Se conservan los estilos inline del original (`fontSize`, `marginTop`, `paddingTop`) tal cual, para no perder fidelidad.
- S6 — La vista detalle es su propia ruta ⇒ el footer, bottom-nav y toast (que en el original vivían fuera de `#home`/`#detail`) pasan al layout raíz y se muestran en ambas rutas.

## 3. Decisiones (aprobadas y ejecutadas el 2026-10-25)

| # | Decisión | Justificación |
|---|---|---|
| D1 | **Datos de producto: campos obligatorios, no opcionales** (`options: string[]`, `description: string`, `features: string[]`), con invariantes validadas por el script (`≥1` cada uno) | Ya no hay hueco (`prólogo`). Elimina condicionales en JSX y hace que un dato faltante rompa el build en vez de renderizar `undefined`. |
| D2 | **Carrito: React Context** (`CartProvider` + `useCart`) | Un solo valor compartido entre header (layout raíz) y páginas. Ver evaluación completa en `5`. |
| D3 | **Carrito: SIN persistencia en `localStorage`** — *decisión original del 2026-10-25; revertida ese mismo día, ver D3-bis* | El original no persiste; además evita *hydration mismatch* (el servidor renderiza `0`). El estado sobrevive a la navegación client-side del App Router. Si se quiere persistir, es una tarea aparte con lectura en `useEffect`, nunca en el render. |
| **D3-bis** | **Carrito: persistencia en `localStorage`** (clave `justplay.cart.v1`), con la **variante como parte de la identidad de la línea** (`lineId = producto::variante`, con la variante **normalizada** —recortada y en minúsculas— como clave; el texto que se guarda y se muestra conserva la capitalización del catálogo) | **Por qué cambió:** el carrito dejó de ser un contador y pasó a ser una **página real** (`/carrito`) con checkout a WhatsApp. Sin persistencia, un `F5` o un cambio de pestaña vaciaba el pedido ya armado, que es justo el caso de uso que el checkout resuelve. **Cómo se resolvió el *hydration mismatch* que D3 evitaba:** la lectura se hace **en `useEffect`**, nunca en el render, y la escritura **solo después de hidratar** (dos guardas: `hydratedRef` + comparación con el estado inicial, porque `reactStrictMode` doble-invoca los efectos en desarrollo). El servidor sigue renderizando un carrito vacío (`items = []`). **Qué se guarda:** solo `{ productId, quantity, option }`; el producto se resuelve contra un **catálogo reducido** (`id`, `name`, `category`, `price`, `media`) que el layout *server* pasa como prop, de modo que el manifest completo nunca llega al bundle del cliente. **Datos corruptos:** un `localStorage` manipulado no rompe nada — cada línea se valida (`sanitizeLine`) y se descarta si no es válida o si su `productId` ya no existe en el catálogo. Ver §5.2, `lib/cart.ts` y `components/CartProvider.tsx`. |
| D4 | **Iconos SVG → componentes React tipados** (no `dangerouslySetInnerHTML`) | Sin `dangerouslySetInnerHTML` (superficie XSS innecesaria), tipado, tree-shakeable, props `className`/`size`. El CSS global (`width:34%`, `26px`) sobrescribe los atributos de presentación del SVG, por lo que el tamaño visual no se altera. |
| D5 | **Rutas**: `/` (home con anclas `#top`, `#catalogo`, `#servicios`, `#contacto`) y `/producto/[id]` (6 slugs estables) | Requisito del brief. `useSearchParams`/hash no se usan. **ACTUALIZACIÓN (2026-10-25):** el catálogo y los servicios dejaron de ser anclas de la home y pasaron a ser **páginas propias** (`/catalogo`, `/servicios`); se añadieron `/carrito` y el nav usa enlaces de ruta, no de fragmento. El único fragmento que queda en el sitio es `/#contacto` (footer). Ver §6 y §11-g/h. |
| D6 | **CSS verbatim** salvo **3 líneas documentadas** (`#detail{display:none}`, `body.det #home{display:none}`, `body.det #detail{display:block}` → se eliminan) | Con la vista detalle como ruta propia, esas reglas quedan muertas y `#detail{display:none}` ocultaría la página. Es la única desviación del CSS, y es explícita. **ACTUALIZACIÓN (2026-10-25):** ya **no** es la única desviación del CSS: el CSS fue reestilizado por decisión del usuario (§11-a) y hoy el bloque heredado difiere del original en ~30 selectores. Las 3 líneas siguen eliminadas, pero el "verbatim" completo ya no aplica. |
| D7 | **La card completa es un `<div role="link" tabIndex={0}>`** con `onClick`/`onKeyDown`, y el botón "Agregar" hace `stopPropagation()` | El original usa `<div data-open>` conteniendo un `<button>`. Envolver el botón dentro de un `<Link>` genera HTML inválido (interactivo anidado). Esta forma conserva el área clicable total **y** mejora la accesibilidad por teclado. |

## 4. Estructura de carpetas propuesta

> **Estado actual (2026-10-25).** El árbol de abajo es el **real** tras la ampliación (Fases A–F), no el original. Los cambios respecto del plan original están marcados con `+`; los archivos que el plan preveía y que ya no existen están anotados en la nota al pie.

```
/home/alvarovargas/Desktop/JustPlayStore/
├── app/
│   ├── globals.css                    # 237 líneas: bloque heredado (1-151) + bloque nuevo (152-237)
│   ├── layout.tsx                     # <html lang="es">, viewport-fit=cover, CartProvider, Header, BottomNav, Footer, Toast
│   ├── page.tsx                       # <main id="home"> — hero + "por qué" + contacto (3 secciones)
│   ├── catalogo/
│   │   └── page.tsx                   # + <section id="catalogo"> — server component; resuelve el catálogo
│   ├── servicios/
│   │   └── page.tsx                   # + <main> — server component; servicios + "por qué"
│   ├── carrito/
│   │   └── page.tsx                   # + <main> — server component; monta <CartPage/> (client)
│   └── producto/
│       └── [id]/
│           └── page.tsx               # <main id="detail"> — server component + generateStaticParams
├── components/
│   ├── CartProvider.tsx               # 'use client' — context del carrito + estado del toast + persistencia
│   ├── CartPage.tsx                   # + 'use client' — líneas, total, checkout a WhatsApp
│   ├── HashScroller.tsx               # 'use client' — scroll a #ancla tras navegación
│   ├── Header.tsx                     # 'use client' — usa useCart; nav de 3 enlaces
│   ├── BottomNav.tsx                  # 'use client' — 4 items + estado activo por ruta
│   ├── Footer.tsx                     # server — copyright, handle y enlace "Contacto" → /#contacto
│   ├── Toast.tsx                      # 'use client' — mensaje + enlace "Ver carrito"
│   ├── Hero.tsx                       # server
│   ├── CatalogBrowser.tsx             # + 'use client' — búsqueda + chips + grid (sustituye a CatalogSection)
│   ├── ProductCard.tsx                # 'use client' — click card + botón Agregar
│   ├── ServicesSection.tsx            # server
│   ├── WhySection.tsx                 # server
│   ├── ContactSection.tsx             # server
│   ├── ProductDetail.tsx              # 'use client' — opciones, qty, WhatsApp, agregar
│   ├── RelatedProducts.tsx            # server
│   └── icons/
│       └── index.tsx                 # IconHead/IconDisc/IconPad/IconGrid/IconConsole/IconWrench/IconCart/IconSearch/IconHome/IconCatalog/IconServices/IconContact
├── lib/
│   ├── types.ts                       # Product, Category, ProductMedia, IconName, CATEGORIES
│   ├── products.ts                    # catálogo tipado + helpers (getProduct, getAllProducts, getRelated, getCartCatalog)
│   └── cart.ts                        # + CartProduct, CartLine, CART_STORAGE_KEY, lineIdOf, sanitizeLine, toCartProduct
├── public/images/
│   ├── logo.jpg  hero.jpg  servicios.jpg
│   ├── ps5-slim.jpg  control-dualsense-ps5.jpg  mantenimiento-ps5.jpg
│   └── manifest.json                  # inventario de imágenes + datos de los 6 productos
├── scripts/
│   ├── extract-from-demo.mjs          # decodifica base64 + extrae el array P (sin transcripción manual)
│   └── check-icons.mjs                # verifica que los SVG de components/icons sean idénticos a los del original
├── next.config.ts  package.json  tsconfig.json  eslint.config.mjs  .gitignore  README.md  PLAN.md
└── "JustPlay Store – Demo.html"       # se conserva como referencia (no se borra)
```

> **Nota.** `components/CatalogSection.tsx` (el bloque de catálogo del plan original) no existe: su contenido vive en `components/CatalogBrowser.tsx`, que devuelve un **fragmento** porque el `<section id="catalogo">` pasó a ser de la página `/catalogo` (para que el `id` exista una sola vez en el DOM). `README.md` es la guía de arranque; `PLAN.md` es el registro del plan.

## 5. Modelo de datos y estrategia de estado

### 5.1 Modelo TypeScript (`lib/types.ts` + `lib/products.ts`)

```ts
export const CATEGORIES = [
  'Todo','Consolas','Juegos','Accesorios','Audífonos','Servicio técnico',
] as const;
export type Category = (typeof CATEGORIES)[number];
export type ProductCategory = Exclude<Category, 'Todo'>;
export type IconName = 'head' | 'disc' | 'pad';

export type ProductMedia =
  | { kind: 'photo'; src: string; width: number; height: number }
  | { kind: 'icon';  icon: IconName };

export interface Product {
  id: string;            // slug estable → /producto/[id]
  legacyIndex: number;   // 0..5 — equivalencia con los hashes #p0..#p5 del demo
  name: string;
  category: ProductCategory;
  price: number;         // USD entero
  media: ProductMedia;   // 'photo' (3 productos) | 'icon' (3 productos)
  options: string[];     // ≥ 1 — obligatorio
  description: string;   // no vacío — obligatorio
  features: string[];    // ≥ 1 — obligatorio
}
```

**Mapa `legacyIndex` → `id` → ruta** (el id nuevo es slug; el legacyIndex conserva la trazabilidad con `#p0..#p5`):

| legacy | id / ruta | Nombre | Categoría | Precio | Media |
|---|---|---|---|---|---|
| p0 | `/producto/ps5-slim` | Consola PlayStation 5 Slim | Consolas | $520 | photo |
| p1 | `/producto/control-dualsense-ps5` | Control DualSense PS5 | Accesorios | $75 | photo |
| p2 | `/producto/mantenimiento-ps5` | Mantenimiento especial PS5 | Servicio técnico | $35 | photo |
| p3 | `/producto/audifonos-gamer-71` | Audífonos gamer 7.1 | Audífonos | $48 | icon `head` |
| p4 | `/producto/juego-fisico-ps5` | Juego físico PS5 | Juegos | $60 | icon `disc` |
| p5 | `/producto/control-ps4-dualshock-4` | Control PS4 DualShock 4 | Accesorios | $42 | icon `pad` |

> El botón **"Ver detalle"** de la sección Servicios (original `href="#p2"`) pasa a `href="/producto/mantenimiento-ps5"`.

**Contenido de `options`/`description`/`features`:** NO se transcribe a mano. El script de TASK-002 lo emite desde el HTML (ver abajo). Invariante verificada por el script: los 6 productos tienen `options.length ≥ 1`, `description.length > 0`, `features.length ≥ 1`.

### 5.2 Estrategia de estado del carrito — evaluación y recomendación

| Opción | Veredicto | Motivo |
|---|---|---|
| **React Context + `useReducer`** | ✅ **Recomendada** | El contador lo lee el header (layout raíz) y lo mutan la card (home) y el detalle (página). Context resuelve el caso con ~40 líneas, 0 dependencias, tipado estricto y sin props drilling a través de server components. Con un solo valor y 2 consumidores no hay problema de re-render. |
| **Zustand** | ❌ Descartada | Añade una dependencia externa a un proyecto cuyo objetivo es "demo local sin backend". Para 1 contador es sobre-ingeniería. |
| **Prop drilling** | ❌ Descartada | El header vive en `app/layout.tsx` y el incrementador en `app/page.tsx` / `app/producto/[id]/page.tsx`. El estado de cliente no puede atravesar server components como props ⇒ obligaría a convertir las páginas en client components y perder el benefit de RSC. |
| *Store externo + `useSyncExternalStore`* | ⚠️ Alternativa considerada | Sin dependencia y con re-renders más finos, pero añade complejidad (suscripción, snapshot) desproporcionada para un contador. Se reservaba para el caso "el carrito crece a lista/persistencia": **ese caso se dio** (Fases C–F) y la decisión fue **mantener el Context** de React, que resultó suficiente. |

**Contrato del contexto (estado actual, tras D3-bis):**

```ts
type CartContextValue = {
  count: number;                                              // unidades agregadas
  items: CartItem[];                                           // líneas del carrito
  total: number;                                               // Σ price × quantity
  add: (product: Product, quantity?: number, option?: string) => void;
  remove: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;  // quantity ≤ 0 elimina la línea
  clear: () => void;
};

type CartItem = {
  lineId: string;      // `producto::variante` (identidad de la línea)
  product: CartProduct; // forma reducida: id, name, category, price, media
  quantity: number;
  option?: string;
};
```

> El contrato **original** del plan era `{ count: number; add: (n: number) => void }` (solo un contador). Sigue siendo válido como histórico, pero ya no describe el comportamiento vigente.

El **toast vive dentro del provider** (`visible` + `timerRef`), de modo que la card y el detalle disparan el mismo origen y hay un único `setTimeout` (se limpia el anterior y en `useEffect` cleanup al desmontar). `<Toast/>` se monta en el layout raíz.

**Mapa de estado completo:**

| Estado original | Destino | Notas |
|---|---|---|
| `cart` | `CartProvider` (context) | `items` (líneas), `count` (unidades) y `total` (`Σ price × quantity`). **Persistencia en `localStorage`** (clave `justplay.cart.v1`), lectura en `useEffect` y escritura solo tras hidratar (D3-bis). Cada línea es **producto + variante** (`lineId = id::variante`), así que el mismo producto con dos variantes son dos líneas. El producto se resuelve contra un **catálogo reducido** que el layout *server* pasa como prop (`getCartCatalog()`); el manifest completo no llega al bundle del cliente. |
| `cur` | `useState` en `CatalogBrowser` | categoría activa; no se persiste al navegar |
| texto de `#sq` | `useState` en `CatalogBrowser` | filtro por nombre, case-insensitive |
| `sel` | `useState` en `ProductDetail` | índice de opción; reinicia a 0 al cambiar de producto (equivalente a `sel=k` en `show()`) |
| `qty` | `useState` en `ProductDetail` | reinicia a 1 al cambiar de producto |
| `location.hash` / `body.det` | **eliminado** | sustituido por el App Router + `HashScroller` |

## 6. Mapa de equivalencia HTML original → TSX destino

> **Estado actual (2026-10-25).** El catálogo y los servicios ya **no son secciones de la home**: son **páginas propias** (`/catalogo`, `/servicios`). La navegación cambió en consecuencia: el nav superior tiene **3 enlaces** (ya no 4) y el bottom-nav tiene **4 items**; "Contacto" salió de la navegación y queda accesible desde el **footer** (`/#contacto`), que es el único fragmento que queda en el sitio. Las filas marcadas con `+` no existían en el original.

| Selector / elemento original | Componente destino | Archivo | Nota de paridad |
|---|---|---|---|
| `html`, `body`, `:root` | `<html lang="es">`, `<body>` | `app/layout.tsx` | `viewport-fit=cover` **obligatorio** (safe-area) |
| `a`, `button`, `img` | `<Link>`→`<a>`, `<button>`, `<Image>`→`<img>` | global | `img{max-width:100%;display:block}` sigue aplicando |
| `.w` | `<div className="w">` | cada sección | wrapper de contenido |
| `header` | `<header>` | `components/Header.tsx` | **debe ser `<header>`** (regla por elemento, sticky) |
| `.hd` | `<div className="w hd">` | `Header.tsx` | |
| `.logo`, `.logo img`, `.logo span` | `<a className="logo">` + `<Image>` + `<span>` | `Header.tsx` | logo = `/images/logo.jpg`, 38×38 |
| `nav`, `nav a` | `<nav>` + **3** `<Link>` | `Header.tsx` | `href` → `/`, `/catalogo`, `/servicios`. **"Contacto" salió del nav** por decisión de diseño (ver §11 y `components/Header.tsx`) |
| `.hr` | `<div className="hr">` | `Header.tsx` | |
| `.ib`, `.ct`, `#cnt` | `<Link className="ib" href="/carrito">` + `<div className="ct" id="cnt">{count}</div>` | `Header.tsx` | `.ib` era un `div` estático en el original; al existir `/carrito` pasó a ser un enlace. `#cnt` refleja `useCart().count` |
| `.btn`, `.btn.l`, `.btn.g` | `<a className="btn">` / `"btn l"` / `"btn g"` | varios | `.btn.g` = botón verde de Contacto |
| `.hero`, `.hg` | `<div className="hero" id="top">` + `<div className="w hg">` | `components/Hero.tsx` | `#top` = destino de "Inicio" |
| `.eyebrow` | `<div className="eyebrow">` | `Hero.tsx` | |
| `.stats`, `.cta` | `<div className="stats">`, `<div className="cta">` | `Hero.tsx` | los CTA apuntan a `/catalogo` y `/servicios` |
| `.hi`, `.hi img` | `<div className="hi">` + `<Image>` | `Hero.tsx` | `aspect-ratio:4/5` + `max-height:480px` (ver R4) |
| `section` | `<section>` en cada bloque | — | regla por elemento: `section{padding:64px 0}` |
| `.srch`, `.srch input`, `.srch svg`, `#sq` | `<div className="srch">` + `<input id="sq" type="search">` + `IconSearch` | `components/CatalogBrowser.tsx` | **antes** de `.sh` en el DOM |
| `.sh`, `.sh h2`, `.sh p` | `<div className="sh">` | `CatalogBrowser.tsx` | `#catalogo .sh{flex-direction:column}` requiere `id="catalogo"` |
| `#catalogo` | `<section id="catalogo">` | **`app/catalogo/page.tsx`** | **página propia**: el `id` vive en la página, no en el componente |
| `.cats`, `#cats` | `<div className="cats" id="cats">` | `CatalogBrowser.tsx` | scroll horizontal (`overflow-x:auto`) |
| `.cat`, `.cat.on`, `.cat i`, `.cat i svg` | `<button className={"cat"+(on?" on":"")}><i><Icon/></i>{label}</button>` | `CatalogBrowser.tsx` + `icons` | orden fijo: Todo, Consolas, Juegos, Accesorios, Audífonos, Servicio técnico |
| `.grid`, `#grid`, `#rel` | `<div className="grid" id="grid">` / `id="rel"` | `CatalogBrowser.tsx` / `RelatedProducts.tsx` | `#rel` lleva `style={{marginBottom:56}}` |
| `.card` | `<div className="card" role="link" tabIndex={0}>` | `components/ProductCard.tsx` | ver D7 |
| `.im`, `.im img`, `.im svg` | `<div className="im">` + `<Image>` o `<Icon*>` | `ProductCard.tsx` | `aspect-ratio:1` |
| `.cb`, `.cb small`, `.cb h3` | `<div className="cb"><small>{c}</small><h3>{n}</h3>` | `ProductCard.tsx` | |
| `.stars`, `.stars span` | `<div className="stars">★★★★★<span>5.0</span></div>` | `ProductCard.tsx` | **las estrellas SÍ están en la card del original** |
| `.cr`, `.pr`, `.add` | `<div className="cr"><span className="pr">${p}</span><button className="add">Agregar</button></div>` | `ProductCard.tsx` | `.add` → `stopPropagation()` |
| `.svc`, `.sg`, `.sg img`, `.ck`, `.ck li` | `<section className="svc" id="servicios">` + `<div className="w sg">` + `<ul className="ck">` | `components/ServicesSection.tsx` | 8 ítems de checklist; la imagen lleva `style={{height:'auto'}}` (§11-c) |
| `.why` | `<div className="w why">` con 3 `<div>` | `components/WhySection.tsx` | `<section>` sin id |
| `.ct2`, `.box`, `.box h3/p/b` | `<section id="contacto" style={{paddingTop:0}}>` + `<div className="w ct2">` + 2 `.box` | `components/ContactSection.tsx` | |
| `footer`, `.ft` | `<footer><div className="w ft">` | `components/Footer.tsx` | va en el layout raíz (visible en todas las rutas) |
| + enlace "Contacto" del pie | `<Link href="/#contacto">Contacto</Link>` | `Footer.tsx` | **único fragmento que queda en el sitio**; el desplazamiento lo resuelve `HashScroller` |
| `.bn`, `.bn a`, `.bn svg` | `<div className="bn">` con **4** `<Link>` | `components/BottomNav.tsx` | Inicio, Catálogo, Servicios, **Carrito**; visible <700px |
| + `.bn a.on` | `className={isActive ? 'on' : undefined}` | `BottomNav.tsx` | **estado activo real** por ruta (`usePathname`), con `aria-current="page"`; anula el `:first-child` heredado (§11-d) |
| `.toast`, `.toast.s`, `#toast` | `<div className="toast s" id="toast">Agregado al carrito · <Link href="/carrito">Ver carrito</Link></div>` | `components/Toast.tsx` | layout raíz; la clase `s` sigue siendo el único mecanismo de visibilidad; el enlace hace que el DOM **ya no sea idéntico** al del original (§11-e) |
| `#home` | `<main id="home">` | `app/page.tsx` | se conserva el id; la home tiene **3** secciones (hero, "por qué", contacto) |
| + `/catalogo` | `<main><section id="catalogo">` | `app/catalogo/page.tsx` | **página propia** (server component); resuelve el catálogo en el servidor |
| + `/servicios` | `<main>` + `<ServicesSection/>` + `<WhySection/>` | `app/servicios/page.tsx` | **página propia** (server component) |
| + `/carrito` | `<main><section aria-labelledby="cartpage-title">` | `app/carrito/page.tsx` | **página propia** (server component); monta `<CartPage/>` (client) |
| + `.cartlist`, `.cartrow*` | `<div className="cartlist">` + `<article className="cartrow">` | `components/CartPage.tsx` | una fila por línea: imagen, datos, variante, cantidad y eliminar |
| + `.cartempty` | `<div className="cartempty">` | `CartPage.tsx` | estados "carrito vacío" y "pedido enviado" |
| + `.checkout`, `.field` | `<form className="checkout">` + `<div className="field">` | `CartPage.tsx` | Nombre y Teléfono requeridos; Dirección y Notas opcionales |
| + `.formerror` | `<p className="formerror" role="alert">` | `CartPage.tsx` | error contextual; el foco va al primer campo inválido |
| `#detail` | `<main id="detail">` | `app/producto/[id]/page.tsx` | **se elimina la regla CSS `#detail{display:none}`** (D6) |
| `body.det` | — | — | **eliminado**: la clase nunca se añade |
| `.crumb`, `#bc` | `<div className="crumb"><Link href="/">Inicio</Link> / <span id="bc">{name}</span></div>` | `components/ProductDetail.tsx` | |
| `.dg` | `<div className="dg">` | `ProductDetail.tsx` | |
| `.dimg`, `.dimg img`, `.dimg svg` | `<div className="dimg" id="dimg">` | `ProductDetail.tsx` | `aspect-ratio:1` |
| `.di`, `.di small/h1/h4/p` | `<div className="di" id="di">` | `ProductDetail.tsx` | `small` = categoría, `h1` = nombre |
| `.big`, `.big span` | `<div className="big">${precio}<span>Precio referencial</span></div>` | `ProductDetail.tsx` | |
| `.pbox`, `.pbox .buy`, `.pbox h4` | `<div className="pbox">` | `ProductDetail.tsx` | |
| `.opts`, `#opts`, `.opt`, `.opt.on` | `<div className="opts" id="opts">` + `<button className={"opt"+(i===sel?" on":"")}>` | `ProductDetail.tsx` | primera opción activa por defecto |
| `.buy`, `.qty`, `.qty button`, `.qty span` | `<div className="buy"><div className="qty"><button>−</button><span>{qty}</span><button>+</button></div>…` | `ProductDetail.tsx` | `#m`/`#pl`/`#q` → refs/estado |
| `#addc` | `<button className="btn" id="addc">Agregar al carrito</button>` | `ProductDetail.tsx` | `add(product, qty, opción)` + toast |
| `#wa` | `<a className="btn g" id="wa" href={waUrl} target="_blank" rel="noopener">` | `ProductDetail.tsx` | URL exacta ver `9`. |
| `.fl`, `.fl li` | `<ul className="fl">` | `ProductDetail.tsx` | check `✓` vía CSS `:before` |
| `.bar` | — | — | clase sin uso en el original ⇒ no portar |

## 7. Tareas atómicas de ejecución

### TASK-001 — Bootstrap del proyecto Next.js + CSS global verbatim
- **Agente:** `coding-agent` · **Tipo:** implement · **Depende de:** —
- **Objetivo:** proyecto Next.js 15 App Router funcional, con el CSS del `<style>` original copiado íntegro a `app/globals.css`.
- **Archivos:** `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.gitignore`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx` (stub temporal).
- **EARS:**
  - EL SISTEMA DEBE compilar con `npm run build` sin errores ni warnings de tipo.
  - EL SISTEMA DEBE servir la home en `http://localhost:3000/` con el fondo degradado y el header pegajoso.
  - `app/globals.css` DEBE contener las 135 líneas de CSS del `<style>` original (líneas 8–142 del HTML) **verbatim**, salvo las 3 reglas listadas en D6, y DEBE incluir un comentario que documente la eliminación.
  - `app/layout.tsx` DEBE declarar `<html lang="es">`, `<body>`, `export const viewport` con `viewportFit: 'cover'`, `initialScale: 1`, `width: 'device-width'`, y `export const metadata` con `title: 'JustPlay Store – Demo'`.
  - EL SISTEMA DEBE mantener `<header>`, `<nav>`, `<section>` y `<footer>` como elementos semánticos (el CSS los estiliza por etiqueta).
- **Criterio de aceptación:** `npm run build` exit 0; `diff` entre el `<style>` original y `app/globals.css` muestra **solo** las 3 líneas de D6; la home renderiza el fondo con `radial-gradient` y `background-attachment: fixed`.
- **Critic:** no · **Docs:** no · **Riesgo:** `viewport-fit=cover` omitido rompe `env(safe-area-inset-*)` ⇒ paridad móvil perdida.

### TASK-002 — Script de extracción programática (imágenes + datos)
- **Agente:** `coding-agent` · **Tipo:** implement · **Depende de:** TASK-001
- **Objetivo:** convertir el HTML monolítico en datos y binarios verificados, **sin transcripción manual de las líneas truncadas**.
- **Archivos:** `scripts/extract-from-demo.mjs`, `public/images/*.jpg` (6), `public/images/manifest.json`.
- **EARS:**
  - EL SISTEMA DEBE extraer los 6 data URI JPEG del HTML y escribir archivos `.jpg` válidos en `public/images/`.
  - EL SISTEMA DEBE extraer el array `P` del HTML y emitir, por producto, `n`, `c`, `p`, `options`, `description`, `features`, y el nombre lógico de la imagen o el `ic` correspondiente, **sin intervención manual**.
  - EL SISTEMA DEBE fallar con código de salida ≠ 0 si algún producto carece de `options` no vacío, `description` no vacía o `features` no vacía.
  - EL SISTEMA DEBE reportar por cada imagen: ruta, bytes, sha256, dimensiones en píxeles y si es duplicado exacto de otra.
  - EL SISTEMA DEBE ser idempotente: reejecutarlo produce el mismo resultado sin duplicar archivos.
- **Criterio de aceptación:** `node scripts/extract-from-demo.mjs` → exit 0, 6 `.jpg` con magic bytes `FFD8FF`, `manifest.json` con hash y dimensiones; el manifiesto lista los 6 productos con sus `o`/`d`/`f` extraídos (verificables contra el HTML).
- **Critic:** no · **Docs:** no
- **Riesgo:** **el riesgo #1 del proyecto.** Los payloads de las líneas 213–215 superan 2000 caracteres; cualquier lectura por vista previa trunca. Si un agente transcribe a mano, inventa datos o pierde opciones. Prohibido `read`+copiar para `o`/`d`/`f`.

### TASK-003 — Modelo de datos TypeScript y catálogo
- **Agente:** `coding-agent` · **Tipo:** implement · **Depende de:** TASK-002
- **Objetivo:** `lib/types.ts` + `lib/products.ts` con los 6 productos, ids estables y helpers.
- **EARS:**
  - EL SISTEMA DEBE tipar `Product` con `id`, `legacyIndex`, `name`, `category`, `price`, `media`, `options`, `description`, `features`, todos **obligatorios**.
  - EL SISTEMA DEBE exponer `CATEGORIES` en el orden exacto: `Todo, Consolas, Juegos, Accesorios, Audífonos, Servicio técnico`.
  - EL SISTEMA DEBE exponer `getProduct(id)`, `getRelated(id, limit=4)` (orden de catálogo, excluyendo el propio) y `getAllProducts()`.
  - EL SISTEMA DEBE mapear cada producto a su slug de ruta y a su `legacyIndex` 0..5 según la tabla de `5.1`.
  - EL SISTEMA DEBE mantener nombre, categoría y precio idénticos a los del HTML original.
- **Criterio de aceptación:** `npx tsc --noEmit` exit 0; un script de comprobación imprime 6 productos, cada uno con `options.length ≥ 1`, `description.length > 0`, `features.length ≥ 1`, y `getRelated` devuelve 4 elementos en orden de catálogo.
- **Critic:** no · **Docs:** no
- **Riesgo:** si el agente vuelve a leer el HTML con `read`, reintroduce el error del brief — debe consumir `manifest.json` de TASK-002.

### TASK-004 — Set de iconos SVG como componentes React
- **Agente:** `coding-interface-agent` · **Tipo:** ui · **Depende de:** TASK-003
- **Objetivo:** portar los sets `IC` (head/disc/pad) y `CI` (grid/console/disc/pad/head/wrench) + iconos de UI a `components/icons/index.tsx`.
- **EARS:**
  - EL SISTEMA DEBE exportar un componente por icono, preservando **exactamente** los `path`/`rect`/`circle` y el `stroke-width` del original (`1.4` para el set `IC`/`CI`, `2` para los iconos de UI).
  - CADA componente DEBE aceptar `className` y `size` (por defecto 24) y DEBE heredar `stroke="currentColor"` y `fill="none"`.
  - EL SISTEMA DEBE NOT use `dangerouslySetInnerHTML` en ningún punto.
  - EL SISTEMA DEBE exponer un mapa `CATEGORY_ICONS` que resuelva cada categoría a su icono (`Juegos→disc`, `Accesorios→pad`, `Audífonos→head`).
- **Criterio de aceptación:** render de cada icono coincide visualmente con el original; `.im svg` queda al 34% y `.cat i svg` a 26px (el CSS global sobrescribe los atributos de presentación).
- **Critic:** no · **Docs:** no

### TASK-005 — `CartProvider` (context) + `Toast`
- **Agente:** `coding-agent` · **Tipo:** implement · **Depende de:** TASK-003
- **Objetivo:** estado compartido del carrito y toast con un único origen.
- **Archivos:** `components/CartProvider.tsx`, `components/Toast.tsx`.
- **EARS:**
  - EL SISTEMA DEBE exponer `useCart()` con `{ count, add(n) }` desde un Context montado en el layout raíz.
  - CUANDO se llame `add(n)` ENTONCES el contador DEBEcrementarse en `n` y el toast DEBE mostrarse con el texto `Agregado al carrito`.
  - EL toast DEBE ocultarse a los 1300 ms, DEBE limpiar cualquier temporizador previo y DEBE limpiar el temporizador al desmontar.
  - EL SISTEMA DEBE NOT persistir el contador en `localStorage` ni en `sessionStorage`.
  - EL SISTEMA DEBE renderizar `<div className="toast s" id="toast">` usando la clase `s` como único mecanismo de visibilidad.
- **Criterio de aceptación:** `add(1)` y `add(3)` actualizan `#cnt`; el toast aparece y desaparece a ~1.3 s; tras un `F5` el contador vuelve a 0 (comportamiento idéntico al original).
- **Critic:** no · **Docs:** no
- **Estado posterior (2026-10-25):** la tarea se ejecutó tal como estaba escrita (contador sin persistencia), pero la ampliación la **superó**: el carrito pasó a ser una funcionalidad real con `items`, `total`, variantes por línea, persistencia en `localStorage` (`justplay.cart.v1`) y checkout a WhatsApp. Ver **D3-bis** (§3) y **§11-f**. El requisito "NO persistir" y el criterio "tras un `F5` el contador vuelve a 0" **ya no aplican**.

### TASK-006 — Layout raíz: header, bottom nav, footer, providers
- **Agente:** `coding-interface-agent` · **Tipo:** ui · **Depende de:** TASK-005
- **Archivos:** `app/layout.tsx`, `components/Header.tsx`, `components/BottomNav.tsx`, `components/Footer.tsx`.
- **EARS:**
  - EL SISTEMA DEBE renderizar `<header>` con logo, `<nav>` de 4 enlaces, botón WhatsApp externo (`target="_blank"`, `rel="noopener"`) y el icono de carrito con el badge `#cnt`.
  - CUANDO el usuario navegue desde `/producto/x` a `/#catalogo` ENTONCES el sistema DEBE navegar a la home y dejar la sección `#catalogo` en el viewport.
  - EL SISTEMA DEBE renderizar `.bn` con 4 enlaces de icono+texto y el footer (`<footer><div className="w ft">`) visible en todas las rutas.
  - EL SISTEMA DEBE montar `<CartProvider>` envolviendo `{children}` y `<Toast/>` en el layout raíz.
- **Criterio de aceptación:** el badge refleja el carrito en `/` y en `/producto/x`; los 4 enlaces del header y del bottom nav llevan a la sección correcta; el botón WhatsApp abre en pestaña nueva.
- **Critic:** sí (revisión de estructura/fidelidad) · **Docs:** no
- **Riesgo:** los enlaces con hash necesitan `HashScroller` (TASK-010) para funcionar de forma fiable al cambiar de ruta; hasta entonces el reviewer debe marcarlo como esperado.
- **Estado posterior (2026-10-25):** ejecutada tal como estaba escrita (nav de 4 enlaces, bottom-nav de 4). La ampliación la **cambió**: el nav tiene **3** enlaces (Inicio, Catálogo, Servicios), el bottom-nav tiene **4** items (Inicio, Catálogo, Servicios, **Carrito**) con **estado activo real** (`.on` + `aria-current="page"`), "Contacto" salió del nav y quedó en el footer (`/#contacto`), y el icono de carrito (`.ib`) pasó a ser enlace a `/carrito`. Ver **§6** y **§11-g**.

### TASK-007 — Secciones de la home: hero, servicios, por qué, contacto
- **Agente:** `coding-interface-agent` · **Tipo:** ui · **Depende de:** TASK-003
- **Archivos:** `components/Hero.tsx`, `components/ServicesSection.tsx`, `components/WhySection.tsx`, `components/ContactSection.tsx`, `app/page.tsx`.
- **EARS:**
  - LA home DEBE renderizar `<main id="home">` conteniendo, en este orden: hero (`#top`), catálogo (`#catalogo`), servicios (`.svc` `#servicios`), "por qué" y contacto (`#contacto`).
  - EL SISTEMA DEBE conservar el copy, el orden de los elementos, los estilos inline y los 8 ítems del checklist de servicios.
  - EL botón "Ver detalle" de servicios DEBE apuntar a `/producto/mantenimiento-ps5`.
  - EL SISTEMA DEBE usar `next/image` para logo, hero e imagen de servicios, con `alt` descriptivo y las dimensiones intrínsecas reportadas por TASK-002.
- **Criterio de aceptación:** paridad visual línea a línea contra el original a 1440px y 375px; `next/image` no altera el `object-fit`/bordes definidos por el CSS.
- **Critic:** no · **Docs:** no
- **Estado posterior (2026-10-25):** ejecutada tal como estaba escrita (la home renderizaba las 4 secciones). La ampliación la **redujo**: el catálogo y los servicios pasaron a ser **páginas propias** (`/catalogo`, `/servicios`) y la home quedó con **hero + "por qué" + contacto**. El copy, el checklist de 8 ítems y las 3 razones no cambian; cambia **dónde** viven. Ver **§6** y **§11-h**.

### TASK-008 — Catálogo: buscador, chips de categoría y grid de cards
- **Agente:** `coding-interface-agent` · **Tipo:** ui · **Depende de:** TASK-004, TASK-005
- **Archivos:** `components/CatalogSection.tsx`, `components/ProductCard.tsx`.
- **EARS:**
  - CUANDO el usuario escriba en `#sq` ENTONCES el grid DEBE mostrar únicamente los productos cuyo `name` contenga el texto, sin distinguir mayúsculas, y DEBE reevaluarse en cada pulsación.
  - CUANDO el usuario pulse un chip de categoría ENTONCES el grid DEBE filtrar por esa categoría, el chip DEBE llevar la clase `on`, y "Todo" DEBE mostrar los 6 productos.
  - CUANDO el usuario haga clic en cualquier zona de la card ENTONCES el sistema DEBE navegar a `/producto/{id}` del producto.
  - CUANDO el usuario pulse el botón "Agregar" de una card ENTONCES el contador DEBE incrementarse en 1, el toast DEBE mostrarse y la navegación a detalle DEBE **no** ocurrir (`stopPropagation`).
  - LA card DEBE renderizar `.im` (foto con `next/image` o icono SVG), `.cb` con `small`=categoría, `h3`=nombre, `.stars` con `★★★★★` + `5.0`, `.cr` con `.pr` y `.add`.
- **Criterio de aceptación:** buscar "ps5" devuelve los productos cuyo nombre lo contenga; el chip "Accesorios" devuelve 2; "Agregar" incrementa el contador sin cambiar de URL; el grid mantiene 4 columnas a 1440px y 2 a 960px.
- **Critic:** no · **Docs:** no
- **Estado posterior (2026-10-25):** ejecutada tal como estaba escrita. La ampliación la **cambió**: `components/CatalogSection.tsx` pasó a ser **`components/CatalogBrowser.tsx`** (devuelve un fragmento, porque el `<section id="catalogo">` es ahora de la página `/catalogo` y el `id` debe existir una sola vez en el DOM). El catálogo se resuelve en el **servidor** (`app/catalogo/page.tsx`) y llega al cliente por prop, de modo que el manifest completo no entra en el bundle (R18).

### TASK-009 — Detle de producto en `/producto/[id]`
- **Agente:** `coding-interface-agent` · **Tipo:** ui · **Depende de:** TASK-003, TASK-004, TASK-005
- **Archivos:** `app/producto/[id]/page.tsx`, `components/ProductDetail.tsx`, `components/RelatedProducts.tsx`.
- **EARS:**
  - SI el `id` de la ruta no corresponde a un producto ENTONCES el sistema DEBE responder 404 (`notFound()`).
  - EL SISTEMA DEBE generar estáticamente las 6 rutas con `generateStaticParams` y `dynamicParams = false`.
  - CUANDO se monte la página ENTONCES la opción seleccionada DEBE ser la primera, la cantidad DEBE ser 1, y la pestaña seleccionada DEBE llevar la clase `on`.
  - CUANDO el usuario cambie la opción o la cantidad ENTONCES el enlace `#wa` DEBE recalcularse con el formato `https://wa.me/584129507176?text=` + `encodeURIComponent('Hola JustPlay, me interesa: {nombre} ({opción}) x{cantidad}')`.
  - CUANDO el usuario pulse "Agregar al carrito" ENTONCES el contador DEBE incrementarse en la cantidad actual y el toast DEBE mostrarse.
  - EL SISTEMA DEBE renderizar el breadcrumb (`Inicio / {nombre}`), `.dimg`, `.di`, `.pbox` con precio y opciones, la lista "Incluye" y un grid `#rel` con 4 productos relacionados en orden de catálogo.
- **Criterio de aceptación:** `/producto/mantenimiento-ps5` renderiza descripción, 2+ opciones y 3 features (contenido real, no `undefined`); `/producto/no-existe` devuelve 404; el `href` de `#wa` decodificado es exactamente `Hola JustPlay, me interesa: Audífonos gamer 7.1 (Negro) x2`; `#rel` muestra 4 cards.
- **Critic:** sí (fidelidad funcional + ruta) · **Docs:** no
- **Riesgo:** formato del texto de WhatsApp — es el único string contractual con el exterior; verificar carácter a carácter contra la línea 229 del original.

### TASK-010 — Sustituir el enrutado por hash: anclas, scroll y ajuste de CSS
- **Agente:** `coding-agent` · **Tipo:** refactor · **Depende de:** TASK-006, TASK-007, TASK-008, TASK-009
- **Archivos:** `components/HashScroller.tsx`, `app/layout.tsx`, `app/globals.css`.
- **EARS:**
  - CUANDO se navegue a `/#<seccion>` ENTONCES el sistema DEBE desplazar la vista hasta el elemento con ese `id` (`scrollIntoView`), respetando `html{scroll-behavior:auto}`.
  - EL SISTEMA DEBE NOT usar `useSearchParams` ni enrutado por hash para el detalle.
  - EL SISTEMA DEBE eliminar de `app/globals.css` las reglas `#detail{display:none}`, `body.det #home{display:none}` y `body.det #detail{display:block}`, y DEBE documentar la eliminación con un comentario.
  - EL SISTEMA DEBE conservar los ids `#home`, `#detail`, `#top`, `#catalogo`, `#servicios`, `#contacto` en el DOM.
- **Criterio de aceptación:** desde `/producto/ps5-slim`, el enlace "Catálogo" del header aterriza en la sección de catálogo; `grep -n "body.det\|#detail{display" app/globals.css` no devuelve nada; el resto del CSS es idéntico al original.
- **Critic:** sí (es la desviación de CSS) · **Docs:** sí (la desviación debe quedar documentada)
- **Riesgo:** `scrollIntoView` en el `useEffect` inicial puede ejecutarse antes de que el DOM esté pintado → usar `useEffect` + `requestAnimationFrame` o un pequeño reintento.

### TASK-011 — Revisión de calidad del critic (código)
- **Agente:** `critic_agent` · **Tipo:** review · **Depende de:** TASK-010
- **Objetivo:** validar fidelidad, estructura y cumplimiento de los requisitos antes de la verificación final.
- **EARS:**
  - EL CRITIC DEBE verificar que el CSS difiere del original **solo** en las 3 líneas autorizadas.
  - EL CRITIC DEBE verificar que los 6 productos exponen `options`/`description`/`features` no vacías y que ningún componente renderiza `undefined`.
  - EL CRITIC DEBE verificar que no se anidan elementos interactivos (botón dentro de enlace) y que las cards son accesibles por teclado.
  - EL CRITIC DEBE verificar que no existen dependencias innecesarias ni llamadas a APIs externas, y que el único enlace externo es WhatsApp.
- **Criterio de aceptación:** informe sin bloqueantes; los bloqueantes se resuelven antes de TASK-012.
- **Critic:** es la tarea · **Docs:** no

### TASK-012 — Verificación final (build, lint, tipos y paridad)
- **Agente:** `coding-agent` · **Tipo:** review · **Depende de:** TASK-011
- **EARS:**
  - `npm run build` DEBE terminar con código 0.
  - `npm run lint` DEBE terminar sin errores.
  - `npx tsc --noEmit` DEBE terminar con código 0.
  - `npm run dev` DEBE levantar la app en `http://localhost:3000`.
  - EL checklist manual de `8` DEBE completarse al 100% con el original abierto en paralelo.
- **Criterio de aceptación:** los 4 comandos en verde + checklist firmado.
- **Critic:** no · **Docs:** no

### TASK-013 — README y mapa de paridad *(ejecutada el 2026-10-25)*
- **Agente:** `documentation_agent` · **Tipo:** docs · **Depende de:** TASK-012
- **EARS:** EL README DEBE documentar `npm install`, `npm run dev`, `npm run build`, `npm run lint`, la estructura de carpetas, el mapa `legacyIndex → ruta`, y la desviación de CSS de 3 líneas.
- **Criterio de aceptación:** README permite clonar y arrancar sin conocimiento previo.
- **Critic:** no · **Docs:** es la tarea · **Estado:** completada (`README.md`)
- **Estado posterior (2026-10-25):** el `README.md` que este TASK dejó registrado **no llegó a existir** en el repositorio. Se ha escrito el 2026-10-25, cubriendo la **versión ampliada**: instalación, scripts, estructura de carpetas, rutas, mapa `legacyIndex → ruta`, el carrito (modelo, persistencia y catálogo reducido), el checkout a WhatsApp con el texto exacto, la extracción de datos e imágenes, las desviaciones (a–f), accesibilidad, verificación y deuda conocida. La desviación de CSS que documenta ya **no es solo de 3 líneas**: es el reestilizado completo (§11-a).

### Resumen de dependencias

```
TASK-001 ─► TASK-002 ─► TASK-003 ─┬─► TASK-004 ─┬─► TASK-008 ─┐
                                  ├─► TASK-005 ─┘              ├─► TASK-010 ─► TASK-011 ─► TASK-012 ─► TASK-013
                                  └─► TASK-006 / TASK-007 / TASK-009 ─┘
```

## 8. Plan de verificación

### 8.1 Comandos

```bash
cd /home/alvarovargas/Desktop/JustPlayStore
npm install                                   # una vez
npm run extract                               # idempotente → 6 .jpg + manifest.json
npm run typecheck                             # 0 errores (tsc --noEmit)
npm run lint                                  # 0 errores (eslint .)
npm run build                                 # exit 0
npm run dev                                   # http://localhost:3000
```

Verificación del CSS **heredado** (bloque de líneas 19–151 de `app/globals.css`):

```bash
sed -n '8,142p' "JustPlay Store – Demo.html" > /tmp/demo-original.css
sed -n '19,151p' app/globals.css > /tmp/globals-legacy.css
diff /tmp/demo-original.css /tmp/globals-legacy.css
```

> **Nota (2026-10-25).** Este `diff` **ya no sale vacío**: el CSS fue reestilizado por decisión del usuario (ver §11-a). Hoy el bloque heredado difiere del `<style>` original en ~30 selectores de nivel superior (≈52 declaraciones), con **3 reglas eliminadas** (D6) y **3 añadidas** (`.card:hover .im img`, `.cat:hover`, `.srch:focus-within`). El criterio de paridad del CSS **ya no es "verbatim"**: es el checklist funcional de §8.2.

### 8.2 Checklist manual de paridad visual

> **Este checklist es HISTÓRICO: describe el criterio de la migración original** (comparar contra el HTML original abierto en paralelo). **La paridad pixel-perfect con el original ya no es el objetivo**: el CSS fue reestilizado por decisión del usuario (§11-a) y las funcionalidades nuevas (carrito real, páginas propias, checkout a WhatsApp) son **deliberadamente distintas** del original. El criterio de verificación vigente es el **checklist funcional** de §8.2.1.

Abrir el HTML original en el navegador y la app dev en paralelo.

- [ ] **1440×900** — fondo con `radial-gradient` punteado + halo naranja; header sticky translúcido; logo 38px con borde redondeado; hero en 2 columnas con `aspect-ratio:4/5` recortado a 480px y glow naranja; 3 stats.
- [ ] **Catálogo** — buscador con icono y borde `#2a2a2a`; título en mayúsculas con `letter-spacing`; 6 chips circulares con icono dentro de círculo naranja; chip activo con fondo naranja; grid de 4 columnas; cards con imagen cuadrada, estrellas, precio naranja y botón "Agregar" con glow.
- [ ] **Estrellas de la card** — en la card del catálogo, `.stars` contiene `★★★★★` (**5 estrellas**, U+2605 ×5) seguido de `<span>5.0</span>`. Es el mismo número de estrellas que el original (línea 223) y el mismo texto; la card no debe llevar "Clientes satisfechos".
- [ ] **Estrellas del detalle** — en el detalle, `.stars` contiene `★★★★★` (**5 estrellas**) seguido de `<span>5.0 · Clientes satisfechos</span>`. La única diferencia con la card es el texto que acompaña a las estrellas, nunca su número.
- [ ] **Servicios** — imagen con borde y `max-width:420px`; checklist de 2 columnas con `✓` naranja.
- [ ] **Por qué / Contacto** — 3 cards; 2 boxes; botón verde WhatsApp.
- [ ] **Footer** — texto e Instagram en dos extremos.
- [ ] **960px** — grid a 2 columnas; `.hg`, `.sg`, `.dg`, `.ct2` a 1 columna; `h1` a 34px; hero `max-height:380px` sin margen izquierdo.
- [ ] **700px / 375px** — `nav` oculta; botón WhatsApp del header oculto; **bottom nav visible** con 4 iconos (el primero en naranja); `body` con `padding-bottom: calc(62px + safe-area)`; grid a 2 columnas con gap 12px; `.ck` a 1 columna; `.w` con padding 16px.
- [ ] **Hover** — card con borde + `box-shadow` naranja; `.add` a fondo naranja; `.btn` con halo.
- [ ] **Toast** — centrado abajo, fondo claro, texto negro, ~1.3 s; en móvil sube a `78px` (por encima de la bottom nav).
- [ ] **Detalle** (`/producto/mantenimiento-ps5`) — breadcrumb naranja; imagen cuadrada con borde naranja; `small` de categoría; `h1` 32px; `★★★★★` + `5.0 · Clientes satisfechos`; `.pbox` con borde naranja y glow; precio 32px + "Precio referencial"; opciones con la primera activa; qty −/n/+; botón naranja "Agregar al carrito"; botón verde "Comprar por WhatsApp"; "Incluye" con `✓`; 4 relacionados.
- [ ] **Funcional** — buscar "ps5" filtra; cada chip filtra; clic en card abre el detalle; "Agregar" NO abre el detalle; el contador sube y el toast aparece; ± cambia la cantidad y actualiza el enlace de WhatsApp; `/producto/no-existe` → 404; los 4 enlaces del header y del bottom nav aterrizan en su sección.
- [ ] **WhatsApp** — `href` decodificado = `Hola JustPlay, me interesa: {nombre} ({opción}) x{cantidad}`.

### 8.2.1 Checklist funcional vigente (2026-10-25)

Este es el **criterio de verificación actual**. No se contrasta contra el HTML original: se contrasta contra el **comportamiento esperado** de la versión ampliada. Los comandos de §8.1 deben estar en verde antes de darlo por bueno.

**Rutas y contenido**

- [ ] `/` responde 200 y renderiza `<main id="home">` con **hero** (`#top`), la sección "por qué" y la sección de contacto (`#contacto`). **No** debe aparecer `id="catalogo"` ni `id="servicios"` en el HTML de la home.
- [ ] `/catalogo` responde 200 y contiene un único `<section id="catalogo">` con buscador (`#sq`), tira de chips (`#cats`) y grid (`#grid`) con **6** productos.
- [ ] `/servicios` responde 200 y contiene `<section class="svc" id="servicios">` con la imagen, el checklist de **8** ítems y las **3** razones ("por qué").
- [ ] `/carrito` responde 200 y renderiza el estado vacío (`.cartempty`) en el HTML del servidor.
- [ ] `/producto/ps5-slim`, `/producto/control-dualsense-ps5`, `/producto/mantenimiento-ps5`, `/producto/audifonos-gamer-71`, `/producto/juego-fisico-ps5` y `/producto/control-ps4-dualshock-4` responden 200.
- [ ] `/producto/no-existe` responde **404** (determinista: `generateStaticParams` + `dynamicParams = false`).

**Navegación**

- [ ] El nav superior tiene **3** enlaces: Inicio (`/`), Catálogo (`/catalogo`), Servicios (`/servicios`). "Contacto" **no** está en el nav.
- [ ] El bottom-nav (móvil) tiene **4** items: Inicio, Catálogo, Servicios, Carrito (`/carrito`).
- [ ] El item activo del bottom-nav lleva **clase `on`** y **`aria-current="page"`** en `/`, `/catalogo`, `/servicios` y `/carrito`; en `/producto/*` no hay ninguno (esa página no está en la barra).
- [ ] El footer incluye el enlace "Contacto" → `/#contacto`, y es el **único fragmento (`#…`) del sitio**: no debe quedar ningún `href="#"` en ninguna ruta.
- [ ] El icono de carrito de la cabecera (`#cnt`) enlaza a `/carrito`.

**Carrito y persistencia**

- [ ] "Agregar" en una card suma **1** unidad y **no** navega al detalle; el toast aparece.
- [ ] "Agregar al carrito" en el detalle suma la cantidad actual **con la variante seleccionada**.
- [ ] El mismo producto con **dos variantes distintas** genera **2 líneas** separadas en `/carrito`; con la misma variante, suma la cantidad en la misma línea.
- [ ] El total de `/carrito` es `Σ precio × cantidad` y coincide con el "Total" del mensaje de WhatsApp.
- [ ] `+` / `−` ajustan la cantidad; `−` en la cantidad 1 deshabilita el botón; "Eliminar" quita la línea; "Vaciar carrito" vacía el carrito.
- [ ] **Persistencia:** tras agregar productos, un **F5** mantiene el carrito. La clave en `localStorage` es `justplay.cart.v1` y el valor solo contiene `{ productId, quantity, option }` (nunca el producto entero).
- [ ] **Hidratación:** el HTML del servidor muestra el carrito **vacío** (`items = []`) aunque `localStorage` tenga contenido, y la consola del navegador **no** reporta *hydration mismatch* ni errores de hidratación.
- [ ] **Datos corruptos:** con un `localStorage` manipulado (JSON inválido, un array con objetos sin `productId`, una cantidad `0` o negativa, un `productId` inexistente) la app **no** se rompe: las líneas inválidas se descartan silenciosamente.

**Checkout a WhatsApp**

- [ ] El botón "Finalizar compra por WhatsApp" está deshabilitado (`aria-disabled="true"`) si falta Nombre o Teléfono; aparece un `.formerror` con `role="alert"` y el **foco va al primer campo inválido**.
- [ ] Con Nombre y Teléfono rellenos, el `href` decodificado es exactamente el texto del pedido (§8.2.2), con la variante entre paréntesis solo si la hay, y con `Dirección:` / `Notas:` solo si no están vacías.
- [ ] Al enviar, se abre el chat de WhatsApp, el carrito **se vacía** y aparece el estado "Pedido enviado".

**Build y consola**

- [ ] `npm run typecheck`, `npm run lint` y `npm run build` terminan con **exit 0**; el build genera las páginas estáticas sin errores de hidratación.
- [ ] La consola del navegador está limpia de errores (salvo los avisos de `next/image` propios del modo desarrollo).

#### 8.2.2 Texto exacto del pedido a WhatsApp

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

Reglas del formato (`components/CartPage.tsx`, `buildOrderMessage`):

- El separador entre la línea del artículo y su importe es una **raya** `—` (U+2014), con espacios a ambos lados.
- El paréntesis de la variante se **omite** si el artículo no tiene variante.
- `Dirección:` y `Notas:` se **omiten** si están vacías.
- La base del enlace es `https://wa.me/584129507176?text=` + `encodeURIComponent(mensaje)`.

## 9. Riesgos y puntos de revisión

> **Estado actual (2026-10-25).** R1–R14 son los riesgos del plan original: los que se materializaron llevan la marca **RESUELTO** con su cierre y los que dejaron de aplicar llevan **YA NO APLICA** (sin borrar: son parte del historial). R15–R20 son los riesgos que introduce la ampliación (Fases A–F).

| # | Riesgo | Impacto | Mitigación / decisión |
|---|---|---|---|
| **R1** | **Líneas 213–215 truncadas** (miles de caracteres). Un agente que lea con `read` transcribe mal o "inventa" datos y reintroduce el bug del brief | Alto | Extracción programática obligatoria (TASK-002); prohibido leer/transcribir `o`/`d`/`f` a mano; el script valida completitud y falla con exit ≠ 0 |
| **R2** | `body.det` / `#detail{display:none}` / `body.det #home{display:none}` — reglas CSS atadas al HTML original; JSX no puede reproducir `body.det` y la 3ª ocultaría la página de detalle | Alto | D6: eliminar las 3 reglas y documentarlo. **RESUELTO** (verificado en TASK-010/011): las 3 reglas están fuera de `app/globals.css` |
| **R3** | `next/image` + `object-fit:cover` + `aspect-ratio`: si el `<img>` no llena la caja, cambia el encuadre | Medio | Pasar `width`/`height` intrínsecos del manifest y mantener el CSS global (`.im img`, `.dimg img`, `.hi img`); verificar con el checklist `8.2`. **RESUELTO** con una excepción documentada: la imagen de servicios lleva `style={{height:'auto'}}` para no deformar la caja a 420×589 (§11-c) |
| **R4** | Hero con `aspect-ratio:4/5` + `max-height:480px`: el `max-height` rompe el ratio igual que en el original | Bajo | Comportamiento idéntico al original (mismo CSS + mismo DOM) — no "corregir" |
| **R5** | Toast con `setTimeout`: timers solapados ocultaban el toast antes de tiempo en el original | Bajo | Se limpia el temporizador anterior (mejora sin cambio visual) |
| **R6** | Frontera `use client`: un Server Component no puede usar `useState`; el estado no puede atravesar server components como props | Alto | Mapa explícito en `5.2`; son client: `CartProvider`, `CartPage`, `HashScroller`, `Header`, `BottomNav`, `Toast`, `CatalogBrowser`, `ProductCard`, `ProductDetail` |
| **R7** | Card clicable + botón "Agregar" anidado: envolver el botón en un `<Link>` genera HTML inválido | Medio | D7: `div[role=link][tabIndex]` + `stopPropagation()` en el botón; se conserva el área clicable y mejora teclado |
| **R8** | Las 5 fotos base64 pueden ser **visualmente la misma imagen** con cabeceras JPEG distintas (hash distintos) | Bajo | Deduplicar **solo** por hash exacto; mantener un archivo por hueco del DOM para poder sustituirlos individualmente; el manifest reporta hash + dimensiones para que el revisor confirme la paridad. **Verificado**: `servicios.jpg` y `mantenimiento-ps5.jpg` son **byte-idénticos** (mismo sha256 `8de143e2…`) porque el original reutiliza la misma foto; se conservan los 2 archivos (6 en total) y el manifest lo declara en `duplicateOf` |
| **R9** | `env(safe-area-inset-*)` depende de `viewport-fit=cover` | Medio | `export const viewport` en `app/layout.tsx` con `viewportFit: 'cover'` (TASK-001) |
| **R10** | Next 15 deprecó `next lint`; el build puede avisar de `images.qualities` | Bajo | `npm run lint` = `eslint .`; si el build avisa, añadir `images: { qualities: [75] }` a `next.config.ts`. **Resuelto**: el script usa `eslint .` y el build no emite el aviso |
| **R11** | Next restaura el scroll al navegar y puede interferir con las anclas `/#seccion` | Medio | `HashScroller` (TASK-010) + verificación en el checklist |
| **R12** | `npm install` requiere red (no hay lockfile previo) | Alto | Si falla por red: usar caché/offline mirror o `create-next-app` desde una plantilla local. **Bloqueante de TASK-001** |
| **R13** | Divergencia de copy al portar. El original usa `★★★★★` (**5 estrellas**, U+2605 ×5) en **los dos** sitios: en la card (línea 223, con `<span>5.0</span>`) y en el detalle (línea 234, con `<span>5.0 · Clientes satisfechos</span>`). La única diferencia entre card y detalle es el **texto** que acompaña a las estrellas, no su número | Bajo | Checklist `8.2`: ítems "Estrellas de la card" y "Estrellas del detalle"; el `map` de equivalencia `6` fija cada string |
| **R14** | Rutas: `/producto/[id]` con `dynamicParams=false` → 404 determinista | Bajo | `generateStaticParams` con los 6 ids del manifest |
| **R15** | **Persistencia en `localStorage` + *hydration mismatch*.** Si el carrito se lee durante el render, el HTML del servidor y el del cliente difieren (el servidor no puede leer `localStorage`). Y si se escribe antes de hidratar, un `F5` **borra** el carrito que el usuario tenía | Alto | **RESUELTO**: lectura **solo** en `useEffect` (el servidor renderiza `items = []`); escritura **solo después de hidratar**, con dos guardas (`hydratedRef` y comparación con el estado inicial) porque `reactStrictMode` doble-invoca los efectos en desarrollo. Verificado en el checklist §8.2.1 ("Persistencia" e "Hidratación") |
| **R16** | **Identidad de línea por variante.** Si la línea se identificara solo por `productId`, "DualSense (Blanco)" y "DualSense (Negro)" se pisarían entre sí y el cliente pediría una cosa y recibiría otra | Alto | **RESUELTO**: `lineId = producto::variante` (`lineIdOf`, `lib/cart.ts`). Dos variantes del mismo producto son **dos líneas**; la misma variante suma cantidad a la línea existente. La variante viaja al mensaje de WhatsApp |
| **R17** | **`localStorage` manipulado o corrupto.** El cliente puede editarlo a mano; un JSON inválido, una cantidad `0`/negativa o un `productId` inexistente romperían el render o inyectarían datos falsos | Medio | **RESUELTO**: triple barrera — `JSON.parse` en `try/catch` (si falla, carrito vacío), `sanitizeLine` por línea (descarta lo que no sea `{ productId: string no vacío, quantity: entero ≥ 1, option?: string }`) y descarte de las líneas cuyo `productId` no exista en el catálogo. La escritura también va en `try/catch`: si el almacenamiento falla, el carrito sigue funcionando en memoria |
| **R18** | **El manifest completo en el bundle del cliente.** `lib/products.ts` importa `public/images/manifest.json` (con `description` y `features`); si lo importara un client component, el catálogo entero viajaría al navegador | Medio | **RESUELTO**: el catálogo se resuelve en los **server components** (`app/catalogo/page.tsx`, `app/producto/[id]/page.tsx`) y llega por prop. Para el carrito, el layout *server* pasa un **catálogo reducido** (`getCartCatalog()` → `CartProduct[]`: `id`, `name`, `category`, `price`, `media`), sin `description` ni `features` |
| **R19** | **Estado activo de la barra inferior.** El CSS heredado tiene `.bn a:first-child{color:var(--or)}`: pinta "Inicio" de naranja **siempre**, también en `/catalogo` o `/servicios`. Con 4 items eso se lee como un "activo" que no es real | Bajo | **RESUELTO**: el estado activo se calcula con `usePathname()` (ruta exacta) y se marca con **dos** señales — clase `on` (pintada por `.bn a.on`, que anula el `:first-child`) y `aria-current="page"`, para que no dependa solo del color. La comparación es de ruta exacta: `/producto/*` no marca ninguno de los 4 items |
| **R20** | **El CSS ya no es *verbatim*.** El plan original (D6, §8.1) exigía que el CSS fuese idéntico al original salvo 3 líneas. El reestilizado lo incumplió y dejó obsoleto tanto el criterio de paridad como el comentario de cabecera de `app/globals.css` | Medio | **ACEPTADO** por decisión del usuario (§11-a). El criterio vigente es el checklist funcional §8.2.1, no el diff contra el original. **Pendiente**: el comentario de cabecera de `app/globals.css` sigue diciendo "copia VERBATIM", y eso ya es falso (ver §12) |

## 10. Decisiones: visto bueno y estado de ejecución

Las cinco decisiones se aprobaron y se ejecutaron tal como estaban escritas:

1. **D6 — desviación de CSS de 3 líneas** (eliminar `body.det` y `#detail{display:none}`). **Ejecutada**: las 3 reglas están fuera de `app/globals.css`. **ACTUALIZACIÓN (2026-10-25):** era "la única ruptura de *verbatim*", pero el CSS fue reestilizado después (§11-a): el bloque heredado de `app/globals.css` difiere hoy del `<style>` original en ~30 selectores (≈52 declaraciones), con 3 reglas eliminadas y 3 añadidas.
2. **D7 — la card como `div[role=link]`** en lugar de `<Link>` que envuelva el botón. **Ejecutada**.
3. **D5 — slugs de ruta** (`/producto/ps5-slim`, `/producto/mantenimiento-ps5`, …) en lugar de conservar `p0..p5`. **Ejecutada**: `generateStaticParams` + `dynamicParams = false`.
4. **D3 — carrito sin `localStorage`** (igual que el original). **Ejecutada como estaba escrita**: el estado del carrito vivía solo en memoria del cliente. **REVERTIDA el 2026-10-25** → **D3-bis** (§3): el carrito ahora persiste en `localStorage` (`justplay.cart.v1`), con la variante como parte de la identidad de la línea.
5. **TASK-013 (README) es diferible** si quieres reducir alcance. **Ejecutada**: `README.md` está escrito (y reescrito el 2026-10-25 para cubrir la versión ampliada: carrito real, páginas propias y checkout).

> **Nota de alcance (registrada el 2026-10-25, ampliada el mismo día).** Con posterioridad al cierre de la migración se añadió, fuera del alcance original de este plan, una **segunda tanda** de trabajo: catálogo y servicios como **páginas propias** (`/catalogo`, `/servicios`), un **carrito real** con lista de líneas y página `/carrito` (`components/CartProvider.tsx`, `components/CartPage.tsx`, `lib/cart.ts`), **persistencia en `localStorage`** y **checkout a WhatsApp**. Esa extensión **no está cubierta por D1–D7 ni por S4**, que describen el carrito-contador de la migración, ni por la verificación de paridad visual de `8.2`. Las desviaciones que introduce están en **§11** y el criterio de verificación vigente en **§8.2.1**. `README.md` refleja el estado verificado de la versión ampliada y señala esta diferencia.

---

## 11. Desviaciones vigentes (2026-10-25)

Estas son las diferencias **deliberadas** entre la versión ampliada y el HTML original. No son errores: son decisiones tomadas al ampliar el alcance del proyecto. El original **se conserva** en la raíz como referencia (`JustPlay Store – Demo.html`) y no se modifica.

### (a) El CSS fue reestilizado

El `<style>` del HTML original **ya no se copia tal cual**. Medición del contraste (`sed -n '8,142p'` del HTML contra las líneas 19–151 de `app/globals.css`): **~30 selectores de nivel superior modificados** (≈52 declaraciones), **3 reglas eliminadas** (las de D6, ver (b)) y **3 reglas añadidas** (`.card:hover .im img`, `.cat:hover`, `.srch:focus-within`).

Cambios de fondo:

| Área | Original | Versión actual |
|---|---|---|
| Chips de categoría (`.cat i`) | círculo de 56×56 (`border-radius:50%`, borde naranja) | cuadrado de 52×52 con esquinas de 14 px y borde neutro |
| Chip activo (`.cat.on i`) | fondo naranja plano | degradado `linear-gradient(135deg, var(--or), #ff9a3c)` con halo |
| Botón "Agregar" (`.add`) | borde naranja sobre fondo transparente | degradado naranja, texto negro, `border-radius:8px` |
| Hover de card (`.card:hover`) | solo `border-color:#444` | borde naranja + `translateY(-4px)` + sombra naranja |
| Fondo de la imagen (`.im`) | `radial-gradient(circle at 50% 40%, …)` | `linear-gradient(145deg,#1a1a1a,#0f0f0f)` |
| Buscador (`.srch`) | 46 px de alto, borde de 1 px | 56 px de alto, borde de 2 px, anillo de foco |
| Espaciados | `section{padding:56px 0}`, `gap:20px` | `section{padding:64px 0}`, `gap:24px` |
| Tipografía de encabezado | `.sh h2{font-size:22px}` | `.sh h2{font-size:24px;font-weight:800}` |

**Motivo:** decisión del usuario al ampliar el alcance del proyecto (el CSS se rediseñó junto con las nuevas funcionalidades). **Consecuencia:** la paridad pixel-perfect con el original **ya no es el objetivo** (§8.2) y el criterio de verificación vigente es el checklist funcional (§8.2.1).

### (b) Las 3 reglas de D6 eliminadas

Se eliminaron `#detail{display:none}`, `body.det #home{display:none}` y `body.det #detail{display:block}`.

**Motivo:** la vista de detalle dejó de ser un estado del `<body>` y pasó a ser su propia ruta (`/producto/[id]`). La clase `body.det` ya no se añade nunca, así que las reglas 2 y 3 quedan muertas y la regla 1 ocultaría la página de detalle por completo. Esta es la desviación **original** del plan (D6, riesgo R2) y sigue vigente.

### (c) `height:auto` en línea en la imagen de servicios

`components/ServicesSection.tsx` pasa `style={{ height: 'auto' }}` al `<Image>` de `servicios.jpg`.

**Motivo:** los atributos `width`/`height` que emite `next/image` son *hints* de presentación. El `<img>` original no declaraba dimensiones y conservaba su proporción intrínseca (1:1), de modo que `.sg img{width:100%;max-width:420px}` lo dejaba en 420×420. Sin `height:auto`, el navegador aplicaría el alto intrínseco (589) como alto fijo y la caja se deformaría a 420×589. Es la mitigación de R3 para esa imagen concreta, y evita tocar el CSS global.

### (d) Bloque CSS nuevo de 86 líneas

`app/globals.css` tiene 237 líneas: **1–18** = comentario de cabecera, **19–151** = bloque heredado (el CSS del original, con las 3 reglas de (b) ya eliminadas) y **152–237** = bloque nuevo (86 líneas del archivo, desde la línea en blanco que lo separa), añadido al final sin reescribir lo anterior.

Qué aporta:

- `.cartlist`, `.cartrow` y sus sub-clases (`.cartrow-img`, `.cartrow-body`, `.cartrow-cat`, `.cartrow-title`, `.cartrow-variant`, `.cartrow-side`, `.cartrow-remove`), `.cartempty`, `.cart-label`, `.cart-total`, `.checkout`, `.field`, `.formerror` — las clases que usa la página del carrito, que en el original no existían (el original resolvía el carrito con ~200 atributos `style` inline y no era responsive).
- `.bn a.on` — el **estado activo** de la barra inferior, que anula el `.bn a:first-child{color:var(--or)}` heredado (R19).
- `.toast a` — el enlace "Ver carrito" del toast.
- `.qty button:disabled` y `.btn[aria-disabled="true"]` — estados deshabilitados que el CSS heredado no contemplaba.
- Anillo de foco (`:focus-visible`) en los controles del carrito y en los inputs del checkout (`.field input:focus`, `.field textarea:focus`).
- Un `@media(max-width:700px)` propio: la fila `.cartrow` usa `grid-template-columns:80px 1fr auto`, que a 3 columnas se rompe en móvil; por debajo de 700 px se apila.

Los `@media` heredados **no** se tocan: los nuevos van al final y ganan por orden de cascada.

### (e) El toast lleva un enlace al carrito

El toast pasó de ser un texto plano a ser `Agregado al carrito · Ver carrito`, con un `<Link href="/carrito">` ("Ver carrito").

**Motivo:** el carrito dejó de ser un contador y pasó a ser una página real (`/carrito`); el enlace permite ir al pedido sin buscar el icono del carrito en la cabecera. **Consecuencia:** el DOM del toast **ya no es idéntico** al del original. El resto del mecanismo se conserva: la clase `s` sigue siendo el único mecanismo de visibilidad y la duración sigue siendo 1300 ms.

### (f) El `localStorage` es una desviación funcional

El carrito **persiste** en `localStorage` (clave `justplay.cart.v1`); el original **no persistía** y un `F5` lo vaciaba.

**Motivo:** con el checkout a WhatsApp, el pedido se arma a lo largo de varias sesiones y de varios dispositivos; perderlo al recargar hacía la función inútil. Es el cambio de fondo de **D3 → D3-bis** (§3), con todas sus consecuencias (identidad de línea por variante, catálogo reducido resuelto en el servidor, lectura en `useEffect`, escritura tras hidratar, y descarte de líneas corruptas).

### (g) Estructura de navegación

- El nav superior tiene **3** enlaces (Inicio, Catálogo, Servicios) en lugar de 4: "Contacto" salió del nav por decisión de diseño.
- El bottom-nav tiene **4** items: Inicio, Catálogo, Servicios y **Carrito**.
- "Contacto" es accesible desde el **footer** (`/#contacto`), que es el **único fragmento** que queda en el sitio.

**Motivo:** el catálogo y los servicios pasaron a ser páginas propias; el nav describe la arquitectura de rutas y ya no debe duplicar el contenido de la home. El footer hace de vía de acceso al contacto sin recargar la barra inferior con un quinto destino que no existía en el original.

### (h) El catálogo y los servicios son páginas propias

`/catalogo` y `/servicios` ya no son secciones de la home: la home es **hero + "por qué" + contacto** (`<main id="home">`, sin `id="catalogo"` ni `id="servicios"`).

**Motivo:** decisión de diseño de la ampliación. El contenido (copy, checklist de 8 ítems, 3 razones) es el del original; lo que cambia es **dónde** vive. Componentes afectados: `CatalogSection.tsx` → `CatalogBrowser.tsx` (que devuelve un fragmento, para que el `id="catalogo"` exista una sola vez en el DOM).

---

## 12. Deriva documental detectada (2026-10-25)

| Ubicación | Afirmación obsoleta | Corrección | Estado |
|---|---|---|---|
| `app/globals.css`, líneas 1–18 (comentario de cabecera) | "copia VERBATIM del `<style>` de *JustPlay Store – Demo.html*" y "El resto del CSS es identico, byte a byte, al original" | El CSS fue reestilizado (§11-a): el bloque heredado difiere del original en ~30 selectores (≈52 declaraciones) | **PENDIENTE** — `app/globals.css` está fuera del alcance de esta tarea de documentación; requiere corregir el comentario de cabecera |
| `PLAN.md` §8.1 | "Verificación del CSS verbatim (esperado: **solo** las 3 líneas de D6)" | El `diff` ya no sale vacío | **CORREGIDO** en §8.1 |
| `PLAN.md` §10, punto 4 | "D3 — carrito sin `localStorage`. **Ejecutada**: el estado del carrito vive solo en memoria del cliente." | El carrito persiste (D3-bis) | **CORREGIDO** en §10 |
| `PLAN.md` §7 TASK-013 | "Estado: completada (`README.md`)" — el archivo **no existía** | `README.md` se ha escrito el 2026-10-25 cubriendo la versión ampliada | **CORREGIDO** en §7 |
| `eslint.config.mjs`, líneas 22–42 (comentario de cabecera) | "DEPENDENCIAS TRANSITIVAS (pendiente de declarar en `package.json`)… Ninguno de los paquetes de abajo figura hoy en `package.json`" | Los 5 paquetes (`@next/eslint-plugin-next`, `eslint-plugin-react-hooks`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `globals`) **ya están declarados** en `devDependencies` de `package.json` | **PENDIENTE** — `eslint.config.mjs` está fuera del alcance de esta tarea de documentación; requiere actualizar el comentario |

---

**Plan aprobado y ejecutado el 2026-10-25; ampliado y re-documentado el 2026-10-25.** Este documento se conserva como registro del plan: `1`–`7` y `9` describen lo que se planeó, `10` recoge el estado final de cada decisión, `11` las desviaciones vigentes y `12` la deriva documental pendiente de corregir en código.

## Anexo — Evidencia del hallazgo sobre o/d/f

Contexto: el brief afirmaba que los 3 productos con foto (`p0`, `p1`, `p2`) carecían de `o` (opciones), `d` (descripción) y `f` (features), y que su detalle se renderizaba con campos `undefined`. Esa percepción proviene de que las líneas 213–215 del HTML miden varios miles de caracteres y las vistas previas de herramientas truncan la línea a los primeros ~2000 caracteres, ocultando la cola del literal JS.

### Comandos de reproducción

```bash
cd "/home/alvarovargas/Desktop/JustPlayStore"

# 1) ¿el array de opciones existe en la línea?
grep -n ",o:\[" "JustPlay Store – Demo.html"

# 2) ¿el array de opciones está vacío?  (0 coincidencias = ninguno vacío)
grep -n ",o:\[\]\|,f:\[\]" "JustPlay Store – Demo.html"

# 3) ¿el array de opciones tiene al menos un string?
grep -n ",o:\['[^']+'" "JustPlay Store – Demo.html"

# 4) ¿existe la descripción?
grep -n ",d:'" "JustPlay Store – Demo.html"

# 5) ¿existe el array de features?
grep -n ",f:\[" "JustPlay Store – Demo.html"
```

### Resultados

Los cinco comandos devuelven **6 coincidencias cada uno**, y siempre en las mismas seis líneas: **213, 214, 215, 216, 217 y 218** (las seis definiciones de producto del array `P`). El comando (2) no devuelve ninguna coincidencia: ningún array de opciones ni de features está vacío.

| Comando | Coincidencias | Líneas |
|---|---|---|
| `,o:\[` | 6 | 213, 214, 215, 216, 217, 218 |
| `,o:\[\]\|,f:\[\]` | 0 | — (ningún array vacío) |
| `,o:\['[^']+'` | 6 | 213, 214, 215, 216, 217, 218 |
| `,d:'` | 6 | 213, 214, 215, 216, 217, 218 |
| `,f:\[` | 6 | 213, 214, 215, 216, 217, 218 |

### Por qué esto es concluyente

El alfabeto base64 es `A–Z a–z 0–9 + / =`. **No contiene** `,` (coma), `'` (apóstrofo), `[` (corchete abierto) ni `}` (llave). Por lo tanto, cualquier coincidencia de `,o:[`, `,d:'` o `,f:[` dentro de esas líneas **no puede estar dentro del payload base64**: necesariamente está en el literal del objeto JavaScript, es decir, en la cola de la línea que la vista previa truncada oculta.

Corolario práctico: los tres productos con foto (p0, p1, p2) **sí** tienen opciones, descripción y features; el demo original no está roto y `x.o.map()` no lanza `TypeError`. En consecuencia, **no hay que inventar copy ni rellenar defaults** (decisión D1: campos obligatorios), y la única mitigación necesaria es la de R1: extraer los datos por script (TASK-002) en lugar de transcribirlos a mano desde una vista previa truncada.

Nota sobre falsos positivos: un patrón como `NaN` sí puede aparecer dentro de un payload base64 (N, a y N son caracteres base64 válidos), por lo que no sirve como evidencia. Los patrones usados arriba son seguros precisamente porque contienen caracteres que el base64 no puede representar.
