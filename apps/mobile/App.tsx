import { useState } from "react";
import { ActivityIndicator, Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { NavigationContainer, type Theme as NavTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";

import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { TabBar } from "./src/components/TabBar";
import { Btn } from "./src/components/ui";
import { useTheme, type Theme } from "./src/theme";
import { useAppData } from "./src/lib/useAppData";
import { AppProvider } from "./src/appContext";
import { Setup } from "./src/screens/Setup";
import { Dashboard } from "./src/screens/Dashboard";
import { Calendar } from "./src/screens/Calendar";
import { Tasks } from "./src/screens/Tasks";
import { Priority } from "./src/screens/Priority";
import { AddGoal } from "./src/screens/AddGoal";
import { Reschedule } from "./src/screens/Reschedule";

const Tab = createBottomTabNavigator();

function navigationTheme(t: Theme): NavTheme {
  return {
    dark: t.dark,
    colors: { primary: t.accent, background: t.bg, card: t.bg, text: t.text, border: t.stroke, notification: t.danger },
    fonts: {
      regular: { fontFamily: "System", fontWeight: "400" },
      medium: { fontFamily: "System", fontWeight: "500" },
      bold: { fontFamily: "System", fontWeight: "700" },
      heavy: { fontFamily: "System", fontWeight: "800" },
    },
  };
}

/** Full-screen themed modal wrapper for the Add / Reschedule flows. */
function SheetModal({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Root() {
  const t = useTheme();
  const data = useAppData();
  const [addOpen, setAddOpen] = useState(false);
  const [reschedOpen, setReschedOpen] = useState(false);

  if (data.loading) {
    return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={t.text} /></View>;
  }
  if (data.error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>⚠️</Text>
        <Text style={{ color: t.text, fontWeight: "600", marginBottom: 6 }}>Couldn't load your data</Text>
        <Text style={{ color: t.muted, textAlign: "center", marginBottom: 12 }}>{data.error}</Text>
        <View style={{ alignSelf: "stretch" }}><Btn label="Try Again" onPress={() => data.reload()} /></View>
      </SafeAreaView>
    );
  }
  if (!data.profile) {
    return <Setup onDone={() => data.reload()} />;
  }

  return (
    <AppProvider value={{ data, openAdd: () => setAddOpen(true), openReschedule: () => setReschedOpen(true) }}>
      <NavigationContainer theme={navigationTheme(t)}>
        <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} onFab={() => setAddOpen(true)} />}>
          <Tab.Screen name="Home" component={Dashboard} />
          <Tab.Screen name="Calendar" component={Calendar} />
          <Tab.Screen name="Tasks" component={Tasks} />
          <Tab.Screen name="Priority" component={Priority} />
        </Tab.Navigator>
      </NavigationContainer>

      <SheetModal visible={addOpen} onClose={() => setAddOpen(false)}><AddGoal onClose={() => setAddOpen(false)} /></SheetModal>
      <SheetModal visible={reschedOpen} onClose={() => setReschedOpen(false)}><Reschedule onClose={() => setReschedOpen(false)} /></SheetModal>
    </AppProvider>
  );
}

export default function App() {
  const t = useTheme();
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style={t.dark ? "light" : "dark"} />
        <Root />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
