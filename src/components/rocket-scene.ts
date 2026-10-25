import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EXPLODE_GROUPS, FINISH, smoothstep, type ExplodeGroup } from "@/lib/rocket";

function paintTexture(hex: string, kind: "paper" | "paint" | "cardboard" | "metal") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) {
    const fallback = new THREE.CanvasTexture(canvas);
    return { color: fallback, rough: fallback };
  }

  context.fillStyle = hex;
  context.fillRect(0, 0, 512, 512);
  const image = context.getImageData(0, 0, 512, 512);
  const rough = context.createImageData(512, 512);
  const grainAmount = kind === "paint" ? 10 : kind === "metal" ? 8 : kind === "cardboard" ? 28 : 18;
  const roughBase = kind === "paint" ? 92 : kind === "metal" ? 70 : kind === "cardboard" ? 188 : 168;

  for (let y = 0; y < 512; y += 1) {
    for (let x = 0; x < 512; x += 1) {
      const i = (y * 512 + x) * 4;
      const fiber = Math.sin(x * 0.35) * Math.sin(y * 0.08) * (kind === "paper" || kind === "cardboard" ? 7 : 2);
      const grain = (Math.random() - 0.5) * grainAmount + fiber;
      image.data[i] = Math.min(255, Math.max(0, image.data[i] + grain));
      image.data[i + 1] = Math.min(255, Math.max(0, image.data[i + 1] + grain * 0.92));
      image.data[i + 2] = Math.min(255, Math.max(0, image.data[i + 2] + grain * 0.8));
      const shade = Math.min(255, Math.max(0, roughBase + (Math.random() - 0.5) * 46));
      rough.data[i] = shade;
      rough.data[i + 1] = shade;
      rough.data[i + 2] = shade;
      rough.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  if (kind === "paper" || kind === "cardboard") {
    context.globalAlpha = kind === "cardboard" ? 0.16 : 0.07;
    context.strokeStyle = kind === "cardboard" ? "#3a2a18" : "#8a8174";
    context.lineWidth = 1;
    for (let x = 8; x < 512; x += kind === "cardboard" ? 4 : 7) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + 2, 512);
      context.stroke();
    }
    context.globalAlpha = 0.22;
    context.strokeStyle = kind === "cardboard" ? "#c4a077" : "#ffffff";
    context.beginPath();
    context.moveTo(40, 0);
    context.lineTo(46, 512);
    context.stroke();
  }

  const color = new THREE.CanvasTexture(canvas);
  color.colorSpace = THREE.SRGBColorSpace;
  color.wrapS = THREE.RepeatWrapping;
  color.wrapT = THREE.RepeatWrapping;
  color.anisotropy = 8;
  color.repeat.set(kind === "paint" ? 1 : 2, kind === "cardboard" ? 3 : 2);

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  roughCanvas.getContext("2d")?.putImageData(rough, 0, 0);
  const roughMap = new THREE.CanvasTexture(roughCanvas);
  roughMap.wrapS = THREE.RepeatWrapping;
  roughMap.wrapT = THREE.RepeatWrapping;
  roughMap.repeat.copy(color.repeat);

  return { color, rough: roughMap };
}

export type CalloutFrame = {
  id: string;
  x: number;
  y: number;
  opacity: number;
  side: "left" | "right";
};

export type MeshPart = {
  mesh: THREE.Mesh;
  centroid: THREE.Vector3;
  radial: THREE.Vector3;
  group: ExplodeGroup;
};

export class RocketScene {
  progress = 0;
  reducedMotion = false;
  activePartId: string = "nose";
  userSelected = false;

  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly tilt = new THREE.Group();
  private readonly spin = new THREE.Group();
  private readonly orient = new THREE.Group();
  private readonly model = new THREE.Group();
  private readonly parts: MeshPart[] = [];
  private readonly allMeshes: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly mouse = new THREE.Vector2();

