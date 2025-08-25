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
import { cmdWatch } from "./commands/watch.js";
import { metricsRollup, metricsPredict, metricsView, metricsTickets } from "./commands/metrics.js";
import { impactScan, impactSet } from "./commands/impact.js";
import { cmdBaseline } from "./commands/baseline.js";
import { cmdConfigEdit } from "./commands/config.js";
import { cmdBackupsList, cmdBackupsOpen } from "./commands/backups.js";
import { cmdReport } from "./commands/report.js";
import { cmdFinish } from "./commands/finish.js";
import { cmdRetake } from "./commands/retake.js";
import { cmdPromptStart, cmdPromptVoice, cmdPromptAnalyze } from "./commands/prompt.js";

const VERSION = "0.1.0";
const program = new Command();

program.name("lc").description("letscode: local store + Claude wiring").version(VERSION);

// setup
program.command("install").description("one-shot setup (git, stores, Claude hook)").action(cmdInstall);
program.command("doctor").description("verify environment").action(cmdDoctor);
program.command("init").description("create .letscode/ and ~/.letscode/").action(cmdInit);
program.command("status").option("--json", "machine-readable").description("show tickets/progress/todos").action((opts)=>cmdStatus({ json: !!opts.json }));
program.command("s").option("--json", "machine-readable").description("alias of status").action((opts)=>cmdStatus({ json: !!opts.json }));

// todos
const todo = program.command("todo").description("manage TODOs stored in .letscode/todo.json");
todo.command("add").argument("<title...>").option("--files <a,b>", "comma-separated files").description("add a TODO").action((title: string[], o)=>cmdTodoAdd(title.join(" "), { files: o.files }));
todo.command("list").description("list TODOs").action(cmdTodoList);
todo.command("done").argument("<idx>", "1-based index").description("mark TODO as done").action(cmdTodoDone);
todo.command("rm").argument("<idx>", "1-based index").description("remove a TODO").action(cmdTodoRemove);
program.command("tl").description("alias: todo list").action(cmdTodoList);
program.command("ta").argument("<title...>").option("--files <a,b>", "comma-separated files").description("alias: todo add").action((title: string[], o)=>cmdTodoAdd(title.join(" "), { files: o.files }));
program.command("td").argument("<idx>", "1-based index").description("alias: todo done").action(cmdTodoDone);
program.command("tr").argument("<idx>", "1-based index").description("alias: todo rm").action(cmdTodoRemove);

// tickets
program.command("feature").argument("<name...>").option("--readme", "scaffold README").option("--interactive", "prompt for goal/acceptance/estimate").description("start a feature").action((name: string[], o)=>createTicket("feature", name.join(" "), !!o.readme, o.interactive===undefined ? true : !!o.interactive));
program.command("bug").argument("<name...>").option("--readme", "scaffold README").option("--interactive", "prompt for goal/acceptance/estimate").description("start a bug").action((name: string[], o)=>createTicket("bug", name.join(" "), !!o.readme, o.interactive===undefined ? true : !!o.interactive));
program.command("f").argument("<name...>").option("--readme", "scaffold README").option("--interactive", "prompt for goal/acceptance/estimate").description("alias of feature").action((name: string[], o)=>createTicket("feature", name.join(" "), !!o.readme, o.interactive===undefined ? true : !!o.interactive));
program.command("b").argument("<name...>").option("--readme", "scaffold README").option("--interactive", "prompt for goal/acceptance/estimate").description("alias of bug").action((name: string[], o)=>createTicket("bug", name.join(" "), !!o.readme, o.interactive===undefined ? true : !!o.interactive));

// updates
program.command("update")
  .argument("[message...]", "what changed")
  .option("--progress <n>", "0..100", (v)=>parseInt(v,10))
  .option("--files <a,b>", "comma-separated files")
  .option("--tag <t>", "optional tag")
  .option("--ask", "prompt for details")
  .description("append a work update to the current ticket branch")
  .action((message: string[]|undefined, opts)=>cmdUpdate(message?.join(" "), opts));
program.command("u")
  .argument("[message...]", "what changed")
  .option("--progress <n>", "0..100", (v)=>parseInt(v,10))
  .option("--files <a,b>", "comma-separated files")
  .option("--tag <t>", "optional tag")
  .option("--ask", "prompt for details")
  .description("alias of update")
  .action((message: string[]|undefined, opts)=>cmdUpdate(message?.join(" "), opts));
program.command("ua").description("quick update (prompt)").action(()=>cmdUpdate(undefined, { ask: true } as any));

// backup mirror
const backup = program.command("backup").description("mirror .letscode to ~/.letscode/backups");
backup.command("sync").action(cmdBackupSync);
backup.command("watch").action(cmdBackupWatch);
backup.command("restore").option("--force", "overwrite local .letscode").action(cmdBackupRestore);

// context
program.command("context").option("--stdout", "print to stdout").description("emit repo context for Claude").action((opts)=>cmdContext({ stdout: !!opts.stdout }));
program.command("x").option("--stdout", "print to stdout").description("alias of context").action((opts)=>cmdContext({ stdout: !!opts.stdout }));

// where
program.command("where").description("print repo/local/backup paths").action(cmdWhere);

