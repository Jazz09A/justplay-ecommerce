/**
 * Estado compartido del carrito — PLAN.md §7 TASK-005 (decisiones D2 y D3),
 * Fase C: variante por linea + persistencia en `localStorage`.
 *
 * El demo original llevaba el carrito en una variable global (`var cart = 0`)
 * que la pagina actualizaba con `count()` y que **no persistia**: tras un F5
 * el contador volvia a 0. Aqui el equivalente es un Context de React montado
 * en el layout raiz, que sobrevive a la navegacion client-side del App Router
 * (supuesto S4 / decision D3) y que ademas **guarda** el carrito en
 * `localStorage`, asi que tambien sobrevive a una recarga completa.
 *
 * Dos cambios de fondo respecto a la fase anterior:
 *
 *   1. **La variante es parte de la identidad.** Una linea ya no se identifica
 *      solo por `productId`: se identifica por `lineId = producto::variante`
 *      (`lineIdOf`, en `lib/cart.ts`). "DualSense (Blanco)" y "DualSense
 *      (Negro)" son dos lineas distintas y se pueden tener las dos a la vez.
 *   2. **El estado vive en `localStorage`.** Solo se serializa la forma
 *      reducida (`CartLine`: `productId`, `quantity`, `option`); el producto se
 *      resuelve contra el catalogo que llega por prop, de modo que el manifest
 *      completo nunca entra en el bundle del cliente.
 *
 * El toast vive **dentro** del provider (`visible` + `timerRef`), no dentro de
 * `Toast.tsx`: asi la card (TASK-008) y el detalle (TASK-009) disparan el
 * mismo origen y existe un unico `setTimeout` en toda la app. `Toast.tsx` es
 * un consumidor puro que se monta en el layout raiz, de modo que este modulo
 * **no importa** a `Toast.tsx` (sin dependencia circular).
 *
 * El provider expone **dos** contextos y no uno:
 *
 *   - `CartContext`  → `{ count, items, total, add, remove, updateQuantity, clear }`;
 *   - `ToastContext` → `{ visible }`, que solo necesita `<Toast/>`.
 *
 * Separarlos mantiene el contrato de `useToast()` intacto y evita que el
 * header (que solo lee `count`) se vuelva a renderizar cada vez que el toast
 * aparece o desaparece.
 *
 * ## Persistencia sin *hydration mismatch*
 *
 * El servidor renderiza siempre un carrito vacio (`items = []`). Por eso la
 * lectura de `localStorage` ocurre en un `useEffect` **al montar** y nunca
 * durante el render: leer durante el render produciria HTML de servidor y HTML
 * de cliente distintos.
 *
 * La escritura tiene el problema simetrico: en el primer render `items` esta
 * vacio y guardarlo **borraria** el carrito que el usuario ya tenia. Se
 * resuelve con dos guarda:
 *
 *   - `hydratedRef`: se pone a `true` al final del efecto de lectura; mientras
 *     sea `false` el efecto de escritura no guarda nada.
 *   - la comparacion con el estado inicial (`initialItemsRef`): cubre el
 *     instante en que la hidratacion ya se ha leido pero su estado todavia no
 *     se ha aplicado al arbol (tambien en el doble montaje de `StrictMode`).
 *
 * Con las dos guardas, un `localStorage` corrupto o manipulado **no rompe la
 * app**: `sanitizeLine` descarta linea a linea lo que no sea valido y las
 * lineas cuyo `productId` no exista en el catalogo se ignoran.
 */

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { CART_STORAGE_KEY, lineIdOf, sanitizeLine, toCartProduct } from '@/lib/cart';
import type { CartLine, CartProduct } from '@/lib/cart';
import type { Product } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Contrato publico                                                    */
/* ------------------------------------------------------------------ */

/**
 * Item del carrito.
 */
