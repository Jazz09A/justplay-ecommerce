/**
 * HashScroller — PLAN.md §7 TASK-010 (riesgos R2 y R11).
 *
 * El demo original navegaba por hash: los enlaces del header y de la barra
 * inferior eran `href="#" data-go="catalogo"` y un delegado de `click`
 * (linea 254 del HTML) hacia:
 *
 *   var el = document.getElementById(t); if (el) el.scrollIntoView();
 *
 * En la migracion el catalogo y los servicios son **paginas propias**
 * (`/catalogo`, `/servicios`), asi que el nav y la barra inferior ya no
 * usan anclas. El **unico** fragmento que queda en el sitio es el enlace
 * "Contacto" del pie (`/#contacto`), que apunta a la seccion de contacto de
 * la home. El scroll al ancla lo resuelve este componente. No dibuja nada: es
 * un efecto lateral puro, montado en el layout raiz para que sobreviva a la
 * navegacion client-side (si viviera en la home, se desmontaria al ir al
 * detalle).
 *
 * Decisiones de implementacion:
 *
 *   - **El hash es la fuente de verdad.** El componente no conoce las
 *     secciones: lee `window.location.hash` y busca `#<id>` en el DOM. Asi el
 *     detalle de producto NO usa enrutado por hash (cada producto tiene su
 *     ruta real `/producto/[id]`) y este modulo no necesita saber nada de el.
 *   - **Sin `useSearchParams`.** La URL se lee directamente de `window`, que
 *     siempre esta al dia, en lugar de a traves de hooks del router.
 *   - **Scroll instantaneo.** Se llama a `scrollIntoView()` sin opciones: el
 *     CSS global fija `html{scroll-behavior:auto}` y el original usaba el
 *     comportamiento por defecto (tampoco `behavior:'smooth'`).
 *   - **Si el `id` no existe, no hay scroll** (igual que el `if (el)` del
 *     original): una ancla desconocida no mueve la pagina.
 *
 * Montaje: en `app/layout.tsx`, dentro de `<body>` (por ejemplo, como primer
 * hijo). No necesita el contexto del carrito y no requiere `<Suspense>`.
 *
 * Nota: el router del App Router ya implementa su propio scroll al hash. Este
 * componente lo complementa de forma explicita e independiente de los internos
 * de Next (riesgo R11) y es la unica fuente de verdad para el desplazamiento
 * cuando el destino aun no existe en el DOM.
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/* ------------------------------------------------------------------ */
/* Constantes                                                          */
/* ------------------------------------------------------------------ */

/**
 * Intentos maximos para localizar el elemento destino.
 *
 * Al navegar client-side el destino puede todavia no estar en el DOM cuando
 * se dispara el scroll (la seccion se monta despues), asi que la busqueda se
 * reintenta de forma acotada. El limite evita seguir preguntando por un `id`
 * que no existe.
 */
const MAX_RESOLVE_ATTEMPTS = 8;

/**
 * Espera entre intentos de resolucion, en milisegundos.
 *
 * Con los valores actuales la ventana de reintento es de ~480 ms, suficiente
 * para el montaje de la home tras una navegacion client-side.
 */
const RESOLVE_RETRY_MS = 60;

/* ------------------------------------------------------------------ */
/* Vigilante de la URL                                                 */
/* ------------------------------------------------------------------ */

/** Suscriptores a los cambios de URL. */
const urlWatchers = new Set<() => void>();

/** `true` cuando el vigilante ya esta instalado sobre `window.history`. */
let historyWatcherInstalled = false;

/** Notifica a los suscriptores de que la URL cambio. */
function notifyUrlWatchers(): void {
  for (const watcher of urlWatchers) {
    watcher();
  }
}

/**
 * Envuelve `history.pushState` y `history.replaceState` para detectar los
 * cambios de URL que produce el router del App Router.
 *
 * Por que hace falta: `next/link` intercepta el click, hace `preventDefault()`
 * y navega con `history.pushState`, y **`pushState` no dispara el evento
 * `hashchange`** (a diferencia de una navegacion nativa a un fragmento). Sin
 * este vigilante, el cambio de ancla dentro de la misma pagina no seria
 * detectable: `usePathname()` devuelve la misma ruta en los dos casos y
 * `hashchange` no se dispara.
 *
 * El envoltorio es transparente: primero delega en el metodo original y
 * despues notifica, de modo que `window.location` ya refleja la URL nueva
 * cuando se evalua. Next.js tambien envuelve estos mismos metodos (para
 * mantener su router sincronizado); como cada envoltorio delega en el
 * anterior, ambos siguen funcionando sea cual sea el orden de instalacion.
 */
