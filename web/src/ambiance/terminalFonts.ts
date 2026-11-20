const FONT_CANDIDATES = [
  'Cascadia Code', 'Cascadia Mono', 'Consolas', 'Courier New', 'Lucida Console', 'JetBrains Mono', 'Fira Code', 'Fira Mono',
  'Source Code Pro', 'Hack', 'Iosevka', 'Roboto Mono', 'Ubuntu Mono', 'DejaVu Sans Mono', 'IBM Plex Mono', 'Victor Mono',
  'Inconsolata', 'Monaspace Neon', 'Geist Mono', 'Space Mono', 'Anonymous Pro', 'Hasklig', 'MesloLGS NF',
  'CaskaydiaCove Nerd Font', 'CaskaydiaMono Nerd Font', 'JetBrainsMono Nerd Font', 'FiraCode Nerd Font', 'Hack Nerd Font',
]
const FONT_SAMPLE = 'mmmmmmmmmmlli10WQ@'
const GENERIC_FAMILIES = ['monospace', 'serif', 'sans-serif']
const MONOSPACE_PROBE = ['i', 'W', 'm', '.']
const WIDTH_TOLERANCE = 0.01

interface LocalFont {
  family: string
}

declare global {
  interface Window {
    queryLocalFonts?: () => Promise<LocalFont[]>
  }
}

let measure: CanvasRenderingContext2D | null = null

const context = (): CanvasRenderingContext2D | null => (measure ??= document.createElement('canvas').getContext('2d'))

const widthOf = (font: string): number => {
  const canvas = context()
  if (!canvas) {
    return 0
  }
  canvas.font = font
  return canvas.measureText(FONT_SAMPLE).width
}

const isInstalled = (family: string): boolean => GENERIC_FAMILIES.some((generic) => widthOf(`72px "${family}", ${generic}`) !== widthOf(`72px ${generic}`))

const isMonospace = (family: string): boolean => {
  const canvas = context()
  if (!canvas) {
    return false
  }
  canvas.font = `16px "${family}", serif`
  const widths = MONOSPACE_PROBE.map((character) => canvas.measureText(character).width)
  return widths.every((width) => Math.abs(width - widths[0]) < WIDTH_TOLERANCE)
}

const sorted = (families: Iterable<string>): string[] => [...new Set(families)].sort((first, second) => first.localeCompare(second))

export const installedTerminalFonts = (): string[] => sorted(FONT_CANDIDATES.filter(isInstalled))

export const localTerminalFonts = async (known: string[]): Promise<string[]> => {
  try {
    const local = (await window.queryLocalFonts?.()) ?? []
    return sorted([...known, ...local.map((font) => font.family).filter(isMonospace)])
  } catch {
    return known
  }
}
