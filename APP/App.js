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
  useAudioPlayer,
  useAudioPlayerStatus,
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


// 데모 음성 파일 (나중에 진짜 파일 넣을 자리)
// const DEMO_CALL_AUDIO = require('./assets/demo_call.mp3');
const DEMO_CALL_AUDIO = null;  // 임시: 파일 추가 전까지 null

// 위험도 임계값
const DANGER_THRESHOLD = 70;     // 이 이상이면 위험 경고
const WARNING_THRESHOLD = 40;    // 이 이상이면 주의

// 분석 청크 주기 (밀리초)
const ANALYSIS_INTERVAL = 1500;  // 1.5초마다 위험도 갱신



// API 호출 (FastAPI로 연결 예정)

async function analyzeAudioChunk(elapsedSeconds, target) {
  // Mock: 시간이 지날수록 위험도가 단계적으로 오르는 패턴
  // 0~5초: 안전 → 5~10초: 주의 → 10초+: 위험
  await new Promise((resolve) => setTimeout(resolve, 200)); // 네트워크 지연 시뮬레이션

  let baseRisk;
  if (elapsedSeconds < 5) {
    baseRisk = 15 + elapsedSeconds * 3;          // 15 → 30
  } else if (elapsedSeconds < 12) {
    baseRisk = 30 + (elapsedSeconds - 5) * 6;    // 30 → 72
  } else {
    baseRisk = Math.min(95, 72 + (elapsedSeconds - 12) * 3);  // 72 → 95
  }

  // 약간의 노이즈
  const risk = Math.max(0, Math.min(100, baseRisk + (Math.random() * 8 - 4)));

  return {
    risk: Math.round(risk),
    timestamp: Date.now(),
    target: target.name,
  };
}


export default function App() {
  const [screenIndex, setScreenIndex] = useState(0);
  const [familyList, setFamilyList] = useState([]);
  const [callTarget, setCallTarget] = useState(null);
  const [callResult, setCallResult] = useState(null);

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

  // 통화 시뮬레이션 시작 (가족 선택 후)
  const handleStartCall = (target) => {
    setCallTarget(target);
    setScreenIndex(3);  // 통화 화면으로
  };

  // 통화 종료 후 결과 처리
  const handleCallEnd = (result) => {
    setCallResult(result);
    setScreenIndex(4);  // 결과 화면 ##################(만들어야함)
  };

  // 가족 삭제
  const handleDeleteFamily = (id) => {
    setFamilyList((prev) => prev.filter((m) => m.id !== id));
  };

  // 통화 화면일 때는 전체화면
  const isFullScreen = screenIndex === 3;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isFullScreen ? 'light-content' : 'dark-content'} />
      {!isFullScreen && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Voice Pass</Text>
          <Text style={styles.headerSubtitle}>{currentStep.title} · {progress}</Text>
        </View>
      )}
      {isFullScreen ? (
        // 통화 화면은 ScrollView 없이 그대로
        <>
          {screenIndex === 3 && callTarget && (
            <CallScreen
              target={callTarget}
              onEnd={handleCallEnd}
            />
          )}
        </>
      ) : (
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
          {screenIndex === 2 && (
            <SelectTargetScreen
              familyList={familyList}
              onBack={() => setScreenIndex(0)}
              onSelect={handleStartCall}
            />
          )}
        </ScrollView>
      )}
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
        <Text style={styles.primaryButtonText}>실시간 분석 시작</Text>
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


function SelectTargetScreen({ familyList, onBack, onSelect }) {
  const [selected, setSelected] = useState(null);

  return (
    <View style={styles.screen}>
      <Text style={styles.sectionTitle}>통화 상대 선택</Text>
      <Text style={styles.sectionDesc}>
        분석할 통화의 상대를 선택해주세요. 등록된 가족 음성과 비교합니다.
      </Text>

      {familyList.map((member) => {
        const isSelected = selected?.id === member.id;
        return (
          <TouchableOpacity
            key={member.id}
            style={[styles.selectCard, isSelected && styles.selectCardActive]}
            onPress={() => setSelected(member)}
          >
            <Text style={styles.memberAvatar}>👤</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.memberRelation}>{member.relation}</Text>
            </View>
            {isSelected && <Text style={styles.checkMark}>✓</Text>}
          </TouchableOpacity>
        );
      })}

      <View style={[styles.buttonRow, { marginTop: 20 }]}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>홈으로</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { flex: 1 },
            !selected && styles.primaryButtonDisabled,
          ]}
          onPress={() => selected && onSelect(selected)}
          disabled={!selected}
        >
          <Text style={styles.primaryButtonText}>실시간 분석 시작</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


