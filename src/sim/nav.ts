export interface SeaLaneNode {
  id: string;
  name: string;
  lon: number;
  lat: number;
  isPort?: boolean;
  islandId?: string;
}

export interface SeaLaneEdge {
  from: string;
  to: string;
  distanceKm: number;
}

export interface SeaLanesData {
  nodes: SeaLaneNode[];
  edges: SeaLaneEdge[];
}

export interface NavWaypoint {
  id: string;
  name?: string;
  lon: number;
  lat: number;
}

export interface NavPath {
  waypoints: NavWaypoint[];
  totalDistanceKm: number;
}

export interface PathInterpolationResult {
  position: { lon: number; lat: number };
  heading: number; // in radians, 0 = North, PI/2 = East, etc.
  legIndex: number;
  isComplete: boolean;
}

/**
 * Calculates great-circle haversine distance in kilometers between two geographic coordinates.
 */
export function haversineDistanceKm(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const R = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180.0;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180.0) *
      Math.cos((lat2 * Math.PI) / 180.0) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates bearing (heading) in radians from point 1 to point 2.
 * 0 = North, PI/2 = East, PI = South, 3*PI/2 = West.
 */
export function calculateBearing(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const y = (lon2 - lon1) * Math.cos(((lat1 + lat2) * Math.PI) / 360.0);
  const x = lat2 - lat1;
  let angle = Math.atan2(y, x);
  if (angle < 0) angle += 2 * Math.PI;
  return angle;
}

/**
 * Headless maritime sea-lane graph with fast A* pathfinding.
 */
export class SeaLaneGraph {
  public nodes: Map<string, SeaLaneNode> = new Map();
  public islandPortMap: Map<string, string> = new Map();
  private adjacency: Map<string, Array<{ to: string; dist: number }>> = new Map();

  constructor(data?: SeaLanesData) {
    if (data) {
      this.init(data);
    }
  }

  public init(data: SeaLanesData) {
    this.nodes.clear();
    this.islandPortMap.clear();
    this.adjacency.clear();

    for (const node of data.nodes) {
      this.nodes.set(node.id, node);
      if (node.isPort && node.islandId) {
        this.islandPortMap.set(node.islandId, node.id);
      }
      this.adjacency.set(node.id, []);
    }

    for (const edge of data.edges) {
      const listA = this.adjacency.get(edge.from);
      const listB = this.adjacency.get(edge.to);
      if (listA && listB) {
        listA.push({ to: edge.to, dist: edge.distanceKm });
        listB.push({ to: edge.from, dist: edge.distanceKm });
      }
    }
    this.pathCache.clear();
  }

  private pathCache: Map<string, NavPath | null> = new Map();

  public getPortNodeId(islandId: string): string | undefined {
    return this.islandPortMap.get(islandId) || `port_${islandId}`;
  }

  public findPathBetweenIslands(fromIslandId: string, toIslandId: string): NavPath | null {
    const cacheKey = `${fromIslandId}_${toIslandId}`;
    if (this.pathCache.has(cacheKey)) {
      return this.pathCache.get(cacheKey)!;
    }
    const startNode = this.getPortNodeId(fromIslandId);
    const endNode = this.getPortNodeId(toIslandId);
    if (!startNode || !endNode) {
      this.pathCache.set(cacheKey, null);
      return null;
    }
    const path = this.findPath(startNode, endNode);
    this.pathCache.set(cacheKey, path);
    return path;
  }

  /**
   * Fast A* search finding the shortest navigable path between two nodes.
   */
  public findPath(startNodeId: string, goalNodeId: string): NavPath | null {
    if (!this.nodes.has(startNodeId) || !this.nodes.has(goalNodeId)) {
      return null;
    }
    if (startNodeId === goalNodeId) {
      const node = this.nodes.get(startNodeId)!;
      return {
        waypoints: [{ id: node.id, name: node.name, lon: node.lon, lat: node.lat }],
        totalDistanceKm: 0,
      };
    }

    const goalNode = this.nodes.get(goalNodeId)!;

    // Priority Queue (simple array min-heap or sorted array for ~170 nodes is extremely fast)
    interface OpenEntry {
      id: string;
      f: number;
    }

    const openSet: OpenEntry[] = [{ id: startNodeId, f: 0 }];
    const cameFrom: Map<string, string> = new Map();
    const gScore: Map<string, number> = new Map([[startNodeId, 0]]);

    while (openSet.length > 0) {
      // Find element with lowest f score
      let lowestIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[lowestIdx].f) {
          lowestIdx = i;
        }
      }

      const current = openSet.splice(lowestIdx, 1)[0].id;
      if (current === goalNodeId) {
        // Reconstruct path
        const resultWaypoints: NavWaypoint[] = [];
        let curr: string | undefined = current;
        while (curr) {
          const n = this.nodes.get(curr)!;
          resultWaypoints.unshift({
            id: n.id,
            name: n.name,
            lon: n.lon,
            lat: n.lat,
          });
          curr = cameFrom.get(curr);
        }
        return {
          waypoints: resultWaypoints,
          totalDistanceKm: gScore.get(goalNodeId) || 0,
        };
      }

      const currentG = gScore.get(current)!;
      const neighbors = this.adjacency.get(current) || [];

