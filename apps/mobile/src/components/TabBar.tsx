import { Pressable, Text, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "../theme";

const ICONS: Record<string, string> = {
  Home: "▦",
  Calendar: "◷",
  Tasks: "☑",
  Priority: "⚑",
};

/**
 * Custom bottom tab bar with an elevated center FAB — the RN port of the web
 * app's `.bottom-nav` + `.fab`. Four tabs split around the FAB.
 */
export function TabBar({ state, navigation, onFab }: BottomTabBarProps & { onFab: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const routes = state.routes;
  const mid = Math.ceil(routes.length / 2);

  const item = (index: number) => {
    const route = routes[index];
    const focused = state.index === index;
    return (
      <Pressable
        key={route.key}
        style={styles.item}
        onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
      >
        <Text style={{ fontSize: 20, color: focused ? t.text : t.faint }}>{ICONS[route.name] ?? "•"}</Text>
        <Text style={{ fontSize: 10, marginTop: 3, color: focused ? t.text : t.faint }}>{route.name}</Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: t.bg, borderTopColor: t.stroke, paddingBottom: Math.max(10, insets.bottom) },
      ]}
    >
      {routes.slice(0, mid).map((_, i) => item(i))}

      <Pressable onPress={onFab} style={[styles.fab, { backgroundColor: t.accent }]}>
        <Text style={{ color: t.onAccent, fontSize: 28, lineHeight: 30 }}>+</Text>
      </Pressable>

      {routes.slice(mid).map((_, i) => item(mid + i))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 8,
    borderTopWidth: 1,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 48 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
