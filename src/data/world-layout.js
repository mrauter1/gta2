import { seededFloat, wrap } from "../utils/math.js";

const layoutCache = new Map();
const BLOCK_STEP = 110;

export const WORLD_PLAY_AREA = Object.freeze({
  minX: 44,
  minY: 44,
  maxX: 956,
  maxY: 956,
  barrierThickness: 30,
});

function makeStructure(id, kind, x, y, w, h, options = {}) {
  return {
    id,
    kind,
    x,
    y,
    w,
    h,
    height: options.height ?? 56,
    color: options.color ?? "#75645c",
    roofColor: options.roofColor ?? "#313039",
    accentColor: options.accentColor ?? "#f4c95a",
    signText: options.signText ?? "",
    signColor: options.signColor ?? "#f2c85d",
    signBackground: options.signBackground ?? "#203146",
    landmark: Boolean(options.landmark),
    solid: options.solid ?? true,
    roofStyle: options.roofStyle ?? "flat",
    awningColor: options.awningColor ?? null,
  };
}

function makeSurface(id, kind, x, y, w, h, options = {}) {
  return {
    id,
    kind,
    x,
    y,
    w,
    h,
    color: options.color ?? "#6f685a",
    accentColor: options.accentColor ?? "#f4c95a",
    solid: false,
  };
}

function makeProp(id, kind, x, y, options = {}) {
  return {
    id,
    kind,
    x,
    y,
    radius: options.radius ?? 8,
    height: options.height ?? 18,
    color: options.color ?? "#58614b",
    accentColor: options.accentColor ?? "#f15a5f",
    solid: options.solid ?? true,
  };
}

function makeStaticVehicle(id, x, y, angle, type, color, options = {}) {
  return {
    id,
    x,
    y,
    angle,
    type,
    color,
    label: options.label ?? type,
    radius: options.radius ?? 18,
  };
}

function makeActor(id, axis, min, max, lane, speed, direction, offset, type, color, options = {}) {
  return {
    id,
    axis,
    min,
    max,
    lane,
    speed,
    direction,
    offset,
    type,
    color,
    radius: options.radius ?? 16,
    heading: options.heading ?? null,
  };
}

function makeWalker(id, axis, min, max, lane, speed, direction, offset, outfitColor, options = {}) {
  return {
    id,
    axis,
    min,
    max,
    lane,
    speed,
    direction,
    offset,
    color: outfitColor,
    radius: options.radius ?? 8,
    heading: options.heading ?? null,
  };
}

function overlaps(rectA, rectB, margin = 0) {
  return !(
    rectA.x + rectA.w + margin <= rectB.x ||
    rectB.x + rectB.w + margin <= rectA.x ||
    rectA.y + rectA.h + margin <= rectB.y ||
    rectB.y + rectB.h + margin <= rectA.y
  );
}

function touchesRoadMargin(rect, roads, margin = 24) {
  return roads.some((road) => overlaps(rect, road, margin));
}

function buildProceduralStructures(district, reservedRects) {
  const structures = [];
  const surfaces = [];
  const palette = ["#8a6b5e", "#705752", "#596671", "#617357", district.skylineTint];

  for (let gridX = 55; gridX < 960; gridX += BLOCK_STEP) {
    for (let gridY = 55; gridY < 960; gridY += BLOCK_STEP) {
      const seed = seededFloat(`${district.seed}-${gridX}-${gridY}`);
      const width = 42 + Math.floor(seed * 22);
      const depth = 38 + Math.floor(seed * 16);
      const rect = {
        x: gridX - width * 0.5,
        y: gridY - depth * 0.5,
        w: width,
        h: depth,
      };

      if (touchesRoadMargin(rect, district.roads, 26) || reservedRects.some((reserved) => overlaps(rect, reserved, 18))) {
        continue;
      }

      if (seed > 0.86) {
        surfaces.push(
          makeSurface(
            `micro-plaza-${gridX}-${gridY}`,
            "planter",
            rect.x - 6,
            rect.y - 6,
            rect.w + 12,
            rect.h + 12,
            { color: "#6b7751", accentColor: "#a3db72" }
          )
        );
        continue;
      }

      const height = 42 + Math.floor(seed * 150);
      structures.push(
        makeStructure(
          `tower-${gridX}-${gridY}`,
          height > 144 ? "tower" : "building",
          rect.x,
          rect.y,
          rect.w,
          rect.h,
          {
            height,
            color: palette[Math.floor(seed * palette.length) % palette.length],
            roofColor: seed > 0.6 ? "#27262f" : "#3d3633",
            roofStyle: seed > 0.66 ? "cap" : "flat",
            landmark: height > 154,
          }
        )
      );
    }
  }

  return { structures, surfaces };
}

