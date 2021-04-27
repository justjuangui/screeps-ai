function hex(c: any): any {
    let s = "0123456789abcdef";
    let i = parseInt(c);
    if (i == 0 || isNaN(c)) {
        return "00";
    }

    i = Math.round(Math.min(Math.max(0, i), 255));
    return s.charAt((i - i % 16) / 16) + s.charAt(i % 16);
}

function convertToHex(rgb: any[]) {
    return hex(rgb[0]) + hex(rgb[1]) + hex(rgb[2]);
}

function myTrim(s: string) {
    return (s.charAt(0) == '#') ? s.substring(1, 7) : s;
}
function convertToRGB(hex: string): any[] {
    let color: number[] = [];

    color[0] = parseInt((myTrim(hex)).substring(0, 2), 16);
    color[1] = parseInt((myTrim(hex)).substring(2, 4), 16);
    color[2] = parseInt((myTrim(hex)).substring(4, 6), 16);

    return color;
}

export function generateColors(colorStart: string, colorEnd: string, colorCount: number): string[] {
    let start = convertToRGB(colorStart);
    let end = convertToRGB(colorEnd);
    let len = colorCount;

    let alpha = 0.0;
    let result: string[] = [];

    for (let i = 0; i < len; i++) {
        let tmp: number[] = [];
        alpha += (1.0 / len);

        tmp[0] = start[0] * alpha + (1 - alpha) * end[0];
        tmp[1] = start[1] * alpha + (1 - alpha) * end[1];
        tmp[2] = start[2] * alpha + (1 - alpha) * end[2];

        result.push("#" + convertToHex(tmp));
    }

    return result;
}
