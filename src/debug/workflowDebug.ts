import * as path from "path";
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
  createDebugAdapterTracker(session: vscode.DebugSession): vscode.DebugAdapterTracker {
    const workflowFile = session.configuration.workflowFile as string | undefined;
    if (!workflowFile) {
      return {};
    }

    const workflowName = path.basename(workflowFile);
    const jobName = (session.configuration.jobName as string | undefined)?.trim();
    let stepLineMap: StepLineMap = {
        allSteps: [],
        stepLinesByJobName: new Map(),
        allJobs: [],
        jobLineByName: new Map(),
    };
    void buildStepLineMap(workflowFile).then(map => {
      stepLineMap = map;
    });

    return {
      onDidSendMessage: message => {
        if (message.type !== "response" || message.command !== "stackTrace") {
          return;
        }

        const stackFrames = message.body?.stackFrames;
        if (!Array.isArray(stackFrames)) {
          return;
        }

        for (const frame of stackFrames) {
          if (!frame.source) {
            frame.source = {name: workflowName, path: workflowFile};
          } else {
            if (!frame.source.path) {
              frame.source.path = workflowFile;
            }

            if (!frame.source.name) {
              frame.source.name = workflowName;
            }
          }

          const mappedLine = mapStepIndexToLine(frame.line, stepLineMap, jobName);
          if (mappedLine) {
            frame.line = mappedLine;
          }
        }
      }
    };
  }
}

type StepLineMap = {
  allSteps: number[];
  stepLinesByJobName: Map<string, number[]>;
  allJobs: number[];
  jobLineByName: Map<string, number>;
};

async function buildStepLineMap(workflowFile: string): Promise<StepLineMap> {
  try {
    const uri = workflowFile.startsWith("file:") ? vscode.Uri.parse(workflowFile) : vscode.Uri.file(workflowFile);
    const content = await vscode.workspace.fs.readFile(uri);
    const text = new TextDecoder().decode(content);
    return parseStepLineMap(text);
  } catch {
    return {
        allSteps: [],
        stepLinesByJobName: new Map(),
        allJobs: [],
        jobLineByName: new Map(),
    };
  }
}

function parseStepLineMap(text: string): StepLineMap {
  const lines = text.split(/\r?\n/);
  const allSteps: number[] = [];
  const byJobId = new Map<string, number[]>();
  const jobNameById = new Map<string, string>();
  const jobLineById = new Map<string, number>();
  const allJobs: number[] = [];

  let jobsIndent: number | undefined;
  let currentJobId: string | undefined;
  let currentJobIndent: number | undefined;
  let inSteps = false;
  let stepsIndent: number | undefined;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const indent = line.length - line.trimStart().length;

    if (jobsIndent === undefined) {
      if (trimmed === "jobs:") {
        jobsIndent = indent;
      }
      continue;
    }

    if (indent <= jobsIndent) {
      currentJobId = undefined;
      currentJobIndent = undefined;
      inSteps = false;
      stepsIndent = undefined;
      continue;
    }

    if (currentJobIndent !== undefined && indent <= currentJobIndent) {
      currentJobId = undefined;
      currentJobIndent = undefined;
      inSteps = false;
      stepsIndent = undefined;
    }

    if (!currentJobId) {
      if (isJobKeyLine(trimmed)) {
        currentJobId = trimmed.slice(0, -1).trim();
        currentJobIndent = indent;
        if (!byJobId.has(currentJobId)) {
          byJobId.set(currentJobId, []);
        }
        const lineNumber = index + 1;
        jobLineById.set(currentJobId, lineNumber);
        allJobs.push(lineNumber);
      }
      continue;
    }

    if (indent > (currentJobIndent ?? 0)) {
      if (!inSteps && trimmed.startsWith("name:")) {
        const nameValue = trimmed.slice("name:".length).trim();
        if (nameValue) {
          jobNameById.set(currentJobId, stripYamlQuotes(nameValue));
        }
      }

      if (trimmed === "steps:") {
        inSteps = true;
        stepsIndent = indent;
        continue;
      }

      if (inSteps && stepsIndent !== undefined) {
        if (indent <= stepsIndent) {
          inSteps = false;
          stepsIndent = undefined;
          continue;
        }

        if (trimmed.startsWith("-")) {
          const lineNumber = index + 1;
          const stepsForJob = byJobId.get(currentJobId);
          if (stepsForJob) {
            stepsForJob.push(lineNumber);
          }
          allSteps.push(lineNumber);
        }
      }
    }
  }

  const byJobName = new Map<string, number[]>();
  const jobLineByName = new Map<string, number>();
  for (const [jobId, steps] of byJobId.entries()) {
    byJobName.set(jobId, steps);
    const jobLine = jobLineById.get(jobId);
    if (jobLine !== undefined) {
      jobLineByName.set(jobId, jobLine);
    }
    const name = jobNameById.get(jobId);
    if (name) {
      byJobName.set(name, steps);
      if (jobLine !== undefined) {
        jobLineByName.set(name, jobLine);
      }
    }
  }

  return {allSteps, stepLinesByJobName: byJobName, allJobs, jobLineByName};
}

function isJobKeyLine(trimmed: string): boolean {
  if (!trimmed.endsWith(":")) {
    return false;
  }

  if (trimmed.startsWith("-")) {
    return false;
  }

  const key = trimmed.slice(0, -1).trim();
  return !!key && key !== "steps" && key !== "name";
}

function stripYamlQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function mapStepIndexToLine(stepIndex: number, stepLineMap: StepLineMap, jobName?: string): number | undefined {
  const index = Number(stepIndex);
  if (!Number.isFinite(index) || index < 0) {
    return undefined;
  }

  if (index === 0) {
    const jobLine = jobName ? getJobLine(stepLineMap, jobName) : undefined;
    return jobLine ?? stepLineMap.allJobs[0];
  }

  const stepsForJob = jobName ? getStepsForJob(stepLineMap, jobName) : undefined;
  const steps = stepsForJob ?? stepLineMap.allSteps;
  if (index > steps.length) {
    return undefined;
  }

  return steps[index - 1];
}

function getStepsForJob(stepLineMap: StepLineMap, jobName: string): number[] | undefined {
  const exact = stepLineMap.stepLinesByJobName.get(jobName);
  if (exact) {
    return exact;
  }

  const lower = jobName.toLowerCase();
  for (const [key, steps] of stepLineMap.stepLinesByJobName.entries()) {
    if (key.toLowerCase() === lower) {
      return steps;
    }
  }

  return undefined;
}

function getJobLine(stepLineMap: StepLineMap, jobName: string): number | undefined {
  const exact = stepLineMap.jobLineByName.get(jobName);
  if (exact !== undefined) {
    return exact;
  }

  const lower = jobName.toLowerCase();
  for (const [key, line] of stepLineMap.jobLineByName.entries()) {
    if (key.toLowerCase() === lower) {
      return line;
    }
  }

  return undefined;
}