  private lastFrame = performance.now();
  private readonly center = new THREE.Vector3();
  private readonly scratch = new THREE.Vector3();
  private idleSpin = 0.45;
  private raf = 0;
  private compact = false;
  private running = false;
  private tourTimer = 0;
  private tourIndex = 0;
  private autoTourTimer = 0;
  private lastProgress = 0;
  private targetYaw = 0;
  private currentYaw = 0;
  private targetCameraY = 0;
  private currentCameraY = 0;

  private onCallouts: (frames: CalloutFrame[]) => void;
  private onReady: () => void;
  private onActivePartChange?: (partId: string) => void;

  private readonly tourPartIds = [
    "nose",
    "altimeter",
    "eggs",
    "chute",
    "transition",
    "booster",
    "fins",
    "motor",
  ];

  constructor(
    canvas: HTMLCanvasElement,
    hooks: {
      onCallouts: (frames: CalloutFrame[]) => void;
      onReady: () => void;
      onActivePartChange?: (partId: string) => void;
    },
  ) {
    this.canvas = canvas;
    this.onCallouts = hooks.onCallouts;
    this.onReady = hooks.onReady;
    this.onActivePartChange = hooks.onActivePartChange;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
    this.camera.position.set(0, -0.02, 1.85);

    const key = new THREE.DirectionalLight("#fff6ee", 2.45);
    key.position.set(2.6, 3.4, 4.4);

    const front = new THREE.DirectionalLight("#f4f7fb", 0.7);
    front.position.set(0.4, 0.6, 4.2);

    const rim = new THREE.DirectionalLight("#d5e2f2", 1.15);
    rim.position.set(-2.8, -1.2, -3.4);

    const fill = new THREE.DirectionalLight("#b7c3d4", 0.42);
    fill.position.set(-3.4, 1.6, 1.8);

    const ambient = new THREE.AmbientLight("#9aa6b6", 0.42);

    const headlight = new THREE.DirectionalLight("#ffffff", 0.28);
    this.camera.add(headlight);
    this.scene.add(this.camera);

    this.scene.add(key, front, rim, fill, ambient);

    this.orient.rotation.x = -Math.PI / 2;
    this.tilt.add(this.spin);
    this.spin.add(this.orient);
    this.orient.add(this.model);
    this.scene.add(this.tilt);

    this.resize();
    this.setupPointerEvents();
    this.load();
  }

