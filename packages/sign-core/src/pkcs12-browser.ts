/**
 * Zero-dependency browser/Node ASN.1 BER/DER + PKCS#12 (PBES2 AES) + RFC 5652 CMS SignedData builder
 * using standard WebCrypto (crypto.subtle). Handles BER indefinite lengths emitted by OpenSSL / Keychain.
 */

export class UnsupportedPkcs12CipherError extends Error {
  constructor(message = 'This certificate uses legacy 3DES/RC2 PKCS#12 encryption not supported natively in browsers.') {
    super(message);
    this.name = 'UnsupportedPkcs12CipherError';
  }
}

export class InvalidPkcs12PasswordError extends Error {
  constructor(message = 'Incorrect certificate password or corrupted .p12/.pfx file.') {
    super(message);
    this.name = 'InvalidPkcs12PasswordError';
  }
}

export interface ParsedPkcs12Identity {
  commonName: string;
  issuerCommonName: string;
  keyAlgorithm: 'rsa' | 'ecdsa';
  namedCurve?: 'P-256' | 'P-384';
  signerCertDer: Uint8Array;
  caCertsDer: Uint8Array[];
  privateKey: CryptoKey;
}

interface Asn1Node {
  tag: number;
  constructed: boolean;
  headerLen: number;
  contentStart: number;
  contentEnd: number;
  totalEnd: number;
  valueBytes: Uint8Array;
  rawBytes: Uint8Array;
  children?: Asn1Node[];
}

function getSubtle(): SubtleCrypto {
  const s = (globalThis as any).crypto?.subtle;
  if (!s) {
    throw new Error('WebCrypto subtle API is unavailable in this environment.');
  }
  return s as SubtleCrypto;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const a of arrays) len += a.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

function readDerNode(buf: Uint8Array, offset = 0): Asn1Node {
  if (offset >= buf.length) throw new Error('Unexpected end of ASN.1 data');
  const tag = buf[offset];
  const constructed = (tag & 0x20) !== 0;
  let pos = offset + 1;
  if (pos >= buf.length) throw new Error('Truncated ASN.1 length');
  const lenByte = buf[pos++];

  let contentStart = pos;
  let contentEnd = pos;
  let totalEnd = pos;

  if (lenByte === 0x80) {
    if (!constructed) throw new Error('Indefinite length allowed only on constructed BER items');
    const children: Asn1Node[] = [];
    let cur = pos;
    while (cur + 1 < buf.length && !(buf[cur] === 0x00 && buf[cur + 1] === 0x00)) {
      const child = readDerNode(buf, cur);
      children.push(child);
      cur = child.totalEnd;
    }
    if (cur + 1 >= buf.length || buf[cur] !== 0x00 || buf[cur + 1] !== 0x00) {
      throw new Error('Missing BER End-Of-Contents');
    }
    contentEnd = cur;
    totalEnd = cur + 2;
    return {
      tag,
      constructed,
      headerLen: pos - offset,
      contentStart,
      contentEnd,
      totalEnd,
      valueBytes: buf.subarray(contentStart, contentEnd),
      rawBytes: buf.subarray(offset, totalEnd),
      children
    };
  }

  let length = lenByte;
  if ((lenByte & 0x80) !== 0) {
    const octets = lenByte & 0x7f;
    if (octets === 0 || octets > 4 || pos + octets > buf.length) {
      throw new Error('Invalid ASN.1 definite length');
    }
    length = 0;
    for (let i = 0; i < octets; i++) {
      length = (length << 8) | buf[pos++];
    }
  }
  contentStart = pos;
  contentEnd = pos + length;
  if (contentEnd > buf.length) throw new Error('ASN.1 content exceeds buffer');
  totalEnd = contentEnd;

  const node: Asn1Node = {
    tag,
    constructed,
    headerLen: contentStart - offset,
    contentStart,
    contentEnd,
    totalEnd,
    valueBytes: buf.subarray(contentStart, contentEnd),
    rawBytes: buf.subarray(offset, totalEnd)
  };

  if (constructed) {
    const children: Asn1Node[] = [];
    let cPos = contentStart;
    while (cPos < contentEnd) {
      const ch = readDerNode(buf, cPos);
      children.push(ch);
      cPos = ch.totalEnd;
    }
    node.children = children;
  }

  return node;
}

function decodeOid(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const first = bytes[0];
  const parts = [Math.floor(first / 40), first % 40];
  let val = 0;
  for (let i = 1; i < bytes.length; i++) {
    const b = bytes[i];
    val = (val << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) {
      parts.push(val);
      val = 0;
    }
  }
  return parts.join('.');
}

