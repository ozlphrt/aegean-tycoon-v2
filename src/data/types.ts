export interface IslandData {
  id: string;
  name: string;
  tier?: number;
  peak?: {
    lat: number;
    lon: number;
    name?: string;
    elevation?: number;
  };
  maskId: number;
  type: 'island' | 'mainland_port';
  country: string;
  region: string;
  lat: number;
  lon: number;
  population: number;
  port: { lat: number; lon: number };
  produces: Record<string, number>;
  consumes: Record<string, number>;
  unlock: {
    cost?: number;
    tp?: number;
    isStart?: boolean;
    requiresConnectedTo?: string[];
  };
  tourismBase?: number;
}
