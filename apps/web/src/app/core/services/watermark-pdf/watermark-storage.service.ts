import { Injectable } from '@angular/core';
import { WatermarkFileSettings, WatermarkPreset } from '@paperflow/contracts';

const DB_NAME = 'pdftailor_watermark';
const DB_VERSION = 1;
const STORE_NAME = 'presets';

const STORAGE_KEY_REMEMBER = 'pdftailor_watermark_remember_settings';
const STORAGE_KEY_LAST_SETTINGS = 'pdftailor_watermark_last_settings';

@Injectable({
  providedIn: 'root'
})
export class WatermarkStorageService {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private fallbackStore: Map<string, WatermarkPreset> = new Map();

  constructor() {}

  /**
   * Checks whether IndexedDB is supported in the current environment
   */
  isIndexedDbSupported(): boolean {
    try {
      return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
    } catch {
      return false;
    }
  }

  /**
   * Lazily opens the IndexedDB database
   */
  private getDb(): Promise<IDBDatabase | null> {
    if (!this.isIndexedDbSupported()) {
      return Promise.resolve(null);
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          const request = window.indexedDB.open(DB_NAME, DB_VERSION);

          request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
          };

          request.onsuccess = (event: Event) => {
            resolve((event.target as IDBOpenDBRequest).result);
          };

          request.onerror = () => {
            resolve(null);
          };
        } catch {
          resolve(null);
        }
      });
    }

    return this.dbPromise;
  }

  /**
   * Saves a new preset with watermark settings and optional image data
   */
  async savePreset(
    name: string,
    settings: WatermarkFileSettings,
    imageDataUrl?: string | null
  ): Promise<WatermarkPreset> {
    const trimmedName = name.trim() || 'Untitled Preset';
    const preset: WatermarkPreset = {
      id: `preset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: trimmedName,
      createdAt: Date.now(),
      settings: JSON.parse(JSON.stringify(settings)),
      imageDataUrl: imageDataUrl ?? null
    };

    const db = await this.getDb();
    if (!db) {
      this.fallbackStore.set(preset.id, preset);
      return preset;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(preset);

        req.onsuccess = () => resolve(preset);
        req.onerror = () => {
          this.fallbackStore.set(preset.id, preset);
          resolve(preset);
        };
      } catch {
        this.fallbackStore.set(preset.id, preset);
        resolve(preset);
      }
    });
  }

  /**
   * Lists all saved presets ordered by creation time descending
   */
  async listPresets(): Promise<WatermarkPreset[]> {
    const db = await this.getDb();
    if (!db) {
      return Array.from(this.fallbackStore.values()).sort((a, b) => b.createdAt - a.createdAt);
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          const list = (req.result || []) as WatermarkPreset[];
          list.sort((a, b) => b.createdAt - a.createdAt);
          resolve(list);
        };

        req.onerror = () => {
          resolve(Array.from(this.fallbackStore.values()).sort((a, b) => b.createdAt - a.createdAt));
        };
      } catch {
        resolve(Array.from(this.fallbackStore.values()).sort((a, b) => b.createdAt - a.createdAt));
      }
    });
  }

  /**
   * Retrieves a single preset by ID
   */
  async getPreset(id: string): Promise<WatermarkPreset | null> {
    const db = await this.getDb();
    if (!db) {
      return this.fallbackStore.get(id) || null;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);

        req.onsuccess = () => resolve((req.result as WatermarkPreset) || null);
        req.onerror = () => resolve(this.fallbackStore.get(id) || null);
      } catch {
        resolve(this.fallbackStore.get(id) || null);
      }
    });
  }

  /**
   * Deletes a preset by ID
   */
  async deletePreset(id: string): Promise<void> {
    this.fallbackStore.delete(id);

    const db = await this.getDb();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);

        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Checks whether the user opted in to remembering their settings
   */
  isRememberSettingsEnabled(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      return window.localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Sets the user's opt-in choice for remembering settings
   */
  setRememberSettings(enabled: boolean): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(STORAGE_KEY_REMEMBER, enabled ? 'true' : 'false');
      if (!enabled) {
        this.clearLastSettings();
      }
    } catch {}
  }

  /**
   * Retrieves the last saved settings from localStorage if enabled
   */
  getLastSettings(): WatermarkFileSettings | null {
    if (!this.isRememberSettingsEnabled()) return null;
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const raw = window.localStorage.getItem(STORAGE_KEY_LAST_SETTINGS);
      if (!raw) return null;
      return JSON.parse(raw) as WatermarkFileSettings;
    } catch {
      return null;
    }
  }

  /**
   * Persists the current settings to localStorage if "remember settings" is enabled
   */
  saveLastSettings(settings: WatermarkFileSettings): void {
    if (!this.isRememberSettingsEnabled()) return;
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(STORAGE_KEY_LAST_SETTINGS, JSON.stringify(settings));
    } catch {}
  }

  /**
   * Clears saved last settings from localStorage
   */
  clearLastSettings(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.removeItem(STORAGE_KEY_LAST_SETTINGS);
    } catch {}
  }
}
