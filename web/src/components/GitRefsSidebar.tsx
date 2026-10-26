import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { GitRefKind, type GitBranch, type GitRemoteBranch, type GitState, type GitStash, type GitTag } from '../bridge/gitMessages'
import type { Worktree } from '../bridge/worktreeMessages'
import { branchTree, splitPinnedBranches, visibleBranches, type GitBranchFolder } from '../git/gitBranchTree'
import { shortSha } from '../git/gitLabels'
import { branchMenu, remoteBranchMenu, stashMenu, tagMenu, worktreeMenu, worktreeOfBranch } from '../git/gitMenus'
import { folderName } from '../model/session'
import { openWorktree, openWorktreeDialog, requestWorktreeRemoval } from '../worktree/worktreeActions'
import { sameFolder } from '../worktree/worktreePaths'
import { promptNewBranch, promptNewTag, promptStash, switchToBranch, switchToRemote } from '../git/gitRefActions'
import { applyRefSelection, deleteSelectedRefs, GitRefScope, refKey, refMenu, selectAllRefs } from '../git/gitRefSelection'
import { openGitMenu, revealCommit } from '../git/gitRequests'
import { GitSelectMode } from '../git/gitRows'
import { useGitStore } from '../store/gitStore'
import type { ActionMenuItem } from './ActionMenu'
import { GitAheadBehind } from './GitAheadBehind'
import { GitRefFolder } from './GitRefFolder'
import { GitRefRow } from './GitRefRow'
import { GitSection } from './GitSection'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { ROW_ACTION } from './rightPanelStyles'
import { Command } from '../keyboard/commands'
import { shortcutText, withShortcut } from '../keyboard/shortcutLabels'

interface GitRefsSidebarProps {
  state: GitState
  width: number
}

const LOCAL = GitRefScope.Local
const REMOTE = GitRefScope.Remote
const TAGS = GitRefScope.Tags
const STASHES = GitRefScope.Stashes
const WORKTREES = GitRefScope.Worktrees
const ROW_SELECTOR = '[data-git-row]'

const localKey = (branch: GitBranch) => refKey(LOCAL, branch.name)
const remoteKey = (branch: GitRemoteBranch) => refKey(REMOTE, branch.name)
const tagKey = (tag: GitTag) => refKey(TAGS, tag.name)
const stashKey = (stash: GitStash) => refKey(STASHES, stash.sha)
const worktreeKey = (worktree: Worktree) => refKey(WORKTREES, worktree.path)
const groupKey = (remote: string) => `${REMOTE}:${remote}`
const folderKey = (scope: string, path: string) => `${scope}/${path}`
const INITIALLY_COLLAPSED: Record<string, boolean> = { [REMOTE]: true, [TAGS]: true, [STASHES]: true, [WORKTREES]: true }

const branchMeta = (branch: GitBranch): ReactNode => {
  if (branch.gone) {
    return 'supprimée'
  }
  return branch.ahead > 0 || branch.behind > 0 ? <GitAheadBehind ahead={branch.ahead} behind={branch.behind} /> : undefined
}

const branchTip = (branch: GitBranch): string => {
  if (branch.gone) {
    return `${branch.name} : la branche distante suivie ${branch.upstream ?? ''} a été supprimée`
  }
  const tracking = branch.upstream ? `suit ${branch.upstream}` : 'aucune branche distante suivie'
  return `${branch.name} · ${tracking}`
}

const worktreeMeta = (worktree: Worktree): string => [worktree.branch ?? 'détachée', worktree.locked && 'verrouillé', worktree.prunable && 'prunable'].filter(Boolean).join(' · ')

const worktreeTip = (worktree: Worktree): string =>
  [worktree.isMain ? 'Dépôt principal' : 'Worktree', worktree.path, worktree.branch ? `branche ${worktree.branch}` : 'HEAD détachée'].join(' · ')