function encodeOid(oid: string): Uint8Array {
  const nums = oid.split('.').map(Number);
  const out: number[] = [nums[0] * 40 + nums[1]];
  for (let i = 2; i < nums.length; i++) {
    let v = nums[i];
    if (v === 0) {
      out.push(0);
      continue;
    }
    const stack: number[] = [];
    while (v > 0) {
      stack.push(v & 0x7f);
      v >>>= 7;
    }
    for (let j = stack.length - 1; j >= 0; j--) {
      out.push(j === 0 ? stack[j] : stack[j] | 0x80);
    }
  }
  return derWrap(0x06, new Uint8Array(out));
}

function encodeDerLength(len: number): Uint8Array {
  if (len < 0x80) return new Uint8Array([len]);
  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function derWrap(tag: number, content: Uint8Array): Uint8Array {
  return concatBytes(new Uint8Array([tag]), encodeDerLength(content.length), content);
}

function derSeq(...items: Uint8Array[]): Uint8Array {
  return derWrap(0x30, concatBytes(...items));
}

function derSetSorted(items: Uint8Array[]): Uint8Array {
  const sorted = [...items].sort((a, b) => {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return a.length - b.length;
  });
  return derWrap(0x31, concatBytes(...sorted));
}

function derInt(numOrBytes: number | Uint8Array): Uint8Array {
  if (typeof numOrBytes === 'number') {
    if (numOrBytes === 0) return derWrap(0x02, new Uint8Array([0]));
    const bytes: number[] = [];
    let n = numOrBytes;
    while (n > 0) {
      bytes.unshift(n & 0xff);
      n >>>= 8;
    }
    if (bytes[0] & 0x80) bytes.unshift(0);
    return derWrap(0x02, new Uint8Array(bytes));
  }
  let start = 0;
  while (start < numOrBytes.length - 1 && numOrBytes[start] === 0) start++;
  let trimmed = numOrBytes.subarray(start);
  if (trimmed.length === 0) trimmed = new Uint8Array([0]);
  if (trimmed[0] & 0x80) {
    return derWrap(0x02, concatBytes(new Uint8Array([0]), trimmed));
  }
  return derWrap(0x02, trimmed);
}

function derNull(): Uint8Array {
  return new Uint8Array([0x05, 0x00]);
}

function extractOctetStringBytes(node: Asn1Node): Uint8Array {
  if ((node.tag & 0x1f) !== 0x04) {
    throw new Error('Expected OCTET STRING');
  }
  if (!node.constructed || !node.children) {
    return node.valueBytes;
  }
  return concatBytes(...node.children.map((c) => extractOctetStringBytes(c)));
}

function unwrapContentInfo(node: Asn1Node): { oid: string; content?: Asn1Node } {
  const ch = node.children || [];
  const oid = decodeOid(ch[0].valueBytes);
  let content: Asn1Node | undefined;
  if (ch[1] && ch[1].tag === 0xa0) {
    content = ch[1].children?.[0] || readDerNode(ch[1].valueBytes);
  }
  return { oid, content };
}

const OID_DATA = '1.2.840.113549.1.7.1';
const OID_SIGNED_DATA = '1.2.840.113549.1.7.2';
const OID_ENCRYPTED_DATA = '1.2.840.113549.1.7.6';
const OID_PBES2 = '1.2.840.113549.1.5.13';
const OID_PBKDF2 = '1.2.840.113549.1.5.12';
const OID_HMAC_SHA1 = '1.2.840.113549.2.7';
const OID_HMAC_SHA256 = '1.2.840.113549.2.9';
const OID_HMAC_SHA384 = '1.2.840.113549.2.10';
const OID_HMAC_SHA512 = '1.2.840.113549.2.11';
const OID_AES_128_CBC = '2.16.840.1.101.3.4.1.2';
const OID_AES_192_CBC = '2.16.840.1.101.3.4.1.22';
const OID_AES_256_CBC = '2.16.840.1.101.3.4.1.42';
const OID_KEY_BAG = '1.2.840.113549.1.12.10.1.1';
const OID_SHROUDED_KEY_BAG = '1.2.840.113549.1.12.10.1.2';
const OID_CERT_BAG = '1.2.840.113549.1.12.10.1.3';
const OID_X509_CERT = '1.2.840.113549.1.9.22.1';
const OID_RSA = '1.2.840.113549.1.1.1';
const OID_EC_PUBLIC = '1.2.840.10045.2.1';
const OID_SHA256 = '2.16.840.1.101.3.4.2.1';
const OID_RSA_SHA256 = '1.2.840.113549.1.1.11';
const OID_ECDSA_SHA256 = '1.2.840.10045.4.3.2';
const OID_CONTENT_TYPE = '1.2.840.113549.1.9.3';
const OID_MESSAGE_DIGEST = '1.2.840.113549.1.9.4';
const OID_SIGNING_TIME = '1.2.840.113549.1.9.5';

function readUintBigEndian(bytes: Uint8Array): number {
  let v = 0;
  for (const b of bytes) v = (v << 8) + b;
  return v;
}

async function decryptPbes2(algSeq: Asn1Node, encryptedBytes: Uint8Array, password: string): Promise<Uint8Array> {
  const kids = algSeq.children || [];
  const outerOid = decodeOid(kids[0].valueBytes);
  if (outerOid !== OID_PBES2) {
    throw new UnsupportedPkcs12CipherError(`Unsupported PKCS#12 cipher OID ${outerOid}.`);
  }
  const params = kids[1]?.children || [];
  const kdfNode = params[0];
  const encNode = params[1];
  const kdfOid = decodeOid(kdfNode.children![0].valueBytes);
  if (kdfOid !== OID_PBKDF2) {
    throw new UnsupportedPkcs12CipherError(`Unsupported KDF OID ${kdfOid}.`);
  }
  const kdfParams = kdfNode.children![1].children || [];
  const salt = kdfParams[0].valueBytes;
  const iterations = readUintBigEndian(kdfParams[1].valueBytes);
  let idx = 2;
  let explicitKeyLenBytes: number | undefined;
  if (kdfParams[idx] && kdfParams[idx].tag === 0x02) {
    explicitKeyLenBytes = readUintBigEndian(kdfParams[idx].valueBytes);
    idx++;
  }
  let prfHash: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-1';
  if (kdfParams[idx] && kdfParams[idx].children?.[0]) {
    const prfOid = decodeOid(kdfParams[idx].children![0].valueBytes);
    if (prfOid === OID_HMAC_SHA256) prfHash = 'SHA-256';
    else if (prfOid === OID_HMAC_SHA384) prfHash = 'SHA-384';
    else if (prfOid === OID_HMAC_SHA512) prfHash = 'SHA-512';
    else if (prfOid === OID_HMAC_SHA1) prfHash = 'SHA-1';
  }

  const cipherOid = decodeOid(encNode.children![0].valueBytes);
  let aesBits = 256;
  if (cipherOid === OID_AES_128_CBC) aesBits = 128;
  else if (cipherOid === OID_AES_192_CBC) aesBits = 192;
  else if (cipherOid === OID_AES_256_CBC) aesBits = 256;
  else {
    throw new UnsupportedPkcs12CipherError(`Unsupported cipher OID ${cipherOid} in PBES2.`);
  }
  if (explicitKeyLenBytes && explicitKeyLenBytes * 8 !== aesBits) {
    aesBits = explicitKeyLenBytes * 8;
  }

  const iv = encNode.children![1].valueBytes;
  const subtle = getSubtle();
  const baseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const aesKey = await subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: prfHash },
    baseKey,
    { name: 'AES-CBC', length: aesBits },
    false,
    ['decrypt']
  );
  try {
    const plain = await subtle.decrypt({ name: 'AES-CBC', iv: iv as BufferSource }, aesKey, encryptedBytes as BufferSource);
    return new Uint8Array(plain);
  } catch {
    throw new InvalidPkcs12PasswordError();
  }
}

