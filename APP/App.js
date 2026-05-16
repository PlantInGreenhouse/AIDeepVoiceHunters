import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const FLOW_STEPS = [
  { title: '시작', detail: 'Voice Pass 소개' },
  { title: '음성 등록', detail: '가족/지인 목소리 신분증 생성' },
  { title: '등록 완료', detail: '기준 음성 저장 완료' },
  { title: '통화 분석', detail: '현재 통화 음성 분석 중' },
  { title: '결과', detail: '일치 / 주의 / 위험' },
  { title: '판단 근거', detail: '모델이 본 이상 신호' },
  { title: '즉시 대응', detail: '재확인·문자·가족 공유' },
  { title: '지식그래프', detail: '결과 설명 구조' },
];

export default function App() {
  const [screenIndex, setScreenIndex] = useState(0);

  const currentStep = FLOW_STEPS[screenIndex];
  const progress = `${screenIndex + 1} / ${FLOW_STEPS.length}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Voice Pass</Text>
        <Text style={styles.headerSubtitle}>{currentStep.title} · {progress}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <StartScreen onStart={() => setScreenIndex(1)} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StartScreen({ onStart }) {
  return (
    <View style={styles.screen}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEmoji}>🛡️</Text>
        <Text style={styles.heroTitle}>Voice Pass</Text>
        <Text style={styles.heroSubtitle}>
          가족의 목소리를 미리 등록하고, 의심스러운 통화 음성과 비교해 보이스피싱/딥보이스 위험을 알려드립니다.
        </Text>
      </View>
      <TouchableOpacity style={styles.primaryButton} onPress={onStart}>
        <Text style={styles.primaryButtonText}>시작하기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F4',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#243B80',
  },
  headerSubtitle: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 12,
  },
  scrollContent: {
    padding: 20,
  },
  screen: {
    flex: 1,
  },
  heroCard: {
    backgroundColor: '#F1F4FF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#243B80',
    marginBottom: 8,
  },
  heroSubtitle: {
    color: '#4B5563',
    lineHeight: 22,
    fontSize: 14,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#243B80',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});