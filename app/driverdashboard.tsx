import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  TextInput,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { DrawerContentComponentProps, DrawerNavigationProp } from '@react-navigation/drawer';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';

import { API_BASE_URL } from '@/lib/api';

type UserData = {
  id?: string | number;
  _id?: string | number;
  name?: string;
  fullName?: string;
  username?: string;
  email?: string;
  phone?: string;
  role?: string;
  truckType?: string | null;
  truckReg?: string | null;
  capacity?: string | null;
  available_capacity?: string | null;
};

type DriverDrawerParamList = {
  "Driver Home": undefined;
};

type DrawerContentProps = DrawerContentComponentProps & {
  onLogout?: () => void;
};

const { width } = Dimensions.get('window');

// Create Drawer Navigator
const Drawer = createDrawerNavigator<DriverDrawerParamList>();

const readJsonOrText = async (response: Response) => {
  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return { error: raw || `Request failed (${response.status})` };
  }
};

// Custom Drawer Content with User Data
const CustomDrawerContent = (props: DrawerContentProps) => {
  const { onLogout } = props;
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load user data when drawer opens or screen focuses
  const loadUserData = async () => {
    try {
      const userDataString = await SecureStore.getItemAsync('userData');
      if (userDataString) {
        const user = JSON.parse(userDataString) as UserData;
        setUserData(user);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load data when component mounts
  useEffect(() => {
    loadUserData();
  }, []);

  // Reload data when drawer is opened
  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
    }, [])
  );

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await SecureStore.deleteItemAsync('userData');
              await SecureStore.deleteItemAsync('userToken');
              
              // Close drawer first
              props.navigation.closeDrawer();
              
              // Call the logout function from parent
              if (onLogout) {
                onLogout();
              }
            } catch (error) {
              console.error('Error during logout:', error);
              Alert.alert("Error", "Failed to logout. Please try again.");
            }
          }
        }
      ]
    );
  };

  const navigateToPage = (pageName: string) => {
    props.navigation.closeDrawer();
    router.push(pageName as never);
  };

  return (
    <View style={styles.drawerContainer}>
      {/* Drawer Header with Gradient */}
      <LinearGradient
        colors={['#c12443', '#a01e36']}
        style={styles.drawerHeader}
      >
        {loading ? (
          <View style={styles.drawerUserInfo}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={[styles.drawerUserName, { marginTop: 10 }]}>Loading...</Text>
          </View>
        ) : userData ? (
          <View style={styles.drawerUserInfo}>
            <View style={styles.drawerUserIcon}>
              <Ionicons name="person-circle" size={60} color="#fff" />
            </View>
            <Text style={styles.drawerUserName}>
              {userData.name || userData.fullName || userData.username || 'Driver'}
            </Text>
            <Text style={styles.drawerUserEmail}>
              {userData.email || userData.phone || 'No email provided'}
            </Text>
          </View>
        ) : (
          <View style={styles.drawerUserInfo}>
            <Ionicons name="person-circle-outline" size={60} color="#fff" />
            <Text style={styles.drawerUserName}>Guest User</Text>
            <Text style={styles.drawerUserEmail}>Please login</Text>
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={() => navigateToPage('/login')}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>

      {/* Drawer Items - Driver Options */}
      <TouchableOpacity 
        style={styles.drawerItem}
        onPress={() => navigateToPage('/driverdashboard')}
      >
        <Ionicons name="time-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>Driver Dashboard</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.drawerItem}
        onPress={() => navigateToPage('/requests')}
      >
        <Ionicons name="chatbubbles-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>Requests</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.drawerItem}
        onPress={() => navigateToPage('/current')}
      >
        <Ionicons name="cube-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>Current Loads</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.drawerItem}
        onPress={() => navigateToPage('/driverprofile')}
      >
        <Ionicons name="person-outline" size={24} color="#fff" />
        <Text style={styles.drawerItemText}>Profile</Text>
      </TouchableOpacity>

      {/* Drawer Footer */}
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
              ID: {userData.id || userData._id || 'N/A'}
            </Text>
          </View>
        )}
        <Text style={styles.drawerVersion}>Version 1.0.0</Text>
      </View>
    </View>
  );
};

