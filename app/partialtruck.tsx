import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { DrawerContentComponentProps, DrawerNavigationProp } from "@react-navigation/drawer";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";

import { API_BASE_URL } from "@/lib/api";

type UserData = {
  name?: string;
  fullName?: string;
  username?: string;
  email?: string;
  phone?: string;
};

type TruckItem = {
  id: number;
  truck_type?: string | null;
  registration_no?: string | null;
  available_capacity?: string | number | null;
  driver_id?: number | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_city?: string | null;
};

type TraderDrawerParamList = {
  PartialTruck: undefined;
};

type DrawerContentProps = DrawerContentComponentProps & {
  onLogout?: () => void;
};

const Drawer = createDrawerNavigator<TraderDrawerParamList>();

const TraderDrawerContent = (props: DrawerContentProps) => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const router = useRouter();

  const loadUserData = async () => {
    const stored = await SecureStore.getItemAsync("userData");
    if (!stored) return;
    setUserData(JSON.parse(stored) as UserData);
  };

  useEffect(() => {
    loadUserData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
    }, [])
  );

  const navigate = (path: string) => {
    props.navigation.closeDrawer();
    router.push(path as never);
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync("userData");
    await SecureStore.deleteItemAsync("userToken");
    props.navigation.closeDrawer();
    props.onLogout?.();
  };

  return (
    <View style={styles.drawerContainer}>
      <LinearGradient colors={["#c12443", "#a01e36"]} style={styles.drawerHeader}>
        <Ionicons name="person-circle" size={60} color="#fff" />
        <Text style={styles.drawerUserName}>
          {userData?.name || userData?.fullName || userData?.username || "Trader"}
        </Text>
        <Text style={styles.drawerUserEmail}>{userData?.email || userData?.phone || ""}</Text>
      </LinearGradient>

      <TouchableOpacity style={styles.drawerItem} onPress={() => navigate("/traderdashboard")}>
        <Ionicons name="add-circle-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>Create Load</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.drawerItem} onPress={() => navigate("/myloads")}>
        <Ionicons name="cube-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>My Loads</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.drawerItem, styles.drawerItemActive]} onPress={() => navigate("/partialtruck")}>
        <Ionicons name="car-outline" size={24} color="#c12443" />
        <Text style={[styles.drawerItemText, styles.drawerItemTextActive]}>Partial Trucks</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.drawerItem} onPress={() => navigate("/findtruck")}>
        <Ionicons name="locate-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>Find Truck</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.drawerItem} onPress={() => navigate("/profile")}>
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