function CallScreen({ target, onEnd }) {
  const [phase, setPhase] = useState('incoming');  // 'incoming' | 'active'
  const [elapsedSec, setElapsedSec] = useState(0);
  const [riskScore, setRiskScore] = useState(0);
  const [riskHistory, setRiskHistory] = useState([]);
  const [warningShown, setWarningShown] = useState(false);

  const player = DEMO_CALL_AUDIO ? useAudioPlayer(DEMO_CALL_AUDIO) : null;

  // 통화 시간 카운트업
  useEffect(() => {
    if (phase !== 'active') return;
    const timer = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);
  

  // 위험도 분석 (1.5초마다)
  useEffect(() => {
    if (phase !== 'active') return;
    
    let localElapsed = 0;
    const interval = setInterval(async () => {
      localElapsed += ANALYSIS_INTERVAL / 1000;  // 매 호출마다 1.5초씩 증가
      const result = await analyzeAudioChunk(localElapsed, target);
      setRiskScore(result.risk);
      setRiskHistory((prev) => [...prev, result.risk]);
    }, ANALYSIS_INTERVAL);
    
    return () => clearInterval(interval);
  }, [phase, target]);  //

  // 위험 임계값 도달 시 경고
  useEffect(() => {
    if (riskScore >= DANGER_THRESHOLD && !warningShown) {
      setWarningShown(true);
    }
  }, [riskScore, warningShown]);

  const handleAccept = async () => {
    setPhase('active');
    if (player) {
      try {
        player.play();
      } catch (e) {
        console.warn('음성 재생 실패', e);
      }
    }
  };

  const handleReject = () => {
    if (player) player.pause();
    onEnd({ rejected: true, target });
  };

  const handleEnd = () => {
    if (player) player.pause();
    onEnd({
      rejected: false,
      target,
      duration: elapsedSec,
      finalRisk: riskScore,
      riskHistory,
    });
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getRiskColor = () => {
    if (riskScore >= DANGER_THRESHOLD) return '#DC2626';
    if (riskScore >= WARNING_THRESHOLD) return '#F59E0B';
    return '#10B981';
  };

  const getRiskLabel = () => {
    if (riskScore >= DANGER_THRESHOLD) return '위험';
    if (riskScore >= WARNING_THRESHOLD) return '주의';
    return '안전';
  };

  // ===== 수신 화면 (갤럭시 스타일) =====
  if (phase === 'incoming') {
    return (
      <View style={styles.galaxyIncomingScreen}>
        {/* 상단 영역: 라벨 + 이름 + 번호 */}
        <View style={styles.galaxyIncomingTop}>
          <Text style={styles.galaxyIncomingLabel}>수신전화</Text>
          <Text style={styles.galaxyIncomingName}>{target.name}</Text>
          <Text style={styles.galaxyIncomingPhone}>
            휴대전화  {target.phone || '010-0000-0000'}
          </Text>
          <Text style={styles.galaxyIncomingSubAction}>메시지 보내기</Text>
        </View>

        {/* 중앙 영역: 마지막 통화 정보 (장식) */}
        <View style={styles.galaxyIncomingMiddle}>
          <Text style={styles.galaxyIncomingPhoneIcon}>📞</Text>
          <Text style={styles.galaxyIncomingLastCall}>
            관계: {target.relation}
          </Text>
        </View>

        {/* 통화 어시스트 알약 버튼 */}
        <View style={styles.galaxyAssistContainer}>
          <View style={styles.galaxyAssistPill}>
            <Text style={styles.galaxyAssistText}>✨ 통화 어시스트</Text>
          </View>
        </View>

        {/* 하단: 수락/거절 버튼 */}
        <View style={styles.galaxyIncomingButtons}>
          <View style={styles.galaxyButtonWrap}>
            <TouchableOpacity
              style={styles.galaxyAcceptButton}
              onPress={handleAccept}
            >
              <Text style={styles.galaxyButtonIcon}>📞</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.galaxyButtonWrap}>
            <TouchableOpacity
              style={styles.galaxyRejectButton}
              onPress={handleReject}
            >
              <Text style={styles.galaxyButtonIcon}>📞</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 맨 아래 메시지 보내기 */}
        <View style={styles.galaxyBottomHint}>
          <View style={styles.galaxyBottomBar} />
          <Text style={styles.galaxyBottomHintText}>메시지 보내기</Text>
        </View>
      </View>
    );
  }

  // ===== 통화 중 화면 (갤럭시 스타일) =====
  return (
    <View style={styles.galaxyActiveScreen}>
      {/* 상단: 통화 시간 + 분석 시간 */}
      <View style={styles.galaxyActiveTop}>
        <Text style={styles.galaxyActiveTimer}>
          📞 {formatTime(elapsedSec)}  /  🔴 분석 {formatTime(elapsedSec)}
        </Text>
      </View>

      {/* 이름 + 번호 */}
      <View style={styles.galaxyActiveNameArea}>
        <Text style={styles.galaxyActiveName}>{target.name}</Text>
        <Text style={styles.galaxyActivePhone}>
          휴대전화  {target.phone || '010-0000-0000'}
        </Text>
      </View>

      {/* 위험도 게이지 (가운데 영역) */}
      <View style={styles.galaxyRiskArea}>
        <Text style={styles.galaxyRiskLabel}>실시간 분석 중</Text>
        <View style={styles.galaxyRiskCircle}>
          <Text style={[styles.galaxyRiskScore, { color: getRiskColor() }]}>
            {riskScore}
          </Text>
          <Text style={styles.galaxyRiskUnit}>/ 100</Text>
        </View>
        <View style={[styles.galaxyRiskBadge, { backgroundColor: getRiskColor() }]}>
          <Text style={styles.galaxyRiskBadgeText}>{getRiskLabel()}</Text>
        </View>
        <View style={styles.galaxyRiskBarContainer}>
          <View
            style={[
              styles.galaxyRiskBarFill,
              { width: `${riskScore}%`, backgroundColor: getRiskColor() },
            ]}
          />
        </View>
      </View>

      {/* 위험 경고 배너 */}
      {warningShown && (
        <View style={styles.galaxyWarningBanner}>
          <Text style={styles.galaxyWarningEmoji}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.galaxyWarningTitle}>딥보이스 의심</Text>
            <Text style={styles.galaxyWarningDesc}>
              등록된 음성과 일치하지 않습니다
            </Text>
          </View>
        </View>
      )}

      {/* 어시스트 알약 */}
      <View style={styles.galaxyAssistContainer}>
        <View style={styles.galaxyAssistPill}>
          <Text style={styles.galaxyAssistText}>통화 어시스트</Text>
        </View>
      </View>

      {/* 하단 기능 카드 */}
      <View style={styles.galaxyControlCard}>
        <View style={styles.galaxyControlGrid}>
          <View style={styles.galaxyControlItem}>
            <View style={[styles.galaxyControlIcon, { backgroundColor: '#10B981' }]}>
              <Text style={styles.galaxyControlEmoji}>🔴</Text>
            </View>
            <Text style={styles.galaxyControlLabel}>분석 중지</Text>
          </View>
          <View style={styles.galaxyControlItem}>
            <View style={styles.galaxyControlIcon}>
              <Text style={styles.galaxyControlEmoji}>📹</Text>
            </View>
            <Text style={styles.galaxyControlLabelInactive}>영상통화</Text>
          </View>
          <View style={styles.galaxyControlItem}>
            <View style={styles.galaxyControlIcon}>
              <Text style={styles.galaxyControlEmoji}>📶</Text>
            </View>
            <Text style={styles.galaxyControlLabel}>블루투스</Text>
          </View>
          <View style={styles.galaxyControlItem}>
            <View style={styles.galaxyControlIcon}>
              <Text style={styles.galaxyControlEmoji}>🔊</Text>
            </View>
            <Text style={styles.galaxyControlLabel}>스피커</Text>
          </View>
          <View style={styles.galaxyControlItem}>
            <View style={styles.galaxyControlIcon}>
              <Text style={styles.galaxyControlEmoji}>🎤</Text>
            </View>
            <Text style={styles.galaxyControlLabel}>내 소리 차단</Text>
          </View>
          <View style={styles.galaxyControlItem}>
            <View style={styles.galaxyControlIcon}>
              <Text style={styles.galaxyControlEmoji}>⌨️</Text>
            </View>
            <Text style={styles.galaxyControlLabel}>키패드</Text>
          </View>
        </View>

        {/* 종료 버튼 */}
        <TouchableOpacity style={styles.galaxyEndButton} onPress={handleEnd}>
          <Text style={styles.galaxyEndButtonIcon}>📞</Text>
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
  // === 통화 대상 선택 ===
  selectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  selectCardActive: {
    borderColor: '#243B80',
    backgroundColor: '#F1F4FF',
  },
  checkMark: {
    color: '#243B80',
    fontSize: 18,
    fontWeight: '900',
  },
  // 수신 화면
  galaxyIncomingScreen: {
    flex: 1,
    backgroundColor: '#2D2F5E',
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 24,
  },
  galaxyIncomingTop: {
    alignItems: 'center',
    marginTop: 20,
  },
  galaxyIncomingLabel: {
    color: '#D1D5DB',
    fontSize: 14,
    marginBottom: 30,
  },
  galaxyIncomingName: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
  },
  galaxyIncomingPhone: {
    color: '#D1D5DB',
    fontSize: 15,
    marginTop: 8,
  },
  galaxyIncomingSubAction: {
    color: '#D1D5DB',
    fontSize: 13,
    marginTop: 14,
  },
  galaxyIncomingMiddle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galaxyIncomingPhoneIcon: {
    fontSize: 18,
    marginBottom: 6,
    opacity: 0.7,
  },
  galaxyIncomingLastCall: {
    color: '#E5E7EB',
    fontSize: 13,
    marginBottom: 6,
  },
  galaxyAssistContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  galaxyAssistPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  galaxyAssistText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  galaxyIncomingButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  galaxyButtonWrap: {
    alignItems: 'center',
  },
  galaxyAcceptButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  galaxyRejectButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    transform: [{ rotate: '135deg' }],
  },
  galaxyButtonIcon: {
    fontSize: 32,
    color: '#FFFFFF',
  },
  galaxyBottomHint: {
    alignItems: 'center',
  },
  galaxyBottomBar: {
    width: 80,
    height: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    marginBottom: 8,
  },
  galaxyBottomHintText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // 통화중 화면
  galaxyActiveScreen: {
    flex: 1,
    backgroundColor: '#2D2F5E',
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  galaxyActiveTop: {
    alignItems: 'center',
    marginBottom: 20,
  },
  galaxyActiveTimer: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  galaxyActiveNameArea: {
    alignItems: 'center',
    marginBottom: 30,
  },
  galaxyActiveName: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
  },
  galaxyActivePhone: {
    color: '#D1D5DB',
    fontSize: 14,
    marginTop: 6,
  },
  galaxyRiskArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galaxyRiskLabel: {
    color: '#D1D5DB',
    fontSize: 13,
    marginBottom: 12,
  },
  galaxyRiskCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galaxyRiskScore: {
    fontSize: 50,
    fontWeight: '900',
  },
  galaxyRiskUnit: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  galaxyRiskBadge: {
    paddingHorizontal: 18,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 14,
  },
  galaxyRiskBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  galaxyRiskBarContainer: {
    width: '80%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  galaxyRiskBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  galaxyWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.95)',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 8,
    marginBottom: 16,
  },
  galaxyWarningEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  galaxyWarningTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 2,
  },
  galaxyWarningDesc: {
    color: '#FECACA',
    fontSize: 12,
  },
  galaxyControlCard: {
    backgroundColor: 'rgba(220, 220, 230, 0.95)',
    borderRadius: 20,
    padding: 20,
  },
  galaxyControlGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  galaxyControlItem: {
    width: '33.33%',
    alignItems: 'center',
    marginBottom: 16,
  },
  galaxyControlIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  galaxyControlEmoji: {
    fontSize: 22,
  },
  galaxyControlLabel: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '600',
  },
  galaxyControlLabelInactive: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
  galaxyEndButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  galaxyEndButtonIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    transform: [{ rotate: '135deg' }],
  },
});