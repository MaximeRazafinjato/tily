import { AmbianceGradientType } from '../bridge/appearanceMessages'

export const VERTEX_SHADER = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }'

export const SHADER_COMMON = `
  precision highp float;
  uniform vec2 R;
  uniform float T;
  uniform float P;
  uniform vec3 C[3];
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
    return v;
  }
  float stars(vec2 fragment, float density) {
    float h = hash(floor(fragment / 2.0));
    return step(1.0 - density, h) * (0.5 + 0.5 * sin(T * 3.0 + h * 100.0));
  }`

export const SHADERS: Partial<Record<AmbianceGradientType, string>> = {
  [AmbianceGradientType.Aurora]: `
    void main() {
      vec2 uv = gl_FragCoord.xy / R;
      float x = uv.x * R.x / R.y;
      vec3 col = mix(vec3(0.01, 0.02, 0.06), vec3(0.02, 0.04, 0.12), uv.y);
      col += stars(gl_FragCoord.xy, 0.004) * uv.y * 0.9;
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float y = 0.5 + 0.12 * fi + 0.07 * sin(x * 1.6 + T * 0.3 + fi * 2.0) + 0.12 * fbm(vec2(x * 1.5 + T * 0.08, fi * 4.0));
        float curtain = fbm(vec2(x * 9.0 + T * 0.5, fi * 7.0 + T * 0.1));
        vec3 tint = mix(mix(vec3(0.1, 1.0, 0.55), vec3(0.55, 0.3, 1.0), fi / 2.0), C[i], P);
        float up = uv.y - y;
        col += tint * exp(-up * up * 220.0) * curtain * 1.1;
        col += tint * step(0.0, up) * exp(-up * 5.0) * fbm(vec2(x * 16.0, T * 0.3 + fi)) * 0.45;
      }
      col += mix(vec3(0.02, 0.08, 0.06), C[0] * 0.08, P) * smoothstep(0.35, 0.0, uv.y);
      gl_FragColor = vec4(col, 1.0);
    }`,
  [AmbianceGradientType.Nebula]: `
    void main() {
      vec2 p = (gl_FragCoord.xy - 0.5 * R) / R.y * 2.5;
      vec2 q = vec2(fbm(p + T * 0.03), fbm(p + vec2(5.2, 1.3) - T * 0.02));
      vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + T * 0.05), fbm(p + 4.0 * q + vec2(8.3, 2.8)));
      float f = fbm(p + 4.0 * r);
      vec3 col = mix(vec3(0.05, 0.0, 0.15), mix(vec3(0.7, 0.1, 0.55), C[0], P), clamp(f * f * 2.2, 0.0, 1.0));
      col = mix(col, mix(vec3(0.1, 0.45, 0.9), C[1], P), clamp(length(q), 0.0, 1.0) * 0.5);
      col = mix(col, mix(vec3(1.0, 0.75, 0.45), C[2], P), clamp(r.x * r.x * 0.7, 0.0, 1.0) * 0.45);
      col *= f * 1.6;
      col += stars(gl_FragCoord.xy, 0.006) * 0.8;
      gl_FragColor = vec4(col, 1.0);
    }`,
  [AmbianceGradientType.Sky]: `
    uniform float D;
    void main() {
      vec2 uv = gl_FragCoord.xy / R;
      float aspect = R.x / R.y;
      float elevation = sin((D - 0.25) * 6.2832);
      float daylight = smoothstep(-0.1, 0.3, elevation);
      float sunset = exp(-pow(elevation * 4.0, 2.0));
      vec3 top = mix(vec3(0.01, 0.02, 0.06), vec3(0.15, 0.4, 0.85), daylight);
      vec3 bottom = mix(vec3(0.03, 0.05, 0.12), vec3(0.6, 0.8, 1.0), daylight);
      bottom = mix(bottom, vec3(1.0, 0.45, 0.2), sunset * 0.85);
      top = mix(top, vec3(0.25, 0.15, 0.4), sunset * 0.5);
      vec3 col = mix(bottom, top, uv.y);
      col += stars(gl_FragCoord.xy, 0.004) * (1.0 - daylight) * uv.y;
      vec2 sun = vec2(clamp((D - 0.25) / 0.5, -0.2, 1.2) * 0.9 + 0.05, 0.1 + 0.75 * max(elevation, -0.3));
      float d = length((uv - sun) * vec2(aspect, 1.0));
      vec3 sunColor = mix(vec3(1.0, 0.55, 0.3), vec3(1.0, 0.95, 0.8), daylight);
      col += sunColor * (smoothstep(0.05, 0.045, d) + 0.3 * exp(-d * 6.0)) * step(-0.15, elevation);
      float cloud = fbm(vec2(uv.x * 3.0 * aspect + T * 0.05, uv.y * 7.0));
      float cover = smoothstep(0.5, 0.8, cloud) * smoothstep(0.25, 0.65, uv.y);
      vec3 cloudColor = mix(mix(vec3(0.08, 0.08, 0.12), vec3(1.0), daylight), vec3(1.0, 0.55, 0.4), sunset * 0.7);
      col = mix(col, cloudColor, cover * 0.8);
      gl_FragColor = vec4(col, 1.0);
    }`,
  [AmbianceGradientType.Caustics]: `
    void main() {
      vec2 uv = gl_FragCoord.xy / R;
      vec2 p = mod(uv * vec2(R.x / R.y, 1.0) * 6.2832 * 1.2, 6.2832) - 250.0;
      vec2 i = p;
      float c = 1.0;
      for (int n = 0; n < 5; n++) {
        float t = T * 0.3 * (1.0 - 3.5 / float(n + 1));
        i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
        c += 1.0 / length(vec2(p.x / (sin(i.x + t) / 0.005), p.y / (cos(i.y + t) / 0.005)));
      }
      c /= 5.0;
      c = 1.17 - pow(c, 1.4);
      float light = pow(abs(c), 8.0);
      vec3 water = mix(vec3(0.0, 0.08, 0.2), vec3(0.0, 0.35, 0.5), uv.y);
      water = mix(water, mix(C[1] * 0.15, C[1] * 0.5, uv.y), P);
      gl_FragColor = vec4(clamp(water + light * mix(vec3(0.7, 0.95, 1.0), C[0], P), 0.0, 1.0), 1.0);
    }`,
}
