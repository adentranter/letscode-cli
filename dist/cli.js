#!/usr/bin/env node
import { Command } from "commander";
import { cmdInstall } from "./commands/install.js";
import { cmdDoctor } from "./commands/doctor.js";
import { cmdInit } from "./commands/init.js";
import { cmdStatus } from "./commands/status.js";
import { createTicket } from "./commands/featureBug.js";
import { cmdUpdate } from "./commands/update.js";
import { cmdBackupSync, cmdBackupWatch, cmdBackupRestore } from "./commands/backup.js";
import { cmdTodoAdd, cmdTodoDone, cmdTodoList, cmdTodoRemove } from "./commands/todo.js";
import { cmdContext } from "./commands/context.js";
import { cmdWhere } from "./commands/where.js";
import { cmdCommit } from "./commands/commit.js";
import { cmdCmerge } from "./commands/cmerge.js";
import { cmdReflect } from "./commands/reflect.js";
const VERSION = "0.1.0";
const program = new Command();
program.name("lc").description("letscode: local store + Claude wiring").version(VERSION);
// setup
program.command("install").description("one-shot setup (git, stores, Claude hook)").action(cmdInstall);
program.command("doctor").description("verify environment").action(cmdDoctor);
program.command("init").description("create .letscode/ and ~/.letscode/").action(cmdInit);
program.command("status").option("--json", "machine-readable").description("show tickets/progress/todos").action((opts) => cmdStatus({ json: !!opts.json }));
// todos
const todo = program.command("todo").description("manage TODOs stored in .letscode/todo.json");
todo.command("add").argument("<title...>").option("--files <a,b>", "comma-separated files").description("add a TODO").action((title, o) => cmdTodoAdd(title.join(" "), { files: o.files }));
todo.command("list").description("list TODOs").action(cmdTodoList);
todo.command("done").argument("<idx>", "1-based index").description("mark TODO as done").action(cmdTodoDone);
todo.command("rm").argument("<idx>", "1-based index").description("remove a TODO").action(cmdTodoRemove);
// tickets
program.command("feature").argument("<name...>").option("--readme", "scaffold README").description("start a feature").action((name, o) => createTicket("feature", name.join(" "), !!o.readme));
program.command("bug").argument("<name...>").option("--readme", "scaffold README").description("start a bug").action((name, o) => createTicket("bug", name.join(" "), !!o.readme));
// updates
program.command("update")
    .argument("[message...]", "what changed")
    .option("--progress <n>", "0..100", (v) => parseInt(v, 10))
    .option("--files <a,b>", "comma-separated files")
    .option("--tag <t>", "optional tag")
    .option("--ask", "prompt for details")
    .description("append a work update to the current ticket branch")
    .action((message, opts) => cmdUpdate(message?.join(" "), opts));
// backup mirror
const backup = program.command("backup").description("mirror .letscode to ~/.letscode/backups");
backup.command("sync").action(cmdBackupSync);
backup.command("watch").action(cmdBackupWatch);
backup.command("restore").option("--force", "overwrite local .letscode").action(cmdBackupRestore);
// context
program.command("context").option("--stdout", "print to stdout").description("emit repo context for Claude").action((opts) => cmdContext({ stdout: !!opts.stdout }));
// where
program.command("where").description("print repo/local/backup paths").action(cmdWhere);
// git helpers
program.command("commit").argument("<message...>", "commit message").option("--no-stage", "do not stage changes before commit").description("stage all (unless --no-stage) and commit + record event").action((message, opts) => cmdCommit(message.join(" "), { stage: opts.stage !== false }));
program.command("cmerge").option("--message <m>", "merge commit message").option("--skip-build", "skip running build before merge").description("merge current branch into default branch with --no-ff").action((opts) => cmdCmerge({ message: opts.message, skipBuild: !!opts.skipBuild }));
program.command("merge").option("--message <m>", "merge commit message").option("--skip-build", "skip running build before merge").description("alias of cmerge").action((opts) => cmdCmerge({ message: opts.message, skipBuild: !!opts.skipBuild }));
// reflect
program.command("reflect").option("--interactive", "prompt for notes and progress").description("write a reflection snapshot under .letscode/context/").action((opts) => cmdReflect({ interactive: !!opts.interactive }));
// zero-arg → status
if (!process.argv.slice(2).length) {
    await cmdStatus();
}
else {
    await program.parseAsync(process.argv);
}
