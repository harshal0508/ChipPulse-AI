export function tempToColor(temp, minTemp = 25, maxTemp = 110) {
  const t = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));
  const lerp = (a, b, f) => Math.round(a + (b - a) * f);
  const hexToRgb = (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const rgbToHex = (r, g, b) =>
    '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  const stops = [
    [0.0, '#001a4d'], // Very Dark Blue
    [0.33, '#4a0080'], // Deep Purple
    [0.66, '#b33c00'], // Burnt Orange
    [1.0, '#660000'], // Very Dark Red
  ];
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  const f = (t - lower[0]) / (upper[0] - lower[0] || 1);
  const [r1, g1, b1] = hexToRgb(lower[1]);
  const [r2, g2, b2] = hexToRgb(upper[1]);
  return rgbToHex(lerp(r1, r2, f), lerp(g1, g2, f), lerp(b1, b2, f));
}
