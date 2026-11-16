import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WatermarkStorageService } from './watermark-storage.service';
import { WATERMARK_DEFAULT_SETTINGS, WatermarkFileSettings } from '@paperflow/contracts';

describe('WatermarkStorageService', () => {
  let service: WatermarkStorageService;

  beforeEach(() => {
    localStorage.clear();
    service = new WatermarkStorageService();
  });

  it('saves and lists presets with fallback in-memory handling', async () => {
    const settings: WatermarkFileSettings = JSON.parse(JSON.stringify(WATERMARK_DEFAULT_SETTINGS));
    settings.textConfig.text = 'PRESET 1';

    const p1 = await service.savePreset('Draft Preset', settings);
    expect(p1.id).toBeDefined();
    expect(p1.name).toBe('Draft Preset');
    expect(p1.settings.textConfig.text).toBe('PRESET 1');

    const list = await service.listPresets();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.some(p => p.id === p1.id)).toBe(true);
  });

  it('retrieves a saved preset by ID', async () => {
    const settings: WatermarkFileSettings = JSON.parse(JSON.stringify(WATERMARK_DEFAULT_SETTINGS));
    settings.textConfig.text = 'PRESET_BY_ID';

    const saved = await service.savePreset('Confidential Stamp', settings, 'data:image/png;base64,abc');
    const fetched = await service.getPreset(saved.id);

    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('Confidential Stamp');
    expect(fetched?.imageDataUrl).toBe('data:image/png;base64,abc');
    expect(fetched?.settings.textConfig.text).toBe('PRESET_BY_ID');
  });

  it('deletes a preset by ID', async () => {
    const settings = JSON.parse(JSON.stringify(WATERMARK_DEFAULT_SETTINGS));
    const saved = await service.savePreset('To Delete', settings);

    await service.deletePreset(saved.id);
    const fetched = await service.getPreset(saved.id);
    expect(fetched).toBeNull();
  });

  it('manages "Remember my settings" preference in localStorage', () => {
    expect(service.isRememberSettingsEnabled()).toBe(false);

    service.setRememberSettings(true);
    expect(service.isRememberSettingsEnabled()).toBe(true);
    expect(localStorage.getItem('pdftailor_watermark_remember_settings')).toBe('true');

    service.setRememberSettings(false);
    expect(service.isRememberSettingsEnabled()).toBe(false);
  });

  it('persists and loads last settings only when opt-in is enabled', () => {
    const settings: WatermarkFileSettings = JSON.parse(JSON.stringify(WATERMARK_DEFAULT_SETTINGS));
    settings.textConfig.text = 'REMEMBERED_TEXT';

    // Disabled by default
    service.saveLastSettings(settings);
    expect(service.getLastSettings()).toBeNull();

    // Enable remember settings
    service.setRememberSettings(true);
    service.saveLastSettings(settings);

    const loaded = service.getLastSettings();
    expect(loaded).not.toBeNull();
    expect(loaded?.textConfig.text).toBe('REMEMBERED_TEXT');

    // Disabling clears last settings
    service.setRememberSettings(false);
    expect(service.getLastSettings()).toBeNull();
  });
});
