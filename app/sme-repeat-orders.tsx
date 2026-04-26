import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { useNetInfo } from "@react-native-community/netinfo";

import { useSMEDrawerNavigation, withSMEDrawer } from "@/components/sme-drawer";
import { API_BASE_URL } from "@/lib/api";
import LocationPickerField, { type LocationValue } from "@/components/location-picker-field";
import { fetchOSRMRoute, type Coordinate } from "@/lib/osrm";

type UserData = {
  id?: string | number;
  _id?: string | number;
};

type RepeatOrderLoad = {
  id: number;
  pickup_location?: string | null;
  drop_location?: string | null;
  weight?: string | number | null;
  load_type?: string | null;
  load_mode?: string | null;
  status?: string | null;
};

type RouteState = {
  distanceKm: number;
  durationMinutes: number;
  polyline: Coordinate[];
};

function SMERepeatOrdersScreen() {
  const router = useRouter();
  const navigation = useSMEDrawerNavigation();
  const netInfo = useNetInfo();
  const [loads, setLoads] = useState<RepeatOrderLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingId, setCreatingId] = useState<number | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [pickupLocation, setPickupLocation] = useState<LocationValue | null>(null);
  const [dropLocation, setDropLocation] = useState<LocationValue | null>(null);
  const [routeState, setRouteState] = useState<RouteState | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

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

  const loadCompletedLoads = useCallback(async () => {
    try {
      setErrorText(null);
      const smeId = await getSmeId();
      const response = await fetch(`http://13.233.124.213:8000/api/sme/repeat-orders/?sme_id=${smeId}`);
      const data = (await response.json()) as RepeatOrderLoad[] | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to fetch repeat orders.");
      }
      setLoads(Array.isArray(data) ? data : []);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to fetch repeat orders.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCompletedLoads();
  }, [loadCompletedLoads]);

  useEffect(() => {
    const calculateRoute = async () => {
      if (!pickupLocation || !dropLocation) {
        setRouteState(null);
        setRouteError(null);
        return;
      }

      if (!netInfo.isConnected || !netInfo.isInternetReachable) {
        setRouteState(null);
        setRouteError("Route not available");
        return;
      }

      try {
        setRouteLoading(true);
        setRouteError(null);
        const route = await fetchOSRMRoute(
          { latitude: pickupLocation.latitude, longitude: pickupLocation.longitude },
          { latitude: dropLocation.latitude, longitude: dropLocation.longitude }
        );
        setRouteState(route);
      } catch {
        setRouteState(null);
        setRouteError("Route not available");
      } finally {
        setRouteLoading(false);
      }
    };

    calculateRoute();
  }, [pickupLocation, dropLocation, netInfo.isConnected, netInfo.isInternetReachable]);

  const onRepeat = async (id: number) => {
    if (!pickupLocation || !dropLocation) {
      Alert.alert("Required", "Pickup and drop locations are required.");
      return;
    }
    if (!routeState) {
      Alert.alert("Route missing", routeError || "Route not available");
      return;
    }

    try {
      setCreatingId(id);
      const smeId = await getSmeId();
      const response = await fetch(`http://13.233.124.213:8000/api/sme/repeat-orders/${id}/create/?sme_id=${smeId}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pickup_location: pickupLocation.address,
          drop_location: dropLocation.address,
          pickup_address: pickupLocation.address,
          drop_address: dropLocation.address,
          pickup_lat: pickupLocation.latitude,
          pickup_lng: pickupLocation.longitude,
          drop_lat: dropLocation.latitude,
          drop_lng: dropLocation.longitude,
          route_distance_km: routeState.distanceKm,
          route_duration_minutes: routeState.durationMinutes,
        }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to create repeat order.");
      }
      Alert.alert("Success", data.message || "Repeat order created.", [
        { text: "OK", onPress: () => router.replace("/smedashboard") },
      ]);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to create repeat order.");
    } finally {
      setCreatingId(null);
    }
  };

  const mapRegion = useMemo<Region>(() => {
    if (!pickupLocation && !dropLocation) {
      return {
        latitude: 31.5204,
        longitude: 74.3587,
        latitudeDelta: 5,
        longitudeDelta: 5,
      };
    }

    const latitudes = [pickupLocation?.latitude, dropLocation?.latitude].filter((v): v is number => typeof v === "number");
    const longitudes = [pickupLocation?.longitude, dropLocation?.longitude].filter((v): v is number => typeof v === "number");

    const latitude = latitudes.reduce((sum, value) => sum + value, 0) / latitudes.length;
    const longitude = longitudes.reduce((sum, value) => sum + value, 0) / longitudes.length;

    return {
      latitude,
      longitude,
      latitudeDelta: 0.45,
      longitudeDelta: 0.45,
    };
  }, [pickupLocation, dropLocation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.openDrawer()}>
          <Ionicons name="menu" size={20} color="#fff" />
          <Text style={styles.backText}>Menu</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Repeat Orders</Text>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#c12443" />
          <Text style={styles.loaderText}>Loading completed loads...</Text>
        </View>
      ) : (
        <FlatList
          data={loads}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadCompletedLoads();
              }}
              tintColor="#c12443"
            />
          }
          ListHeaderComponent={
            <>
              <Text style={styles.desc}>Pick locations and repeat a completed load.</Text>
              {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
              <View style={styles.formCard}>
                <LocationPickerField label="Pickup Location" value={pickupLocation} onChange={setPickupLocation} />
                <LocationPickerField label="Drop Location" value={dropLocation} onChange={setDropLocation} />

                <View style={styles.routeMetaCard}>
                  <Text style={styles.routeMetaTitle}>Route Details (OSRM)</Text>
                  {routeLoading ? <ActivityIndicator size="small" color="#c12443" /> : null}
                  {routeState ? (
                    <Text style={styles.routeMetaText}>
                      Distance: {routeState.distanceKm} km | ETA: {routeState.durationMinutes} min
                    </Text>
                  ) : (
                    <Text style={styles.routeMetaText}>{routeError || "Select pickup and drop to calculate route"}</Text>
                  )}
                  <MapView style={styles.map} provider={PROVIDER_GOOGLE} region={mapRegion}>
                    {pickupLocation ? (
                      <Marker
                        coordinate={{ latitude: pickupLocation.latitude, longitude: pickupLocation.longitude }}
                        title="Pickup"
                        description={pickupLocation.address}
                      />
                    ) : null}
                    {dropLocation ? (
                      <Marker
                        coordinate={{ latitude: dropLocation.latitude, longitude: dropLocation.longitude }}
                        title="Drop"
                        description={dropLocation.address}
                        pinColor="#2aa9ff"
                      />
                    ) : null}
                    {routeState?.polyline?.length ? (
                      <Polyline coordinates={routeState.polyline} strokeColor="#c12443" strokeWidth={4} />
                    ) : null}
                  </MapView>
                </View>
              </View>
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Load #{item.id}</Text>
              <Text style={styles.cardText}>
                {item.pickup_location || "N/A"} {"->"} {item.drop_location || "N/A"}
              </Text>
              <Text style={styles.cardMeta}>
                Weight: {item.weight || "0"} kg | Type: {item.load_type || "N/A"} | Mode: {item.load_mode || "N/A"}
              </Text>
              <TouchableOpacity
                style={[styles.repeatButton, creatingId === item.id && styles.repeatButtonDisabled]}
                onPress={() => onRepeat(item.id)}
                disabled={creatingId === item.id || !routeState}
              >
                {creatingId === item.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="repeat-outline" size={18} color="#fff" />
                    <Text style={styles.repeatButtonText}>Repeat</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No completed loads available for repeat.</Text>}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0f12", padding: 16 },
  headerRow: { marginBottom: 10 },
  back: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  backText: { color: "#fff", marginLeft: 8, fontWeight: "600" },
  title: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 8 },
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
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  loaderText: { marginTop: 10, color: "#9aa4b0" },
  listContent: { paddingBottom: 20 },
  formCard: {
    backgroundColor: "#151922",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 12,
    marginBottom: 10,
  },
  routeMetaCard: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#0f141d",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  routeMetaTitle: { color: "#fff", fontSize: 13, fontWeight: "700", marginBottom: 4 },
  routeMetaText: { color: "#c6cfdb", fontSize: 12, marginBottom: 8 },
  map: { width: "100%", height: 160, borderRadius: 10 },
  card: {
    backgroundColor: "#151922",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 10,
  },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 6 },
  cardText: { color: "#d2dae6", fontSize: 13, marginBottom: 5 },
  cardMeta: { color: "#aab3c0", fontSize: 12, marginBottom: 12 },
  repeatButton: {
    backgroundColor: "#c12443",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  repeatButtonDisabled: { opacity: 0.7 },
  repeatButtonText: { color: "#fff", marginLeft: 8, fontWeight: "700" },
  emptyText: { color: "#9aa4b0", textAlign: "center", marginTop: 30 },
});

export default withSMEDrawer(SMERepeatOrdersScreen, "Repeat Orders");