function readRdnCommonName(rdnSeqNode: Asn1Node): string {
  const sets = rdnSeqNode.children || [];
  for (const s of sets) {
    for (const atv of s.children || []) {
      const kids = atv.children || [];
      if (kids.length >= 2 && decodeOid(kids[0].valueBytes) === '2.5.4.3') {
        return new TextDecoder().decode(kids[1].valueBytes);
      }
    }
  }
  return 'Certificate Holder';
}

function parseCertificateFields(certDer: Uint8Array) {
  const root = readDerNode(certDer);
  const tbs = root.children![0];
  const kids = tbs.children || [];
  let idx = 0;
  if (kids[idx].tag === 0xa0) idx++; // optional [0] version
  const serialNode = kids[idx++];
  idx++; // signature alg
  const issuerNode = kids[idx++];
  idx++; // validity
  const subjectNode = kids[idx++];
  const spkiNode = kids[idx];
  const spkiAlgOid = decodeOid(spkiNode.children![0].children![0].valueBytes);
  return {
    serialNumberRaw: serialNode.valueBytes,
    issuerRawDer: issuerNode.rawBytes,
    issuerCommonName: readRdnCommonName(issuerNode),
    commonName: readRdnCommonName(subjectNode),
    spkiAlgOid
  };
}

/**
 * Parses a password-protected .p12/.pfx PKCS#12 container in pure TypeScript + WebCrypto.
 * Supports PBES2 (PBKDF2 + AES-128/256-CBC). Throws `UnsupportedPkcs12CipherError` on legacy 3DES/RC2 bags.
 */
