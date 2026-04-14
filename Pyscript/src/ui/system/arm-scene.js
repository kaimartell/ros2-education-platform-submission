const ARM_MOUNT_ID = "arm-canvas-mount";
const COLORS = {
  teal: 0x146c72,
  ink: 0x19303a,
  rust: 0xb45f34,
  panelStrong: 0xfffcf7,
  warmGray: 0xd4cdc4,
  gridCenter: 0x19303a,
  gridEdge: 0xe8e0d6,
};

let THREE = null;
let OrbitControls = null;
let libsLoaded = false;
let libsLoading = null;

async function ensureLibsLoaded() {
  if (libsLoaded) {
    return true;
  }
  if (libsLoading) {
    return libsLoading;
  }
  libsLoading = (async () => {
    try {
      const [threeModule, controlsModule] = await Promise.all([
        import("https://unpkg.com/three@0.170.0/build/three.module.js?module"),
        import("https://unpkg.com/three@0.170.0/examples/jsm/controls/OrbitControls.js?module"),
      ]);
      THREE = threeModule;
      OrbitControls = controlsModule.OrbitControls;
      libsLoaded = true;
      return true;
    } catch (error) {
      console.error("arm-scene failed to load Three.js dependencies", error);
      libsLoading = null;
      return false;
    }
  })();
  return libsLoading;
}

let armSceneState = null;

function getMountElement() {
  return document.getElementById(ARM_MOUNT_ID);
}

function createMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.62,
    metalness: 0.08,
  });
}

function renderScene() {
  if (!armSceneState) {
    return;
  }

  armSceneState.renderer.render(armSceneState.scene, armSceneState.camera);
}

function syncRendererSize() {
  if (!armSceneState?.mount) {
    return;
  }

  const rect = armSceneState.mount.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || armSceneState.mount.clientWidth || 600));
  let height = Math.round(rect.height || armSceneState.mount.clientHeight || 0);
  if (height < 1) {
    height = Math.round(width * 0.75);
  }

  if (armSceneState.size.width === width && armSceneState.size.height === height) {
    return;
  }

  armSceneState.size = { width, height };
  armSceneState.camera.aspect = width / height;
  armSceneState.camera.updateProjectionMatrix();
  armSceneState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  armSceneState.renderer.setSize(width, height, true);
  renderScene();
}

function stopControlLoop() {
  if (!armSceneState) {
    return;
  }

  armSceneState.controlLoopActive = false;
  if (armSceneState.controlFrameId !== null) {
    window.cancelAnimationFrame(armSceneState.controlFrameId);
    armSceneState.controlFrameId = null;
  }
}

function startControlLoop() {
  if (!armSceneState || armSceneState.controlLoopActive) {
    return;
  }

  armSceneState.controlLoopActive = true;
  const tick = () => {
    if (!armSceneState?.controlLoopActive) {
      return;
    }

    armSceneState.controls.update();
    renderScene();
    armSceneState.controlFrameId = window.requestAnimationFrame(tick);
  };

  tick();
}

function observeMount(mount) {
  if (!armSceneState) {
    return;
  }

  if (armSceneState.mount === mount) {
    return;
  }

  armSceneState.resizeObserver.disconnect();
  armSceneState.mount = mount;
  armSceneState.size = { width: 0, height: 0 };
  armSceneState.resizeObserver.observe(mount);
}

function reattachRendererIfNeeded(mount) {
  if (!armSceneState) {
    return;
  }

  observeMount(mount);

  if (armSceneState.renderer.domElement.parentElement !== mount) {
    mount.appendChild(armSceneState.renderer.domElement);
  }
}