function createGenericTraffic(district) {
  const horizontalRoads = district.roads.filter((road) => road.w > road.h);
  const verticalRoads = district.roads.filter((road) => road.h >= road.w);
  const palette = ["#3f67d5", "#d33c36", "#f0c444", "#bfbec8", "#5f7f4f"];
  const actors = [];

  horizontalRoads.slice(0, 2).forEach((road, index) => {
    actors.push(
      makeActor(
        `${district.id}-h-${index}-a`,
        "x",
        road.x + 36,
        road.x + road.w - 36,
        road.y + road.h * 0.36,
        54 + index * 10,
        1,
        100 + index * 120,
        index % 2 === 0 ? "sedan" : "hatch",
        palette[index % palette.length]
      ),
      makeActor(
        `${district.id}-h-${index}-b`,
        "x",
        road.x + 36,
        road.x + road.w - 36,
        road.y + road.h * 0.66,
        50 + index * 10,
        -1,
        250 + index * 160,
        index % 2 === 0 ? "van" : "sedan",
        palette[(index + 2) % palette.length]
      )
    );
  });

  verticalRoads.slice(0, 2).forEach((road, index) => {
    actors.push(
      makeActor(
        `${district.id}-v-${index}`,
        "y",
        road.y + 36,
        road.y + road.h - 36,
        road.x + road.w * (index % 2 === 0 ? 0.38 : 0.62),
        42 + index * 8,
        index % 2 === 0 ? 1 : -1,
        210 + index * 120,
        index % 2 === 0 ? "sedan" : "patrol",
        index % 2 === 0 ? palette[(index + 1) % palette.length] : "#d7d9df"
      )
    );
  });

  return actors;
}

function createGenericPedestrians(district) {
  const palette = ["#7b204a", "#365e9b", "#5a733d", "#b36a38", "#282d38"];
  const actors = [];

  district.roads.slice(0, 4).forEach((road, index) => {
    const horizontal = road.w >= road.h;
    actors.push(
      makeWalker(
        `${district.id}-ped-${index}-a`,
        horizontal ? "x" : "y",
        horizontal ? road.x + 35 : road.y + 35,
        horizontal ? road.x + road.w - 35 : road.y + road.h - 35,
        horizontal ? road.y - 12 : road.x - 12,
        16 + index,
        1,
        80 + index * 60,
        palette[index % palette.length]
      ),
      makeWalker(
        `${district.id}-ped-${index}-b`,
        horizontal ? "x" : "y",
        horizontal ? road.x + 35 : road.y + 35,
        horizontal ? road.x + road.w - 35 : road.y + road.h - 35,
        horizontal ? road.y + road.h + 12 : road.x + road.w + 12,
        14 + index,
        -1,
        160 + index * 45,
        palette[(index + 2) % palette.length]
      )
    );
  });

  return actors;
}

function buildBoundaryStructures(district) {
  const thickness = WORLD_PLAY_AREA.barrierThickness;
  const length = 1000 - thickness * 2;
  const barrierColor = district.districtTint;
  const roofColor = district.skylineTint;

  return [
    makeStructure(`${district.id}-boundary-north`, "boundary-wall", 0, 0, 1000, thickness, {
      height: 14,
      color: barrierColor,
      roofColor,
      solid: true,
    }),
    makeStructure(`${district.id}-boundary-south`, "boundary-wall", 0, 1000 - thickness, 1000, thickness, {
      height: 14,
      color: barrierColor,
      roofColor,
      solid: true,
    }),
    makeStructure(`${district.id}-boundary-west`, "boundary-wall", 0, thickness, thickness, length, {
      height: 14,
      color: barrierColor,
      roofColor,
      solid: true,
    }),
    makeStructure(`${district.id}-boundary-east`, "boundary-wall", 1000 - thickness, thickness, thickness, length, {
      height: 14,
      color: barrierColor,
      roofColor,
      solid: true,
    }),
  ];
}

