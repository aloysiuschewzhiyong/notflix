import { createHash } from "crypto";

// Port of samples/challenge/cinesrc.py (stage 1) and solve_stage2 from
// samples/cinesrc.py in the EncDecEndpoints repo. cinesrc gates its API behind
// two proof-of-work challenges.

const u32 = (x: number) => x >>> 0;
const imul = (a: number, b: number) => Math.imul(a, b) >>> 0;
const rotl = (x: number, n: number) => {
  n &= 31;
  if (n === 0) return u32(x);
  return u32((x << n) | (x >>> (32 - n)));
};

function b64urlToBuffer(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function build(w: number[], m: number): Uint32Array {
  const s = new Uint32Array(4096);
  let x = u32(w[m & 3] ^ u32(imul(m, 0x9e3779b1) - 0x61c8864f) ^ 0xa5a5a5a5);
  let y = 0x85ebca6b;

  for (let i = 0; i < 4096; i++) {
    x = u32(x + y + w[i & 3]);
    x = u32(x ^ (x << 13));
    x = u32(x ^ (x >>> 17));
    x = u32(x ^ (x << 5));
    s[i] = u32(x + imul(i ^ m, 0xc2b2ae35) + rotl(w[(i + m) & 3], i + m));
    y = u32(y - 0x7a143595);
  }
  return s;
}

function mix(w: number[], s: Uint32Array, m: number, n: number) {
  const lo = n >>> 0;
  const hi = Math.floor(n / 4294967296) >>> 0;

  let a = u32(w[0] ^ imul(m + 1, 0x27d4eb2d) ^ lo);
  let b = u32(w[2] ^ rotl(lo, m + 5));
  let c = u32(hi ^ (w[1] ^ 0x165667b1));
  let d = u32(w[3] ^ rotl(u32(lo ^ hi), m + 11));

  let y = 2667;
  for (let r = 1; r < 9; r++) {
    const v = s[(imul(c, 2481) ^ rotl(b, r) ^ y ^ a) & 4095];
    const op = ((r + m - 1) & 7) - 1;

    if (op === -1) {
      a = rotl(u32(a + d + v), 5);
      c = u32(imul(a ^ c, 0x9e3779b1) + b);
    } else if (op === 0) {
      b = rotl(u32(b ^ c ^ v), 11);
      d = u32(imul(b ^ a, 0x85ebca6b) + d);
    } else if (op === 1) {
      c = rotl(u32(b + c + v), 17);
      a = u32(imul(c ^ d, 0xc2b2ae35) ^ a);
    } else if (op === 2) {
      d = rotl(u32(a ^ d ^ v), 23);
      b = u32(imul(d ^ c, 0x27d4eb2d) + b);
    } else if (op === 3) {
      a = u32(imul(a ^ v, 0x165667b1) + rotl(b, 7));
      d = u32(rotl(u32(a + c), 13) ^ d);
    } else if (op === 4) {
      c = u32(imul(u32(v + c), 0xd3a2646c) ^ rotl(d, 9));
      b = u32(rotl(c ^ a, 19) + b);
    } else if (op === 5) {
      b = u32(imul(b ^ v, 0xfd7046c5) + rotl(a, 3));
      c = u32(rotl(u32(b + d), 15) ^ c);
    } else {
      d = u32(imul(u32(d + v), 0xb55a4f09) ^ rotl(c, 21));
      a = u32(rotl(d ^ b, 27) + a);
    }
    y += 2667;
  }
  return { lo, hi, a, c, b, d };
}

function hasLeadingZeroBits(h: Buffer, bits: number): boolean {
  const q = bits >> 3;
  const r = bits & 7;
  for (let i = 0; i < q; i++) if (h[i]) return false;
  return r === 0 || h[q] >> (8 - r) === 0;
}

export function solveStage1(data: { w: string }): string {
  const b = b64urlToBuffer(data.w);
  const difficulty = b[5];
  const m = b[6];
  const w = [b.readUInt32LE(8), b.readUInt32LE(12), b.readUInt32LE(16), b.readUInt32LE(20)];
  const s = build(w, m);

  const msg = Buffer.alloc(42);
  b.copy(msg, 0, 8, 24);
  msg[40] = 2;
  msg[41] = m;

  for (let n = 0; ; n++) {
    const { lo, hi, a, c, b: b2, d } = mix(w, s, m, n);
    msg.writeUInt32LE(lo, 16);
    msg.writeUInt32LE(hi, 20);
    msg.writeUInt32LE(a, 24);
    msg.writeUInt32LE(c, 28);
    msg.writeUInt32LE(b2, 32);
    msg.writeUInt32LE(d, 36);

    const h = createHash("sha256").update(msg).digest();
    if (hasLeadingZeroBits(h, difficulty)) return `m2.${n.toString(16)}`;
  }
}

export function solveStage2(data: { pack: string[] }): string {
  const rev = (s: string) => s.split("").reverse().join("");
  const target = rev(data.pack[0]);
  const salt = rev(data.pack[3]);
  const r = rev(data.pack[4]);

  const decode = (s: string) => b64urlToBuffer(s).toString();
  const body = decode(r.split(".")[1]);
  const payload = decode(body.slice(body.indexOf(".") + 1));
  const difficulty: number = JSON.parse(payload).d;

  const width = (difficulty + 3) >> 2;
  const limit = 2 ** difficulty;
  for (let counter = 0; counter < limit; counter++) {
    const key = counter.toString(16).padStart(width, "0");
    if (createHash("sha256").update(salt + key).digest("hex") === target) return key;
  }
  throw new Error("cinesrc: no stage 2 solution found");
}
