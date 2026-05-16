import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

const FLOW_STEPS = [
  { title: '홈', detail: '등록된 가족 목소리 관리' },
  { title: '가족 추가', detail: '새 가족 목소리 등록' },
  { title: '통화 분석', detail: '현재 통화 음성 분석 중' },
  { title: '결과', detail: '일치 / 주의 / 위험' },
  { title: '판단 근거', detail: '모델이 본 이상 신호' },
  { title: '즉시 대응', detail: '재확인·문자·가족 공유' },
  { title: '지식그래프', detail: '결과 설명 구조' },
];

const RECORD_SECONDS = 5;

export default function App() {
  const [screenIndex, setScreenIndex] = useState(0);
  const [familyList, setFamilyList] = useState([]);  // 등록된 가족 목록

  const currentStep = FLOW_STEPS[screenIndex];
  const progress = `${screenIndex + 1} / ${FLOW_STEPS.length}`;

  // 가족 추가
  const handleAddFamily = (data) => {
    const newMember = {
      id: Date.now().toString(),
      ...data,
    };
    setFamilyList((prev) => [...prev, newMember]);
    setScreenIndex(0);  // 홈으로
    Alert.alert('등록 완료', `${data.name}님의 음성이 등록되었습니다.`);
  };

  // 가족 삭제
  const handleDeleteFamily = (id) => {
    setFamilyList((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Voice Pass</Text>
        <Text style={styles.headerSubtitle}>{currentStep.title} · {progress}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {screenIndex === 0 && (
          <HomeScreen
            familyList={familyList}
            onAddFamily={() => setScreenIndex(1)}
            onStartAnalysis={() => setScreenIndex(2)}
            onDeleteFamily={handleDeleteFamily}
          />
        )}
        {screenIndex === 1 && (
          <RegisterScreen
            onBack={() => setScreenIndex(0)}
            onComplete={handleAddFamily}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function HomeScreen({ familyList, onAddFamily, onStartAnalysis, onDeleteFamily }) {
  const handleDelete = (id, name) => {
    Alert.alert(
      '음성 삭제',
      `${name}님의 등록된 음성을 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => onDeleteFamily(id) },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      {/* 헤더 카드 */}
      <View style={styles.heroCard}>
        <Text style={styles.heroEmoji}>🛡️</Text>
        <Text style={styles.heroTitle}>Voice Pass</Text>
        <Text style={styles.heroSubtitle}>
          가족의 목소리를 등록하고, 의심스러운 통화로부터 보호하세요.
        </Text>
      </View>

      {/* 등록된 가족 목록 */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>등록된 가족</Text>
        <Text style={styles.sectionBadge}>{familyList.length}명</Text>
      </View>

      {familyList.length === 0 ? (
        <View style={styles.emptyCard}>
          {/* <Text style={styles.emptyEmoji}>👨‍👩‍👧</Text> */}
          <Text style={styles.emptyTitle}>등록된 가족이 없습니다</Text>
          <Text style={styles.emptyDesc}>
            아래 "가족 추가" 버튼을 눌러 첫 가족 목소리를 등록해보세요.
          </Text>
        </View>
      ) : (
        familyList.map((member) => (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.memberInfo}>
              <Text style={styles.memberAvatar}>👤</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberRelation}>
                  {member.relation}
                  {member.phone ? ` · ${member.phone}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(member.id, member.name)}
              >
                <Text style={styles.deleteButtonText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* 가족 추가 버튼 */}
      <TouchableOpacity style={styles.addButton} onPress={onAddFamily}>
        <Text style={styles.addButtonText}>+ 가족 추가</Text>
      </TouchableOpacity>

      {/* 통화 분석 시작 버튼 (가족이 1명 이상일 때만 활성화) */}
      <TouchableOpacity
        style={[
          styles.primaryButton,
          { marginTop: 16 },
          familyList.length === 0 && styles.primaryButtonDisabled,
        ]}
        onPress={onStartAnalysis}
        disabled={familyList.length === 0}
      >
        <Text style={styles.primaryButtonText}>🎙️ 통화 분석 시작</Text>
      </TouchableOpacity>
    </View>
  );
}

function RegisterScreen({ onBack, onComplete }) {
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [phone, setPhone] = useState('');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [recordedUri, setRecordedUri] = useState(null);
  const [countdown, setCountdown] = useState(RECORD_SECONDS);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  // 마이크 권한 요청
  useEffect(() => {
    (async () => {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('마이크 권한 필요', '음성 등록을 위해 마이크 권한을 허용해주세요.');
        return;
      }
      setPermissionGranted(true);
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
    })();
  }, []);

  // 5초 카운트다운
  useEffect(() => {
    if (!recorderState.isRecording) return;
    if (countdown <= 0) {
      stopRecording();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [recorderState.isRecording, countdown]);

  const startRecording = async () => {
    if (!permissionGranted) {
      Alert.alert('권한 없음', '마이크 권한을 먼저 허용해주세요.');
      return;
    }
    setRecordedUri(null);
    setCountdown(RECORD_SECONDS);
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const stopRecording = async () => {
    try {
      await recorder.stop();
      setRecordedUri(recorder.uri);
    } catch (error) {
      console.warn('녹음 중지 실패', error);
    }
  };

  const canSubmit = name.trim() && relation.trim() && recordedUri;

  const handleSubmit = () => {
    if (!canSubmit) {
      Alert.alert('확인', '이름·관계·5초 녹음을 모두 완료해주세요.');
      return;
    }
    onComplete({
      name: name.trim(),
      relation: relation.trim(),
      phone: phone.trim(),
      audioUri: recordedUri,
      registeredAt: new Date().toISOString(),
    });
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.sectionTitle}>새 가족 추가</Text>
      <Text style={styles.sectionDesc}>
        평소 통화 환경에서 5초 정도 자연스럽게 말해주세요. (예: "여보세요, 나야. 잠깐 통화 가능해?")
      </Text>

      <View style={styles.inputBlock}>
        <Text style={styles.inputLabel}>이름</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="예: 김영희"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={styles.inputBlock}>
        <Text style={styles.inputLabel}>관계</Text>
        <TextInput
          style={styles.input}
          value={relation}
          onChangeText={setRelation}
          placeholder="예: 어머니"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={styles.inputBlock}>
        <Text style={styles.inputLabel}>전화번호 (선택)</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="예: 010-1234-5678"
          placeholderTextColor="#9CA3AF"
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.recordCard}>
        <Text style={styles.recordTitle}>
          {recorderState.isRecording
            ? `녹음 중... ${countdown}s`
            : recordedUri
            ? '녹음 완료'
            : '녹음 준비'}
        </Text>
        {recorderState.isRecording ? (
          <ActivityIndicator size="large" color="#243B80" style={{ marginVertical: 12 }} />
        ) : null}
        <TouchableOpacity
          style={[styles.recordButton, recorderState.isRecording && styles.recordButtonActive]}
          onPress={recorderState.isRecording ? stopRecording : startRecording}
        >
          <Text style={styles.recordButtonText}>
            {recorderState.isRecording ? '중지' : recordedUri ? '다시 녹음' : '녹음 시작'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>이전</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled, { flex: 1 }]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Text style={styles.primaryButtonText}>등록하기</Text>
        </TouchableOpacity>
      </View>
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#243B80',
    marginBottom: 8,
  },
  sectionDesc: {
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 20,
  },
  inputBlock: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  recordCard: {
    marginTop: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  recordTitle: {
    fontWeight: '800',
    color: '#243B80',
    fontSize: 14,
  },
  recordButton: {
    marginTop: 12,
    backgroundColor: '#243B80',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  recordButtonActive: {
    backgroundColor: '#DC2626',
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#374151',
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionBadge: {
    backgroundColor: '#EEF2FF',
    color: '#243B80',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
  },
  emptyCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 4,
  },
  emptyDesc: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    fontSize: 32,
    marginRight: 12,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  memberRelation: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#243B80',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  addButtonText: {
    color: '#243B80',
    fontWeight: '800',
    fontSize: 14,
  },
});