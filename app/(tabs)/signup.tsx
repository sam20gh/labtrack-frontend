import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Card, Button as UIButton } from 'react-native-paper';
import { API_URL } from '@/constants/config';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const RegisterScreen = () => {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    dob: '',
    password: '',
    showDatePicker: false,
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (name, value) => {
    setForm({ ...form, [name]: value });
  };

  const handleDateConfirm = (selectedDate) => {
    const formattedDate = selectedDate.toISOString().split('T')[0]; // Format to YYYY-MM-DD
    setForm({ ...form, dob: formattedDate, showDatePicker: false });
  };

  const handleSignup = async () => {
    setLoading(true);
    console.log("Attempting user signup with data:", form);

    const userData = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      dob: form.dob, // Already formatted
      password: form.password,
    };

    try {
      const response = await fetch(`${API_URL}/users/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      console.log("Server Response Status:", response.status);
      const data = await response.json();
      console.log("Server Response Data:", data);

      setLoading(false);

      if (response.ok && data.user && data.user._id) {
        try {
          await AsyncStorage.setItem('userId', data.user._id);
          await AsyncStorage.setItem('authToken', data.token || '');
          console.log("User saved to AsyncStorage");
        } catch (storageError) {
          console.error("Error saving to AsyncStorage:", storageError);
          Alert.alert('Error', 'Failed to save login data');
          return;
        }

        console.log("Navigating to /users...");
        Alert.alert('Success', 'User registered successfully!');
        router.replace('/users');
      } else {
        Alert.alert('Error', data.message || 'Something went wrong');
      }
    } catch (error) {
      setLoading(false);
      console.error("Signup Error:", error);
      Alert.alert('Error', 'Failed to connect to the server');
    }
  };

  return (
    <View style={styles.innerContainer}>
      <Card style={styles.card}>
        <Text style={styles.title}>Register</Text>

        <View style={styles.inputContainer}>
          <Icon name="account" size={20} color="#FF385C" style={styles.icon} />
          <TextInput placeholder="First Name *" value={form.firstName} onChangeText={(text) => handleChange('firstName', text)} style={styles.input} autoCapitalize="words" />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="account" size={20} color="#FF385C" style={styles.icon} />
          <TextInput placeholder="Last Name *" value={form.lastName} onChangeText={(text) => handleChange('lastName', text)} style={styles.input} autoCapitalize="words" />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="account-circle" size={20} color="#FF385C" style={styles.icon} />
          <TextInput placeholder="Username *" value={form.username} onChangeText={(text) => handleChange('username', text)} style={styles.input} autoCapitalize="none" />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="email" size={20} color="#FF385C" style={styles.icon} />
          <TextInput placeholder="Email *" value={form.email} keyboardType="email-address" onChangeText={(text) => handleChange('email', text)} style={styles.input} autoCapitalize="none" />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="phone" size={20} color="#FF385C" style={styles.icon} />
          <TextInput placeholder="Phone *" value={form.phone} keyboardType="phone-pad" onChangeText={(text) => handleChange('phone', text)} style={styles.input} autoCapitalize="none" />
        </View>

        <View style={styles.inputContainer}>
          <Icon name="lock" size={20} color="#FF385C" style={styles.icon} />
          <TextInput placeholder="Password *" value={form.password} secureTextEntry onChangeText={(text) => handleChange('password', text)} style={styles.input} autoCapitalize="none" />
        </View>

        <Text style={styles.label}>Date of Birth</Text>
        <TouchableOpacity onPress={() => setForm({ ...form, showDatePicker: true })}>
          <Text style={styles.dateText}>{form.dob || 'Select Date'}</Text>
        </TouchableOpacity>
        <DateTimePickerModal
          isVisible={form.showDatePicker}
          mode="date"
          onConfirm={handleDateConfirm}
          onCancel={() => setForm({ ...form, showDatePicker: false })}
        />

        <UIButton mode="contained" style={styles.button} onPress={handleSignup}>
          <Text>Sign Up</Text>
        </UIButton>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  innerContainer: { padding: 20, flex: 1, justifyContent: 'center', backgroundColor: '#fff' },
  card: { padding: 20, borderRadius: 10, backgroundColor: 'white', elevation: 3 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#333' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 5, paddingHorizontal: 10, backgroundColor: '#f9f9f9', marginBottom: 5 },
  input: { flex: 1, paddingVertical: 12 },
  icon: { marginRight: 10 },
  dateText: { padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, textAlign: 'center', backgroundColor: '#f9f9f9', marginBottom: 15 },
  button: { marginTop: 20, paddingVertical: 10, backgroundColor: '#FF385C' },
});

export default RegisterScreen;
