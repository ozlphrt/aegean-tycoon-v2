import { describe, it, expect } from 'vitest';
import {
  SeaLaneGraph,
  haversineDistanceKm,
  calculateBearing,
  type SeaLanesData,
} from './nav';
import seaLanesRaw from '../../public/data/sea_lanes.json';

describe('SeaLane Navigation & A*', () => {
  const seaLanesData = seaLanesRaw as unknown as SeaLanesData;
  const graph = new SeaLaneGraph(seaLanesData);

  it('initializes the sea lane graph with nodes and edges', () => {
    expect(graph.nodes.size).toBeGreaterThan(100);
    expect(graph.islandPortMap.size).toBe(63);
    expect(graph.getPortNodeId('santorini')).toBe('port_santorini');
    expect(graph.getPortNodeId('naxos')).toBe('port_naxos');
  });

  it('calculates haversine distance correctly', () => {
    // Athens (Piraeus: 23.63, 37.94) to Santorini (25.43, 36.39) is ~230 km
    const dist = haversineDistanceKm(23.63, 37.94, 25.43, 36.39);
    expect(dist).toBeGreaterThan(200);
    expect(dist).toBeLessThan(260);

    // Bearing North: lat increases, lon constant -> angle ~0
    const bearingNorth = calculateBearing(25.0, 36.0, 25.0, 37.0);
    expect(bearingNorth).toBeCloseTo(0, 1);
  });

  it('finds optimal maritime route from Santorini to Naxos', () => {
    const route = graph.findPathBetweenIslands('santorini', 'naxos');
    expect(route).not.toBeNull();
    expect(route!.waypoints.length).toBeGreaterThanOrEqual(3);
    expect(route!.waypoints[0].id).toBe('port_santorini');
    expect(route!.waypoints[route!.waypoints.length - 1].id).toBe('port_naxos');
    // Distance should be around ~90-110 km
    expect(route!.totalDistanceKm).toBeGreaterThan(70);
    expect(route!.totalDistanceKm).toBeLessThan(140);
  });

  it('finds optimal maritime route from Naxos to Paros', () => {
    const route = graph.findPathBetweenIslands('naxos', 'paros');
    expect(route).not.toBeNull();
    expect(route!.totalDistanceKm).toBeGreaterThan(15);
    expect(route!.totalDistanceKm).toBeLessThan(45);
  });


  it('finds long-distance route from Santorini to Piraeus', () => {
    const route = graph.findPathBetweenIslands('santorini', 'piraeus');
    expect(route).not.toBeNull();
    expect(route!.waypoints[0].id).toBe('port_santorini');
    expect(route!.waypoints[route!.waypoints.length - 1].id).toBe('port_piraeus');
  });

  it('interpolates positions smoothly along the path', () => {
    const route = graph.findPathBetweenIslands('santorini', 'naxos');
    expect(route).not.toBeNull();

    // Start of path
    const atStart = graph.interpolate(route!.waypoints, 0);
    expect(atStart.isComplete).toBe(false);
    expect(atStart.position.lon).toBeCloseTo(route!.waypoints[0].lon, 4);
    expect(atStart.position.lat).toBeCloseTo(route!.waypoints[0].lat, 4);

    // Halfway along path
    const halfDist = route!.totalDistanceKm / 2;
    const atHalf = graph.interpolate(route!.waypoints, halfDist);
    expect(atHalf.isComplete).toBe(false);
    expect(atHalf.position.lon).not.toBe(route!.waypoints[0].lon);

    // End of path
    const atEnd = graph.interpolate(route!.waypoints, route!.totalDistanceKm + 10);
    expect(atEnd.isComplete).toBe(true);
    const lastWp = route!.waypoints[route!.waypoints.length - 1];
    expect(atEnd.position.lon).toBeCloseTo(lastWp.lon, 4);
    expect(atEnd.position.lat).toBeCloseTo(lastWp.lat, 4);
  });
});
