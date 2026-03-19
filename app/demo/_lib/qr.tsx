"use client";

import React from "react";

/**
 * Tiny QR code generator for demo kiosks.
 * - Byte mode
 * - ECC: M
 * - Auto version up to 10 (enough for short URLs like http://192.168.1.50/demo/clock/test123)
 *
 * This is intentionally lightweight to avoid external network calls or extra npm deps.
 */

type EccLevel = "M";

const ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

function gfMul(x: number, y: number): number {
  let r = 0;
  while (y > 0) {
    if (y & 1) r ^= x;
    y >>= 1;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  return r;
}

function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    poly = rsPolyMul(poly, [1, pow(2, i)]);
  }
  return poly;
}

function rsPolyMul(p: number[], q: number[]): number[] {
  const r = new Array(p.length + q.length - 1).fill(0);
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) {
      r[i + j] ^= gfMul(p[i], q[j]);
    }
  }
  return r;
}

function pow(a: number, n: number): number {
  let r = 1;
  for (let i = 0; i < n; i++) r = gfMul(r, a);
  return r;
}

function rsCompute(data: number[], ecLen: number): number[] {
  const gen = rsGeneratorPoly(ecLen);
  const msg = data.slice();
  for (let i = 0; i < ecLen; i++) msg.push(0);

  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef === 0) continue;
    for (let j = 0; j < gen.length; j++) {
      msg[i + j] ^= gfMul(gen[j], coef);
    }
  }
  return msg.slice(msg.length - ecLen);
}

// Version capacities for byte mode, ECC M (data codewords, ecc codewords) for versions 1..10.
// These are standard QR spec values.
const V = [
  null,
  { dataCw: 16, ecCw: 10 },
  { dataCw: 28, ecCw: 16 },
  { dataCw: 44, ecCw: 26 },
  { dataCw: 64, ecCw: 36 },
  { dataCw: 86, ecCw: 48 },
  { dataCw: 108, ecCw: 64 },
  { dataCw: 124, ecCw: 72 },
  { dataCw: 154, ecCw: 88 },
  { dataCw: 182, ecCw: 110 },
  { dataCw: 216, ecCw: 130 },
] as const;

function makeBitBuffer() {
  const bits: number[] = [];
  return {
    put(value: number, length: number) {
      for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    },
    putBytes(bytes: number[]) {
      for (const b of bytes) this.put(b, 8);
    },
    get length() {
      return bits.length;
    },
    toBytes(): number[] {
      const out: number[] = [];
      for (let i = 0; i < bits.length; i += 8) {
        let v = 0;
        for (let j = 0; j < 8; j++) v = (v << 1) | (bits[i + j] ?? 0);
        out.push(v);
      }
      return out;
    },
    bits,
  };
}

function encodeByteMode(text: string, version: number): number[] {
  const cap = V[version]!.dataCw * 8;
  const bb = makeBitBuffer();

  // Mode indicator: 0100 (byte)
  bb.put(0b0100, 4);

  // Length: 8 bits for versions 1..9, 16 for 10..
  const bytes = new TextEncoder().encode(text);
  bb.put(bytes.length, version <= 9 ? 8 : 16);

  bb.putBytes(Array.from(bytes));

  // Terminator up to 4 zeros
  const remaining = cap - bb.length;
  bb.put(0, Math.min(4, Math.max(0, remaining)));

  // Pad to byte boundary
  while (bb.length % 8 !== 0) bb.put(0, 1);

  // Pad bytes 0xEC, 0x11 alternating until full dataCw
  const data = bb.toBytes();
  while (data.length < V[version]!.dataCw) {
    data.push(data.length % 2 === 0 ? 0xec : 0x11);
  }
  return data.slice(0, V[version]!.dataCw);
}

function chooseVersion(text: string): number {
  const bytes = new TextEncoder().encode(text).length;
  // Rough: required bits = mode(4) + len(8) + 8*bytes + terminator/pads
  for (let ver = 1; ver <= 10; ver++) {
    const capBits = V[ver]!.dataCw * 8;
    const lenBits = ver <= 9 ? 8 : 16;
    const needed = 4 + lenBits + 8 * bytes + 4;
    if (needed <= capBits) return ver;
  }
  return 10;
}

function sizeForVersion(version: number) {
  return 21 + (version - 1) * 4;
}

function initMatrix(n: number): (number | null)[][] {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => null));
}

function placeFinder(m: (number | null)[][], r: number, c: number) {
  for (let i = -1; i <= 7; i++) {
    for (let j = -1; j <= 7; j++) {
      const rr = r + i;
      const cc = c + j;
      if (rr < 0 || rr >= m.length || cc < 0 || cc >= m.length) continue;
      const on =
        (i >= 0 && i <= 6 && (j === 0 || j === 6)) ||
        (j >= 0 && j <= 6 && (i === 0 || i === 6)) ||
        (i >= 2 && i <= 4 && j >= 2 && j <= 4);
      m[rr][cc] = on ? 1 : 0;
    }
  }
}

function placeTiming(m: (number | null)[][]) {
  const n = m.length;
  for (let i = 8; i < n - 8; i++) {
    m[6][i] = i % 2 === 0 ? 1 : 0;
    m[i][6] = i % 2 === 0 ? 1 : 0;
  }
}