function buildSunsetCuratedLayout() {
  const structures = [
    makeStructure("sunset-garage-shell", "garage", 252, 786, 164, 96, {
      height: 54,
      color: "#5c4a43",
      roofColor: "#28262b",
      signText: "SUNSET GARAGE",
      signBackground: "#324255",
      landmark: true,
      awningColor: "#46607f",
    }),
    makeStructure("night-oil-store", "store", 566, 304, 132, 92, {
      height: 60,
      color: "#657145",
      roofColor: "#283127",
      signText: "NIGHT OIL",
      signBackground: "#402617",
      awningColor: "#245194",
      landmark: true,
    }),
    makeStructure("wash-go-laundromat", "laundromat", 810, 514, 152, 96, {
      height: 58,
      color: "#7f695e",
      roofColor: "#2c2628",
      signText: "WASH N GO",
      signBackground: "#3e4d7f",
      awningColor: "#245194",
      landmark: true,
    }),
    makeStructure("parcel-warehouse", "warehouse", 770, 644, 164, 128, {
      height: 70,
      color: "#756458",
      roofColor: "#323038",
      signText: "PARCEL YARD",
      signBackground: "#373c48",
      awningColor: "#a97343",
      landmark: true,
    }),
    makeStructure("pulse-service", "service", 42, 620, 108, 92, {
      height: 48,
      color: "#7c5848",
      roofColor: "#2e2826",
      signText: "PULSE SERVICE",
      signBackground: "#264247",
      awningColor: "#d18b35",
      landmark: true,
    }),
    makeStructure("civic-arch-hall", "civic", 814, 104, 130, 88, {
      height: 96,
      color: "#826f62",
      roofColor: "#38363d",
      signText: "CIVIC ARCH",
      signBackground: "#324255",
      landmark: true,
    }),
    makeStructure("water-tower-base", "tower-base", 838, 332, 58, 58, {
      height: 44,
      color: "#7d6a5a",
      roofColor: "#433f46",
      landmark: true,
    }),
  ];

  const surfaces = [
    makeSurface("palm-plaza", "plaza", 304, 94, 172, 112, {
      color: "#756f62",
      accentColor: "#e9d7a3",
    }),
    makeSurface("parcel-yard-slab", "yard", 744, 596, 208, 180, {
      color: "#59544c",
      accentColor: "#a6754a",
    }),
    makeSurface("garage-lane", "yard", 182, 756, 280, 110, {
      color: "#444148",
      accentColor: "#e3bf56",
    }),
    makeSurface("service-forecourt", "service", 26, 712, 152, 126, {
      color: "#60554d",
      accentColor: "#f0d173",
    }),
    makeSurface("civic-court", "civic", 778, 56, 188, 132, {
      color: "#73675b",
      accentColor: "#e8d6a8",
    }),
    makeSurface("market-parking", "parking", 534, 648, 142, 116, {
      color: "#5d5850",
      accentColor: "#efe4b2",
    }),
  ];

  const props = [
    makeProp("hydrant-west", "hydrant", 118, 608, { radius: 7, height: 16, color: "#b9382d", accentColor: "#e96d57" }),
    makeProp("bin-west", "bin", 84, 658, { radius: 10, height: 22, color: "#5a664f", accentColor: "#8db776" }),
    makeProp("crate-a", "crate-stack", 760, 682, { radius: 14, height: 22, color: "#8b693d", accentColor: "#d7ae59" }),
    makeProp("crate-b", "crate-stack", 904, 708, { radius: 14, height: 22, color: "#8b693d", accentColor: "#d7ae59" }),
    makeProp("fountain-core", "fountain", 392, 150, { radius: 18, height: 20, color: "#6b7d92", accentColor: "#9fe7ff" }),
    makeProp("garage-bollard", "bollard", 220, 760, { radius: 6, height: 18, color: "#525763", accentColor: "#f3cc57" }),
    makeProp("tower-tank", "water-tower", 867, 361, { radius: 16, height: 92, color: "#6f584e", accentColor: "#d6b07b", solid: false }),
    makeProp("plaza-palm-a", "palm", 334, 124, { radius: 8, height: 46, color: "#4f6e35", accentColor: "#7eb95b" }),
    makeProp("plaza-palm-b", "palm", 448, 178, { radius: 8, height: 46, color: "#4f6e35", accentColor: "#7eb95b" }),
  ];

  const staticVehicles = [
    makeStaticVehicle("market-van", 588, 708, Math.PI, "van", "#bfbec8", { label: "Laundry van" }),
    makeStaticVehicle("lot-hatch", 612, 686, Math.PI, "hatch", "#d3aa4d", { label: "Market hatch" }),
    makeStaticVehicle("service-patrol", 188, 748, 0, "patrol", "#d9dce2", { label: "Patrol cruiser" }),
    makeStaticVehicle("yard-courier", 884, 618, Math.PI * 0.5, "hatch", "#d1564d", { label: "Courier hatch" }),
  ];

  const trafficActors = [
    makeActor("sunset-avenue-east-1", "x", 46, 954, 514, 62, 1, 80, "sedan", "#416cd7"),
    makeActor("sunset-avenue-east-2", "x", 46, 954, 540, 56, 1, 310, "hatch", "#d04d3f"),
    makeActor("sunset-avenue-west-1", "x", 46, 954, 568, 58, -1, 420, "taxi", "#d3ae3e"),
    makeActor("sunset-upper-east", "x", 46, 954, 208, 50, 1, 240, "sedan", "#c3c6ce"),
    makeActor("sunset-upper-west", "x", 46, 954, 246, 46, -1, 90, "van", "#7a8855"),
    makeActor("sunset-market-vertical", "y", 46, 954, 470, 44, 1, 210, "patrol", "#d9dce2"),
    makeActor("sunset-yard-vertical", "y", 46, 954, 738, 48, -1, 430, "sedan", "#efb54f"),
  ];

  const pedestrianActors = [
    makeWalker("sunset-spawn-walk", "x", 42, 332, 462, 18, 1, 30, "#7b204a"),
    makeWalker("sunset-storefront-walk", "x", 548, 948, 462, 16, -1, 160, "#335f96"),
    makeWalker("sunset-plaza-loop-a", "x", 310, 468, 220, 13, 1, 40, "#5f7a3f"),
    makeWalker("sunset-plaza-loop-b", "y", 112, 206, 500, 11, -1, 20, "#b06a39"),
    makeWalker("sunset-upper-sidewalk", "x", 120, 920, 288, 15, 1, 120, "#27303c"),
    makeWalker("sunset-yard-sidewalk", "y", 610, 780, 754, 14, -1, 70, "#704a9f"),
  ];

  return { structures, surfaces, props, staticVehicles, trafficActors, pedestrianActors };
}