export interface CartItem {
  /** Identificador de linea: producto + variante. */
  lineId: string;
  /** Datos del producto en su forma de carrito. */
  product: CartProduct;
  /** Cantidad de unidades. */
  quantity: number;
  /** Variante elegida, si la hubo. */
  option?: string;
}

/**
 * Valor del contexto del carrito (PLAN.md §5.2, "Contrato del contexto").
 */
export interface CartContextValue {
  /** Unidades agregadas al carrito. Empieza en 0 (igual que `var cart = 0`). */
  count: number;
  /** Lineas del carrito con sus cantidades y su variante. */
  items: CartItem[];
  /** Suma `price * quantity` de todas las lineas. */
  total: number;
  /** Agrega un producto (con su variante opcional) y muestra el toast. */
  add: (product: Product, quantity?: number, option?: string) => void;
  /** Elimina la linea con ese `lineId`. */
  remove: (lineId: string) => void;
  /** Actualiza la cantidad de una linea; si es `<= 0`, la elimina. */
  updateQuantity: (lineId: string, quantity: number) => void;
  /** Limpia el carrito completo. */
  clear: () => void;
}

/** Valor del contexto del toast. */
export interface ToastContextValue {
  /** `true` mientras el toast debe estar visible. */
  visible: boolean;
}

/** Texto del toast, identico al del original. */
export const TOAST_MESSAGE = 'Agregado al carrito';

/**
 * Tiempo que el toast permanece visible, en milisegundos.
 *
 * El original usaba `setTimeout(function(){t.classList.remove('s')},1300)`
 * (linea 228 del HTML), asi que 1300 es un valor contractual, no arbitrario.
 */
export const TOAST_DURATION_MS = 1300;

/* ------------------------------------------------------------------ */
/* Contextos                                                           */
/* ------------------------------------------------------------------ */

/**
 * `null` = "no hay provider". Es lo que permite que `useCart()` y `useToast()`
 * detecten el uso fuera del provider en lugar de devolver un valor mudo.
 */
const CartContext = createContext<CartContextValue | null>(null);
const ToastContext = createContext<ToastContextValue | null>(null);

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

/** Props de `CartProvider`. */
export interface CartProviderProps {
  /**
   * Catalogo reducido, resuelto en el servidor (`getCartCatalog()`).
   *
   * Es la fuente de verdad para resolver `productId` -> producto del carrito.
   * Solo contiene `CartProduct[]`: ni `description` ni `features`.
   */
  catalog: readonly CartProduct[];
  /** Arbol que queda bajo el provider (contenido + toast). */
  children: ReactNode;
}

/* ------------------------------------------------------------------ */
/* Helpers puros                                                       */
/* ------------------------------------------------------------------ */

/**
 * Construye una linea del carrito.
 *
 * La `option` solo se incluye cuando existe: `option: undefined` y "sin
 * variante" son el mismo estado.
 */
function toCartItem(
  lineId: string,
  product: CartProduct,
  quantity: number,
  option?: string,
): CartItem {
  return option === undefined
    ? { lineId, product, quantity }
    : { lineId, product, quantity, option };
}

/**
 * Proyecta una linea del carrito a su forma persistida.
 *
 * Solo se guarda `{ productId, quantity, option }`: el producto se resuelve
 * contra el catalogo al leer, no se duplica en el almacenamiento.
 */
function toCartLine(item: CartItem): CartLine {
  return item.option === undefined
    ? { productId: item.product.id, quantity: item.quantity }
    : { productId: item.product.id, quantity: item.quantity, option: item.option };
}

/**
 * Cantidad que se agrega al carrito: entera y `>= 1`.
 *
 * Si llega algo invalido (0, negativo, decimal, `NaN`) se usa 1: una linea con
 * cantidad 0 no se podria persistir (ver `sanitizeLine`) y dejaria el carrito
 * incoherente entre memoria y almacenamiento.
 */
function normalizeUnits(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return 1;
  }
  const units = Math.floor(quantity);
  return units >= 1 ? units : 1;
}

