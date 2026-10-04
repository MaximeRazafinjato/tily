export enum PaneKind {
  Browser = 'browser',
}

export enum BrowserViewport {
  Desktop = 'desktop',
  Mobile = 'mobile',
}

export const BLANK_PAGE = 'about:blank'
export const BROWSER_LABEL = 'Navigateur'

export const pageName = (url: string | undefined, title?: string): string => {
  const trimmed = title?.trim()
  if (trimmed) {
    return trimmed
  }
  if (!url || url === BLANK_PAGE) {
    return BROWSER_LABEL
  }
  try {
    const address = new URL(url)
    return address.host || address.pathname.split('/').pop() || BROWSER_LABEL
  } catch {
    return BROWSER_LABEL
  }
}

export const displayedAddress = (url: string | undefined): string => (!url || url === BLANK_PAGE ? '' : url)