function buildArmObjects(scene) {
  const materials = {
    base: createMaterial(COLORS.warmGray),
    joint: createMaterial(COLORS.ink),
    link: createMaterial(COLORS.teal),
    effector: createMaterial(COLORS.rust),
  };

  const basePlatform = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.35, 0.1, 32),
    materials.base
  );
  basePlatform.position.y = 0.05;
  scene.add(basePlatform);

  const baseGroup = new THREE.Group();
  baseGroup.name = "baseGroup";
  scene.add(baseGroup);

  const baseTurret = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.15, 16),
    materials.base
  );
  baseTurret.position.y = 0.175;
  baseGroup.add(baseTurret);

  const shoulderJoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 16, 16),
    materials.joint
  );
  shoulderJoint.position.y = 0.35;
  baseGroup.add(shoulderJoint);

  const shoulderGroup = new THREE.Group();
  shoulderGroup.name = "shoulderGroup";
  shoulderGroup.position.y = 0.35;
  baseGroup.add(shoulderGroup);

  const upperArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.05, 0.8, 12),
    materials.link
  );
  upperArm.position.y = 0.4;
  shoulderGroup.add(upperArm);

  const elbowJoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 16, 16),
    materials.joint
  );
  elbowJoint.position.y = 0.8;
  shoulderGroup.add(elbowJoint);

  const elbowGroup = new THREE.Group();
  elbowGroup.name = "elbowGroup";
  elbowGroup.position.y = 0.8;
  shoulderGroup.add(elbowGroup);

  const forearm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.04, 0.65, 12),
    materials.link
  );
  forearm.position.y = 0.325;
  elbowGroup.add(forearm);

  const endEffector = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 16, 16),
    materials.effector
  );
  endEffector.position.y = 0.65;
  elbowGroup.add(endEffector);

  return {
    baseGroup,
    shoulderGroup,
    elbowGroup,
  };
}

function createArmScene(mount) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.panelStrong);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(3, 3, 3);
  camera.lookAt(0, 0.8, 0);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(3, 4, 3);
  scene.add(directionalLight);

  const gridHelper = new THREE.GridHelper(4, 10, COLORS.gridCenter, COLORS.gridEdge);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.enableDamping = true;
  controls.autoRotate = false;
  controls.target.set(0, 0.8, 0);
  controls.addEventListener("change", renderScene);
  controls.addEventListener("start", startControlLoop);
  controls.addEventListener("end", () => {
    stopControlLoop();
    controls.update();
    renderScene();
  });
  controls.update();

  const resizeObserver = new ResizeObserver(() => {
    syncRendererSize();
  });

  armSceneState = {
    camera,
    controlFrameId: null,
    controlLoopActive: false,
    controls,
    mount,
    renderer,
    resizeObserver,
    scene,
    size: { width: 0, height: 0 },
    ...buildArmObjects(scene),
  };

  mount.appendChild(renderer.domElement);
  resizeObserver.observe(mount);
  syncRendererSize();
}

function disposeSceneResources(scene) {
  const geometries = new Set();
  const materials = new Set();

  scene.traverse((object) => {
    if (object.geometry) {
      geometries.add(object.geometry);
    }

    if (Array.isArray(object.material)) {
      object.material.forEach((material) => materials.add(material));
    } else if (object.material) {
      materials.add(object.material);
    }
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

export async function updateArmScene(joints) {
  let mount = getMountElement();
  if (!mount) {
    return;
  }

  if (!armSceneState) {
    const loaded = await ensureLibsLoaded();
    mount = getMountElement();
    if (!loaded || !mount) {
      return;
    }
    createArmScene(mount);
    // Force a layout pass so the container has computed dimensions before first render.
    syncRendererSize();
  } else {
    mount = getMountElement();
    if (!mount) {
      return;
    }
    reattachRendererIfNeeded(mount);
    syncRendererSize();
  }

  if (!armSceneState) {
    return;
  }

  armSceneState.baseGroup.rotation.y = Number(joints?.base || 0);
  armSceneState.shoulderGroup.rotation.z = Number(joints?.shoulder || 0);
  armSceneState.elbowGroup.rotation.z = Number(joints?.elbow || 0);
  renderScene();
}

export function destroyArmScene() {
  if (!armSceneState) {
    return;
  }

  stopControlLoop();
  armSceneState.controls.dispose();
  armSceneState.resizeObserver.disconnect();
  disposeSceneResources(armSceneState.scene);
  armSceneState.renderer.dispose();
  armSceneState.renderer.forceContextLoss();

  if (armSceneState.renderer.domElement.parentElement) {
    armSceneState.renderer.domElement.parentElement.removeChild(armSceneState.renderer.domElement);
  }

  armSceneState = null;
}
