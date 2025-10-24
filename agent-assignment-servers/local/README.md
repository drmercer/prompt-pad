# Local Agent Assignment Server

This server allows you to connect a local command-line tool to the agent assignment protocol. It can be used to integrate any script or executable that can be driven from the command line.

## Usage

To use the server, run the following command:

```bash
deno run -A main.ts path/to/repo -- <command and args>
```

- `path/to/repo`: The absolute path to the Git repository you want the agent to operate on.
- `<command and args>`: The command and arguments to execute for each task.

### Prompt Placeholder

The server provides a special placeholder, `AA_PROMPT`, which will be replaced with the task's prompt. You can use this to pass the prompt to your command.

### Example

Here's an example of how to use the server with a hypothetical `gemini` command:

```bash
deno run -A main.ts /path/to/your/repo -- gemini -p AA_PROMPT --permission-mode auto_edit
```

In this example, when a task is assigned, the server will execute the following command:

```bash
gemini -p "The prompt for the task" --permission-mode auto_edit
```

## Protocol Information

For more information about the agent assignment protocol, please refer to the [protocol documentation](../../docs/agent-assignment-protocol.md).