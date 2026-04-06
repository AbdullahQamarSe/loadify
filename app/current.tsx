import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import type { DrawerContentComponentProps, DrawerNavigationProp } from "@react-navigation/drawer";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";

import { API_BASE_URL } from "@/lib/api";

type UserData = {
  id?: string | number;
  _id?: string | number;
  name?: string;
  fullName?: string;
  username?: string;
  email?: string;
  phone?: string;
};

type LoadItem = {
  id: number;
  pickup_location?: string | null;
  drop_location?: string | null;
  weight?: string | number | null;
  load_type?: string | null;
  load_mode?: string | null;
  budget_rate?: string | number | null;
  pickup_time?: string | null;
  status?: string | null;
  trader_name?: string | null;
  trader_phone?: string | null;
  trader_email?: string | null;
  driver_current_latitude?: string | number | null;
  driver_current_longitude?: string | number | null;
  driver_location_updated_at?: string | null;
};

type LocationPoint = {
  latitude: number;
  longitude: number;
};

type RouteInfo = {
  coordinates: LocationPoint[];
  distanceText: string;
  loading: boolean;
};

type DriverDrawerParamList = {
  CurrentLoads: undefined;
};

type DrawerContentProps = DrawerContentComponentProps & {
  onLogout?: () => void;
};

const Drawer = createDrawerNavigator<DriverDrawerParamList>();
const { width, height } = Dimensions.get("window");
const API_BASE = API_BASE_URL;

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#16181c" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#b1b5bd" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#16181c" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#272b31" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f3b52" }] },
];

const parseLocation = (value?: string | null): LocationPoint | null => {
  if (!value) return null;
  const [lat, lng] = value.split(",").map((item) => Number(item.trim()));
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { latitude: lat, longitude: lng };
};

const readJsonOrText = async (response: Response) => {
  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return { error: raw || `Request failed (${response.status})` };
  }
};

const getRegionForPoints = (points: LocationPoint[]): Region => {
  if (points.length === 1) {
    return {
      latitude: points[0].latitude,
      longitude: points[0].longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);

  return {
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    latitudeDelta: Math.max(Math.max(...latitudes) - Math.min(...latitudes), 0.08) * 1.6,
    longitudeDelta: Math.max(Math.max(...longitudes) - Math.min(...longitudes), 0.08) * 1.6,
  };
};

const decodePolyline = (encoded: string, precision = 5): LocationPoint[] => {
  const points: LocationPoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const factor = Math.pow(10, precision);

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({
      latitude: lat / factor,
      longitude: lng / factor,
    });
  }

  return points;
};

const CustomDrawerContent = (props: DrawerContentProps) => {
  const { onLogout } = props;
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadUserData = async () => {
    try {
      const userDataString = await SecureStore.getItemAsync("userData");
      if (userDataString) {
        setUserData(JSON.parse(userDataString) as UserData);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
    }, [])
  );

  const navigateToPage = (pageName: string) => {
    props.navigation.closeDrawer();
    router.push(pageName as never);
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await SecureStore.deleteItemAsync("userData");
          await SecureStore.deleteItemAsync("userToken");
          props.navigation.closeDrawer();
          onLogout?.();
        },
      },
    ]);
  };

  return (
    <View style={styles.drawerContainer}>
      <LinearGradient colors={["#c12443", "#a01e36"]} style={styles.drawerHeader}>
        {loading ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : (
          <View style={styles.drawerUserInfo}>
            <Ionicons name="person-circle" size={60} color="#fff" />
            <Text style={styles.drawerUserName}>
              {userData?.name || userData?.fullName || userData?.username || "Driver"}
            </Text>
            <Text style={styles.drawerUserEmail}>
              {userData?.email || userData?.phone || "No email provided"}
            </Text>
          </View>
        )}
      </LinearGradient>

      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateToPage("/driverdashboard")}>
        <Ionicons name="home-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>Driver Dashboard</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateToPage("/requests")}>
        <Ionicons name="chatbubbles-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>Requests</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.drawerItem, styles.drawerItemActive]} onPress={() => navigateToPage("/current")}>
        <Ionicons name="navigate-outline" size={24} color="#c12443" />
        <Text style={[styles.drawerItemText, styles.drawerItemTextActive]}>Current Loads</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateToPage("/driverprofile")}>
        <Ionicons name="person-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>Profile</Text>
      </TouchableOpacity>

      <View style={styles.drawerFooter}>
        {userData && (
          <TouchableOpacity style={styles.drawerFooterItem} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="#999" />
            <Text style={styles.drawerFooterText}>Logout</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.drawerVersion}>Version 1.0.0</Text>
      </View>
    </View>
  );
};

