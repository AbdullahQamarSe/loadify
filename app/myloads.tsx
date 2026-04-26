import React, { useEffect, useState } from "react";
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
import * as SecureStore from "expo-secure-store";

import { AppDrawerContent, type DrawerMenuItem } from "@/components/app-drawer-content";
import { API_BASE_URL } from "@/lib/api";
import { LogBox } from 'react-native';

if (!__DEV__) {
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.log('Global error caught:', error);
  });
}

LogBox.ignoreAllLogs(true);


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
  drop_lat?: string | number | null;
  drop_lng?: string | number | null;
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

type TraderDrawerParamList = {
  MyLoads: undefined;
};

type DrawerContentProps = DrawerContentComponentProps & {
  onLogout?: () => void;
};

const Drawer = createDrawerNavigator<TraderDrawerParamList>();
const traderDrawerItems: DrawerMenuItem[] = [
  { icon: "add-circle-outline", label: "Create Load", route: "/traderdashboard" },
  { icon: "cube-outline", label: "My Loads", route: "/myloads" },
  { icon: "car-outline", label: "Partial Trucks", route: "/partialtruck" },
  { icon: "locate-outline", label: "Find Truck", route: "/findtruck" },
  { icon: "person-outline", label: "Profile", route: "/profile" },
];
const { width, height } = Dimensions.get("window");

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

