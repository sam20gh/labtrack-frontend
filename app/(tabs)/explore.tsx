import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Card, Button as UIButton } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '@/constants/config';
import { useNavigation } from '@react-navigation/native'; // Import navigation


const SignupScreen = () => {
  const navigation = useNavigation();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    dob: new Date(),
    password: '',
    showDatePicker: false,
  });
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);

  const handleChange = (name, value) => {
    setForm({ ...form, [name]: value });
  };

  const handleDateConfirm = (selectedDate) => {
    setForm({ ...form, dob: selectedDate, showDatePicker: false });
  };

  const handleSignup = async () => {
    setLoading(true);
    setUserData(null);

    const userData = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      dob: form.dob.toISOString(),
      password: form.password,
    };

    console.log('Sending Data:', JSON.stringify(userData, null, 2)); // Log exact request data

    try {
      const response = await fetch(`${API_URL}/users/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      const data = await response.json();
      setLoading(false);
      console.log('Server Response:', data);

      if (response.ok) {
        Alert.alert('Success', 'User registered successfully!', [
          {
            text: 'Go to Profile',
            onPress: () => navigation.navigate('UserProfile', { user: data.user }), // Navigate to user profile
          },
        ]);
      } else {
        Alert.alert('Error', data.message || 'Something went wrong');
      }
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to connect to the server');
    }
  };



  return (
    <LinearGradient colors={['#0097b2', '#307313']} style={styles.container}>
      <View style={styles.innerContainer}>
        <Card style={styles.card}>
          {loading ? (
            <ActivityIndicator size="large" color="#307313" />
          ) : userData ? (
            <View>
              <Text style={styles.successText}>Thank you for signing up!</Text>
              <Text style={styles.userInfo}>Name: {userData.firstName} {userData.lastName}</Text>
              <Text style={styles.userInfo}>Username: {userData.username}</Text>
              <Text style={styles.userInfo}>Email: {userData.email}</Text>
              <Text style={styles.userInfo}>Phone: {userData.phone}</Text>
              <Text style={styles.userInfo}>DOB: {new Date(userData.dob).toDateString()}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Sign Up</Text>
              <TextInput placeholder="First Name" value={form.firstName} onChangeText={(text) => handleChange('firstName', text)} style={styles.input} />
              <TextInput placeholder="Last Name" value={form.lastName} onChangeText={(text) => handleChange('lastName', text)} style={styles.input} />
              <TextInput placeholder="Username" value={form.username} onChangeText={(text) => handleChange('username', text)} style={styles.input} />
              <TextInput placeholder="Email" value={form.email} keyboardType="email-address" onChangeText={(text) => handleChange('email', text)} style={styles.input} />
              <TextInput placeholder="Phone Number" value={form.phone} keyboardType="phone-pad" onChangeText={(text) => handleChange('phone', text)} style={styles.input} />
              <TextInput placeholder="Password" value={form.password} secureTextEntry onChangeText={(text) => handleChange('password', text)} style={styles.input} />

              <TouchableOpacity onPress={() => setForm({ ...form, showDatePicker: true })}>
                <Text style={styles.dateText}>{form.dob.toDateString()}</Text>
              </TouchableOpacity>

              <DateTimePickerModal
                isVisible={form.showDatePicker}
                mode="date"
                onConfirm={handleDateConfirm}
                onCancel={() => setForm({ ...form, showDatePicker: false })}
              />

              <UIButton mode="contained" style={styles.button} onPress={handleSignup}>
                Sign Up
              </UIButton>
            </>
          )}
        </Card>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: 'transparent' },
  innerContainer: { padding: 20, flex: 1, justifyContent: 'center' },
  card: { padding: 20, borderRadius: 10, backgroundColor: 'white', elevation: 3 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#333' },
  input: { marginBottom: 10, borderWidth: 1, padding: 12, borderRadius: 5, borderColor: '#ccc', backgroundColor: '#f9f9f9' },
  dateText: { padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 5, textAlign: 'center', backgroundColor: '#f9f9f9' },
  button: { marginTop: 20, paddingVertical: 10 },
  successText: { fontSize: 20, fontWeight: 'bold', color: 'green', textAlign: 'center', marginBottom: 10 },
  userInfo: { fontSize: 16, textAlign: 'center', color: '#333', marginBottom: 5 },
});

export default SignupScreen;