/**
 * Lee y valida el carrito guardado en `localStorage`.
 *
 * Es la unica barrera contra datos corruptos o manipulados:
 *
 *   - el JSON debe parsear y ser un array;
 *   - cada linea debe pasar `sanitizeLine`;
 *   - cada `productId` debe existir en el catalogo (un producto retirado no
 *     puede quedar en el carrito).
 *
 * Cualquier fallo devuelve un carrito vacio: nunca una excepcion.
 */
function readStoredCart(catalogById: ReadonlyMap<string, CartProduct>): CartItem[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    // Almacenamiento inaccesible (permisos, modo privado estricto, ...).
    return [];
  }
  if (raw === null) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // JSON invalido: se descarta todo el contenido guardado.
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }

  const items: CartItem[] = [];
  for (const entry of parsed) {
    const line = sanitizeLine(entry);
    if (line === null) {
      continue;
    }
    const product = catalogById.get(line.productId);
    if (product === undefined) {
      // Producto retirado del catalogo: la linea se descarta.
      continue;
    }
    items.push(
      toCartItem(lineIdOf(line.productId, line.option), product, line.quantity, line.option),
    );
  }
  return items;
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

/**
 * Provee el estado del carrito y del toast.
 *
 * Se monta en el layout raiz envolviendo `{children}` (TASK-005) para que
 * header, home, catalogo y detalle compartan la misma instancia.
 */
