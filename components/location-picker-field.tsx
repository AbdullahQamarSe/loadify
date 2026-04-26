import React, { useMemo, useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE, type MapPressEvent, type Region } from "react-native-maps";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import * as Location from "expo-location";

export type LocationValue = {
  address: string;
  latitude: number;
  longitude: number;
};

type Props = {
  label: string;
  value: LocationValue | null;
  onChange: (value: LocationValue) => void;
};

const DEFAULT_REGION: Region = {
  latitude: 31.5204,
  longitude: 74.3587,
  latitudeDelta: 6,
  longitudeDelta: 6,
};

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function LocationPickerField({ label, value, onChange }: Props) {
  const [mapVisible, setMapVisible] = useState(false);
  const [selected, setSelected] = useState<LocationValue | null>(value);

  const currentRegion = useMemo<Region>(() => {
    if (!selected) {
      return DEFAULT_REGION;
    }
    return {
      latitude: selected.latitude,
      longitude: selected.longitude,
      latitudeDelta: 0.15,
      longitudeDelta: 0.15,
    };
  }, [selected]);

  const onMapPress = async (event: MapPressEvent) => {
    const lat = event.nativeEvent.coordinate.latitude;
    const lng = event.nativeEvent.coordinate.longitude;

    let address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    try {
      const result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const first = result[0];
      if (first) {
        const parts = [first.name, first.street, first.city, first.region, first.country].filter(Boolean);
        if (parts.length > 0) {
          address = parts.join(", ");
        }
      }
    } catch {
      // Keep coordinates fallback address when reverse geocoding fails.
    }

    setSelected({
      address,
      latitude: lat,
      longitude: lng,
    });
  };

  const applySelectedLocation = () => {
    if (!selected) {
      return;
    }
    onChange(selected);
    setMapVisible(false);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>

      {GOOGLE_MAPS_API_KEY ? (
        <View style={styles.searchWrap}>
          <GooglePlacesAutocomplete
            placeholder={`Search ${label}`}
            fetchDetails
            query={{
              key: GOOGLE_MAPS_API_KEY,
              language: "en",
            }}
            onPress={(data, details = null) => {
              if (!details?.geometry?.location) {
                return;
              }
              const nextValue: LocationValue = {
                address: data.description || "Selected location",
                latitude: details.geometry.location.lat,
                longitude: details.geometry.location.lng,
              };
              setSelected(nextValue);
              onChange(nextValue);
            }}
            styles={{
              textInput: styles.searchInput,
              listView: styles.placesList,
              row: styles.placeRow,
              description: styles.placeText,
            }}
            enablePoweredByContainer={false}
            nearbyPlacesAPI="GooglePlacesSearch"
          />
        </View>
      ) : (
        <Text style={styles.helperText}>Google Places key missing. Map picker is available.</Text>
      )}

      <TouchableOpacity style={styles.mapButton} onPress={() => setMapVisible(true)}>
        <Ionicons name="map-outline" size={16} color="#fff" />
        <Text style={styles.mapButtonText}>Pick On Map</Text>
      </TouchableOpacity>

      <Text style={styles.valueText} numberOfLines={2}>
        {value
          ? `${value.address} (${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)})`
          : "No location selected"}
      </Text>

      <Modal visible={mapVisible} animationType="slide" transparent={false} onRequestClose={() => setMapVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label} Picker</Text>
            <TouchableOpacity onPress={() => setMapVisible(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={currentRegion}
            onPress={onMapPress}
          >
            {selected ? (
              <Marker
                coordinate={{ latitude: selected.latitude, longitude: selected.longitude }}
                title={label}
                description={selected.address}
              />
            ) : null}
          </MapView>

          <View style={styles.modalFooter}>
            <Text style={styles.selectedAddress} numberOfLines={2}>
              {selected?.address || "Tap on map to select"}
            </Text>
            <TouchableOpacity
              style={[styles.confirmButton, !selected && styles.disabledButton]}
              onPress={applySelectedLocation}
              disabled={!selected}
            >
              <Text style={styles.confirmButtonText}>Use Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 10 },
  label: { color: "#d3dbe7", fontSize: 13, fontWeight: "600", marginBottom: 6 },
  helperText: { color: "#9aa4b0", fontSize: 12, marginBottom: 8 },
  searchWrap: { zIndex: 20 },
  searchInput: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    backgroundColor: "#0f141d",
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 44,
    fontSize: 14,
  },
  placesList: {
    backgroundColor: "#0f141d",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  placeRow: { backgroundColor: "#0f141d" },
  placeText: { color: "#fff" },
  mapButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "#11161d",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  mapButtonText: { color: "#fff", marginLeft: 8, fontWeight: "700" },
  valueText: { color: "#aeb8c7", fontSize: 12, marginTop: 6 },
  modalContainer: { flex: 1, backgroundColor: "#0d0f12" },
  modalHeader: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  map: { flex: 1 },
  modalFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#151922",
  },
  selectedAddress: { color: "#c6cfdb", marginBottom: 10 },
  confirmButton: {
    backgroundColor: "#c12443",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  disabledButton: { opacity: 0.5 },
  confirmButtonText: { color: "#fff", fontWeight: "700" },
});
