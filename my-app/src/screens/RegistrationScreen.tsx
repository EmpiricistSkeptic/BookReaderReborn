import React, { useState, useRef, useEffect, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from "../navigation/types";

const { width } = Dimensions.get("window");

type Props = NativeStackScreenProps<
  RootStackParamList,
  "Register"
>;

interface RegisterForm {
  email: string;
  username: string;
  password: string;
}

export default function RegisterScreen({
  navigation,
}: Props) {
  const { signUp } = useAuth();

  const [formData, setFormData] = useState<RegisterForm>({
    email: "",
    username: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleChange = (
    field: keyof RegisterForm,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRegister = async () => {
    const { email, username, password } = formData;

    if (!email || !username || !password) {
      Alert.alert(
        "Missing information",
        "Please fill in all fields."
      );
      return;
    }

    setLoading(true);

    try {
      await signUp({
        email,
        username,
        password,
      });
    } catch (error) {
      Alert.alert(
        "Registration failed",
        error instanceof Error
          ? error.message
          : "Unknown error."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#1e3c72", "#2a5298"]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : "height"
        }
        style={styles.inner}
      >
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>📖</Text>
          </View>

          <Text style={styles.title}>
            Booklingo
          </Text>

          <Text style={styles.subtitle}>
            Create your account
          </Text>
        </Animated.View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="rgba(46,61,83,0.6)"
            keyboardType="email-address"
            autoCapitalize="none"
            value={formData.email}
            onChangeText={(text) =>
              handleChange("email", text)
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="rgba(46,61,83,0.6)"
            autoCapitalize="none"
            value={formData.username}
            onChangeText={(text) =>
              handleChange("username", text)
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="rgba(46,61,83,0.6)"
            secureTextEntry
            autoCapitalize="none"
            value={formData.password}
            onChangeText={(text) =>
              handleChange("password", text)
            }
          />

          <TouchableOpacity
            style={[
              styles.primaryButton,
              loading &&
                styles.disabledButton,
            ]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator
                color="#2a5298"
              />
            ) : (
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Register
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              navigation.navigate("Login")
            }
          >
            <Text
              style={
                styles.secondaryButtonText
              }
            >
              Already have an account? Login
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
  },

  inner: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  header: {
    alignItems: "center",
    marginBottom: 40,
  },

  logoCircle: {
    width: width * 0.3,
    height: width * 0.3,
    borderRadius: (width * 0.3) / 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  logoIcon: {
    fontSize: 48,
  },

  title: {
    fontSize: 36,
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 1,
  },

  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
    marginTop: 8,
  },

  form: {
    width: "100%",
  },

  input: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 15,
    fontSize: 16,
    color: "#2e3d53",

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },

  primaryButton: {
    backgroundColor: "#fff",
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },

  primaryButtonText: {
    color: "#2a5298",
    fontSize: 18,
    fontWeight: "600",
  },

  disabledButton: {
    opacity: 0.6,
  },

  secondaryButton: {
    marginTop: 20,
  },

  secondaryButtonText: {
    color: "#fff",
    fontSize: 14,
    textDecorationLine: "underline",
  },
});