# Prompt Pad postMessage Mode

If Prompt Pad is loaded in an iframe, then instead of trying to access local storage, it will
use the `postMessage` API to communicate with the parent window. This allows Prompt Pad to be
nicely embedded in other applications.

When Prompt Pad loads and detects it isn't the topmost frame, it waits for a message like this from the parent frame:

```json
{
  "type": "setPrompt",
  "prompt": {
    "text": "your prompt text"
  }
}
```

Then, when the user edits the prompt, Prompt Pad sends back a message with **the same format.** For example:

```json
{
  "type": "setPrompt",
  "prompt": {
    "text": "the updated prompt text"
  }
}
```

## Additional features

### Submit via postMessage

If you set `submit=pm` in the URL fragment when loading Prompt Pad (e.g. `https://prompt-pad.danmercer.net/#submit=pm`), then when the user clicks the "Submit" button, Prompt Pad will send a message like this to the parent frame:

```json
{
  "type": "submitPrompt",
  "prompt": {
    "text": "the current prompt text"
  }
}
```
