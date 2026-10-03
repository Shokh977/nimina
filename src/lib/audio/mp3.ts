/**
 * Reads an MP3's first audio frame header (skipping an ID3v2 tag), for the
 * server's check that a library track really is a 128–160 kbps MP3.
 */
const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

export interface Mp3Info {
  bitrateKbps: number;
  sampleRate: number;
  channels: number;
}

export function readMp3Header(buf: Uint8Array): Mp3Info | null {
  let i = 0;
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    // ID3v2: 10-byte header, syncsafe size.
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    i = 10 + size;
  }
  for (const end = Math.min(buf.length - 4, i + 64 * 1024); i < end; i++) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) continue;
    const version = (buf[i + 1] >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    const layer = (buf[i + 1] >> 1) & 3; // 1 = Layer III
    const bitIdx = buf[i + 2] >> 4;
    const rateIdx = (buf[i + 2] >> 2) & 3;
    if (version === 1 || layer !== 1 || bitIdx === 0 || bitIdx === 15 || rateIdx === 3) continue;
    const bitrateKbps = (version === 3 ? BITRATES_V1_L3 : BITRATES_V2_L3)[bitIdx];
    return { bitrateKbps, sampleRate: RATES[version][rateIdx], channels: buf[i + 3] >> 6 === 3 ? 1 : 2 };
  }
  return null;
}
