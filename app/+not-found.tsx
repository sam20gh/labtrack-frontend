import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Text, Title, Paragraph } from 'react-native-paper';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <ThemedView style={styles.container}>
        <ThemedText type="title"><Text>This screen doesn't exist.</Text></ThemedText>
        <Link href="/" style={styles.link}>
          <ThemedText type="link"><Text>Go to home screen!</Text></ThemedText>
        </Link>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
