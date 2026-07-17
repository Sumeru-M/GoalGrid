import { Component, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

/**
 * Last-resort guard (RN port of the web ErrorBoundary). A render-time exception
 * anywhere in the tree would otherwise crash to a blank screen; here we catch it
 * and offer a retry that resets the boundary.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[ui] render error", error);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>⚠️</Text>
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 17, marginBottom: 6 }}>Something broke</Text>
          <Text style={{ color: "#9a9a9a", textAlign: "center", marginBottom: 20 }}>{this.state.error.message}</Text>
          <Pressable
            onPress={() => this.setState({ error: null })}
            style={{ backgroundColor: "#fff", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 }}
          >
            <Text style={{ color: "#000", fontWeight: "600" }}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
