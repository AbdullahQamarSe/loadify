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
// eslint-disable-next-line import/no-unresolved
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
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

type ScheduledPickupItem = {
  id: number;
  pickup_date?: string | null;
  pickup_time?: string | null;
  route?: string | null;
  weight?: string | number | null;
  load_type?: string | null;
  load_mode?: string | null;
  is_converted?: boolean;
  route_distance_km?: string | number | null;
  route_duration_minutes?: number | null;
};

type RouteState = {
  distanceKm: number;
  durationMinutes: number;
  polyline: Coordinate[];
};

const loadTypes = ["Normal", "Fragile"];
const loadModes = ["Full", "Partial"];
const RATE_PER_KM = 70;
const RATE_PER_TON = 500;

function formatDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(value: Date): string {
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}:00`;
}

function SMEScheduleScreen() {
  const navigation = useSMEDrawerNavigation();
  const netInfo = useNetInfo();

  const [pickupDate, setPickupDate] = useState(new Date());
  const [pickupTime, setPickupTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [pickupLocation, setPickupLocation] = useState<LocationValue | null>(null);
  const [dropLocation, setDropLocation] = useState<LocationValue | null>(null);

  const [weight, setWeight] = useState("");
  const [calculatedBudget, setCalculatedBudget] = useState(0);
  const [finalBudget, setFinalBudget] = useState("");
  const [loadType, setLoadType] = useState("Normal");
  const [loadMode, setLoadMode] = useState("Partial");

  const [routeState, setRouteState] = useState<RouteState | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [items, setItems] = useState<ScheduledPickupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

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

  const fetchScheduledPickups = useCallback(async () => {
    try {
      setErrorText(null);
      const smeId = await getSmeId();
      const response = await fetch(`http://13.233.124.213:8000/api/sme/schedule/?sme_id=${smeId}`);
      const data = (await response.json()) as ScheduledPickupItem[] | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to fetch scheduled pickups.");
      }
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to fetch scheduled pickups.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchScheduledPickups();
  }, [fetchScheduledPickups]);

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

  useEffect(() => {
    const distance = routeState?.distanceKm ?? 0;
    const weightKg = Number(weight || 0);
    if (!weightKg || weightKg < 0) {
      setCalculatedBudget(0);
      setFinalBudget("0");
      return;
    }
    const computed = Math.round((distance * RATE_PER_KM) + ((weightKg / 1000) * RATE_PER_TON));
    setCalculatedBudget(computed);
    setFinalBudget((prev) => {
      const parsed = Number(prev || 0);
      if (!prev || Number.isNaN(parsed) || parsed < computed) {
        return String(computed);
      }
      return prev;
    });
  }, [routeState?.distanceKm, weight]);

  const clearForm = () => {
    setPickupDate(new Date());
    setPickupTime(new Date());
    setPickupLocation(null);
    setDropLocation(null);
    setWeight("");
    setCalculatedBudget(0);
    setFinalBudget("0");
    setLoadType("Normal");
    setLoadMode("Partial");
    setRouteState(null);
    setRouteError(null);
  };

  const adjustBudget = (delta: number) => {
    const current = Number(finalBudget || calculatedBudget || 0);
    let next = current + delta;
    if (next < calculatedBudget) next = calculatedBudget;
    if (next < 0) next = 0;
    setFinalBudget(String(Math.round(next)));
  };

  const submitSchedule = async () => {
    if (!pickupLocation || !dropLocation || !weight) {
      Alert.alert("Required", "Please fill all required fields.");
      return;
    }
    if (!routeState) {
      Alert.alert("Route missing", routeError || "Route not available");
      return;
    }
    const normalizedFinalBudget = Math.max(Number(finalBudget || 0), calculatedBudget, 0);
    if (normalizedFinalBudget < calculatedBudget) {
      Alert.alert("Invalid budget", "Budget cannot be lower than minimum calculated amount");
      return;
    }

    try {
      setSubmitting(true);
      const smeId = await getSmeId();
      const routeText = `${pickupLocation.address} -> ${dropLocation.address}`;
      const response = await fetch(`http://13.233.124.213:8000/api/sme/schedule/?sme_id=${smeId}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pickup_date: formatDate(pickupDate),
          pickup_time: formatTime(pickupTime),
          pickup_location: pickupLocation.address,
          drop_location: dropLocation.address,
          pickup_address: pickupLocation.address,
          drop_address: dropLocation.address,
          pickup_lat: pickupLocation.latitude,
          pickup_lng: pickupLocation.longitude,
          drop_lat: dropLocation.latitude,
          drop_lng: dropLocation.longitude,
          route: routeText,
          route_distance_km: routeState.distanceKm,
          route_duration_minutes: routeState.durationMinutes,
          weight,
          calculated_budget: calculatedBudget,
          final_budget: normalizedFinalBudget,
          load_type: loadType,
          load_mode: loadMode,
        }),
      });
      const data = (await response.json()) as { error?: string } | Record<string, unknown>;
      if (!response.ok) {
        if ((data as { error?: string }).error) {
          throw new Error((data as { error?: string }).error as string);
        }
        const flattenedErrors = Object.values(data || {})
          .flat()
          .map((entry) => String(entry))
          .filter(Boolean);
        throw new Error(flattenedErrors[0] || "Failed to create schedule.");
      }
      clearForm();
      await fetchScheduledPickups();
      Alert.alert("Success", "Scheduled pickup created successfully.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to create schedule.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setPickupDate(date);
    }
  };

  const onTimeChange = (_event: DateTimePickerEvent, date?: Date) => {
    setShowTimePicker(false);
    if (date) {
      setPickupTime(date);
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
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchScheduledPickups();
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

            <Text style={styles.title}>Scheduled Pickups</Text>
            <Text style={styles.desc}>Create and manage your scheduled pickups.</Text>
            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

            <View style={styles.card}>
              <Text style={styles.label}>Pickup Date</Text>
              <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={16} color="#fff" />
                <Text style={styles.dateTimeText}>{formatDate(pickupDate)}</Text>
              </TouchableOpacity>
              {showDatePicker ? (
                <DateTimePicker value={pickupDate} mode="date" display="default" onChange={onDateChange} />
              ) : null}

              <Text style={styles.label}>Pickup Time</Text>
              <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowTimePicker(true)}>
                <Ionicons name="time-outline" size={16} color="#fff" />
                <Text style={styles.dateTimeText}>{formatTime(pickupTime)}</Text>
              </TouchableOpacity>
              {showTimePicker ? (
                <DateTimePicker value={pickupTime} mode="time" display="default" onChange={onTimeChange} />
              ) : null}

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

              <Text style={styles.label}>Weight (kg)</Text>
              <View style={styles.inlineValueBox}>
                <Text style={styles.inlineValueText}>{weight || "Tap +/- to set"}</Text>
                <View style={styles.weightActions}>
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => {
                      const current = Number(weight || "0");
                      setWeight(String(Math.max(0, current - 100)));
                    }}
                  >
                    <Ionicons name="remove" size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => {
                      const current = Number(weight || "0");
                      setWeight(String(current + 100));
                    }}
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.label}>Calculated Budget: PKR {calculatedBudget.toLocaleString()}</Text>
              <View style={styles.inlineValueBox}>
                <TextInput
                  style={styles.budgetInput}
                  keyboardType="numeric"
                  value={finalBudget}
                  onChangeText={(value) => {
                    const numeric = value.replace(/[^0-9]/g, "");
                    const parsed = Number(numeric || 0);
                    if (parsed < calculatedBudget) {
                      setFinalBudget(String(calculatedBudget));
                      return;
                    }
                    setFinalBudget(numeric);
                  }}
                  placeholder="Set final budget"
                  placeholderTextColor="#7f8b99"
                />
                <View style={styles.weightActions}>
                  <TouchableOpacity style={styles.smallButton} onPress={() => adjustBudget(50)}>
                    <Text style={styles.budgetBtnText}>+50</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallButton, Number(finalBudget || 0) <= calculatedBudget && styles.smallButtonDisabled]}
                    onPress={() => adjustBudget(-50)}
                    disabled={Number(finalBudget || 0) <= calculatedBudget}
                  >
                    <Text style={styles.budgetBtnText}>-50</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {Number(finalBudget || 0) <= calculatedBudget ? (
                <Text style={styles.noteText}>Budget cannot be lower than minimum calculated amount</Text>
              ) : null}

              <Text style={styles.label}>Load Type</Text>
              <View style={styles.optionRow}>
                {loadTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.optionBtn, loadType === type && styles.optionBtnActive]}
                    onPress={() => setLoadType(type)}
                  >
                    <Text style={[styles.optionText, loadType === type && styles.optionTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Load Mode</Text>
              <View style={styles.optionRow}>
                {loadModes.map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.optionBtn, loadMode === mode && styles.optionBtnActive]}
                    onPress={() => setLoadMode(mode)}
                  >
                    <Text style={[styles.optionText, loadMode === mode && styles.optionTextActive]}>{mode}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={submitSchedule}
                disabled={submitting || !routeState}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="calendar-outline" size={18} color="#fff" />
                    <Text style={styles.submitText}>Create Schedule</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.listTitle}>Scheduled Pickup List</Text>
            {loading ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="large" color="#c12443" />
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.listCard}>
            <View style={styles.listHeader}>
              <Text style={styles.listId}>Schedule #{item.id}</Text>
              <View style={[styles.statusBadge, item.is_converted && styles.statusConverted]}>
                <Text style={styles.statusText}>{item.is_converted ? "Converted" : "Pending"}</Text>
              </View>
            </View>
            <Text style={styles.listText}>
              {item.pickup_date || "N/A"} {item.pickup_time || ""}
            </Text>
            <Text style={styles.listText}>{item.route || "N/A"}</Text>
            <Text style={styles.listMeta}>
              Weight: {item.weight || "0"} kg | Type: {item.load_type || "N/A"} | Mode: {item.load_mode || "N/A"}
            </Text>
            <Text style={styles.listMeta}>
              Distance: {item.route_distance_km || "N/A"} km | ETA: {item.route_duration_minutes || "N/A"} min
            </Text>
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No scheduled pickups found.</Text> : null}
        contentContainerStyle={styles.contentWrap}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0f12", padding: 16 },
  contentWrap: { paddingBottom: 24 },
  back: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
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
  card: { backgroundColor: "#151922", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  label: { color: "#d3dbe7", fontSize: 13, fontWeight: "600", marginTop: 10, marginBottom: 6 },
  dateTimeButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    backgroundColor: "#0f141d",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  dateTimeText: { color: "#fff", marginLeft: 8, fontWeight: "600" },
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
  inlineValueBox: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    backgroundColor: "#0f141d",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inlineValueText: { color: "#fff", fontWeight: "600" },
  budgetInput: { color: "#fff", fontWeight: "600", flex: 1, paddingRight: 10 },
  weightActions: { flexDirection: "row", gap: 6 },
  smallButton: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: "#c12443",
    alignItems: "center",
    justifyContent: "center",
  },
  smallButtonDisabled: { opacity: 0.5 },
  budgetBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  noteText: { color: "#ffb4c3", fontSize: 12, marginTop: 6 },
  optionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  optionBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#11161d",
    paddingVertical: 10,
    alignItems: "center",
  },
  optionBtnActive: {
    borderColor: "rgba(193,36,67,0.7)",
    backgroundColor: "rgba(193,36,67,0.18)",
  },
  optionText: { color: "#9aa4b0", fontSize: 13, fontWeight: "600" },
  optionTextActive: { color: "#ffd7df" },
  submitButton: {
    marginTop: 14,
    backgroundColor: "#c12443",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  submitButtonDisabled: { opacity: 0.7 },
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
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  listId: { color: "#fff", fontSize: 14, fontWeight: "700" },
  statusBadge: {
    backgroundColor: "rgba(255,165,0,0.2)",
    borderColor: "rgba(255,165,0,0.45)",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusConverted: {
    backgroundColor: "rgba(56,194,122,0.2)",
    borderColor: "rgba(56,194,122,0.45)",
  },
  statusText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  listText: { color: "#d1d9e6", fontSize: 13, marginBottom: 3 },
  listMeta: { color: "#9ea8b5", fontSize: 12, marginTop: 2 },
  emptyText: { color: "#9aa4b0", textAlign: "center", marginTop: 20 },
});

export default withSMEDrawer(SMEScheduleScreen, "Scheduled Pickups");
