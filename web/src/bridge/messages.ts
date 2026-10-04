import type { Session } from '../model/session'
import type { BrowserHostMessage, BrowserWebMessage } from './browserMessages'
import type { GitChangeKind, GitHostMessage, GitSettings, GitWebMessage } from './gitMessages'
import type { McpHostMessage, McpServerInfo, McpWebMessage } from './mcpMessages'
import type { PreviewHostMessage, PreviewKind, PreviewWebMessage } from './previewMessages'
import type { StatusLogEntry, StatusLogHostMessage, StatusLogWebMessage } from './statusLogMessages'
import type { UpdateHostMessage, UpdateSettings, UpdateWebMessage } from './updateMessages'
import type { WorktreeHostMessage, WorktreeProjectFolder, WorktreeSettings, WorktreeSources, WorktreeWebMessage } from './worktreeMessages'

export interface ShellProfile {
  id: string
  name: string
  executable: string
  arguments: string
  available: boolean
}

export enum PickTarget {
  File = 'file',
  Folder = 'folder',
  Sound = 'sound',
}

export interface PickedPath {
  field: string
  path: string
}

export enum OpenTarget {
  Editor = 'editor',
  Explorer = 'explorer',
}

export enum EntryKind {
  File = 'file',
  Folder = 'folder',
}

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  preview?: PreviewKind
}

export interface GitPathMark {
  path: string
  kind: GitChangeKind
  conflicted: boolean
}

export interface GitContext {
  isRepository: boolean
  branch: string | null
  detachedHead: boolean
  worktreeRoot?: string
}

export interface AppearanceSettings {
  fontSize: number
}

export interface PersistenceSettings {
  textIntervalSeconds: number
  linesPerPane: number
  maxTextMebibytes: number
}

export enum NotificationSound {
  None = 'none',
  Default = 'Notification.Default',
  InstantMessage = 'Notification.IM',
  Mail = 'Notification.Mail',
  Reminder = 'Notification.Reminder',
  Sms = 'Notification.SMS',
}

export interface NotificationSettings {
  windowsToast: boolean
  sound: NotificationSound | string
  taskbarFlash: boolean
  notifyDone: boolean
  doneSound: NotificationSound | string
}

export enum AttentionKind {
  Waiting = 'waiting',
  Done = 'done',
}

export interface Settings {
  shells: Record<string, string>
  editor: string
  persistence: PersistenceSettings
  projectsRoot: string
  notifications: NotificationSettings
  worktrees: WorktreeSettings
  worktreeFolders: WorktreeProjectFolder[]
  git: GitSettings
  updates: UpdateSettings
  appearance: AppearanceSettings
}

interface ShellSetting {
  id: string
  name: string
  defaultExecutable: string
  configured: string
  available: boolean
}

export interface ImportedPreferences {
  settings: Settings
  path: string
  warnings: string[]
}

interface AgentHooksInfo {
  script: string
  stateDirectory: string
  settingsFile: string
  hooksInstalled: boolean
}

interface NotificationAvailability {
  toastAvailable: boolean
  toastError?: string
}

export interface SettingsSnapshot {
  settings: Settings
  shellSettings: ShellSetting[]
  files: Record<string, string>
  warnings: string[]
  agents: AgentHooksInfo
  mcp: McpServerInfo
  notifications: NotificationAvailability
}

export interface Project {
  name: string
  path: string
  worktree: boolean
}

export interface PaneActivity {
  paneId: string
  processes: string[]
}

export enum AgentState {
  Working = 'working',
  Waiting = 'waiting',
  Done = 'done',
  Error = 'error',
  Unknown = 'unknown',
}

export interface PaneAgent {
  paneId: string
  agent: string
  state: AgentState
  message?: string
  detail?: string
  interrupted?: boolean
  sessionId?: string
}