const toCoordinateNumber = (value?: string | number | null): number | null => {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const resolveDropPoint = (load: LoadItem): LocationPoint | null => {
  const latitude = toCoordinateNumber(load.drop_lat);
  const longitude = toCoordinateNumber(load.drop_lng);
  if (latitude != null && longitude != null) {
    return { latitude, longitude };
  }
  return parseLocation(load.drop_location);
};

const parseDriverPoint = (load: LoadItem): LocationPoint | null => {
  const latitude = Number(load.driver_current_latitude);
  const longitude = Number(load.driver_current_longitude);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
  return { latitude, longitude };
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
    await SecureStore.deleteItemAsync("userData");
    await SecureStore.deleteItemAsync("userToken");
    props.navigation.closeDrawer();
    onLogout?.();
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
              {userData?.name || userData?.fullName || userData?.username || "Trader"}
            </Text>
            <Text style={styles.drawerUserEmail}>
              {userData?.email || userData?.phone || "No email provided"}
            </Text>
          </View>
        )}
      </LinearGradient>

      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateToPage("/traderdashboard")}>
        <Ionicons name="add-circle-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>Create Load</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.drawerItem, styles.drawerItemActive]} onPress={() => navigateToPage("/myloads")}>
        <Ionicons name="cube-outline" size={24} color="#c12443" />
        <Text style={[styles.drawerItemText, styles.drawerItemTextActive]}>My Loads</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateToPage("/partialtruck")}>
        <Ionicons name="car-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>Partial Trucks</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateToPage("/findtruck")}>
        <Ionicons name="locate-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>Find Truck</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateToPage("/profile")}>
        <Ionicons name="person-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>Profile</Text>
      </TouchableOpacity>

      <View style={styles.drawerFooter}>
        <TouchableOpacity style={styles.drawerFooterItem} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#999" />
          <Text style={styles.drawerFooterText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const MyLoadsScreen = () => {
  const navigation = useNavigation<DrawerNavigationProp<TraderDrawerParamList>>();
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [loads, setLoads] = useState<LoadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoad, setSelectedLoad] = useState<LoadItem | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  const buildRouteForLoad = async (load: LoadItem, silent = false) => {
    const driverPoint = parseDriverPoint(load);
    const dropPoint = resolveDropPoint(load);
    if (!driverPoint || !dropPoint) return false;

    if (!silent || !routeInfo) {
      setRouteInfo({
        coordinates: [driverPoint, dropPoint],
        distanceText: "Loading route...",
        loading: true,
      });
    }

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${driverPoint.longitude},${driverPoint.latitude};${dropPoint.longitude},${dropPoint.latitude}?overview=full&geometries=polyline&steps=true`
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
        return true;
      }
    } catch (error) {
      console.error("Error loading trader route preview:", error);
    }

    setRouteInfo({
      coordinates: [driverPoint, dropPoint],
      distanceText: "Route preview unavailable",
      loading: false,
    });
    return true;
  };

  const openMapForLoad = async (load: LoadItem) => {
    const canRenderRoute = await buildRouteForLoad(load);
    if (!canRenderRoute) {
      Alert.alert("Map unavailable", "Driver location or drop location is not available yet.");
      return;
    }
    setSelectedLoad(load);
  };

  const closeMap = () => {
    setSelectedLoad(null);
    setRouteInfo(null);
  };

  const loadMyLoads = async () => {
    try {
      const stored = await SecureStore.getItemAsync("userData");
      if (!stored) {
        setLoads([]);
        setCurrentUser(null);
        return;
      }

      const user = JSON.parse(stored) as UserData;
      const userId = user.id || user._id;
      if (!userId) {
        setLoads([]);
        setCurrentUser(null);
        return;
      }

      setCurrentUser(user);
      const response = await fetch(`http://13.233.124.213:8000/api/user/loads?userId=${encodeURIComponent(String(userId))}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load my loads");
      }

      setLoads(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading trader loads:", error);
      const message = error instanceof Error ? error.message : "Failed to load your loads.";
      const isAuthStateError =
        message.toLowerCase().includes("user not found") ||
        message.toLowerCase().includes("invalid userid") ||
        message.toLowerCase().includes("user data not found") ||
        message.toLowerCase().includes("user id not found");

      if (!isAuthStateError) {
        Alert.alert("Error", message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    setLoading(true);
    loadMyLoads();
    intervalId = setInterval(loadMyLoads, 7000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadMyLoads();
    }, [])
  );

  useEffect(() => {
    if (!selectedLoad) return;
    const latestLoad = loads.find((item) => item.id === selectedLoad.id);
    if (!latestLoad) {
      closeMap();
      return;
    }
    if (latestLoad !== selectedLoad) {
      setSelectedLoad(latestLoad);
    }
    buildRouteForLoad(latestLoad, true);
  }, [loads, selectedLoad?.id]);

  const selectedDriverPoint = selectedLoad ? parseDriverPoint(selectedLoad) : null;
  const selectedDropPoint = selectedLoad ? resolveDropPoint(selectedLoad) : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#c12443" />
      <LinearGradient colors={["#c12443", "#a01e36"]} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
            <Ionicons name="menu" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>My Loads</Text>
            <Text style={styles.headerSubtitle}>All statuses with live picked-driver route</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{loads.length}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.formContainer} contentContainerStyle={styles.formContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#c12443" />
            <Text style={styles.loadingText}>Loading your loads...</Text>
          </View>
        ) : loads.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={42} color="#c12443" />
            <Text style={styles.emptyTitle}>No loads yet</Text>
            <Text style={styles.emptySubtitle}>
              {currentUser?.name || currentUser?.fullName || "Trader"}, your created loads will appear here.
            </Text>
          </View>
        ) : (
          loads.map((load) => (
            <View key={load.id} style={styles.loadCard}>
              <View style={styles.cardTopRow}>
                <Text style={styles.loadId}>Load #{load.id}</Text>
                <View style={[styles.statusBadge, load.status === "Picked" && styles.pickedBadge]}>
                  <Text style={styles.statusText}>{load.status || "Pending"}</Text>
                </View>
              </View>

              <Text style={styles.routeText}>
                {load.pickup_location || "Unknown pickup"} to {load.drop_location || "Unknown drop"}
              </Text>

              <Text style={styles.metaText}>
                {load.weight || "N/A"} kg • {load.load_mode || "N/A"} • {load.load_type || "N/A"}
              </Text>

              <Text style={styles.metaText}>Budget: {load.budget_rate || "N/A"}</Text>
              {load.pickup_time ? <Text style={styles.metaText}>Schedule: {load.pickup_time}</Text> : null}

              {load.status === "Picked" ? (
                <View style={styles.locationBox}>
                  <Text style={styles.locationTitle}>Driver Live Tracking</Text>
                  <Text style={styles.locationText}>
                    Updated: {load.driver_location_updated_at || "Waiting for update"}
                  </Text>
                  <TouchableOpacity style={styles.mapButton} onPress={() => openMapForLoad(load)}>
                    <Ionicons name="map-outline" size={18} color="#fff" />
                    <Text style={styles.mapButtonText}>Open Map</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
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
              <Text style={styles.modalTitle}>Driver Route</Text>
              <Text style={styles.modalSubtitle}>
                {selectedLoad ? `Load #${selectedLoad.id}` : "My load"}
              </Text>
            </View>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </LinearGradient>

          <View style={styles.modalInfoCard}>
            <Text style={styles.locationTitle}>Driver to Drop Route</Text>
            <Text style={styles.locationText}>{routeInfo?.distanceText || "Loading route..."}</Text>
            <Text style={styles.locationText}>
              Last update: {selectedLoad?.driver_location_updated_at || "Waiting for update"}
            </Text>
            <Text style={styles.locationText}>Auto refresh every 7 seconds</Text>
          </View>

          {selectedLoad && selectedDriverPoint && selectedDropPoint ? (
            <MapView
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={getRegionForPoints([
                selectedDriverPoint,
                selectedDropPoint,
              ])}
              customMapStyle={darkMapStyle}
            >
              <Marker coordinate={selectedDriverPoint}>
                <View style={[styles.mapMarker, styles.driverMarker]}>
                  <Ionicons name="car-sport" size={18} color="#fff" />
                </View>
              </Marker>
              <Marker coordinate={selectedDropPoint}>
                <View style={[styles.mapMarker, styles.dropMarker]}>
                  <Ionicons name="flag" size={18} color="#fff" />
                </View>
              </Marker>
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
            <View style={styles.emptyCard}>
              <Ionicons name="map-outline" size={42} color="#c12443" />
              <Text style={styles.emptyTitle}>Map unavailable</Text>
              <Text style={styles.emptySubtitle}>Driver route is not ready yet.</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

export default function MyLoadsPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync("userData");
    await SecureStore.deleteItemAsync("userToken");
    router.replace("/login");
  };

  return (
    <Drawer.Navigator
      drawerContent={(props) => (
        <AppDrawerContent
          {...props}
          items={traderDrawerItems}
          onLogout={handleLogout}
          defaultUserLabel="Trader"
        />
      )}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        drawerStyle: { backgroundColor: "#111", width: 300 },
        overlayColor: "rgba(0,0,0,0.5)",
      }}
    >
      <Drawer.Screen name="MyLoads" component={MyLoadsScreen} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#05070a" },
  header: { padding: 15, paddingTop: 40 },
  headerContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  menuButton: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  headerTitleContainer: { flex: 1, alignItems: "center", marginHorizontal: 10 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  headerSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.82)", textAlign: "center" },
  headerBadge: { minWidth: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerBadgeText: { color: "#fff", fontWeight: "700" },
  formContainer: { flex: 1 },
  formContent: { padding: 20, paddingBottom: 34 },
  loadingContainer: { paddingVertical: 80, alignItems: "center" },
  loadingText: { marginTop: 10, color: "#9aa4af" },
  emptyCard: { backgroundColor: "#11161d", borderRadius: 22, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "rgba(193,36,67,0.22)" },
  emptyTitle: { color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 10 },
  emptySubtitle: { color: "#9aa4af", fontSize: 14, textAlign: "center", marginTop: 6 },
  loadCard: { backgroundColor: "#11161d", borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  loadId: { color: "#fff", fontSize: 18, fontWeight: "700" },
  statusBadge: { backgroundColor: "rgba(193,36,67,0.18)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  pickedBadge: { backgroundColor: "rgba(39,174,96,0.18)" },
  statusText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  routeText: { color: "#fff", fontSize: 15, fontWeight: "600", marginBottom: 8 },
  metaText: { color: "#b8c0c8", fontSize: 13, marginBottom: 6 },
  locationBox: { marginTop: 12, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 14 },
  locationTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 8 },
  locationText: { color: "#d2d8df", fontSize: 13, marginBottom: 4 },
  mapButton: {
    marginTop: 10,
    backgroundColor: "#c12443",
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  mapButtonText: { color: "#fff", fontSize: 14, fontWeight: "700", marginLeft: 8 },
  modalContainer: { flex: 1, backgroundColor: "#05070a" },
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
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  modalSubtitle: { color: "rgba(255,255,255,0.85)", fontSize: 12 },
  liveBadge: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  liveBadgeText: { color: "#fff", fontWeight: "700", fontSize: 11 },
  modalInfoCard: {
    backgroundColor: "#11161d",
    margin: 16,
    marginBottom: 10,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  map: { flex: 1, width, height },
  mapMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  driverMarker: { backgroundColor: "#c12443" },
  dropMarker: { backgroundColor: "#1f8a70" },
  drawerContainer: { flex: 1, backgroundColor: "#111" },
  drawerHeader: { padding: 20, paddingTop: 40 },
  drawerUserInfo: { alignItems: "center" },
  drawerUserName: { fontSize: 20, fontWeight: "700", color: "#fff", marginTop: 8 },
  drawerUserEmail: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4 },
  drawerItem: { flexDirection: "row", alignItems: "center", padding: 15, paddingHorizontal: 20, marginHorizontal: 10, marginVertical: 2, borderRadius: 10 },
  drawerItemActive: { backgroundColor: "#fff" },
  drawerItemText: { fontSize: 16, color: "#fff", marginLeft: 15 },
  drawerItemTextActive: { color: "#c12443" },
  drawerFooter: { padding: 20, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", marginTop: "auto" },
  drawerFooterItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  drawerFooterText: { fontSize: 14, color: "#999", marginLeft: 15 },
});
