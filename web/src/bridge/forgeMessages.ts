export enum ForgeKind {
  GitHub = 'github',
  GitLab = 'gitlab',
}

export enum MergeRequestState {
  Open = 'open',
  Merged = 'merged',
  Closed = 'closed',
}

export enum MergeRequestStateFilter {
  Open = 'open',
  Merged = 'merged',
  Closed = 'closed',
  All = 'all',
}

export enum MergeRequestReview {
  None = 'none',
  Approved = 'approved',
  ChangesRequested = 'changesRequested',
  ReviewRequired = 'reviewRequired',
}

export interface ForgeRemote {
  kind: ForgeKind
  host: string
  project: string
  webUrl: string
}

export interface ForgeUser {
  login: string
  name: string
}

export interface MergeRequest {
  number: number
  reference: string
  title: string
  state: MergeRequestState
  draft: boolean
  review: MergeRequestReview
  author: ForgeUser
  assignees: ForgeUser[]
  reviewers: ForgeUser[]
  labels: string[]
  sourceBranch: string
  targetBranch: string
  url: string
  createdAt: string
  updatedAt: string
}

export interface MergeRequestList {
  forge: ForgeRemote
  items: MergeRequest[]
  truncated: boolean
  currentUser?: string
}

export interface BranchMergeRequests {
  forge?: ForgeRemote
  items: MergeRequest[]
  error?: string
  creatable?: boolean
}

export interface ForgeLabel {
  name: string
  color: string
  description: string
}

export interface MergeRequestInput {
  sourceBranch: string
  targetBranch: string
  title: string
  description: string
  reviewers: string[]
  assignee: string | null
  labels: string[]
  draft: boolean
}

export interface MergeRequestCreated {
  number: number
  reference: string
  url: string
  warnings: string[]
}

export interface BranchPublication {
  local: boolean
  published: boolean
  ahead: number
  needsPush: boolean
}

export interface MergeRequestBranchInfo {
  source: string
  target: string
  publication: BranchPublication
  commits: number
  title: string
  description: string
  existing: MergeRequest[]
  error?: string
}

export interface MergeRequestFormData {
  forge: ForgeRemote
  root: string
  currentUser?: string
  members: ForgeUser[]
  labels: ForgeLabel[]
  sourceBranches: string[]
  targetBranches: string[]
  defaultTarget: string
  branch: MergeRequestBranchInfo
  warnings: string[]
}

export type ForgeHostMessage =
  | { type: 'forge.listed'; request: number; path: string; list?: MergeRequestList; error?: string }
  | { type: 'forge.branchListed'; path: string; branch: string; result: BranchMergeRequests }
  | { type: 'forge.formLoaded'; request: number; path: string; form?: MergeRequestFormData; error?: string }
  | { type: 'forge.compared'; request: number; path: string; branch?: MergeRequestBranchInfo; error?: string }
  | { type: 'forge.created'; request: number; path: string; source?: string; created?: MergeRequestCreated; error?: string }

export type ForgeWebMessage =
  | { type: 'forge.list'; request: number; path: string; state: MergeRequestStateFilter }
  | { type: 'forge.branch'; path: string; branch: string; force: boolean }
  | { type: 'forge.form'; request: number; path: string; branch?: string }
  | { type: 'forge.compare'; request: number; path: string; branch: string; target: string }
  | { type: 'forge.create'; request: number; path: string; push: boolean; mergeRequest: MergeRequestInput }