// git helpers
program.command("commit").argument("<message...>", "commit message").option("--no-stage", "do not stage changes before commit").description("stage all (unless --no-stage) and commit + record event").action((message: string[], opts)=>cmdCommit(message.join(" "), { stage: opts.stage !== false }));
program.command("cmerge").option("--message <m>", "merge commit message").option("--skip-build", "skip running build before merge").description("merge current branch into default branch with --no-ff").action((opts)=>cmdCmerge({ message: opts.message, skipBuild: !!opts.skipBuild }));
program.command("merge").option("--message <m>", "merge commit message").option("--skip-build", "skip running build before merge").description("alias of cmerge").action((opts)=>cmdCmerge({ message: opts.message, skipBuild: !!opts.skipBuild }));
program.command("c").argument("<message...>", "commit message").option("--no-stage", "do not stage changes before commit").description("alias of commit").action((message: string[], opts)=>cmdCommit(message.join(" "), { stage: opts.stage !== false }));
program.command("m").option("--message <m>", "merge commit message").option("--skip-build", "skip running build before merge").description("alias of merge").action((opts)=>cmdCmerge({ message: opts.message, skipBuild: !!opts.skipBuild }));

// reflect
program.command("reflect").option("--interactive", "prompt for notes and progress").description("write a reflection snapshot under .letscode/context/").action((opts)=>cmdReflect({ interactive: !!opts.interactive }));
program.command("r").option("--interactive", "prompt for notes and progress").description("alias of reflect").action((opts)=>cmdReflect({ interactive: !!opts.interactive }));
program.command("ri").description("reflect (interactive)").action(()=>cmdReflect({ interactive: true }));

// watch
program.command("watch").option("--interval <n|Ns|Nm>", "prompt interval (e.g. 30s or 10m)").description("watch for file changes and prompt quick updates").action((opts)=>cmdWatch({ interval: opts.interval }));
program.command("w").option("--interval <n|Ns|Nm>", "prompt interval (e.g. 30s or 10m)").description("alias of watch").action((opts)=>cmdWatch({ interval: opts.interval }));

// metrics
const metrics = program.command("metrics").description("metrics rollup/predict/view");
metrics.command("rollup").description("export CSVs to .letscode/metrics/").action(metricsRollup);
metrics.command("predict").description("compute velocity and ETA").action(metricsPredict);
metrics.command("view").description("generate metrics viewer HTML").action(metricsView);
metrics.command("tickets").description("export tickets estimates vs actuals").action(metricsTickets);
program.command("mr").description("alias: metrics rollup").action(metricsRollup);
program.command("mp").description("alias: metrics predict").action(metricsPredict);
program.command("mv").description("alias: metrics view").action(metricsView);
program.command("mt").description("alias: metrics tickets").action(metricsTickets);

// impact
const impact = program.command("impact").description("impact registries and ticket scope");
impact.command("scan").description("scan prisma/sql/openapi and hot files").action(impactScan);
impact.command("set").option("--tables <a,b>").option("--apis </x,/y>").option("--files <f,g>").description("set per-ticket scope").action((opts)=>impactSet({ tables: opts.tables, apis: opts.apis, files: opts.files }));
program.command("is").description("alias: impact scan").action(impactScan);
program.command("it").option("--tables <a,b>").option("--apis </x,/y>").option("--files <f,g>").description("alias: impact set").action((opts)=>impactSet({ tables: opts.tables, apis: opts.apis, files: opts.files }));

// baseline
program.command("baseline").option("--force", "overwrite if exists").description("generate baseline.json using Claude (or local fallback)").action((opts)=>cmdBaseline({ force: !!opts.force }));

// config
const config = program.command("config").description("configure letscode");
config.command("edit").description("open ~/.letscode/config.json in $EDITOR").action(cmdConfigEdit);

// backups UX
const backups = program.command("backups").description("backup utilities");
backups.command("list").description("list repos with backups").action(cmdBackupsList);
backups.command("open").description("open this repo's backup directory").action(cmdBackupsOpen);

// report
program.command("report").option("--ai", "generate AI narrative (requires Claude CLI)").description("summary of current repo status").action((o)=>cmdReport({ ai: !!o.ai }));

// finish (ticket)
program.command("finish").argument("[message...]", "final note").description("record final ticket note and run interactive merge").action((m?: string[])=>cmdFinish(m?.join(" ")));
program.command("fin").argument("[message...]", "final note").description("alias of finish").action((m?: string[])=>cmdFinish(m?.join(" ")));

// retake (refresh scans and baseline; optional README inject)
program.command("retake").option("--update-readme", "inject summary between README markers").description("rescan impact, refresh context + baseline, write project summary").action((o)=>cmdRetake({ updateReadme: !!o.updateReadme }));

// prompt
const promptCmd = program.command("prompt").description("prompt helpers");
promptCmd.command("start").option("--open", "open the prompt file in editor").description("scaffold a feature prompt under srcPlanning").action((o)=>cmdPromptStart({ open: !!o.open }));
promptCmd.command("voice").option("--mic", "enable microphone in Claude session").description("start a voice session to draft PRD; saves to PROMPT.md").action((o)=>cmdPromptVoice({ mic: !!o.mic }));
program.command("vtv").description("quick voice-to-voice session (overview if not on a ticket)").action(()=>cmdPromptVoice({ mic: true }));
promptCmd.command("analyze").description("run AI analysis of PROMPT.md into ANALYSIS.md").action(()=>cmdPromptAnalyze());

// zero-arg → status
if (!process.argv.slice(2).length) {
  await cmdStatus();
} else {
  await program.parseAsync(process.argv);
}
