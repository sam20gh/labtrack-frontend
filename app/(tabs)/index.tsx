import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity, Dimensions, Image } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator, Button, Chip, Surface } from 'react-native-paper';
import { api, ApiError } from '@/lib/api';
import { getUserId, isSignedIn } from '@/lib/auth';
// @ts-ignore - types not available but package works at runtime
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Icon>['name'];
import { useFocusEffect } from '@react-navigation/native';
import Markdown from 'react-native-markdown-display';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const calculateBMI = (weight: number, heightCm: number) => {
  if (!weight || !heightCm) return 'N/A';
  const heightM = heightCm / 100;
  return (weight / (heightM * heightM)).toFixed(1);
};

const getBMIStatus = (bmi: string): { color: string; status: string; icon: IconName } => {
  const bmiValue = parseFloat(bmi);
  if (isNaN(bmiValue)) return { color: '#94A3B8', status: 'Unknown', icon: 'help-circle' };
  if (bmiValue < 18.5) return { color: '#FBBF24', status: 'Underweight', icon: 'alert-circle' };
  if (bmiValue < 25) return { color: '#10B981', status: 'Healthy', icon: 'check-circle' };
  if (bmiValue < 30) return { color: '#F97316', status: 'Overweight', icon: 'alert' };
  return { color: '#EF4444', status: 'Obese', icon: 'alert-octagon' };
};

const getHealthScore = (bmi: string, hasRecentTest: boolean): number => {
  let score = 50;
  const bmiValue = parseFloat(bmi);
  if (!isNaN(bmiValue)) {
    if (bmiValue >= 18.5 && bmiValue < 25) score += 30;
    else if (bmiValue >= 25 && bmiValue < 30) score += 15;
    else score += 5;
  }
  if (hasRecentTest) score += 20;
  return Math.min(score, 100);
};

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  type?: string;
}

