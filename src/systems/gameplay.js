import { getDistrictWorldLayout, getReactiveActorPose, WORLD_PLAY_AREA } from "../data/world-layout.js";
import {
  buildCombatState,
  buildSession,
  getCurrentPosition,
  getActiveObjectivePoint,
  getDistrictById,
  getNearbyMissionContact,
  getMissionPointById,
  getMissionScript,
  getMissionStage,
  getNearestEnterableVehicle,
  getVehicleSpawnProfile,
  hasActiveMission,
  isNearObjective,
  isNearVehicle,
} from "../state/game-state.js";
import { clamp, distance2D } from "../utils/math.js";

const PLAYER_RADIUS = 9;
const VEHICLE_RADIUS = 18;
const PENETRATION_EPSILON = 0.01;

function normalizeAngle(angle) {
  let normalized = angle;
  while (normalized <= -Math.PI) {
    normalized += Math.PI * 2;
  }
  while (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }
  return normalized;
}

function getViewHeading(session) {
  return normalizeAngle(session.ui.cameraYaw);
}

function getAimAngle(session) {
  return getViewHeading(session);
}

function createShotResult(overrides = {}) {
  return {
    kind: "idle",
    targetId: null,
    blocked: false,
    hit: false,
    x: 0,
    y: 0,
    ...overrides,
  };
}

function pointInsideRoad(point, road) {
  return point.x >= road.x && point.x <= road.x + road.w && point.y >= road.y && point.y <= road.y + road.h;
}

function pointInsideRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function circleIntersectsRect(x, y, radius, rect) {
  const nearestX = clamp(x, rect.x, rect.x + rect.w);
  const nearestY = clamp(y, rect.y, rect.y + rect.h);
  const distanceX = x - nearestX;
  const distanceY = y - nearestY;
  return distanceX * distanceX + distanceY * distanceY < radius * radius;
}

function circleIntersectsCircle(point, radius, other) {
  return distance2D(point, other) < radius + other.radius;
}

function isPointInRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function rectIntersectsBounds(rect, bounds) {
  return !(
    rect.x + rect.w < bounds.minX
    || rect.x > bounds.maxX
    || rect.y + rect.h < bounds.minY
    || rect.y > bounds.maxY
  );
}

function circleIntersectsBounds(circle, bounds) {
  return !(
    circle.x + circle.radius < bounds.minX
    || circle.x - circle.radius > bounds.maxX
    || circle.y + circle.radius < bounds.minY
    || circle.y - circle.radius > bounds.maxY
  );
}

function getSweepBounds(startX, startY, endX, endY, radius, padding = 18) {
  return {
    minX: Math.min(startX, endX) - radius - padding,
    maxX: Math.max(startX, endX) + radius + padding,
    minY: Math.min(startY, endY) - radius - padding,
    maxY: Math.max(startY, endY) + radius + padding,
  };
}

function buildCollisionCandidates(startX, startY, endX, endY, radius, rects, circles) {
  const bounds = getSweepBounds(startX, startY, endX, endY, radius);
  return {
    rects: rects.filter((rect) => rectIntersectsBounds(rect, bounds)),
    circles: circles.filter((circle) => circleIntersectsBounds(circle, bounds)),
  };
}

function chooseBestExitCandidate(candidates, referencePoint, movementX, movementY) {
  const inBounds = candidates.filter((candidate) => isPointInsidePlayArea(candidate.endPoint));
  const available = inBounds.length ? inBounds : candidates;

  if (referencePoint) {
    const referenceSides = [];
    if (referencePoint.x < candidates[0].rect.x) {
      referenceSides.push("left");
    } else if (referencePoint.x > candidates[0].rect.x + candidates[0].rect.w) {
      referenceSides.push("right");
    }
    if (referencePoint.y < candidates[0].rect.y) {
      referenceSides.push("top");
    } else if (referencePoint.y > candidates[0].rect.y + candidates[0].rect.h) {
      referenceSides.push("bottom");
    }

    for (const side of referenceSides) {
      const match = available.find((candidate) => candidate.side === side);
      if (match) {
        return match;
      }
    }
  }

  if (Math.abs(movementX) > PENETRATION_EPSILON || Math.abs(movementY) > PENETRATION_EPSILON) {
    const movementLength = Math.hypot(movementX, movementY) || 1;
    available.sort((left, right) => {
      const leftAlignment = ((left.dx * movementX) + (left.dy * movementY)) / movementLength;
      const rightAlignment = ((right.dx * movementX) + (right.dy * movementY)) / movementLength;
      if (Math.abs(rightAlignment - leftAlignment) > PENETRATION_EPSILON) {
        return rightAlignment - leftAlignment;
      }
      return Math.hypot(left.dx, left.dy) - Math.hypot(right.dx, right.dy);
    });
    return available[0];
  }

  available.sort((left, right) => Math.hypot(left.dx, left.dy) - Math.hypot(right.dx, right.dy));
  return available[0];
}

function getRectSeparation(x, y, radius, rect, referencePoint, movementX = 0, movementY = 0) {
  const nearestX = clamp(x, rect.x, rect.x + rect.w);
  const nearestY = clamp(y, rect.y, rect.y + rect.h);
  const deltaX = x - nearestX;
  const deltaY = y - nearestY;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance > PENETRATION_EPSILON) {
    const overlap = radius - distance + PENETRATION_EPSILON;
    if (overlap <= 0) {
      return { x: 0, y: 0 };
    }
    return {
      x: (deltaX / distance) * overlap,
      y: (deltaY / distance) * overlap,
    };
  }

  const candidates = [
    {
      side: "left",
      rect,
      dx: (rect.x - radius - PENETRATION_EPSILON) - x,
      dy: 0,
      endPoint: { x: rect.x - radius - PENETRATION_EPSILON, y },
    },
    {
      side: "right",
      rect,
      dx: (rect.x + rect.w + radius + PENETRATION_EPSILON) - x,
      dy: 0,
      endPoint: { x: rect.x + rect.w + radius + PENETRATION_EPSILON, y },
    },
    {
      side: "top",
      rect,
      dx: 0,
      dy: (rect.y - radius - PENETRATION_EPSILON) - y,
      endPoint: { x, y: rect.y - radius - PENETRATION_EPSILON },
    },
    {
      side: "bottom",
      rect,
      dx: 0,
      dy: (rect.y + rect.h + radius + PENETRATION_EPSILON) - y,
      endPoint: { x, y: rect.y + rect.h + radius + PENETRATION_EPSILON },
    },
  ];
  const best = chooseBestExitCandidate(candidates, referencePoint, movementX, movementY);
  return { x: best.dx, y: best.dy };
}

function getCircleSeparation(x, y, radius, circle, referencePoint, movementX = 0, movementY = 0) {
  const deltaX = x - circle.x;
  const deltaY = y - circle.y;
  const distance = Math.hypot(deltaX, deltaY);
  const overlap = radius + circle.radius - distance + PENETRATION_EPSILON;

  if (overlap <= 0) {
    return { x: 0, y: 0 };
  }

  if (distance <= PENETRATION_EPSILON) {
    if (referencePoint && distance2D(referencePoint, circle) > PENETRATION_EPSILON) {
      const referenceDx = x - referencePoint.x;
      const referenceDy = y - referencePoint.y;
      const referenceDistance = Math.hypot(referenceDx, referenceDy) || 1;
      return {
        x: (referenceDx / referenceDistance) * overlap,
        y: (referenceDy / referenceDistance) * overlap,
      };
    }

    if (Math.abs(movementX) > PENETRATION_EPSILON || Math.abs(movementY) > PENETRATION_EPSILON) {
      const movementDistance = Math.hypot(movementX, movementY) || 1;
      return {
        x: (movementX / movementDistance) * overlap,
        y: (movementY / movementDistance) * overlap,
      };
    }

    return { x: overlap, y: 0 };
  }

  return {
    x: (deltaX / distance) * overlap,
    y: (deltaY / distance) * overlap,
  };
}

