import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Modal,
  Dimensions,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type MapPressEvent, type Region } from "react-native-maps";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';

import { AppDrawerContent, type DrawerMenuItem } from '@/components/app-drawer-content';
import { API_BASE_URL } from '@/lib/api';

type UserData = {
  id?: string | number;
  _id?: string | number;
  name?: string;
  fullName?: string;
  username?: string;
  email?: string;
  phone?: string;
};

type SelectedDriverOffer = {
  driverId?: string | number;
  driverName?: string;
  truckType?: string;
  registrationNo?: string;
  pickupCity?: string;
  dropCity?: string;
  remainingCapacity?: string | number;
  forcePartial?: boolean;
};

type LocationPoint = {
  latitude: number;
  longitude: number;
};

type SelectingFor = 'pickup' | 'drop' | null;
type LoadType = 'Normal' | 'Fragile';
type LoadMode = 'Full Load' | 'Partial';

type TraderDrawerParamList = {
  "Create Load": undefined;
};

const { width } = Dimensions.get('window');

// Constants for rate calculation
const RATE_PER_KM = 70; // Rs per km
const RATE_PER_TON = 500; // Rs per ton

// Create Drawer Navigator
const Drawer = createDrawerNavigator<TraderDrawerParamList>();

const traderDrawerItems: DrawerMenuItem[] = [
  { icon: 'add-circle-outline', label: 'Create Load', route: '/traderdashboard' },
  { icon: 'cube-outline', label: 'My Loads', route: '/myloads' },
  { icon: 'car-outline', label: 'Partial Trucks', route: '/partialtruck' },
  { icon: 'locate-outline', label: 'Find Truck', route: '/findtruck' },
  { icon: 'person-outline', label: 'Profile', route: '/profile' },
];

