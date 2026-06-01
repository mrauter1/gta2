import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.166.0/build/three.module.js";
import { getDistrictWorldLayout, getReactiveActorPose } from "../data/world-layout.js";
import { getActiveObjectivePoint, getDistrictById, isNearVehicle } from "../state/game-state.js";
import { damp } from "../utils/math.js";

const MAP_SIZE = 1000;
const WORLD_OFFSET = MAP_SIZE * 0.5;

function mapToWorld(point, height = 0) {
  return new THREE.Vector3(point.x - WORLD_OFFSET, height, point.y - WORLD_OFFSET);
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function disposeObject(root) {
  root.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }
    if (child.material?.map) {
      child.material.map.dispose();
    }
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose());
    } else if (child.material) {
      child.material.dispose();
    }
  });
}

function makeCanvasTexture(width, height, painter) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  painter(context, canvas);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createGlowSprite(color) {
  const texture = makeCanvasTexture(128, 128, (context, canvas) => {
    const gradient = context.createRadialGradient(
      canvas.width * 0.5,
      canvas.height * 0.5,
      10,
      canvas.width * 0.5,
      canvas.height * 0.5,
      56
    );
    gradient.addColorStop(0, `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, 0.92)`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  });

  return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
}

function createSignPanel(text, background, foreground, width = 72, height = 20, fontSize = 56) {
  const texture = makeCanvasTexture(512, 160, (context, canvas) => {
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, background);
    gradient.addColorStop(1, "#1d2434");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(255, 255, 255, 0.1)";
    context.fillRect(0, 0, canvas.width, 12);
    context.fillStyle = foreground;
    context.font = `bold ${fontSize}px Impact, Arial Black, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width * 0.5, canvas.height * 0.54);
  });

  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: false })
  );
}

function createBillboardPanel(text, background, foreground) {
  const panel = createSignPanel(`BLOCK ${text}`, background, foreground, 110, 55, 70);
  return panel;
}

function createPlayerModel() {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: "#c48a5f", roughness: 0.88 });
  const jacket = new THREE.MeshStandardMaterial({ color: "#14151e", roughness: 0.9 });
  const jeans = new THREE.MeshStandardMaterial({ color: "#1f3a67", roughness: 0.84 });
  const shoe = new THREE.MeshStandardMaterial({ color: "#ececec", roughness: 0.6 });

  const head = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), skin);
  head.position.y = 25;
  head.castShadow = true;
  group.add(head);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(12, 16, 8), jacket);
  torso.position.y = 14;
  torso.castShadow = true;
  group.add(torso);

  const armLeft = new THREE.Mesh(new THREE.BoxGeometry(4, 14, 4), jacket);
  armLeft.position.set(-8, 13, 0);
  armLeft.castShadow = true;
  group.add(armLeft);

  const armRight = armLeft.clone();
  armRight.position.x = 8;
  group.add(armRight);

  const legLeft = new THREE.Mesh(new THREE.BoxGeometry(5, 16, 5), jeans);
  legLeft.position.set(-3.2, 2, 0);
  legLeft.castShadow = true;
  group.add(legLeft);

  const legRight = legLeft.clone();
  legRight.position.x = 3.2;
  group.add(legRight);

  const shoeLeft = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 10), shoe);
  shoeLeft.position.set(-3.2, -7, 2);
  shoeLeft.castShadow = true;
  group.add(shoeLeft);

  const shoeRight = shoeLeft.clone();
  shoeRight.position.x = 3.2;
  group.add(shoeRight);

  return group;
}

function createWheelGeometry() {
  const wheelGeometry = new THREE.CylinderGeometry(4.2, 4.2, 3, 16);
  wheelGeometry.rotateZ(Math.PI * 0.5);
  return wheelGeometry;
}

function addWheels(group, wheelGeometry, wheelMaterial, positions) {
  positions.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.position.set(x, y, z);
    wheel.castShadow = true;
    group.add(wheel);
  });
}

function createSedanModel(bodyColor = "#5c6875", variant = "sedan") {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.68, metalness: 0.12 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: "#1b232b", roughness: 0.8 });
  const glassMaterial = new THREE.MeshStandardMaterial({ color: "#111920", roughness: 0.12, metalness: 0.18 });
  const wheelGeometry = createWheelGeometry();
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: "#1d1c21", roughness: 0.92 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(32, 7, 18), bodyMaterial);
  base.position.y = 6;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 14), bodyMaterial);
  cabin.position.set(-2, 11, 0);
  cabin.castShadow = true;
  group.add(cabin);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 14), bodyMaterial);
  hood.position.set(12, 9, 0);
  hood.castShadow = true;
  group.add(hood);

  const roofGlass = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 12), glassMaterial);
  roofGlass.position.set(-2, 12, 0);
  group.add(roofGlass);

  const bumperFront = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 16), darkMaterial);
  bumperFront.position.set(17, 5, 0);
  group.add(bumperFront);

  const bumperRear = bumperFront.clone();
  bumperRear.position.x = -17;
  group.add(bumperRear);

  addWheels(group, wheelGeometry, wheelMaterial, [
    [10, 2, 9],
    [10, 2, -9],
    [-10, 2, 9],
    [-10, 2, -9],
  ]);

  if (variant === "taxi") {
    const topper = createSignPanel("TAXI", "#2b2f36", "#f1cb58", 8, 3.2, 46);
    topper.position.set(-1, 15.5, 0);
    group.add(topper);
  }

  if (variant === "patrol") {
    const doorBand = new THREE.Mesh(new THREE.BoxGeometry(12, 6.8, 18.4), new THREE.MeshStandardMaterial({
      color: "#eceff4",
      roughness: 0.58,
      metalness: 0.08,
    }));
    doorBand.position.set(-1, 6.2, 0);
    group.add(doorBand);

    const lightBar = new THREE.Mesh(
      new THREE.BoxGeometry(8, 1.8, 3.6),
      new THREE.MeshStandardMaterial({ color: "#8ec8ff", emissive: "#4fb2ff", emissiveIntensity: 0.5 })
    );
    lightBar.position.set(-1, 15.4, 0);
    group.add(lightBar);
  }

  return group;
}

function createHatchModel(bodyColor = "#d1564d") {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.68, metalness: 0.1 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: "#1b232b", roughness: 0.8 });
  const glassMaterial = new THREE.MeshStandardMaterial({ color: "#111920", roughness: 0.12, metalness: 0.18 });
  const wheelGeometry = createWheelGeometry();
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: "#1d1c21", roughness: 0.92 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(28, 7, 18), bodyMaterial);
  base.position.y = 6;
  base.castShadow = true;
  group.add(base);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 15), bodyMaterial);
  cabin.position.set(-3, 11, 0);
  cabin.castShadow = true;
  group.add(cabin);

  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 13), glassMaterial);
  rearGlass.position.set(-9, 12, 0);
  group.add(rearGlass);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 14), bodyMaterial);
  nose.position.set(11, 9, 0);
  group.add(nose);

  addWheels(group, wheelGeometry, wheelMaterial, [
    [9, 2, 9],
    [9, 2, -9],
    [-8, 2, 9],
    [-8, 2, -9],
  ]);

  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 16), darkMaterial);
  bumper.position.set(15, 5, 0);
  group.add(bumper);
  const rear = bumper.clone();
  rear.position.x = -15;
  group.add(rear);

  return group;
}

function createVanModel(bodyColor = "#bfbec8") {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.72, metalness: 0.08 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: "#22262d", roughness: 0.82 });
  const wheelGeometry = createWheelGeometry();
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: "#1d1c21", roughness: 0.92 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(30, 7, 18), bodyMaterial);
  base.position.y = 6;
  base.castShadow = true;
  group.add(base);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 16), bodyMaterial);
  cabin.position.set(-2, 13, 0);
  cabin.castShadow = true;
  group.add(cabin);

  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(10, 6, 14),
    new THREE.MeshStandardMaterial({ color: "#111920", roughness: 0.18, metalness: 0.22 })
  );
  windshield.position.set(7, 13, 0);
  group.add(windshield);

  addWheels(group, wheelGeometry, wheelMaterial, [
    [10, 2, 9],
    [10, 2, -9],
    [-10, 2, 9],
    [-10, 2, -9],
  ]);

  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 16), darkMaterial);
  bumper.position.set(16, 5, 0);
  group.add(bumper);
  const rear = bumper.clone();
  rear.position.x = -16;
  group.add(rear);

  return group;
}

function createPickupModel(bodyColor = "#b77f4a") {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.68, metalness: 0.1 });
  const wheelGeometry = createWheelGeometry();
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: "#1d1c21", roughness: 0.92 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(32, 7, 18), bodyMaterial);
  base.position.y = 6;
  base.castShadow = true;
  group.add(base);

  const cab = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 14), bodyMaterial);
  cab.position.set(-6, 12, 0);
  cab.castShadow = true;
  group.add(cab);

  const bedWall = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 16), bodyMaterial);
  bedWall.position.set(9, 10, 0);
  group.add(bedWall);

  const cargo = new THREE.Mesh(
    new THREE.BoxGeometry(10, 5, 14),
    new THREE.MeshStandardMaterial({ color: "#4c4136", roughness: 0.95 })
  );
  cargo.position.set(9, 9, 0);
  group.add(cargo);

  addWheels(group, wheelGeometry, wheelMaterial, [
    [11, 2, 9],
    [11, 2, -9],
    [-10, 2, 9],
    [-10, 2, -9],
  ]);

  return group;
}

function createVehicleModel(type = "sedan", color = "#5c6875") {
  switch (type) {
    case "hatch":
      return createHatchModel(color);
    case "van":
      return createVanModel(color);
    case "pickup":
      return createPickupModel(color);
    case "taxi":
      return createSedanModel(color, "taxi");
    case "patrol":
      return createSedanModel(color, "patrol");
    default:
      return createSedanModel(color, "sedan");
  }
}

function createMarker(colorHex, width = 10) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.22,
    transparent: true,
    opacity: 0.86,
  });
  const column = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.35, width * 0.35, 28, 16), material);
  column.position.y = 15;
  group.add(column);

  const cube = new THREE.Mesh(new THREE.BoxGeometry(width, width, width), material);
  cube.position.y = 34;
  group.add(cube);

  const glow = createGlowSprite(new THREE.Color(colorHex));
  glow.scale.set(width * 5, width * 5, 1);
  glow.position.y = 18;
  group.add(glow);

  return group;
}

function makePedestrian(colorHex) {
  const pedestrian = createPlayerModel();
  pedestrian.scale.setScalar(0.46);
  pedestrian.traverse((child) => {
    if (child.isMesh && child.material?.color) {
      child.material = child.material.clone();
      if (child.material.color.getHexString() === "14151e") {
        child.material.color.set(colorHex);
      }
    }
  });
  return pedestrian;
}

function createStructureMesh(structure) {
  const group = new THREE.Group();
  const basePosition = mapToWorld({ x: structure.x + structure.w * 0.5, y: structure.y + structure.h * 0.5 }, 0);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: structure.color, roughness: 0.94 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: structure.roofColor, roughness: 0.84 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: structure.accentColor, roughness: 0.62, metalness: 0.04 });

  if (structure.kind === "boundary-wall") {
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(structure.w, structure.height, structure.h), bodyMaterial);
    barrier.position.y = structure.height * 0.5;
    barrier.castShadow = true;
    barrier.receiveShadow = true;
    group.add(barrier);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(10, structure.w * 0.92), 2.4, Math.max(10, structure.h * 0.92)),
      roofMaterial
    );
    cap.position.y = structure.height + 1.2;
    group.add(cap);

    const stripeLong = structure.w >= structure.h;
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(
        stripeLong ? Math.max(16, structure.w * 0.86) : 3,
        1.2,
        stripeLong ? 3 : Math.max(16, structure.h * 0.86)
      ),
      new THREE.MeshStandardMaterial({ color: "#d9b766", roughness: 0.52, emissive: "#8a6730", emissiveIntensity: 0.08 })
    );
    stripe.position.set(
      0,
      structure.height * 0.58,
      stripeLong ? 0 : 0
    );
    if (stripeLong) {
      stripe.position.z = structure.h * 0.18;
    } else {
      stripe.position.x = structure.w * 0.18;
    }
    group.add(stripe);
  } else if (structure.kind === "civic") {
    const pillarWidth = structure.w * 0.24;
    const pillarDepth = structure.h * 0.78;
    const pillarHeight = structure.height * 0.72;
    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(pillarWidth, pillarHeight, pillarDepth), bodyMaterial);
    leftPillar.position.set(-structure.w * 0.3, pillarHeight * 0.5, 0);
    leftPillar.castShadow = true;
    const rightPillar = leftPillar.clone();
    rightPillar.position.x *= -1;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(structure.w, structure.height * 0.18, pillarDepth), accentMaterial);
    lintel.position.set(0, structure.height * 0.8, 0);
    lintel.castShadow = true;
    group.add(leftPillar, rightPillar, lintel);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(structure.w, structure.height, structure.h), bodyMaterial);
    body.position.y = structure.height * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    if (structure.roofStyle === "cap") {
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(structure.w * 0.4, 10, structure.h * 0.4),
        roofMaterial
      );
      cap.position.y = structure.height + 5;
      cap.castShadow = true;
      group.add(cap);
    }
  }

  if (structure.awningColor) {
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(structure.w * 0.7, 4, 12),
      new THREE.MeshStandardMaterial({ color: structure.awningColor, roughness: 0.7 })
    );
    awning.position.set(0, Math.min(structure.height * 0.56, structure.height - 10), structure.h * 0.5 + 5);
    group.add(awning);
  }

  if (structure.signText) {
    const sign = createSignPanel(
      structure.signText,
      structure.signBackground,
      structure.signColor,
      Math.min(92, structure.w * 0.78),
      18
    );
    sign.position.set(0, Math.min(structure.height * 0.72, structure.height - 8), structure.h * 0.5 + 0.6);
    group.add(sign);
  }

  group.position.copy(basePosition);
  return group;
}

function createSurfaceMesh(surface) {
  const group = new THREE.Group();
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(surface.w, 0.8, surface.h),
    new THREE.MeshStandardMaterial({ color: surface.color, roughness: 0.98 })
  );
  slab.position.y = 0.28;
  slab.receiveShadow = true;
  group.add(slab);

  if (surface.kind === "plaza" || surface.kind === "civic") {
    for (let index = -2; index <= 2; index += 1) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(surface.w * 0.9, 0.2, 1.8),
        new THREE.MeshStandardMaterial({ color: surface.accentColor, emissive: surface.accentColor, emissiveIntensity: 0.04 })
      );
      stripe.position.set(0, 0.62, index * (surface.h * 0.14));
      group.add(stripe);
    }
  }

  if (surface.kind === "parking") {
    for (let index = -3; index <= 3; index += 1) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.15, surface.h * 0.7),
        new THREE.MeshStandardMaterial({ color: surface.accentColor, roughness: 0.6 })
      );
      line.position.set(index * (surface.w * 0.12), 0.56, 0);
      group.add(line);
    }
  }

  if (surface.kind === "service" || surface.kind === "yard") {
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(surface.w * 0.9, 0.2, 2.4),
      new THREE.MeshStandardMaterial({ color: surface.accentColor, roughness: 0.6 })
    );
    edge.position.set(0, 0.56, -surface.h * 0.34);
    group.add(edge);
  }

  group.position.copy(mapToWorld({ x: surface.x + surface.w * 0.5, y: surface.y + surface.h * 0.5 }, 0));
  return group;
}

function createPropMesh(prop) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: prop.color, roughness: 0.9 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: prop.accentColor, roughness: 0.68 });

  if (prop.kind === "hydrant") {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.8, 9, 10), bodyMaterial);
    stem.position.y = 5;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(3.4, 10, 10), accentMaterial);
    cap.position.y = 10;
    group.add(stem, cap);
  } else if (prop.kind === "crate-stack") {
    const base = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 10), bodyMaterial);
    base.position.y = 3.6;
    const top = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 8), accentMaterial);
    top.position.set(2, 9, -1);
    group.add(base, top);
  } else if (prop.kind === "fountain") {
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(14, 16, 4, 18), bodyMaterial);
    basin.position.y = 2;
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 10, 1.2, 18),
      new THREE.MeshStandardMaterial({ color: "#8fe6ff", roughness: 0.3, metalness: 0.06 })
    );
    water.position.y = 4.2;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 10, 8), accentMaterial);
    core.position.y = 7;
    group.add(basin, water, core);
  } else if (prop.kind === "palm") {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, prop.height, 8), bodyMaterial);
    trunk.position.y = prop.height * 0.5;
    group.add(trunk);
    for (let index = 0; index < 5; index += 1) {
      const frond = new THREE.Mesh(
        new THREE.BoxGeometry(16, 1.4, 4),
        new THREE.MeshStandardMaterial({ color: prop.accentColor, roughness: 0.78 })
      );
      frond.position.y = prop.height + 1;
      frond.rotation.y = (Math.PI * 2 * index) / 5;
      frond.rotation.z = 0.28;
      frond.position.x = Math.cos(frond.rotation.y) * 4;
      frond.position.z = Math.sin(frond.rotation.y) * 4;
      group.add(frond);
    }
  } else if (prop.kind === "water-tower") {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(11, 13, 18, 12), bodyMaterial);
    tank.position.y = prop.height;
    group.add(tank);
    for (let index = 0; index < 4; index += 1) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.8, prop.height, 1.8), accentMaterial);
      const angle = (Math.PI * 2 * index) / 4;
      leg.position.set(Math.cos(angle) * 8, prop.height * 0.5, Math.sin(angle) * 8);
      group.add(leg);
    }
  } else if (prop.kind === "bin") {
    const bin = new THREE.Mesh(new THREE.BoxGeometry(9, 13, 9), bodyMaterial);
    bin.position.y = 6.6;
    group.add(bin);
  } else {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, prop.height, 10), bodyMaterial);
    bollard.position.y = prop.height * 0.5;
    group.add(bollard);
  }

  group.position.copy(mapToWorld(prop, 0));
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return group;
}

function createStreetlight(horizontal) {
  const group = new THREE.Group();
  const poleMaterial = new THREE.MeshStandardMaterial({ color: "#303038", roughness: 0.92 });
  const lampMaterial = new THREE.MeshStandardMaterial({ color: "#ffe3a2", emissive: "#ffcc6a", emissiveIntensity: 0.35 });
  const pole = new THREE.Mesh(new THREE.BoxGeometry(2.8, 36, 2.8), poleMaterial);
  pole.position.y = 18;
  pole.castShadow = true;
  group.add(pole);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? 12 : 2.8, 2.2, horizontal ? 2.8 : 12), poleMaterial);
  arm.position.set(horizontal ? 5 : 0, 34, horizontal ? 0 : 5);
  arm.castShadow = true;
  group.add(arm);

  const lamp = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 3.6), lampMaterial);
  lamp.position.set(horizontal ? 10 : 0, 33, horizontal ? 0 : 10);
  group.add(lamp);

  const glow = createGlowSprite(new THREE.Color("#ffd77a"));
  glow.scale.set(12, 12, 1);
  glow.position.set(horizontal ? 10 : 0, 32, horizontal ? 0 : 10);
  group.add(glow);
  return group;
}

export function createWorldRenderer(canvas) {
  canvas.dataset.engine = "three.js r166";

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f29c6a");
  scene.fog = new THREE.Fog("#d87d57", 260, 1300);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 3200);
  const cameraPosition = new THREE.Vector3(0, 82, 150);
  const cameraTarget = new THREE.Vector3(0, 22, 0);

  const ambientLight = new THREE.HemisphereLight("#ffe4b8", "#4a3027", 1.8);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight("#ffd89e", 2.8);
  sunLight.position.set(180, 280, 120);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -360;
  sunLight.shadow.camera.right = 360;
  sunLight.shadow.camera.top = 360;
  sunLight.shadow.camera.bottom = -360;
  scene.add(sunLight);

  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(1800, 32, 16),
    new THREE.MeshBasicMaterial({
      map: makeCanvasTexture(16, 512, (context, domeCanvas) => {
        const gradient = context.createLinearGradient(0, 0, 0, domeCanvas.height);
        gradient.addColorStop(0, "#ef9465");
        gradient.addColorStop(0.5, "#ffc171");
        gradient.addColorStop(1, "#83524b");
        context.fillStyle = gradient;
        context.fillRect(0, 0, domeCanvas.width, domeCanvas.height);
      }),
      side: THREE.BackSide,
    })
  );
  scene.add(skyDome);

  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(34, 18, 18),
    new THREE.MeshBasicMaterial({ color: "#ffeec5" })
  );
  sunMesh.position.set(-320, 230, -620);
  scene.add(sunMesh);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1300, 1300),
    new THREE.MeshStandardMaterial({ color: "#556646", roughness: 1 })
  );
  ground.rotation.x = -Math.PI * 0.5;
  ground.receiveShadow = true;
  scene.add(ground);

  const worldRoot = new THREE.Group();
  scene.add(worldRoot);

  const playerGroup = createPlayerModel();
  playerGroup.scale.setScalar(0.64);
  worldRoot.add(playerGroup);

  let heroVehicleRoot = new THREE.Group();
  worldRoot.add(heroVehicleRoot);
  let activeHeroVehicleKey = "";

  const vehicleAura = new THREE.Mesh(
    new THREE.RingGeometry(11, 15, 32),
    new THREE.MeshBasicMaterial({ color: "#f4cf68", transparent: true, opacity: 0.72, side: THREE.DoubleSide })
  );
  vehicleAura.rotation.x = -Math.PI * 0.5;
  vehicleAura.position.y = 0.3;
  worldRoot.add(vehicleAura);

  const objectiveBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 6, 110, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: "#ffd95c", transparent: true, opacity: 0.3, side: THREE.DoubleSide })
  );
  worldRoot.add(objectiveBeam);

  const homeBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 7, 96, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: "#66df87", transparent: true, opacity: 0.28, side: THREE.DoubleSide })
  );
  worldRoot.add(homeBeam);

  const searchBeams = [0, 1].map(() => {
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(18, 22, 20, 28, 1, true),
      new THREE.MeshBasicMaterial({ color: "#f15564", transparent: true, opacity: 0.16, side: THREE.DoubleSide })
    );
    beam.visible = false;
    worldRoot.add(beam);
    return beam;
  });

  const muzzleFlash = createGlowSprite(new THREE.Color("#ffd66e"));
  muzzleFlash.scale.set(16, 16, 1);
  muzzleFlash.visible = false;
  worldRoot.add(muzzleFlash);

  const impactSpark = createGlowSprite(new THREE.Color("#ff9f64"));
  impactSpark.scale.set(14, 14, 1);
  impactSpark.visible = false;
  worldRoot.add(impactSpark);

  const shotTrace = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, 1, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: "#ffe198", transparent: true, opacity: 0.92 })
  );
  shotTrace.visible = false;
  worldRoot.add(shotTrace);

  let districtGroup = new THREE.Group();
  let activeDistrictId = null;
  let activeQuality = null;
  const trafficActors = [];
  const pedestrianActors = [];
  const markerActors = [];

  function replaceHeroVehicle(type, color) {
    const key = `${type}:${color}`;
    if (key === activeHeroVehicleKey) {
      return;
    }

    worldRoot.remove(heroVehicleRoot);
    disposeObject(heroVehicleRoot);
    heroVehicleRoot = new THREE.Group();
    heroVehicleRoot.add(createVehicleModel(type, color));
    worldRoot.add(heroVehicleRoot);
    activeHeroVehicleKey = key;
  }

  function clearDistrictGroup() {
    worldRoot.remove(districtGroup);
    disposeObject(districtGroup);
    districtGroup = new THREE.Group();
    worldRoot.add(districtGroup);
    trafficActors.length = 0;
    pedestrianActors.length = 0;
    markerActors.length = 0;
  }

  function addRoad(road) {
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(road.w + 20, 1.2, road.h + 20),
      new THREE.MeshStandardMaterial({ color: "#6e645a", roughness: 1 })
    );
    const roadSurface = new THREE.Mesh(
      new THREE.BoxGeometry(road.w, 1.8, road.h),
      new THREE.MeshStandardMaterial({ color: "#2b2d31", roughness: 1 })
    );

    const center = mapToWorld({ x: road.x + road.w * 0.5, y: road.y + road.h * 0.5 }, 0);
    sidewalk.position.copy(center);
    sidewalk.position.y = 0.3;
    roadSurface.position.copy(center);
    roadSurface.position.y = 0.7;
    sidewalk.receiveShadow = true;
    roadSurface.receiveShadow = true;
    districtGroup.add(sidewalk, roadSurface);

    const horizontal = road.w >= road.h;
    const markerCount = horizontal ? Math.floor(road.w / 54) : Math.floor(road.h / 54);
    for (let index = 0; index < markerCount; index += 1) {
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 20 : 1.5, 0.4, horizontal ? 1.5 : 20),
        new THREE.MeshStandardMaterial({ color: "#d3a94d", emissive: "#5d3e10", emissiveIntensity: 0.08 })
      );
      marker.position.copy(center);
      marker.position.y = 1.5;
      if (horizontal) {
        marker.position.x = road.x - WORLD_OFFSET + 28 + index * 54;
      } else {
        marker.position.z = road.y - WORLD_OFFSET + 28 + index * 54;
      }
      districtGroup.add(marker);
    }
  }

  function buildStreetlights(district) {
    district.roads.forEach((road, roadIndex) => {
      const horizontal = road.w >= road.h;
      const length = horizontal ? road.w : road.h;
      const step = Math.max(120, Math.floor(length / 4));
      for (let offset = 80; offset < length - 60; offset += step) {
        const lightA = createStreetlight(horizontal);
        const lightB = createStreetlight(horizontal);
        if (horizontal) {
          lightA.position.copy(mapToWorld({ x: road.x + offset, y: road.y - 18 }, 0));
          lightB.position.copy(mapToWorld({ x: road.x + offset + (roadIndex % 2 === 0 ? 42 : 0), y: road.y + road.h + 18 }, 0));
          lightB.rotation.y = Math.PI;
        } else {
          lightA.position.copy(mapToWorld({ x: road.x - 18, y: road.y + offset }, 0));
          lightA.rotation.y = Math.PI * 0.5;
          lightB.position.copy(mapToWorld({ x: road.x + road.w + 18, y: road.y + offset + (roadIndex % 2 === 0 ? 32 : 0) }, 0));
          lightB.rotation.y = -Math.PI * 0.5;
        }
        districtGroup.add(lightA, lightB);
      }
    });
  }

  function buildHomeAndMarkers(district) {
    const homeMarker = createMarker("#67dd7f", 12);
    homeMarker.position.copy(mapToWorld(district.homePoint));
    markerActors.push({ group: homeMarker, point: district.homePoint });
    districtGroup.add(homeMarker);

    district.missionPoints.forEach((point) => {
      const color = point.kind === "pickup"
        ? "#cc78ff"
        : point.kind === "dropoff"
          ? "#ffd55c"
          : point.kind === "cooldown"
            ? "#6dd79d"
            : "#67c4ff";
      const marker = createMarker(color, point.kind === "checkpoint" ? 9 : 11);
      marker.position.copy(mapToWorld(point));
      markerActors.push({ group: marker, point });
      districtGroup.add(marker);
    });
  }

  function buildBillboards(district) {
    const sign = createBillboardPanel("CITY", district.previewAccent, "#f9c553");
    sign.position.copy(mapToWorld({ x: 575, y: 365 }, 90));
    sign.lookAt(new THREE.Vector3(300, 90, -440));
    districtGroup.add(sign);

    const pole = new THREE.Mesh(
      new THREE.BoxGeometry(6, 92, 6),
      new THREE.MeshStandardMaterial({ color: "#303038", roughness: 1 })
    );
    pole.position.copy(mapToWorld({ x: 575, y: 365 }, 44));
    pole.castShadow = true;
    districtGroup.add(pole);
  }

  function addTrafficActors(layout) {
    layout.trafficActors.forEach((actor) => {
      const mesh = createVehicleModel(actor.type, actor.color);
      mesh.scale.setScalar(actor.type === "van" ? 0.92 : 0.88);
      districtGroup.add(mesh);
      const lightBar = actor.type === "patrol" ? mesh.children.find((child) => child.geometry?.parameters?.width === 8) : null;
      trafficActors.push({ config: actor, mesh, lightBar });
    });
  }

  function addPedestrianActors(layout) {
    layout.pedestrianActors.forEach((actor) => {
      const mesh = makePedestrian(actor.color);
      districtGroup.add(mesh);
      pedestrianActors.push({ config: actor, mesh });
    });
  }

  function buildDistrict(district) {
    clearDistrictGroup();
    const layout = getDistrictWorldLayout(district);

    district.roads.forEach(addRoad);
    layout.surfaces.forEach((surface) => districtGroup.add(createSurfaceMesh(surface)));
    layout.structures.forEach((structure) => districtGroup.add(createStructureMesh(structure)));
    layout.props.forEach((prop) => districtGroup.add(createPropMesh(prop)));
    layout.staticVehicles.forEach((vehicle) => {
      const mesh = createVehicleModel(vehicle.type, vehicle.color);
      mesh.position.copy(mapToWorld(vehicle, 0));
      mesh.rotation.y = -vehicle.angle;
      districtGroup.add(mesh);
    });
    buildStreetlights(district);
    buildHomeAndMarkers(district);
    buildBillboards(district);
    addTrafficActors(layout);
    addPedestrianActors(layout);
    activeDistrictId = district.id;
  }

  function applyGraphicsQuality(quality, touchMode) {
    const normalized = quality || "auto";
    const dpr = window.devicePixelRatio || 1;
    const pixelRatio = normalized === "low"
      ? Math.min(1, dpr)
      : normalized === "high"
        ? Math.min(2, dpr)
        : Math.min(touchMode ? 1.2 : 1.6, dpr);

    if (activeQuality === `${normalized}-${touchMode}`) {
      return;
    }

    renderer.setPixelRatio(pixelRatio);
    renderer.shadowMap.enabled = normalized !== "low";
    sunLight.castShadow = normalized !== "low";
    activeQuality = `${normalized}-${touchMode}`;
  }

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }

  function updateMarkers(state, elapsed) {
    const objective = getActiveObjectivePoint(state);
    const objectivePosition = mapToWorld(objective, 56);
    objectiveBeam.position.copy(objectivePosition);
    objectiveBeam.scale.setScalar(1 + Math.sin(elapsed * 5) * 0.08 + state.session.ui.routePulseTimer * 0.06);

    const district = getDistrictById(state.session.districtId);
    homeBeam.position.copy(mapToWorld(district.homePoint, 48));
    homeBeam.visible = state.session.ui.homePingTimer > 0.02;
    homeBeam.scale.setScalar(1 + Math.sin(elapsed * 6) * 0.1);

    state.session.searchZones.forEach((zone, index) => {
      const beam = searchBeams[index];
      if (!beam) {
        return;
      }
      beam.visible = zone.active;
      if (!zone.active) {
        return;
      }
      beam.position.copy(mapToWorld(zone, 12));
      beam.scale.set(
        Math.max(1, zone.radius / 24 + Math.sin(elapsed * 4 + index) * 0.2),
        1,
        Math.max(1, zone.radius / 24 + Math.cos(elapsed * 4 + index) * 0.2)
      );
      beam.material.opacity = 0.12 + zone.pressure * 0.035;
    });

    markerActors.forEach((markerActor, index) => {
      markerActor.group.position.y = 2 + Math.sin(elapsed * 2.6 + index) * 1.8;
      const isObjective = markerActor.point.id && markerActor.point.id === objective.id;
      markerActor.group.scale.setScalar(isObjective ? 1.08 : 0.92);
    });
  }

  function updateCombatEffects(state, elapsed) {
    const combat = state.session.combat;
    const pulse = 1 + Math.sin(elapsed * 22) * 0.18;

    muzzleFlash.visible = combat.muzzleTimer > 0.01 && state.session.mode === "foot";
    if (muzzleFlash.visible) {
      const aimAngle = state.session.player.angle;
      muzzleFlash.position.copy(mapToWorld({
        x: state.session.player.x + Math.cos(aimAngle) * 12,
        y: state.session.player.y + Math.sin(aimAngle) * 12,
      }, 14));
      muzzleFlash.scale.setScalar(12 * pulse);
      muzzleFlash.material.opacity = 0.72 * Math.max(0.2, combat.muzzleTimer / 0.1);
    }

    impactSpark.visible = combat.impactTimer > 0.01 && Boolean(combat.lastImpact);
    if (impactSpark.visible && combat.lastImpact) {
      impactSpark.position.copy(mapToWorld(combat.lastImpact, 8));
      impactSpark.scale.setScalar((12 + Math.sin(elapsed * 18) * 2) * Math.max(0.5, combat.impactTimer / 0.2));
      impactSpark.material.opacity = 0.68 * Math.max(0.3, combat.impactTimer / 0.2);
    }

    shotTrace.visible = combat.traceTimer > 0.01 && Boolean(combat.lastTrace);
    if (shotTrace.visible && combat.lastTrace) {
      const start = mapToWorld({ x: combat.lastTrace.startX, y: combat.lastTrace.startY }, 11);
      const end = mapToWorld({ x: combat.lastTrace.endX, y: combat.lastTrace.endY }, 11);
      const direction = end.clone().sub(start);
      const distance = Math.max(0.001, direction.length());
      shotTrace.position.copy(start.clone().add(end).multiplyScalar(0.5));
      shotTrace.scale.set(1, distance, 1);
      shotTrace.material.opacity = 0.9 * Math.max(0.2, combat.traceTimer / 0.12);
      shotTrace.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    }
  }

  function updateActors(state, elapsed, deltaSeconds) {
    replaceHeroVehicle(state.session.vehicle.type, state.session.vehicle.color);

    const playerPosition = mapToWorld(state.session.player, 6);
    playerGroup.position.copy(playerPosition);
    playerGroup.rotation.y = -state.session.player.angle + Math.PI * 0.5;
    playerGroup.visible = state.session.mode !== "vehicle";

    const vehiclePosition = mapToWorld(state.session.vehicle, 0);
    heroVehicleRoot.position.copy(vehiclePosition);
    heroVehicleRoot.rotation.y = -state.session.vehicle.angle;
    heroVehicleRoot.rotation.z = state.session.ui.collisionPulseTimer > 0 ? Math.sin(elapsed * 32) * 0.02 : 0;

    vehicleAura.position.copy(vehiclePosition);
    vehicleAura.visible = state.session.mode !== "vehicle" && isNearVehicle(state) && !state.session.failureState;
    vehicleAura.material.opacity = 0.45 + Math.sin(elapsed * 6) * 0.18;

    trafficActors.forEach((actor) => {
      const pose = getReactiveActorPose(actor.config, state.session.clock, state.session.combat.actorReactions);
      actor.mesh.position.copy(mapToWorld(pose, 0));
      actor.mesh.rotation.y = -pose.angle;
      if (actor.lightBar) {
        const alertTimer = state.session.combat.actorReactions?.[actor.config.id]?.alertTimer || 0;
        actor.lightBar.material.emissiveIntensity = alertTimer > 0 || state.session.combat.patrolAlertTimer > 0 || state.session.ui.heat >= 3
          ? (0.22 + Math.sin(elapsed * 14) * 0.28)
          : 0.12;
      }
    });

    pedestrianActors.forEach((actor, index) => {
      const pose = getReactiveActorPose(actor.config, state.session.clock, state.session.combat.actorReactions);
      actor.mesh.visible = !pose.hidden;
      if (pose.hidden) {
        return;
      }
      actor.mesh.position.copy(mapToWorld(pose, 0));
      actor.mesh.rotation.y = -pose.angle + Math.PI * 0.5;
      actor.mesh.position.y = 0.5 + Math.abs(Math.sin(elapsed * 5 + index)) * 0.4;
    });

    const inVehicle = state.session.mode === "vehicle";
    const actorPoint = inVehicle ? state.session.vehicle : state.session.player;
    const actorHeading = inVehicle ? state.session.vehicle.angle : state.session.player.angle;
    const viewHeading = inVehicle
      ? actorHeading + state.session.ui.cameraYaw * 0.82 - 0.7
      : normalizeAngle(state.session.ui.cameraYaw);
    const actorWorld = mapToWorld(actorPoint, inVehicle ? 8 : 9);
    const followDistance = inVehicle ? 148 : 132;
    const followHeight = inVehicle ? 58 : 38;
    const followYaw = viewHeading + Math.PI;
    const targetLead = inVehicle ? 52 : 30;
    const targetHeight = inVehicle ? 16 : 13;
    const desiredPosition = new THREE.Vector3(
      actorWorld.x + Math.cos(followYaw) * followDistance,
      followHeight + (state.session.failureState ? 16 : 0),
      actorWorld.z + Math.sin(followYaw) * followDistance
    );
    const desiredTarget = new THREE.Vector3(
      actorWorld.x + Math.cos(viewHeading) * targetLead,
      targetHeight,
      actorWorld.z + Math.sin(viewHeading) * targetLead
    );

    cameraPosition.x = damp(cameraPosition.x, desiredPosition.x, 5.4, deltaSeconds);
    cameraPosition.y = damp(cameraPosition.y, desiredPosition.y, 5.4, deltaSeconds);
    cameraPosition.z = damp(cameraPosition.z, desiredPosition.z, 5.4, deltaSeconds);
    cameraTarget.x = damp(cameraTarget.x, desiredTarget.x, 6.1, deltaSeconds);
    cameraTarget.y = damp(cameraTarget.y, desiredTarget.y, 6.1, deltaSeconds);
    cameraTarget.z = damp(cameraTarget.z, desiredTarget.z, 6.1, deltaSeconds);

    camera.position.copy(cameraPosition);
    camera.lookAt(cameraTarget);
    updateCombatEffects(state, elapsed);
  }

  return {
    update(state, elapsed, deltaSeconds) {
      applyGraphicsQuality(state.settings.graphicsQuality, state.touchMode);
      resize();
      const district = getDistrictById(state.session.districtId);
      if (district.id !== activeDistrictId) {
        buildDistrict(district);
      }
      updateMarkers(state, elapsed);
      updateActors(state, elapsed, deltaSeconds);
      renderer.render(scene, camera);
    },
  };
}