function installHistoryWatcher(): void {
  if (historyWatcherInstalled) {
    return;
  }
  historyWatcherInstalled = true;

  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function pushState(
    this: History,
    ...args: Parameters<History['pushState']>
  ): void {
    originalPushState.apply(this, args);
    notifyUrlWatchers();
  };

  window.history.replaceState = function replaceState(
    this: History,
    ...args: Parameters<History['replaceState']>
  ): void {
    originalReplaceState.apply(this, args);
    notifyUrlWatchers();
  };
}

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

/**
 * Desplaza la vista hasta el elemento cuyo `id` coincide con el hash de la URL.
 *
 * Se monta en el layout raiz (`app/layout.tsx`) y no renderiza nada.
 */
export function HashScroller(): null {
  /**
   * Ruta actual. Solo se usa como senal de "ha cambiado de pagina": el hash
   * se lee siempre de `window.location`, que no depende del router.
   */
  const pathname = usePathname();

  /**
   * URL evaluada por ultima vez (`pathname + hash`).
   *
   * Sirve para no desplazar dos veces por la misma navegacion (el router, el
   * evento `hashchange` y el efecto de este componente pueden disparar el
   * mismo cambio) y para no arrastrar al usuario cuando el router hace un
   * `replaceState` con la misma URL.
   */
  const lastUrlRef = useRef<string | null>(null);

  /** `requestAnimationFrame` pendiente de resolver el destino. */
  const frameRef = useRef<number | null>(null);

  /** `setTimeout` pendiente del reintento de resolucion. */
  const retryRef = useRef<number | null>(null);

  /** Cancela el frame y el reintento pendientes. */
  const cancelPendingScroll = useCallback((): void => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (retryRef.current !== null) {
      window.clearTimeout(retryRef.current);
      retryRef.current = null;
    }
  }, []);

  /**
   * Busca `#<id>` en el DOM y desplaza la vista hasta el.
   *
   * La busqueda se reintenta un numero acotado de veces porque el destino
   * puede no existir todavia (montaje de la nueva ruta). Si nunca aparece, no
   * se desplaza nada.
   */
  const scrollToHash = useCallback((hash: string): void => {
    const id = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!id) {
      return;
    }

    let attempts = 0;

    const resolve = (): void => {
      const target = document.getElementById(id);
      if (target) {
        // Scroll instantaneo: `html{scroll-behavior:auto}` en el CSS global y
        // `scrollIntoView()` sin opciones en el original.
        target.scrollIntoView();
        return;
      }
      attempts += 1;
      if (attempts > MAX_RESOLVE_ATTEMPTS) {
        return;
      }
      retryRef.current = window.setTimeout(() => {
        retryRef.current = null;
        resolve();
      }, RESOLVE_RETRY_MS);
    };

    // Un frame de margen: cuando el scroll lo dispara una navegacion
    // client-side, la pagina destino todavia no se ha pintado.
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      resolve();
    });
  }, []);

  /**
   * Evalua la URL actual y desplaza la vista si tiene un ancla.
   *
   * Solo actúa cuando la URL **cambia**: el router del App Router llama a
   * `replaceState` en cada cambio de estado con la misma URL, y atender esos
   * casos volveria a arrastrar al usuario al ancla aunque ya se haya
   * desplazado.
   */
  const evaluateUrl = useCallback((): void => {
    const hash = window.location.hash;
    const url = `${window.location.pathname}${hash}`;

    if (url === lastUrlRef.current) {
      return;
    }
    lastUrlRef.current = url;

    // La URL ya es otra: cualquier desplazamiento en curso queda obsoleto.
    cancelPendingScroll();

    if (!hash || hash === '#') {
      // Sin ancla no hay nada que desplazar (se respeta el scroll normal).
      return;
    }

    scrollToHash(hash);
  }, [cancelPendingScroll, scrollToHash]);

  // 1) Montaje inicial (recarga directa sobre `/#catalogo`) y cambio de ruta.
  useEffect(() => {
    evaluateUrl();
    return () => {
      // Al desmontar —o en el doble montaje de Strict Mode— se reinicia el
      // estado: el siguiente montaje vuelve a evaluar la URL y puede reanudar
      // el scroll al ancla.
      lastUrlRef.current = null;
      cancelPendingScroll();
    };
  }, [cancelPendingScroll, evaluateUrl, pathname]);

  // 2) Cambios de hash nativos y botones atras/adelante del navegador.
  useEffect(() => {
    const handleUrlChange = (): void => {
      evaluateUrl();
    };
    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, [evaluateUrl]);

  // 3) Cambios de URL hechos por el router (`pushState`/`replaceState`).
  useEffect(() => {
    installHistoryWatcher();
    const handleUrlChange = (): void => {
      evaluateUrl();
    };
    urlWatchers.add(handleUrlChange);
    return () => {
      urlWatchers.delete(handleUrlChange);
    };
  }, [evaluateUrl]);

  return null;
}