const CurrentLoadsScreen = () => {
  const navigation = useNavigation<DrawerNavigationProp<DriverDrawerParamList>>();
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [loads, setLoads] = useState<LoadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickingId, setPickingId] = useState<number | null>(null);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [selectedLoad, setSelectedLoad] = useState<LoadItem | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [driverPoint, setDriverPoint] = useState<LocationPoint | null>(null);
  const [tracking, setTracking] = useState(false);
  const mapRef = useRef<MapView | null>(null);
  const trackingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    const syncPickedLoadsLocation = async () => {
      try {
        const stored = await SecureStore.getItemAsync("userData");
        if (!stored || !isMounted) return;

        const user = JSON.parse(stored) as UserData & { role?: string };
        const driverId = user.id || user._id;
        if (!driverId || user.role !== "driver") return;

        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") return;

        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        await fetch(`${API_BASE}/driver/location-sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            driver_id: driverId,
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude,
          }),
        });
      } catch (_error) {
        // Background sync can fail temporarily; retry on next interval.
      }
    };

    syncPickedLoadsLocation();
    intervalId = setInterval(syncPickedLoadsLocation, 5000);

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const fetchCurrentLoads = async () => {
    try {
      setLoading(true);
      const userDataString = await SecureStore.getItemAsync("userData");
      let driverId: string | number | undefined;

      if (userDataString) {
        const parsedUser = JSON.parse(userDataString) as UserData;
        setCurrentUser(parsedUser);
        driverId = parsedUser.id || parsedUser._id;
      }

      if (!driverId) {
        throw new Error("Driver account not found.");
      }

      const response = await fetch(`${API_BASE}/loads/current?driver_id=${encodeURIComponent(String(driverId))}`);
      const data = (await response.json()) as LoadItem[] | { error?: string };

      if (!response.ok) {
        throw new Error(("error" in data && data.error) || "Failed to load current tasks.");
      }

      setLoads(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading current loads:", error);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to load current tasks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentLoads();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchCurrentLoads();
    }, [])
  );

  const fitMapToPoints = (points: LocationPoint[]) => {
    if (!mapRef.current || points.length === 0) return;
    mapRef.current.fitToCoordinates(points, {
      edgePadding: { top: 70, right: 40, bottom: 90, left: 40 },
      animated: true,
    });
  };

  const fetchNavigationRoute = async (origin: LocationPoint, destination: LocationPoint) => {
    setRouteInfo({
      coordinates: [origin, destination],
      distanceText: "Updating route...",
      loading: true,
    });

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=polyline&steps=true`
      );
      const data = (await response.json()) as {
        code?: string;
        routes?: Array<{ geometry: string; distance: number; duration: number }>;
      };

      if (data.code === "Ok" && data.routes?.length) {
        const route = data.routes[0];
        const coordinates = decodePolyline(route.geometry);
        const distanceKm = (route.distance / 1000).toFixed(1);
        const durationMin = Math.round(route.duration / 60);

        setRouteInfo({
          coordinates,
          distanceText: `${distanceKm} km (${durationMin} min)`,
          loading: false,
        });
        fitMapToPoints(coordinates);
        return;
      }
    } catch (error) {
      console.error("Error fetching route:", error);
    }

    const fallback = [origin, destination];
    setRouteInfo({
      coordinates: fallback,
      distanceText: "Route preview unavailable",
      loading: false,
    });
    fitMapToPoints(fallback);
  };

  const pushDriverLocation = async (load: LoadItem, point: LocationPoint) => {
    const driverId = currentUser?.id || currentUser?._id;
    if (!driverId) return;

    try {
      // Keep all picked loads in sync with one call and avoid per-load update failures.
      const response = await fetch(`${API_BASE}/driver/location-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          driver_id: driverId,
          latitude: point.latitude,
          longitude: point.longitude,
        }),
      });

      const data = await readJsonOrText(response);
      if (!response.ok) {
        return;
      }

      const updatedLoads = Array.isArray(data.updatedLoads) ? data.updatedLoads : [];
      const updatedCurrentLoad = updatedLoads.find((item: LoadItem) => item.id === load.id);
      if (!updatedCurrentLoad) return;

      setLoads((prev) =>
        prev.map((item) => (item.id === load.id ? { ...item, ...updatedCurrentLoad } : item))
      );
      setSelectedLoad((prev) => (prev?.id === load.id ? { ...prev, ...updatedCurrentLoad } : prev));
    } catch (error) {
      // Ignore intermittent sync failures and continue route updates.
    }
  };

  const updateLiveLocationAndRoute = async (load: LoadItem) => {
    const destination = parseLocation(load.drop_location);
    if (!destination) {
      setRouteInfo(null);
      return;
    }

    try {
      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const point = {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      };

      setDriverPoint(point);
      await pushDriverLocation(load, point);
      await fetchNavigationRoute(point, destination);
    } catch (error) {
      console.error("Error getting current position:", error);
    }
  };

  const closeMap = () => {
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    setTracking(false);
    setSelectedLoad(null);
    setDriverPoint(null);
    setRouteInfo(null);
  };

  const openMapForLoad = async (load: LoadItem) => {
    const destination = parseLocation(load.drop_location);
    if (!destination) {
      Alert.alert("Map unavailable", "This load does not have a valid drop location.");
      return;
    }

    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Permission needed", "Please allow location access to open navigation.");
      return;
    }

    setSelectedLoad(load);
    setTracking(true);
    await updateLiveLocationAndRoute(load);
  };

  useEffect(() => {
    if (!tracking || !selectedLoad) return;

    trackingIntervalRef.current = setInterval(() => {
      updateLiveLocationAndRoute(selectedLoad);
    }, 4000);

    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
    };
  }, [tracking, selectedLoad]);

  const handlePickup = async (loadId: number) => {
    const driverId = currentUser?.id || currentUser?._id;
    if (!driverId) {
      Alert.alert("Error", "Driver account not found.");
      return;
    }

    try {
      setPickingId(loadId);
      const response = await fetch(`${API_BASE}/loads/${loadId}/pickup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ driver_id: driverId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to mark load as picked");
      }

      setLoads((prev) => prev.map((item) => (item.id === loadId ? { ...item, ...data.data } : item)));
      Alert.alert("Success", "Load status updated to Picked.");
    } catch (error) {
      console.error("Error picking load:", error);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to mark load as picked.");
    } finally {
      setPickingId(null);
    }
  };

  const handleComplete = async (loadId: number) => {
    const driverId = currentUser?.id || currentUser?._id;
    if (!driverId) {
      Alert.alert("Error", "Driver account not found.");
      return;
    }

    try {
      setCompletingId(loadId);
      const response = await fetch(`${API_BASE}/loads/${loadId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ driver_id: driverId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to complete load");
      }

      setLoads((prev) => prev.filter((item) => item.id !== loadId));
      if (selectedLoad?.id === loadId) {
        closeMap();
      }
      Alert.alert("Success", "Task completed successfully.");
    } catch (error) {
      console.error("Error completing load:", error);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to complete load.");
    } finally {
      setCompletingId(null);
    }
  };

  const modalPoints = [
    ...(driverPoint ? [driverPoint] : []),
    ...(parseLocation(selectedLoad?.drop_location) ? [parseLocation(selectedLoad?.drop_location) as LocationPoint] : []),
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#c12443" />
      <LinearGradient colors={["#c12443", "#a01e36"]} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
            <Ionicons name="menu" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Current Tasks</Text>
            <Text style={styles.headerSubtitle}>Accepted and picked loads</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="navigate" size={24} color="#fff" />
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.formContainer} contentContainerStyle={styles.formContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#c12443" />
            <Text style={styles.loadingText}>Loading current tasks...</Text>
          </View>
        ) : loads.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-outline" size={42} color="#c12443" />
            <Text style={styles.emptyTitle}>No active tasks</Text>
            <Text style={styles.emptySubtitle}>Accepted or picked loads will appear here.</Text>
          </View>
        ) : (
          loads.map((load) => (
            <View key={load.id} style={styles.taskCard}>
              <View style={styles.cardTopRow}>
                <Text style={styles.requestId}>Load #{load.id}</Text>
                <View style={[styles.statusBadge, load.status === "Picked" && styles.pickedBadge]}>
                  <Text style={styles.statusBadgeText}>{load.status || "Accepted"}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color="#c12443" />
                <Text style={styles.infoText}>
                  {load.pickup_location || "Unknown pickup"} to {load.drop_location || "Unknown drop"}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="cube-outline" size={18} color="#c12443" />
                <Text style={styles.infoText}>
                  {load.weight || "N/A"} kg • {load.load_mode || "N/A"} • {load.load_type || "N/A"}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={18} color="#c12443" />
                <Text style={styles.infoText}>
                  {load.trader_name || "Trader"} {load.trader_phone ? `• ${load.trader_phone}` : ""}
                </Text>
              </View>

              <View style={styles.actionRow}>
                {load.status === "Accepted" && (
                  <TouchableOpacity
                    style={[styles.primaryButton, pickingId === load.id && styles.buttonDisabled]}
                    disabled={pickingId === load.id}
                    onPress={() => handlePickup(load.id)}
                  >
                    {pickingId === load.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                        <Text style={styles.primaryButtonText}>Pick</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {load.status === "Picked" && (
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => openMapForLoad(load)}>
                    <Ionicons name="map-outline" size={18} color="#c12443" />
                    <Text style={styles.secondaryButtonText}>Open Map</Text>
                  </TouchableOpacity>
                )}

                {load.status === "Picked" && (
                  <TouchableOpacity
                    style={[styles.completeButton, completingId === load.id && styles.buttonDisabled]}
                    disabled={completingId === load.id}
                    onPress={() => handleComplete(load.id)}
                  >
                    {completingId === load.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
                        <Text style={styles.completeButtonText}>Complete Task</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={!!selectedLoad} animationType="slide" onRequestClose={closeMap}>
        <View style={styles.modalContainer}>
          <LinearGradient colors={["#c12443", "#a01e36"]} style={styles.modalHeader}>
            <TouchableOpacity onPress={closeMap} style={styles.modalCloseButton}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text style={styles.modalTitle}>Live Navigation</Text>
              <Text style={styles.modalSubtitle}>
                {selectedLoad ? `Load #${selectedLoad.id}` : "Current task"}
              </Text>
            </View>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </LinearGradient>

          <View style={styles.modalInfoCard}>
            <Text style={styles.modalInfoTitle}>Driver to Drop Route</Text>
            <Text style={styles.modalInfoText}>{routeInfo?.distanceText || "Getting live route..."}</Text>
            <Text style={styles.modalInfoText}>
              Updating driver location every 4 seconds
            </Text>
          </View>

          {modalPoints.length > 0 ? (
            <MapView
              ref={(ref) => {
                mapRef.current = ref;
              }}
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={getRegionForPoints(modalPoints)}
              customMapStyle={darkMapStyle}
              showsUserLocation={false}
            >
              {driverPoint && (
                <Marker coordinate={driverPoint}>
                  <View style={[styles.mapMarker, styles.driverMarker]}>
                    <Ionicons name="car-sport" size={18} color="#fff" />
                  </View>
                </Marker>
              )}

              {parseLocation(selectedLoad?.drop_location) && (
                <Marker coordinate={parseLocation(selectedLoad?.drop_location) as LocationPoint}>
                  <View style={[styles.mapMarker, styles.dropMarker]}>
                    <Ionicons name="flag" size={18} color="#fff" />
                  </View>
                </Marker>
              )}

              {routeInfo?.coordinates?.length ? (
                <Polyline
                  coordinates={routeInfo.coordinates}
                  strokeWidth={5}
                  strokeColor="#c12443"
                  lineDashPattern={routeInfo.loading ? [6, 6] : undefined}
                />
              ) : null}
            </MapView>
          ) : (
            <View style={styles.mapFallback}>
              <Ionicons name="map-outline" size={42} color="#c12443" />
              <Text style={styles.emptyTitle}>Map unavailable</Text>
              <Text style={styles.emptySubtitle}>A valid drop location is required to show navigation.</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

export default function CurrentLoadsPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync("userData");
    await SecureStore.deleteItemAsync("userToken");
    router.replace("/login");
  };

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} onLogout={handleLogout} />}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        drawerStyle: {
          backgroundColor: "#111",
          width: 300,
        },
        overlayColor: "rgba(0,0,0,0.5)",
        swipeEnabled: true,
      }}
    >
      <Drawer.Screen name="CurrentLoads" component={CurrentLoadsScreen} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#05070a",
  },
  header: {
    padding: 15,
    paddingTop: Platform.OS === "android" ? 40 : 15,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  headerTitleContainer: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    padding: 20,
    paddingBottom: 30,
  },
  loadingContainer: {
    paddingVertical: 80,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#aeb6bf",
  },
  emptyCard: {
    backgroundColor: "#11161d",
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(193,36,67,0.22)",
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 10,
  },
  emptySubtitle: {
    color: "#9aa4af",
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
  },
  taskCard: {
    backgroundColor: "#11161d",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  requestId: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  statusBadge: {
    backgroundColor: "rgba(193,36,67,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  pickedBadge: {
    backgroundColor: "rgba(39,174,96,0.18)",
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  infoText: {
    color: "#d7dde4",
    marginLeft: 10,
    flex: 1,
    fontSize: 14,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    flexWrap: "wrap",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#c12443",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 120,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 8,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff3f5",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 140,
  },
  secondaryButtonText: {
    color: "#c12443",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 8,
  },
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f8a70",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 160,
  },
  completeButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#05070a",
  },
  modalHeader: {
    paddingTop: Platform.OS === "android" ? 42 : 18,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  modalSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
  },
  liveBadge: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  liveBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 11,
  },
  modalInfoCard: {
    backgroundColor: "#11161d",
    margin: 16,
    marginBottom: 10,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalInfoTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  modalInfoText: {
    color: "#c5ccd5",
    fontSize: 14,
    marginBottom: 4,
  },
  map: {
    flex: 1,
    width: width,
    height: height,
  },
  mapFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  mapMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  driverMarker: {
    backgroundColor: "#c12443",
  },
  dropMarker: {
    backgroundColor: "#1f8a70",
  },
  drawerContainer: {
    flex: 1,
    backgroundColor: "#111",
  },
  drawerHeader: {
    padding: 20,
    paddingTop: 40,
  },
  drawerUserInfo: {
    alignItems: "center",
  },
  drawerUserName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginTop: 8,
  },
  drawerUserEmail: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    paddingHorizontal: 20,
    marginHorizontal: 10,
    marginVertical: 2,
    borderRadius: 10,
  },
  drawerItemActive: {
    backgroundColor: "#fff",
  },
  drawerItemText: {
    fontSize: 16,
    color: "#fff",
    marginLeft: 15,
  },
  drawerItemTextActive: {
    color: "#c12443",
  },
  drawerFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    marginTop: "auto",
  },
  drawerFooterItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  drawerFooterText: {
    fontSize: 14,
    color: "#999",
    marginLeft: 15,
  },
  drawerVersion: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginTop: 10,
  },
});
