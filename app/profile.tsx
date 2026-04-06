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
  id?: string | number;
  _id?: string | number;
  name?: string;
  fullName?: string;
  username?: string;
  email?: string;
  phone?: string;
  phone_number?: string;
  role?: string;
  city?: string;
  goods_type?: string;
  business_name?: string;
  business_type?: string;
  owner_name?: string;
  business_email?: string;
  business_address?: string;
  truckType?: string | null;
  truckReg?: string | null;
  capacity?: string | null;
  available_capacity?: string | null;
};

type ProfileDrawerParamList = {
  Profile: undefined;
};

type DrawerContentProps = DrawerContentComponentProps & {
  onLogout?: () => void;
};

const Drawer = createDrawerNavigator<ProfileDrawerParamList>();

async function readJsonOrText(response: Response) {
  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return { error: raw || `Request failed (${response.status})` };
  }
}

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

      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateToPage("/myloads")}>
        <Ionicons name="cube-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>My Loads</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateToPage("/partialtruck")}>
        <Ionicons name="car-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>Partial Trucks</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.drawerItem} onPress={() => navigateToPage("/findtruck")}>
        <Ionicons name="locate-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>Find Truck</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.drawerItem, styles.drawerItemActive]} onPress={() => navigateToPage("/profile")}>
        <Ionicons name="person-outline" size={24} color="#c12443" />
        <Text style={[styles.drawerItemText, styles.drawerItemTextActive]}>Profile</Text>
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

const ProfileScreen = () => {
  const navigation = useNavigation<DrawerNavigationProp<ProfileDrawerParamList>>();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [editedData, setEditedData] = useState<UserData>({});
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const stored = await SecureStore.getItemAsync("userData");
      if (!stored) {
        throw new Error("User data not found");
      }

      const sessionUser = JSON.parse(stored) as UserData;
      if (!sessionUser.email) {
        throw new Error("User email not found");
      }

      const response = await fetch(`${API_BASE_URL}/user/profile?email=${encodeURIComponent(sessionUser.email)}`);
      const data = await readJsonOrText(response);
      if (!response.ok) {
        throw new Error(data.error || "Failed to load profile");
      }

      await SecureStore.setItemAsync("userData", JSON.stringify(data));
      setUserData(data);
      setEditedData({
        ...data,
        phone: data.phone || data.phone_number || "",
      });
    } catch (error) {
      console.error("Error loading trader profile:", error);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to load profile.");
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

  const updateField = (key: keyof UserData, value: string) => {
    setEditedData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!userData) return;

    try {
      setIsSaving(true);
      const response = await fetch(`${API_BASE_URL}/user/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          userId: userData.id || userData._id,
          name: editedData.name || editedData.fullName || "",
          email: editedData.email || "",
          phone: editedData.phone || "",
          city: editedData.city || "",
          goodsType: editedData.goods_type || "",
          businessName: editedData.business_name || "",
          businessType: editedData.business_type || "",
          ownerName: editedData.owner_name || "",
          businessEmail: editedData.business_email || "",
          address: editedData.business_address || "",
        }),
      });

      const data = await readJsonOrText(response);
      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to update profile");
      }

      await SecureStore.setItemAsync("userData", JSON.stringify(data));
      setUserData(data);
      setEditedData({
        ...data,
        phone: data.phone || data.phone_number || "",
      });
      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully.");
    } catch (error) {
      console.error("Error saving trader profile:", error);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    value: string | undefined | null,
    fieldKey: keyof UserData,
    keyboardType: "default" | "email-address" = "default"
  ) => (
    <View style={styles.infoCard}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={22} color="#c12443" />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        {isEditing ? (
          <TextInput
            style={styles.infoInput}
            value={String(editedData[fieldKey] ?? "")}
            onChangeText={(text) => updateField(fieldKey, text)}
            keyboardType={keyboardType}
            placeholderTextColor="#666"
          />
        ) : (
          <Text style={styles.infoValue}>{value || "Not set"}</Text>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#c12443" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#c12443" />
      <LinearGradient colors={["#c12443", "#a01e36"]} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
            <Ionicons name="menu" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>My Profile</Text>
            <Text style={styles.headerSubtitle}>Loaded from backend by email</Text>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing((prev) => !prev)}>
            <Ionicons name={isEditing ? "close-outline" : "create-outline"} size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.formContainer} contentContainerStyle={styles.formContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Details</Text>
          {renderField("person-outline", "Full Name", userData?.name || userData?.fullName, "name")}
          {renderField("mail-outline", "Email", userData?.email, "email", "email-address")}
          {renderField("call-outline", "Phone Number", userData?.phone || userData?.phone_number, "phone")}
          {renderField("location-outline", "City", userData?.city, "city")}
          {renderField("cube-outline", "Goods Type", userData?.goods_type, "goods_type")}
          {renderField("business-outline", "Business Name", userData?.business_name, "business_name")}
          {renderField("briefcase-outline", "Business Type", userData?.business_type, "business_type")}
          {renderField("person-circle-outline", "Owner Name", userData?.owner_name, "owner_name")}
          {renderField("mail-open-outline", "Business Email", userData?.business_email, "business_email", "email-address")}
          {renderField("home-outline", "Business Address", userData?.business_address, "business_address")}
        </View>

        {userData?.truckType && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Truck Details</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons name="car-outline" size={22} color="#c12443" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Truck Type</Text>
                <Text style={styles.infoValue}>{userData.truckType}</Text>
              </View>
            </View>
          </View>
        )}

        {isEditing && (
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.buttonDisabled]}
            disabled={isSaving}
            onPress={handleSave}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Profile</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

export default function TraderProfilePage() {
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
        drawerStyle: { backgroundColor: "#111", width: 300 },
        overlayColor: "rgba(0,0,0,0.5)",
      }}
    >
      <Drawer.Screen name="Profile" component={ProfileScreen} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#05070a" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#05070a" },
  loadingText: { marginTop: 10, color: "#9aa4af" },
  header: { padding: 15, paddingTop: 40 },
  headerContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  menuButton: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  headerTitleContainer: { alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  headerSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.82)" },
  editButton: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  formContainer: { flex: 1 },
  formContent: { padding: 20, paddingBottom: 34 },
  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 12 },
  infoCard: { flexDirection: "row", backgroundColor: "#11161d", borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  infoIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(193,36,67,0.12)" },
  infoContent: { flex: 1, marginLeft: 14 },
  infoLabel: { color: "#8f98a3", fontSize: 12, marginBottom: 6, textTransform: "uppercase" },
  infoValue: { color: "#fff", fontSize: 16, fontWeight: "600" },
  infoInput: { color: "#fff", fontSize: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.2)", paddingBottom: 6 },
  saveButton: { marginTop: 8, height: 54, borderRadius: 16, backgroundColor: "#c12443", flexDirection: "row", alignItems: "center", justifyContent: "center" },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "700", marginLeft: 10 },
  buttonDisabled: { opacity: 0.7 },
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