export async function parsePkcs12WithWebCrypto(p12Bytes: Uint8Array, password: string): Promise<ParsedPkcs12Identity> {
  if (!p12Bytes || p12Bytes.length < 16 || p12Bytes[0] !== 0x30) {
    throw new InvalidPkcs12PasswordError('Invalid PKCS#12 file header.');
  }

  let pfx: Asn1Node;
  try {
    pfx = readDerNode(p12Bytes);
  } catch {
    throw new InvalidPkcs12PasswordError('Malformed PKCS#12 ASN.1 structure.');
  }

  const authSafeCi = unwrapContentInfo(pfx.children![1]);
  if (authSafeCi.oid !== OID_DATA || !authSafeCi.content) {
    throw new InvalidPkcs12PasswordError('Unsupported PKCS#12 authSafe type.');
  }

  const authSafeSeq = readDerNode(extractOctetStringBytes(authSafeCi.content));
  const certs: Uint8Array[] = [];
  let pkcs8KeyDer: Uint8Array | null = null;

  for (const safeCiNode of authSafeSeq.children || []) {
    const ci = unwrapContentInfo(safeCiNode);
    let safeContentsBytes: Uint8Array;
    if (ci.oid === OID_DATA && ci.content) {
      safeContentsBytes = extractOctetStringBytes(ci.content);
    } else if (ci.oid === OID_ENCRYPTED_DATA && ci.content) {
      const encInfo = ci.content.children![1]; // EncryptedContentInfo
      const encAlg = encInfo.children![1];
      const cipherOctets = extractOctetStringBytes({ ...encInfo.children![2], tag: 0x04 });
      safeContentsBytes = await decryptPbes2(encAlg, cipherOctets, password);
    } else {
      continue;
    }

    const safeContentsSeq = readDerNode(safeContentsBytes);
    for (const bag of safeContentsSeq.children || []) {
      const bagKids = bag.children || [];
      const bagOid = decodeOid(bagKids[0].valueBytes);
      const bagVal = bagKids[1]?.children?.[0] || readDerNode(bagKids[1].valueBytes);

      if (bagOid === OID_SHROUDED_KEY_BAG) {
        const encAlg = bagVal.children![0];
        const encOctets = extractOctetStringBytes(bagVal.children![1]);
        pkcs8KeyDer = await decryptPbes2(encAlg, encOctets, password);
      } else if (bagOid === OID_KEY_BAG) {
        pkcs8KeyDer = bagVal.rawBytes;
      } else if (bagOid === OID_CERT_BAG) {
        const certTypeOid = decodeOid(bagVal.children![0].valueBytes);
        if (certTypeOid === OID_X509_CERT) {
          const certWrap = bagVal.children![1].children?.[0] || readDerNode(bagVal.children![1].valueBytes);
          certs.push(extractOctetStringBytes(certWrap));
        }
      }
    }
  }

  if (!pkcs8KeyDer || certs.length === 0) {
    throw new InvalidPkcs12PasswordError('No private key or X.509 certificate found in .p12 file.');
  }

  // Pick leaf/end-entity cert (non-CA or first cert)
  const signerCertDer = certs[0];
  const caCertsDer = certs.slice(1);
  const parsedCert = parseCertificateFields(signerCertDer);

  const subtle = getSubtle();
  let keyAlgorithm: 'rsa' | 'ecdsa' = 'rsa';
  let namedCurve: 'P-256' | 'P-384' | undefined;
  let privateKey: CryptoKey;

  if (parsedCert.spkiAlgOid === OID_EC_PUBLIC) {
    keyAlgorithm = 'ecdsa';
    namedCurve = 'P-256';
    try {
      privateKey = await subtle.importKey(
        'pkcs8',
        pkcs8KeyDer as BufferSource,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
      );
    } catch {
      namedCurve = 'P-384';
      privateKey = await subtle.importKey(
        'pkcs8',
        pkcs8KeyDer as BufferSource,
        { name: 'ECDSA', namedCurve: 'P-384' },
        false,
        ['sign']
      );
    }
  } else {
    keyAlgorithm = 'rsa';
    privateKey = await subtle.importKey(
      'pkcs8',
      pkcs8KeyDer as BufferSource,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
  }

  return {
    commonName: parsedCert.commonName,
    issuerCommonName: parsedCert.issuerCommonName,
    keyAlgorithm,
    namedCurve,
    signerCertDer,
    caCertsDer,
    privateKey
  };
}

function encodeUtcTime(date: Date): Uint8Array {
  const yy = String(date.getUTCFullYear() % 100).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return derWrap(0x17, new TextEncoder().encode(`${yy}${mm}${dd}${hh}${mi}${ss}Z`));
}

function p1363ToDerEcdsaSig(rawSig: Uint8Array): Uint8Array {
  const half = Math.floor(rawSig.length / 2);
  const r = rawSig.subarray(0, half);
  const s = rawSig.subarray(half);
  return derSeq(derInt(r), derInt(s));
}

/**
 * Builds a standards-compliant detached CMS/PKCS#7 SignedData DER payload (ISO 32000 adbe.pkcs7.detached)
 * verifiable by OpenSSL `cms -verify`, Poppler `pdfsig`, and Adobe Acrobat.
 */
export async function buildDetachedCmsSignedData(
  signedBytes: Uint8Array,
  identity: ParsedPkcs12Identity,
  signingDate = new Date()
): Promise<Uint8Array> {
  const subtle = getSubtle();
  const digestBuf = await subtle.digest('SHA-256', signedBytes as BufferSource);
  const messageDigest = new Uint8Array(digestBuf);

  const attrContentType = derSeq(encodeOid(OID_CONTENT_TYPE), derSetSorted([encodeOid(OID_DATA)]));
  const attrSigningTime = derSeq(encodeOid(OID_SIGNING_TIME), derSetSorted([encodeUtcTime(signingDate)]));
  const attrDigest = derSeq(encodeOid(OID_MESSAGE_DIGEST), derSetSorted([derWrap(0x04, messageDigest)]));

  const signedAttrsList = [attrContentType, attrSigningTime, attrDigest];
  const signedAttrsSet = derSetSorted(signedAttrsList); // tag 0x31 used for signature computation
  const signedAttrsImplicit = concatBytes(new Uint8Array([0xa0]), signedAttrsSet.subarray(1));

  let sigBytes: Uint8Array;
  let sigAlgOid: string;
  if (identity.keyAlgorithm === 'ecdsa') {
    sigAlgOid = OID_ECDSA_SHA256;
    const raw = new Uint8Array(
      await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, identity.privateKey, signedAttrsSet as BufferSource)
    );
    sigBytes = p1363ToDerEcdsaSig(raw);
  } else {
    sigAlgOid = OID_RSA_SHA256;
    sigBytes = new Uint8Array(
      await subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, identity.privateKey, signedAttrsSet as BufferSource)
    );
  }

  const certMeta = parseCertificateFields(identity.signerCertDer);
  const issuerAndSerial = derSeq(certMeta.issuerRawDer, derInt(certMeta.serialNumberRaw));
  const sha256AlgId = derSeq(encodeOid(OID_SHA256), derNull());
  const sigAlgId = identity.keyAlgorithm === 'ecdsa'
    ? derSeq(encodeOid(sigAlgOid))
    : derSeq(encodeOid(sigAlgOid), derNull());

  const signerInfo = derSeq(
    derInt(1),
    issuerAndSerial,
    sha256AlgId,
    signedAttrsImplicit,
    sigAlgId,
    derWrap(0x04, sigBytes)
  );

  const allCerts = [identity.signerCertDer, ...identity.caCertsDer];
  const certsImplicit0 = derWrap(0xa0, concatBytes(...allCerts));

  const signedData = derSeq(
    derInt(1),
    derSetSorted([sha256AlgId]),
    derSeq(encodeOid(OID_DATA)), // detached EncapsulatedContentInfo
    certsImplicit0,
    derWrap(0x31, signerInfo)
  );

  return derSeq(
    encodeOid(OID_SIGNED_DATA),
    derWrap(0xa0, signedData)
  );
}
