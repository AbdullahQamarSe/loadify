import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import * as SecureStore from "expo-secure-store";
import { useNetInfo } from "@react-native-community/netinfo";

import { useSMEDrawerNavigation, withSMEDrawer } from "@/components/sme-drawer";
import { API_BASE_URL } from "@/lib/api";
import { fetchOSRMRoute, type Coordinate } from "@/lib/osrm";

type UserData = {
  id?: string | number;
  _id?: string | number;
};

type ShipmentItem = {
  id: number;
  pickup_location?: string | null;
  drop_location?: string | null;
  status?: string | null;
};

type StatusHistoryItem = {
  status?: string | null;
  timestamp?: string | null;
  location?: string | null;
};

type TrackResponse = {
  load_id: number;
  load_status?: string | null;
  driver?: {
    id?: number;
    name?: string;
    phone?: string;
  } | null;
  current_driver_location?: {
    latitude?: number | string;
    longitude?: number | string;
    updated_at?: string | null;
  } | null;
  pickup?: {
    location?: string | null;
    address?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
  };
  drop?: {
    location?: string | null;
    address?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
  };
  route_distance_km?: number | string | null;
  route_duration_minutes?: number | null;
  history?: StatusHistoryItem[];
};

const timelineSteps = ["Pending", "Accepted", "Picked", "Completed"];
const statusIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  Pending: "time-outline",
  Accepted: "checkmark-circle-outline",
  Picked: "car-outline",
  Completed: "flag-outline",
};

