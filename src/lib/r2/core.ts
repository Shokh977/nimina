import { AwsClient } from 'aws4fetch';

/**
 * Minimal Cloudflare R2 client (R2 speaks the S3 API, signed with AWS
 * SigV4). Dependency-light and free of Next.js/server-only imports so the
 * maintenance scripts in scripts/ can use it too; app code goes through
 * src/lib/r2/server.ts, which reads the config from the environment.
 */

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Private bucket: user uploads (screenshots, icons, music, thumbnails). */
  privateBucket: string;
  /** Public bucket: template preview videos and the music library. */
  publicBucket: string;
  /** Base URL the public bucket is served from (r2.dev or a custom domain), no trailing slash. */
  publicUrl: string;
}

export interface R2Object {
  key: string;
  size: number;
  lastModified: Date;
}

export class R2 {
  private aws: AwsClient;
  private config: R2Config;

  constructor(config: R2Config) {
    this.config = config;
    this.aws = new AwsClient({ accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, service: 's3', region: 'auto' });
  }

  private objectUrl(bucket: string, key: string): string {
    const path = key.split('/').map(encodeURIComponent).join('/');
    return `https://${this.config.accountId}.r2.cloudflarestorage.com/${bucket}/${path}`;
  }

  bucketName(which: 'private' | 'public'): string {
    return which === 'private' ? this.config.privateBucket : this.config.publicBucket;
  }

  publicObjectUrl(key: string): string {
    return `${this.config.publicUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  /** A pre-signed GET URL, valid for `expiresIn` seconds. */
  async signGet(bucket: string, key: string, expiresIn = 3600): Promise<string> {
    const url = new URL(this.objectUrl(bucket, key));
    url.searchParams.set('X-Amz-Expires', String(expiresIn));
    const signed = await this.aws.sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true } });
    return signed.url;
  }

  /** A pre-signed PUT URL that only accepts exactly this Content-Type and
   * Content-Length (both are part of the signature, so R2 rejects an upload
   * that differs from what the server approved). The uploader must send
   * the returned headers unchanged. */
  async signPut(bucket: string, key: string, contentType: string, contentLength: number, expiresIn = 600): Promise<{ url: string; headers: Record<string, string> }> {
    const url = new URL(this.objectUrl(bucket, key));
    url.searchParams.set('X-Amz-Expires', String(expiresIn));
    const headers = { 'content-type': contentType, 'content-length': String(contentLength) };
    const signed = await this.aws.sign(new Request(url, { method: 'PUT', headers }), { aws: { signQuery: true, allHeaders: true } });
    return { url: signed.url, headers: { 'content-type': contentType } };
  }

  async put(bucket: string, key: string, body: BodyInit, contentType: string, cacheControl?: string): Promise<void> {
    const headers: Record<string, string> = { 'content-type': contentType };
    if (cacheControl) headers['cache-control'] = cacheControl;
    const res = await this.aws.fetch(this.objectUrl(bucket, key), { method: 'PUT', body, headers });
    if (!res.ok) throw new Error(`R2 PUT ${key} failed: ${res.status} ${await res.text()}`);
  }

  async get(bucket: string, key: string): Promise<Response> {
    return this.aws.fetch(this.objectUrl(bucket, key), { method: 'GET' });
  }

  /** Size and type of an object, or null if it doesn't exist. */
  async head(bucket: string, key: string): Promise<{ size: number; contentType: string } | null> {
    const res = await this.aws.fetch(this.objectUrl(bucket, key), { method: 'HEAD' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`R2 HEAD ${key} failed: ${res.status}`);
    return { size: Number(res.headers.get('content-length') ?? 0), contentType: res.headers.get('content-type') ?? '' };
  }

  async copy(bucket: string, fromKey: string, toKey: string): Promise<void> {
    const source = `${bucket}/${fromKey.split('/').map(encodeURIComponent).join('/')}`;
    const res = await this.aws.fetch(this.objectUrl(bucket, toKey), { method: 'PUT', headers: { 'x-amz-copy-source': source } });
    if (!res.ok) throw new Error(`R2 copy ${fromKey} -> ${toKey} failed: ${res.status} ${await res.text()}`);
  }

  async delete(bucket: string, key: string): Promise<void> {
    const res = await this.aws.fetch(this.objectUrl(bucket, key), { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE ${key} failed: ${res.status}`);
  }

  /** Every object whose key starts with `prefix` (paged through). */
  async list(bucket: string, prefix: string): Promise<R2Object[]> {
    const out: R2Object[] = [];
    let token: string | null = null;
    do {
      const url = new URL(`https://${this.config.accountId}.r2.cloudflarestorage.com/${bucket}`);
      url.searchParams.set('list-type', '2');
      url.searchParams.set('prefix', prefix);
      if (token) url.searchParams.set('continuation-token', token);
      const res = await this.aws.fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`R2 list ${prefix} failed: ${res.status} ${await res.text()}`);
      const xml = await res.text();
      for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const key = decodeXml(m[1].match(/<Key>([\s\S]*?)<\/Key>/)?.[1] ?? '');
        const size = Number(m[1].match(/<Size>(\d+)<\/Size>/)?.[1] ?? 0);
        const lastModified = new Date(m[1].match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1] ?? 0);
        if (key) out.push({ key, size, lastModified });
      }
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? decodeXml(xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? '') || null : null;
    } while (token);
    return out;
  }

  /** Deletes every object under `prefix`; returns how many. */
  async deletePrefix(bucket: string, prefix: string): Promise<number> {
    const objects = await this.list(bucket, prefix);
    for (let i = 0; i < objects.length; i += 10) {
      await Promise.all(objects.slice(i, i + 10).map((o) => this.delete(bucket, o.key)));
    }
    return objects.length;
  }
}

function decodeXml(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
