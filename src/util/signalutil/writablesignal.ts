import type { ReadonlySignal, Signal } from "@preact/signals";

export function withWriteFunction<T>(sig: ReadonlySignal<T>, writeFunc: (this: Signal<T>, newValue: T) => void): Signal<T> {
  return new Proxy(sig, {
    set(target, prop, value) {
      if (prop === 'value') {
        writeFunc.call(target, value as T);
      } else {
        (target as any)[prop] = value;
      }
      return true;
    }
  });
}
