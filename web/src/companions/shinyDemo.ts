let requested = false

export const requestShinyDemo = (): void => {
  requested = true
}

export const shinyDemoRequested = (): boolean => requested

export const takeShinyDemo = (): boolean => {
  const taken = requested
  requested = false
  return taken
}
