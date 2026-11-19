// Render layer only: consumes core output, draws a meshing pair and its certificate.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gearProfile, extrudeProfile, profileArea, meshVolume, meshEdgeStats, contactRatio, undercutLimit, gearParams } from './src/core.mjs';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f14);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 5000);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 2.4));
const key = new THREE.DirectionalLight(0xffffff, 1.7);
key.position.set(1, -1, 2);
scene.add(key);
const grid = new THREE.GridHelper(120, 24, 0x2b3442, 0x1b2430);
grid.rotation.x = Math.PI / 2;
scene.add(grid);

const group = new THREE.Group();
scene.add(group);
let g1 = null, g2 = null, ratio = 1, theta = 0;

const el = (id) => document.getElementById(id);
const stats = el('stats'), uc = el('uc');

function geomFromMesh(mesh) {
  const pos = new Float32Array(mesh.faces.length * 9);
  for (let i = 0; i < mesh.faces.length; i++) {
    const f = mesh.faces[i];
    for (let k = 0; k < 3; k++) {
      const v = mesh.vertices[f[k]];
      pos[i * 9 + k * 3] = v[0]; pos[i * 9 + k * 3 + 1] = v[1]; pos[i * 9 + k * 3 + 2] = v[2];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function rebuild() {
  if (g1) { g1.geometry.dispose(); g1.material.dispose(); group.remove(g1); }
  if (g2) { g2.geometry.dispose(); g2.material.dispose(); group.remove(g2); }
  const z1 = Number(el('z1').value), z2 = Number(el('z2').value);
  const m = Number(el('m').value), alpha = Number(el('a').value);
  const p1 = gearProfile({ teeth: z1, module: m, pressureAngle: alpha, flankSamples: 24, tipSamples: 3, rootSamples: 2 });
  const p2 = gearProfile({ teeth: z2, module: m, pressureAngle: alpha, flankSamples: 24, tipSamples: 3, rootSamples: 2 });
  const mesh1 = extrudeProfile(p1.points, 6), mesh2 = extrudeProfile(p2.points, 6);
  const gp1 = p1.params, gp2 = p2.params;
  const a = gp1.r + gp2.r;
  ratio = z1 / z2;
  g1 = new THREE.Mesh(geomFromMesh(mesh1), new THREE.MeshStandardMaterial({ color: 0x58a6ff, metalness: .15, roughness: .55, flatShading: true, side: THREE.DoubleSide }));
  g2 = new THREE.Mesh(geomFromMesh(mesh2), new THREE.MeshStandardMaterial({ color: 0xffa657, metalness: .15, roughness: .55, flatShading: true, side: THREE.DoubleSide }));
  g2.position.set(a, 0, 0);
  group.add(g1, g2);
  g2.rotation.z = Math.PI - Math.PI / z2;

  const cr = contactRatio({ teeth1: z1, teeth2: z2, module: m, pressureAngle: alpha });
  const ea = profileArea(p2.points) * 6, ev = meshVolume(mesh2);
  const es = meshEdgeStats(mesh2);
  const lim = undercutLimit(alpha);
  controls.target.set(a / 2, 0, 0);
  camera.position.set(a / 2, -a * 1.25, a * 0.95);
  controls.update();
  stats.innerHTML = `
    <div class="row"><span>centre distance</span><b>${a.toFixed(3)} mm</b></div>
    <div class="row"><span>contact ratio</span><b>${cr.toFixed(5)}</b></div>
    <div class="row"><span>undercut limit</span><b>${lim.toFixed(3)} teeth</b></div>
    <div class="row"><span>profile points</span><b>${p1.points.length + p2.points.length}</b></div>
    <div class="row"><span>triangles</span><b>${mesh1.faces.length + mesh2.faces.length}</b></div>
    <div class="row"><span>wheel volume / area*t</span><b>${ev.toFixed(1)} / ${ea.toFixed(1)}</b></div>
    <div class="row"><span>boundary / non-manifold</span><b class="${es.boundary || es.nonManifold ? 'bad' : ''}">${es.boundary} / ${es.nonManifold}</b></div>`;
  const under = z1 < lim ? `pinion ${z1}T is below the ${lim.toFixed(2)}T limit: root undercut flagged` : '';
  const under2 = z2 < lim ? `wheel ${z2}T is below the ${lim.toFixed(2)}T limit: root undercut flagged` : '';
  uc.textContent = under || under2 || 'both gears above the undercut limit; radial root below the base circle is an approximation';
}

const onInput = () => { el('z1v').textContent = el('z1').value; el('z2v').textContent = el('z2').value; el('mv').textContent = Number(el('m').value).toFixed(1); el('av').textContent = Number(el('a').value).toFixed(1); rebuild(); };
for (const id of ['z1', 'z2', 'm', 'a']) el(id).oninput = onInput;

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
renderer.setAnimationLoop(() => {
  theta += 0.004;
  if (g1 && g2) { g1.rotation.z = theta; g2.rotation.z = Math.PI - Math.PI / Number(el('z2').value) - theta * ratio; }
  controls.update();
  renderer.render(scene, camera);
});

onInput();
