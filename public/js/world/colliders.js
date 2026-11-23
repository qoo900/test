// 아주 단순한 2D(XZ) 충돌 처리: 원/사각형 장애물 + 이동 가능 범위
export const colliders = { circles: [], boxes: [], bounds: { minX: -17, maxX: 17, minZ: -13.6, maxZ: 17 } };

export function addCircle(x, z, r) { colliders.circles.push({ x, z, r }); }
export function addBox(minX, maxX, minZ, maxZ) { colliders.boxes.push({ minX, maxX, minZ, maxZ }); }

export function resolve(p, r = 0.4) {
  const b = colliders.bounds;
  p.x = Math.max(b.minX + r, Math.min(b.maxX - r, p.x));
  p.z = Math.max(b.minZ + r, Math.min(b.maxZ - r, p.z));
  for (const c of colliders.circles) {
    const dx = p.x - c.x, dz = p.z - c.z;
    const d = Math.hypot(dx, dz); const m = c.r + r;
    if (d < m && d > 1e-5) { p.x = c.x + (dx / d) * m; p.z = c.z + (dz / d) * m; }
  }
  for (const bx of colliders.boxes) {
    const cx = Math.max(bx.minX, Math.min(bx.maxX, p.x));
    const cz = Math.max(bx.minZ, Math.min(bx.maxZ, p.z));
    const dx = p.x - cx, dz = p.z - cz; const d = Math.hypot(dx, dz);
    if (d < r) {
      if (d > 1e-5) { p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r; }
      else { // 내부에 들어간 경우 가장 가까운 면으로 밀어냄
        const opts = [[bx.minX - r - p.x, 0], [bx.maxX + r - p.x, 0], [0, bx.minZ - r - p.z], [0, bx.maxZ + r - p.z]];
        opts.sort((a, b2) => Math.abs(a[0] + a[1]) - Math.abs(b2[0] + b2[1]));
        p.x += opts[0][0]; p.z += opts[0][1];
      }
    }
  }
  return p;
}