const HomeScreen = ({ navigation }: any) => {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [latestTest, setLatestTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deepSeekFeedback, setDeepSeekFeedback] = useState<string>('');
  const [loadingFeedback, setLoadingFeedback] = useState<boolean>(false);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      const checkAuthAndFetchData = async () => {
        const userId = await getUserId();
        const loggedIn = await isSignedIn();
        setIsLoggedIn(loggedIn);

        if (loggedIn && userId) {
          fetchUserData(userId);
          fetchLatestTestResult(userId);
        } else {
          setLoading(false);
        }

        // Always attempt products; signed-out visitors simply get none
        fetchFeaturedProducts(loggedIn);
      };

      const fetchUserData = async (userId: string) => {
        try {
          setUserData(await api.get(`/users/${userId}`));
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      };

      const fetchLatestTestResult = async (userId: string) => {
        try {
          // API returns a date-descending array (empty when there is no history)
          const data = await api.get(`/test-results?user_id=${userId}`);
          setLatestTest(Array.isArray(data) ? (data[0] ?? null) : null);
        } catch (error) {
          console.error('Error fetching latest test result:', error);
        } finally {
          setLoading(false);
        }
      };

      const fetchFeaturedProducts = async (loggedIn: boolean) => {
        if (!loggedIn) {
          setFeaturedProducts([]);
          setLoadingProducts(false);
          return;
        }
        try {
          const data = await api.get('/products');
          setFeaturedProducts(Array.isArray(data) ? data.slice(0, 5) : []);
        } catch (error) {
          console.error('Error fetching products:', error);
        } finally {
          setLoadingProducts(false);
        }
      };

      checkAuthAndFetchData();
    }, [])
  );

  const userFirstName = userData?.firstName ?? 'User';
  const userAge = userData?.dob
    ? Math.max(0, new Date().getFullYear() - new Date(userData.dob).getFullYear())
    : null;
  const userHeight = userData?.height ? (userData.height / 100).toFixed(2) : null;
  const userWeight = userData?.weight ?? null;
  const userBMI = calculateBMI(userWeight, userData?.height);
  const bmiStatus = getBMIStatus(userBMI);
  const healthScore = getHealthScore(userBMI, !!latestTest);

  /**
   * Generate an interpretation and rebuild the plan from it.
   *
   * Replaces the old DeepSeek call, which produced prose that a keyword parser scanned for
   * exact phrases — anything worded differently was silently discarded. `/api/deepseek` now
   * returns 410.
   */
  const handleGenerateInterpretation = async () => {
    setLoadingFeedback(true);
    try {
      if (!latestTest?._id) {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Add a test result first.' });
        return;
      }

      const result = await api.post('/interpretation/generate', { testResultId: latestTest._id });
      setDeepSeekFeedback(result.interpretation?.summary ?? '');

      const created = result.plan?.created ?? 0;
      Toast.show({
        type: 'success',
        text1: created ? `${created} plan items created` : 'Interpretation ready',
        text2: result.cached ? 'Showing your existing interpretation' : 'Review it in My Plans',
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not generate an interpretation';
      console.error('Error generating interpretation:', error);
      setDeepSeekFeedback('');
      Toast.show({ type: 'error', text1: 'Error', text2: message });
    } finally {
      setLoadingFeedback(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero Section with Gradient */}
      <LinearGradient
        colors={['#FF385C', '#FF6B6B', '#FF8E8E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroSection}
      >
        <View style={styles.heroContent}>
          <View style={styles.heroTextContainer}>
            <Text style={styles.heroGreeting}>
              {isLoggedIn ? `Hello, ${userFirstName} 👋` : 'Welcome to LabTrack 🧬'}
            </Text>
            <Text style={styles.heroSubtitle}>
              {isLoggedIn ? "Let's check your health today" : 'Your AI-powered health companion'}
            </Text>
          </View>
          {isLoggedIn && (
            <View style={styles.healthScoreContainer}>
              <View style={styles.healthScoreCircle}>
                <Text style={styles.healthScoreValue}>{healthScore}</Text>
                <Text style={styles.healthScoreLabel}>Score</Text>
              </View>
            </View>
          )}
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator animating={true} size="large" style={styles.loader} color="#FF385C" />
      ) : (
        <>
          {/* Login CTA for non-logged-in users */}
          {!isLoggedIn && (
            <Surface style={styles.loginCTACard}>
              <View style={styles.loginCTAContent}>
                <View style={styles.loginCTAIconContainer}>
                  <Icon name="account-heart" size={32} color="#FF385C" />
                </View>
                <View style={styles.loginCTATextContainer}>
                  <Text style={styles.loginCTATitle}>Unlock Your Health Journey</Text>
                  <Text style={styles.loginCTASubtitle}>
                    Sign in to get personalized health plans, AI-powered insights, and track your biomarkers over time.
                  </Text>
                </View>
              </View>
              <View style={styles.loginCTAButtons}>
                <Button
                  mode="contained"
                  style={styles.loginButton}
                  labelStyle={{ fontWeight: '600' }}
                  onPress={() => router.push('/(auth)/loginscreen')}
                >
                  Sign In
                </Button>
                <Button
                  mode="outlined"
                  style={styles.signupButton}
                  labelStyle={{ color: '#FF385C', fontWeight: '600' }}
                  onPress={() => router.push('/signup')}
                >
                  Create Account
                </Button>
              </View>
              <View style={styles.loginCTAFeatures}>
                <View style={styles.featureItem}>
                  <Icon name="check-circle" size={16} color="#10B981" />
                  <Text style={styles.featureText}>AI Health Analysis</Text>
                </View>
                <View style={styles.featureItem}>
                  <Icon name="check-circle" size={16} color="#10B981" />
                  <Text style={styles.featureText}>Personalized Plans</Text>
                </View>
                <View style={styles.featureItem}>
                  <Icon name="check-circle" size={16} color="#10B981" />
                  <Text style={styles.featureText}>Track Biomarkers</Text>
                </View>
              </View>
            </Surface>
          )}

          {/* Quick Actions - Only show for logged-in users */}
          {isLoggedIn && (
            <View style={styles.quickActionsContainer}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickActionsRow}>
                <TouchableOpacity style={styles.quickActionButton} onPress={() => router.push('/(tabs)/orders')}>
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                    <Icon name="test-tube" size={24} color="#FF385C" />
                  </View>
                  <Text style={styles.quickActionText}>Order Test</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionButton} onPress={() => router.push('/(tabs)/results')}>
                  <View style={[styles.quickActionIcon, { backgroundColor: '#E0F2FE' }]}>
                    <Icon name="file-document" size={24} color="#0EA5E9" />
                  </View>
                  <Text style={styles.quickActionText}>View Results</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionButton} onPress={() => router.push('/myplans')}>
                  <View style={[styles.quickActionIcon, { backgroundColor: '#D1FAE5' }]}>
                    <Icon name="clipboard-check" size={24} color="#10B981" />
                  </View>
                  <Text style={styles.quickActionText}>My Plans</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionButton} onPress={() => router.push('/(tabs)/professionals')}>
                  <View style={[styles.quickActionIcon, { backgroundColor: '#F3E8FF' }]}>
                    <Icon name="doctor" size={24} color="#8B5CF6" />
                  </View>
                  <Text style={styles.quickActionText}>Consult</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Health Questionnaire Prompt - Show for logged-in users who haven't completed it */}
          {isLoggedIn && userData && !userData.healthAssessment?.isComplete && (
            <Surface style={styles.questionnaireCard}>
              <View style={styles.questionnaireContent}>
                <View style={styles.questionnaireIconContainer}>
                  <Icon name="clipboard-text-outline" size={32} color="#FF385C" />
                </View>
                <View style={styles.questionnaireTextContainer}>
                  <Text style={styles.questionnaireTitle}>Complete Your Health Profile</Text>
                  <Text style={styles.questionnaireSubtitle}>
                    Answer a few questions to get personalized health recommendations and better AI analysis.
                  </Text>
                </View>
              </View>
              <View style={styles.questionnaireProgress}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: '10%' }]} />
                </View>
                <Text style={styles.progressText}>Not started</Text>
              </View>
              <TouchableOpacity
                style={styles.questionnaireButton}
                onPress={() => router.push('/health-assessment')}
              >
                <Text style={styles.questionnaireButtonText}>Start Health Assessment</Text>
                <Icon name="chevron-right" size={20} color="#FFF" />
              </TouchableOpacity>
            </Surface>
          )}

          {/* Health Analytics Section - Only for logged-in users */}
          {isLoggedIn && (
            <View style={styles.analyticsSection}>
              <Text style={styles.sectionTitle}>Your Health Analytics</Text>
              <View style={styles.analyticsGrid}>
                <Surface style={styles.analyticCard}>
                  <View style={[styles.analyticIconContainer, { backgroundColor: '#FEF3C7' }]}>
                    <Icon name="calendar-account" size={22} color="#F59E0B" />
                  </View>
                  <Text style={styles.analyticValue}>{userAge ?? '--'}</Text>
                  <Text style={styles.analyticLabel}>Age</Text>
                </Surface>

                <Surface style={styles.analyticCard}>
                  <View style={[styles.analyticIconContainer, { backgroundColor: '#E0E7FF' }]}>
                    <Icon name="human-male-height" size={22} color="#6366F1" />
                  </View>
                  <Text style={styles.analyticValue}>{userHeight ?? '--'}</Text>
                  <Text style={styles.analyticLabel}>Height (m)</Text>
                </Surface>

                <Surface style={styles.analyticCard}>
                  <View style={[styles.analyticIconContainer, { backgroundColor: '#FCE7F3' }]}>
                    <Icon name="weight" size={22} color="#EC4899" />
                  </View>
                  <Text style={styles.analyticValue}>{userWeight ?? '--'}</Text>
                  <Text style={styles.analyticLabel}>Weight (kg)</Text>
                </Surface>

                <Surface style={[styles.analyticCard, { borderWidth: 2, borderColor: bmiStatus.color }]}>
                  <View style={[styles.analyticIconContainer, { backgroundColor: `${bmiStatus.color}20` }]}>
                    <Icon name={bmiStatus.icon} size={22} color={bmiStatus.color} />
                  </View>
                  <Text style={[styles.analyticValue, { color: bmiStatus.color }]}>{userBMI}</Text>
                  <Text style={styles.analyticLabel}>BMI</Text>
                  <Chip
                    style={[styles.bmiChip, { backgroundColor: `${bmiStatus.color}20` }]}
                    textStyle={{ color: bmiStatus.color, fontSize: 10 }}
                  >
                    {bmiStatus.status}
                  </Chip>
                </Surface>
              </View>
            </View>
          )}

          {/* Featured Products Section */}
          <View style={styles.productsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {isLoggedIn ? 'Recommended Tests' : 'Popular Health Tests'}
              </Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
                <Text style={styles.seeAllText}>See All →</Text>
              </TouchableOpacity>
            </View>
            {!isLoggedIn && (
              <Text style={styles.productsSubtitle}>
                Discover comprehensive health tests to understand your body better
              </Text>
            )}
            {loadingProducts ? (
              <ActivityIndicator size="small" color="#FF385C" />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productsScroll}>
                {featuredProducts.map((product) => (
                  <TouchableOpacity
                    key={product._id}
                    style={styles.productCard}
                    onPress={() => router.push({ pathname: '/ProductDetails', params: { productId: product._id } })}
                  >
                    <Image
                      source={{ uri: product.image || 'https://via.placeholder.com/150' }}
                      style={styles.productImage}
                    />
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                      <Text style={styles.productPrice}>£{product.price}</Text>
                    </View>
                    <TouchableOpacity style={styles.addToCartButton}>
                      <Icon name="plus" size={18} color="#FFF" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Latest Test Result Card - Only for logged-in users with test results */}
          {isLoggedIn && latestTest && (
            <View style={styles.latestTestSection}>
              <Text style={styles.sectionTitle}>Latest Test Result</Text>
              <Surface style={styles.testResultCard}>
                <View style={styles.testResultHeader}>
                  <View style={styles.testTypeContainer}>
                    <View style={styles.testIconContainer}>
                      <Icon name="flask" size={24} color="#FF385C" />
                    </View>
                    <View>
                      <Text style={styles.testType}>{latestTest?.patient?.test_type ?? 'Unknown Test'}</Text>
                      <Text style={styles.testLab}>{latestTest?.patient?.lab_name ?? 'Unknown Lab'}</Text>
                    </View>
                  </View>
                  <View style={styles.testDateContainer}>
                    <Icon name="calendar" size={14} color="#94A3B8" />
                    <Text style={styles.testDate}>{latestTest?.patient?.date_of_test ?? 'N/A'}</Text>
                  </View>
                </View>

                <View style={styles.testInterpretation}>
                  <Text style={styles.interpretationLabel}>Summary</Text>
                  <Text style={styles.interpretationText} numberOfLines={3}>
                    {latestTest?.interpretation ?? 'No interpretation available'}
                  </Text>
                </View>

                <View style={styles.testActionsRow}>
                  <Button
                    mode="contained"
                    onPress={handleGenerateInterpretation}
                    style={styles.aiButton}
                    labelStyle={styles.aiButtonLabel}
                    icon={loadingFeedback ? undefined : "robot"}
                  >
                    {loadingFeedback ? <ActivityIndicator color="white" size="small" /> : "Get AI Analysis"}
                  </Button>
                  <TouchableOpacity
                    style={styles.viewDetailsButton}
                    onPress={() => router.push('/(tabs)/results')}
                  >
                    <Text style={styles.viewDetailsText}>View Details</Text>
                    <Icon name="chevron-right" size={20} color="#FF385C" />
                  </TouchableOpacity>
                </View>
              </Surface>

              {/* AI Feedback Section */}
              {deepSeekFeedback !== '' && (
                <Surface style={styles.feedbackCard}>
                  <View style={styles.feedbackHeader}>
                    <View style={styles.feedbackTitleRow}>
                      <Icon name="robot" size={24} color="#10B981" />
                      <Text style={styles.feedbackTitle}>LabTrack AI Analysis</Text>
                    </View>
                    <Chip style={styles.aiChip} textStyle={{ color: '#10B981', fontSize: 10 }}>AI Powered</Chip>
                  </View>
                  <View style={styles.feedbackContent}>
                    <Markdown style={markdownStyles}>{deepSeekFeedback}</Markdown>
                  </View>
                  <Button
                    mode="contained"
                    style={styles.generatePlanButton}
                    labelStyle={styles.generatePlanLabel}
                    icon="clipboard-plus"
                    // Plan items are now created as part of interpretation, so this is
                    // navigation rather than a second generation step. The old handler
                    // posted to /plans/create, which ran the retired keyword parser.
                    onPress={() => router.push('/myplans')}
                  >
                    View My Health Plan
                  </Button>
                </Surface>
              )}
            </View>
          )}

          {/* Empty State for logged-in users with No Tests */}
          {isLoggedIn && !latestTest && !loading && (
            <View style={styles.emptyStateContainer}>
              <Icon name="flask-empty-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyStateTitle}>No Test Results Yet</Text>
              <Text style={styles.emptyStateText}>
                Order your first health test to get personalized insights and recommendations.
              </Text>
              <Button
                mode="contained"
                style={styles.emptyStateButton}
                labelStyle={{ color: '#FFF' }}
                onPress={() => router.push('/(tabs)/orders')}
              >
                Browse Tests
              </Button>
            </View>
          )}

          {/* Why LabTrack Section - For non-logged-in users */}
          {!isLoggedIn && (
            <View style={styles.whyLabTrackSection}>
              <Text style={styles.sectionTitle}>Why Choose LabTrack?</Text>
              <View style={styles.benefitsGrid}>
                <Surface style={styles.benefitCard}>
                  <View style={[styles.benefitIcon, { backgroundColor: '#FEE2E2' }]}>
                    <Icon name="robot" size={28} color="#FF385C" />
                  </View>
                  <Text style={styles.benefitTitle}>AI-Powered Analysis</Text>
                  <Text style={styles.benefitText}>Get intelligent insights from your test results powered by advanced AI</Text>
                </Surface>

                <Surface style={styles.benefitCard}>
                  <View style={[styles.benefitIcon, { backgroundColor: '#D1FAE5' }]}>
                    <Icon name="chart-timeline-variant" size={28} color="#10B981" />
                  </View>
                  <Text style={styles.benefitTitle}>Track Progress</Text>
                  <Text style={styles.benefitText}>Monitor your biomarkers over time and see your health improve</Text>
                </Surface>

                <Surface style={styles.benefitCard}>
                  <View style={[styles.benefitIcon, { backgroundColor: '#E0E7FF' }]}>
                    <Icon name="clipboard-text" size={28} color="#6366F1" />
                  </View>
                  <Text style={styles.benefitTitle}>Personalized Plans</Text>
                  <Text style={styles.benefitText}>Receive customized health recommendations based on your results</Text>
                </Surface>

                <Surface style={styles.benefitCard}>
                  <View style={[styles.benefitIcon, { backgroundColor: '#FEF3C7' }]}>
                    <Icon name="shield-check" size={28} color="#F59E0B" />
                  </View>
                  <Text style={styles.benefitTitle}>Genetic Insights</Text>
                  <Text style={styles.benefitText}>Understand your genetic predispositions for proactive health care</Text>
                </Surface>
              </View>

              <Button
                mode="contained"
                style={styles.getStartedButton}
                labelStyle={{ fontWeight: '600', fontSize: 16 }}
                onPress={() => router.push('/signup')}
              >
                Get Started Free
              </Button>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

const markdownStyles = {
  body: { color: '#374151', fontSize: 14, lineHeight: 22 },
  heading1: { color: '#111827', fontSize: 18, fontWeight: '700' as const, marginVertical: 8 },
  heading2: { color: '#111827', fontSize: 16, fontWeight: '600' as const, marginVertical: 6 },
  bullet_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  strong: { fontWeight: '600' as const, color: '#111827' },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  heroSection: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTextContainer: {
    flex: 1,
  },
  heroGreeting: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
  },
  healthScoreContainer: {
    alignItems: 'center',
  },
  healthScoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  healthScoreValue: {
    fontSize: 26,
    fontWeight: '800',
    color: 'white',
  },
  healthScoreLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  loader: {
    marginVertical: 40,
  },

  // Quick Actions
  quickActionsContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    alignItems: 'center',
    width: (width - 60) / 4,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Health Questionnaire Card
  questionnaireCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    borderWidth: 2,
    borderColor: '#FF385C',
    borderStyle: 'dashed',
  },
  questionnaireContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  questionnaireIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  questionnaireTextContainer: {
    flex: 1,
  },
  questionnaireTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  questionnaireSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  questionnaireProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF385C',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  questionnaireButton: {
    backgroundColor: '#FF385C',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionnaireButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginRight: 8,
  },

  // Analytics Section
  analyticsSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  analyticCard: {
    width: (width - 52) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  analyticIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  analyticValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  analyticLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 4,
  },
  bmiChip: {
    marginTop: 8,
    height: 24,
  },

  // Products Section
  productsSection: {
    marginTop: 24,
    paddingLeft: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 20,
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    color: '#FF385C',
    fontWeight: '600',
  },
  productsScroll: {
    paddingRight: 20,
  },
  productCard: {
    width: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginRight: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  productImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#F1F5F9',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF385C',
  },
  addToCartButton: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF385C',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Latest Test Section
  latestTestSection: {
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 20,
  },
  testResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  testResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  testTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  testIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  testType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  testLab: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  testDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  testDate: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 4,
  },
  testInterpretation: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  interpretationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 4,
  },
  interpretationText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  testActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    flex: 1,
    marginRight: 12,
  },
  aiButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewDetailsText: {
    fontSize: 14,
    color: '#FF385C',
    fontWeight: '600',
  },

  // Feedback Card
  feedbackCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  feedbackTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
    marginLeft: 10,
  },
  aiChip: {
    backgroundColor: '#D1FAE5',
    height: 24,
  },
  feedbackContent: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  generatePlanButton: {
    backgroundColor: '#FF385C',
    borderRadius: 12,
  },
  generatePlanLabel: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Empty State
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#FF385C',
    borderRadius: 12,
    paddingHorizontal: 24,
  },

  // Login CTA Card
  loginCTACard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  loginCTAContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  loginCTAIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  loginCTATextContainer: {
    flex: 1,
  },
  loginCTATitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  loginCTASubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  loginCTAButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  loginButton: {
    flex: 1,
    backgroundColor: '#FF385C',
    borderRadius: 12,
  },
  signupButton: {
    flex: 1,
    borderColor: '#FF385C',
    borderRadius: 12,
  },
  loginCTAFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featureText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },

  // Products Subtitle
  productsSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
    paddingRight: 20,
  },

  // Why LabTrack Section
  whyLabTrackSection: {
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 40,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  benefitCard: {
    width: (width - 52) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  benefitIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 6,
  },
  benefitText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
  getStartedButton: {
    backgroundColor: '#FF385C',
    borderRadius: 12,
    marginTop: 8,
    paddingVertical: 4,
  },
});

export default HomeScreen;
