import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';

type UserData = {
  id?: string | number;
  _id?: string | number;
  name?: string;
  fullName?: string;
  username?: string;
  email?: string;
  phone?: string;
};

export type DrawerMenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
};

type AppDrawerContentProps = DrawerContentComponentProps & {
  items: DrawerMenuItem[];
  onLogout?: () => void;
  defaultUserLabel?: string;
};

export function AppDrawerContent(props: AppDrawerContentProps) {
  const { items, onLogout, defaultUserLabel = 'User' } = props;
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadUserData = async () => {
    try {
      const userDataString = await SecureStore.getItemAsync('userData');
      if (userDataString) {
        const user = JSON.parse(userDataString) as UserData;
        setUserData(user);
      } else {
        setUserData(null);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
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
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await SecureStore.deleteItemAsync('userData');
            await SecureStore.deleteItemAsync('userToken');
            props.navigation.closeDrawer();
            if (onLogout) {
              onLogout();
            }
          } catch (error) {
            console.error('Error during logout:', error);
            Alert.alert('Error', 'Failed to logout. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.drawerContainer}>
      <LinearGradient colors={['#c12443', '#a01e36']} style={styles.drawerHeader}>
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
              {userData.name || userData.fullName || userData.username || defaultUserLabel}
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
            <TouchableOpacity style={styles.loginButton} onPress={() => navigateToPage('/login')}>
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>

      {items.map((item) => (
        <TouchableOpacity
          key={`${item.route}-${item.label}`}
          style={styles.drawerItem}
          onPress={() => navigateToPage(item.route)}
        >
          <Ionicons name={item.icon} size={24} color="#fff" />
          <Text style={styles.drawerItemText}>{item.label}</Text>
        </TouchableOpacity>
      ))}

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
            <Text style={styles.userIdText}>ID: {userData.id || userData._id || 'N/A'}</Text>
          </View>
        )}
        <Text style={styles.drawerVersion}>Version 1.0.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    shadowColor: '#000',
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
