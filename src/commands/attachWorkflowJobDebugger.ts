import * as vscode from "vscode";
import {WorkflowJobNode} from "../treeViews/shared/workflowJobNode";

export type AttachWorkflowJobDebuggerArgs = Pick<WorkflowJobNode, "gitHubRepoContext" | "job">;

const DEFAULT_DEBUG_PORT = 4711;

export function registerAttachWorkflowJobDebugger(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "github-actions.workflow.job.attachDebugger",
      async (args: AttachWorkflowJobDebuggerArgs) => {
        const job = args.job;

        const debugConfig: vscode.DebugConfiguration = {
          name: `GitHub Actions: ${job.job.name}`,
          type: "github-actions",
          request: "attach",
          port: DEFAULT_DEBUG_PORT
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
