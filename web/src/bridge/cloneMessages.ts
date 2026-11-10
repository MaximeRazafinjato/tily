export interface ClonePlan {
  name: string
  folder: string
  path?: string
  pathPreview?: string
  error?: string
}

export type CloneHostMessage =
  | { type: 'clone.suggested'; request: number; address?: string }
  | { type: 'clone.planned'; request: number; plan: ClonePlan; roots: string[] }
  | { type: 'clone.progress'; request: number; message: string }
  | { type: 'clone.done'; request: number; path: string; name: string; install?: string; claude?: string; message: string }
  | { type: 'clone.failed'; request: number; message: string; output?: string }

export type CloneWebMessage =
  | { type: 'clone.suggest'; request: number; url: string }
  | { type: 'clone.plan'; request: number; url: string; folder?: string; name?: string }
  | { type: 'clone.start'; request: number; url: string; folder?: string; name?: string; install: boolean; claude: boolean }