function toNumericCoordinate(value?: number | string | null): number | null {
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function SMETrackShipmentsScreen() {
  const navigation = useSMEDrawerNavigation();
  const netInfo = useNetInfo();
  const [loadIdInput, setLoadIdInput] = useState("");
  const [shipments, setShipments] = useState<ShipmentItem[]>([]);
  const [trackingData, setTrackingData] = useState<TrackResponse | null>(null);
  const [activeTrackingLoadId, setActiveTrackingLoadId] = useState<number | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [refreshingList, setRefreshingList] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [routePolyline, setRoutePolyline] = useState<Coordinate[]>([]);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeSummary, setRouteSummary] = useState<{ distanceKm: number; durationMinutes: number } | null>(null);
  const [smeId, setSmeId] = useState<string | number | null>(null);

  const getSmeId = async () => {
    const userDataString = await SecureStore.getItemAsync("userData");
    if (!userDataString) {
      throw new Error("Session not found. Please login again.");
    }
    const userData = JSON.parse(userDataString) as UserData;
    const id = userData.id ?? userData._id;
    if (!id) {
      throw new Error("SME account not found.");
    }
    return id;
  };

  const fetchShipments = useCallback(async () => {
    try {
      setErrorText(null);
      const smeId = await getSmeId();
      const response = await fetch(`http://13.233.124.213:8000/api/sme/shipments/?sme_id=${smeId}`);
      const data = (await response.json()) as ShipmentItem[] | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to fetch shipments.");
      }
      setShipments(Array.isArray(data) ? data : []);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to fetch shipments.");
    } finally {
      setLoadingList(false);
      setRefreshingList(false);
    }
  }, []);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  useEffect(() => {
    const preloadSmeId = async () => {
      try {
        const id = await getSmeId();
        setSmeId(id);
      } catch {
        setSmeId(null);
      }
    };
    preloadSmeId();
  }, []);

  const fetchTracking = async (selectedLoadId?: number, silent = false) => {
    const targetId = selectedLoadId ?? activeTrackingLoadId ?? Number(loadIdInput);
    if (!targetId || Number.isNaN(targetId)) {
      setErrorText("Enter a valid Load ID.");
      return;
    }
    try {
      setErrorText(null);
      if (!silent) setTracking(true);
      if (selectedLoadId) {
        setLoadIdInput(String(selectedLoadId));
      }
      setActiveTrackingLoadId(targetId);
      const currentSmeId = smeId ?? (await getSmeId());
      if (!smeId) {
        setSmeId(currentSmeId);
      }
      const response = await fetch(`http://13.233.124.213:8000/api/track/${targetId}/?sme_id=${currentSmeId}`);
      const data = (await response.json()) as TrackResponse | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to fetch shipment tracking.");
      }
      setTrackingData(data as TrackResponse);
    } catch (error) {
      if (!silent) {
        setTrackingData(null);
      }
      setErrorText(error instanceof Error ? error.message : "Failed to fetch shipment tracking.");
    } finally {
      if (!silent) setTracking(false);
    }
  };

  useEffect(() => {
    if (!activeTrackingLoadId) return;
    const interval = setInterval(() => {
      fetchTracking(activeTrackingLoadId, true);
    }, 7000);
    return () => clearInterval(interval);
  }, [activeTrackingLoadId]);

  const pickupCoordinate = useMemo(() => {
    const latitude = toNumericCoordinate(trackingData?.pickup?.latitude);
    const longitude = toNumericCoordinate(trackingData?.pickup?.longitude);
    if (latitude == null || longitude == null) {
      return null;
    }
    return { latitude, longitude };
  }, [trackingData?.pickup?.latitude, trackingData?.pickup?.longitude]);

  const dropCoordinate = useMemo(() => {
    const latitude = toNumericCoordinate(trackingData?.drop?.latitude);
    const longitude = toNumericCoordinate(trackingData?.drop?.longitude);
    if (latitude == null || longitude == null) {
      return null;
    }
    return { latitude, longitude };
  }, [trackingData?.drop?.latitude, trackingData?.drop?.longitude]);

  const currentStatusIndex = useMemo(() => {
    if (!trackingData?.load_status) return -1;
    return timelineSteps.indexOf(trackingData.load_status);
  }, [trackingData?.load_status]);

  const parseHistoryLocation = (value?: string | null) => {
    if (!value) return null;
    const [latRaw, lngRaw] = value.split(",");
    const lat = Number(latRaw?.trim());
    const lng = Number(lngRaw?.trim());
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { latitude: lat, longitude: lng };
  };

  const lastKnownLocation = useMemo(() => {
    const currentLat = Number(trackingData?.current_driver_location?.latitude);
    const currentLng = Number(trackingData?.current_driver_location?.longitude);
    if (!Number.isNaN(currentLat) && !Number.isNaN(currentLng)) {
      return {
        latitude: currentLat,
        longitude: currentLng,
        updated_at: trackingData?.current_driver_location?.updated_at || null,
        source: "live" as const,
      };
    }

    const history = trackingData?.history || [];
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const parsed = parseHistoryLocation(history[i]?.location);
      if (parsed) {
        return {
          ...parsed,
          updated_at: history[i]?.timestamp || null,
          source: "history" as const,
        };
      }
    }
    return null;
  }, [trackingData]);

  useEffect(() => {
    const calculateRoute = async () => {
      const pickedAndTracking = trackingData?.load_status === "Picked";
      const routeOrigin = pickedAndTracking && lastKnownLocation
        ? { latitude: lastKnownLocation.latitude, longitude: lastKnownLocation.longitude }
        : pickupCoordinate;

      if (!trackingData || !routeOrigin || !dropCoordinate) {
        setRoutePolyline([]);
        setRouteSummary(null);
        setRouteError(null);
        return;
      }

      if (!netInfo.isConnected || !netInfo.isInternetReachable) {
        setRoutePolyline([]);
        setRouteSummary(null);
        setRouteError("Route not available");
        return;
      }

      try {
        const route = await fetchOSRMRoute(routeOrigin, dropCoordinate);
        setRoutePolyline(route.polyline);
        setRouteSummary({ distanceKm: route.distanceKm, durationMinutes: route.durationMinutes });
        setRouteError(null);
      } catch {
        setRoutePolyline([]);
        setRouteSummary(null);
        setRouteError("Route not available");
      }
    };

    calculateRoute();
  }, [
    trackingData?.load_id,
    trackingData?.load_status,
    pickupCoordinate,
    dropCoordinate,
    lastKnownLocation,
    netInfo.isConnected,
    netInfo.isInternetReachable,
  ]);

  const region = useMemo<Region>(() => {
    const points = [pickupCoordinate, dropCoordinate, lastKnownLocation]
      .filter((point): point is { latitude: number; longitude: number } => !!point)
      .map((point) => ({ latitude: point.latitude, longitude: point.longitude }));

    if (points.length === 0) {
      return {
        latitude: 31.5204,
        longitude: 74.3587,
        latitudeDelta: 6,
        longitudeDelta: 6,
      };
    }

    const latitude = points.reduce((sum, value) => sum + value.latitude, 0) / points.length;
    const longitude = points.reduce((sum, value) => sum + value.longitude, 0) / points.length;

    return {
      latitude,
      longitude,
      latitudeDelta: 0.45,
      longitudeDelta: 0.45,
    };
  }, [pickupCoordinate, dropCoordinate, lastKnownLocation]);

  const currentStatus = trackingData?.load_status || "";
  const statusRejected = currentStatus === "Rejected";
  const waitingForDriver = !trackingData?.driver;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.contentWrap}
        refreshControl={
          <RefreshControl
            refreshing={refreshingList}
            onRefresh={() => {
              setRefreshingList(true);
              fetchShipments();
            }}
            tintColor="#c12443"
          />
        }
      >
        <TouchableOpacity style={styles.back} onPress={() => navigation.openDrawer()}>
          <Ionicons name="menu" size={20} color="#fff" />
          <Text style={styles.backText}>Menu</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Track Shipments</Text>
        <Text style={styles.desc}>Live driver location, route line, and shipment timeline.</Text>
        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.label}>Load ID</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, styles.flexInput]}
              value={loadIdInput}
              onChangeText={(text) => setLoadIdInput(text.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
              placeholder="Enter load ID"
              placeholderTextColor="#7f8b99"
            />
            <TouchableOpacity style={styles.trackBtn} onPress={() => fetchTracking()}>
              <Ionicons name="search-outline" size={18} color="#fff" />
              <Text style={styles.trackBtnText}>Track</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subTitle}>Or select from your shipments</Text>
          {loadingList ? (
            <ActivityIndicator size="small" color="#c12443" />
          ) : (
            <FlatList
              data={shipments.slice(0, 10)}
              keyExtractor={(item) => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.listRow}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.loadChip} onPress={() => fetchTracking(item.id)}>
                  <Text style={styles.loadChipText}>#{item.id}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No shipments available.</Text>}
            />
          )}
        </View>

        {tracking ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#c12443" />
            <Text style={styles.loaderText}>Tracking shipment...</Text>
          </View>
        ) : null}

        {trackingData ? (
          <>
            <View style={styles.card}>
              <Text style={styles.infoTitle}>Current Status</Text>
              <Text style={styles.statusValue}>{trackingData.load_status || "N/A"}</Text>
              {statusRejected ? <Text style={styles.statusHint}>Request rejected</Text> : null}
              {!statusRejected && waitingForDriver ? <Text style={styles.statusHint}>Waiting for driver</Text> : null}

              <View style={styles.progressWrap}>
                {timelineSteps.map((step, index) => {
                  const done = currentStatusIndex >= index;
                  const active = currentStatus === step;
                  return (
                    <View key={step} style={styles.progressStep}>
                      <View style={[styles.progressIcon, done && styles.progressIconDone, active && styles.progressIconActive]}>
                        <Ionicons name={statusIcons[step]} size={14} color={done ? "#fff" : "#93a0ae"} />
                      </View>
                      <Text style={[styles.progressLabel, done && styles.progressLabelDone]}>{step}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.infoTitle}>Route & Live Location</Text>
              <MapView style={styles.map} provider={PROVIDER_GOOGLE} region={region}>
                {pickupCoordinate ? (
                  <Marker coordinate={pickupCoordinate} title="Pickup" description={trackingData.pickup?.address || undefined} />
                ) : null}
                {dropCoordinate ? (
                  <Marker coordinate={dropCoordinate} title="Drop" description={trackingData.drop?.address || undefined} pinColor="#2aa9ff" />
                ) : null}
                {routePolyline.length ? (
                  <Polyline coordinates={routePolyline} strokeColor="#c12443" strokeWidth={4} />
                ) : null}
                {lastKnownLocation ? (
                  <Marker
                    coordinate={{
                      latitude: lastKnownLocation.latitude,
                      longitude: lastKnownLocation.longitude,
                    }}
                    title={trackingData.driver?.name || "Driver"}
                    description={lastKnownLocation.updated_at || undefined}
                    pinColor="#40c97a"
                  />
                ) : null}
              </MapView>
              <Text style={styles.locationMeta}>
                Distance: {routeSummary?.distanceKm ?? trackingData.route_distance_km ?? "N/A"} km | ETA: {routeSummary?.durationMinutes ?? trackingData.route_duration_minutes ?? "N/A"} min
              </Text>
              <Text style={styles.locationMeta}>
                {lastKnownLocation
                  ? `Driver: ${lastKnownLocation.latitude}, ${lastKnownLocation.longitude} (${lastKnownLocation.source === "live" ? "live" : "last known"})`
                  : "Driver location not available yet."}
              </Text>
              {routeError ? <Text style={styles.locationSubHint}>{routeError}</Text> : null}
              {currentStatus === "Picked" ? <Text style={styles.locationSubHint}>Live tracking active (auto-refresh every 7 seconds)</Text> : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.infoTitle}>Status Timeline</Text>
              {timelineSteps.map((step, index) => {
                const done = currentStatusIndex >= index;
                const historyMatch = trackingData.history?.find((h) => h.status === step);
                return (
                  <View key={step} style={styles.timelineRow}>
                    <View style={[styles.timelineDot, done && styles.timelineDotDone]} />
                    <View style={styles.timelineContent}>
                      <Text style={[styles.timelineStep, done && styles.timelineStepDone]}>{step}</Text>
                      <Text style={styles.timelineTime}>{historyMatch?.timestamp ? historyMatch.timestamp : "Not reached yet"}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0f12", padding: 16 },
  contentWrap: { paddingBottom: 24 },
  back: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  backText: { color: "#fff", marginLeft: 8, fontWeight: "600" },
  title: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 6 },
  desc: { color: "#c5ceda", fontSize: 14, marginBottom: 10 },
  errorText: {
    color: "#ffadad",
    backgroundColor: "rgba(255,77,77,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.35)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#151922",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 10,
  },
  label: { color: "#d3dbe7", fontSize: 13, fontWeight: "600", marginBottom: 6 },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  flexInput: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    backgroundColor: "#0f141d",
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  trackBtn: {
    backgroundColor: "#c12443",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  trackBtnText: { color: "#fff", marginLeft: 6, fontWeight: "700" },
  subTitle: { color: "#c7d0dc", marginTop: 12, marginBottom: 8, fontSize: 12 },
  listRow: { gap: 8 },
  loadChip: {
    backgroundColor: "rgba(193,36,67,0.18)",
    borderWidth: 1,
    borderColor: "rgba(193,36,67,0.45)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  loadChipText: { color: "#ffd8e1", fontWeight: "700", fontSize: 12 },
  emptyText: { color: "#9aa4b0", fontSize: 12 },
  loaderWrap: { alignItems: "center", paddingVertical: 14 },
  loaderText: { color: "#9aa4b0", marginTop: 8 },
  infoTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 8 },
  statusValue: { color: "#ffd8e1", fontSize: 20, fontWeight: "800" },
  statusHint: { color: "#ffd8e1", fontSize: 13, marginTop: 6 },
  progressWrap: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  progressStep: {
    alignItems: "center",
    flex: 1,
  },
  progressIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    marginBottom: 4,
  },
  progressIconDone: {
    backgroundColor: "rgba(193,36,67,0.55)",
    borderColor: "rgba(193,36,67,0.9)",
  },
  progressIconActive: {
    backgroundColor: "#c12443",
    borderColor: "#c12443",
  },
  progressLabel: { color: "#8f99a8", fontSize: 11, fontWeight: "600" },
  progressLabelDone: { color: "#fff" },
  map: { width: "100%", height: 210, borderRadius: 12, marginBottom: 8 },
  locationMeta: { color: "#bfc8d6", fontSize: 12, marginBottom: 3 },
  locationSubHint: { color: "#9aa4b0", fontSize: 11, marginTop: 4 },
  timelineRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#6f7b89",
    marginTop: 3,
    marginRight: 10,
  },
  timelineDotDone: {
    backgroundColor: "#c12443",
    borderColor: "#c12443",
  },
  timelineContent: { flex: 1 },
  timelineStep: { color: "#9ea8b5", fontSize: 14, fontWeight: "700" },
  timelineStepDone: { color: "#fff" },
  timelineTime: { color: "#8f99a8", fontSize: 12, marginTop: 2 },
});

export default withSMEDrawer(SMETrackShipmentsScreen, "Track Shipments");