export function GitRefsSidebar({ state, width }: GitRefsSidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(INITIALLY_COLLAPSED)
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({})
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const selection = useGitStore((store) => store.refSelection.keys)
  const containerRef = useRef<HTMLDivElement>(null)
  const { pinned, localTree } = useMemo(() => {
    const split = splitPinnedBranches(state.branches)
    return { pinned: split.pinned, localTree: branchTree(split.others, (branch) => branch.name) }
  }, [state.branches])
  const groups = useMemo(
    () =>
      state.remotes
        .map((remote) => {
          const branches = state.remoteBranches.filter((branch) => branch.remote === remote)
          return { remote, count: branches.length, tree: branchTree(branches, (branch) => branch.branch) }
        })
        .filter((group) => group.count > 0),
    [state.remotes, state.remoteBranches],
  )
  const singleRemote = groups.length === 1 ? groups[0] : undefined
  const isCollapsed = (scope: string) => (path: string) => !openFolders[folderKey(scope, path)]
  const groupOpen = (remote: string) => singleRemote !== undefined || !collapsed[groupKey(remote)]
  const keys = [
    ...(collapsed[LOCAL] ? [] : [...pinned.map(localKey), ...visibleBranches(localTree, isCollapsed(LOCAL)).map(localKey)]),
    ...(collapsed[REMOTE] ? [] : groups.flatMap((group) => (groupOpen(group.remote) ? visibleBranches(group.tree, isCollapsed(groupKey(group.remote))).map(remoteKey) : []))),
    ...(collapsed[TAGS] ? [] : state.tags.map(tagKey)),
    ...(collapsed[STASHES] ? [] : state.stashes.map(stashKey)),
    ...(collapsed[WORKTREES] ? [] : state.worktrees.map(worktreeKey)),
  ]
  const focusable = keys.find((key) => key === focusKey) ?? keys[0]
  const clean = state.stagedTotal + state.unstagedTotal === 0

  const rows = (): HTMLElement[] => Array.from(containerRef.current?.querySelectorAll<HTMLElement>(ROW_SELECTOR) ?? [])
  const toggle = (section: string) => () => setCollapsed((current) => ({ ...current, [section]: !current[section] }))
  const toggleFolder = (key: string) => () => setOpenFolders((current) => ({ ...current, [key]: !current[key] }))
  const openMenu = (key: string, label: string, items: ActionMenuItem[]) => (x: number, y: number) =>
    openGitMenu({ x, y, ...refMenu(key, { label, items }), restoreFocus: () => rows().find((row) => row.dataset.gitRow === key)?.focus() })
  const pick = (key: string, sha: string | undefined) => (mode: GitSelectMode) => {
    applyRefSelection(keys, key, mode)
    if (mode === GitSelectMode.Replace && sha) {
      revealCommit(sha)
    }
  }
  const moveFocus = (all: HTMLElement[], position: number, extend: boolean) => {
    const target = all[Math.min(Math.max(position, 0), all.length - 1)]
    const key = target?.dataset.gitRow
    setFocusKey(key ?? null)
    target?.focus()
    if (key) {
      applyRefSelection(keys, key, extend ? GitSelectMode.Range : GitSelectMode.Replace)
    }
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const all = rows()
    const index = all.indexOf(event.target as HTMLElement)
    const current = all[index]?.dataset.gitRow
    const moves: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: all.length - 1 }
    if (!current) {
      return
    }
    if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'a') {
      selectAllRefs(keys, current)
    } else if (event.key === 'Delete' && current.startsWith(refKey(WORKTREES, ''))) {
      const worktree = state.worktrees.find((candidate) => worktreeKey(candidate) === current)
      if (worktree && !worktree.isMain) {
        requestWorktreeRemoval(worktree.path, worktree.branch)
      }
    } else if (event.key === 'Delete') {
      deleteSelectedRefs(current)
    } else if (event.key in moves) {
      moveFocus(all, moves[event.key], event.shiftKey)
    } else {
      return
    }
    event.preventDefault()
    event.stopPropagation()
  }
  const handleNewBranch = () => promptNewBranch()
  const handleNewTag = () => promptNewTag()
  const handleNewWorktree = () => openWorktreeDialog(state.root)

  const renderBranch = (branch: GitBranch, label: string, depth: number) => {
    const key = localKey(branch)
    const worktree = worktreeOfBranch(branch.name, state)
    const linked = worktree && !branch.current ? worktree : undefined
    const handleActivate = () => {
      if (!branch.current) {
        switchToBranch(branch)
      }
    }
    return (
      <GitRefRow
        key={key}
        rowKey={key}
        name={label}
        depth={depth}
        meta={branchMeta(branch)}
        metaIcon={linked ? IconName.Worktree : undefined}
        metaTip={linked ? `Checkout dans le worktree ${linked.path}` : branch.upstream ? `↑ à push, ↓ à pull depuis ${branch.upstream}` : undefined}
        tip={branchTip(branch)}
        current={branch.current}
        selected={selection.has(key)}
        focusable={key === focusable}
        handle={{ kind: GitRefKind.Branch, name: branch.name }}
        refName={branch.name}
        onFocus={setFocusKey}
        onSelect={pick(key, branch.sha)}
        onActivate={handleActivate}
        onMenu={openMenu(key, `Actions de ${branch.name}`, branchMenu(branch, state))}
      />
    )
  }
  const renderRemoteBranch = (branch: GitRemoteBranch, label: string, depth: number) => {
    const key = remoteKey(branch)
    const handleActivate = () => switchToRemote(branch)
    return (
      <GitRefRow
        key={key}
        rowKey={key}
        name={label}
        tip={branch.name}
        depth={depth}
        selected={selection.has(key)}
        focusable={key === focusable}
        handle={{ kind: GitRefKind.Remote, name: branch.name }}
        refName={branch.name}
        onFocus={setFocusKey}
        onSelect={pick(key, branch.sha)}
        onActivate={handleActivate}
        onMenu={openMenu(key, `Actions de ${branch.name}`, remoteBranchMenu(branch, state))}
      />
    )
  }
  const renderTree = <T,>(folder: GitBranchFolder<T>, scope: string, depth: number, renderLeaf: (item: T, label: string, depth: number) => ReactNode): ReactNode[] => [
    ...folder.folders.map((child) => {
      const key = folderKey(scope, child.path)
      return (
        <div key={key} className="flex flex-col">
          <GitRefFolder name={child.name} path={child.path} count={child.count} depth={depth} expanded={openFolders[key] === true} onToggle={toggleFolder(key)} />
          {openFolders[key] && renderTree(child, scope, depth + 1, renderLeaf)}
        </div>
      )
    }),
    ...folder.leaves.map((leaf) => renderLeaf(leaf.item, leaf.label, depth)),
  ]
  const renderTag = (tag: GitTag) => {
    const key = tagKey(tag)
    const handleShow = () => revealCommit(tag.sha)
    return (
      <GitRefRow
        key={key}
        rowKey={key}
        name={tag.name}
        meta={shortSha(tag.sha)}
        refName={tag.name}
        tip={`Tag ${tag.name}`}
        selected={selection.has(key)}
        focusable={key === focusable}
        onFocus={setFocusKey}
        onSelect={pick(key, tag.sha)}
        onActivate={handleShow}
        onMenu={openMenu(key, `Actions du tag ${tag.name}`, tagMenu(tag, state))}
      />
    )
  }
  const renderStash = (stash: GitStash) => {
    const key = stashKey(stash)
    const handleShow = () => revealCommit(stash.sha)
    return (
      <GitRefRow
        key={key}
        rowKey={key}
        name={stash.message}
        meta={`stash@{${stash.index}}`}
        tip={stash.message}
        refName={stash.sha}
        selected={selection.has(key)}
        focusable={key === focusable}
        onFocus={setFocusKey}
        onSelect={pick(key, stash.sha)}
        onActivate={handleShow}
        onMenu={openMenu(key, 'Actions du stash', stashMenu(stash, state))}
      />
    )
  }

  const renderWorktree = (worktree: Worktree) => {
    const key = worktreeKey(worktree)
    const name = folderName(worktree.path)
    const handleOpen = () => openWorktree(worktree.path)
    return (
      <GitRefRow
        key={key}
        rowKey={key}
        name={name}
        meta={worktreeMeta(worktree)}
        tip={worktreeTip(worktree)}
        current={sameFolder(state.root, worktree.path)}
        selected={selection.has(key)}
        focusable={key === focusable}
        onFocus={setFocusKey}
        onSelect={pick(key, worktree.head)}
        onActivate={handleOpen}
        onMenu={openMenu(key, `Actions du worktree ${name}`, worktreeMenu(worktree))}
      />
    )
  }

  const headerButton = (icon: IconName, label: string, onClick: () => void, disabled = false) => {
    const handleClick = () => {
      if (!disabled) {
        onClick()
      }
    }
    return (
      <button type="button" className={`${ROW_ACTION} aria-disabled:cursor-default aria-disabled:opacity-40`} aria-label={label} aria-disabled={disabled} data-tip={label} onClick={handleClick}>
        <Icon name={icon} />
      </button>
    )
  }

  return (
    <div ref={containerRef} role="listbox" aria-label="Branches, tags et stash" aria-multiselectable="true" className="min-h-0 shrink-0 overflow-x-hidden overflow-y-auto py-[4px]" style={{ width }} onKeyDown={handleKeyDown}>
      {state.branches.length > 0 && (
        <GitSection title="Locales" count={state.branches.length} expanded={!collapsed[LOCAL]} onToggle={toggle(LOCAL)} actions={headerButton(IconName.Plus, 'Nouvelle branche depuis HEAD', handleNewBranch, state.head.unborn)}>
          {pinned.map((branch) => renderBranch(branch, branch.name, 0))}
          {renderTree(localTree, LOCAL, 0, renderBranch)}
        </GitSection>
      )}
      {state.remoteBranches.length > 0 && (
        <GitSection title="Distantes" count={state.remoteBranches.length} tip={singleRemote?.remote} expanded={!collapsed[REMOTE]} onToggle={toggle(REMOTE)}>
          {singleRemote
            ? renderTree(singleRemote.tree, groupKey(singleRemote.remote), 0, renderRemoteBranch)
            : groups.map((group) => (
                <GitSection key={group.remote} title={group.remote} count={group.count} nested expanded={!collapsed[groupKey(group.remote)]} onToggle={toggle(groupKey(group.remote))}>
                  {renderTree(group.tree, groupKey(group.remote), 1, renderRemoteBranch)}
                </GitSection>
              ))}
        </GitSection>
      )}
      {state.tags.length > 0 && (
        <GitSection title="Tags" count={state.tags.length} expanded={!collapsed[TAGS]} onToggle={toggle(TAGS)} actions={headerButton(IconName.Plus, 'Nouveau tag sur HEAD', handleNewTag, state.head.unborn)}>
          {state.tags.map(renderTag)}
        </GitSection>
      )}
      {state.stashes.length > 0 && (
        <GitSection title="Stash" count={state.stashes.length} expanded={!collapsed[STASHES]} onToggle={toggle(STASHES)} actions={headerButton(IconName.Stash, clean ? 'Aucune modification à stash' : 'Stash des modifications', promptStash, clean)}>
          {state.stashes.map(renderStash)}
        </GitSection>
      )}
      {state.worktrees.length > 0 && (
        <GitSection title="Worktrees" count={state.worktrees.length} expanded={!collapsed[WORKTREES]} onToggle={toggle(WORKTREES)} actions={headerButton(IconName.Plus, withShortcut('Créer un worktree', shortcutText(Command.CreateWorktree)), handleNewWorktree)}>
          {state.worktrees.map(renderWorktree)}
        </GitSection>
      )}
    </div>
  )
}