export type HostToWebMessage =
  | { type: 'appearance.changed'; fontSize: number }
  | { type: 'app.hello'; version: string; session: Session; shells: ShellProfile[]; home: string; text: Record<string, string>; persistence: PersistenceSettings; appearance: AppearanceSettings; statusLog: StatusLogEntry[]; recovery?: string }
  | { type: 'app.closing'; activity: PaneActivity[] }
  | { type: 'session.saved' }
  | { type: 'session.saveFailed'; message: string }
  | ({ type: 'dialog.picked' } & PickedPath)
  | ({ type: 'settings.result'; shells: ShellProfile[]; persistence: PersistenceSettings; saved: boolean; external: boolean } & SettingsSnapshot)
  | { type: 'settings.exported'; path: string }
  | ({ type: 'settings.imported' } & ImportedPreferences)
  | { type: 'terminal.output'; pane: string; data: string }
  | { type: 'terminal.cwd'; pane: string; path: string }
  | { type: 'terminal.exit'; pane: string; code: number }
  | { type: 'terminal.dropped'; pane: string; text: string }
  | { type: 'terminal.pathMissing'; pane: string; path: string; fallback: string }
  | { type: 'terminal.activityResult'; request?: number; panes: PaneActivity[] }
  | { type: 'agent.states'; panes: PaneAgent[] }
  | { type: 'agent.join'; pane: string }
  | { type: 'projects.listed'; root: string; projects: Project[]; error?: string }
  | { type: 'projects.repositoriesFound'; request: number; sources: WorktreeSources }
  | { type: 'projects.repositoryRemembered'; project: string; repository: string }
  | { type: 'context.result'; pane: string; path: string; git: GitContext }
  | { type: 'files.listed'; path: string; entries: FileEntry[]; total: number; error?: string }
  | { type: 'files.created'; path: string }
  | { type: 'files.gitMarks'; root: string | null; marks: GitPathMark[] }
  | { type: 'files.renamed'; path: string; target: string }
  | { type: 'files.deleted'; path: string }
  | { type: 'files.searched'; path: string; root: string; files: string[]; changed: string[]; truncated: boolean; error?: string }
  | { type: 'error'; pane?: string; message: string }
  | GitHostMessage
  | PreviewHostMessage
  | WorktreeHostMessage
  | UpdateHostMessage
  | StatusLogHostMessage
  | McpHostMessage
  | BrowserHostMessage

export type WebToHostMessage =
  | { type: 'app.ready' }
  | { type: 'session.save'; session: Session }
  | { type: 'text.save'; text: Record<string, string>; keep: string[] }
  | { type: 'settings.get' }
  | { type: 'settings.save'; settings: Settings; baseSettings: Settings }
  | { type: 'appearance.fontSize'; fontSize: number }
  | { type: 'settings.export' }
  | { type: 'settings.import' }
  | { type: 'attention.raise'; pane: string; kind: AttentionKind; title: string; body: string; location: string }
  | { type: 'attention.test'; pane: string; kind: AttentionKind; notifications: NotificationSettings }
  | { type: 'attention.flash' }
  | { type: 'agents.installHooks' }
  | { type: 'agents.removeHooks' }
  | { type: 'dialog.pick'; field: string; target: PickTarget }
  | { type: 'terminal.create'; pane: string; shell: string; cwd: string; cols: number; rows: number; command?: string }
  | { type: 'terminal.input'; pane: string; data: string }
  | { type: 'terminal.resize'; pane: string; cols: number; rows: number }
  | { type: 'terminal.ack'; pane: string; chars: number }
  | { type: 'terminal.close'; pane: string }
  | { type: 'terminal.activity'; panes: string[]; request?: number }
  | { type: 'terminal.drop'; pane: string; shell: string }
  | { type: 'terminal.dropPath'; pane: string; shell: string; path: string }
  | { type: 'projects.list' }
  | { type: 'projects.repositories'; request: number; project: string }
  | { type: 'projects.rememberRepository'; project: string; repository: string }
  | { type: 'context.query'; pane: string; path: string }
  | { type: 'context.open'; pane: string; path: string; target: OpenTarget }
  | { type: 'link.open'; url: string }
  | { type: 'files.watch'; paths: string[] }
  | { type: 'files.refresh' }
  | { type: 'files.open'; path: string }
  | { type: 'files.openAt'; path: string; cwd?: string; line: number; column: number; alternative?: string; alternativeLine?: number; alternativeColumn?: number }
  | { type: 'files.reveal'; path: string }
  | { type: 'files.search'; path: string }
  | { type: 'files.create'; path: string; name: string; kind: EntryKind }
  | { type: 'files.rename'; path: string; parent: string; name: string }
  | { type: 'files.delete'; path: string; parent: string }
  | { type: 'window.close' }
  | { type: 'window.new' }
  | { type: 'window.closeCancel' }
  | { type: 'window.title'; title: string }
  | GitWebMessage
  | PreviewWebMessage
  | WorktreeWebMessage
  | UpdateWebMessage
  | StatusLogWebMessage
  | McpWebMessage
  | BrowserWebMessage

export type HostMessageType = HostToWebMessage['type']
export type HostMessageOf<T extends HostMessageType> = Extract<HostToWebMessage, { type: T }>
