import { effect, Signal, signal } from "@preact/signals";
import type { Prompt } from "./signals";

export const ShouldUsePostMessage = window.parent !== window && !!window.parent;

export function createPostMessagePromptSignal(): Signal<Prompt | undefined> {
  const sig = signal<Prompt | undefined>(undefined);
  window.addEventListener("message", (event) => {
    if (event.source === window.parent && event.data?.type === "setPrompt") {
      sig.value = event.data.prompt;
    }
  });
  effect(() => {
    const prompt = sig.value;
    if (prompt) {
      window.parent?.postMessage(
        { type: "setPrompt", prompt },
        "*"
      );
    }
  });
  return sig;
}
