import { useEffect } from 'react'
import { bridge } from '../bridge/bridge'
import type { Tab, Workspace } from '../model/session'
import { useWindowStore } from '../store/windowStore'

const TITLE_SEPARATOR = ' › '
const NO_CONTEXT = ''
const DETACHED_SUFFIX = ' (fenêtre détachée)'

export const useWindowTitle = (workspace: Workspace | undefined, tab: Tab | undefined): void => {
  const detached = useWindowStore((state) => state.detached)
  const base = workspace && tab ? `${workspace.name}${TITLE_SEPARATOR}${tab.name}` : NO_CONTEXT
  const context = detached ? `${base}${DETACHED_SUFFIX}` : base
  useEffect(() => {
    bridge.send({ type: 'window.title', title: context })
  }, [context])
}
