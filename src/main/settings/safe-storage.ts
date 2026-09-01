export interface SafeStorageAdapter {
  isEncryptionAvailable(): boolean
  encryptString(plain: string): Buffer
  decryptString(encrypted: Buffer): string
}

export function createMemorySafeStorage(): SafeStorageAdapter {
  const slots = new Map<string, string>()
  return {
    isEncryptionAvailable: () => true,
    encryptString(plain: string): Buffer {
      const id = crypto.randomUUID()
      slots.set(id, plain)
      return Buffer.from(id, 'utf8')
    },
    decryptString(encrypted: Buffer): string {
      const value = slots.get(encrypted.toString('utf8'))
      if (!value) {
        throw new Error('Unknown encrypted secret')
      }
      return value
    },
  }
}

export function createUnavailableSafeStorage(): SafeStorageAdapter {
  return {
    isEncryptionAvailable: () => false,
    encryptString(): Buffer {
      throw new Error('Encryption is not available')
    },
    decryptString(): string {
      throw new Error('Encryption is not available')
    },
  }
}

export function createElectronSafeStorage(safeStorage: {
  isEncryptionAvailable: () => boolean
  encryptString: (plain: string) => Buffer
  decryptString: (encrypted: Buffer) => string
}): SafeStorageAdapter {
  return {
    isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
    encryptString: (plain) => safeStorage.encryptString(plain),
    decryptString: (encrypted) => safeStorage.decryptString(encrypted),
  }
}
