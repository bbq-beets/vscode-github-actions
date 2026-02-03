import * as vscode from "vscode";
import {GitHubRepoContext} from "../git/repository";
import {logDebug, logError} from "../log";
import {WorkflowJob} from "../store/WorkflowJob";
import {getWorkflowUri} from "../workflow/workflow";
import {WorkflowJobNode} from "../treeViews/shared/workflowJobNode";

export type AttachWorkflowJobDebuggerArgs = Pick<WorkflowJobNode, "gitHubRepoContext" | "job">;

const DEFAULT_DEBUG_PORT = 4711;

export function registerAttachWorkflowJobDebugger(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "github-actions.workflow.job.attachDebugger",
      async (args: AttachWorkflowJobDebuggerArgs) => {
        const repoContext = args.gitHubRepoContext;
        const job = args.job;

        const workflowFile = await resolveWorkflowFilePath(repoContext, job);
        if (!workflowFile) {
          await vscode.window.showWarningMessage(
            "Unable to locate the workflow file in the workspace. Debugging will attach without source mapping."
          );
        }

        const debugConfig: vscode.DebugConfiguration = {
          name: `GitHub Actions: ${job.job.name}`,
          type: "github-actions",
          request: "attach",
          workflowFile,
          jobName: job.job.name,
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

async function resolveWorkflowFilePath(repoContext: GitHubRepoContext, job: WorkflowJob): Promise<string | undefined> {
  const runId = job.job.run_id;

  if (runId) {
    try {
      const runResponse = await repoContext.client.actions.getWorkflowRun({
        owner: repoContext.owner,
        repo: repoContext.name,
        run_id: runId
      });

      const workflowPath = runResponse.data.path;
      if (workflowPath) {
        const uri = getWorkflowUri(repoContext, workflowPath);
        await vscode.workspace.fs.stat(uri);
        return uri.fsPath;
      }
    } catch (error) {
      logDebug("Unable to resolve workflow file from run data", (error as Error)?.message ?? error);
    }
  }

  return findWorkflowFileInWorkspace();
}

async function findWorkflowFileInWorkspace(): Promise<string | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }

  try {
    const workflowFiles = await vscode.workspace.findFiles(
      "**/.github/workflows/*.{yml,yaml}",
      "**/node_modules/**",
      200
    );

    if (workflowFiles.length === 0) {
      return undefined;
    }

    if (workflowFiles.length === 1) {
      return workflowFiles[0].fsPath;
    }

    const picks = workflowFiles.map(uri => ({
      label: vscode.workspace.asRelativePath(uri),
      uri
    }));

    const selection = await vscode.window.showQuickPick(picks, {
      placeHolder: "Select the workflow file to map debug sources"
    });

    return selection?.uri.fsPath;
  } catch (error) {
    logError(error as Error, "Unable to find workflow files in workspace");
    return undefined;
  }
}
