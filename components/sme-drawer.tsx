import React from "react";
import { createDrawerNavigator } from "@react-navigation/drawer";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { AppDrawerContent, type DrawerMenuItem } from "@/components/app-drawer-content";

type SMEDrawerParamList = {
  SMEPage: undefined;
};

const Drawer = createDrawerNavigator<SMEDrawerParamList>();

export const smeDrawerItems: DrawerMenuItem[] = [
  { icon: "grid-outline", label: "SME Dashboard", route: "/smedashboard" },
  { icon: "repeat-outline", label: "Repeat Orders", route: "/sme-repeat-orders" },
  { icon: "calendar-outline", label: "Scheduled Pickups", route: "/sme-schedule" },
  { icon: "layers-outline", label: "Bulk Booking", route: "/sme-bulk-booking" },
  { icon: "receipt-outline", label: "Invoices", route: "/sme-invoices" },
  { icon: "location-outline", label: "Track Shipments", route: "/sme-track-shipments" },
];

export const useSMEDrawerNavigation = () =>
  useNavigation<DrawerNavigationProp<SMEDrawerParamList>>();

export function withSMEDrawer(ScreenComponent: React.ComponentType, screenTitle: string) {
  function WrappedSMEScreen() {
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
            items={smeDrawerItems}
            onLogout={handleLogout}
            defaultUserLabel="SME"
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
        <Drawer.Screen name="SMEPage" component={ScreenComponent} options={{ title: screenTitle }} />
      </Drawer.Navigator>
    );
  }

  return WrappedSMEScreen;
}