function getOverlappingBlockers(x, y, radius, rects, circles) {
  const rectHits = rects.filter((rect) => circleIntersectsRect(x, y, radius, rect));
  const circleHits = circles.filter((circle) => circleIntersectsCircle({ x, y }, radius, circle));
  return [...rectHits, ...circleHits];
}

function resolvePenetration(x, y, radius, rects, circles, referencePoint = null, movementX = 0, movementY = 0) {
  let currentX = x;
  let currentY = y;
  let hit = null;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const overlaps = getOverlappingBlockers(currentX, currentY, radius, rects, circles);
    if (!overlaps.length) {
      return { x: currentX, y: currentY, hit, blocked: false };
    }

    let correctionX = 0;
    let correctionY = 0;
    overlaps.forEach((blocker) => {
      hit = hit || blocker;
      const correction = "radius" in blocker
        ? getCircleSeparation(currentX, currentY, radius, blocker, referencePoint, movementX, movementY)
        : getRectSeparation(currentX, currentY, radius, blocker, referencePoint, movementX, movementY);
      correctionX += correction.x;
      correctionY += correction.y;
    });

    if (Math.abs(correctionX) <= PENETRATION_EPSILON && Math.abs(correctionY) <= PENETRATION_EPSILON) {
      break;
    }

    currentX += correctionX;
    currentY += correctionY;
  }

  return {
    x: currentX,
    y: currentY,
    hit,
    blocked: getOverlappingBlockers(currentX, currentY, radius, rects, circles).length > 0,
  };
}

function attemptStepMove(currentX, currentY, stepX, stepY, radius, rects, circles) {
  const referencePoint = { x: currentX, y: currentY };
  const fullStep = resolvePenetration(currentX + stepX, currentY + stepY, radius, rects, circles, referencePoint, stepX, stepY);
  if (!fullStep.blocked) {
    return fullStep;
  }

  const xOnly = resolvePenetration(currentX + stepX, currentY, radius, rects, circles, referencePoint, stepX, 0);
  const yOnly = resolvePenetration(currentX, currentY + stepY, radius, rects, circles, referencePoint, 0, stepY);
  const candidates = [xOnly, yOnly].filter((candidate) => !candidate.blocked);

  if (candidates.length) {
    candidates.sort((a, b) => distance2D(b, { x: currentX, y: currentY }) - distance2D(a, { x: currentX, y: currentY }));
    return {
      ...candidates[0],
      hit: fullStep.hit || candidates[0].hit,
    };
  }

  return {
    x: currentX,
    y: currentY,
    hit: fullStep.hit || xOnly.hit || yOnly.hit,
    blocked: true,
  };
}

function clampToPlayArea(point) {
  return {
    x: clamp(point.x, WORLD_PLAY_AREA.minX, WORLD_PLAY_AREA.maxX),
    y: clamp(point.y, WORLD_PLAY_AREA.minY, WORLD_PLAY_AREA.maxY),
  };
}

function resolveMovement(entity, desiredX, desiredY, radius, rects, circles) {
  const movementX = desiredX - entity.x;
  const movementY = desiredY - entity.y;
  const movementDistance = Math.hypot(movementX, movementY);
  const steps = Math.max(1, Math.ceil(movementDistance / Math.max(4, radius * 0.55)));
  const stepX = movementX / steps;
  const stepY = movementY / steps;
  const candidates = buildCollisionCandidates(entity.x, entity.y, desiredX, desiredY, radius, rects, circles);
  let currentX = entity.x;
  let currentY = entity.y;
  let hit = null;

  for (let step = 0; step < steps; step += 1) {
    const resolvedStep = attemptStepMove(currentX, currentY, stepX, stepY, radius, candidates.rects, candidates.circles);
    currentX = resolvedStep.x;
    currentY = resolvedStep.y;
    hit = hit || resolvedStep.hit;
  }

  return {
    ...clampToPlayArea({ x: currentX, y: currentY }),
    hit,
  };
}

function getReactiveDynamicActors(layout, session) {
  const reactions = session.combat?.actorReactions || {};
  const traffic = layout.trafficActors.map((actor) => {
    const pose = getReactiveActorPose(actor, session.clock, reactions);
    return {
      id: actor.id,
      kind: actor.type === "patrol" ? "patrol" : "traffic",
      x: pose.x,
      y: pose.y,
      angle: pose.angle,
      radius: actor.radius + (actor.type === "van" ? 2 : 1),
      hidden: pose.hidden,
      dynamic: true,
    };
  });
  const pedestrians = layout.pedestrianActors.map((actor) => {
    const pose = getReactiveActorPose(actor, session.clock, reactions);
    return {
      id: actor.id,
      kind: "pedestrian",
      x: pose.x,
      y: pose.y,
      angle: pose.angle,
      radius: actor.radius + 1,
      hidden: pose.hidden,
      dynamic: true,
    };
  });
  return [...traffic, ...pedestrians].filter((actor) => !actor.hidden);
}

function buildActorReactionPatch(existing, updates) {
  return {
    ...existing,
    ...updates,
  };
}

function setActorReaction(session, actorId, updates) {
  const existing = session.combat.actorReactions[actorId] || {};
  session.combat.actorReactions[actorId] = buildActorReactionPatch(existing, updates);
}

function updateCombatTimers(session, deltaSeconds, events) {
  const combat = session.combat;
  combat.fireCooldown = Math.max(0, combat.fireCooldown - deltaSeconds);
  combat.reloadTimer = Math.max(0, combat.reloadTimer - deltaSeconds);
  combat.muzzleTimer = Math.max(0, combat.muzzleTimer - deltaSeconds);
  combat.traceTimer = Math.max(0, combat.traceTimer - deltaSeconds);
  combat.impactTimer = Math.max(0, combat.impactTimer - deltaSeconds);
  combat.hitMarkerTimer = Math.max(0, combat.hitMarkerTimer - deltaSeconds);
  combat.patrolAlertTimer = Math.max(0, combat.patrolAlertTimer - deltaSeconds);
  combat.civilianAlertTimer = Math.max(0, combat.civilianAlertTimer - deltaSeconds);

  if (combat.reloadTimer === 0 && combat.pendingReload) {
    const needed = combat.clipSize - combat.ammoInClip;
    const loaded = Math.min(needed, combat.reserveAmmo);
    combat.ammoInClip += loaded;
    combat.reserveAmmo -= loaded;
    combat.pendingReload = false;
    events.push({
      tone: { frequency: 470, duration: 0.05, type: "triangle" },
    });
  }

  Object.entries(combat.actorReactions).forEach(([actorId, reaction]) => {
    const nextReaction = { ...reaction };
    ["panicTimer", "hideTimer", "alertTimer"].forEach((key) => {
      if (Number.isFinite(nextReaction[key])) {
        nextReaction[key] = Math.max(0, nextReaction[key] - deltaSeconds);
      }
    });
    if ((nextReaction.panicTimer || 0) <= 0) {
      delete nextReaction.panicTimer;
      delete nextReaction.panicDuration;
      delete nextReaction.fleeAngle;
    }
    if ((nextReaction.hideTimer || 0) <= 0) {
      delete nextReaction.hideTimer;
    }
    if ((nextReaction.alertTimer || 0) <= 0) {
      delete nextReaction.alertTimer;
    }
    if (!Object.keys(nextReaction).length) {
      delete combat.actorReactions[actorId];
    } else {
      combat.actorReactions[actorId] = nextReaction;
    }
  });
}

