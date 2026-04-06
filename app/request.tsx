import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
  role?: string;
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
  Requests: undefined;
};

type DrawerContentProps = DrawerContentComponentProps & {
  onLogout?: () => void;
};

const Drawer = createDrawerNavigator<DriverDrawerParamList>();
const { width } = Dimensions.get("window");
const API_BASE = API_BASE_URL;

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
        <Ionicons name="time-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>Driver Dashboard</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.drawerItem, styles.drawerItemActive]} onPress={() => navigateToPage("/requests")}>
        <Ionicons name="chatbubbles-outline" size={24} color="#c12443" />
        <Text style={[styles.drawerItemText, styles.drawerItemTextActive]}>Requests</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateToPage("/current")}>
        <Ionicons name="cube-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>Current Loads</Text>
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
        {userData && (
          <View style={styles.userInfoFooter}>
            <Ionicons name="card-outline" size={16} color="#666" />
            <Text style={styles.userIdText}>
              ID: {userData.id || userData._id || "N/A"}
            </Text>
          </View>
        )}
        <Text style={styles.drawerVersion}>Version 1.0.0</Text>
      </View>
    </View>
  );
};

const RequestsScreen = () => {
  const navigation = useNavigation<DrawerNavigationProp<DriverDrawerParamList>>();
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [loads, setLoads] = useState<LoadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [routes, setRoutes] = useState<Record<number, RouteInfo>>({});

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

  const parseLocation = (value?: string | null): LocationPoint | null => {
    if (!value) return null;
    const [lat, lng] = value.split(",").map((item) => Number(item.trim()));
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { latitude: lat, longitude: lng };
  };

  const getRouteCoordinates = (pickup?: string | null, drop?: string | null): LocationPoint[] => {
    const pickupPoint = parseLocation(pickup);
    const dropPoint = parseLocation(drop);
    return pickupPoint && dropPoint ? [pickupPoint, dropPoint] : [];
  };

  const getRegion = (points: LocationPoint[]): Region => {
    const [pickupPoint, dropPoint] = points;
    const latitude = (pickupPoint.latitude + dropPoint.latitude) / 2;
    const longitude = (pickupPoint.longitude + dropPoint.longitude) / 2;
    const latitudeDelta = Math.max(Math.abs(pickupPoint.latitude - dropPoint.latitude) * 1.5, 0.08);
    const longitudeDelta = Math.max(Math.abs(pickupPoint.longitude - dropPoint.longitude) * 1.5, 0.08);

    return {
      latitude,
      longitude,
      latitudeDelta,
      longitudeDelta,
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

  const loadRouteForLoad = async (load: LoadItem) => {
    const directPoints = getRouteCoordinates(load.pickup_location, load.drop_location);
    if (directPoints.length !== 2) {
      return;
    }

    // Set initial loading state
    setRoutes((prev) => ({
      ...prev,
      [load.id]: {
        coordinates: directPoints, // Fallback to straight line while loading
        distanceText: "Loading route...",
        loading: true,
      },
    }));

    const [pickupPoint, dropPoint] = directPoints;
    const origin = `${pickupPoint.longitude},${pickupPoint.latitude}`;
    const destination = `${dropPoint.longitude},${dropPoint.latitude}`;

    try {
      // Try OSRM first (open source, free, no API key required)
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${origin};${destination}?overview=full&geometries=polyline&steps=true`
      );
      const data = (await response.json()) as {
        code?: string;
        routes?: Array<{ geometry: string; distance: number; duration: number }>;
      };

      if (data.code === "Ok" && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = decodePolyline(route.geometry, 5);
        const distanceKm = (route.distance / 1000).toFixed(1);
        const durationMin = Math.round(route.duration / 60);
        const distanceText = `${distanceKm} km (${durationMin} min)`;

        setRoutes((prev) => ({
          ...prev,
          [load.id]: {
            coordinates,
            distanceText,
            loading: false,
          },
        }));
        return;
      }
    } catch (error) {
      console.error(`Error loading OSRM route for load ${load.id}:`, error);
    }

    // Fallback to GraphHopper (requires API key but more reliable)
    // You can get a free API key from https://graphhopper.com/
    const GRAPH_HOPPER_API_KEY = "YOUR_API_KEY_HERE"; // Replace with your API key
    if (GRAPH_HOPPER_API_KEY !== "YOUR_API_KEY_HERE") {
      try {
        const graphHopperUrl = `https://graphhopper.com/api/1/route?point=${pickupPoint.latitude},${pickupPoint.longitude}&point=${dropPoint.latitude},${dropPoint.longitude}&vehicle=car&locale=en&points_encoded=true&key=${GRAPH_HOPPER_API_KEY}`;
        const response = await fetch(graphHopperUrl);
        const data = await response.json();

        if (data.paths && data.paths.length > 0) {
          const path = data.paths[0];
          const coordinates = decodePolyline(path.points, 5);
          const distanceKm = (path.distance / 1000).toFixed(1);
          const durationMin = Math.round(path.time / 60000);
          const distanceText = `${distanceKm} km (${durationMin} min)`;

          setRoutes((prev) => ({
            ...prev,
            [load.id]: {
              coordinates,
              distanceText,
              loading: false,
            },
          }));
          return;
        }
      } catch (error) {
        console.error(`Error loading GraphHopper route for load ${load.id}:`, error);
      }
    }

    // Final fallback: calculate straight line distance
    const calculateStraightDistance = (points: LocationPoint[]): string => {
      if (points.length < 2) return "Distance unavailable";
      const [p1, p2] = points;
      const toRad = (value: number) => (value * Math.PI) / 180;
      const earthRadiusKm = 6371;
      const dLat = toRad(p2.latitude - p1.latitude);
      const dLng = toRad(p2.longitude - p1.longitude);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(p1.latitude)) *
          Math.cos(toRad(p2.latitude)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return `${(earthRadiusKm * c).toFixed(1)} km (straight line)`;
    };

    setRoutes((prev) => ({
      ...prev,
      [load.id]: {
        coordinates: directPoints,
        distanceText: calculateStraightDistance(directPoints),
        loading: false,
      },
    }));
  };

  const loadRequests = async () => {
    try {
      setLoading(true);
      const userDataString = await SecureStore.getItemAsync("userData");
      let driverId: string | number | undefined;

      if (userDataString) {
        const parsedUser = JSON.parse(userDataString) as UserData;
        setCurrentUser(parsedUser);
        driverId = parsedUser.id || parsedUser._id;
      }

      const pendingLoadsUrl = driverId
        ? `${API_BASE}/loads/pending?driver_id=${encodeURIComponent(String(driverId))}`
        : `${API_BASE}/loads/pending`;
      const response = await fetch(pendingLoadsUrl);
      const data = (await response.json()) as LoadItem[];

      if (!response.ok) {
        throw new Error("Failed to load requests");
      }

      const nextLoads = Array.isArray(data) ? data : [];
      setLoads(nextLoads);
      setRoutes({});
      
      // Load routes for each load
      await Promise.all(nextLoads.map((load) => loadRouteForLoad(load)));
    } catch (error) {
      console.error("Error loading requests:", error);
      Alert.alert("Error", "Failed to load pending requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadRequests();
    }, [])
  );

  const handleAccept = async (loadId: number) => {
    const driverId = currentUser?.id || currentUser?._id;
    if (!driverId) {
      Alert.alert("Error", "Driver account not found.");
      return;
    }

    try {
      setAcceptingId(loadId);
      const response = await fetch(`${API_BASE}/loads/${loadId}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ driver_id: driverId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to accept load");
      }

      setLoads((prev) => prev.filter((item) => item.id !== loadId));
      Alert.alert("Success", "Load accepted and assigned to your truck.");
    } catch (error) {
      console.error("Error accepting load:", error);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to accept load.");
    } finally {
      setAcceptingId(null);
    }
  };

  const handlePrePendingResponse = async (loadId: number, action: "accept" | "reject") => {
    const driverId = currentUser?.id || currentUser?._id;
    if (!driverId) {
      Alert.alert("Error", "Driver account not found.");
      return;
    }

    try {
      if (action === "accept") {
        setAcceptingId(loadId);
      } else {
        setRejectingId(loadId);
      }

      const response = await fetch(`${API_BASE}/loads/${loadId}/pre-pending/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ driver_id: driverId, action }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} offer`);
      }

      setLoads((prev) => prev.filter((item) => item.id !== loadId));
      Alert.alert("Success", action === "accept" ? "Offer moved to pending." : "Offer rejected.");
    } catch (error) {
      console.error(`Error during ${action} pre pending offer:`, error);
      Alert.alert("Error", error instanceof Error ? error.message : `Failed to ${action} offer.`);
    } finally {
      setAcceptingId(null);
      setRejectingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#c12443" />
      <LinearGradient colors={["#c12443", "#a01e36"]} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
            <Ionicons name="menu" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Load Requests</Text>
            <Text style={styles.headerSubtitle}>Pending loads and private Pre Pending offers</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="chatbubbles-outline" size={26} color="#fff" />
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.formContainer} contentContainerStyle={styles.formContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#c12443" />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        ) : loads.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-outline" size={42} color="#c12443" />
            <Text style={styles.emptyTitle}>No pending loads</Text>
            <Text style={styles.emptySubtitle}>There are no unassigned pending loads right now.</Text>
          </View>
        ) : (
          loads.map((load) => {
            const routeInfo = routes[load.id];
            const coordinates = getRouteCoordinates(load.pickup_location, load.drop_location);
            
            return (
              <View key={load.id} style={styles.requestCard}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.requestId}>Load #{load.id}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{load.status || "Pending"}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={18} color="#c12443" />
                  <Text style={styles.infoText}>
                    {load.pickup_location || "Unknown pickup"} to {load.drop_location || "Unknown drop"}
                  </Text>
                </View>

                {coordinates.length === 2 && (
                  <View style={styles.miniMapContainer}>
                    <MapView
                      style={styles.miniMap}
                      provider={PROVIDER_GOOGLE}
                      initialRegion={getRegion(coordinates)}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      rotateEnabled={false}
                      pitchEnabled={false}
                      toolbarEnabled={false}
                      customMapStyle={darkMapStyle}
                    >
                      <Marker coordinate={coordinates[0]}>
                        <View style={[styles.miniMapMarker, styles.pickupMiniMarker]}>
                          <Ionicons name="location" size={14} color="#fff" />
                        </View>
                      </Marker>
                      <Marker coordinate={coordinates[1]}>
                        <View style={[styles.miniMapMarker, styles.dropMiniMarker]}>
                          <Ionicons name="flag" size={14} color="#fff" />
                        </View>
                      </Marker>
                      {routeInfo && routeInfo.coordinates && routeInfo.coordinates.length > 0 && (
                        <Polyline
                          coordinates={routeInfo.coordinates}
                          strokeWidth={4}
                          strokeColor="#c12443"
                          lineDashPattern={routeInfo.loading ? [5, 5] : undefined}
                          lineCap="round"
                          lineJoin="round"
                        />
                      )}
                    </MapView>
                    <View style={styles.routeInfo}>
                      <View style={styles.routeInfoItem}>
                        {routeInfo?.loading ? (
                          <ActivityIndicator size="small" color="#c12443" />
                        ) : (
                          <>
                            <Ionicons name="map-outline" size={16} color="#c12443" />
                            <Text style={styles.routeInfoText}>
                              {routeInfo?.distanceText || "Loading route..."}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.metaGrid}>
                  <View style={styles.metaCard}>
                    <Text style={styles.metaLabel}>Weight</Text>
                    <Text style={styles.metaValue}>{load.weight || "N/A"}</Text>
                  </View>
                  <View style={styles.metaCard}>
                    <Text style={styles.metaLabel}>Budget</Text>
                    <Text style={styles.metaValue}>{load.budget_rate || "N/A"}</Text>
                  </View>
                  <View style={styles.metaCard}>
                    <Text style={styles.metaLabel}>Type</Text>
                    <Text style={styles.metaValue}>{load.load_type || "N/A"}</Text>
                  </View>
                  <View style={styles.metaCard}>
                    <Text style={styles.metaLabel}>Mode</Text>
                    <Text style={styles.metaValue}>{load.load_mode || "N/A"}</Text>
                  </View>
                </View>

                <View style={styles.traderBox}>
                  <Text style={styles.traderTitle}>Trader</Text>
                  <Text style={styles.traderText}>{load.trader_name || "Unknown trader"}</Text>
                  <Text style={styles.traderText}>{load.trader_phone || load.trader_email || "No contact info"}</Text>
                </View>

                {load.status === "Pre Pending" ? (
                  <View style={styles.prePendingActions}>
                    <TouchableOpacity
                      style={[styles.rejectButton, rejectingId === load.id && styles.acceptButtonDisabled]}
                      onPress={() => handlePrePendingResponse(load.id, "reject")}
                      disabled={rejectingId === load.id}
                    >
                      {rejectingId === load.id ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Text style={styles.acceptButtonText}>Reject</Text>
                          <Ionicons name="close-circle-outline" size={20} color="#fff" />
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.acceptButton, acceptingId === load.id && styles.acceptButtonDisabled]}
                      onPress={() => handlePrePendingResponse(load.id, "accept")}
                      disabled={acceptingId === load.id}
                    >
                      <LinearGradient colors={["#c12443", "#a01e36"]} style={styles.acceptGradient}>
                        {acceptingId === load.id ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <>
                            <Text style={styles.acceptButtonText}>Accept Offer</Text>
                            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.acceptButton, acceptingId === load.id && styles.acceptButtonDisabled]}
                    onPress={() => handleAccept(load.id)}
                    disabled={acceptingId === load.id}
                  >
                    <LinearGradient colors={["#c12443", "#a01e36"]} style={styles.acceptGradient}>
                      {acceptingId === load.id ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Text style={styles.acceptButtonText}>Accept</Text>
                          <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

export default function RequestsPage() {
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
      <Drawer.Screen name="Requests" component={RequestsScreen} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerTitleContainer: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    padding: 20,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#999",
  },
  emptyCard: {
    backgroundColor: "#111",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 28,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 12,
  },
  emptySubtitle: {
    color: "#999",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  requestCard: {
    backgroundColor: "#111",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 18,
    marginBottom: 16,
  },
  miniMapContainer: {
    borderRadius: 20,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  miniMap: {
    width: "100%",
    height: 200,
  },
  miniMapMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  pickupMiniMarker: {
    backgroundColor: "#c12443",
  },
  dropMiniMarker: {
    backgroundColor: "#333",
  },
  routeInfo: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#0f0f0f",
  },
  routeInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  routeInfoText: {
    marginLeft: 8,
    fontSize: 13,
    color: "#fff",
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
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusBadgeText: {
    color: "#ff8aa2",
    fontSize: 12,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  infoText: {
    color: "#ddd",
    marginLeft: 8,
    flex: 1,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  metaCard: {
    width: (width - 76) / 2,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  metaLabel: {
    color: "#999",
    fontSize: 12,
  },
  metaValue: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 4,
  },
  traderBox: {
    backgroundColor: "rgba(193,36,67,0.08)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  traderTitle: {
    color: "#ff8aa2",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  traderText: {
    color: "#fff",
    fontSize: 14,
    marginBottom: 2,
  },
  acceptButton: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  prePendingActions: {
    flexDirection: "row",
    gap: 10,
  },
  rejectButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: "#666",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButtonDisabled: {
    opacity: 0.7,
  },
  acceptGradient: {
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  acceptButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginRight: 8,
  },
  drawerContainer: {
    flex: 1,
    backgroundColor: "#111",
  },
  drawerHeader: {
    padding: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  drawerUserInfo: {
    alignItems: "center",
  },
  drawerUserName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 8,
    marginBottom: 5,
  },
  drawerUserEmail: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
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
    backgroundColor: "rgba(193,36,67,0.15)",
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
  userInfoFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  userIdText: {
    fontSize: 11,
    color: "#666",
    marginLeft: 8,
  },
});

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
];
