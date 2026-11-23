// 3D 모드 (배경 사진이 없을 때의 대체 화면): 코드로 그린 거실 + 트리
import * as THREE from 'three';
import { buildCabin } from './world/cabin.js';
import { buildTree } from './world/tree.js';
import { DecorationManager } from './world/decorations.js';
import { RoomCamera } from './world/camera.js';
import { TREE_POS } from './world/slots.js';

export function build3DView(container, { low, onPick, canInteract }) {
  const quality = { low, snow: low ? 80 : 150 };
  const renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: low ? 'low-power' : 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.25 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);
  const cabin = buildCabin(scene, { quality });
  const tree = buildTree(scene, { quality });
  const decorations = new DecorationManager(scene);
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  const cam = new RoomCamera(camera, renderer.domElement, {
    onTap: (x, y) => {
      if (!canInteract()) return;
      ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(decorations.hits, false)[0];
      if (hit) onPick(hit.object.userData.itemId);
    },
  });
  const isPortrait = () => innerWidth / innerHeight < 0.8;
  function onResize() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.fov = isPortrait() ? 62 : 50; camera.updateProjectionMatrix();
    cam.setHome(isPortrait());
  }
  addEventListener('resize', onResize); onResize(); cam.snap();

  const clock = new THREE.Clock();
  (function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    cabin.update(dt); tree.update(dt); decorations.update(dt); cam.update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  })();

  return {
    mode: '3d',
    sync: (items) => decorations.sync(items),
    highlight(id) {
      const pos = decorations.worldPos(id); if (!pos) return;
      cam.setFocus(pos, Math.atan2(pos.x - TREE_POS.x, pos.z - TREE_POS.z));
      decorations.highlight(id);
    },
    unfocus: () => cam.reset(),
    setEnabled: (v) => { cam.enabled = v; },
  };
}
