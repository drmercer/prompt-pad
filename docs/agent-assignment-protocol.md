# Agent Assignment protocol

Version: 0.0.1

> [!WARNING]
> This is not yet implemented in Prompt Pad, as of 10 October 2024.

The Agent Assignment protocol is used by a "sending application" (such as Prompt Pad or the Code Cards Lucid extension) to submit tasks to a coding agent, such as Claude Code or Gemini CLI.
It is done using HTTP requests to a server that manages the agents, such as a local server running on your machine that runs Claude Code programmatically.

## Configuration

The sending application (Prompt Pad) needs to be configured with two values:

1. The HTTP endpoint of the AA server. For example: `http://agent-assignment-server.localhost:3000`
2. A bearer token for authentication.


## Authentication

The sending application (Prompt Pad) includes the bearer token in the Authorization header of each request to the AA server.
The header should look like this:

```
Authorization: Bearer YOUR_BEARER_TOKEN
```

## Submitting a task

To submit a task prompt to an agent, the sending application (Prompt Pad) will send a POST request to the endpoint of the AA server, with a JSON body like this:

```
POST http://agent-assignment-server.localhost:3000
Authorization: Bearer YOUR_BEARER_TOKEN
Content-Type: application/json

{
  "id": "unique-task-id",
  "prompt": "your task description here",
  "dependencies": [
    "other-task-id-1",
    "other-task-id-2"
  ]
}
```

Field details:

- `id`: A unique identifier for the task submission.
  This can be a UUID or any other unique string.
- `prompt`: The prompt text of the task to be sent to the agent.
- `dependencies`: An array of other task IDs that must be completed before this task is processed.
  This field is optional.
  (Prompt Pad probably won't use this field, but Code Cards will.)

Any 2xx response indicates the task has been accepted into the queue.
A 4xx or 5xx response indicates an error.

If a task with the same ID has already been submitted, the server MUST cancel that task and enqueue the new one instead.

If any other task IDs are listed in the `dependencies` array, the AA server MUST ensure those tasks are completed before starting this one.
It SHOULD also ensure that the current working tree includes the commits from those tasks when the agent starts working on this task.

Once the task is completed, the AA server MUST create a commit in the git repository with the changes made by the agent. The commit message should include the original prompt text.

## Querying server info and task status

The sending application (Prompt Pad) can query the status of the AA server and all submitted tasks by sending a GET request to the endpoint of the server.
For example:

```
GET http://agent-assignment-server.localhost:3000
Authorization: Bearer YOUR_BEARER_TOKEN
Accept: application/json
```

Example response

```json
{
  "serverName": "Claude Code on my-computer",
  "tasks": [
    {
      "id": "unique-prompt-id-1",
      "submittedAt": "2024-10-01T12:34:56Z",
      "status": "queued",
    },
    {
      "id": "unique-prompt-id-2",
      "submittedAt": "2024-10-01T12:34:56Z",
      "status": "in-progress",
    },
    {
      "id": "unique-prompt-id-3",
      "submittedAt": "2024-10-01T12:34:56Z",
      "status": "completed",
      "commit": "<commit SHA>"
    }
  ]
}
```

Possible statuses:
- `queued`: The task is in the queue, waiting to be processed.
- `in-progress`: The task is currently being processed by the agent.
- `completed`: The task has been processed successfully and is ready for review by a human.

## Possible areas for future expansion

Allow the human to review each task as it is completed, and approve or refine it.

- What is the best way for a human to review the completed task? Reviewing the commit on GitHub? (Pushing to a remote before reviewing the code might be dangerous, if there are CI builds that run on all branches.) Or in their terminal maybe? Or something else?
- What should iterating on a completed task look like? Maybe something like sending the agent the diff and a prompt explaining what to improve?
- Maybe allow the sending application to approve or reject a completed task, and have the AA server wait for all tasks to be approved before continuing with tasks that depend on them. (Or, I could just have the sending application not submit the dependent tasks until the previous ones are approved...)


Misc.

- Allow the sending application to cancel a submitted task by sending a DELETE request to the AA server with the task ID.
