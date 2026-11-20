import { AgentState, type PaneAgent } from '../bridge/messages'
import { hexToRgb } from '../ambiance/renderPacing'
import { findPane, folderName } from '../model/session'
import { useAgentStore } from '../store/agentStore'
import { projectKey, useAppearanceStore } from '../store/appearanceStore'
import { useSessionStore } from '../store/sessionStore'
import { BlobMood, createBlob, hashOf, removeBlob, setMood, type Blob, type World } from './blobModel'

const MOODS: Record<AgentState, BlobMood> = {
  [AgentState.Working]: BlobMood.Working,
  [AgentState.Waiting]: BlobMood.Waiting,
  [AgentState.Done]: BlobMood.Done,
  [AgentState.Error]: BlobMood.Error,
  [AgentState.Unknown]: BlobMood.Idle,
}

const MCP_TOOL = /^mcp__([^_]+(?:_[^_]+)*)__/

export const toolLabel = (tool: string | undefined): string => (tool ? (MCP_TOOL.exec(tool)?.[1] ?? tool) : '')

const hueOfHex = (hex: string): number => {
  const [red, green, blue] = hexToRgb(hex).map((channel) => channel / 255)
  const max = Math.max(red, green, blue)
  const delta = max - Math.min(red, green, blue)
  if (delta === 0) {
    return 0
  }
  const sector = max === red ? ((green - blue) / delta + 6) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4
  return sector * 60
}

const pathOf = (paneId: string): string | undefined => {
  const { session } = useSessionStore.getState()
  return session ? findPane(session, paneId)?.path : undefined
}

const hueOf = (paneId: string): number => {
  const path = pathOf(paneId)
  const color = path ? useAppearanceStore.getState().projects[projectKey(path)]?.color : undefined
  return color ? hueOfHex(color) : hashOf(paneId) % 360
}

const moodOf = (agent: PaneAgent): BlobMood => (agent.state === AgentState.Done && agent.interrupted ? BlobMood.Idle : MOODS[agent.state])

const syncChildren = (world: World, blob: Blob, agent: PaneAgent): void => {
  const subagents = agent.subagents ?? []
  const ids = new Set(subagents.map((subagent) => subagent.id))
  blob.children.filter((child) => !ids.has(child.key)).forEach((child) => {
    child.leaving = true
  })
  subagents.forEach((subagent) => {
    const existing = blob.children.find((child) => child.key === subagent.id)
    const child = existing ?? createBlob(world, subagent.id, agent.paneId, (blob.hue + (hashOf(subagent.id) % 50) - 25 + 360) % 360, blob)
    if (!existing) {
      blob.children.push(child)
      world.blobs.push(child)
    }
    child.name = subagent.type
    child.tool = toolLabel(subagent.tool)
  })
}

export const syncCompanions = (world: World): void => {
  const { agents } = useAgentStore.getState()
  world.blobs
    .filter((blob) => !blob.parent && !agents[blob.paneId])
    .forEach((blob) => {
      blob.leaving = true
      blob.children.forEach((child) => {
        child.leaving = true
      })
    })
  Object.values(agents).forEach((agent) => {
    const existing = world.blobs.find((blob) => !blob.parent && blob.paneId === agent.paneId && !blob.leaving)
    const blob = existing ?? createBlob(world, agent.paneId, agent.paneId, hueOf(agent.paneId), null)
    const mood = moodOf(agent)
    if (!existing) {
      world.blobs.push(blob)
      blob.reported = mood
      blob.mood = mood === BlobMood.Done ? BlobMood.Idle : mood
    }
    blob.hue = hueOf(agent.paneId)
    blob.name = folderName(pathOf(agent.paneId) ?? '')
    blob.tool = toolLabel(agent.tool)
    if (blob.reported !== mood) {
      blob.reported = mood
      setMood(world, blob, mood)
    }
    syncChildren(world, blob, agent)
  })
}

export const clearCompanions = (world: World): void => {
  world.blobs.filter((blob) => !blob.parent).forEach((blob) => removeBlob(world, blob))
  world.particles = []
}
