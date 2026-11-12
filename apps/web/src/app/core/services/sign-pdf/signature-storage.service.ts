import { Injectable, signal } from '@angular/core';
import { SignStampSource } from '@paperflow/contracts';
import { SavedSignatureRecord, SignatureDialogKind } from './sign-pdf.models';

const DB_NAME = 'pdftailor-sign-db';
const DB_VERSION = 2;
const STORE_NAME = 'signatures';
const STAMPS_STORE_NAME = 'stamps';
const REMEMBER_NAME_KEY = 'pdftailor.sign.rememberedName';
const DEFAULT_STAMP_KEY = 'pdftailor.sign.defaultStampId';

export interface SavedStampRecord {
  id: string;
  source: SignStampSource;
  imageDataUrl: string;
  label?: string;
  isDefault?: boolean;
  created: number;
}

@Injectable({
  providedIn: 'root'
})
export class SignatureStorageService {
  readonly isUnavailable = signal<boolean>(false);
  readonly unavailableReason = signal<string | null>(null);

  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        this.markUnavailable('IndexedDB is unavailable in this environment.');
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('byKind', 'kind', { unique: false });
          }
          if (!db.objectStoreNames.contains(STAMPS_STORE_NAME)) {
            db.createObjectStore(STAMPS_STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          this.markUnavailable('Signature storage is disabled in private/restricted browser mode.');
          reject(req.error || new Error('Failed to open signature store'));
        };
      } catch (err) {
        this.markUnavailable('Signature storage is unavailable in this browser session.');
        reject(err);
      }
    });

    return this.dbPromise;
  }

  private markUnavailable(reason: string): void {
    this.isUnavailable.set(true);
    this.unavailableReason.set(reason);
  }

  async list(kind?: SignatureDialogKind): Promise<SavedSignatureRecord[]> {
    try {
      const db = await this.openDb();
      return await new Promise<SavedSignatureRecord[]>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = kind ? store.index('byKind').getAll(kind) : store.getAll();
        req.onsuccess = () => {
          const rows = (req.result || []) as SavedSignatureRecord[];
          resolve(rows.sort((a, b) => b.created - a.created));
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async save(record: SavedSignatureRecord): Promise<boolean> {
    try {
      const db = await this.openDb();
      return await new Promise<boolean>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({
          id: record.id,
          kind: record.kind,
          pngBlob: record.pngBlob,
          label: record.label,
          created: record.created
        });
        req.onsuccess = () => resolve(true);
        req.onerror = () => {
          this.markUnavailable('Could not persist signature on this device (private mode quota/restriction).');
          resolve(false);
        };
      });
    } catch {
      return false;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const db = await this.openDb();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {
      // Silently ignore unavailable storage
    }
  }

  async listStamps(): Promise<SavedStampRecord[]> {
    try {
      const db = await this.openDb();
      return await new Promise<SavedStampRecord[]>((resolve) => {
        const tx = db.transaction(STAMPS_STORE_NAME, 'readonly');
        const store = tx.objectStore(STAMPS_STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const rows = (req.result || []) as SavedStampRecord[];
          const defaultId = this.getDefaultStampId();
          const mapped = rows.map(r => ({
            ...r,
            isDefault: r.id === defaultId
          }));
          resolve(mapped.sort((a, b) => b.created - a.created));
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async saveStamp(record: SavedStampRecord): Promise<boolean> {
    try {
      const db = await this.openDb();
      const success = await new Promise<boolean>((resolve) => {
        const tx = db.transaction(STAMPS_STORE_NAME, 'readwrite');
        const store = tx.objectStore(STAMPS_STORE_NAME);
        const req = store.put({
          id: record.id,
          source: record.source,
          imageDataUrl: record.imageDataUrl,
          label: record.label || 'Company stamp',
          created: record.created || Date.now()
        });
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
      if (success && record.isDefault) {
        this.setDefaultStampId(record.id);
      }
      return success;
    } catch {
      return false;
    }
  }

  async deleteStamp(id: string): Promise<void> {
    try {
      const db = await this.openDb();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STAMPS_STORE_NAME, 'readwrite');
        const req = tx.objectStore(STAMPS_STORE_NAME).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
      if (this.getDefaultStampId() === id) {
        this.clearDefaultStampId();
      }
    } catch {
      // Silently ignore
    }
  }

  getDefaultStampId(): string | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(DEFAULT_STAMP_KEY) : null;
    } catch {
      return null;
    }
  }

  setDefaultStampId(id: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DEFAULT_STAMP_KEY, id);
      }
    } catch {
      // Ignore
    }
  }

  clearDefaultStampId(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(DEFAULT_STAMP_KEY);
      }
    } catch {
      // Ignore
    }
  }

  async getDefaultStamp(): Promise<SavedStampRecord | null> {
    const defaultId = this.getDefaultStampId();
    const stamps = await this.listStamps();
    if (!stamps.length) return null;
    if (defaultId) {
      const found = stamps.find(s => s.id === defaultId);
      if (found) return found;
    }
    return stamps[0];
  }

  async clearAll(): Promise<void> {
    this.forgetSignerName();
    try {
      const db = await this.openDb();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {
      // Silently ignore unavailable storage
    }
  }

  getRememberedSignerName(): string {
    try {
      return typeof localStorage !== 'undefined' ? (localStorage.getItem(REMEMBER_NAME_KEY) || '') : '';
    } catch {
      return '';
    }
  }

  setRememberedSignerName(name: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(REMEMBER_NAME_KEY, name);
      }
    } catch {
      // Silently ignore private-mode storage restrictions
    }
  }

  forgetSignerName(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(REMEMBER_NAME_KEY);
      }
    } catch {
      // Ignore
    }
  }
}

