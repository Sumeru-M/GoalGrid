import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleProp, Text, TextStyle, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme";

/** Scrollable themed screen with room for the tab bar. */
export function Screen({ children, edges = ["top"] }: { children: ReactNode; edges?: ("top" | "bottom")[] }) {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={edges}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function H1({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.text, fontSize: 26, fontWeight: t.titleWeight, letterSpacing: -0.3 }}>{children}</Text>;
}

export function Sub({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[{ color: t.muted, fontSize: 14, marginTop: 4, lineHeight: 20 }, style]}>{children}</Text>;
}

export function Card({ children, featured, style }: { children: ReactNode; featured?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: featured ? t.cardFeatured : t.card,
          borderColor: t.stroke,
          borderWidth: featured ? 0 : 1,
          borderRadius: t.radius,
          padding: 16,
          marginTop: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Btn({
  label, onPress, disabled, ghost, onFeatured,
}: { label: string; onPress: () => void; disabled?: boolean; ghost?: boolean; onFeatured?: boolean }) {
  const t = useTheme();
  // On the inverted "featured" surface, ghost buttons must use the featured ink
  // colour or they'd be invisible (e.g. white text on the white card).
  const ghostInk = onFeatured ? t.inkFeatured : t.text;
  const ghostBorder = onFeatured ? t.inkFeatured : t.strokeStrong;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: ghost ? "transparent" : t.accent,
        borderColor: ghostBorder,
        borderWidth: ghost ? 1 : 0,
        borderRadius: t.radiusSm,
        paddingVertical: 16,
        alignItems: "center",
        marginTop: 12,
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: ghost ? ghostInk : t.onAccent, fontWeight: "600", fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: t.text, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

/** Segmented control (single-select). */
export function Segmented<T extends string>({
  options, value, onChange,
}: { options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{
              flexGrow: 1,
              minWidth: 72,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 10,
              borderRadius: t.radiusSm,
              borderWidth: 1,
              borderColor: on ? t.accent : t.strokeStrong,
              backgroundColor: on ? t.accent : t.card,
            }}
          >
            <Text style={{ color: on ? t.onAccent : t.muted, fontSize: 13, fontWeight: "500" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Dot({ color }: { color: string }) {
  return <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />;
}

export function FieldLabel({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.muted, fontSize: 13, marginTop: 16, marginBottom: 6, fontWeight: "500" }}>{children}</Text>;
}