  private setupPointerEvents() {
    this.canvas.addEventListener("pointerdown", (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.allMeshes, false);
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const part = this.parts.find((p) => p.mesh === hitMesh);
        if (part && part.group.id) {
          this.selectPart(part.group.id, true);
        }
      }
    });
  }

  selectPart(partId: string, fromUser = true) {
    this.activePartId = partId;
    if (fromUser) {
      this.userSelected = true;
      this.tourTimer = -8; // Pause auto-tour for 8s so user can read spec card
    }

    const yawAngles: Record<string, number> = {
      nose: 0,
      altimeter: 0.44,
      payload: 0,
      eggs: -0.44,
      ballast: 0.46,
      chute: -0.44,
      transition: 0,
      booster: 0,
      fins: 0.62,
      motor: 0,
    };

    if (yawAngles[partId] !== undefined) {
      this.targetYaw = yawAngles[partId];
    } else {
      this.targetYaw = 0;
    }

    const group = EXPLODE_GROUPS.find((g) => g.id === partId);
    if (group) {
      this.targetCameraY = (group.z * 0.001) * 0.42;
    }

    this.onActivePartChange?.(partId);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      this.update(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  resize() {
    const width = this.canvas.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 1440);
    const height = this.canvas.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 900);
    this.compact = width < 860;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.fov = this.compact ? 32 : 25;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    console.log("RocketScene.resize", { width, height, compact: this.compact });
  }

  dispose() {
    this.stop();
    this.renderer.dispose();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material?.dispose();
    });
  }

  private load() {
    const loader = new GLTFLoader();
    loader.load(
      "/rocky.glb",
      (gltf) => {
        const root = gltf.scene ?? gltf.scenes?.[0];
        if (!root) return;

        const meshes: THREE.Mesh[] = [];
        root.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (mesh.isMesh) meshes.push(mesh);
        });

        const cylinderParts = new Set([
          "payload_bay",
          "body_tube",
          "motor_mount_tube",
          "chute_protector",
          "ballast_cartridge",
          "bulkhead",
        ]);

        for (const mesh of meshes) {
          const name = mesh.name || mesh.parent?.name || "";
          mesh.name = name;

          if (cylinderParts.has(name)) {
            const pos = mesh.geometry.attributes.position;
            const norm = mesh.geometry.attributes.normal;
            if (pos && norm) {
              for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const y = pos.getY(i);
                const r = Math.sqrt(x * x + y * y);
                if (r > 2) {
                  norm.setXYZ(i, x / r, y / r, 0);
                }
              }
              norm.needsUpdate = true;
            }
          }

          const finish = FINISH[name] ?? {
            color: "#f4f1ea",
            roughness: 0.7,
            metalness: 0,
            kind: "paper" as const,
          };

          const paint = paintTexture(finish.color, finish.kind);
          mesh.material = new THREE.MeshStandardMaterial({
            color: "#ffffff",
            map: paint.color,
            roughness: finish.roughness ?? 0.45,
            roughnessMap: paint.rough,
            metalness: finish.metalness ?? 0.04,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1,
          });

          mesh.geometry.computeBoundingBox();
          this.allMeshes.push(mesh);
          this.model.add(mesh);
        }

        const box = new THREE.Box3();
        for (const mesh of meshes) {
          if (mesh.geometry.boundingBox) box.union(mesh.geometry.boundingBox);
        }
        box.getCenter(this.center);

        // Center cylinder axis (x=0, y=0) and longitudinal midpoint
        this.model.position.set(0, 0, -this.center.z * 0.001);
        this.model.scale.setScalar(0.001);

        for (const mesh of meshes) {
          const group = EXPLODE_GROUPS.find((entry) => entry.parts.includes(mesh.name));
          if (!group) continue;
          const centroid = new THREE.Vector3();
          mesh.geometry.boundingBox?.getCenter(centroid);
          const radial = new THREE.Vector3(centroid.x, centroid.y, 0);
          if (radial.lengthSq() < 1) radial.set(1, 0, 0);
          radial.normalize();
          this.parts.push({ mesh, centroid, radial, group });
        }

        this.onReady();
      },
      undefined,
      (err) => {
        console.error("Failed to load /rocky.glb:", err);
      },
    );
  }

  private update(dt: number) {
    const progress = this.progress;
    const upright = smoothstep(0.08, 0.2, progress);
    const isolate = smoothstep(0.18, 0.28, progress);
    const presence = 1;
    const count = EXPLODE_GROUPS.length;
    const local = THREE.MathUtils.clamp((progress - 0.22) / (0.96 - 0.22), 0, 0.999);
    const scaled = local * count;
    const index = Math.min(count - 1, Math.floor(scaled));
    const frac = scaled - index;
    const glide = index < count - 1 ? smoothstep(0.68, 1, frac) : 0;
    const fromGroup = EXPLODE_GROUPS[index];
    const toGroup = EXPLODE_GROUPS[Math.min(count - 1, index + 1)];
    const focus = glide > 0.5 ? toGroup : fromGroup;

    if (progress >= 0.18 && focus.id !== this.activePartId) {
      this.activePartId = focus.id;
      this.onActivePartChange?.(focus.id);
    }

    if (!this.reducedMotion && upright < 0.001) this.idleSpin += dt * 0.28;

    this.tilt.rotation.z = (1 - upright) * (this.compact ? -0.56 : -0.74);
    this.tilt.rotation.x = (1 - upright) * 0.22;
    this.tilt.rotation.y = (1 - upright) * -0.12;
    this.tilt.position.x = (this.compact ? 0 : 0.36) * (1 - upright);
    this.tilt.position.y = 0;

    const tourYaw = 0.35 + (index + glide) * 0.42;
    this.spin.rotation.y = this.idleSpin * (1 - upright) + tourYaw * upright;

    for (const part of this.parts) {
      part.mesh.position.set(0, 0, 0);
      let weight = 0;
      if (part.group.id === fromGroup.id) weight = 1 - glide;
      if (part.group.id === toGroup.id) weight = Math.max(weight, glide);
      const material = part.mesh.material as THREE.MeshStandardMaterial;
      const shown = (1 - isolate) + isolate * (0.14 + 0.86 * weight);
      material.opacity = shown * presence;
      material.depthWrite = material.opacity > 0.5;
      material.emissive.set("#000000");
      material.emissiveIntensity = 0;
    }

    this.tilt.updateMatrixWorld(true);
    const fromFrame = this.frameGroup(fromGroup.id);
    const toFrame = this.frameGroup(toGroup.id);
    const center = fromFrame.center.clone().lerp(toFrame.center, glide);
    const radius = THREE.MathUtils.lerp(fromFrame.radius, toFrame.radius, glide);
    const zoom = 1.2 - 0.2 * smoothstep(0.08, 0.45, frac);
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = Math.max(0.28, (radius / Math.sin(fov * 0.5)) * 1.75 * zoom);
    const focusPos = center.clone().add(new THREE.Vector3(0.4, 0.12, 1).normalize().multiplyScalar(distance));
    const heroPos = new THREE.Vector3(this.compact ? 0 : 0.12, 0.02, this.compact ? 2.5 : 1.92);
    const heroLook = new THREE.Vector3(this.compact ? 0 : 0.08, 0, 0);
    const look = heroLook.clone().lerp(center, isolate);
    if (!this.compact) look.x -= distance * 0.1 * isolate;

    this.camera.position.copy(heroPos).lerp(focusPos, isolate);
    this.camera.lookAt(look);
    this.renderer.render(this.scene, this.camera);
    this.publishCallouts(0, 0);
  }

  private frameGroup(id: string) {
    const box = new THREE.Box3();
    for (const part of this.parts) {
      if (part.group.id !== id || !part.mesh.geometry.boundingBox) continue;
      box.union(part.mesh.geometry.boundingBox.clone().applyMatrix4(part.mesh.matrixWorld));
    }
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    if (box.isEmpty()) return { center, radius: 0.2 };
    box.getCenter(center);
    box.getSize(size);
    return { center, radius: Math.max(size.x, size.y, size.z) * 0.5 };
  }

  private publishCallouts(explode: number, presence: number) {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const frames: CalloutFrame[] = [];

    for (const group of EXPLODE_GROUPS) {
      if (!group.label) continue;
      const part = this.parts.find((entry) => entry.mesh.name === group.parts[0]);
      if (!part) continue;

      this.scratch.copy(part.centroid);
      if (part.group.radial) this.scratch.addScaledVector(part.radial, 70);
      this.scratch.applyMatrix4(part.mesh.matrixWorld);
      const projected = this.scratch.project(this.camera);
      if (projected.z > 1) {
        frames.push({ id: group.id, x: 0, y: 0, opacity: 0, side: group.side });
        continue;
      }

      let x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      let side = group.side;
      if (x > width - 220) side = "left";
      if (x < 220) side = "right";
      x = Math.min(width - 24, Math.max(24, x));

      const isActive = group.id === this.activePartId;
      const index = EXPLODE_GROUPS.findIndex((entry) => entry.id === group.id);
      const staggered = smoothstep(0.46 + index * 0.015, 0.60 + index * 0.015, this.progress);
      let opacity = staggered * presence * smoothstep(0.08, 0.35, explode);
      if (this.compact && !group.mobile) opacity = 0;

      if (isActive && opacity > 0.1) opacity = Math.max(opacity, 0.95);

      const topGuard = this.compact ? 72 : 120;
      const bottomGuard = this.compact ? 200 : 36;
      if (y < topGuard || y > height - bottomGuard) opacity = 0;

      frames.push({ id: group.id, x, y, opacity, side });
    }

    this.onCallouts(frames);
  }
}