function raycastRect(origin, direction, maxDistance, rect) {
  let entry = 0;
  let exit = maxDistance;
  const axes = [
    ["x", rect.x, rect.x + rect.w],
    ["y", rect.y, rect.y + rect.h],
  ];

  for (const [axis, min, max] of axes) {
    const originValue = origin[axis];
    const directionValue = direction[axis];
    if (Math.abs(directionValue) <= PENETRATION_EPSILON) {
      if (originValue < min || originValue > max) {
        return null;
      }
      continue;
    }

    const near = (min - originValue) / directionValue;
    const far = (max - originValue) / directionValue;
    const axisEntry = Math.min(near, far);
    const axisExit = Math.max(near, far);
    entry = Math.max(entry, axisEntry);
    exit = Math.min(exit, axisExit);
    if (entry > exit) {
      return null;
    }
  }

  if (exit < 0 || entry > maxDistance) {
    return null;
  }

  return Math.max(0, entry);
}

function raycastCircle(origin, direction, maxDistance, circle) {
  const offsetX = origin.x - circle.x;
  const offsetY = origin.y - circle.y;
  const projection = offsetX * direction.x + offsetY * direction.y;
  const centerDistance = offsetX * offsetX + offsetY * offsetY - circle.radius * circle.radius;
  const discriminant = projection * projection - centerDistance;

  if (discriminant < 0) {
    return null;
  }

  const root = Math.sqrt(discriminant);
  const entry = -projection - root;
  const exit = -projection + root;
  const distance = entry >= 0 ? entry : exit;
  if (distance < 0 || distance > maxDistance) {
    return null;
  }
  return distance;
}

function findShotHit(origin, angle, maxDistance, rects, circles) {
  const direction = {
    x: Math.cos(angle),
    y: Math.sin(angle),
  };
  let bestHit = {
    distance: maxDistance,
    point: {
      x: origin.x + direction.x * maxDistance,
      y: origin.y + direction.y * maxDistance,
    },
    target: null,
  };

  rects.forEach((rect) => {
    const distance = raycastRect(origin, direction, maxDistance, rect);
    if (distance === null || distance >= bestHit.distance) {
      return;
    }
    bestHit = {
      distance,
      point: {
        x: origin.x + direction.x * distance,
        y: origin.y + direction.y * distance,
      },
      target: rect,
    };
  });

  circles.forEach((circle) => {
    const distance = raycastCircle(origin, direction, maxDistance, circle);
    if (distance === null || distance >= bestHit.distance) {
      return;
    }
    bestHit = {
      distance,
      point: {
        x: origin.x + direction.x * distance,
        y: origin.y + direction.y * distance,
      },
      target: circle,
    };
  });

  return bestHit;
}

function alertNearbyPedestrians(session, layout, origin, radius, options = {}) {
  let alertedCount = 0;
  layout.pedestrianActors.forEach((actor) => {
    const pose = getReactiveActorPose(actor, session.clock, session.combat.actorReactions);
    if (pose.hidden || distance2D(origin, pose) > radius) {
      return;
    }
    alertedCount += 1;
    setActorReaction(session, actor.id, {
      panicTimer: options.duration ?? 2.8,
      panicDuration: options.duration ?? 2.8,
      fleeAngle: Math.atan2(pose.y - origin.y, pose.x - origin.x),
    });
  });

  if (alertedCount > 0) {
    session.combat.civilianAlertTimer = Math.max(session.combat.civilianAlertTimer, 0.8);
  }
}

function alertNearbyPatrol(session, layout, origin, radius, duration = 3.6) {
  let patrolAlerted = false;
  layout.trafficActors.forEach((actor) => {
    if (actor.type !== "patrol") {
      return;
    }
    const pose = getReactiveActorPose(actor, session.clock, session.combat.actorReactions);
    if (pose.hidden || distance2D(origin, pose) > radius) {
      return;
    }
    patrolAlerted = true;
    setActorReaction(session, actor.id, {
      alertTimer: duration,
    });
  });

  if (patrolAlerted) {
    session.combat.patrolAlertTimer = Math.max(session.combat.patrolAlertTimer, duration);
  }
}

function createShotCastCircles(state, layout, dynamicActors) {
  return [
    ...dynamicActors,
    ...getStaticVehicleBlockers(layout, state.session).map((vehicle) => ({
      ...vehicle,
      kind: "static-vehicle",
    })),
    ...layout.circleBlockers.map((blocker) => ({
      ...blocker,
      kind: "blocker",
    })),
    {
      id: "hero-vehicle",
      kind: "hero-vehicle",
      x: state.session.vehicle.x,
      y: state.session.vehicle.y,
      radius: VEHICLE_RADIUS,
    },
  ];
}

function startReload(state, automatic = false) {
  const combat = state.session.combat;
  if (state.session.mode !== "foot") {
    return {
      toast: "The sidearm stays stowed in the ride",
      tone: { frequency: 220, duration: 0.05, type: "square" },
    };
  }

  if (!combat.equipped) {
    combat.equipped = true;
    state.activeSlot = 1;
  }

  if (combat.pendingReload || combat.reloadTimer > 0) {
    return {
      toast: `${combat.weaponLabel} already reloading`,
      tone: { frequency: 280, duration: 0.05, type: "square" },
    };
  }

  if (combat.ammoInClip >= combat.clipSize) {
    return {
      toast: `${combat.weaponLabel} already topped off`,
      tone: { frequency: 320, duration: 0.04, type: "triangle" },
    };
  }

  if (combat.reserveAmmo <= 0) {
    return {
      toast: "No reserve rounds left",
      tone: { frequency: 180, duration: 0.06, type: "square" },
    };
  }

  combat.reloadTimer = combat.reloadSeconds;
  combat.pendingReload = true;
  return {
    toast: automatic ? "Reloading sidearm" : `${combat.weaponLabel} reloading`,
    tone: { frequency: 360, duration: 0.07, type: "triangle" },
  };
}

