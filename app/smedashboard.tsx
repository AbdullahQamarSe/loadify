import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
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
import * as SecureStore from "expo-secure-store";

import { useSMEDrawerNavigation, withSMEDrawer } from "@/components/sme-drawer";
import { API_BASE_URL } from "@/lib/api";

type UserData = {
  id?: string | number;
  _id?: string | number;
  name?: string;
  fullName?: string;
  username?: string;
};

type DashboardSummary = {
  total_bookings: number;
  active_shipments: number;
  completed_shipments: number;
};

type ShipmentDriver = {
  id?: number;
  name?: string;
  phone?: string;
  email?: string;
} | null;

type ShipmentItem = {
  id: number;
  pickup_location?: string | null;
  drop_location?: string | null;
  weight?: string | number | null;
  load_type?: string | null;
  load_mode?: string | null;
  status?: string | null;
  route_distance_km?: string | number | null;
  route_duration_minutes?: number | null;
  driver?: ShipmentDriver;
};

type ActionItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
};

const actions: ActionItem[] = [
  { label: "Repeat Orders", icon: "repeat-outline", route: "/sme-repeat-orders" },
  { label: "Scheduled Pickups", icon: "calendar-outline", route: "/sme-schedule" },
  { label: "Bulk Booking", icon: "layers-outline", route: "/sme-bulk-booking" },
  { label: "Invoices", icon: "receipt-outline", route: "/sme-invoices" },
  { label: "Track Shipments", icon: "location-outline", route: "/sme-track-shipments" },
];

const fallbackSummary: DashboardSummary = {
  total_bookings: 0,
  active_shipments: 0,
  completed_shipments: 0,
};

function SMEDashboardScreen() {
  const router = useRouter();
  const navigation = useSMEDrawerNavigation();
  const [summary, setSummary] = useState<DashboardSummary>(fallbackSummary);
  const [shipments, setShipments] = useState<ShipmentItem[]>([]);
  const [userName, setUserName] = useState("SME");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getSmeId = async () => {
    const userDataString = await SecureStore.getItemAsync("userData");
    if (!userDataString) {
      throw new Error("Session expired. Please login again.");
    }
    const userData = JSON.parse(userDataString) as UserData;
    const id = userData.id ?? userData._id;
    if (!id) {
      throw new Error("SME ID not found.");
    }
    const displayName = userData.name || userData.fullName || userData.username || "SME";
    setUserName(displayName);
    return id;
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      setErrorMessage(null);
      const smeId = await getSmeId();

      const [summaryResponse, shipmentsResponse] = await Promise.all([
        fetch(`http://13.233.124.213:8000/api/sme/dashboard/?sme_id=${smeId}`),
        fetch(`http://13.233.124.213:8000/api/sme/shipments/?sme_id=${smeId}`),
      ]);

      const summaryData = (await summaryResponse.json()) as DashboardSummary | { error?: string };
      const shipmentsData = (await shipmentsResponse.json()) as ShipmentItem[] | { error?: string };

      if (!summaryResponse.ok) {
        throw new Error((summaryData as { error?: string }).error || "Failed to load SME summary.");
      }
      if (!shipmentsResponse.ok) {
        throw new Error((shipmentsData as { error?: string }).error || "Failed to load SME shipments.");
      }

      setSummary(summaryData as DashboardSummary);
      setShipments(Array.isArray(shipmentsData) ? shipmentsData : []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const renderShipmentCard = ({ item }: { item: ShipmentItem }) => (
    <View style={styles.shipmentCard}>
      <View style={styles.shipmentHeader}>
        <Text style={styles.shipmentId}>Load #{item.id}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{item.status || "Pending"}</Text>
        </View>
      </View>
      <Text style={styles.shipmentRoute}>
        {item.pickup_location || "N/A"}
        {" -> "}
        {item.drop_location || "N/A"}
      </Text>
      <View style={styles.shipmentMetaRow}>
        <Text style={styles.shipmentMeta}>Weight: {item.weight || "0"} kg</Text>
        <Text style={styles.shipmentMeta}>Mode: {item.load_mode || "N/A"}</Text>
      </View>
      <Text style={styles.shipmentMeta}>
        Distance: {item.route_distance_km || "N/A"} km | ETA: {item.route_duration_minutes || "N/A"} min
      </Text>
      <Text style={styles.shipmentDriver}>
        Driver: {item.driver?.name || "Not assigned yet"}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#c12443" />
        <Text style={styles.loaderText}>Loading SME dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#c12443" />
      <LinearGradient colors={["#c12443", "#a01e36"]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
            <Ionicons name="menu" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SME Dashboard</Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={styles.headerSubtitle}>Welcome, {userName}</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c12443" />}
      >
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Ionicons name="layers-outline" size={22} color="#c12443" />
            <Text style={styles.summaryValue}>{summary.total_bookings}</Text>
            <Text style={styles.summaryLabel}>Total Bookings</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="time-outline" size={22} color="#c12443" />
            <Text style={styles.summaryValue}>{summary.active_shipments}</Text>
            <Text style={styles.summaryLabel}>Active Shipments</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="checkmark-done-outline" size={22} color="#c12443" />
            <Text style={styles.summaryValue}>{summary.completed_shipments}</Text>
            <Text style={styles.summaryLabel}>Completed</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsWrap}>
          {actions.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={styles.actionButton}
              onPress={() => router.push(item.route as never)}
            >
              <Ionicons name={item.icon} size={20} color="#fff" />
              <Text style={styles.actionText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.shipmentsBlock}>
          <Text style={styles.sectionTitle}>Recent Shipments</Text>
          <FlatList
            data={shipments}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderShipmentCard}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={styles.emptyText}>No shipments found yet.</Text>}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0f12" },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0d0f12" },
  loaderText: { marginTop: 10, color: "#aaa" },
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 20 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerSpacer: { width: 36, height: 36 },
  headerTitle: { fontSize: 24, color: "#fff", fontWeight: "800" },
  headerSubtitle: { marginTop: 4, color: "rgba(255,255,255,0.85)", fontSize: 13 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  errorText: {
    color: "#ff9f9f",
    backgroundColor: "rgba(255,77,77,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.35)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  summaryCard: {
    flex: 1,
    backgroundColor: "#151922",
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  summaryValue: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 6 },
  summaryLabel: { color: "#aab2c0", fontSize: 11, marginTop: 2, textAlign: "center" },
  sectionTitle: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 18, marginBottom: 10 },
  actionsWrap: { gap: 10 },
  actionButton: {
    backgroundColor: "#c12443",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  actionText: { color: "#fff", fontWeight: "700", marginLeft: 10, fontSize: 14 },
  shipmentsBlock: { marginTop: 10 },
  shipmentCard: {
    backgroundColor: "#151922",
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  shipmentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  shipmentId: { color: "#fff", fontWeight: "700", fontSize: 14 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(193,36,67,0.2)",
    borderWidth: 1,
    borderColor: "rgba(193,36,67,0.5)",
  },
  statusText: { color: "#ffd9df", fontSize: 11, fontWeight: "700" },
  shipmentRoute: { color: "#d8deea", fontSize: 13, marginBottom: 6 },
  shipmentMetaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  shipmentMeta: { color: "#aab2c0", fontSize: 12 },
  shipmentDriver: { color: "#cfd6e2", fontSize: 12 },
  emptyText: { color: "#9aa3b0", paddingVertical: 14, textAlign: "center" },
});

export default withSMEDrawer(SMEDashboardScreen, "SME Dashboard");
