import { effect, Signal, signal } from "@preact/signals";
import type { Prompt } from "./signals";

export const ShouldUsePostMessage = window.parent !== window && !!window.parent;

export function createPostMessagePromptSignal(): Signal<Prompt | undefined> {
  const sig = signal<Prompt | undefined>(undefined);

  window.addEventListener("message", (event) => {
    if (event.source === window.parent && event.data?.type === "setPrompt") {
      if (!sig.peek()) {
        console.log("✅ Initialized prompt from parent", event.data.prompt);
      }
      sig.value = {
        // in case the message is partial, supply some defaults
        id: 'postmessage',
        text: '',
        archived: false,
        ...event.data.prompt
      };
    }
  });
  console.log(
    '⏳ Waiting for parent to post a message like { "type": "setPrompt", "prompt": { "text": "Your prompt here" } }',
  );

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