function findNearestVehicleSpawnIndex(district, point) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  district.vehicleSpawnPoints.forEach((spawn, index) => {
    const distance = distance2D(spawn, point);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function applyVehicleSpawn(session, district, spawnIndex, durability = 96) {
  const spawnProfile = getVehicleSpawnProfile(district, spawnIndex);
  session.vehicle = {
    ...session.vehicle,
    ...spawnProfile,
    durability,
  };
}

function buildDynamicCircleBlockers(layout, session) {
  return getReactiveDynamicActors(layout, session).map((actor) => ({
    id: actor.id,
    kind: actor.kind,
    x: actor.x,
    y: actor.y,
    radius: actor.radius,
    dynamic: true,
  }));
}

function getClaimedVehicleIdSet(session) {
  return new Set(session.claimedVehicleIds || []);
}

function getStaticVehicleBlockers(layout, session) {
  const claimedIds = getClaimedVehicleIdSet(session);
  return layout.staticVehicleColliders.filter((vehicle) => !claimedIds.has(vehicle.id));
}

function isPointInsidePlayArea(point) {
  return point.x >= WORLD_PLAY_AREA.minX
    && point.x <= WORLD_PLAY_AREA.maxX
    && point.y >= WORLD_PLAY_AREA.minY
    && point.y <= WORLD_PLAY_AREA.maxY;
}

function isPointClear(point, radius, rects, circles) {
  return isPointInsidePlayArea(point) && getOverlappingBlockers(point.x, point.y, radius, rects, circles).length === 0;
}

function findSafePoint(origin, radius, rects, circles, options = {}) {
  const angles = options.angles || Array.from({ length: 12 }, (_, index) => (Math.PI * 2 * index) / 12);
  const distances = options.distances || [0, radius * 2, radius * 4, radius * 6, radius * 8];

  for (const distance of distances) {
    if (distance === 0 && isPointClear(origin, radius, rects, circles)) {
      return { x: origin.x, y: origin.y };
    }

    for (const angle of angles) {
      const candidate = {
        x: origin.x + Math.cos(angle) * distance,
        y: origin.y + Math.sin(angle) * distance,
      };
      if (isPointClear(candidate, radius, rects, circles)) {
        return candidate;
      }
    }
  }

  return null;
}

function snapVehicleToSafeSpawn(session, district, layout, spawnIndex, durability = 96) {
  applyVehicleSpawn(session, district, spawnIndex, durability);
  const safeVehicle = findSafePoint(
    session.vehicle,
    VEHICLE_RADIUS,
    layout.rectBlockers,
    [...layout.circleBlockers, ...getStaticVehicleBlockers(layout, session)],
    {
      distances: [0, 18, 32, 48, 64],
    }
  );

  if (safeVehicle) {
    session.vehicle.x = safeVehicle.x;
    session.vehicle.y = safeVehicle.y;
  } else {
    const clamped = clampToPlayArea(session.vehicle);
    session.vehicle.x = clamped.x;
    session.vehicle.y = clamped.y;
  }
}

function findSafeExitPoint(vehicle, rects, circles) {
  const baseDistance = PLAYER_RADIUS + VEHICLE_RADIUS + 8;
  return findSafePoint(vehicle, PLAYER_RADIUS, rects, circles, {
    angles: [
      vehicle.angle + Math.PI * 0.5,
      vehicle.angle - Math.PI * 0.5,
      vehicle.angle + Math.PI,
      vehicle.angle + Math.PI * 0.33,
      vehicle.angle - Math.PI * 0.33,
      vehicle.angle + Math.PI * 0.78,
      vehicle.angle - Math.PI * 0.78,
      vehicle.angle,
    ],
    distances: [baseDistance, baseDistance + 10, baseDistance + 22, baseDistance + 34, baseDistance + 48],
  });
}

function stabilizeSessionPlacement(session) {
  const district = getDistrictById(session.districtId);
  const layout = getDistrictWorldLayout(district);
  const spawnIndex = Number.isFinite(session.vehicle.spawnIndex) ? session.vehicle.spawnIndex : 0;

  snapVehicleToSafeSpawn(session, district, layout, spawnIndex, session.vehicle.durability);
  const safePlayerSpawn = findSafePoint(
    session.player,
    PLAYER_RADIUS,
    layout.rectBlockers,
    [...layout.circleBlockers, ...getStaticVehicleBlockers(layout, session), ...buildDynamicCircleBlockers(layout, session), {
      id: "hero-vehicle",
      kind: "vehicle",
      x: session.vehicle.x,
      y: session.vehicle.y,
      radius: VEHICLE_RADIUS,
    }],
    {
      angles: [0, Math.PI * 0.5, -Math.PI * 0.5, Math.PI, Math.PI * 0.25, -Math.PI * 0.25],
      distances: [0, 18, 30, 42, 56, 70],
    }
  ) || clampToPlayArea(session.player);

  session.player.x = safePlayerSpawn.x;
  session.player.y = safePlayerSpawn.y;
}

function queueCollisionCue(session, events, tone, toast = null) {
  session.ui.collisionPulseTimer = 0.24;
  if (session.ui.collisionCooldown > 0) {
    return;
  }
  session.ui.collisionCooldown = 0.36;
  events.push({ tone, toast });
}

function maybeQueueHeatAlert(session, events) {
  const heatLevel = Math.round(session.ui.heat);
  if (heatLevel > session.ui.alertedHeatLevel) {
    events.push({
      toast: heatLevel >= 4 ? "Patrol lights are sweeping the district" : "Heat is climbing",
      tone: {
        frequency: heatLevel >= 4 ? 760 : 660,
        duration: heatLevel >= 4 ? 0.14 : 0.1,
        type: "square",
      },
    });
    session.ui.alertedHeatLevel = heatLevel;
    return;
  }

  if (heatLevel < session.ui.alertedHeatLevel) {
    session.ui.alertedHeatLevel = heatLevel;
  }
}

function setMissionFlash(session, text, duration = 1.6) {
  session.ui.missionFlashText = text;
  session.ui.missionFlashTimer = duration;
}

function clearMissionState(session) {
  session.activeMissionId = null;
  session.missionStageIndex = 0;
  session.missionTimer = 0;
}

function getActiveMissionRecord(session) {
  return session.missionScripts.find((mission) => mission.id === session.activeMissionId) || null;
}

function stageNeedsVehicle(stage) {
  return stage.requiresMode === "vehicle";
}

function stageNeedsFoot(stage) {
  return stage.requiresMode === "foot";
}

function isStageModeBlocked(state, stage) {
  if (stageNeedsVehicle(stage)) {
    return state.session.mode !== "vehicle";
  }
  if (stageNeedsFoot(stage)) {
    return state.session.mode !== "foot";
  }
  return false;
}

function startMission(state, mission) {
  state.session.activeMissionId = mission.id;
  state.session.missionStageIndex = 0;
  state.session.missionTimer = mission.timerSeconds || 0;
  state.session.ui.routePulseTimer = 2.8;
  setMissionFlash(state.session, "RUN ACTIVE", 0.9);
  return {
    toast: `${mission.title} live`,
    tone: { frequency: 640, duration: 0.08, type: "triangle" },
  };
}

function failMission(state, mission, reason, events, options = {}) {
  if (!mission || !hasActiveMission(state)) {
    return;
  }

  clearMissionState(state.session);
  state.session.ui.routePulseTimer = 1.4;
  state.session.ui.homePingTimer = 1.6;
  state.session.ui.heat = clamp(state.session.ui.heat + (options.heatDelta ?? 0.75), 0, 5);
  setMissionFlash(state.session, options.flashText || "RUN FAILED");
  events.push({
    toast: reason || mission.failureToast || `${mission.title} failed`,
    tone: { frequency: 220, duration: 0.14, type: "square" },
  });
}

function completeMission(state, mission) {
  const timerBonus = mission.timerSeconds ? Math.round(state.session.missionTimer) * 6 : 0;
  const payout = mission.reward + timerBonus;
  state.session.ui.cash += payout;
  state.session.ui.routePulseTimer = 1.2;
  state.session.ui.homePingTimer = 1.4;
  state.session.ui.heat = clamp(state.session.ui.heat - 0.65, 0, 5);
  clearMissionState(state.session);
  setMissionFlash(state.session, `+$${payout}`);
  return {
    toast: `${mission.successToast || `${mission.title} cleared`} +$${payout}`,
    tone: { frequency: 820, duration: 0.12, type: "triangle" },
  };
}

function advanceMissionStage(state, script, stage, point) {
  if (state.session.missionStageIndex < script.stages.length - 1) {
    state.session.missionStageIndex += 1;
    state.session.ui.routePulseTimer = 2.2;
    return {
      toast: point.kind === "pickup"
        ? "Pickup tagged"
        : point.kind === "dropoff"
          ? "Drop secured"
          : stage.actionLabel
            ? `${stage.actionLabel} complete`
            : "Checkpoint cleared",
      tone: { frequency: 690, duration: 0.08, type: "triangle" },
    };
  }

  return completeMission(state, script);
}

function updateMissionTimer(state, deltaSeconds, events) {
  const mission = getActiveMissionRecord(state.session);
  if (!mission?.timerSeconds) {
    return;
  }

  state.session.missionTimer = Math.max(0, state.session.missionTimer - deltaSeconds);
  if (state.session.missionTimer > 0) {
    return;
  }

  failMission(state, mission, mission.failureToast || `${mission.title} timed out`, events, {
    heatDelta: 0.9,
    flashText: "RUN LOST",
  });
}

function moveSearchZone(zone, targetX, targetY, deltaSeconds, active) {
  const followRate = active ? 1.45 : 0.9;
  zone.x += (targetX - zone.x) * Math.min(1, deltaSeconds * followRate);
  zone.y += (targetY - zone.y) * Math.min(1, deltaSeconds * followRate);
}

function updateSearchPressure(state, layout, deltaSeconds, events) {
  const session = state.session;
  const current = getCurrentPosition(state);
  const district = getDistrictById(session.districtId);
  const cooldownPoint = district.missionPoints.find((point) => point.kind === "cooldown") || district.homePoint;
  const nearCooldown = distance2D(current, cooldownPoint) < 92 || distance2D(current, district.homePoint) < 88;
  const activeSearch = session.ui.heat >= 3;
  const heading = state.session.mode === "vehicle" ? state.session.vehicle.angle : state.session.player.angle;
  const speedFactor = state.session.mode === "vehicle" ? Math.min(1, Math.abs(state.session.vehicle.speed) / 120) : 0.4;
  const projectedX = current.x + Math.cos(heading) * (68 + speedFactor * 48);
  const projectedY = current.y + Math.sin(heading) * (68 + speedFactor * 48);
  let highestPressure = 0;

  session.searchZones.forEach((zone, index) => {
    zone.active = activeSearch;
    const targetX = activeSearch
      ? clamp(projectedX + (index === 0 ? Math.sin(heading) * 78 : -Math.sin(heading) * 84), 40, 960)
      : zone.anchorX;
    const targetY = activeSearch
      ? clamp(projectedY + (index === 0 ? -Math.cos(heading) * 78 : Math.cos(heading) * 84), 40, 960)
      : zone.anchorY;
    moveSearchZone(zone, targetX, targetY, deltaSeconds, activeSearch);
    const inside = distance2D(current, zone) < zone.radius;
    zone.pressure = inside ? clamp(zone.pressure + deltaSeconds, 0, 4) : Math.max(0, zone.pressure - deltaSeconds * 1.7);
    highestPressure = Math.max(highestPressure, zone.pressure);
  });

  if (!activeSearch) {
    if (nearCooldown) {
      session.ui.heat = clamp(session.ui.heat - 0.32 * deltaSeconds, 0, 5);
    }
    return;
  }

  const caught = highestPressure > 0;
  if (caught) {
    if (!session.ui.searchAlertCooldown || session.ui.searchAlertCooldown <= 0) {
      events.push({
        toast: "Search grid is locking in",
        tone: { frequency: 300, duration: 0.08, type: "square" },
      });
      session.ui.searchAlertCooldown = 1.5;
    }

    session.ui.heat = clamp(session.ui.heat + 0.22 * deltaSeconds, 0, 5);
    session.player.health = clamp(session.player.health - (state.session.mode === "vehicle" ? 4.2 : 6.2) * deltaSeconds, 0, 100);
    session.vehicle.durability = clamp(
      session.vehicle.durability - (state.session.mode === "vehicle" ? 8.5 : 2.4) * deltaSeconds,
      0,
      100
    );
  } else if (nearCooldown) {
    session.ui.heat = clamp(session.ui.heat - 0.44 * deltaSeconds, 0, 5);
  } else {
    session.ui.heat = clamp(session.ui.heat - 0.12 * deltaSeconds, 0, 5);
  }

  const inRestrictedYard = layout.surfaces.some((surface) => (
    (surface.kind === "yard" || surface.kind === "service")
    && pointInsideRect(current, surface)
  ));
  if (activeSearch && inRestrictedYard) {
    session.ui.heat = clamp(session.ui.heat + 0.12 * deltaSeconds, 0, 5);
  }

  if (highestPressure >= 2.8 && !session.failureState) {
    const activeMission = getActiveMissionRecord(session);
    if (activeMission) {
      failMission(state, activeMission, `${activeMission.title} burned under the sweep`, events, {
        heatDelta: 0.6,
        flashText: "RUN BUSTED",
      });
    }
    beginRespawn(session, "busted", events);
  }
}

function beginRespawn(session, reason, events) {
  if (session.failureState) {
    return;
  }

  session.failureState = { reason, timer: 1.1 };
  session.ui.respawnPulseTimer = 1.1;
  session.vehicle.speed = 0;
  session.combat.equipped = false;
  session.combat.pendingReload = false;
  session.combat.reloadTimer = 0;
  events.push({
    toast: reason === "vehicle"
      ? "Ride totaled. Reset lane inbound."
      : reason === "busted"
        ? "Sweep boxed you in. Respawn inbound."
        : "Runner down. Respawn inbound.",
    tone: { frequency: 180, duration: 0.18, type: "sawtooth" },
  });
}

function updateRespawnState(state, events, deltaSeconds) {
  const failureState = state.session.failureState;
  if (!failureState) {
    return false;
  }

  failureState.timer = Math.max(0, failureState.timer - deltaSeconds);
  if (failureState.timer > 0) {
    state.session.ui.speedDisplay = 0;
    return true;
  }

  const district = getDistrictById(state.session.districtId);
  const layout = getDistrictWorldLayout(district);
  snapVehicleToSafeSpawn(state.session, district, layout, 0, 92);
  const safePlayerSpawn = findSafePoint(
    district.spawnPoint,
    PLAYER_RADIUS,
    layout.rectBlockers,
    [...layout.circleBlockers, ...getStaticVehicleBlockers(layout, state.session), {
      id: "hero-vehicle",
      kind: "vehicle",
      x: state.session.vehicle.x,
      y: state.session.vehicle.y,
      radius: VEHICLE_RADIUS,
    }],
    {
      angles: [0, Math.PI * 0.5, -Math.PI * 0.5, Math.PI, Math.PI * 0.25, -Math.PI * 0.25],
      distances: [0, 18, 30, 42, 56, 70],
    }
  ) || clampToPlayArea(district.spawnPoint);

  state.session.player.x = safePlayerSpawn.x;
  state.session.player.y = safePlayerSpawn.y;
  state.session.player.angle = 0.15;
  state.session.ui.cameraYaw = state.session.player.angle;
  state.session.player.health = 100;
  state.session.player.stamina = 88;
  state.session.mode = "foot";
  state.session.ui.heat = Math.max(0, state.session.ui.heat - 2);
  state.session.ui.alertedHeatLevel = Math.round(state.session.ui.heat);
  state.session.ui.speedDisplay = 0;
  state.session.ui.routePulseTimer = 1.6;
  state.session.ui.homePingTimer = 1.5;
  state.session.combat = buildCombatState();
  clearMissionState(state.session);
  state.session.searchZones.forEach((zone) => {
    zone.active = false;
    zone.pressure = 0;
    zone.x = zone.anchorX;
    zone.y = zone.anchorY;
  });
  state.session.failureState = null;
  events.push({
    toast: `${district.homePoint.label} reset ready`,
    tone: { frequency: 560, duration: 0.12, type: "triangle" },
  });
  return true;
}

export function openScreen(state, screenName) {
  state.screen = screenName;
  if (screenName !== "game" && state.activePanel === "inventory") {
    state.activePanel = null;
  }
}

export function resetSessionToDistrict(state, districtId) {
  state.session = buildSession(districtId);
  state.activeSlot = 1;
  stabilizeSessionPlacement(state.session);
  state.lastDistrictId = districtId;
  state.selectedDistrictId = districtId;
}

export function startDistrictRun(state, districtId) {
  resetSessionToDistrict(state, districtId);
  state.screen = "game";
  state.activePanel = null;
  return {
    toast: `${getDistrictById(districtId).name} loaded`,
    tone: { frequency: 520, duration: 0.08, type: "triangle" },
  };
}

export function togglePause(state) {
  if (state.screen === "game") {
    state.screen = "pause";
    state.activePanel = null;
    return {
      tone: { frequency: 360, duration: 0.06, type: "square" },
    };
  }

  if (state.screen === "pause") {
    state.screen = "game";
    return {
      tone: { frequency: 520, duration: 0.05, type: "triangle" },
    };
  }

  return null;
}

export function toggleCombatEquip(state) {
  const combat = state.session.combat;
  state.activeSlot = 1;

  if (state.session.mode === "vehicle") {
    return {
      toast: "Step out before drawing the sidearm",
      tone: { frequency: 220, duration: 0.05, type: "square" },
    };
  }

  combat.equipped = !combat.equipped;
  combat.reloadTimer = 0;
  combat.pendingReload = false;
  state.session.player.angle = getAimAngle(state.session);
  return {
    toast: combat.equipped ? `${combat.weaponLabel} drawn` : `${combat.weaponLabel} holstered`,
    tone: { frequency: combat.equipped ? 640 : 420, duration: 0.05, type: "triangle" },
  };
}

export function reloadCombat(state) {
  return startReload(state, false);
}

export function fireCombat(state) {
  if (state.screen !== "game" || state.activePanel) {
    return null;
  }

  const session = state.session;
  const combat = session.combat;
  const player = session.player;
  if (session.failureState) {
    return {
      toast: "Respawn inbound",
      tone: { frequency: 220, duration: 0.05, type: "square" },
    };
  }

  if (session.mode === "vehicle") {
    return {
      toast: "The sidearm stays stowed in the ride",
      tone: { frequency: 220, duration: 0.05, type: "square" },
    };
  }

  state.activeSlot = 1;
  combat.equipped = true;
  if (combat.pendingReload || combat.reloadTimer > 0) {
    return {
      toast: `${combat.weaponLabel} is reloading`,
      tone: { frequency: 250, duration: 0.05, type: "square" },
    };
  }

  if (combat.fireCooldown > 0) {
    return null;
  }

  if (combat.ammoInClip <= 0) {
    return startReload(state, true);
  }

  const district = getDistrictById(session.districtId);
  const layout = getDistrictWorldLayout(district);
  const dynamicActors = getReactiveDynamicActors(layout, session);
  const aimAngle = getAimAngle(session);
  const origin = {
    x: player.x + Math.cos(aimAngle) * 10,
    y: player.y + Math.sin(aimAngle) * 10,
  };
  const shotHit = findShotHit(origin, aimAngle, combat.maxRange, layout.rectBlockers, createShotCastCircles(state, layout, dynamicActors));

  combat.ammoInClip -= 1;
  combat.fireCooldown = 0.18;
  combat.muzzleTimer = 0.1;
  combat.traceTimer = 0.12;
  combat.shotsFired += 1;
  player.angle = aimAngle;
  session.ui.heat = clamp(session.ui.heat + 0.24, 0, 5);
  combat.lastTrace = {
    startX: origin.x,
    startY: origin.y,
    endX: shotHit.point.x,
    endY: shotHit.point.y,
  };

  const target = shotHit.target;
  combat.impactTimer = target ? 0.2 : 0;
  combat.lastImpact = target ? {
    x: shotHit.point.x,
    y: shotHit.point.y,
  } : null;
  let toast = `${combat.weaponLabel} fired`;
  let tone = { frequency: 720, duration: 0.04, type: "square" };
  const blockedKinds = new Set(["pedestrian", "traffic", "patrol"]);
  let result = createShotResult({
    kind: target?.kind || "miss",
    targetId: target?.id || null,
    blocked: Boolean(target && !blockedKinds.has(target.kind)),
    hit: Boolean(target),
    x: shotHit.point.x,
    y: shotHit.point.y,
  });

  alertNearbyPedestrians(session, layout, shotHit.point, 110, { duration: 2.8 });
  alertNearbyPatrol(session, layout, shotHit.point, 165, 3.8);

  if (!target) {
    combat.lastShotResult = result;
    return { toast, tone };
  }

  combat.hitMarkerTimer = 0.14;
  if (target.kind === "pedestrian") {
    setActorReaction(session, target.id, {
      hideTimer: 3.4,
      panicTimer: 3.4,
      panicDuration: 3.4,
      fleeAngle: aimAngle,
    });
    session.ui.heat = clamp(session.ui.heat + 1.15, 0, 5);
    combat.shotsHit += 1;
    toast = "Crowd scatter sparked fresh heat";
    tone = { frequency: 860, duration: 0.05, type: "triangle" };
  } else if (target.kind === "patrol") {
    setActorReaction(session, target.id, {
      alertTimer: 4.2,
    });
    session.ui.heat = clamp(Math.max(session.ui.heat + 1.35, 3.25), 0, 5);
    combat.patrolAlertTimer = Math.max(combat.patrolAlertTimer, 4.2);
    combat.shotsHit += 1;
    toast = "Patrol contact lit up the scanner";
    tone = { frequency: 960, duration: 0.06, type: "square" };
  } else if (target.kind === "traffic") {
    setActorReaction(session, target.id, {
      alertTimer: 2.6,
    });
    session.ui.heat = clamp(session.ui.heat + 0.65, 0, 5);
    combat.shotsHit += 1;
    toast = "Traffic shell hit echoed down the lane";
  } else if (target.kind === "static-vehicle" || target.kind === "hero-vehicle") {
    session.ui.heat = clamp(session.ui.heat + 0.4, 0, 5);
    toast = "Rounds sparked off sheet metal";
  } else {
    session.ui.heat = clamp(session.ui.heat + 0.1, 0, 5);
    toast = "Shot blocked by the streetline";
    tone = { frequency: 540, duration: 0.04, type: "triangle" };
  }

  combat.lastShotResult = result;
  return { toast, tone };
}

export function toggleVehicle(state) {
  if (state.session.failureState) {
    return {
      toast: "Respawn inbound",
      tone: { frequency: 220, duration: 0.05, type: "square" },
    };
  }

  const { player, vehicle } = state.session;
  const district = getDistrictById(state.session.districtId);
  const layout = getDistrictWorldLayout(district);
  const dynamicBlockers = buildDynamicCircleBlockers(layout, state.session);
  const staticExitBlockers = [...layout.circleBlockers, ...getStaticVehicleBlockers(layout, state.session), {
    id: "hero-vehicle",
    kind: "vehicle",
    x: vehicle.x,
    y: vehicle.y,
    radius: VEHICLE_RADIUS,
  }];

  if (state.session.mode === "vehicle") {
    let exitPoint = findSafeExitPoint(
      vehicle,
      layout.rectBlockers,
      [...staticExitBlockers, ...dynamicBlockers]
    );

    if (!exitPoint && dynamicBlockers.length) {
      exitPoint = findSafeExitPoint(vehicle, layout.rectBlockers, staticExitBlockers);
    }

    if (!exitPoint) {
      return {
        toast: "No safe curb space to exit here",
        tone: { frequency: 220, duration: 0.06, type: "square" },
      };
    }

    state.session.mode = "foot";
    player.x = exitPoint.x;
    player.y = exitPoint.y;
    player.angle = vehicle.angle;
    state.session.ui.cameraYaw = vehicle.angle;
    vehicle.speed = 0;
    return {
      toast: `Exited ${vehicle.label.toLowerCase()}`,
      tone: { frequency: 400, duration: 0.05, type: "triangle" },
    };
  }

  const enterableVehicle = getNearestEnterableVehicle(state);
  if (!enterableVehicle) {
    return {
      toast: "Move closer to a ride",
      tone: { frequency: 220, duration: 0.05, type: "square" },
    };
  }

  state.session.mode = "vehicle";
  state.session.combat.equipped = false;
  state.session.combat.pendingReload = false;
  state.session.combat.reloadTimer = 0;
  if (enterableVehicle.source !== "hero") {
    state.session.claimedVehicleIds ||= [];
    if (!state.session.claimedVehicleIds.includes(enterableVehicle.id)) {
      state.session.claimedVehicleIds.push(enterableVehicle.id);
    }
    if (enterableVehicle.source === "traffic") {
      setActorReaction(state.session, enterableVehicle.id, { hideTimer: 9999 });
      state.session.ui.heat = clamp(state.session.ui.heat + (enterableVehicle.type === "patrol" ? 1.2 : 0.35), 0, 5);
    }
  }
  state.session.vehicle = {
    ...state.session.vehicle,
    spawnIndex: -1,
    x: enterableVehicle.x,
    y: enterableVehicle.y,
    angle: enterableVehicle.angle,
    speed: enterableVehicle.speed,
    durability: enterableVehicle.durability,
    type: enterableVehicle.type,
    color: enterableVehicle.color,
    label: enterableVehicle.label,
  };
  player.x = state.session.vehicle.x;
  player.y = state.session.vehicle.y;
  player.angle = state.session.vehicle.angle;
  state.session.ui.cameraYaw = state.session.vehicle.angle;
  state.session.vehicle.speed = 0;
  return {
    toast: `${enterableVehicle.source === "hero" ? "Entered" : "Jacked"} ${state.session.vehicle.label.toLowerCase()}`,
    tone: { frequency: 620, duration: 0.05, type: "sawtooth" },
  };
}

export function interactWithMission(state) {
  if (!hasActiveMission(state)) {
    const contactMission = getNearbyMissionContact(state);
    if (!contactMission) {
      return {
        toast: "No live contract nearby",
        tone: { frequency: 240, duration: 0.05, type: "square" },
      };
    }

    return startMission(state, contactMission);
  }

  if (!isNearObjective(state)) {
    return {
      toast: "No live marker nearby",
      tone: { frequency: 240, duration: 0.05, type: "square" },
    };
  }

  const script = getMissionScript(state);
  const stage = getMissionStage(state);
  const point = getMissionPointById(state, stage.pointId);

  if (isStageModeBlocked(state, stage)) {
    return {
      toast: stageNeedsVehicle(stage) ? "Need a ride for this leg" : "Step out to tag this objective",
      tone: { frequency: 220, duration: 0.05, type: "square" },
    };
  }

  if (stage.trigger === "proximity") {
    return {
      toast: "Drive through the live gate to clear it",
      tone: { frequency: 220, duration: 0.05, type: "square" },
    };
  }

  return advanceMissionStage(state, script, stage, point);
}

export function triggerSlotAction(state, slotNumber) {
  const district = getDistrictById(state.session.districtId);
  const layout = getDistrictWorldLayout(district);
  state.activeSlot = slotNumber;

  if (slotNumber === 1) {
    return toggleCombatEquip(state);
  }

  if (slotNumber === 2) {
    state.session.ui.routePulseTimer = 3;
    return {
      toast: hasActiveMission(state) ? "Route kit pulsed" : "Dispatch line pulsed",
      tone: { frequency: 660, duration: 0.05, type: "triangle" },
    };
  }

  if (slotNumber === 3) {
    state.session.ui.hornPulseTimer = 0.45;
    return {
      toast: state.session.mode === "vehicle" ? "Horn check sent" : "Street whistle sent",
      tone: {
        frequency: state.session.mode === "vehicle" ? 310 : 520,
        duration: 0.08,
        type: state.session.mode === "vehicle" ? "square" : "triangle",
      },
    };
  }

  if (slotNumber === 4) {
    const pivotPoint = state.session.mode === "vehicle" ? state.session.vehicle : state.session.player;
    const spawnIndex = findNearestVehicleSpawnIndex(district, pivotPoint);
    snapVehicleToSafeSpawn(state.session, district, layout, spawnIndex, Math.max(state.session.vehicle.durability, 82));
    if (state.session.mode === "vehicle") {
      state.session.player.x = state.session.vehicle.x;
      state.session.player.y = state.session.vehicle.y;
      state.session.player.angle = state.session.vehicle.angle;
    }
    return {
      toast: `${state.session.vehicle.label} reset`,
      tone: { frequency: 430, duration: 0.09, type: "sine" },
    };
  }

  state.session.ui.homePingTimer = 5;
  return {
    toast: `${district.homePoint.label} pinged`,
    tone: { frequency: 500, duration: 0.07, type: "triangle" },
  };
}

export function applySimulation(state, deltaSeconds) {
  const events = [];
  if (state.screen !== "game" || state.activePanel) {
    return events;
  }

  const session = state.session;
  const district = getDistrictById(session.districtId);
  const layout = getDistrictWorldLayout(district);
  const player = session.player;
  const vehicle = session.vehicle;
  const dynamicCircleBlockers = buildDynamicCircleBlockers(layout, session);

  session.clock += deltaSeconds;
  session.ui.routePulseTimer = Math.max(0, session.ui.routePulseTimer - deltaSeconds);
  session.ui.homePingTimer = Math.max(0, session.ui.homePingTimer - deltaSeconds);
  session.ui.hornPulseTimer = Math.max(0, session.ui.hornPulseTimer - deltaSeconds);
  session.ui.missionFlashTimer = Math.max(0, session.ui.missionFlashTimer - deltaSeconds);
  session.ui.collisionCooldown = Math.max(0, session.ui.collisionCooldown - deltaSeconds);
  session.ui.collisionPulseTimer = Math.max(0, session.ui.collisionPulseTimer - deltaSeconds);
  session.ui.respawnPulseTimer = Math.max(0, session.ui.respawnPulseTimer - deltaSeconds);
  session.ui.searchAlertCooldown = Math.max(0, (session.ui.searchAlertCooldown || 0) - deltaSeconds);
  updateCombatTimers(session, deltaSeconds, events);

  if (updateRespawnState(state, events, deltaSeconds)) {
    return events;
  }

  const moveLeft = state.keyboard.KeyA || state.keyboard.ArrowLeft || state.touchInput.left;
  const moveRight = state.keyboard.KeyD || state.keyboard.ArrowRight || state.touchInput.right;
  const moveUp = state.keyboard.KeyW || state.keyboard.ArrowUp || state.touchInput.up;
  const moveDown = state.keyboard.KeyS || state.keyboard.ArrowDown || state.touchInput.down;
  const sprint = state.keyboard.ShiftLeft || state.keyboard.ShiftRight;
  const handbrake = state.keyboard.Space || state.touchInput.handbrake;

  const forward = (moveUp ? 1 : 0) - (moveDown ? 1 : 0);
  const strafe = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);

  if (session.mode === "foot") {
    const magnitude = Math.hypot(strafe, forward);
    const moveSpeed = sprint ? 164 : 112;
    const viewYaw = getViewHeading(session);
    const footCircleBlockers = [
      ...layout.circleBlockers,
      ...getStaticVehicleBlockers(layout, session),
      ...dynamicCircleBlockers,
      {
        id: "hero-vehicle",
        kind: "vehicle",
        x: vehicle.x,
        y: vehicle.y,
        radius: VEHICLE_RADIUS,
      },
    ];
    player.angle = viewYaw;

    if (magnitude > 0) {
      const inputX = (Math.cos(viewYaw) * forward - Math.sin(viewYaw) * strafe) / magnitude;
      const inputY = (Math.sin(viewYaw) * forward + Math.cos(viewYaw) * strafe) / magnitude;
      const desiredX = player.x + inputX * moveSpeed * deltaSeconds;
      const desiredY = player.y + inputY * moveSpeed * deltaSeconds;
      const resolved = resolveMovement(
        player,
        desiredX,
        desiredY,
        PLAYER_RADIUS,
        layout.rectBlockers,
        footCircleBlockers
      );

      player.x = resolved.x;
      player.y = resolved.y;
      player.stamina = clamp(player.stamina - (sprint ? 18 : 7) * deltaSeconds, 22, 100);
      session.ui.speedDisplay = Math.round(moveSpeed * 0.08);
    } else {
      const settled = resolveMovement(player, player.x, player.y, PLAYER_RADIUS, layout.rectBlockers, footCircleBlockers);
      player.x = settled.x;
      player.y = settled.y;
      player.stamina = clamp(player.stamina + 15 * deltaSeconds, 0, 100);
      session.ui.speedDisplay = 0;
    }

    vehicle.speed *= 0.9;
    session.ui.heat = clamp(session.ui.heat - (session.ui.heat >= 3 ? 0.02 : 0.08) * deltaSeconds, 0, 5);
  } else {
    const throttle = (state.keyboard.KeyW || state.keyboard.ArrowUp || state.touchInput.throttle ? 1 : 0)
      - (state.keyboard.KeyS || state.keyboard.ArrowDown || state.touchInput.brake ? 1 : 0);
    const steer = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
    const previousX = vehicle.x;
    const previousY = vehicle.y;
    const vehicleBlockers = [...layout.circleBlockers, ...getStaticVehicleBlockers(layout, session), ...dynamicCircleBlockers];
    const overlapAtStart = getOverlappingBlockers(previousX, previousY, VEHICLE_RADIUS, layout.rectBlockers, vehicleBlockers);
    const startingOverlapIds = new Set(overlapAtStart.map((blocker) => blocker.id));
    const steerFactor = 1.8 - Math.min(Math.abs(vehicle.speed) / 120, 1) * 1.08;

    vehicle.speed += throttle * 128 * deltaSeconds;
    if (throttle === 0) {
      vehicle.speed *= 0.986;
    }
    if (state.touchInput.brake && !state.touchInput.throttle) {
      vehicle.speed *= 0.968;
    }
    if (handbrake) {
      vehicle.speed *= 0.952;
      session.ui.heat = clamp(session.ui.heat + 0.12 * deltaSeconds, 0, 5);
    }

    vehicle.speed = clamp(vehicle.speed, -34, 144);
    vehicle.angle += steer * steerFactor * deltaSeconds;

    const desiredX = vehicle.x + Math.cos(vehicle.angle) * vehicle.speed * deltaSeconds;
    const desiredY = vehicle.y + Math.sin(vehicle.angle) * vehicle.speed * deltaSeconds;
    const resolved = resolveMovement(
      vehicle,
      desiredX,
      desiredY,
      VEHICLE_RADIUS,
      layout.rectBlockers,
      vehicleBlockers
    );

    vehicle.x = resolved.x;
    vehicle.y = resolved.y;

    const hitKind = resolved.hit?.kind || null;
    const dynamicCollision = hitKind === "traffic" || hitKind === "pedestrian" || hitKind === "patrol";
    const overlapRecovery = resolved.hit && startingOverlapIds.has(resolved.hit.id);

    if (resolved.hit && dynamicCollision) {
      vehicle.speed = -Math.sign(vehicle.speed || 1) * Math.min(Math.abs(vehicle.speed) * 0.32 + 12, 38);
      vehicle.durability = clamp(vehicle.durability - (hitKind === "pedestrian" ? 9 : 14), 0, 100);
      player.health = clamp(player.health - (hitKind === "pedestrian" ? 2.5 : 5), 0, 100);
      session.ui.heat = clamp(session.ui.heat + (hitKind === "pedestrian" ? 0.7 : 0.5), 0, 5);
      queueCollisionCue(
        session,
        events,
        { frequency: hitKind === "pedestrian" ? 150 : 110, duration: 0.1, type: "square" },
        hitKind === "pedestrian" ? "Crowd collision spiked the heat" : null
      );
    } else if (resolved.hit && !overlapRecovery) {
      const impactSpeed = Math.max(18, Math.abs(vehicle.speed));
      vehicle.speed = -Math.sign(vehicle.speed || 1) * Math.min(impactSpeed * 0.24 + 8, 34);
      vehicle.durability = clamp(vehicle.durability - impactSpeed * 0.12, 0, 100);
      player.health = clamp(player.health - impactSpeed * 0.032, 0, 100);
      session.ui.heat = clamp(session.ui.heat + 0.35, 0, 5);
      queueCollisionCue(session, events, { frequency: 120, duration: 0.08, type: "square" });
    } else if (resolved.hit && overlapRecovery) {
      vehicle.speed *= 0.92;
    }

    player.x = vehicle.x;
    player.y = vehicle.y;
    player.angle = vehicle.angle;

    const onRoad = district.roads.some((road) => pointInsideRoad(vehicle, road));
    const inServiceYard = layout.surfaces.some((surface) => (
      (surface.kind === "yard" || surface.kind === "service" || surface.kind === "parking")
      && pointInsideRect(vehicle, surface)
    ));

    if (!onRoad && !inServiceYard) {
      vehicle.speed *= 0.972;
      vehicle.durability = clamp(vehicle.durability - 10 * deltaSeconds, 0, 100);
      session.ui.heat = clamp(session.ui.heat + 0.38 * deltaSeconds, 0, 5);
    } else if (onRoad) {
      vehicle.durability = clamp(vehicle.durability + 2.6 * deltaSeconds, 0, 100);
      session.ui.heat = clamp(session.ui.heat - (session.ui.heat >= 3 ? 0.008 : 0.04) * deltaSeconds, 0, 5);
    }

    if (Math.abs(vehicle.speed) > 96) {
      session.ui.heat = clamp(session.ui.heat + 0.16 * deltaSeconds, 0, 5);
    }

    if (Math.abs(vehicle.speed) > 118) {
      player.health = clamp(player.health - 4 * deltaSeconds, 0, 100);
    } else {
      player.health = clamp(player.health + 2.2 * deltaSeconds, 0, 100);
    }

    player.stamina = clamp(player.stamina + 10 * deltaSeconds, 0, 100);
    session.ui.speedDisplay = Math.round(Math.abs(vehicle.speed));
  }

  const objective = getActiveObjectivePoint(state);
  const distanceToObjective = distance2D(session.mode === "vehicle" ? vehicle : player, objective);
  if (distanceToObjective < 180) {
    session.ui.routePulseTimer = Math.max(session.ui.routePulseTimer, 0.3);
  }

  updateMissionTimer(state, deltaSeconds, events);
  const liveStage = hasActiveMission(state) ? getMissionStage(state) : null;
  if (hasActiveMission(state) && liveStage?.trigger === "proximity" && isNearObjective(state) && !isStageModeBlocked(state, liveStage)) {
    events.push(advanceMissionStage(state, getMissionScript(state), liveStage, objective));
  }

  updateSearchPressure(state, layout, deltaSeconds, events);

  if (vehicle.durability <= 0 || player.health <= 0) {
    if (hasActiveMission(state)) {
      failMission(state, getMissionScript(state), `${getMissionScript(state).title} failed`, events, {
        heatDelta: 0.55,
      });
    }
    beginRespawn(session, vehicle.durability <= 0 ? "vehicle" : "player", events);
  }

  maybeQueueHeatAlert(session, events);

  const clampedPlayer = clampToPlayArea(player);
  player.x = clampedPlayer.x;
  player.y = clampedPlayer.y;
  const clampedVehicle = clampToPlayArea(vehicle);
  vehicle.x = clampedVehicle.x;
  vehicle.y = clampedVehicle.y;

  return events;
}
