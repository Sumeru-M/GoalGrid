import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { NavigationContainer, type Theme as NavTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";

import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { TabBar } from "./src/components/TabBar";
import { useTheme, type Theme } from "./src/theme";

const Tab = createBottomTabNavigator();

// Placeholder tab content — real screens land in Phase 3. Kept themed so the
// design system + navigation shell can be verified now.
function Placeholder({ title }: { title: string }) {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <View style={{ padding: 20 }}>
        <Text style={{ color: t.text, fontSize: 26, fontWeight: t.titleWeight }}>{title}</Text>
        <Text style={{ color: t.muted, fontSize: 14, marginTop: 6 }}>Screen content arrives in Phase 3.</Text>
      </View>
    </SafeAreaView>
  );
}

const Home = () => <Placeholder title="Good morning 👋" />;
const Calendar = () => <Placeholder title="Calendar" />;
const Tasks = () => <Placeholder title="Tasks" />;
const Priority = () => <Placeholder title="Priority" />;

function navigationTheme(t: Theme): NavTheme {
  return {
    dark: t.dark,
    colors: {
      primary: t.accent,
      background: t.bg,
      card: t.bg,
      text: t.text,
      border: t.stroke,
      notification: t.danger,
    },
    // RN Navigation v7 requires a `fonts` block; defaults are fine.
    fonts: {
      regular: { fontFamily: "System", fontWeight: "400" },
      medium: { fontFamily: "System", fontWeight: "500" },
      bold: { fontFamily: "System", fontWeight: "700" },
      heavy: { fontFamily: "System", fontWeight: "800" },
    },
  };
}

export default function App() {
  const t = useTheme();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style={t.dark ? "light" : "dark"} />
        <NavigationContainer theme={navigationTheme(t)}>
          <Tab.Navigator
            screenOptions={{ headerShown: false }}
            tabBar={(props) => <TabBar {...props} onFab={() => setAddOpen(true)} />}
          >
            <Tab.Screen name="Home" component={Home} />
            <Tab.Screen name="Calendar" component={Calendar} />
            <Tab.Screen name="Tasks" component={Tasks} />
            <Tab.Screen name="Priority" component={Priority} />
          </Tab.Navigator>
        </NavigationContainer>

        {/* FAB action placeholder — becomes the Add Goal flow in Phase 3. */}
        <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setAddOpen(false)}>
            <View style={[styles.sheet, { backgroundColor: t.card, borderColor: t.stroke }]}>
              <Text style={{ color: t.text, fontSize: 17, fontWeight: "600" }}>New goal</Text>
              <Text style={{ color: t.muted, marginTop: 6 }}>The Add Goal flow arrives in Phase 3.</Text>
              <Pressable
                onPress={() => setAddOpen(false)}
                style={{ backgroundColor: t.accent, borderRadius: t.radiusSm, padding: 14, marginTop: 18, alignItems: "center" }}
              >
                <Text style={{ color: t.onAccent, fontWeight: "600" }}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopWidth: 1, borderRadius: 20, padding: 20, margin: 8 },
});
