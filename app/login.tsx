import React, { useState, useRef, useEffect } from 'react';
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
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';

import { API_BASE_URL, Role } from '@/lib/api';

export default function LoginScreen() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'error' | 'success' | null>(null);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<boolean>(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const navigateByRole = (userRole: string) => {
    console.log('Navigating based on role:', userRole);
    
    switch (userRole.toLowerCase()) {
      case 'trader':
        router.replace('/traderdashboard');
        break;
      case 'sme':
        router.replace('/smedashboard');
        break;
      case 'driver':
        router.replace('/driverdashboard');
        break;
      default:
        console.warn('Unknown role:', userRole);
        setMessage(`Unknown user role: ${userRole}`);
        setMessageType('error');
    }
  };

  const storeUserData = async (user: any) => {
    try {
      await SecureStore.setItemAsync('userData', JSON.stringify(user));
      await SecureStore.setItemAsync('userToken', user.token || 'logged_in');
      console.log('User data stored successfully');
    } catch (error) {
      console.error('Error storing user data:', error);
      // Don't throw error - continue with navigation even if storage fails
    }
  };

  const handleLogin = async () => {
    setMessage(null);
    setMessageType(null);
    setNetworkError(false);

    // Validate inputs
    if (!email || !password) {
      setMessage('Email and password are required.');
      setMessageType('error');
      return;
    }

    // Check email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage('Please enter a valid email address.');
      setMessageType('error');
      return;
    }

    // Check network connectivity first
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        setMessage('No internet connection. Please check your network settings and try again.');
        setMessageType('error');
        setNetworkError(true);
        return;
      }
    } catch (error) {
      console.error('Network check error:', error);
    }

    setLoading(true);
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      console.log('Attempting login with:', { email, password: '***' });
      
      // Send login request to the specified endpoint
      const response = await fetch(`${API_BASE_URL}/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        throw new Error('Invalid server response format');
      }

      if (!response.ok) {
        // Handle different HTTP status codes
        switch (response.status) {
          case 400:
            throw new Error(result.message || 'Invalid email or password format');
          case 401:
            throw new Error('Invalid email or password');
          case 403:
            throw new Error('Account access denied');
          case 404:
            throw new Error('Login service not found');
          case 500:
            throw new Error('Server error. Please try again later');
          default:
            throw new Error(result.message || `Login failed (${response.status})`);
        }
      }

      console.log('Login response:', result);
      
      // Check if user data exists in response
      if (!result.user) {
        throw new Error('No user data received from server');
      }

      const userRole = result.user.role;
      console.log('User role:', userRole);

      // Store user data (with error handling)
      try {
        await storeUserData(result.user);
      } catch (storageError) {
        console.warn('Storage failed but login successful:', storageError);
        // Continue with navigation even if storage fails
      }

      setMessage('Logged in successfully!');
      setMessageType('success');
      
      // Navigate based on role after a short delay to show success message
      setTimeout(() => {
        navigateByRole(userRole);
      }, 1000);
      
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      console.error('Login error:', error);
      
      // Handle different types of errors
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.name === 'AbortError') {
        errorMessage = 'Request timeout. Please check your internet connection and try again.';
        setNetworkError(true);
      } else if (error.message === 'Network request failed') {
        errorMessage = 'Cannot connect to server. Please check your internet connection and ensure the server is accessible.';
        setNetworkError(true);
      } else if (error.message.includes('JSON')) {
        errorMessage = 'Server returned an invalid response. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Check for specific network errors
      if (error.message.includes('fetch') || error.message.includes('network')) {
        setNetworkError(true);
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      setMessage(errorMessage);
      setMessageType('error');
      
    } finally {
      setLoading(false);
    }
  };

  // Button press animation
  const handleButtonPressIn = () => {
    Animated.spring(buttonScale, { toValue: 0.97, friction: 5, useNativeDriver: true }).start();
  };
  const handleButtonPressOut = () => {
    Animated.spring(buttonScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  };

  const retryLogin = () => {
    handleLogin();
  };

  return (
    <LinearGradient colors={['#0a0f1e', '#141b2b']} style={styles.background}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* Header */}
            <LinearGradient
              colors={['#1e2a47', '#0f1a2f']}
              style={styles.headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}>
              <View style={styles.headerOverlay} />
              <View style={styles.headerContent}>
                <Text style={styles.welcomeText}>Welcome back</Text>
                <Text style={styles.appName}>LoadFlow</Text>
                <Text style={styles.subtitle}>Sign in to continue</Text>
              </View>
              <View style={styles.iconGlow}>
                <Icon name="lock" size={90} color="#e94560" />
              </View>
            </LinearGradient>

            {/* Form */}
            <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>
              {/* Hidden role selector (kept as per original) */}
              <View style={{ display: 'none' }}>
                <Text style={styles.label}>Login as</Text>
                <View style={styles.roleContainer}>
                  {(['trader', 'driver', 'sme'] as Role[]).map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[styles.roleCard, role === item && styles.activeRole]}
                      onPress={() => setRole(item)}
                      activeOpacity={0.7}>
                      <Icon
                        name={item === 'driver' ? 'local-shipping' : item === 'sme' ? 'business' : 'store'}
                        size={30}
                        color={role === item ? '#fff' : '#aaa'}
                      />
                      <Text style={[styles.roleText, role === item && styles.activeRoleText]}>
                        {item === 'sme' ? 'SME' : item.charAt(0).toUpperCase() + item.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Network Status Indicator */}
              {networkError && (
                <View style={styles.networkWarning}>
                  <Icon name="signal-wifi-off" size={20} color="#ff8b8b" />
                  <Text style={styles.networkWarningText}>
                    Poor or no internet connection
                  </Text>
                </View>
              )}

              {/* Email Input */}
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
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocusedInput('email')}
                    onBlur={() => setFocusedInput(null)}
                    editable={!loading}
                  />
                </View>
              </Animated.View>

              {/* Password Input */}
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
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocusedInput('password')}
                    onBlur={() => setFocusedInput(null)}
                    editable={!loading}
                  />
                </View>
              </Animated.View>

              {/* Message */}
              {message && (
                <View style={[styles.messageCard, messageType === 'error' ? styles.errorCard : styles.successCard]}>
                  <Icon
                    name={messageType === 'error' ? 'error-outline' : 'check-circle'}
                    size={20}
                    color={messageType === 'error' ? '#ff8b8b' : '#9ae6b4'}
                  />
                  <Text style={[styles.messageText, messageType === 'error' ? styles.errorText : styles.successText]}>
                    {message}
                  </Text>
                </View>
              )}

              {/* Login Button */}
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={retryLogin}
                  onPressIn={handleButtonPressIn}
                  onPressOut={handleButtonPressOut}
                  disabled={loading}>
                  <LinearGradient
                    colors={networkError ? ['#6b7280', '#4a5568'] : ['#e94560', '#b81d3c']}
                    style={styles.loginButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}>
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.loginButtonText}>
                          {networkError ? 'Retry' : 'Log In'}
                        </Text>
                        <Icon name={networkError ? "refresh" : "arrow-forward"} size={20} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {/* Switch to Signup */}
              <TouchableOpacity style={styles.switchAuth} onPress={() => router.replace('/signup')}>
                <Text style={styles.switchAuthText}>New here? Create an account</Text>
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
  // Hidden role styles (kept original)
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
    marginBottom: 24,
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
  // Input styles
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
  loginButton: {
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
  loginButtonText: {
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
  networkWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 139, 139, 0.1)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ff8b8b',
  },
  networkWarningText: {
    color: '#ff8b8b',
    marginLeft: 8,
    fontSize: 12,
    flex: 1,
  },
});
