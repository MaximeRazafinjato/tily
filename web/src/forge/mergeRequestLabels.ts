import { ForgeKind, MergeRequestReview, MergeRequestState, type ForgeUser, type MergeRequest } from '../bridge/forgeMessages'
import { relativeDate } from '../git/gitLabels'

const STATE_LABELS: Record<MergeRequestState, string> = {
  [MergeRequestState.Open]: 'Ouverte',
  [MergeRequestState.Merged]: 'Fusionnée',
  [MergeRequestState.Closed]: 'Fermée',
}

const REVIEW_LABELS: Record<MergeRequestReview, string | null> = {
  [MergeRequestReview.None]: null,
  [MergeRequestReview.Approved]: 'approuvée',
  [MergeRequestReview.ChangesRequested]: 'modifications demandées',
  [MergeRequestReview.ReviewRequired]: 'revue requise',
}

const OPEN_TONES: Record<MergeRequestReview, string> = {
  [MergeRequestReview.None]: 'text-tily-green-deep',
  [MergeRequestReview.Approved]: 'text-tily-green',
  [MergeRequestReview.ChangesRequested]: 'text-tily-error',
  [MergeRequestReview.ReviewRequired]: 'text-tily-warning',
}

export const MERGE_REQUEST_LINK_HINT = 'Ouvrir dans le navigateur'

export const kindNoun = (kind: ForgeKind | undefined): string => {
  if (kind === undefined) {
    return 'MR/PR'
  }
  return kind === ForgeKind.GitHub ? 'PR' : 'MR'
}

export const sectionTitle = (kind: ForgeKind | undefined): string => {
  if (kind === undefined) {
    return 'MR/PR'
  }
  return kind === ForgeKind.GitHub ? 'Pull requests' : 'Merge requests'
}

export const statusText = (item: MergeRequest): string => {
  if (item.state === MergeRequestState.Open && item.draft) {
    return 'Brouillon'
  }
  const review = item.state === MergeRequestState.Open ? REVIEW_LABELS[item.review] : null
  return review ? `${STATE_LABELS[item.state]}, ${review}` : STATE_LABELS[item.state]
}

export const reviewBadge = (item: MergeRequest): string | null => {
  if (item.draft) {
    return 'Brouillon'
  }
  const review = REVIEW_LABELS[item.review]
  return review ? `${review.charAt(0).toUpperCase()}${review.slice(1)}` : null
}

export const statusTone = (item: MergeRequest): string => {
  if (item.state === MergeRequestState.Merged) {
    return 'text-tily-forge-merged'
  }
  if (item.state === MergeRequestState.Closed || item.draft) {
    return 'text-tily-muted'
  }
  return OPEN_TONES[item.review]
}

export const updatedText = (item: MergeRequest): string => relativeDate(Date.parse(item.updatedAt) / 1000, true)

const userList = (users: ForgeUser[]): string => users.map((user) => user.name).join(', ')

export const mergeRequestTip = (item: MergeRequest): string =>
  [
    `${item.reference} · ${item.title}`,
    statusText(item),
    `${item.sourceBranch} → ${item.targetBranch}`,
    `par ${item.author.name}`,
    item.assignees.length > 0 ? `assignée à ${userList(item.assignees)}` : 'non assignée',
    item.reviewers.length > 0 ? `reviewers : ${userList(item.reviewers)}` : null,
    item.labels.length > 0 ? `labels : ${item.labels.join(', ')}` : null,
    `mise à jour ${updatedText(item)}`,
  ]
    .filter(Boolean)
    .join(' · ')
