import path from 'node:path'

export interface AppPaths {
  userDataDir: string
  databaseFile: string
  attachmentsDir: string
  audioCacheDir: string
}

export function createAppPaths(userDataDir: string): AppPaths {
  return {
    userDataDir,
    databaseFile: path.join(userDataDir, 'japanese-assistant.sqlite'),
    attachmentsDir: path.join(userDataDir, 'attachments'),
    audioCacheDir: path.join(userDataDir, 'audio-cache'),
  }
}
