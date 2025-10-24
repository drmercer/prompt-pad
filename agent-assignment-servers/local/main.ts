async function loadEnv(path: string): Promise<Record<string, string>> {
  try {
    const content = await Deno.readTextFile(path);
    const env: Record<string, string> = {};
    for (const line of content.split("\n")) {
      if (line.trim() && !line.startsWith("#")) {
        const [key, value] = line.split("=");
        if (key && value) {
          env[key.trim()] = value.trim();
        }
      }
    }
    return env;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return {};
    }
    throw error;
  }
}

const env = await loadEnv(".env.local");
const bearerToken = Deno.env.get("BEARER_TOKEN") || env.BEARER_TOKEN;

if (!bearerToken) {
  console.error("BEARER_TOKEN is not set in the environment or .env.local file.");
  Deno.exit(1);
}

const repoPath = Deno.args[0];
const commandAndArgs = Deno.args.slice(1);

if (!repoPath || commandAndArgs.length === 0) {
  console.error(
    "Usage: deno run -A main.ts <path-to-repo> -- <command-and-args>",
  );
  Deno.exit(1);
}

const command = commandAndArgs[0];
const args = commandAndArgs.slice(1);

const dbPath = `./db-${btoa(repoPath).replace(/=/g, "")}.json`;

interface Task {
  id: string;
  prompt: string;
  dependencies: string[];
  status: "queued" | "in-progress" | "completed" | "error";
  submittedAt: string;
  commit?: string;
  error?: string;
}

let tasks: Task[] = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing) {
    return;
  }

  const taskToProcess = tasks.find((task) => task.status === "queued");
  if (!taskToProcess) {
    return; // No tasks to process
  }

  isProcessing = true;
  try {
    await processTask(taskToProcess);
  } catch (e) {
    console.error(`Error processing task ${taskToProcess.id}:`, e);
    taskToProcess.status = "error";
    taskToProcess.error = e.message;
    await saveTasks();
  } finally {
    isProcessing = false;
    // Check for the next task in the queue
    processQueue();
  }
}

try {
  const fileContent = await Deno.readTextFile(dbPath);
  tasks = JSON.parse(fileContent);
  // Reset any "in-progress" tasks from a previous crash to "queued"
  tasks.forEach((t) => {
    if (t.status === "in-progress") {
      t.status = "queued";
    }
  });
} catch (error) {
  if (error instanceof Deno.errors.NotFound) {
    // File doesn't exist, which is fine.
  } else {
    console.error("Error reading database file:", error);
  }
}

async function saveTasks() {
  await Deno.writeTextFile(dbPath, JSON.stringify(tasks, null, 2));
}

const port = 1337;
const hostname = "127.0.0.1";

console.log(`Server running at http://aa.localhost:${port}/`);

Deno.serve({ port, hostname }, async (req) => {
  const hostHeader = req.headers.get("Host");
  if (!hostHeader || hostHeader.split(":")[0] !== "aa.localhost") {
    return new Response("Invalid hostname", { status: 400 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${bearerToken}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({ serverName: "Local Agent Assignment Server", tasks }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST") {
    const task = await req.json();
    const existingTaskIndex = tasks.findIndex((t) => t.id === task.id);
    if (existingTaskIndex !== -1) {
      tasks.splice(existingTaskIndex, 1);
    }

    const newTask: Task = {
      ...task,
      status: "queued",
      submittedAt: new Date().toISOString(),
    };
    tasks.push(newTask);
    await saveTasks();

    // Kick off processing if not already running
    processQueue();

    return new Response("Task accepted", { status: 202 });
  }

  return new Response("Not found", { status: 404 });
});

// Start processing any tasks that were queued from a previous session
processQueue();

async function processTask(task: Task) {
  task.status = "in-progress";
  await saveTasks();

  try {
    // Stash any existing changes
    const stash = new Deno.Command("git", {
      args: ["stash"],
      cwd: repoPath,
    });
    await stash.output();

    // Run the command
    const processedArgs = args.map((arg) => arg === "AA_PROMPT" ? task.prompt : arg);
    const cmd = new Deno.Command(command, {
      args: processedArgs,
      cwd: repoPath,
    });
    const { code, stderr } = await cmd.output();

    if (code !== 0) {
      throw new Error(`Command failed with code ${code}: ${new TextDecoder().decode(stderr)}`);
    }

    // Commit the changes
    const add = new Deno.Command("git", {
      args: ["add", "."],
      cwd: repoPath,
    });
    await add.output();

    const commit = new Deno.Command("git", {
      args: ["commit", "-m", `Agent task: ${task.prompt}`],
      cwd: repoPath,
    });
    await commit.output();

    // Get the commit SHA
    const revParse = new Deno.Command("git", {
      args: ["rev-parse", "HEAD"],
      cwd: repoPath,
    });
    const { code: revParseCode, stdout: revParseStdout, stderr: revParseStderr } = await revParse.output();
    if (revParseCode === 0) {
      const commitSha = new TextDecoder().decode(revParseStdout).trim();
      task.commit = commitSha;
    } else {
      throw new Error(`git rev-parse failed: ${new TextDecoder().decode(revParseStderr)}`);
    }

    task.status = "completed";
    await saveTasks();
  } catch (e) {
    task.status = "error";
    task.error = e.message;
    await saveTasks();
  }
}