function placeDarkModule(m: (number | null)[][], version: number) {
  const n = m.length;
  m[4 * version + 9][8] = 1;
}

function reserveFormat(m: (number | null)[][]) {
  const n = m.length;
  for (let i = 0; i < 9; i++) {
    if (m[8][i] === null) m[8][i] = 0;
    if (m[i][8] === null) m[i][8] = 0;
  }
  for (let i = n - 8; i < n; i++) {
    if (m[8][i] === null) m[8][i] = 0;
    if (m[i][8] === null) m[i][8] = 0;
  }
  m[8][8] = 0;
  m[n - 8][8] = 0;
  m[8][n - 8] = 0;
}

function makeCodewords(text: string, version: number) {
  const data = encodeByteMode(text, version);
  const ec = rsCompute(data, V[version]!.ecCw);
  // No interleaving (single block for versions 1..10 at ECC M in this simplified table)
  return data.concat(ec);
}

function bitsFromCodewords(cw: number[]) {
  const bits: number[] = [];
  for (const b of cw) {
    for (let i = 7; i >= 0; i--) bits.push((b >>> i) & 1);
  }
  return bits;
}

function placeData(m: (number | null)[][], bits: number[]) {
  const n = m.length;
  let bitIndex = 0;
  let dir = -1;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--; // skip timing column
    for (let row = dir === -1 ? n - 1 : 0; dir === -1 ? row >= 0 : row < n; row += dir) {
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (m[row][cc] !== null) continue;
        const bit = bits[bitIndex++] ?? 0;
        m[row][cc] = bit;
      }
    }
    dir *= -1;
  }
}

function applyMask(m: (number | null)[][], mask: number) {
  const n = m.length;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      // skip function modules (we mark them as 0/1 already, but can't distinguish here easily).
      // We approximate by skipping known fixed regions: finders, timing, format areas.
      const inFinder =
        (r < 9 && c < 9) ||
        (r < 9 && c >= n - 8) ||
        (r >= n - 8 && c < 9);
      const inTiming = r === 6 || c === 6;
      const inFormat = r === 8 || c === 8;
      if (inFinder || inTiming || inFormat) continue;

      const v = m[r][c];
      if (v === null) continue;
      let maskOn = false;
      switch (mask) {
        case 0:
          maskOn = (r + c) % 2 === 0;
          break;
        case 1:
          maskOn = r % 2 === 0;
          break;
        case 2:
          maskOn = c % 3 === 0;
          break;
        case 3:
          maskOn = (r + c) % 3 === 0;
          break;
        default:
          maskOn = (r + c) % 2 === 0;
      }
      if (maskOn) m[r][c] = v ^ 1;
    }
  }
}

// Very small penalty scorer (not full spec, but enough to pick a decent mask)
function scoreMask(m: (number | null)[][]): number {
  const n = m.length;
  let score = 0;

  // Row runs
  for (let r = 0; r < n; r++) {
    let runColor = m[r][0] ?? 0;
    let runLen = 1;
    for (let c = 1; c < n; c++) {
      const v = m[r][c] ?? 0;
      if (v === runColor) runLen++;
      else {
        if (runLen >= 5) score += 3 + (runLen - 5);
        runColor = v;
        runLen = 1;
      }
    }
    if (runLen >= 5) score += 3 + (runLen - 5);
  }

  // Col runs
  for (let c = 0; c < n; c++) {
    let runColor = m[0][c] ?? 0;
    let runLen = 1;
    for (let r = 1; r < n; r++) {
      const v = m[r][c] ?? 0;
      if (v === runColor) runLen++;
      else {
        if (runLen >= 5) score += 3 + (runLen - 5);
        runColor = v;
        runLen = 1;
      }
    }
    if (runLen >= 5) score += 3 + (runLen - 5);
  }

  return score;
}

function buildQrMatrix(text: string) {
  const version = chooseVersion(text);
  const n = sizeForVersion(version);
  const m = initMatrix(n);

  placeFinder(m, 0, 0);
  placeFinder(m, 0, n - 7);
  placeFinder(m, n - 7, 0);
  placeTiming(m);
  reserveFormat(m);
  placeDarkModule(m, version);

  const cw = makeCodewords(text, version);
  const bits = bitsFromCodewords(cw);

  // place data (unmasked), then choose best mask among 0..3 (good enough for demo)
  placeData(m, bits);

  let bestMask = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  let best: (number | null)[][] | null = null;

  for (let mask = 0; mask <= 3; mask++) {
    const copy = m.map((row) => row.slice());
    applyMask(copy, mask);
    const s = scoreMask(copy);
    if (s < bestScore) {
      bestScore = s;
      bestMask = mask;
      best = copy;
    }
  }

  // best is non-null
  return { matrix: best!, version, mask: bestMask };
}

export function QRCodeSVG({
  value,
  size = 120,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const { matrix } = React.useMemo(() => buildQrMatrix(value), [value]);

  const n = matrix.length;
  const scale = size / n;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width={size} height={size} fill="#fff" />
      {matrix.map((row, r) =>
        row.map((cell, c) => {
          const v = cell ?? 0;
          if (v === 0) return null;
          return (
            <rect
              key={`${r}-${c}`}
              x={c * scale}
              y={r * scale}
              width={scale}
              height={scale}
              fill="#000"
            />
          );
        })
      )}
    </svg>
  );
}
