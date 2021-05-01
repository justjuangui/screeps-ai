function hex(c: string): string {
  const s = "0123456789abcdef";
  let i = parseInt(c, 16);
  if (i === 0 || isNaN(i)) {
    return "00";
  }

  i = Math.round(Math.min(Math.max(0, i), 255));
  return s.charAt((i - (i % 16)) / 16) + s.charAt(i % 16);
}

function convertToHex(rgb: any[]) {
  return hex(rgb[0]) + hex(rgb[1]) + hex(rgb[2]);
}

function myTrim(s: string) {
  return s.charAt(0) === "#" ? s.substring(1, 7) : s;
}

function convertToRGB(hexVar: string): any[] {
  const color: number[] = [];

  color[0] = parseInt(myTrim(hexVar).substring(0, 2), 16);
  color[1] = parseInt(myTrim(hexVar).substring(2, 4), 16);
  color[2] = parseInt(myTrim(hexVar).substring(4, 6), 16);

  return color;
}

export function generateColors(colorStart: string, colorEnd: string, colorCount: number): string[] {
  const start = convertToRGB(colorStart);
  const end = convertToRGB(colorEnd);
  const len = colorCount;

  let alpha = 0.0;
  const result: string[] = [];

  for (let i = 0; i < len; i++) {
    const tmp: number[] = [];
    alpha += 1.0 / len;

    tmp[0] = start[0] * alpha + (1 - alpha) * end[0];
    tmp[1] = start[1] * alpha + (1 - alpha) * end[1];
    tmp[2] = start[2] * alpha + (1 - alpha) * end[2];

    result.push("#" + convertToHex(tmp));
  }

  return result;
}
