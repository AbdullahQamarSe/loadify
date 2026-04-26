export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type OSRMRouteResult = {
  distanceKm: number;
  durationMinutes: number;
  polyline: Coordinate[];
};

export async function fetchOSRMRoute(
  pickup: Coordinate,
  drop: Coordinate
): Promise<OSRMRouteResult> {
  const url = `https://router.project-osrm.org/route/v1/driving/${pickup.longitude},${pickup.latitude};${drop.longitude},${drop.latitude}?overview=full&geometries=geojson`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OSRM request failed (${response.status})`);
  }

  const data = (await response.json()) as {
    routes?: Array<{
      distance?: number;
      duration?: number;
      geometry?: {
        coordinates?: number[][];
      };
    }>;
  };

  const route = data.routes?.[0];
  if (!route || route.distance == null || route.duration == null) {
    throw new Error("Route not available");
  }

  const polyline = (route.geometry?.coordinates || [])
    .filter((point) => Array.isArray(point) && point.length >= 2)
    .map((point) => ({
      latitude: Number(point[1]),
      longitude: Number(point[0]),
    }))
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

  return {
    distanceKm: Number((route.distance / 1000).toFixed(2)),
    durationMinutes: Math.max(1, Math.round(route.duration / 60)),
    polyline,
  };
}
