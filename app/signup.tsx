import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';

import { API_BASE_URL, Role } from '@/lib/api';
import { LogBox } from 'react-native';

if (!__DEV__) {
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.log('Global error caught:', error);
  });
}

LogBox.ignoreAllLogs(true);


const roleOptions: { key: Role; label: string; icon: string }[] = [
  { key: 'trader', label: 'Trader', icon: 'store' },
  { key: 'driver', label: 'Driver', icon: 'local-shipping' },
  { key: 'sme', label: 'SME', icon: 'business' },
];

type FormState = Record<string, string>;

export default function SignupScreen() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'error' | 'success' | null>(null);
  const [errors, setErrors] = useState<any>({});

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const requiredFields = useMemo(
    () => ['name', 'email', 'password', 'phone'],
    []
  );


  const handleSignup = async () => {
  setMessage(null);
  setErrors({});
  setMessageType(null);

  if (!role) {
    setMessage("Please choose a role.");
    setMessageType("error");
    return;
  }

  setLoading(true);

  try {
    const payload = {
      role,
      name: form.name,
      phone: form.phone,
      email: form.email,
      password: form.password,
      city: form.city ?? "",
      cnic: form.cnic ?? "",
      truckType: form.truckType ?? "",
      truckReg: form.truckReg ?? "",
      capacity: form.capacity ?? "",
      goodsType: form.goodsType ?? "",
      businessName: form.businessName ?? "",
      businessType: form.businessType ?? "",
      ntn: form.ntn ?? "",
      ownerName: form.ownerName ?? "",
      businessEmail: form.businessEmail ?? "",
      address: form.address ?? "",
    };

    const response = await fetch(`http://13.233.124.213:8000/api/register/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    let data;
    try {
      data = await response.json();
    } catch (parseError: unknown) {
      // Response was not JSON – possibly a server error page
      console.error("Failed to parse JSON response:", parseError);
      setMessage("Server error. Please try again later.");
      setMessageType("error");
      return;
    }

    if (!response.ok) {
      // Show field errors if any
      if (data.errors) {
        setErrors(data.errors);
      }
      setMessage(data.message || "Please fix the errors below.");
      setMessageType("error");
      return;
    }

    // Success
    setMessage("Account created successfully!");
    setMessageType("success");
    setTimeout(() => {
      router.replace("/login");
    }, 2000);

  } catch (error: any) {
    // Network error or other unexpected error
    console.error("Network or unexpected error:", error);
    setMessage(error.message || "Network error. Please try again.");
    setMessageType("error");
  } finally {
    setLoading(false);
  }
};

  // Role press animation
  const handleRolePress = (selectedRole: Role) => {
    setRole(selectedRole);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  // Button press animation
  const handleButtonPressIn = () => {
    Animated.spring(buttonScale, { toValue: 0.97, friction: 5, useNativeDriver: true }).start();
  };
  const handleButtonPressOut = () => {
    Animated.spring(buttonScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  };

  // Dynamic field fade-in when role changes
  useEffect(() => {
    if (role) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [role]);

  return (
    <LinearGradient colors={['#0a0f1e', '#141b2b']} style={styles.background}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}>
            {/* Header */}
            <LinearGradient
              colors={['#1e2a47', '#0f1a2f']}
              style={styles.headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}>
              <View style={styles.headerOverlay} />
              <View style={styles.headerContent}>
                <Text style={styles.welcomeText}>Welcome to</Text>
                <Text style={styles.appName}>LoadFlow</Text>
                <Text style={styles.subtitle}>Your journey begins here</Text>
              </View>
              <View style={styles.iconGlow}>
                <Icon name="local-shipping" size={90} color="#e94560" />
              </View>
            </LinearGradient>

            {/* Form */}
            <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>
              <Text style={styles.label}>I am a</Text>
              <View style={styles.roleContainer}>
                {roleOptions.map((option) => {
                  const isActive = role === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[styles.roleCard, isActive && styles.activeRole]}
                      onPress={() => handleRolePress(option.key)}
                      activeOpacity={0.8}>
                      <Animated.View style={{ transform: [{ scale: isActive ? scaleAnim : 1 }] }}>
                        <Icon
                          name={option.icon}
                          size={36}
                          color={isActive ? '#fff' : '#a0a0a0'}
                        />
                        <Text style={[styles.roleText, isActive && styles.activeRoleText]}>
                          {option.label}
                        </Text>
                      </Animated.View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Inputs */}
              <View style={styles.inputsWrapper}>
                {/* Common fields */}
                <Animated.View style={{ transform: [{ scale: focusedInput === 'name' ? 1.02 : 1 }] }}>
                  <View style={[styles.inputGroup, focusedInput === 'name' && styles.inputFocused]}>
                    <View style={styles.iconBg}>
                      <Icon name="person" size={20} color="#e94560" />
                    </View>
                    <TextInput
                      placeholder="Full Name"
                      placeholderTextColor="#6b7280"
                      style={styles.input}
                      value={form.name ?? ''}
                      onChangeText={(v) => updateField('name', v)}
                      onFocus={() => setFocusedInput('name')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                </Animated.View>

                <Animated.View style={{ transform: [{ scale: focusedInput === 'phone' ? 1.02 : 1 }] }}>
                  <View style={[styles.inputGroup, focusedInput === 'phone' && styles.inputFocused]}>
                    <View style={styles.iconBg}>
                      <Icon name="phone" size={20} color="#e94560" />
                    </View>
                    <TextInput
                      placeholder="Phone Number"
                      placeholderTextColor="#6b7280"
                      style={styles.input}
                      keyboardType="phone-pad"
                      value={form.phone ?? ''}
                      onChangeText={(v) => updateField('phone', v)}
                      onFocus={() => setFocusedInput('phone')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                </Animated.View>

                <Animated.View style={{ transform: [{ scale: focusedInput === 'city' ? 1.02 : 1 }] }}>
                  <View style={[styles.inputGroup, focusedInput === 'city' && styles.inputFocused]}>
                    <View style={styles.iconBg}>
                      <Icon name="location-city" size={20} color="#e94560" />
                    </View>
                    <TextInput
                      placeholder="City"
                      placeholderTextColor="#6b7280"
                      style={styles.input}
                      value={form.city ?? ''}
                      onChangeText={(v) => updateField('city', v)}
                      onFocus={() => setFocusedInput('city')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                </Animated.View>

                <Animated.View style={{ transform: [{ scale: focusedInput === 'email' ? 1.02 : 1 }] }}>
                  <View style={[styles.inputGroup, focusedInput === 'email' && styles.inputFocused]}>
                    <View style={styles.iconBg}>
                      <Icon name="email" size={20} color="#e94560" />
                    </View>
                    <TextInput
                      placeholder="Email"
                      placeholderTextColor="#6b7280"
                      style={styles.input}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={form.email ?? ''}
                      onChangeText={(v) => updateField('email', v)}
                      onFocus={() => setFocusedInput('email')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                </Animated.View>

                <Animated.View style={{ transform: [{ scale: focusedInput === 'password' ? 1.02 : 1 }] }}>
                  <View style={[styles.inputGroup, focusedInput === 'password' && styles.inputFocused]}>
                    <View style={styles.iconBg}>
                      <Icon name="lock" size={20} color="#e94560" />
                    </View>
                    <TextInput
                      placeholder="Password"
                      placeholderTextColor="#6b7280"
                      secureTextEntry
                      style={styles.input}
                      value={form.password ?? ''}
                      onChangeText={(v) => updateField('password', v)}
                      onFocus={() => setFocusedInput('password')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                </Animated.View>

                {/* Role-specific fields with fade-in */}
                {role === 'trader' && (
                  <Animated.View style={{ opacity: fadeAnim }}>
                    <View style={[styles.inputGroup, focusedInput === 'goodsType' && styles.inputFocused]}>
                      <View style={styles.iconBg}>
                        <Icon name="inventory-2" size={20} color="#e94560" />
                      </View>
                      <TextInput
                        placeholder="Goods Type"
                        placeholderTextColor="#6b7280"
                        style={styles.input}
                        value={form.goodsType ?? ''}
                        onChangeText={(v) => updateField('goodsType', v)}
                        onFocus={() => setFocusedInput('goodsType')}
                        onBlur={() => setFocusedInput(null)}
                      />
                    </View>
                  </Animated.View>
                )}

                {role === 'driver' && (
                  <Animated.View style={{ opacity: fadeAnim }}>
                    <View style={[styles.inputGroup, focusedInput === 'cnic' && styles.inputFocused]}>
                      <View style={styles.iconBg}>
                        <Icon name="badge" size={20} color="#e94560" />
                      </View>
                      <TextInput
                        placeholder="CNIC"
                        placeholderTextColor="#6b7280"
                        style={styles.input}
                        value={form.cnic ?? ''}
                        onChangeText={(v) => updateField('cnic', v)}
                        onFocus={() => setFocusedInput('cnic')}
                        onBlur={() => setFocusedInput(null)}
                      />
                    </View>
                    <View style={[styles.inputGroup, focusedInput === 'truckType' && styles.inputFocused]}>
                      <View style={styles.iconBg}>
                        <Icon name="local-shipping" size={20} color="#e94560" />
                      </View>
                      <TextInput
                        placeholder="Truck Type (Shehzore/Mazda/10-wheeler)"
                        placeholderTextColor="#6b7280"
                        style={styles.input}
                        value={form.truckType ?? ''}
                        onChangeText={(v) => updateField('truckType', v)}
                        onFocus={() => setFocusedInput('truckType')}
                        onBlur={() => setFocusedInput(null)}
                      />
                    </View>
                    <View style={[styles.inputGroup, focusedInput === 'truckReg' && styles.inputFocused]}>
                      <View style={styles.iconBg}>
                        <Icon name="numbers" size={20} color="#e94560" />
                      </View>
                      <TextInput
                        placeholder="Truck Registration No"
                        placeholderTextColor="#6b7280"
                        style={styles.input}
                        value={form.truckReg ?? ''}
                        onChangeText={(v) => updateField('truckReg', v)}
                        onFocus={() => setFocusedInput('truckReg')}
                        onBlur={() => setFocusedInput(null)}
                      />
                    </View>
                    <View style={[styles.inputGroup, focusedInput === 'capacity' && styles.inputFocused]}>
                      <View style={styles.iconBg}>
                        <Icon name="scale" size={20} color="#e94560" />
                      </View>
                      <TextInput
                        placeholder="Total Load Capacity"
                        placeholderTextColor="#6b7280"
                        style={styles.input}
                        value={form.capacity ?? ''}
                        onChangeText={(v) => updateField('capacity', v)}
                        onFocus={() => setFocusedInput('capacity')}
                        onBlur={() => setFocusedInput(null)}
                      />
                    </View>
                  </Animated.View>
                )}

                {role === 'sme' && (
                  <Animated.View style={{ opacity: fadeAnim }}>
                    <View style={[styles.inputGroup, focusedInput === 'businessName' && styles.inputFocused]}>
                      <View style={styles.iconBg}>
                        <Icon name="business" size={20} color="#e94560" />
                      </View>
                      <TextInput
                        placeholder="Business Name"
                        placeholderTextColor="#6b7280"
                        style={styles.input}
                        value={form.businessName ?? ''}
                        onChangeText={(v) => updateField('businessName', v)}
                        onFocus={() => setFocusedInput('businessName')}
                        onBlur={() => setFocusedInput(null)}
                      />
                    </View>
                    <View style={[styles.inputGroup, focusedInput === 'businessType' && styles.inputFocused]}>
                      <View style={styles.iconBg}>
                        <Icon name="category" size={20} color="#e94560" />
                      </View>
                      <TextInput
                        placeholder="Business Type"
                        placeholderTextColor="#6b7280"
                        style={styles.input}
                        value={form.businessType ?? ''}
                        onChangeText={(v) => updateField('businessType', v)}
                        onFocus={() => setFocusedInput('businessType')}
                        onBlur={() => setFocusedInput(null)}
                      />
                    </View>
                    <View style={[styles.inputGroup, focusedInput === 'ntn' && styles.inputFocused]}>
                      <View style={styles.iconBg}>
                        <Icon name="description" size={20} color="#e94560" />
                      </View>
                      <TextInput
                        placeholder="NTN (Optional)"
                        placeholderTextColor="#6b7280"
                        style={styles.input}
                        value={form.ntn ?? ''}
                        onChangeText={(v) => updateField('ntn', v)}
                        onFocus={() => setFocusedInput('ntn')}
                        onBlur={() => setFocusedInput(null)}
                      />
                    </View>
                    <View style={[styles.inputGroup, focusedInput === 'ownerName' && styles.inputFocused]}>
                      <View style={styles.iconBg}>
                        <Icon name="person" size={20} color="#e94560" />
                      </View>
                      <TextInput
                        placeholder="Owner Name"
                        placeholderTextColor="#6b7280"
                        style={styles.input}
                        value={form.ownerName ?? ''}
                        onChangeText={(v) => updateField('ownerName', v)}
                        onFocus={() => setFocusedInput('ownerName')}
                        onBlur={() => setFocusedInput(null)}
                      />
                    </View>
                    <View style={[styles.inputGroup, focusedInput === 'businessEmail' && styles.inputFocused]}>
                      <View style={styles.iconBg}>
                        <Icon name="alternate-email" size={20} color="#e94560" />
                      </View>
                      <TextInput
                        placeholder="Business Email"
                        placeholderTextColor="#6b7280"
                        style={styles.input}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={form.businessEmail ?? ''}
                        onChangeText={(v) => updateField('businessEmail', v)}
                        onFocus={() => setFocusedInput('businessEmail')}
                        onBlur={() => setFocusedInput(null)}
                      />
                    </View>
                    <View style={[styles.inputGroup, focusedInput === 'address' && styles.inputFocused]}>
                      <View style={styles.iconBg}>
                        <Icon name="location-on" size={20} color="#e94560" />
                      </View>
                      <TextInput
                        placeholder="Business Address"
                        placeholderTextColor="#6b7280"
                        style={styles.input}
                        value={form.address ?? ''}
                        onChangeText={(v) => updateField('address', v)}
                        onFocus={() => setFocusedInput('address')}
                        onBlur={() => setFocusedInput(null)}
                      />
                    </View>
                  </Animated.View>
                )}
              </View>

              {/* Message */}
              {message && (
                <View style={[styles.messageCard, messageType === 'error' ? styles.errorCard : styles.successCard]}>
                  <Icon
                    name={messageType === 'error' ? 'error' : 'check-circle'}
                    size={20}
                    color={messageType === 'error' ? '#ff8b8b' : '#9ae6b4'}
                  />
                  <Text style={[styles.messageText, messageType === 'error' ? styles.errorText : styles.successText]}>
                    {message}
                  </Text>
                </View>
              )}

              {/* Register Button */}
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={handleSignup}
                  onPressIn={handleButtonPressIn}
                  onPressOut={handleButtonPressOut}
                  disabled={loading}>
                  <LinearGradient
                    colors={['#e94560', '#b81d3c']}
                    style={styles.registerButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}>
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.registerButtonText}>Create Account</Text>
                        <Icon name="arrow-forward" size={20} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {/* Switch to Login */}
              <TouchableOpacity style={styles.switchAuth} onPress={() => router.replace('/login')}>
                <Text style={styles.switchAuthText}>Already have an account? Log in</Text>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  headerGradient: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  headerContent: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 16,
    color: '#cbd5e0',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
    textShadowColor: 'rgba(233,69,96,0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#a0aec0',
  },
  iconGlow: {
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
    textShadowColor: '#e94560',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 30,
  },
  label: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.8,
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  roleCard: {
    backgroundColor: '#1e2a3a',
    flex: 1,
    paddingVertical: 20,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3b4f',
    marginHorizontal: 6,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  activeRole: {
    backgroundColor: '#e94560',
    borderColor: '#ff7b9c',
    shadowColor: '#e94560',
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  roleText: {
    color: '#a0aec0',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  activeRoleText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  inputsWrapper: {
    marginBottom: 10,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e2a3a',
    borderRadius: 20,
    marginBottom: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#2d3b4f',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  inputFocused: {
    borderColor: '#e94560',
    shadowColor: '#e94560',
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  iconBg: {
    backgroundColor: '#2d3b4f',
    borderRadius: 12,
    padding: 8,
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 16,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 30,
    marginTop: 20,
    elevation: 8,
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e2a3a',
    borderRadius: 16,
    padding: 12,
    marginVertical: 10,
    borderWidth: 1,
  },
  errorCard: {
    borderColor: '#ff8b8b',
    backgroundColor: '#2a1f2a',
  },
  successCard: {
    borderColor: '#9ae6b4',
    backgroundColor: '#1f2a23',
  },
  messageText: {
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  errorText: {
    color: '#ff8b8b',
  },
  successText: {
    color: '#9ae6b4',
  },
  switchAuth: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchAuthText: {
    color: '#e94560',
    fontWeight: '600',
    fontSize: 16,
  },
});
