import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

type BulkBookingItem = {
  id: number;
  weight?: string | number | null;
  calculated_budget?: string | number | null;
  final_budget?: string | number | null;
  status?: string | null;
};

type BulkBooking = {
  id: number;
  number_of_loads?: number | null;
  route?: string | null;
  created_at?: string | null;
  route_distance_km?: string | number | null;
  route_duration_minutes?: number | null;
  items?: BulkBookingItem[];
};

type RouteState = {
  distanceKm: number;
  durationMinutes: number;
  polyline: Coordinate[];
};

const RATE_PER_KM = 70;
const RATE_PER_TON = 500;

function SMEBulkBookingScreen() {
  const navigation = useSMEDrawerNavigation();
  const netInfo = useNetInfo();
  const [numberOfLoads, setNumberOfLoads] = useState("1");
  const [pickupLocation, setPickupLocation] = useState<LocationValue | null>(null);
  const [dropLocation, setDropLocation] = useState<LocationValue | null>(null);
  const [weights, setWeights] = useState<string[]>([""]);
  const [finalBudgets, setFinalBudgets] = useState<string[]>(["0"]);
  const [bookings, setBookings] = useState<BulkBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [routeState, setRouteState] = useState<RouteState | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const parsedLoads = useMemo(() => {
    const value = Number(numberOfLoads);
    if (Number.isNaN(value) || value < 1) return 1;
    return Math.min(value, 20);
  }, [numberOfLoads]);

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

  useEffect(() => {
    setWeights((prev) => {
      const next = [...prev];
      if (next.length < parsedLoads) {
        while (next.length < parsedLoads) next.push("");
      } else if (next.length > parsedLoads) {
        next.length = parsedLoads;
      }
      return next;
    });
    setFinalBudgets((prev) => {
      const next = [...prev];
      if (next.length < parsedLoads) {
        while (next.length < parsedLoads) next.push("0");
      } else if (next.length > parsedLoads) {
        next.length = parsedLoads;
      }
      return next;
    });
  }, [parsedLoads]);

  const calculatedBudgets = useMemo(() => {
    const distance = routeState?.distanceKm ?? 0;
    return weights.map((weight) => {
      const weightValue = Number(weight || 0);
      if (!weightValue || weightValue < 0) return 0;
      return Math.round((distance * RATE_PER_KM) + ((weightValue / 1000) * RATE_PER_TON));
    });
  }, [routeState?.distanceKm, weights]);

  useEffect(() => {
    setFinalBudgets((prev) =>
      prev.map((value, index) => {
        const calc = calculatedBudgets[index] || 0;
        const parsed = Number(value || 0);
        if (!value || Number.isNaN(parsed) || parsed < calc) {
          return String(calc);
        }
        return value;
      })
    );
  }, [calculatedBudgets]);

  const fetchBulkBookings = useCallback(async () => {
    try {
      setErrorText(null);
      const smeId = await getSmeId();
      const response = await fetch(`http://13.233.124.213:8000/api/sme/bulk-booking/?sme_id=${smeId}`);
      const data = (await response.json()) as BulkBooking[] | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to fetch bulk bookings.");
      }
      setBookings(Array.isArray(data) ? data : []);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to fetch bulk bookings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBulkBookings();
  }, [fetchBulkBookings]);

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

  const onWeightChange = (index: number, value: string) => {
    const numeric = value.replace(/[^0-9.]/g, "");
    setWeights((prev) => {
      const next = [...prev];
      next[index] = numeric;
      return next;
    });
  };

  const onFinalBudgetChange = (index: number, value: string) => {
    const numeric = value.replace(/[^0-9]/g, "");
    setFinalBudgets((prev) => {
      const next = [...prev];
      const parsed = Number(numeric || 0);
      const minAllowed = calculatedBudgets[index] || 0;
      next[index] = String(Math.max(parsed, minAllowed));
      return next;
    });
  };

  const adjustFinalBudget = (index: number, delta: number) => {
    setFinalBudgets((prev) => {
      const next = [...prev];
      const current = Number(next[index] || 0);
      const minAllowed = calculatedBudgets[index] || 0;
      let updated = current + delta;
      if (updated < minAllowed) updated = minAllowed;
      if (updated < 0) updated = 0;
      next[index] = String(Math.round(updated));
      return next;
    });
  };

  const submitBulkBooking = async () => {
    if (!pickupLocation || !dropLocation) {
      Alert.alert("Required", "Pickup and drop locations are required.");
      return;
    }

    if (!routeState) {
      Alert.alert("Route missing", routeError || "Route not available");
      return;
    }

    if (weights.some((w) => !w || Number(w) <= 0)) {
      Alert.alert("Invalid", "Please enter valid weight for each load.");
      return;
    }
    const normalizedFinalBudgets = finalBudgets.map((value, index) =>
      Math.max(Number(value || 0), calculatedBudgets[index] || 0, 0)
    );
    if (normalizedFinalBudgets.some((value, index) => value < (calculatedBudgets[index] || 0))) {
      Alert.alert("Invalid budget", "Budget cannot be lower than minimum calculated amount");
      return;
    }

    try {
      setSubmitting(true);
      const smeId = await getSmeId();
      const routeText = `${pickupLocation.address} -> ${dropLocation.address}`;
      const response = await fetch(`http://13.233.124.213:8000/api/sme/bulk-booking/?sme_id=${smeId}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          number_of_loads: parsedLoads,
          route: routeText,
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
          weights,
          calculated_budgets: calculatedBudgets,
          final_budgets: normalizedFinalBudgets,
        }),
      });

      const data = (await response.json()) as { error?: string; message?: string } | Record<string, unknown>;
      if (!response.ok) {
        if ((data as { error?: string }).error) {
          throw new Error((data as { error?: string }).error as string);
        }
        const flattenedErrors = Object.values(data || {})
          .flat()
          .map((entry) => String(entry))
          .filter(Boolean);
        throw new Error(flattenedErrors[0] || "Failed to create bulk booking.");
      }

      Alert.alert("Success", data.message || "Bulk booking created.");
      setPickupLocation(null);
      setDropLocation(null);
      setNumberOfLoads("1");
      setWeights([""]);
      setFinalBudgets(["0"]);
      setRouteState(null);
      setRouteError(null);
      await fetchBulkBookings();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to create bulk booking.");
    } finally {
      setSubmitting(false);
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
      <FlatList
        data={bookings}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchBulkBookings();
            }}
            tintColor="#c12443"
          />
        }
        ListHeaderComponent={
          <>
            <TouchableOpacity style={styles.back} onPress={() => navigation.openDrawer()}>
              <Ionicons name="menu" size={20} color="#fff" />
              <Text style={styles.backText}>Menu</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Bulk Booking</Text>
            <Text style={styles.desc}>Create multiple loads with map-based route details.</Text>
            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

            <View style={styles.card}>
              <Text style={styles.label}>Number of Loads</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={numberOfLoads}
                onChangeText={(text) => setNumberOfLoads(text.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 3"
                placeholderTextColor="#7f8b99"
              />

              <LocationPickerField label="Pickup Location" value={pickupLocation} onChange={setPickupLocation} />
              <LocationPickerField label="Drop Location" value={dropLocation} onChange={setDropLocation} />

              <View style={styles.routeCard}>
                <Text style={styles.routeTitle}>Route Details (OSRM)</Text>
                {routeLoading ? <ActivityIndicator size="small" color="#c12443" /> : null}
                {routeState ? (
                  <Text style={styles.routeMeta}>
                    Distance: {routeState.distanceKm} km | ETA: {routeState.durationMinutes} min
                  </Text>
                ) : (
                  <Text style={styles.routeMeta}>{routeError || "Select pickup and drop to calculate route"}</Text>
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

              <Text style={styles.label}>Weight per Load (kg)</Text>
              {weights.map((value, index) => (
                <View key={`weight-${index}`} style={styles.weightBlock}>
                  <TextInput
                    style={[styles.input, styles.weightInput]}
                    keyboardType="numeric"
                    value={value}
                    onChangeText={(text) => onWeightChange(index, text)}
                    placeholder={`Load ${index + 1} weight`}
                    placeholderTextColor="#7f8b99"
                  />
                  <Text style={styles.weightMeta}>Calculated Budget: PKR {(calculatedBudgets[index] || 0).toLocaleString()}</Text>
                  <TextInput
                    style={[styles.input, styles.weightInput]}
                    keyboardType="numeric"
                    value={finalBudgets[index] || "0"}
                    onChangeText={(text) => onFinalBudgetChange(index, text)}
                    placeholder={`Load ${index + 1} final budget`}
                    placeholderTextColor="#7f8b99"
                  />
                  <View style={styles.budgetBtnsRow}>
                    <TouchableOpacity style={styles.smallBudgetBtn} onPress={() => adjustFinalBudget(index, 50)}>
                      <Text style={styles.smallBudgetBtnText}>+50</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.smallBudgetBtn,
                        Number(finalBudgets[index] || 0) <= (calculatedBudgets[index] || 0) && styles.smallBudgetBtnDisabled,
                      ]}
                      onPress={() => adjustFinalBudget(index, -50)}
                      disabled={Number(finalBudgets[index] || 0) <= (calculatedBudgets[index] || 0)}
                    >
                      <Text style={styles.smallBudgetBtnText}>-50</Text>
                    </TouchableOpacity>
                  </View>
                  {Number(finalBudgets[index] || 0) <= (calculatedBudgets[index] || 0) ? (
                    <Text style={styles.noteText}>Budget cannot be lower than minimum calculated amount</Text>
                  ) : null}
                </View>
              ))}

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitDisabled]}
                onPress={submitBulkBooking}
                disabled={submitting || !routeState}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="layers-outline" size={18} color="#fff" />
                    <Text style={styles.submitText}>Create Bulk Booking</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.listTitle}>Bulk Booking List</Text>
            {loading ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="large" color="#c12443" />
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.listCard}>
            <Text style={styles.bookingTitle}>Bulk #{item.id}</Text>
            <Text style={styles.bookingMeta}>Loads: {item.number_of_loads || item.items?.length || 0}</Text>
            <Text style={styles.bookingMeta}>Route: {item.route || "N/A"}</Text>
            <Text style={styles.bookingMeta}>Distance: {item.route_distance_km || "N/A"} km</Text>
            <Text style={styles.bookingMeta}>ETA: {item.route_duration_minutes || "N/A"} min</Text>
            <Text style={styles.bookingMeta}>Created: {item.created_at ? item.created_at.split("T")[0] : "N/A"}</Text>
            <View style={styles.weightRow}>
              {(item.items || []).map((entry) => (
                <View key={`item-${entry.id}`} style={styles.weightChip}>
                  <Text style={styles.weightChipText}>
                    {entry.weight || "0"}kg ({entry.status || "Pending"})
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No bulk bookings found.</Text> : null}
        contentContainerStyle={styles.contentWrap}
      />
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
  },
  label: { color: "#d3dbe7", fontSize: 13, fontWeight: "600", marginTop: 10, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    backgroundColor: "#0f141d",
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  routeCard: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#0f141d",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  routeTitle: { color: "#fff", fontSize: 13, fontWeight: "700", marginBottom: 4 },
  routeMeta: { color: "#c6cfdb", fontSize: 12, marginBottom: 8 },
  map: { width: "100%", height: 160, borderRadius: 10 },
  weightBlock: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#11161d",
  },
  weightInput: { marginTop: 8 },
  weightMeta: { color: "#d3dbe7", fontSize: 12, marginTop: 8 },
  budgetBtnsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  smallBudgetBtn: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#c12443",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  smallBudgetBtnDisabled: { opacity: 0.5 },
  smallBudgetBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  noteText: { color: "#ffb4c3", fontSize: 11, marginTop: 6 },
  submitButton: {
    marginTop: 14,
    backgroundColor: "#c12443",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: "#fff", marginLeft: 8, fontWeight: "700" },
  listTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 18, marginBottom: 10 },
  loaderWrap: { paddingVertical: 14 },
  listCard: {
    backgroundColor: "#151922",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 10,
  },
  bookingTitle: { color: "#fff", fontSize: 14, fontWeight: "700", marginBottom: 6 },
  bookingMeta: { color: "#c6cfdb", fontSize: 12, marginBottom: 4 },
  weightRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  weightChip: {
    backgroundColor: "rgba(193,36,67,0.18)",
    borderWidth: 1,
    borderColor: "rgba(193,36,67,0.45)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  weightChipText: { color: "#ffd6df", fontSize: 11, fontWeight: "600" },
  emptyText: { color: "#9aa4b0", textAlign: "center", marginTop: 20 },
});

export default withSMEDrawer(SMEBulkBookingScreen, "Bulk Booking");
