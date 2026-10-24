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
}

export type ForgeHostMessage =
  | { type: 'forge.listed'; request: number; path: string; list?: MergeRequestList; error?: string }
  | { type: 'forge.branchListed'; path: string; branch: string; result: BranchMergeRequests }

export type ForgeWebMessage =
  | { type: 'forge.list'; request: number; path: string; state: MergeRequestStateFilter }
  | { type: 'forge.branch'; path: string; branch: string; force: boolean }
