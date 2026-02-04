import * as vscode from "vscode";

const DEFAULT_DEBUG_HOST = "127.0.0.1";
const DEFAULT_DEBUG_PORT = 4711;

export function registerWorkflowDebugging(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory("github-actions", new WorkflowDebugAdapterDescriptorFactory())
  );

  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider("github-actions", new WorkflowDebugConfigurationProvider())
  );

  context.subscriptions.push(
    vscode.debug.registerDebugAdapterTrackerFactory("github-actions", new WorkflowDebugAdapterTrackerFactory())
  );
}

class WorkflowDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
  createDebugAdapterDescriptor(session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    const port = Number(session.configuration.port) || DEFAULT_DEBUG_PORT;
    const host = session.configuration.host || DEFAULT_DEBUG_HOST;
    return new vscode.DebugAdapterServer(port, host);
  }
}

class WorkflowDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
  resolveDebugConfiguration(
    _folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    if (!config.type) {
      config.type = "github-actions";
    }

    if (!config.request) {
      config.request = "attach";
    }

    if (!config.name) {
      config.name = "GitHub Actions";
    }

    return config;
  }
}

class WorkflowDebugAdapterTrackerFactory implements vscode.DebugAdapterTrackerFactory {
  createDebugAdapterTracker(): vscode.DebugAdapterTracker {
    return {
      onDidSendMessage: message => {
        // This callback enables logging or processing debug adapter messages if needed.
      }
    };
  }
}
