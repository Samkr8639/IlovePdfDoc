import { TestBed } from '@angular/core/testing';
import { UploadConsentService, UploadConsentOptions } from './upload-consent.service';
import { ServerActionGuard } from '../guards/server-action.guard';

describe('UploadConsentService', () => {
  let service: UploadConsentService;
  let guard: ServerActionGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [UploadConsentService, ServerActionGuard]
    });
    service = TestBed.inject(UploadConsentService);
    guard = TestBed.inject(ServerActionGuard);
    guard.revokeConsent('test-action');
  });

  afterEach(() => {
    guard.revokeConsent('test-action');
  });

  it('should be created and initialized with null state', () => {
    expect(service).toBeTruthy();
    expect(service.state()).toBeNull();
  });

  it('should immediately resolve true without opening dialog if consent is already recorded', async () => {
    guard.recordConsent('test-action');
    const options: UploadConsentOptions = {
      actionId: 'test-action',
      pageCountDescription: '1 page'
    };

    const result = await service.ask(options);
    expect(result).toBe(true);
    expect(service.state()).toBeNull();
  });

  it('should open dialog and resolve true when user confirms', async () => {
    const options: UploadConsentOptions = {
      actionId: 'test-action',
      pageCountDescription: '2 pages of this PDF'
    };

    const askPromise = service.ask(options);
    expect(service.state()?.isOpen).toBe(true);
    expect(service.state()?.options.pageCountDescription).toBe('2 pages of this PDF');

    service.confirm(false);
    const result = await askPromise;
    expect(result).toBe(true);
    expect(guard.hasConsent('test-action')).toBe(true);
    expect(service.state()).toBeNull();
  });

  it('should open dialog and resolve false when user cancels', async () => {
    const options: UploadConsentOptions = {
      actionId: 'test-action',
      pageCountDescription: '1 page'
    };

    const askPromise = service.ask(options);
    expect(service.state()?.isOpen).toBe(true);

    service.cancel();
    const result = await askPromise;
    expect(result).toBe(false);
    expect(guard.hasConsent('test-action')).toBe(false);
    expect(service.state()).toBeNull();
  });
});
