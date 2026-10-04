export interface AppSettings {
  sfxEnabled: boolean;
  blueTearsEnabled: boolean;
}

export const defaultAppSettings: AppSettings = {
  sfxEnabled: true,
  blueTearsEnabled: true,
};

const storageKey = 'sound-space-settings';

export function loadAppSettings(storage: Pick<Storage, 'getItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage) {
  if (!storage) return { ...defaultAppSettings };
  try {
    const parsed = JSON.parse(storage.getItem(storageKey) ?? '{}') as Partial<AppSettings>;
    return {
      sfxEnabled: typeof parsed.sfxEnabled === 'boolean' ? parsed.sfxEnabled : defaultAppSettings.sfxEnabled,
      blueTearsEnabled: typeof parsed.blueTearsEnabled === 'boolean' ? parsed.blueTearsEnabled : defaultAppSettings.blueTearsEnabled,
    };
  } catch {
    return { ...defaultAppSettings };
  }
}

export function saveAppSettings(settings: AppSettings, storage: Pick<Storage, 'setItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage) {
  try {
    storage?.setItem(storageKey, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable in private browsing; runtime settings still work.
  }
}
