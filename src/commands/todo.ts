import chalk from "chalk";
import { ensureLocalScaffold, repoRoot } from "../lib/paths.js";
import { readJson, writeJsonAtomic } from "../lib/util.js";

type TodoItem = {
  title: string;
  files?: string[];
  createdAt: string;
  doneAt?: string;
};

async function loadTodos(): Promise<{ file: string; items: TodoItem[] }> {
  const root = await repoRoot();
  const { todo } = await ensureLocalScaffold(root);
  const items = await readJson<TodoItem[]>(todo, []);
  return { file: todo, items };
}

export async function cmdTodoAdd(title: string, opts: { files?: string }) {
  if (!title || !title.trim()) throw new Error("Title is required");
  const { file, items } = await loadTodos();
  const files = (opts.files || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const next: TodoItem = { title: title.trim(), createdAt: new Date().toISOString(), ...(files.length ? { files } : {}) };
  items.push(next);
  await writeJsonAtomic(file, items);
  console.log(chalk.green("[TODO] added:"), next.title);
}

export async function cmdTodoList() {
  const { items } = await loadTodos();
  if (!items.length) {
    console.log(chalk.gray("[TODO] none"));
    return;
  }
  items.forEach((t, i) => {
    const idx = String(i + 1).padStart(2, " ");
    const status = t.doneAt ? chalk.gray("done") : chalk.yellow("open");
    const files = t.files && t.files.length ? chalk.gray(` [${t.files.join(", ")}]`) : "";
    console.log(`${idx}. ${status} - ${t.title}${files}`);
  });
}

export async function cmdTodoDone(indexStr: string) {
  const idx = parseInt(indexStr, 10);
  if (!Number.isFinite(idx) || idx < 1) throw new Error("Provide a valid index (1-based)");
  const { file, items } = await loadTodos();
  if (idx > items.length) throw new Error("Index out of range");
  const i = idx - 1;
  if (items[i].doneAt) {
    console.log(chalk.gray("[TODO] already done:"), items[i].title);
    return;
  }
  items[i].doneAt = new Date().toISOString();
  await writeJsonAtomic(file, items);
  console.log(chalk.green("[TODO] marked done:"), items[i].title);
}

export async function cmdTodoRemove(indexStr: string) {
  const idx = parseInt(indexStr, 10);
  if (!Number.isFinite(idx) || idx < 1) throw new Error("Provide a valid index (1-based)");
  const { file, items } = await loadTodos();
  if (idx > items.length) throw new Error("Index out of range");
  const i = idx - 1;
  const [removed] = items.splice(i, 1);
  await writeJsonAtomic(file, items);
  console.log(chalk.green("[TODO] removed:"), removed?.title ?? `#${idx}`);
}