function buildFallbackDecor(district) {
  return {
    structures: [
      makeStructure(`${district.id}-hub`, "garage", district.homePoint.x - 70, district.homePoint.y + 28, 124, 82, {
        height: 52,
        color: "#66554a",
        roofColor: "#2f2d34",
        signText: district.homePoint.label.toUpperCase().slice(0, 16),
        signBackground: "#314457",
        landmark: true,
      }),
    ],
    surfaces: [
      makeSurface(`${district.id}-hub-yard`, "yard", district.homePoint.x - 98, district.homePoint.y - 12, 188, 118, {
        color: "#57514b",
        accentColor: "#e9ca63",
      }),
    ],
    props: [],
    staticVehicles: district.vehicleSpawnPoints.slice(1).map((spawn, index) => makeStaticVehicle(
      `${district.id}-parked-${index}`,
      spawn.x + 18,
      spawn.y + 18,
      index % 2 === 0 ? Math.PI : 0,
      spawn.type || (index % 2 === 0 ? "hatch" : "van"),
      spawn.color || (index % 2 === 0 ? "#74808a" : "#d1b053"),
      { label: spawn.label }
    )),
    trafficActors: createGenericTraffic(district),
    pedestrianActors: createGenericPedestrians(district),
  };
}

function buildLayout(district) {
  const curated = district.id === "sunset-grid" ? buildSunsetCuratedLayout() : buildFallbackDecor(district);
  const boundaryStructures = buildBoundaryStructures(district);
  const reservedRects = [
    ...boundaryStructures.map((item) => ({ x: item.x, y: item.y, w: item.w, h: item.h })),
    ...curated.structures.map((item) => ({ x: item.x, y: item.y, w: item.w, h: item.h })),
    ...curated.surfaces.map((item) => ({ x: item.x, y: item.y, w: item.w, h: item.h })),
  ];
  const procedural = buildProceduralStructures(district, reservedRects);

  const structures = [...boundaryStructures, ...procedural.structures, ...curated.structures];
  const surfaces = [...procedural.surfaces, ...curated.surfaces];
  const rectBlockers = structures.filter((item) => item.solid !== false).map((item) => ({
    id: item.id,
    kind: item.kind,
    x: item.x + 4,
    y: item.y + 4,
    w: Math.max(12, item.w - 8),
    h: Math.max(12, item.h - 8),
  }));
  const circleBlockers = curated.props.filter((item) => item.solid).map((item) => ({
    id: item.id,
    kind: item.kind,
    x: item.x,
    y: item.y,
    radius: item.radius,
  }));
  const staticVehicleColliders = curated.staticVehicles.map((item) => ({
    id: item.id,
    kind: item.type,
    x: item.x,
    y: item.y,
    radius: item.radius,
  }));

  return {
    structures,
    surfaces,
    props: curated.props,
    staticVehicles: curated.staticVehicles,
    trafficActors: curated.trafficActors,
    pedestrianActors: curated.pedestrianActors,
    rectBlockers,
    circleBlockers,
    staticVehicleColliders,
    worldBounds: WORLD_PLAY_AREA,
  };
}

