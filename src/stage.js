import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PIVOT, CLIPS, CONE, ELASTIC, SWERVE_SECONDS, pose, swerve } from './mechanism.js';
import { Fuel, RUNS } from './fuel.js';
import { egg, spunInPlace, EGG_SECONDS, EGG_AREA } from './egg.js';
import { Crash } from './crash.js';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

THREE.Mesh.prototype.raycast = acceleratedRaycast;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SATURATION = 1.6; // 1 = CAD colors as exported
const CLEAR = 0.22; // opacity multiplier for polycarbonate parts
const CLEAR_BY = { intake: 0.95 }; // per-subsystem overrides of CLEAR
const GHOST = 0.07; // opacity dimmed subsystems settle at
const CHANGED = 'vec3(0.29, 0.87, 0.5)'; // parts new since another event: the page accent, #4ade80
const EXPLODE_MS = 2200;
// moves every part by shift + (part centre - subsystem centre) * spread; shared by color, depth pre-pass and shadow
const v2 = (p) => `vec2(${p.map((n) => n.toFixed(5)).join(', ')})`;
const explodeVertex = (s, u) => {
  Object.assign(s.uniforms, u);
  s.vertexShader = s.vertexShader
    .replace('void main() {', `attribute vec4 _center;
      attribute float _changed;
      varying float vChanged;
      uniform vec3 uShift, uSpread, uOrigin, uLift;
      uniform vec4 uPivot;
      uniform vec3 uMove;
      uniform float uUnit, uSpin;
      uniform vec4 uDrive;
      uniform mat4 uEgg;
      uniform vec3 uGear;
      varying float vEgg;
      vec2 swing(vec2 p, float a) { return vec2(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a)); }
      vec3 about(vec3 p, vec3 k, float a) { return p * cos(a) + cross(k, p) * sin(a) + k * dot(k, p) * (1.0 - cos(a)); }
      void main() {
      float code = floor(_center.w * 32.767 + 0.5), spinId = floor(code / 10.0), rigId = code - spinId * 10.0;
      vEgg = rigId > 5.5 && rigId < 6.5 ? 1.0 : 0.0;
      vChanged = _changed;
      float spinBy = uSpin * (spinId < 0.5 ? 0.0 : spinId < 1.5 ? 1.0 : spinId < 2.5 ? -1.0 : -4.07);
      // swerve: the axle points out from the robot's centre in the rest pose
      vec2 side = sign(_center.xz);
      vec3 axle = normalize(vec3(side.x, 0.0, side.y));
      float steerBy = uDrive.x * 0.785398 * side.x * side.y, rollBy = rigId > 4.5 ? uDrive.y * side.x + uDrive.z * side.y + uDrive.w : 0.0;`)
    .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      if (rigId > 6.5) objectNormal.yz = swing(objectNormal.yz, uMove.z * uGear.z);
      else if (rigId > 5.5) objectNormal = mat3(uEgg) * objectNormal;
      else if (rigId > 3.5) {
        objectNormal = about(objectNormal, axle, rollBy);
        objectNormal.xz = swing(objectNormal.xz, steerBy);
      }
      if (spinId > 0.5) objectNormal.yz = swing(objectNormal.yz, spinBy);
      if (rigId > 0.5 && rigId < 2.5) objectNormal.yz = swing(objectNormal.yz, rigId < 1.5 ? uMove.x : uMove.z);`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      if (spinId > 0.5) {
        vec3 hub = _center.xyz * 2.0, sp = transformed * uUnit + modelMatrix[3].xyz - hub;
        sp.yz = swing(sp.yz, spinBy);
        transformed = (sp + hub - modelMatrix[3].xyz) / uUnit;
      }
      if (rigId > 6.5) {
        vec3 wp = transformed * uUnit + modelMatrix[3].xyz;
        wp.yz = uGear.xy + swing(wp.yz - uGear.xy, uMove.z * uGear.z);
        transformed = (wp - modelMatrix[3].xyz) / uUnit;
      } else if (rigId > 5.5) {
        vec3 wp = (uEgg * vec4(transformed * uUnit + modelMatrix[3].xyz, 1.0)).xyz;
        transformed = (wp - modelMatrix[3].xyz) / uUnit;
      } else if (rigId > 3.5) {
        vec3 hub = _center.xyz * 2.0, sp = about(transformed * uUnit + modelMatrix[3].xyz - hub, axle, rollBy);
        sp.xz = swing(sp.xz, steerBy);
        transformed = (sp + hub - modelMatrix[3].xyz) / uUnit;
      } else if (rigId > 2.5) { // elastic: the lower end follows the lock plate, the rest stretches toward the post
        vec3 wp = transformed * uUnit + modelMatrix[3].xyz;
        vec2 post = ${v2(ELASTIC.post)}, pin = ${v2(ELASTIC.pin)};
        float along = clamp(dot(wp.yz - post, pin - post) / dot(pin - post, pin - post), 0.0, 1.0);
        wp.yz += along * (uPivot.zw + swing(pin - uPivot.zw, uMove.z) - pin);
        wp += normal * 0.0022 * uMove.z; // thicker as it relaxes
        transformed = (wp - modelMatrix[3].xyz) / uUnit;
      } else if (rigId > 0.5) {
        vec2 pv = rigId < 1.5 ? uPivot.xy : uPivot.zw;
        vec3 wp = transformed * uUnit + modelMatrix[3].xyz;
        wp.yz = pv + swing(wp.yz - pv, rigId < 1.5 ? uMove.x : uMove.z);
        if (rigId < 1.5) wp.z += uMove.y;
        transformed = (wp - modelMatrix[3].xyz) / uUnit;
      }
      transformed += (uShift + (_center.xyz * 2.0 - uOrigin) * uSpread + uLift) / uUnit;`);
};
// turned-metal look for the flywheel (its axis is X): highlights fan out from the hub and fine tool marks circle it
const BRASS_SHEEN = `
  vec2 spoke = vHome.yz - uHub.yz;
  float rr = length(spoke);
  vec3 hv = normalize(normalize(cameraPosition - vHome) + normalize(vec3(-1.6, 2.6, 0.6)));
  float fan = pow(abs(dot(spoke / max(rr, 1e-4), normalize(hv.yz + 1e-4))), 5.0);
  float marks = 0.5 + 0.5 * sin(rr * 2600.0) * smoothstep(0.002, 0.0005, fwidth(rr));
  reflectedLight.directSpecular += diffuseColor.rgb * fan * (0.3 + 0.12 * marks);
  reflectedLight.indirectSpecular *= 0.85 + 0.2 * marks;
`;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const rad = THREE.MathUtils.degToRad;
const FINISH = {
  metal: { metalness: 0.62, roughness: 0.4, envMapIntensity: 0.95 },
  matte: { metalness: 0, roughness: 0.62, envMapIntensity: 0.6 },
  brass: { metalness: 0.85, roughness: 0.32, envMapIntensity: 1.6 },
  clear: { metalness: 0, roughness: 0.18, envMapIntensity: 0.6 },
};

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }));
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = false;

    this.scene = new THREE.Scene();
    this.scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    const light = (c, i, x, y, z) => {
      const l = new THREE.DirectionalLight(c, i);
      l.position.set(x, y, z);
      this.scene.add(l);
      return l;
    };
    const key = (this.key = light(0xffffff, 3.2, 1.6, 2.6, 1.5));
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    Object.assign(key.shadow.camera, { left: -1, right: 1, top: 1, bottom: -1, near: 0.1, far: 8 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.003;
    light(0xdfe8ff, 2.4, -2.4, 1.2, -2.2);
    light(0xffffff, 1.1, -2, 0.6, 2);
    light(0xeaf2ff, 1.6, 0.5, -2.6, -0.6); // underside

    this.camera = new THREE.PerspectiveCamera(28, 1, 0.05, 30);
    const c = (this.controls = new OrbitControls(this.camera, canvas));
    c.enableDamping = true;
    c.dampingFactor = 0.07;
    c.enablePan = false;
    c.rotateSpeed = 0.7;
    c.minPolarAngle = 0.15;
    c.maxPolarAngle = Math.PI - 0.15;
    c.autoRotateSpeed = 0.5;
    c.addEventListener('start', () => { this.tween = null; this.idle = false; this.dirty = true; });
    c.addEventListener('change', () => { this.dirty = true; });

    this.subs = new Map();
    this.shift = { x: 0, y: 0 }; // current view offset, fraction of the viewport
    this.mech = { d: 1, h: 1, l: 1, p: 1 }; // see pose() in mechanism.js
    this.change = { value: 0 }; // 0..1 how strongly the parts from markChanged() stand out
    this.changePick = { value: 0 }; // which of those changes is picked, 1..n; 0 all alike
    this.time = { value: 0 }; // s, for the highlight's glow
    this.changeTo = 0;
    // how this robot moves: pivots, poses, clips and fuel runs (Re-Entropy's unless the robot brings its own)
    this.kit = { PIVOT, CLIPS, pose, RUNS, CONES: [CONE] };
    this.fuel = new Fuel(this.scene);
    this.rate = {}; // roller speed per subsystem, rad/s
    this.ex = 0; // explode progress 0..1 and its goal
    this.exTo = 0;
    this.dirty = true;
    this.onFrame = () => {};
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    this.w = innerWidth;
    this.h = innerHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.applyShift();
    this.onResize?.();
  }

  applyShift() {
    this.camera.setViewOffset(this.w, this.h, this.shift.x * this.w, this.shift.y * this.h, this.w, this.h);
    this.dirty = true;
  }

  async load(url, explode, onProgress) {
    this.install(await this.fetchModel(url, onProgress), explode);
  }

  // a model's file, fetched ahead of time so switching to it later is quick
  prefetch(url) {
    this.files ||= new Map();
    if (!this.files.has(url)) this.files.set(url, fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status)))));
    return this.files.get(url);
  }

  async fetchModel(url, onProgress) {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    if (this.files?.has(url)) return loader.parseAsync(await this.files.get(url), '');
    return loader.loadAsync(url, onProgress);
  }

  // Swap in another model of the same robot (Entropy at another event): the one shown drops out of view
  // and the new one comes in from the other side. dir 1: the old one leaves downward, the new one comes
  // from above; -1 the other way round. Resolves once the new one has landed.
  async swap(url, explode, dir) {
    const DROP = 2.6; // m, far enough to leave the frame
    this.stopRun();
    this.fuel.clear();
    this.clip = null;
    this.crashPending = false;
    this.wreck?.stop();
    this.driveT = undefined;
    this.rate = {};
    this.change.value = this.changeTo = 0;
    this.isolate(null);
    this.ex = this.exTo = 0; // in one piece
    this.afterAssembly = null;
    this.applyExplode();
    if (this.cone) this.cone.visible = false;
    const old = { root: this.root, lift: this.lift, cone: this.cone, wreck: this.wreck, exMeshes: this.exMeshes };
    const loading = this.fetchModel(url);
    await this.slide(old.lift.value, -dir * DROP, 650, (k) => k * k * k);
    const gltf = await loading;
    old.root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); o.customDepthMaterial?.dispose(); } });
    for (const m of old.exMeshes) m.geometry.dispose();
    this.scene.remove(old.root);
    if (old.cone) this.scene.remove(old.cone);
    if (old.wreck?.group) this.scene.remove(old.wreck.group);
    this.subs = new Map();
    this.wreck = this.cone = null;
    this.focusId = null;
    this.install(gltf, explode);
    this.setMech(1, 1, 1);
    this.lift.value.y = dir * DROP;
    await this.slide(this.lift.value, 0, 900, (k) => 1 - (1 - k) ** 3);
  }

  // move a model up or down (its lift, a vector) to y over ms; resolves when it gets there
  slide(lift, to, ms, curve) {
    return new Promise((done) => {
      const from = lift.y, t0 = performance.now();
      this.slides = [...(this.slides || []), { step: (now) => {
        const k = calm ? 1 : Math.min(1, (now - t0) / ms);
        lift.y = from + (to - from) * curve(k);
        if (k === 1) done();
        return k < 1;
      } }];
      this.dirty = true;
    });
  }

  install(gltf, explode) {
    this.root = gltf.scene;
    // how far the whole model is raised or lowered, added after everything else in the vertex shader
    // (the mechanisms turn about fixed points, so the model itself stays put)
    this.lift = { value: new THREE.Vector3() };
    gltf.scene.updateMatrixWorld(true);
    const meshes = [];
    gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    for (const m of meshes) {
      m.geometry.computeBoundingBox();
      const [id, fin] = m.name.split('__');
      const sub = this.subs.get(id) || { id, a: 1, to: 1, parts: [], box: new THREE.Box3(), exBox: new THREE.Box3(), shift: new THREE.Vector3(...(explode[id]?.shift || [0, 0, 0])), spread: new THREE.Vector3(...(explode[id]?.spread || [0, 0, 0])) };
      sub.u ||= { uShift: { value: new THREE.Vector3() }, uSpread: { value: new THREE.Vector3() }, uOrigin: { value: new THREE.Vector3() }, uMove: { value: new THREE.Vector3() }, uSpin: { value: 0 }, uDrive: { value: new THREE.Vector4() }, uEgg: { value: new THREE.Matrix4() }, uEggA: { value: 1 }, uGear: { value: new THREE.Vector3(...(this.kit.PIVOT[id]?.gear || [0, 0, 0])) }, uPivot: { value: new THREE.Vector4(...(this.kit.PIVOT[id]?.main || [0, 0]), ...(this.kit.PIVOT[id]?.spin || [0, 0])) }, uLift: this.lift };
      const u = { ...sub.u, uUnit: { value: m.matrixWorld.getMaxScaleOnAxis() } };
      const displace = (mt) => { mt.onBeforeCompile = (s) => explodeVertex(s, u); return mt; };
      this.subs.set(id, sub);
      const clear = (CLEAR_BY[id] ?? CLEAR).toFixed(2);
      const ghost = { value: 0 };
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, side: fin === 'clear' ? THREE.DoubleSide : THREE.FrontSide, ...FINISH[fin] });
      mat.onBeforeCompile = (s) => {
        explodeVertex(s, u);
        if (fin === 'brass') {
          s.uniforms.uHub = { value: m.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(m.matrixWorld) };
          s.vertexShader = s.vertexShader.replace('void main() {', 'varying vec3 vHome; void main() { vHome = (modelMatrix * vec4(position, 1.0)).xyz;');
          s.fragmentShader = s.fragmentShader.replace('void main() {', 'varying vec3 vHome; uniform vec3 uHub; void main() {');
        }
        s.uniforms.uGhost = ghost;
        s.uniforms.uChange = this.change;
        s.uniforms.uPick = this.changePick;
        s.uniforms.uTime = this.time;
        s.fragmentShader = s.fragmentShader
          .replace('void main() {', 'uniform float uGhost, uEggA, uChange, uPick, uTime;\nvarying float vEgg, vChanged;\nvoid main() {')
          .replace('#include <color_fragment>', `#include <color_fragment>
            float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
            diffuseColor.rgb = clamp(mix(vec3(lum), diffuseColor.rgb, ${fin === 'brass' ? '1.0' : SATURATION.toFixed(2)}), 0.0, 1.0);
            // what changed since another event (vChanged: which change, 1..n): those parts take a tint of the
            // accent, the picked change most; everything else keeps its shading but sinks back, darker and grayer
            float changed = step(0.5, vChanged);
            float hi = changed * uChange * (uPick < 0.5 || abs(vChanged - uPick) < 0.5 ? 1.0 : 0.3);
            diffuseColor.rgb = mix(diffuseColor.rgb, mix(${CHANGED}, diffuseColor.rgb * 0.5 + ${CHANGED} * 0.6, 0.45), 0.7 * hi);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * 0.42, 0.82 * uChange * (1.0 - hi));`)
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
            // a glow that breathes, brightest at the rims
            float rim = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
            totalEmissiveRadiance += ${CHANGED} * hi * (0.1 + 0.08 * sin(uTime * 2.6) + 0.85 * rim * rim * rim);`)
          .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
            ${fin === 'brass' ? BRASS_SHEEN : ''}`)
          // ghosts fade on faces toward the viewer and keep a faint silhouette
          .replace('#include <opaque_fragment>', `
            float gf = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
            ${fin === 'clear' ? `diffuseColor.a *= ${clear} * (1.0 + 2.5 * gf * gf * gf);` : ''}
            diffuseColor.a *= mix(1.0, 0.45 + 1.7 * gf * gf, uGhost) * mix(1.0, uEggA, vEgg);
            outgoingLight = mix(outgoingLight, vec3(0.55, 0.57, 0.6), uGhost * 0.75);
            #include <opaque_fragment>`);
      };
      mat.customProgramCacheKey = () => (fin === 'clear' ? `clear${clear}` : fin === 'brass' ? 'brass' : 'solid');
      m.material = mat;
      if (fin === 'clear') mat.depthWrite = false;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.customDepthMaterial = displace(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
      m.userData.sub = id;
      let pre = null;
      if (fin !== 'clear') {
        // depth pre-pass: a ghosted subsystem blends as one shell instead of stacking every internal face
        pre = new THREE.Mesh(m.geometry, displace(new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true })));
        pre.frustumCulled = false;
        pre.raycast = () => {};
        pre.visible = false;
        m.add(pre);
      }
      sub.parts.push({ m, mat, ghost, pre, fin });
      sub.box.union(new THREE.Box3().setFromObject(m));
    }
    this.scene.add(gltf.scene);
    if (this.withCone !== false) this.addCone();
    this.meshes = meshes;
    this.box = new THREE.Box3();
    for (const s of this.subs.values()) this.box.union(s.box);
    this.exBox = new THREE.Box3();
    this.exMeshes = [];
    for (const s of this.subs.values()) {
      s.box.getCenter(s.u.uOrigin.value);
      for (const p of s.parts) this.exMeshes.push(this.explodedProxy(p.m, s));
      this.exBox.union(s.exBox);
    }
    this.applyAlpha();
    const buildBvh = () => {
      const m = [...meshes, ...this.exMeshes].find((x) => !x.geometry.boundsTree);
      if (!m) return;
      m.geometry.boundsTree = new MeshBVH(m.geometry, { indirect: true });
      setTimeout(buildBvh, 8);
    };
    setTimeout(buildBvh, 600);
  }

  // camera fields of view, only shown while the vision system is in focus
  addCone() {
    this.cone = new THREE.Group();
    this.cone.visible = false;
    this.cone.a = 0;
    for (const c of this.kit.CONES) this.cone.add(this.coneOf(c));
    this.scene.add(this.cone);
  }

  coneOf(cone) {
    const pos = [0, 0, 0], col = [0.29, 0.87, 0.5, 0.26];
    for (const r of cone.rays) {
      pos.push(...new THREE.Vector3(...r).setLength(cone.length).toArray());
      col.push(0.29, 0.87, 0.5, 0);
    }
    const attr = (g) => g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)).setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    const look = { vertexColors: true, transparent: true, depthWrite: false, toneMapped: false };
    const faces = new THREE.Mesh(attr(new THREE.BufferGeometry()).setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1]), new THREE.MeshBasicMaterial({ ...look, side: THREE.DoubleSide }));
    const edges = new THREE.LineSegments(attr(new THREE.BufferGeometry()).setIndex([0, 1, 0, 2, 0, 3, 0, 4]), new THREE.LineBasicMaterial(look));
    for (const m of [faces, edges]) { m.renderOrder = 900; m.frustumCulled = false; }
    const g = new THREE.Group().add(faces, edges);
    g.userData.lens = new THREE.Vector3(...cone.lens);
    return g;
  }

  stepCone(dt) {
    if (!this.cone) return;
    const c = this.cone, to = this.focusId === 'vision' ? 1 : 0;
    if (c.a !== to) {
      c.a = calm || Math.abs(to - c.a) < 0.004 ? to : THREE.MathUtils.damp(c.a, to, 4, dt);
      c.visible = c.a > 0;
      for (const g of c.children) {
        g.scale.setScalar(0.35 + 0.65 * c.a);
        for (const m of g.children) m.material.opacity = c.a;
      }
      this.dirty = true;
    }
    if (c.visible) for (const g of c.children) this.displaced('vision', g.userData.lens, g.position);
  }

  // --- exploded view -----------------------------------------------------------------------
  // invisible fully-exploded copy of a mesh: gives the camera its bounds and clicks something to hit
  explodedProxy(m, s) {
    const src = m.geometry.attributes.position, c = m.geometry.attributes._center, o = s.u.uOrigin.value;
    const pos = new Float32Array(src.count * 3), v = new THREE.Vector3(), h = new THREE.Vector3();
    for (let i = 0; i < src.count; i++) {
      h.fromBufferAttribute(c, i).multiplyScalar(2).sub(o).multiply(s.spread).add(s.shift);
      v.fromBufferAttribute(src, i).applyMatrix4(m.matrixWorld).add(h).toArray(pos, i * 3);
    }
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)).setIndex(m.geometry.index);
    geo.computeBoundingBox();
    s.exBox.union(geo.boundingBox);
    const proxy = new THREE.Mesh(geo, m.material);
    proxy.userData.sub = m.userData.sub;
    return proxy;
  }

  explode(on) {
    this.exTo = on ? 1 : 0;
    this.afterAssembly = null;
    if (on) {
      this.stopRun();
      if (this.eggT !== undefined) this.eggT = EGG_SECONDS;
      this.wreck?.stop();
      this.play('rest', true);
    }
    this.dirty = true;
  }

  boxOf(id) {
    const s = id ? this.subs.get(id) : this;
    if (this.exTo) return s.exBox;
    if (this.eggT !== undefined && (!id || id === 'shooter')) return s.box.clone().union(EGG_AREA);
    if (this.wreck?.running && (!id || id === 'intake')) return s.box.clone().union(this.wreck.area);
    // leave headroom for the folded intake
    // and for the camera's view cone
    if (id === 'vision' && this.kit.CONES[0] === CONE) return s.box.clone().expandByPoint(new THREE.Vector3(-0.24, 0.55, -0.7));
    if (id === 'vision') {
      const b = s.box.clone(), p = new THREE.Vector3();
      for (const c of this.kit.CONES) for (const r of c.rays) b.expandByPoint(p.fromArray(r).setLength(c.length * 0.8).add(new THREE.Vector3(...c.lens)));
      return b;
    }
    if (id === 'intake') return s.box.clone().expandByPoint(new THREE.Vector3(0, 0.5, 0.2));
    return s.box;
  }

  // where a point on a subsystem currently sits; still: leave out the mechanism's motion (exploding only)
  displaced(id, p, out, still) {
    const { u } = this.subs.get(id), m = u.uMove.value, pv = u.uPivot.value;
    out.copy(p).sub(u.uOrigin.value).multiply(u.uSpread.value).add(u.uShift.value);
    if (still || !this.kit.PIVOT[id]) return out.add(p);
    const y = p.y - pv.x, z = p.z - pv.y, c = Math.cos(m.x), s = Math.sin(m.x);
    out.x += p.x;
    out.y += pv.x + y * c - z * s;
    out.z += pv.y + y * s + z * c + m.y;
    return out;
  }

  applyExplode() {
    // subsystems leave one after another, then each comes apart along its own axes
    let i = 0;
    const n = Math.max(1, this.subs.size - 1);
    for (const s of this.subs.values()) {
      const t = THREE.MathUtils.clamp((this.ex - (i++ / n) * 0.2) / 0.8, 0, 1);
      s.u.uShift.value.copy(s.shift).multiplyScalar(ease(Math.min(1, t / 0.75)));
      s.u.uSpread.value.copy(s.spread).multiplyScalar(ease(Math.max(0, (t - 0.3) / 0.7)));
    }
    const half = 1 + 0.8 * Math.min(1, this.ex * 4), sc = this.key.shadow.camera;
    Object.assign(sc, { left: -half, right: half, top: half, bottom: -half });
    sc.updateProjectionMatrix();
    this.renderer.shadowMap.needsUpdate = true;
    this.dirty = true;
  }

  // --- mechanism --------------------------------------------------------------------------
  // [d, h, l] before the boot clip: everything folded in, unless the robot says otherwise
  get stowed() {
    const s = this.kit.STOWED || {};
    return ['d', 'h', 'l'].map((v) => s[v] ?? 0);
  }

  setMech(d, h, l, p = 1) {
    this.mech = { d, h, l, p };
    const at = this.kit.pose(d, h, l, p);
    for (const id in at) this.subs.get(id)?.u.uMove.value.fromArray(at[id]);
    this.renderer.shadowMap.needsUpdate = true;
    this.dirty = true;
  }

  // force: the viewer asked for it, so play even with reduced motion
  play(clip, force) {
    if (calm && !force) return this.setMech(1, 1, 1);
    if (clip !== 'rest') this.stopRun();
    if (clip !== 'rest' && this.exTo) return; // stays in its CAD pose while exploded
    if (clip === 'drive') { this.driveT = 0; return; }
    this.clip = { keys: this.kit.CLIPS[clip](this.mech), t: 0, from: { ...this.mech } };
    this.dirty = true;
  }

  stepMech(dt) {
    const c = this.clip, k = c.keys[0];
    c.t += dt * 1000;
    const q = ease(Math.min(1, c.t / k.ms));
    this.setMech(...['d', 'h', 'l', 'p'].map((v) => THREE.MathUtils.lerp(c.from[v], k[v] ?? c.from[v], q)));
    if (c.t < k.ms) return;
    c.keys.shift();
    c.t = 0;
    c.from = { ...this.mech };
    if (!c.keys.length) this.clip = null;
  }

  // --- running a subsystem ------------------------------------------------------------------
  run(id) {
    if (this.exTo || this.wreck?.running) return;
    this.stopRun();
    this.fuel.clear();
    this.play('rest', true); // finish any folding first
    this.pending = id;
  }

  stopRun() {
    this.pending = null;
    this.fuel.stop();
  }

  // the flywheel easter egg; see egg.js
  egg() {
    if (this.exTo || this.eggT !== undefined) return;
    this.stopRun();
    this.play('rest', true);
    this.eggT = 0;
    this.onEgg?.(true);
  }

  // Entropy's easter egg: the intake blows apart and puts itself back together; see crash.js
  crash() {
    if (this.exTo || this.wreck?.running || this.crashPending || !this.subs.has('intake')) return;
    this.stopRun();
    this.play('rest', true);
    this.crashPending = true; // once the intake is down
    this.dirty = true;
  }

  stepCrash(dt) {
    if (this.crashPending && !this.clip) {
      this.crashPending = false;
      (this.wreck ||= new Crash(this, this.subs.get('intake'))).start();
      this.onEgg?.(true);
    } else if (this.wreck?.running && !this.wreck.step(dt)) this.onEgg?.(false);
    else if (!this.wreck?.running) return;
    this.renderer.shadowMap.needsUpdate = true;
    this.dirty = true;
  }

  // parts to pick out as changed since another event, by their centres as the model stores them
  // (int16 per vertex, see tools/changes.mjs); showChanges() fades the highlight in and out
  // groups: for each change, the centres (as the model stores them) of the parts it touched; each
  // vertex learns which change it belongs to, 1..n (0 none)
  markChanged(groups) {
    const which = new Map();
    groups.forEach((keys, k) => { for (const key of keys) if (!which.has(key.join())) which.set(key.join(), k + 1); });
    const q = (v) => Math.round(v * 32767);
    for (const m of this.meshes) {
      const c = m.geometry.attributes._center, flag = new Float32Array(c.count);
      for (let i = 0; i < c.count; i++) flag[i] = which.get(`${q(c.getX(i))},${q(c.getY(i))},${q(c.getZ(i))}`) || 0;
      m.geometry.setAttribute('_changed', new THREE.BufferAttribute(flag, 1));
    }
    this.changePick.value = 0;
  }

  // pick one change to stand out (1..n), or 0 for all of them
  pickChange(k) {
    this.changePick.value = k;
    this.dirty = true;
  }

  // the change (1..n) of the part under the pointer, if the highlight is showing
  changeAt(x, y) {
    if (!this.changeTo) return 0;
    const ray = (this.ray ||= new THREE.Raycaster());
    ray.firstHitOnly = true;
    ray.setFromCamera(new THREE.Vector2((x / this.w) * 2 - 1, -(y / this.h) * 2 + 1), this.camera);
    const hit = ray.intersectObjects(this.meshes.filter((m) => m.visible && m.geometry.boundsTree && m.geometry.attributes._changed), false)[0];
    return hit ? hit.object.geometry.attributes._changed.getX(hit.face.a) : 0;
  }

  showChanges(on) {
    this.changeTo = on ? 1 : 0;
    this.dirty = true;
  }

  // soft contact shadow so the loose flywheel reads as sitting on the floor
  eggShadow() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.renderOrder = 4;
    this.scene.add(m);
    return m;
  }

  stepEgg(dt) {
    if (!this.subs.has('shooter')) return;
    const u = this.subs.get('shooter').u;
    const blob = (this.blob ||= this.eggShadow());
    blob.visible = this.eggT !== undefined;
    if (this.eggT === undefined) {
      // otherwise it just turns with the drum, 4.07 times faster
      if (u.uSpin.value !== this.eggSeen) spunInPlace(-4.07 * u.uSpin.value, u.uEgg.value);
      this.eggSeen = u.uSpin.value;
      return;
    }
    this.eggT += dt;
    const done = this.eggT >= EGG_SECONDS, at = egg(done ? EGG_SECONDS : this.eggT, u.uEgg.value);
    u.uEggA.value = at.alpha;
    const high = Math.min(1, at.pos.y / 0.35);
    blob.position.set(at.pos.x, 0.001, at.pos.z);
    blob.scale.setScalar(0.7 + 0.8 * high);
    blob.material.opacity = at.alpha * (1 - high) * (at.pos.x < -0.43 ? 1 : 0);
    if (done) blob.visible = false;
    this.eggSpin = at.rollers;
    if (done) { this.eggT = undefined; this.eggSeen = null; this.onEgg?.(false); }
    this.renderer.shadowMap.needsUpdate = true;
    this.dirty = true;
  }

  stepRun(dt) {
    if (this.pending && !this.clip) {
      this.fuel.start(this.kit.RUNS[this.pending]);
      this.pending = null;
    }
    const a = this.fuel.active;
    if (a) {
      const h = !a.stopping && a.run.hood?.(a.t, a.end);
      if (typeof h === 'number') this.setMech(this.mech.d, h, this.mech.l, this.mech.p);
      else if (a.run.hood && !this.clip && this.mech.h < 1) this.play('rest', true);
      this.fuel.step(dt);
      this.renderer.shadowMap.needsUpdate = true;
      this.dirty = true;
    }
    // rollers spin up and coast down
    for (const s of this.subs.values()) {
      let want = this.fuel.active && !this.fuel.active.stopping ? this.fuel.active.run.spin[s.id] || 0 : 0;
      if (this.eggSpin && { shooter: 24, hood: 30 }[s.id]) want = { shooter: 24, hood: 30 }[s.id] * this.eggSpin;
      let r = this.rate[s.id] || 0;
      if (!want && !r) continue;
      r = Math.abs(want - r) < 0.05 ? want : THREE.MathUtils.damp(r, want, 4, dt);
      this.rate[s.id] = r;
      s.u.uSpin.value += r * dt;
      this.dirty = true;
    }
    if (this.driveT !== undefined) {
      this.driveT += dt;
      const w = swerve(this.driveT), over = this.driveT >= SWERVE_SECONDS;
      this.subs.get('drive').u.uDrive.value.set(...(over ? [0, 0, 0, 0] : [w.steer, ...w.roll]));
      if (over) this.driveT = undefined;
      this.renderer.shadowMap.needsUpdate = true;
      this.dirty = true;
    }
  }

  // --- isolation --------------------------------------------------------------------------
  isolate(id) {
    // the intake folds in as the hopper retracts, so keep it readable while the hopper is in focus
    const pair = { hopper: 'intake' }[id];
    for (const s of this.subs.values()) s.to = !id || s.id === id ? 1 : s.id === pair ? 0.3 : GHOST;
    this.focusId = id;
    this.dirty = true;
  }

  applyAlpha() {
    // most opaque group first, so ghosts composite over whatever is in focus
    const order = [...this.subs.values()].sort((a, b) => b.a - a.a);
    order.forEach((s, i) => {
      const g = THREE.MathUtils.clamp((1 - s.a) / (1 - GHOST), 0, 1);
      for (const p of s.parts) {
        p.mat.opacity = s.a;
        p.ghost.value = g;
        p.m.renderOrder = p.fin === 'clear' ? 500 + i : 11 + i * 2;
        if (p.pre) { p.pre.visible = g > 0.001; p.pre.renderOrder = 10 + i * 2; }
        const cast = p.fin !== 'clear' && g < 0.5;
        if (p.m.castShadow !== cast) { p.m.castShadow = cast; this.renderer.shadowMap.needsUpdate = true; }
      }
    });
  }

  // --- camera -----------------------------------------------------------------------------
  // dir: [azimuth, elevation] degrees; shift: half the share of the viewport hidden at right / bottom
  fly({ box, dir, zoom = 1, shift, dur = 1500 }) {
    const centre = box.getCenter(new THREE.Vector3());
    const th = rad(dir[0]), phi = Math.PI / 2 - rad(dir[1]);
    const fwd = new THREE.Vector3().setFromSphericalCoords(1, phi, th);
    const right = new THREE.Vector3(0, 1, 0).cross(fwd).normalize(), up = fwd.clone().cross(right);
    const tv = Math.tan(rad(this.camera.fov) / 2);
    const tx = tv * this.camera.aspect * (1 - 2 * Math.abs(shift.x)) * 0.86, ty = tv * (1 - 2 * Math.abs(shift.y)) * 0.86;
    // smallest distance at which all eight corners of the box stay inside the visible area
    let radius = 0;
    const p = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(centre);
      radius = Math.max(radius, p.dot(fwd) + Math.max(Math.abs(p.dot(right)) / tx, Math.abs(p.dot(up)) / ty));
    }
    radius /= zoom;

    const from = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    let dth = (th - from.theta) % (2 * Math.PI);
    if (dth > Math.PI) dth -= 2 * Math.PI;
    if (dth < -Math.PI) dth += 2 * Math.PI;
    this.idle = false;
    this.controls.minDistance = radius * 0.35;
    this.controls.maxDistance = radius * 2;
    this.tween = {
      t0: performance.now(), dur: calm || !dur ? 1 : dur,
      from, to: { theta: from.theta + dth, phi, radius },
      tgt0: this.controls.target.clone(), tgt1: centre, s0: { ...this.shift }, s1: { ...shift },
    };
    this.goalShift = { ...shift };
    this.dirty = true;
  }

  // f < 1 moves closer; repeated calls stack
  zoomBy(f) {
    const from = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    const w = this.tween, base = w ? w.to : from, tgt = this.controls.target.clone();
    const radius = THREE.MathUtils.clamp(base.radius * f, this.controls.minDistance, this.controls.maxDistance);
    this.idle = false;
    this.tween = {
      t0: performance.now(), dur: calm ? 1 : 450, from, to: { theta: base.theta, phi: base.phi, radius },
      tgt0: tgt, tgt1: w ? w.tgt1 : tgt.clone(), s0: { ...this.shift }, s1: { ...this.goalShift },
    };
    this.dirty = true;
  }

  stepTween(now) {
    const w = this.tween;
    const k = Math.min(1, Math.max(0, (now - w.t0) / w.dur)), q = ease(k), mix = THREE.MathUtils.lerp;
    this.controls.target.lerpVectors(w.tgt0, w.tgt1, q);
    this.camera.position
      .setFromSphericalCoords(mix(w.from.radius, w.to.radius, q), mix(w.from.phi, w.to.phi, q), mix(w.from.theta, w.to.theta, q))
      .add(this.controls.target);
    this.camera.lookAt(this.controls.target);
    this.shift.x = mix(w.s0.x, w.s1.x, q);
    this.shift.y = mix(w.s0.y, w.s1.y, q);
    this.applyShift();
    if (k >= 1) this.tween = null;
  }

  // user grabbed the camera mid-flight: still let the layout offset settle
  settleShift(dt) {
    const g = this.goalShift;
    if (!g) return;
    const dx = g.x - this.shift.x, dy = g.y - this.shift.y;
    if (Math.abs(dx) + Math.abs(dy) < 1e-4) return;
    const k = 1 - Math.exp(-dt * 6);
    this.shift.x += dx * k;
    this.shift.y += dy * k;
    this.applyShift();
  }

  pick(x, y) {
    const ray = (this.ray ||= new THREE.Raycaster());
    ray.firstHitOnly = true;
    ray.setFromCamera(new THREE.Vector2((x / this.w) * 2 - 1, -(y / this.h) * 2 + 1), this.camera);
    const hits = ray.intersectObjects((this.exTo ? this.exMeshes : this.meshes).filter((m) => m.visible && m.geometry.boundsTree && m.userData.sub !== 'frame'), false);
    // what is in focus wins over ghosts drawn in front of it
    return (hits.find((h) => h.object.userData.sub === this.focusId) || hits[0])?.object.userData.sub || null;
  }

  // compile shaders and upload the model while the loading screen still covers it
  warmUp(from) {
    this.box.getCenter(this.controls.target);
    this.camera.position.copy(from);
    this.camera.lookAt(this.controls.target);
    this.camera.updateMatrixWorld();
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    let last = performance.now();
    this.renderer.setAnimationLoop(() => {
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let fading = false;
      for (const s of this.subs.values()) {
        if (s.a === s.to) continue;
        fading = true;
        s.a = calm || Math.abs(s.to - s.a) < 0.004 ? s.to : THREE.MathUtils.damp(s.a, s.to, 5, dt);
      }
      if (fading) { this.applyAlpha(); this.dirty = true; }
      if (this.change.value > 0) { this.time.value = now / 1000; this.dirty = true; } // the glow breathes
      if (this.change.value !== this.changeTo) {
        const c = this.change;
        c.value = calm || Math.abs(this.changeTo - c.value) < 0.004 ? this.changeTo : THREE.MathUtils.damp(c.value, this.changeTo, 4, dt);
        this.dirty = true;
      }
      if (this.slides?.length) {
        this.slides = this.slides.filter((s) => s.step(now));
        this.renderer.shadowMap.needsUpdate = true;
        this.dirty = true;
      }
      if (this.clip) this.stepMech(dt);
      this.stepRun(dt);
      this.stepEgg(dt);
      this.stepCrash(dt);
      if (this.ex !== this.exTo) {
        const d = calm ? 1 : (dt * 1000) / EXPLODE_MS;
        this.ex = this.exTo ? Math.min(1, this.ex + d) : Math.max(0, this.ex - d);
        this.applyExplode();
        if (!this.ex && this.afterAssembly) { this.afterAssembly(); this.afterAssembly = null; }
      }
      this.stepCone(dt);
      if (this.tween) this.stepTween(now);
      else {
        this.settleShift(dt);
        this.controls.autoRotate = !!this.idle && !calm;
        this.controls.update(dt);
      }
      if (!this.dirty) return;
      this.dirty = false;
      this.camera.updateMatrixWorld();
      this.renderer.render(this.scene, this.camera);
      this.onFrame();
    });
  }
}
