import crypto from 'crypto';
import { AuditEventType, AuditLogEntry } from '@paperflow/contracts';

function computeEntryHash(payload: Omit<AuditLogEntry, 'entryHash'>): string {
  const canonical = JSON.stringify({
    seq: payload.seq,
    eventType: payload.eventType,
    timestampUtc: payload.timestampUtc,
    requestId: payload.requestId,
    signerId: payload.signerId ?? null,
    signerEmail: payload.signerEmail ?? null,
    ip: payload.ip ?? null,
    userAgent: payload.userAgent ?? null,
    detail: payload.detail ?? null,
    prevHash: payload.prevHash
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export function appendAuditEntry(
  existing: AuditLogEntry[],
  event: {
    eventType: AuditEventType;
    requestId: string;
    timestampUtc?: string;
    signerId?: string;
    signerEmail?: string;
    ip?: string;
    userAgent?: string;
    detail?: string;
  }
): AuditLogEntry[] {
  const seq = existing.length + 1;
  const prevHash = existing.length > 0 ? existing[existing.length - 1].entryHash : 'GENESIS';
  const base: Omit<AuditLogEntry, 'entryHash'> = {
    seq,
    eventType: event.eventType,
    timestampUtc: event.timestampUtc || new Date().toISOString(),
    requestId: event.requestId,
    ...(event.signerId ? { signerId: event.signerId } : {}),
    ...(event.signerEmail ? { signerEmail: event.signerEmail } : {}),
    ...(event.ip ? { ip: event.ip } : {}),
    ...(event.userAgent ? { userAgent: event.userAgent } : {}),
    ...(event.detail ? { detail: event.detail } : {}),
    prevHash
  };
  const entryHash = computeEntryHash(base);
  return [...existing, { ...base, entryHash }];
}

/** Verifies every link in the hash chain; returns false if any entry was altered or reordered. */
export function verifyAuditChain(entries: AuditLogEntry[]): boolean {
  let expectedPrev = 'GENESIS';
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.seq !== i + 1) return false;
    if (e.prevHash !== expectedPrev) return false;
    const expectedHash = computeEntryHash({
      seq: e.seq,
      eventType: e.eventType,
      timestampUtc: e.timestampUtc,
      requestId: e.requestId,
      signerId: e.signerId,
      signerEmail: e.signerEmail,
      ip: e.ip,
      userAgent: e.userAgent,
      detail: e.detail,
      prevHash: e.prevHash
    });
    if (e.entryHash !== expectedHash) return false;
    expectedPrev = e.entryHash;
  }
  return true;
}

