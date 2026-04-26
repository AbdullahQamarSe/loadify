import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";

import { useSMEDrawerNavigation, withSMEDrawer } from "@/components/sme-drawer";
import { API_BASE_URL } from "@/lib/api";

type UserData = {
  id?: string | number;
  _id?: string | number;
};

type InvoiceItem = {
  id: number;
  load_id?: number | null;
  booking_id?: number | null;
  sme_name?: string | null;
  driver_name?: string | null;
  truck_registration_no?: string | null;
  truck_type?: string | null;
  pickup_location?: string | null;
  drop_location?: string | null;
  route?: string | null;
  route_distance_km?: string | number | null;
  route_duration_minutes?: number | null;
  cost?: string | number | null;
  date?: string | null;
  paid?: boolean | null;
  payment_status?: "paid" | "unpaid" | null;
  payment_method?: "cash" | "online" | "wallet" | null;
  transaction_id?: string | null;
};

const paymentMethods: { label: string; value: "cash" | "online" | "wallet" }[] = [
  { label: "Cash", value: "cash" },
  { label: "Online", value: "online" },
  { label: "Wallet", value: "wallet" },
];

function SMEInvoicesScreen() {
  const navigation = useSMEDrawerNavigation();
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<number | null>(null);

  const getSmeId = async () => {
    const userDataString = await SecureStore.getItemAsync("userData");
    if (!userDataString) throw new Error("Session not found. Please login again.");
    const userData = JSON.parse(userDataString) as UserData;
    const id = userData.id ?? userData._id;
    if (!id) throw new Error("SME account not found.");
    return id;
  };

  const fetchInvoices = useCallback(async () => {
    try {
      setErrorText(null);
      const smeId = await getSmeId();
      const response = await fetch(`http://13.233.124.213:8000/api/sme/invoices/?sme_id=${smeId}`);
      const data = (await response.json()) as InvoiceItem[] | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to load invoices.");
      }
      setInvoices(Array.isArray(data) ? data : []);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to load invoices.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const downloadPdf = async (invoiceId: number) => {
    try {
      setDownloadingId(invoiceId);
      const smeId = await getSmeId();
      const pdfUrl = `http://13.233.124.213:8000/api/sme/invoices/${invoiceId}/pdf/?sme_id=${smeId}`;
      await Linking.openURL(pdfUrl);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to open invoice PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const markAsPaid = async (invoiceId: number, method: "cash" | "online" | "wallet") => {
    try {
      setUpdatingInvoiceId(invoiceId);
      const smeId = await getSmeId();
      const response = await fetch(`http://13.233.124.213:8000/api/invoice/${invoiceId}/?sme_id=${smeId}`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment_status: "paid",
          payment_method: method,
          paid: true,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to update invoice payment.");
      }
      await fetchInvoices();
      Alert.alert("Success", `Invoice marked as paid via ${method}.`);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to mark invoice as paid.");
    } finally {
      setUpdatingInvoiceId(null);
    }
  };

  const askPaymentMethod = (invoiceId: number) => {
    Alert.alert("Payment Method", "Select payment method", [
      ...paymentMethods.map((item) => ({
        text: item.label,
        onPress: () => markAsPaid(invoiceId, item.value),
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const renderInvoiceCard = ({ item }: { item: InvoiceItem }) => {
    const isPaid = item.payment_status ? item.payment_status === "paid" : Boolean(item.paid);

    return (
      <View style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.invoiceId}>Invoice #{item.id}</Text>
          <View style={[styles.badge, isPaid ? styles.badgePaid : styles.badgeUnpaid]}>
            <Text style={styles.badgeText}>{isPaid ? "Paid" : "Unpaid"}</Text>
          </View>
        </View>

        <View style={styles.rowTwoCol}>
          <Text style={styles.info}>Load: {item.load_id ?? "N/A"}</Text>
          <Text style={styles.info}>Booking: {item.booking_id ?? "N/A"}</Text>
        </View>
        <Text style={styles.info}>SME: {item.sme_name || "N/A"}</Text>
        <Text style={styles.info}>Driver: {item.driver_name || "N/A"}</Text>
        <Text style={styles.info}>Truck: {item.truck_type || "N/A"} ({item.truck_registration_no || "N/A"})</Text>
        <Text style={styles.info}>
          Route: {item.pickup_location || "N/A"}
          {" -> "}
          {item.drop_location || "N/A"}
        </Text>
        <Text style={styles.info}>Distance: {item.route_distance_km || "N/A"} km | ETA: {item.route_duration_minutes || "N/A"} min</Text>
        <Text style={styles.info}>Cost: {item.cost ?? "N/A"}</Text>
        <Text style={styles.info}>Date: {item.date || "N/A"}</Text>
        <Text style={styles.info}>Payment Method: {item.payment_method || "N/A"}</Text>
        <Text style={styles.info}>Transaction ID: {item.transaction_id || "N/A"}</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.pdfBtn, downloadingId === item.id && styles.btnDisabled]}
            disabled={downloadingId === item.id}
            onPress={() => downloadPdf(item.id)}
          >
            {downloadingId === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="download-outline" size={16} color="#fff" />
                <Text style={styles.btnText}>PDF</Text>
              </>
            )}
          </TouchableOpacity>

          {!isPaid ? (
            <TouchableOpacity
              style={[styles.payBtn, updatingInvoiceId === item.id && styles.btnDisabled]}
              disabled={updatingInvoiceId === item.id}
              onPress={() => askPaymentMethod(item.id)}
            >
              {updatingInvoiceId === item.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done-outline" size={16} color="#fff" />
                  <Text style={styles.btnText}>Mark as Paid</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.openDrawer()}>
        <Ionicons name="menu" size={20} color="#fff" />
        <Text style={styles.backText}>Menu</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Invoices</Text>
      <Text style={styles.desc}>Professional invoice view with payment updates.</Text>
      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#c12443" />
          <Text style={styles.loaderText}>Loading invoices...</Text>
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchInvoices();
              }}
              tintColor="#c12443"
            />
          }
          renderItem={renderInvoiceCard}
          ListEmptyComponent={<Text style={styles.emptyText}>No invoices found yet.</Text>}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0f12", padding: 16 },
  back: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  backText: { color: "#fff", marginLeft: 8, fontWeight: "600" },
  title: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 6 },
  desc: { color: "#c5ceda", fontSize: 14, marginBottom: 10 },
  errorText: {
    color: "#ffadad",
    backgroundColor: "rgba(255,77,77,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.35)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  loaderText: { color: "#9aa4b0", marginTop: 10 },
  listContent: { paddingBottom: 24 },
  card: {
    backgroundColor: "#151922",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 10,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  invoiceId: { color: "#fff", fontSize: 15, fontWeight: "700" },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgePaid: {
    backgroundColor: "rgba(56,194,122,0.2)",
    borderColor: "rgba(56,194,122,0.45)",
  },
  badgeUnpaid: {
    backgroundColor: "rgba(255,165,0,0.2)",
    borderColor: "rgba(255,165,0,0.45)",
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  rowTwoCol: { flexDirection: "row", justifyContent: "space-between" },
  info: { color: "#c7d0dc", fontSize: 13, marginBottom: 4 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  pdfBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#5f6774",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  payBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#1f9d57",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", marginLeft: 8, fontWeight: "700" },
  emptyText: { color: "#9aa4b0", textAlign: "center", marginTop: 20 },
});

export default withSMEDrawer(SMEInvoicesScreen, "Invoices");