export function CartProvider({ catalog, children }: CartProviderProps) {
  /**
   * Estado inicial del carrito: siempre vacio.
   *
   * El servidor renderiza `items = []` y el cliente arranca en `[]`, de modo
   * que no hay *hydration mismatch*. El guardado se recupera despues, en un
   * `useEffect`.
   */
  const initialItemsRef = useRef<CartItem[]>([]);
  const [items, setItems] = useState<CartItem[]>(initialItemsRef.current);
  const [toastVisible, setToastVisible] = useState(false);

  // Referencia al temporizador vivo: permite limpiarlo antes de fijar otro y
  // cancelarlo al desmontar. Un `useState` no serviria porque el callback del
  // `setTimeout` necesitaria leer el id mas reciente.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Bandera de hidratacion.
   *
   * Se pone a `true` al final del efecto de lectura: mientras sea `false` el
   * carrito guardado todavia no se ha leido y no se escribe nada.
   */
  const hydratedRef = useRef(false);

  /**
   * Catalogo indexado por id: resuelve `productId` -> producto del carrito.
   *
   * Se memoriza para que el efecto de lectura no se repita en cada render.
   */
  const catalogById = useMemo(() => {
    const map = new Map<string, CartProduct>();
    for (const product of catalog) {
      map.set(product.id, product);
    }
    return map;
  }, [catalog]);

  /**
   * Muestra el toast y programa su ocultado.
   *
   * Se limpia el temporizador previo **antes** de fijar el nuevo: en el
   * original dos "agregar" seguidos dejaban el primer `setTimeout` vivo, que
   * ocultaba el toast antes de tiempo (riesgo R5 del plan). El plan asume
   * esta mejora, que no altera el render.
   */
  const showToast = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setToastVisible(true);
    timerRef.current = setTimeout(() => {
      setToastVisible(false);
      timerRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  /**
   * Agrega un producto al carrito y muestra el toast.
   *
   * La identidad de la linea es `producto::variante`: si la linea ya existe
   * (mismo producto **y** misma variante) se **suma** la cantidad; si no, se
   * **añade** al final. Dos variantes del mismo producto son dos lineas.
   */
  const add = useCallback(
    (product: Product, quantity: number = 1, option?: string): void => {
      const cartProduct = toCartProduct(product);
      const lineId = lineIdOf(product.id, option);
      const units = normalizeUnits(quantity);

      setItems((current) => {
        const existing = current.find((item) => item.lineId === lineId);
        if (existing !== undefined) {
          return current.map((item) =>
            item.lineId === lineId
              ? { ...item, quantity: item.quantity + units, product: cartProduct }
              : item,
          );
        }
        return [...current, toCartItem(lineId, cartProduct, units, option)];
      });
      showToast();
    },
    [showToast],
  );

  /**
   * Elimina la linea con ese identificador.
   */
  const remove = useCallback((lineId: string): void => {
    setItems((current) => current.filter((item) => item.lineId !== lineId));
  }, []);

  /**
   * Actualiza la cantidad de una linea.
   *
   * Con una cantidad `<= 0` la linea se **elimina**: es el comportamiento que
   * espera el boton `−` del carrito.
   */
  const updateQuantity = useCallback((lineId: string, quantity: number): void => {
    setItems((current) => {
      const units = Number.isFinite(quantity) ? Math.floor(quantity) : 0;
      if (units <= 0) {
        return current.filter((item) => item.lineId !== lineId);
      }
      return current.map((item) => (item.lineId === lineId ? { ...item, quantity: units } : item));
    });
  }, []);

  /**
   * Limpia el carrito completo.
   */
  const clear = useCallback((): void => {
    setItems([]);
  }, []);

  /**
   * Lee el carrito guardado y lo aplica al estado.
   *
   * Solo al montar y **nunca** durante el render: el servidor renderiza un
   * carrito vacio y leer en el render produciria un *hydration mismatch*.
   *
   * El guard `hydratedRef` evita releer cuando el efecto se repite por un
   * cambio de identidad del catalogo: el carrito en memoria manda entonces.
   */
  useEffect(() => {
    if (hydratedRef.current) {
      return;
    }
    const restored = readStoredCart(catalogById);
    setItems(restored);
    hydratedRef.current = true;
  }, [catalogById]);

  /**
   * Persiste el carrito.
   *
   * Solo escribe **despues** de hidratar: en el primer render `items` esta
   * vacio y guardarlo vaciaria el carrito que el usuario ya tenia. Por eso se
   * comprueba la bandera `hydratedRef` y que el estado ya no sea el inicial.
   *
   * Si el almacenamiento falla (cuota agotada, permisos) no se lanza: el
   * carrito sigue funcionando en memoria.
   */
  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }
    if (items === initialItemsRef.current) {
      return;
    }
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items.map(toCartLine)));
    } catch {
      // Cuota agotada o almacenamiento bloqueado: no se persiste, pero el
      // carrito sigue funcionando en memoria.
    }
  }, [items]);

  // Limpieza al desmontar: sin esto el `setTimeout` sobrevive al unmount y su
  // callback intentaria actualizar un arbol que ya no existe.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // `useMemo` mantiene la identidad del valor estable mientras el contenido no
  // cambie: sin esto cada render crearia un objeto nuevo y re-renderizaria a
  // todos los consumidores del contexto.
  const count = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items],
  );
  const cartValue = useMemo<CartContextValue>(
    () => ({ count, items, total, add, remove, updateQuantity, clear }),
    [count, items, total, add, remove, updateQuantity, clear],
  );
  const toastValue = useMemo<ToastContextValue>(
    () => ({ visible: toastVisible }),
    [toastVisible],
  );

  return (
    <CartContext.Provider value={cartValue}>
      <ToastContext.Provider value={toastValue}>{children}</ToastContext.Provider>
    </CartContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

/**
 * Acceso al estado del carrito.
 *
 * Lanza error si se usa fuera de `<CartProvider>`: es un error de uso (no de
 * tipos), asi que no afecta al build de Next — que solo prerenderiza arboles
 * bien formados — y evita el fallo silencioso de devolver un carrito que nunca
 * se actualiza.
 */
export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (context === null) {
    throw new Error('useCart() debe usarse dentro de <CartProvider>.');
  }
  return context;
}

/**
 * Acceso al estado del toast.
 *
 * Lanza error si se usa fuera de `<CartProvider>`, por el mismo motivo que
 * `useCart()`.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast() debe usarse dentro de <CartProvider>.');
  }
  return context;
}