const PartialTruckScreen = () => {
  const navigation = useNavigation<DrawerNavigationProp<TraderDrawerParamList>>();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [trucks, setTrucks] = useState<TruckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const readJsonOrText = async (response: Response) => {
    const raw = await response.text();
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const loadTrucks = async (nextSearch = "") => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const params = new URLSearchParams();
      params.append("posted_only", "1");
      if (nextSearch) {
        params.append("search", nextSearch);
      }
      const query = `?${params.toString()}`;
      const response = await fetch(`${API_BASE_URL}/trucks${query}`);
      const data = await readJsonOrText(response);
      if (!response.ok) {
        throw new Error(data.error || "Failed to load partial trucks");
      }
      setTrucks(Array.isArray(data) ? data : []);
    } catch (error) {
      setTrucks([]);
      setErrorMessage(error instanceof Error ? error.message : "Failed to load partial trucks");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadTrucks(search);
    }, [search])
  );

  const handleBookPartial = async (truck: TruckItem) => {
    try {
      await SecureStore.setItemAsync(
        "selectedDriverOffer",
        JSON.stringify({
          driverId: truck.driver_id,
          driverName: truck.driver_name,
          truckType: truck.truck_type,
          registrationNo: truck.registration_no,
          forcePartial: true,
        })
      );
      router.push("/traderdashboard");
    } catch (_error) {
      Alert.alert("Error", "Failed to start partial booking flow.");
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
            <Text style={styles.headerTitle}>Partial Trucks</Text>
            <Text style={styles.headerSubtitle}>Book left available truck capacity</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="layers-outline" size={24} color="#fff" />
          </View>
        </View>
      </LinearGradient>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#9aa4af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by driver, truck type, reg, city"
          placeholderTextColor="#9aa4af"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => loadTrucks(search)}
        />
        <TouchableOpacity onPress={() => loadTrucks(search)}>
          <Ionicons name="arrow-forward-circle-outline" size={24} color="#c12443" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#c12443" />
            <Text style={styles.loadingText}>Loading partial trucks...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cloud-offline-outline" size={42} color="#c12443" />
            <Text style={styles.emptyTitle}>Connection problem</Text>
            <Text style={styles.emptySubtitle}>{errorMessage}</Text>
          </View>
        ) : trucks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="car-outline" size={42} color="#c12443" />
            <Text style={styles.emptyTitle}>No partial trucks found</Text>
            <Text style={styles.emptySubtitle}>Try another search term.</Text>
          </View>
        ) : (
          trucks.map((truck) => (
            <View key={truck.id} style={styles.truckCard}>
              <View style={styles.cardTopRow}>
                <Text style={styles.driverName}>{truck.driver_name || "Driver"}</Text>
                <Text style={styles.capacityText}>{truck.available_capacity || "0"} kg left</Text>
              </View>
              <Text style={styles.infoText}>{truck.truck_type || "Unknown truck"} • {truck.registration_no || "No reg"}</Text>
              <Text style={styles.infoText}>{truck.driver_city || "Unknown city"} • {truck.driver_phone || "No phone"}</Text>

              <TouchableOpacity style={styles.offerButton} onPress={() => handleBookPartial(truck)}>
                <Ionicons name="send-outline" size={18} color="#fff" />
                <Text style={styles.offerButtonText}>Book Partial</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default function PartialTruckPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync("userData");
    await SecureStore.deleteItemAsync("userToken");
    router.replace("/login");
  };

  return (
    <Drawer.Navigator
      drawerContent={(props) => <TraderDrawerContent {...props} onLogout={handleLogout} />}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        drawerStyle: { backgroundColor: "#111", width: 300 },
        overlayColor: "rgba(0,0,0,0.5)",
      }}
    >
      <Drawer.Screen name="PartialTruck" component={PartialTruckScreen} />
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
  headerIcon: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  searchWrap: { flexDirection: "row", alignItems: "center", margin: 18, marginBottom: 8, paddingHorizontal: 14, height: 52, backgroundColor: "#11161d", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  searchInput: { flex: 1, color: "#fff", marginHorizontal: 10 },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 34 },
  loadingContainer: { paddingVertical: 80, alignItems: "center" },
  loadingText: { marginTop: 10, color: "#9aa4af" },
  emptyCard: { backgroundColor: "#11161d", borderRadius: 22, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "rgba(193,36,67,0.22)" },
  emptyTitle: { color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 10 },
  emptySubtitle: { color: "#9aa4af", fontSize: 14, textAlign: "center", marginTop: 6 },
  truckCard: { backgroundColor: "#11161d", borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  driverName: { color: "#fff", fontSize: 18, fontWeight: "700" },
  capacityText: { color: "#c12443", fontSize: 13, fontWeight: "700" },
  infoText: { color: "#c7cfd8", fontSize: 13, marginBottom: 6 },
  offerButton: { marginTop: 10, height: 46, borderRadius: 14, backgroundColor: "#c12443", flexDirection: "row", alignItems: "center", justifyContent: "center" },
  offerButtonText: { color: "#fff", fontSize: 15, fontWeight: "700", marginLeft: 8 },
  drawerContainer: { flex: 1, backgroundColor: "#111" },
  drawerHeader: { padding: 20, paddingTop: 40, alignItems: "center" },
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
