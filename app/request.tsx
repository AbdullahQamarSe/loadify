import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import type { DrawerNavigationProp } from "@react-navigation/drawer";
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
  is_scheduled?: boolean;
  bulk_booking_id?: number | null;
  pickup_time?: string | null;
  pickup_location?: string | null;
  drop_location?: string | null;
  weight?: string | number | null;
  load_type?: string | null;
  load_mode?: string | null;
  budget_rate?: string | number | null;
  route_distance_km?: string | number | null;
  route_duration_minutes?: number | null;
  status?: string | null;
  trader_name?: string | null;
  trader_phone?: string | null;
  trader_email?: string | null;
};

type DriverDrawerParamList = {
  Requests: undefined;
};

type RequestTab = "trader" | "sme";

const Drawer = createDrawerNavigator<DriverDrawerParamList>();
const driverDrawerItems: DrawerMenuItem[] = [
  { icon: "time-outline", label: "Driver Dashboard", route: "/driverdashboard" },
  { icon: "chatbubbles-outline", label: "Requests", route: "/requests" },
  { icon: "cube-outline", label: "Current Loads", route: "/current" },
  { icon: "person-outline", label: "Profile", route: "/driverprofile" },
];

const RequestsScreen = () => {
  const navigation = useNavigation<DrawerNavigationProp<DriverDrawerParamList>>();
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [activeTab, setActiveTab] = useState<RequestTab>("trader");
  const [loads, setLoads] = useState<LoadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingLoadId, setActingLoadId] = useState<number | null>(null);

  const loadRequests = useCallback(
    async (targetTab: RequestTab) => {
      try {
        setLoading(true);
        const userDataString = await SecureStore.getItemAsync("userData");
        if (!userDataString) {
          throw new Error("Driver session not found.");
        }
        const parsedUser = JSON.parse(userDataString) as UserData;
        setCurrentUser(parsedUser);
        const driverId = parsedUser.id || parsedUser._id;
        if (!driverId) {
          throw new Error("Driver ID not found.");
        }

        const endpoint =
          targetTab === "trader"
            ? `http://13.233.124.213:8000/api/driver/requests/trader/?driver_id=${encodeURIComponent(String(driverId))}`
            : `http://13.233.124.213:8000/api/driver/requests/sme/?driver_id=${encodeURIComponent(String(driverId))}`;

        const response = await fetch(endpoint);
        const data = (await response.json()) as LoadItem[] | { error?: string };
        if (!response.ok) {
          throw new Error((data as { error?: string }).error || "Failed to load requests.");
        }
        setLoads(Array.isArray(data) ? data : []);
      } catch (error) {
        Alert.alert("Error", error instanceof Error ? error.message : "Failed to load requests.");
        setLoads([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadRequests(activeTab);
  }, [activeTab, loadRequests]);

  useFocusEffect(
    React.useCallback(() => {
      loadRequests(activeTab);
    }, [activeTab, loadRequests])
  );

  const refreshCurrentTab = () => loadRequests(activeTab);

  const handleAccept = async (loadId: number) => {
    const driverId = currentUser?.id || currentUser?._id;
    if (!driverId) {
      Alert.alert("Error", "Driver account not found.");
      return;
    }

    try {
      setActingLoadId(loadId);
      const response = await fetch(`http://13.233.124.213:8000/api/loads/${loadId}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ driver_id: driverId }),
      });
      const data = await response.json();
      if (!response.ok) {
        const backendError = data?.error || "Failed to accept request.";
        const normalizedError =
          typeof backendError === "string" &&
          (
            (backendError.toLowerCase().includes("truck capacity") && backendError.toLowerCase().includes("exceed"))
            || backendError.toLowerCase().includes("available truck capacity")
          )
            ? "Entered load exceeds available truck capacity"
            : backendError;
        throw new Error(normalizedError);
      }
      await refreshCurrentTab();
      Alert.alert("Success", "Request accepted successfully.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to accept request.");
    } finally {
      setActingLoadId(null);
    }
  };

  const handlePrePendingResponse = async (loadId: number, action: "accept" | "reject") => {
    const driverId = currentUser?.id || currentUser?._id;
    if (!driverId) {
      Alert.alert("Error", "Driver account not found.");
      return;
    }

    try {
      setActingLoadId(loadId);
      const response = await fetch(`http://13.233.124.213:8000/api/loads/${loadId}/pre-pending/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ driver_id: driverId, action }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} request.`);
      }
      await refreshCurrentTab();
      Alert.alert("Success", action === "accept" ? "Offer accepted." : "Offer rejected.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : `Failed to ${action} request.`);
    } finally {
      setActingLoadId(null);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#c12443" />
      <LinearGradient colors={["#c12443", "#a01e36"]} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
            <Ionicons name="menu" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Driver Requests</Text>
            <Text style={styles.headerSubtitle}>Trader and SME requests</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="chatbubbles-outline" size={24} color="#fff" />
          </View>
        </View>
      </LinearGradient>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "trader" && styles.tabButtonActive]}
          onPress={() => setActiveTab("trader")}
        >
          <Text style={[styles.tabText, activeTab === "trader" && styles.tabTextActive]}>Trader Requests</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "sme" && styles.tabButtonActive]}
          onPress={() => setActiveTab("sme")}
        >
          <Text style={[styles.tabText, activeTab === "sme" && styles.tabTextActive]}>SME Requests</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#c12443" />
            <Text style={styles.loaderText}>Loading {activeTab} requests...</Text>
          </View>
        ) : loads.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-outline" size={42} color="#c12443" />
            <Text style={styles.emptyTitle}>No {activeTab} requests</Text>
            <Text style={styles.emptySubtitle}>Try again in a moment.</Text>
          </View>
        ) : (
          loads.map((load) => (
            <View key={load.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>Load #{load.id}</Text>
                <View style={styles.cardTopRight}>
                  {load.is_scheduled ? (
                    <View style={[styles.tagBadge, styles.tagScheduled]}>
                      <Text style={styles.tagBadgeText}>Scheduled</Text>
                    </View>
                  ) : null}
                  {load.bulk_booking_id ? (
                    <View style={[styles.tagBadge, styles.tagBulk]}>
                      <Text style={styles.tagBadgeText}>Bulk #{load.bulk_booking_id}</Text>
                    </View>
                  ) : null}
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{load.status || "Pending"}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.info}>
                Route: {load.pickup_location || "N/A"}
                {" -> "}
                {load.drop_location || "N/A"}
              </Text>
              {load.pickup_time ? <Text style={styles.info}>Pickup Time: {load.pickup_time}</Text> : null}
              <Text style={styles.info}>Weight: {load.weight || "0"} kg</Text>
              <Text style={styles.info}>Type: {load.load_type || "N/A"} | Mode: {load.load_mode || "N/A"}</Text>
              <Text style={styles.info}>
                Distance: {load.route_distance_km || "N/A"} km | ETA: {load.route_duration_minutes || "N/A"} min
              </Text>
              <Text style={styles.info}>Budget: {load.budget_rate || "N/A"}</Text>
              <Text style={styles.info}>
                Created by: {load.trader_name || load.trader_phone || load.trader_email || "Unknown"}
              </Text>

              {load.status === "Pre Pending" ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.rejectBtn, actingLoadId === load.id && styles.disabled]}
                    disabled={actingLoadId === load.id}
                    onPress={() => handlePrePendingResponse(load.id, "reject")}
                  >
                    {actingLoadId === load.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.actionText}>Reject</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.acceptBtn, actingLoadId === load.id && styles.disabled]}
                    disabled={actingLoadId === load.id}
                    onPress={() => handlePrePendingResponse(load.id, "accept")}
                  >
                    {actingLoadId === load.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.actionText}>Accept Offer</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.acceptBtn, actingLoadId === load.id && styles.disabled]}
                  disabled={actingLoadId === load.id}
                  onPress={() => handleAccept(load.id)}
                >
                  {actingLoadId === load.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.actionText}>Accept Request</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))
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
      drawerContent={(props) => (
        <AppDrawerContent
          {...props}
          items={driverDrawerItems}
          onLogout={handleLogout}
          defaultUserLabel="Driver"
        />
      )}
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
  container: { flex: 1, backgroundColor: "#000" },
  header: { padding: 15, paddingTop: 40 },
  headerContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerTitleContainer: { alignItems: "center", flex: 1, paddingHorizontal: 8 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerSubtitle: { color: "rgba(255,255,255,0.85)", fontSize: 12 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    backgroundColor: "#000",
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabButtonActive: {
    borderColor: "rgba(193,36,67,0.7)",
    backgroundColor: "rgba(193,36,67,0.2)",
  },
  tabText: { color: "#b3bcc8", fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: "#ffd6df" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  loaderWrap: { paddingVertical: 60, alignItems: "center" },
  loaderText: { color: "#999", marginTop: 10 },
  emptyCard: {
    backgroundColor: "#111",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 10 },
  emptySubtitle: { color: "#999", marginTop: 6 },
  card: {
    backgroundColor: "#11161d",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    marginBottom: 12,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardTopRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  tagBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagScheduled: {
    backgroundColor: "rgba(43, 138, 255, 0.22)",
    borderColor: "rgba(43, 138, 255, 0.55)",
  },
  tagBulk: {
    backgroundColor: "rgba(255, 170, 0, 0.22)",
    borderColor: "rgba(255, 170, 0, 0.55)",
  },
  tagBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  badge: {
    backgroundColor: "rgba(193,36,67,0.2)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(193,36,67,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: "#ffd9e1", fontSize: 11, fontWeight: "700" },
  info: { color: "#d0d8e5", fontSize: 12, marginBottom: 3 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  acceptBtn: {
    marginTop: 10,
    backgroundColor: "#c12443",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  rejectBtn: {
    marginTop: 10,
    backgroundColor: "#6b7077",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  actionText: { color: "#fff", fontWeight: "700" },
  disabled: { opacity: 0.7 },
});
