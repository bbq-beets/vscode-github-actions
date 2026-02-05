export const DapFileSystemCommand = {
  Stat: "fs.stat",
  ReadFile: "fs.readFile",
  WriteFile: "fs.writeFile",
  ReadDirectory: "fs.readDirectory",
  CreateDirectory: "fs.createDirectory",
  Delete: "fs.delete",
  Watch: "fs.watch",
  Unwatch: "fs.unwatch"
} as const;

export const DapFileSystemEvent = {
  Changed: "fs.changed"
} as const;

export const DapFileSystemEntryType = {
  Unknown: "unknown",
  File: "file",
  Directory: "directory",
  SymbolicLink: "symbolicLink"
} as const;

export type DapFileSystemEntryType = (typeof DapFileSystemEntryType)[keyof typeof DapFileSystemEntryType];

export const DapFileChangeType = {
  Created: "created",
  Changed: "changed",
  Deleted: "deleted"
} as const;

export type DapFileChangeType = (typeof DapFileChangeType)[keyof typeof DapFileChangeType];

export const DapFileSystemContentEncoding = {
  Base64: "base64"
} as const;

export type DapFileSystemContentEncoding =
  (typeof DapFileSystemContentEncoding)[keyof typeof DapFileSystemContentEncoding];

export type FileSystemStatRequestArguments = {
  path: string;
};

export type FileSystemStatResponseBody = {
  type: DapFileSystemEntryType;
  readOnly: boolean;
  ctime: number;
  mtime: number;
  size: number;
};

export type FileSystemReadFileRequestArguments = {
  path: string;
  encoding?: DapFileSystemContentEncoding;
};

export type FileSystemReadFileResponseBody = {
  content: string;
  encoding: DapFileSystemContentEncoding;
};

export type FileSystemWriteFileRequestArguments = {
  path: string;
  content: string;
  encoding?: DapFileSystemContentEncoding;
  create?: boolean;
  overwrite?: boolean;
};

export type FileSystemReadDirectoryRequestArguments = {
  path: string;
};

export type FileSystemReadDirectoryResponseBody = {
  entries: FileSystemEntry[];
};

export type FileSystemEntry = {
  name: string;
  type: DapFileSystemEntryType;
};

export type FileSystemCreateDirectoryRequestArguments = {
  path: string;
};

export type FileSystemDeleteRequestArguments = {
  path: string;
  recursive?: boolean;
};

export type FileSystemWatchRequestArguments = {
  path: string;
  recursive?: boolean;
};

export type FileSystemWatchResponseBody = {
  watchId: number;
};

export type FileSystemUnwatchRequestArguments = {
  watchId: number;
};

export type FileSystemChangeEventBody = {
  watchId: number;
  changes: FileSystemChange[];
};

export type FileSystemChange = {
  type: DapFileChangeType;
  path: string;
};
