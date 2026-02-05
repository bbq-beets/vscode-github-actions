import * as vscode from "vscode";
import {WorkflowJobNode} from "../treeViews/shared/workflowJobNode";

export type AttachWorkflowJobDebuggerArgs = Pick<WorkflowJobNode, "gitHubRepoContext" | "job">;

const DEFAULT_DEBUG_PORT = 4711;

export function registerAttachWorkflowJobDebugger(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "github-actions.workflow.job.attachDebugger",
      async (args: AttachWorkflowJobDebuggerArgs) => {
        const job = args.job.job;
        const workflowName = job.workflow_name || undefined;
        const jobName = job.name;
        const title = workflowName ? `Workflow "${workflowName}" job "${jobName}"` : `Job "${jobName}"`;

        const debugConfig: vscode.DebugConfiguration = {
          name: `GitHub Actions: ${title}`,
          type: "github-actions",
          request: "attach",
          port: DEFAULT_DEBUG_PORT,
          workflowName,
          jobName
        };

        const folder = vscode.workspace.workspaceFolders?.[0];
        const started = await vscode.debug.startDebugging(folder, debugConfig);
        if (!started) {
          await vscode.window.showErrorMessage("Failed to start GitHub Actions debug session.");
        }
      }
    )
  );
}