// Create Load Screen Component
const CreateLoadScreen = () => {
  const navigation = useNavigation<DrawerNavigationProp<TraderDrawerParamList>>();
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [selectedDriverOffer, setSelectedDriverOffer] = useState<SelectedDriverOffer | null>(null);
  
  const [pickup, setPickup] = useState<LocationPoint | null>(null);
  const [drop, setDrop] = useState<LocationPoint | null>(null);
  const [selectingFor, setSelectingFor] = useState<SelectingFor>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [routeDistance, setRouteDistance] = useState<string | null>(null);
  const [routeDistanceValue, setRouteDistanceValue] = useState<number | null>(null); // Store numeric distance
  const [routeDuration, setRouteDuration] = useState<string | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<LocationPoint[]>([]);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [weight, setWeight] = useState('');
  const [weightValue, setWeightValue] = useState<number>(0); // Store numeric weight
  const [budget, setBudget] = useState('');
  const [calculatedBudget, setCalculatedBudget] = useState<number>(0);
  const [loadType, setLoadType] = useState<LoadType>('Normal');
  const [loadMode, setLoadMode] = useState<LoadMode>('Full Load');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [showScheduleDatePicker, setShowScheduleDatePicker] = useState(false);
  const [showScheduleTimePicker, setShowScheduleTimePicker] = useState(false);

  const mapRef = useRef<MapView | null>(null);
  const miniMapRef = useRef<MapView | null>(null);

  const [region] = useState<Region>({
    latitude: 31.5204,
    longitude: 74.3587,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });

  // Load current user data
  useEffect(() => {
    loadCurrentUser();
    loadSelectedDriverOffer();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const userDataString = await SecureStore.getItemAsync('userData');
      if (userDataString) {
        const user = JSON.parse(userDataString) as UserData;
        setCurrentUser(user);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadSelectedDriverOffer = async () => {
    try {
      const offerString = await SecureStore.getItemAsync('selectedDriverOffer');
      if (offerString) {
        const offer = JSON.parse(offerString) as SelectedDriverOffer;
        setSelectedDriverOffer(offer);
        if (offer.forcePartial) {
          setLoadMode('Partial');
        }
      } else {
        setSelectedDriverOffer(null);
      }
    } catch (error) {
      console.error('Error loading selected driver offer:', error);
    }
  };

  useEffect(() => {
    if (pickup && drop) {
      calculateRouteOSRM();
      fitBothLocations();
    } else {
      setRouteDistance(null);
      setRouteDistanceValue(null);
      setRouteDuration(null);
      setRouteCoordinates([]);
      setRouteError(null);
      // Reset calculated budget when no route
      setCalculatedBudget(0);
    }
  }, [pickup, drop]);

  // Calculate budget whenever distance or weight changes
  useEffect(() => {
    calculateTotalBudget();
  }, [routeDistanceValue, weightValue]);

  const calculateTotalBudget = () => {
    if (routeDistanceValue && routeDistanceValue > 0) {
      const weightInTons = weightValue / 1000; // Convert KG to Tons
      const distanceCost = routeDistanceValue * RATE_PER_KM;
      const weightCost = weightInTons * RATE_PER_TON;
      const total = Math.round(distanceCost + weightCost);
      setCalculatedBudget(total);
      
      // Auto-set budget if not manually set or if manually set is less than calculated
      if (!budget || parseInt(budget) < total) {
        setBudget(total.toString());
      }
    } else if (routeDistanceValue === 0) {
      // If distance is 0, just calculate weight cost
      const weightInTons = weightValue / 1000;
      const total = Math.round(weightInTons * RATE_PER_TON);
      setCalculatedBudget(total);
      if (!budget || parseInt(budget) < total) {
        setBudget(total.toString());
      }
    } else {
      setCalculatedBudget(0);
    }
  };

  const calculateRouteOSRM = async () => {
    if (!pickup || !drop) return;
    
    setIsCalculatingRoute(true);
    setRouteError(null);
    
    try {
      const origin = `${pickup.longitude},${pickup.latitude}`;
      const destination = `${drop.longitude},${drop.latitude}`;
      
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${origin};${destination}?overview=full&geometries=polyline`
      );
      
      const data = await response.json() as {
        code?: string;
        routes?: { geometry: string; distance: number; duration: number }[];
      };
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const points = decodePolyline(route.geometry, 5);
        setRouteCoordinates(points);
        
        const distanceKm = route.distance / 1000;
        const durationMin = Math.round(route.duration / 60);
        
        setRouteDistanceValue(distanceKm);
        setRouteDistance(`${distanceKm.toFixed(1)} km`);
        setRouteDuration(`${durationMin} mins`);
      } else {
        setRouteError('Using straight line distance');
        calculateStraightLineDistance();
      }
    } catch (error) {
      console.error('Route error:', error);
      setRouteError('Network error - using straight line');
      calculateStraightLineDistance();
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const decodePolyline = (encoded: string, precision = 5): LocationPoint[] => {
    const points: LocationPoint[] = [];
    let index = 0, lat = 0, lng = 0;
    const factor = Math.pow(10, precision);

    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat / factor,
        longitude: lng / factor,
      });
    }
    return points;
  };

  const calculateStraightLineDistance = () => {
    if (!pickup || !drop) return;
    
    const R = 6371;
    const dLat = toRad(drop.latitude - pickup.latitude);
    const dLon = toRad(drop.longitude - pickup.longitude);
    const lat1 = toRad(pickup.latitude);
    const lat2 = toRad(drop.latitude);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    const durationHours = distance / 50;
    const durationMinutes = Math.round(durationHours * 60);
    
    setRouteDistanceValue(distance);
    setRouteDistance(`${distance.toFixed(1)} km`);
    setRouteDuration(`~${durationMinutes} mins (est.)`);
    setRouteCoordinates([pickup, drop]);
  };

  const toRad = (value: number) => value * Math.PI / 180;

  const fitBothLocations = () => {
    if (pickup && drop && miniMapRef.current) {
      miniMapRef.current.fitToCoordinates([pickup, drop], {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  };

  const openMapForPickup = () => {
    setSelectingFor('pickup');
    setMapVisible(true);
  };

  const openMapForDrop = () => {
    setSelectingFor('drop');
    setMapVisible(true);
  };

  const handleMapPress = (e: MapPressEvent) => {
    const coord = e.nativeEvent.coordinate;
    if (selectingFor === "pickup") {
      setPickup(coord);
    } else if (selectingFor === "drop") {
      setDrop(coord);
    }
    setMapVisible(false);
    setSelectingFor(null);
  };

  const clearLocation = (type: Exclude<SelectingFor, null>) => {
    if (type === 'pickup') {
      setPickup(null);
    } else {
      setDrop(null);
    }
    if (!pickup || !drop) {
      setRouteDistance(null);
      setRouteDistanceValue(null);
      setRouteDuration(null);
      setRouteCoordinates([]);
      setRouteError(null);
      setCalculatedBudget(0);
    }
  };

  const handleWeightChange = (text: string) => {
    const numericWeight = text.replace(/[^0-9]/g, '');
    setWeight(numericWeight);
    const weightNum = numericWeight ? parseInt(numericWeight) : 0;
    setWeightValue(weightNum);
  };

  const handleBudgetChange = (text: string) => {
    const numericBudget = text.replace(/[^0-9]/g, '');
    const budgetNum = numericBudget ? parseInt(numericBudget) : 0;
    if (budgetNum < calculatedBudget && calculatedBudget > 0) {
      setBudget(calculatedBudget.toString());
      return;
    }
    setBudget(numericBudget);
  };

  const handleBudgetIncrease = () => {
    const current = parseInt(budget || "0", 10) || calculatedBudget || 0;
    setBudget(String(current + 50));
  };

  const handleBudgetDecrease = () => {
    const current = parseInt(budget || "0", 10) || 0;
    const nextValue = current - 50;
    if (nextValue < calculatedBudget) {
      setBudget(String(calculatedBudget));
      return;
    }
    setBudget(String(nextValue));
  };

  const submitLoadData = async () => {
    if (!isFormValid()) return;

    if ((scheduleDate && !scheduleTime) || (!scheduleDate && scheduleTime)) {
      Alert.alert("Schedule required", "Please provide both schedule date and schedule time.");
      return;
    }
    
    // Final validation check
    const budgetNum = parseInt(budget);
    if (budgetNum < calculatedBudget) {
      Alert.alert(
        "Invalid Budget",
        `Your budget (PKR ${budgetNum.toLocaleString()}) is less than the minimum required amount of PKR ${calculatedBudget.toLocaleString()}.`,
        [
          { text: "Update Budget", onPress: () => setBudget(calculatedBudget.toString()) }
        ]
      );
      return;
    }

    if (selectedDriverOffer?.forcePartial) {
      const maxAvailable = Number(selectedDriverOffer.remainingCapacity ?? 0);
      const requestedWeight = Number(weight || 0);
      if (!Number.isNaN(maxAvailable) && !Number.isNaN(requestedWeight) && requestedWeight > maxAvailable) {
        Alert.alert("Capacity Exceeded", "Entered load exceeds available truck capacity");
        return;
      }
    }
    
    setIsSubmitting(true);
    
    // Format location strings
    const pickupLocationStr = pickup ? `${pickup.latitude},${pickup.longitude}` : '';
    const dropLocationStr = drop ? `${drop.latitude},${drop.longitude}` : '';
    
    let pickupDateTime: string | null = null;
    if (scheduleDate && scheduleTime) {
      const [yearRaw, monthRaw, dayRaw] = scheduleDate.split("-");
      const [hourRaw, minuteRaw] = scheduleTime.split(":");
      const year = Number(yearRaw);
      const month = Number(monthRaw);
      const day = Number(dayRaw);
      const hour = Number(hourRaw);
      const minute = Number(minuteRaw);

      if (
        Number.isFinite(year) &&
        Number.isFinite(month) &&
        Number.isFinite(day) &&
        Number.isFinite(hour) &&
        Number.isFinite(minute)
      ) {
        const localScheduled = new Date(year, month - 1, day, hour, minute, 0, 0);
        pickupDateTime = localScheduled.toISOString();
      }
    }

    // Prepare data matching Django model
    const loadData = {
      user_id: currentUser?.id || currentUser?._id,
      driver_id: selectedDriverOffer?.driverId,
      pickup_city: selectedDriverOffer?.pickupCity,
      drop_city: selectedDriverOffer?.dropCity,
      pickup_location: pickupLocationStr,
      drop_location: dropLocationStr,
      weight: parseFloat(weight),
      load_type: loadType,
      load_mode: selectedDriverOffer?.forcePartial ? 'Partial' : (loadMode === 'Full Load' ? 'Full' : 'Partial'),
      budget_rate: parseFloat(budget),
      final_budget: parseFloat(budget),
      pickup_time: pickupDateTime,
      is_scheduled: Boolean(pickupDateTime),
      distance_km: routeDistanceValue,
      calculated_budget: calculatedBudget,
      status: selectedDriverOffer?.driverId ? 'Pre Pending' : 'Pending'
    };

    try {
      const response = await fetch(`http://13.233.124.213:8000/api/create-load/`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loadData),
      });

      const responseData = await response.json();
      
      if (response.ok) {
        Alert.alert(
          "Success",
          selectedDriverOffer?.driverId
            ? "Your load offer has been sent to the selected driver"
            : "Your load has been created successfully",
          [{ 
            text: "OK", 
            onPress: async () => {
              // Reset form
              setPickup(null);
              setDrop(null);
              setWeight('');
              setWeightValue(0);
              setBudget('');
              setCalculatedBudget(0);
              setLoadType('Normal');
              setLoadMode('Full Load');
              setRouteDistance(null);
              setRouteDistanceValue(null);
              setRouteDuration(null);
              setRouteCoordinates([]);
              setRouteError(null);
              setScheduleDate('');
              setScheduleTime('');
              setSelectedDriverOffer(null);
              await SecureStore.deleteItemAsync('selectedDriverOffer');
            }
          }]
        );
      } else {
        // Show specific error message from Django
        let errorMessage = "Failed to create load";
        if (responseData.error) {
          errorMessage = responseData.error;
        } else if (responseData.message) {
          errorMessage = responseData.message;
        } else if (typeof responseData === 'object') {
          // Handle Django form errors
          const errors = Object.values(responseData).flat();
          if (errors.length > 0) {
            errorMessage = errors.join('\n');
          }
        }
        if (
          typeof errorMessage === "string" &&
          (
            (errorMessage.toLowerCase().includes("truck capacity") && errorMessage.toLowerCase().includes("exceed"))
            || errorMessage.toLowerCase().includes("available truck capacity")
          )
        ) {
          errorMessage = "Entered load exceeds available truck capacity";
        }
        Alert.alert("Error", errorMessage);
      }
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert("Connection Error", "Could not connect to server. Please check your network connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = () => {
    if (!pickup || !drop || !weight || !budget) return false;
    const budgetNum = parseInt(budget);
    return budgetNum >= calculatedBudget;
  };

  const formatNumber = (text: string) => text.replace(/[^0-9]/g, '');
  const toDateLabel = (value: string) => (value ? value : "Select date");
  const toTimeLabel = (value: string) => (value ? value : "Select time");

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatTimeForInput = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const onScheduleDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    setShowScheduleDatePicker(false);
    if (date) {
      setScheduleDate(formatDateForInput(date));
    }
  };

  const onScheduleTimeChange = (_event: DateTimePickerEvent, date?: Date) => {
    setShowScheduleTimePicker(false);
    if (date) {
      setScheduleTime(formatTimeForInput(date));
    }
  };

  const getRouteColor = () => routeError ? '#FFA500' : '#c12443';

  // Calculate breakdown for display
  const getBudgetBreakdown = () => {
    if (!routeDistanceValue || routeDistanceValue === 0 || !weightValue) return null;
    
    const distanceCost = routeDistanceValue * RATE_PER_KM;
    const weightInTons = weightValue / 1000;
    const weightCost = weightInTons * RATE_PER_TON;
    
    return {
      distance: distanceCost,
      weight: weightCost,
      total: distanceCost + weightCost
    };
  };

  const breakdown = getBudgetBreakdown();

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
            <Text style={styles.headerTitle}>Load Manager</Text>
            <Text style={styles.headerSubtitle}>Create New Load</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="cube-outline" size={28} color="#fff" />
          </View>
        </View>
      </LinearGradient>

      {/* Main Form */}
      <ScrollView 
        style={styles.formContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.formContent}
      >
        {selectedDriverOffer && (
          <View style={styles.offerBanner}>
            <View style={styles.offerBannerIcon}>
              <Ionicons name="person-outline" size={18} color="#fff" />
            </View>
            <View style={styles.offerBannerContent}>
              <Text style={styles.offerBannerTitle}>Selected Driver Offer</Text>
              <Text style={styles.offerBannerText}>
                {selectedDriverOffer.driverName || 'Driver'} • {selectedDriverOffer.truckType || 'Truck'} • {selectedDriverOffer.registrationNo || 'No reg'}
              </Text>
              {selectedDriverOffer.remainingCapacity ? (
                <Text style={styles.offerBannerText}>
                  Available: {selectedDriverOffer.remainingCapacity} kg
                </Text>
              ) : null}
              <Text style={styles.offerBannerText}>
                This load will be submitted as Pre Pending{selectedDriverOffer?.forcePartial ? " (Partial only)" : ""}.
              </Text>
            </View>
            <TouchableOpacity
              onPress={async () => {
                setSelectedDriverOffer(null);
                await SecureStore.deleteItemAsync('selectedDriverOffer');
              }}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Mini Map */}
        {pickup && drop && (
          <View style={styles.miniMapContainer}>
            <MapView
              ref={miniMapRef}
              style={styles.miniMap}
              provider={PROVIDER_GOOGLE}
              initialRegion={region}
              onLayout={fitBothLocations}
              showsUserLocation={true}
              customMapStyle={darkMapStyle}
            >
              <Marker coordinate={pickup}>
                <View style={[styles.miniMapMarker, styles.pickupMiniMarker]}>
                  <Ionicons name="location" size={14} color="#fff" />
                </View>
              </Marker>
              <Marker coordinate={drop}>
                <View style={[styles.miniMapMarker, styles.dropMiniMarker]}>
                  <Ionicons name="flag" size={14} color="#fff" />
                </View>
              </Marker>
              {routeCoordinates.length > 0 && (
                <Polyline
                  coordinates={routeCoordinates}
                  strokeWidth={4}
                  strokeColor={getRouteColor()}
                />
              )}
            </MapView>
            
            {/* Route Info */}
            <BlurView intensity={80} tint="dark" style={styles.routeInfo}>
              {isCalculatingRoute ? (
                <View style={styles.routeInfoItem}>
                  <ActivityIndicator size="small" color="#c12443" />
                  <Text style={styles.routeInfoText}>Finding route...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.routeInfoItem}>
                    <Ionicons name="map-outline" size={16} color={getRouteColor()} />
                    <Text style={styles.routeInfoText}>{routeDistance || '-- km'}</Text>
                  </View>
                  <View style={styles.routeInfoDivider} />
                  <View style={styles.routeInfoItem}>
                    <Ionicons name="time-outline" size={16} color={getRouteColor()} />
                    <Text style={styles.routeInfoText}>{routeDuration || '-- min'}</Text>
                  </View>
                </>
              )}
            </BlurView>

            {routeError && (
              <View style={styles.routeWarning}>
                <Ionicons name="warning-outline" size={16} color="#FFA500" />
                <Text style={styles.routeWarningText}>{routeError}</Text>
              </View>
            )}
          </View>
        )}

        {/* Location Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route Details</Text>
          
          {/* Pickup Card */}
          <TouchableOpacity 
            style={[styles.locationCard, pickup && styles.locationCardFilled]}
            onPress={openMapForPickup}
          >
            <View style={styles.locationCardLeft}>
              <View style={[styles.locationDot, styles.pickupDot]} />
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>Pickup Point</Text>
                {pickup ? (
                  <Text style={styles.locationCoordinates}>
                    Lat: {pickup.latitude.toFixed(6)}, Lng: {pickup.longitude.toFixed(6)}
                  </Text>
                ) : (
                  <Text style={styles.locationPlaceholder}>Tap to select pickup location</Text>
                )}
              </View>
            </View>
            {pickup ? (
              <TouchableOpacity onPress={() => clearLocation('pickup')}>
                <Ionicons name="close-circle" size={22} color="#c12443" />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-forward" size={20} color="#666" />
            )}
          </TouchableOpacity>

          {/* Drop Card */}
          <TouchableOpacity 
            style={[styles.locationCard, drop && styles.locationCardFilled]}
            onPress={openMapForDrop}
          >
            <View style={styles.locationCardLeft}>
              <View style={[styles.locationDot, styles.dropDot]} />
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>Drop Point</Text>
                {drop ? (
                  <Text style={styles.locationCoordinates}>
                    Lat: {drop.latitude.toFixed(6)}, Lng: {drop.longitude.toFixed(6)}
                  </Text>
                ) : (
                  <Text style={styles.locationPlaceholder}>Tap to select drop location</Text>
                )}
              </View>
            </View>
            {drop ? (
              <TouchableOpacity onPress={() => clearLocation('drop')}>
                <Ionicons name="close-circle" size={22} color="#c12443" />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-forward" size={20} color="#666" />
            )}
          </TouchableOpacity>
        </View>

        {/* Load Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Load Specifications</Text>

          {/* Weight Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Weight (KG)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="scale-outline" size={20} color="#c12443" />
              <TextInput
                style={styles.input}
                placeholder="Enter weight"
                placeholderTextColor="#666"
                value={weight}
                onChangeText={handleWeightChange}
                keyboardType="numeric"
              />
              <Text style={styles.inputSuffix}>kg</Text>
            </View>
            {weightValue > 0 && (
              <Text style={styles.helperText}>
                = {(weightValue / 1000).toFixed(2)} tons
              </Text>
            )}
          </View>

          {/* Budget Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Calculated Budget: PKR {calculatedBudget.toLocaleString()}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="cash-outline" size={20} color="#c12443" />
              <Text style={styles.inputPrefix}>PKR</Text>
              <TextInput
                style={[styles.input, styles.inputWithPrefix]}
                placeholder="Set final budget"
                placeholderTextColor="#666"
                value={budget}
                onChangeText={handleBudgetChange}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.budgetButtonsRow}>
              <TouchableOpacity style={styles.budgetButton} onPress={handleBudgetIncrease}>
                <Text style={styles.budgetButtonText}>+50</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.budgetButton, (parseInt(budget || "0", 10) <= calculatedBudget) && styles.budgetButtonDisabled]}
                onPress={handleBudgetDecrease}
                disabled={parseInt(budget || "0", 10) <= calculatedBudget}
              >
                <Text style={styles.budgetButtonText}>-50</Text>
              </TouchableOpacity>
            </View>
            {parseInt(budget || "0", 10) <= calculatedBudget ? (
              <Text style={styles.helperText}>Budget cannot be lower than minimum calculated amount</Text>
            ) : null}
          </View>

          {/* Load Type */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Schedule Date (Optional)</Text>
            <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowScheduleDatePicker(true)}>
              <Ionicons name="calendar-outline" size={20} color="#c12443" />
              <Text style={[styles.input, { color: scheduleDate ? "#fff" : "#666" }]}>{toDateLabel(scheduleDate)}</Text>
            </TouchableOpacity>
            {showScheduleDatePicker ? (
              <DateTimePicker
                value={new Date()}
                mode="date"
                display="default"
                onChange={onScheduleDateChange}
              />
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Schedule Time (Optional)</Text>
            <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowScheduleTimePicker(true)}>
              <Ionicons name="time-outline" size={20} color="#c12443" />
              <Text style={[styles.input, { color: scheduleTime ? "#fff" : "#666" }]}>{toTimeLabel(scheduleTime)}</Text>
            </TouchableOpacity>
            {showScheduleTimePicker ? (
              <DateTimePicker
                value={new Date()}
                mode="time"
                display="default"
                onChange={onScheduleTimeChange}
              />
            ) : null}
          </View>

          {/* Load Type */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Load Type</Text>
            <View style={styles.optionsRow}>
              {(['Normal', 'Fragile'] as LoadType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.option, loadType === type && styles.optionSelected]}
                  onPress={() => setLoadType(type)}
                >
                  <Ionicons 
                    name={type === 'Normal' ? 'cube-outline' : 'warning-outline'} 
                    size={24} 
                    color={loadType === type ? "#c12443" : "#666"} 
                  />
                  <Text style={[styles.optionText, loadType === type && styles.optionTextSelected]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Load Mode */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Load Mode</Text>
            <View style={styles.optionsRow}>
              {(selectedDriverOffer?.forcePartial ? (['Partial'] as LoadMode[]) : (['Full Load', 'Partial'] as LoadMode[])).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.option, loadMode === mode && styles.optionSelected]}
                  onPress={() => setLoadMode(mode)}
                >
                  <Ionicons 
                    name={mode === 'Full Load' ? 'cube' : 'layers-outline'} 
                    size={24} 
                    color={loadMode === mode ? "#c12443" : "#666"} 
                  />
                  <Text style={[styles.optionText, loadMode === mode && styles.optionTextSelected]}>
                    {mode}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Summary Section */}
        {isFormValid() && (
          <View style={styles.summarySection}>
            <LinearGradient colors={['rgba(193,36,67,0.1)', 'transparent']} style={styles.summaryGradient}>
              <Text style={styles.summaryTitle}>Load Summary</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Ionicons name="barbell-outline" size={16} color="#c12443" />
                  <Text style={styles.summaryLabel}>Weight</Text>
                  <Text style={styles.summaryValue}>{weight} kg</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Ionicons name="cash-outline" size={16} color="#c12443" />
                  <Text style={styles.summaryLabel}>Budget</Text>
                  <Text style={styles.summaryValue}>PKR {parseInt(budget).toLocaleString()}</Text>
                </View>
              </View>
              {breakdown && (
                <View style={styles.summaryBreakdown}>
                  <Text style={styles.summaryBreakdownText}>
                    Minimum required: PKR {calculatedBudget.toLocaleString()}
                  </Text>
                </View>
              )}
            </LinearGradient>
          </View>
        )}

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.submitBtn, (!isFormValid() || isSubmitting) && styles.submitBtnDisabled]}
          disabled={!isFormValid() || isSubmitting}
          onPress={submitLoadData}
        >
          <LinearGradient
            colors={isFormValid() && !isSubmitting ? ['#c12443', '#a01e36'] : ['#333', '#222']}
            style={styles.gradient}
          >
            {isSubmitting ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={[styles.submitText, { marginLeft: 10 }]}>Creating...</Text>
              </>
            ) : (
              <>
                <Text style={styles.submitText}>Create Load</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* Map Modal */}
      <Modal visible={mapVisible} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <BlurView intensity={100} tint="dark" style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMapVisible(false)} style={styles.closeButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              Select {selectingFor === 'pickup' ? 'Pickup' : 'Drop'} Location
            </Text>
            <View style={{ width: 40 }} />
          </BlurView>

          <MapView
            ref={mapRef}
            style={styles.modalMap}
            provider={PROVIDER_GOOGLE}
            region={region}
            onPress={handleMapPress}
            showsUserLocation={true}
            customMapStyle={darkMapStyle}
          >
            {pickup && selectingFor !== 'pickup' && (
              <Marker coordinate={pickup}>
                <View style={[styles.mapMarker, styles.pickupMarker]}>
                  <Ionicons name="location" size={20} color="#fff" />
                </View>
              </Marker>
            )}
            {drop && selectingFor !== 'drop' && (
              <Marker coordinate={drop}>
                <View style={[styles.mapMarker, styles.dropMarker]}>
                  <Ionicons name="flag" size={20} color="#fff" />
                </View>
              </Marker>
            )}
          </MapView>

          <BlurView intensity={90} tint="dark" style={styles.mapInstruction}>
            <Ionicons name="hand-right" size={24} color="#c12443" />
            <Text style={styles.instructionText}>Tap on map to select location</Text>
          </BlurView>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

// Main Trader Dashboard with Drawer
export default function TraderDashboard() {
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
        drawerType: 'front',
        drawerStyle: {
          backgroundColor: '#111',
          width: 300,
        },
        overlayColor: 'rgba(0,0,0,0.5)',
        swipeEnabled: true,
      }}
    >
      <Drawer.Screen name="Create Load" component={CreateLoadScreen} />
    </Drawer.Navigator>
  );
}

