import { useState } from 'react'

export function useReleaseToggles(latestVersion: string | undefined) {
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set())

  const isExpanded = (version: string): boolean => toggled.has(version) !== (version === latestVersion)
  const toggle = (version: string) =>
    setToggled((previous) => {
      const next = new Set(previous)
      if (!next.delete(version)) {
        next.add(version)
      }
      return next
    })

  return { isExpanded, toggle }
}
