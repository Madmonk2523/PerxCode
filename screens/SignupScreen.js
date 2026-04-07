import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signup } from '../services/authService';

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSignup = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Enter your email and password to continue.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak password', 'Use at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await signup(email, password);
    } catch (err) {
      Alert.alert('Signup failed', normalizeError(err?.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.brand}>PERX</Text>
          <Text style={styles.tagline}>Create your account and start unlocking map zones.</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@perx.app"
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#70788C"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 6 characters"
              secureTextEntry
              placeholderTextColor="#70788C"
              onSubmitEditing={onSignup}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={onSignup}
              disabled={loading}
              activeOpacity={0.88}
            >
              <Text style={styles.buttonText}>{loading ? 'Creating account...' : 'Create Account'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.footer}>
            <Text style={styles.footerText}>
              Already have an account? <Text style={styles.footerLink}>Login</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function normalizeError(code) {
  if (code === 'auth/email-already-in-use') return 'This email is already registered.';
  if (code === 'auth/invalid-email') return 'Please enter a valid email.';
  if (code === 'auth/network-request-failed') return 'Network issue. Check your connection.';
  return 'Something went wrong. Please try again.';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B0B0F' },
  flex: { flex: 1 },
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 22,
  },
  brand: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  tagline: {
    color: '#B6BCC8',
    marginTop: 8,
    marginBottom: 22,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#12131A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  label: {
    color: '#D1D5DB',
    fontSize: 13,
    marginBottom: 6,
    marginTop: 10,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    backgroundColor: '#0F1118',
  },
  button: {
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  footer: { marginTop: 16, alignItems: 'center' },
  footerText: { color: '#9CA3AF' },
  footerLink: { color: '#7C3AED', fontWeight: '700' },
});