// Dark map style
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] }
];

// Styles (add new styles)
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
  offerBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(193,36,67,0.22)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  offerBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginRight: 12,
  },
  offerBannerContent: {
    flex: 1,
  },
  offerBannerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  offerBannerText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    marginBottom: 2,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  miniMapContainer: {
    borderRadius: 20,
    marginBottom: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  miniMap: {
    width: '100%',
    height: 200,
  },
  miniMapMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  pickupMiniMarker: {
    backgroundColor: '#c12443',
  },
  dropMiniMarker: {
    backgroundColor: '#333',
  },
  routeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  routeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  routeInfoDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  routeInfoText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#fff',
  },
  routeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(255,165,0,0.1)',
  },
  routeWarningText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#FFA500',
    flex: 1,
  },
  locationCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  locationCardFilled: {
    borderColor: '#c12443',
    backgroundColor: 'rgba(193,36,67,0.1)',
  },
  locationCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 14,
  },
  pickupDot: {
    backgroundColor: '#c12443',
  },
  dropDot: {
    backgroundColor: '#fff',
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  locationCoordinates: {
    fontSize: 12,
    color: '#999',
  },
  locationPlaceholder: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginLeft: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    backgroundColor: '#111',
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    padding: 14,
    fontSize: 15,
    color: '#fff',
  },
  inputWithPrefix: {
    paddingLeft: 5,
  },
  inputPrefix: {
    fontSize: 15,
    color: '#c12443',
    fontWeight: '600',
    marginHorizontal: 5,
  },
  inputSuffix: {
    fontSize: 14,
    color: '#666',
  },
  budgetButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  budgetButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#111',
  },
  budgetButtonDisabled: {
    opacity: 0.5,
  },
  budgetButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#111',
  },
  optionSelected: {
    borderColor: '#c12443',
    backgroundColor: 'rgba(193,36,67,0.15)',
  },
  optionText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  optionTextSelected: {
    color: '#c12443',
  },
  budgetBreakdown: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(193,36,67,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(193,36,67,0.3)',
  },
  breakdownTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#c12443',
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  breakdownText: {
    fontSize: 11,
    color: '#999',
  },
  breakdownValue: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
  },
  breakdownTotal: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(193,36,67,0.3)',
  },
  breakdownTotalText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#c12443',
  },
  breakdownTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#c12443',
  },
  summarySection: {
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(193,36,67,0.3)',
  },
  summaryGradient: {
    padding: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#c12443',
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  summaryBreakdown: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  summaryBreakdownText: {
    fontSize: 11,
    color: '#c12443',
    textAlign: 'center',
  },
  submitBtn: {
    marginTop: 10,
    borderRadius: 16,
    overflow: 'hidden',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  submitText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    marginRight: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: Platform.OS === 'android' ? 40 : 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalMap: {
    flex: 1,
  },
  mapMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  pickupMarker: {
    backgroundColor: '#c12443',
  },
  dropMarker: {
    backgroundColor: '#333',
  },
  mapInstruction: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  instructionText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 10,
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
