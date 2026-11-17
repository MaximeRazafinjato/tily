export enum SettingsSection {
  Shells = 'shells',
  Terminals = 'terminals',
  Appearance = 'appearance',
  Ambiance = 'ambiance',
  Shortcuts = 'shortcuts',
  Projects = 'projects',
  Notifications = 'notifications',
  Agents = 'agents',
  Updates = 'updates',
}

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  [SettingsSection.Shells]: 'Shells et éditeur',
  [SettingsSection.Terminals]: 'Terminaux',
  [SettingsSection.Appearance]: 'Apparence',
  [SettingsSection.Ambiance]: 'Ambiance',
  [SettingsSection.Shortcuts]: 'Raccourcis clavier',
  [SettingsSection.Projects]: 'Projets et Git',
  [SettingsSection.Notifications]: 'Notifications',
  [SettingsSection.Agents]: 'Agents et MCP',
  [SettingsSection.Updates]: 'Mises à jour',
}

export const settingsTabId = (section: SettingsSection): string => `settings-tab-${section}`