// Driver Home Screen Component
const DriverHomeScreen = () => {
  const navigation = useNavigation<DrawerNavigationProp<DriverDrawerParamList>>();
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [leftWeight, setLeftWeight] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    const syncPickedLoadsLocation = async () => {
      try {
        const stored = await SecureStore.getItemAsync('userData');
        if (!stored || !isMounted) return;

        const user = JSON.parse(stored) as UserData & { role?: string };
        const driverId = user.id || user._id;
        if (!driverId || user.role !== 'driver') return;

        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') return;

        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        await fetch(`${API_BASE_URL}/driver/location-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            driver_id: driverId,
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude,
          }),
        });
      } catch {
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

  // Load current user data
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const stored = await SecureStore.getItemAsync("userData");
      if (!stored) throw new Error("Driver session not found");

      const sessionUser = JSON.parse(stored) as UserData;
      if (!sessionUser.email) throw new Error("Driver email not found");

      const response = await fetch(`${API_BASE_URL}/user/profile?email=${encodeURIComponent(sessionUser.email)}`);
      const data = await readJsonOrText(response);
      if (!response.ok) throw new Error(data.error || "Failed to load profile");

      await SecureStore.setItemAsync("userData", JSON.stringify(data));
      setCurrentUser(data);
      setLeftWeight(String(data.available_capacity ?? ""));
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  const submitAvailability = async () => {
    const driverId = currentUser?.id || currentUser?._id;
    if (!driverId) {
      Alert.alert("Error", "Driver account not found.");
      return;
    }

    const numericValue = Number(leftWeight);
    if (Number.isNaN(numericValue) || numericValue < 0) {
      Alert.alert("Invalid value", "Please enter a valid left available weight.");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/driver/post-availability`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          driver_id: driverId,
          available_capacity: leftWeight,
        }),
      });

      const data = await readJsonOrText(response);
      if (!response.ok) {
        throw new Error(data.error || "Failed to update availability.");
      }

      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              available_capacity: String(data.truck?.available_capacity ?? leftWeight),
            }
          : prev
      );
      setLeftWeight(String(data.truck?.available_capacity ?? leftWeight));
      Alert.alert("Success", "Left available weight updated.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to update availability.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#c12443" />
      
      {/* Header with Menu Button */}
      <LinearGradient
        colors={['#c12443', '#a01e36']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
            <Ionicons name="menu" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Driver Dashboard</Text>
            <Text style={styles.headerSubtitle}>Welcome, {currentUser?.name || 'Driver'}!</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="car-outline" size={28} color="#fff" />
          </View>
        </View>
      </LinearGradient>

      {/* Main Content */}
      <ScrollView 
        style={styles.formContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.formContent}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#c12443" />
            <Text style={styles.loadingText}>Loading dashboard...</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Truck Overview</Text>
            <Text style={styles.cardRow}>Truck: {currentUser?.truckType || "N/A"}</Text>
            <Text style={styles.cardRow}>Registration: {currentUser?.truckReg || "N/A"}</Text>
            <Text style={styles.cardRow}>Total Capacity: {currentUser?.capacity || "0"} kg</Text>
            <Text style={styles.cardRow}>Current Left Weight: {currentUser?.available_capacity || "0"} kg</Text>

            <Text style={styles.label}>Post Left Available Weight (kg)</Text>
            <TextInput
              value={leftWeight}
              onChangeText={(value) => setLeftWeight(value.replace(/[^0-9.]/g, ""))}
              placeholder="Enter left available weight"
              placeholderTextColor="#8f98a3"
              keyboardType="numeric"
              style={styles.input}
            />

            <TouchableOpacity style={[styles.submitButton, saving && styles.disabledButton]} onPress={submitAvailability} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.submitText}>Post Availability</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// Main Driver Dashboard with Drawer
export default function DriverDashboard() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await SecureStore.deleteItemAsync('userData');
      await SecureStore.deleteItemAsync('userToken');
      
      // Navigate to login screen using Expo Router
      router.replace('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      Alert.alert("Error", "Failed to logout. Please try again.");
    }
  };

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} onLogout={handleLogout} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: {
          backgroundColor: '#111',
          width: 300,
        },
        overlayColor: 'rgba(0,0,0,0.5)',
        swipeEnabled: true,
      }}
    >
      <Drawer.Screen name="Driver Home" component={DriverHomeScreen} />
    </Drawer.Navigator>
  );
}

// Styles (keep most styles, add new ones)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 15,
    paddingTop: Platform.OS === 'android' ? 40 : 15,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 10,
    color: '#999',
    fontSize: 14,
  },
  card: {
    backgroundColor: "#11161d",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  cardRow: {
    color: "#d8dee6",
    fontSize: 14,
    marginBottom: 6,
  },
  label: {
    color: "#fff",
    fontSize: 14,
    marginTop: 12,
    marginBottom: 8,
    fontWeight: "600",
  },
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "#0d1117",
    color: "#fff",
    paddingHorizontal: 14,
  },
  submitButton: {
    marginTop: 16,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#c12443",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.7,
  },
  welcomeCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(193,36,67,0.3)',
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  quickActionCard: {
    width: (width - 60) / 2,
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 10,
    marginBottom: 4,
  },
  quickActionDesc: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#c12443',
    marginVertical: 5,
  },
  statusLabel: {
    fontSize: 12,
    color: '#999',
  },
  statusDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  drawerContainer: {
    flex: 1,
    backgroundColor: '#111',
  },
  drawerHeader: {
    padding: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  drawerUserInfo: {
    alignItems: 'center',
  },
  drawerUserIcon: {
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  drawerUserName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  drawerUserEmail: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 15,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingHorizontal: 20,
    marginHorizontal: 10,
    marginVertical: 2,
    borderRadius: 10,
  },
  drawerItemText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 15,
  },
  drawerFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginTop: 'auto',
  },
  drawerFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  drawerFooterText: {
    fontSize: 14,
    color: '#999',
    marginLeft: 15,
  },
  drawerVersion: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  loginButton: {
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  userInfoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  userIdText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 8,
  },
});