      for (const edge of neighbors) {
        const tentativeG = currentG + edge.dist;
        const neighborG = gScore.get(edge.to) ?? Infinity;

        if (tentativeG < neighborG) {
          cameFrom.set(edge.to, current);
          gScore.set(edge.to, tentativeG);

          const neighborNode = this.nodes.get(edge.to)!;
          const h = haversineDistanceKm(
            neighborNode.lon,
            neighborNode.lat,
            goalNode.lon,
            goalNode.lat
          );
          const f = tentativeG + h;

          const existing = openSet.find((item) => item.id === edge.to);
          if (existing) {
            existing.f = f;
          } else {
            openSet.push({ id: edge.to, f });
          }
        }
      }
    }

    return null;
  }

  /**
   * Samples a ship's current position and heading along a NavPath given distance traveled.
   */
  public interpolate(path: NavWaypoint[], distanceTraveledKm: number): PathInterpolationResult {
    const N = path.length;
    if (N === 0) {
      return { position: { lon: 0, lat: 0 }, heading: 0, legIndex: 0, isComplete: true };
    }
    if (N === 1 || distanceTraveledKm <= 0) {
      const heading =
        N > 1
          ? calculateBearing(path[0].lon, path[0].lat, path[1].lon, path[1].lat)
          : 0;
      return {
        position: { lon: path[0].lon, lat: path[0].lat },
        heading,
        legIndex: 0,
        isComplete: false,
      };
    }

    // Precalculate leg lengths and cumulative distances
    const legDists: number[] = new Array(N - 1);
    const cumDists: number[] = new Array(N);
    cumDists[0] = 0;
    for (let i = 0; i < N - 1; i++) {
      legDists[i] = haversineDistanceKm(path[i].lon, path[i].lat, path[i + 1].lon, path[i + 1].lat);
      cumDists[i + 1] = cumDists[i] + legDists[i];
    }

    const totalDist = cumDists[N - 1];
    if (distanceTraveledKm >= totalDist) {
      const last = path[N - 1];
      const prev = path[N - 2];
      const finalHeading = calculateBearing(prev.lon, prev.lat, last.lon, last.lat);
      return {
        position: { lon: last.lon, lat: last.lat },
        heading: finalHeading,
        legIndex: N - 2,
        isComplete: true,
      };
    }

    // Check intermediate corner fillet zones for graceful nautical turns
    for (let i = 1; i < N - 1; i++) {
      const dIn = legDists[i - 1];
      const dOut = legDists[i];
      if (dIn > 0.01 && dOut > 0.01) {
        // Fillet radius up to 2.5 km, capped to 40% of either leg
        const R = Math.min(2.5, dIn * 0.4, dOut * 0.4);
        const cornerDist = cumDists[i];
        const tStart = cornerDist - R;
        const tEnd = cornerDist + R;

        if (distanceTraveledKm >= tStart && distanceTraveledKm <= tEnd) {
          // Inside corner fillet: quadratic Bezier curve
          const u = (distanceTraveledKm - tStart) / (2.0 * R);
          const pPrev = path[i - 1];
          const pCurr = path[i];
          const pNext = path[i + 1];

          // Entry tangent point A on incoming leg
          const fracIn = (dIn - R) / dIn;
          const pAx = pPrev.lon + fracIn * (pCurr.lon - pPrev.lon);
          const pAy = pPrev.lat + fracIn * (pCurr.lat - pPrev.lat);

          // Exit tangent point B on outgoing leg
          const fracOut = R / dOut;
          const pBx = pCurr.lon + fracOut * (pNext.lon - pCurr.lon);
          const pBy = pCurr.lat + fracOut * (pNext.lat - pCurr.lat);

          // Bezier evaluation: B(u) = (1-u)^2 * A + 2*(1-u)*u * C + u^2 * B
          const omt = 1.0 - u;
          const b0 = omt * omt;
          const b1 = 2.0 * omt * u;
          const b2 = u * u;

          const lon = b0 * pAx + b1 * pCurr.lon + b2 * pBx;
          const lat = b0 * pAy + b1 * pCurr.lat + b2 * pBy;

          // Tangent derivative: B'(u) = 2*(1-u)*(C - A) + 2*u*(B - C)
          const dLon = 2.0 * omt * (pCurr.lon - pAx) + 2.0 * u * (pBx - pCurr.lon);
          const dLat = 2.0 * omt * (pCurr.lat - pAy) + 2.0 * u * (pBy - pCurr.lat);

          const heading = calculateBearing(lon, lat, lon + dLon, lat + dLat);
          return {
            position: { lon, lat },
            heading,
            legIndex: u < 0.5 ? i - 1 : i,
            isComplete: false,
          };
        }
      }
    }

    // Straight leg linear interpolation between fillet zones
    for (let i = 0; i < N - 1; i++) {
      if (distanceTraveledKm <= cumDists[i + 1]) {
        const legDist = legDists[i];
        const distIntoLeg = distanceTraveledKm - cumDists[i];
        const t = legDist > 0.0001 ? Math.min(1.0, distIntoLeg / legDist) : 0;
        const p1 = path[i];
        const p2 = path[i + 1];
        const lon = p1.lon + t * (p2.lon - p1.lon);
        const lat = p1.lat + t * (p2.lat - p1.lat);
        const heading = calculateBearing(p1.lon, p1.lat, p2.lon, p2.lat);
        return {
          position: { lon, lat },
          heading,
          legIndex: i,
          isComplete: false,
        };
      }
    }

    const last = path[N - 1];
    const prev = path[N - 2];
    return {
      position: { lon: last.lon, lat: last.lat },
      heading: calculateBearing(prev.lon, prev.lat, last.lon, last.lat),
      legIndex: N - 2,
      isComplete: true,
    };
  }
}