export function getDistrictWorldLayout(district) {
  if (!layoutCache.has(district.id)) {
    layoutCache.set(district.id, buildLayout(district));
  }
  return layoutCache.get(district.id);
}

export function getMovingActorPose(actor, elapsed) {
  const progress = wrap(elapsed * actor.speed * actor.direction + actor.offset, actor.min, actor.max);
  if (actor.axis === "x") {
    return {
      x: progress,
      y: actor.lane,
      angle: actor.heading ?? (actor.direction > 0 ? 0 : Math.PI),
    };
  }

  return {
    x: actor.lane,
    y: progress,
    angle: actor.heading ?? (actor.direction > 0 ? -Math.PI * 0.5 : Math.PI * 0.5),
  };
}

export function getReactiveActorPose(actor, elapsed, actorReactions = {}) {
  const pose = getMovingActorPose(actor, elapsed);
  const reaction = actorReactions?.[actor.id];
  if (!reaction) {
    return { ...pose, hidden: false };
  }

  if (Number(reaction.hideTimer) > 0) {
    return {
      ...pose,
      hidden: true,
    };
  }

  if (Number(reaction.panicTimer) > 0 && Number.isFinite(reaction.panicDuration) && Number.isFinite(reaction.fleeAngle)) {
    const intensity = Math.max(0, Math.min(1, reaction.panicTimer / Math.max(reaction.panicDuration, 0.01)));
    return {
      x: pose.x + Math.cos(reaction.fleeAngle) * 18 * intensity,
      y: pose.y + Math.sin(reaction.fleeAngle) * 18 * intensity,
      angle: reaction.fleeAngle,
      hidden: false,
    };
  }

  return { ...pose, hidden: false };
}
