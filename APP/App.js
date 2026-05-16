import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Animated,
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
import Svg, { Circle, Path } from 'react-native-svg';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Bluetooth,
  Video,
  Grid3x3,
  Sparkles,
  Shield,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react-native';

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



// 원형 프로그레스 게이지 컴포넌트

function CircularProgress({ score, color, size = 220, strokeWidth = 12 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      {/* 배경 원 */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* 프로그레스 원 */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// 펄스 애니메이션 컴포넌트
function PulseRing({ color, size = 260, active = true }) {
  const pulseAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  const scale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.15],
  });

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0],
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: color,
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  );
}

// 미니 그래프 (위험도 변화 추이)
function MiniGraph({ history, color, width = 280, height = 50 }) {
  if (history.length < 2) return <View style={{ width, height }} />;

  const max = 100;
  const points = history.map((v, i) => {
    const x = (i / (history.length - 1)) * width;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  });

  return (
    <Svg width={width} height={height}>
      <Path
        d={`M ${points.join(' L ')}`}
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
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
  const [phase, setPhase] = useState('incoming');
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

  // 위험도 분석
  useEffect(() => {
    if (phase !== 'active') return;
    let localElapsed = 0;
    const interval = setInterval(async () => {
      localElapsed += ANALYSIS_INTERVAL / 1000;
      const result = await analyzeAudioChunk(localElapsed, target);
      setRiskScore(result.risk);
      setRiskHistory((prev) => [...prev, result.risk].slice(-30));
    }, ANALYSIS_INTERVAL);
    return () => clearInterval(interval);
  }, [phase, target]);

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
    if (riskScore >= DANGER_THRESHOLD) return '#EF4444';
    if (riskScore >= WARNING_THRESHOLD) return '#F59E0B';
    return '#10B981';
  };

  const getRiskLabel = () => {
    if (riskScore >= DANGER_THRESHOLD) return '위험';
    if (riskScore >= WARNING_THRESHOLD) return '주의';
    return '안전';
  };

  const getRiskIcon = () => {
    if (riskScore >= DANGER_THRESHOLD) return <AlertTriangle size={18} color="#FFFFFF" />;
    if (riskScore >= WARNING_THRESHOLD) return <Shield size={18} color="#FFFFFF" />;
    return <CheckCircle2 size={18} color="#FFFFFF" />;
  };

  // ===== 수신 화면 =====
  if (phase === 'incoming') {
    return (
      <View style={styles.galaxyIncomingScreen}>
        <View style={styles.galaxyIncomingTop}>
          <Text style={styles.galaxyIncomingLabel}>수신전화</Text>
          <Text style={styles.galaxyIncomingName}>{target.name}</Text>
          <Text style={styles.galaxyIncomingPhone}>
            휴대전화  {target.phone || '010-0000-0000'}
          </Text>
          <Text style={styles.galaxyIncomingSubAction}>메시지 보내기</Text>
        </View>

        <View style={styles.galaxyIncomingMiddle}>
          <Phone size={20} color="rgba(255,255,255,0.6)" />
          <Text style={styles.galaxyIncomingLastCall}>
            관계: {target.relation}
          </Text>
        </View>

        <View style={styles.galaxyAssistContainer}>
          <View style={styles.galaxyAssistPill}>
            <Sparkles size={14} color="#FFFFFF" />
            <Text style={styles.galaxyAssistText}>  통화 어시스트</Text>
          </View>
        </View>

        <View style={styles.galaxyIncomingButtons}>
          <View style={styles.galaxyButtonWrap}>
            <TouchableOpacity
              style={styles.galaxyAcceptButton}
              onPress={handleAccept}
            >
              <Phone size={32} color="#FFFFFF" fill="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.galaxyButtonWrap}>
            <TouchableOpacity
              style={styles.galaxyRejectButton}
              onPress={handleReject}
            >
              <PhoneOff size={32} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.galaxyBottomHint}>
          <View style={styles.galaxyBottomBar} />
        </View>
      </View>
    );
  }

  // 통화 중 화면 (새 디자인)
  return (
    <View style={styles.callActiveScreen}>
      {/* 상단 정보 */}
      <View style={styles.callActiveHeader}>
        <View style={styles.callTimerRow}>
          <Phone size={14} color="#10B981" />
          <Text style={styles.callTimerText}>{formatTime(elapsedSec)}</Text>
          <View style={styles.callTimerDot} />
          <Text style={styles.callTimerLabel}>실시간 분석 중</Text>
        </View>
        <Text style={styles.callActiveName}>{target.name}</Text>
        <Text style={styles.callActivePhone}>
          {target.relation} · {target.phone || '010-0000-0000'}
        </Text>
      </View>

      {/* 메인 위험도 게이지 */}
      <View style={styles.gaugeArea}>
        <View style={styles.gaugeWrapper}>
          {/* 펄스 애니메이션 (위험할 때만 빠르게) */}
          <PulseRing color={getRiskColor()} size={260} active={riskScore >= WARNING_THRESHOLD} />
          
          {/* 원형 게이지 */}
          <CircularProgress score={riskScore} color={getRiskColor()} size={220} />
          
          {/* 중앙 텍스트 (원 위에 absolute로) */}
          <View style={styles.gaugeCenterText}>
            <Text style={styles.gaugeScore}>{riskScore}</Text>
            <Text style={styles.gaugeUnit}>위험도</Text>
          </View>
        </View>

        {/* 상태 뱃지 */}
        <View style={[styles.statusBadge, { backgroundColor: getRiskColor() }]}>
          {getRiskIcon()}
          <Text style={styles.statusBadgeText}>  {getRiskLabel()}</Text>
        </View>

        {/* 미니 그래프 */}
        <View style={styles.miniGraphArea}>
          <Text style={styles.miniGraphLabel}>위험도 추이</Text>
          <MiniGraph history={riskHistory} color={getRiskColor()} width={280} height={50} />
        </View>
      </View>

      {/* 경고 배너 */}
      {warningShown && (
        <View style={styles.dangerBanner}>
          <AlertTriangle size={22} color="#FCA5A5" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.dangerBannerTitle}>딥보이스 의심</Text>
            <Text style={styles.dangerBannerDesc}>
              등록된 음성과 일치하지 않습니다
            </Text>
          </View>
        </View>
      )}

      {/* 하단 컨트롤 */}
      <View style={styles.controlPanel}>
        <View style={styles.controlGrid}>
          <View style={styles.controlItem}>
            <View style={[styles.controlIconBox, { backgroundColor: 'rgba(16,185,129,0.2)' }]}>
              <Mic size={22} color="#10B981" />
            </View>
            <Text style={styles.controlLabel}>분석 중</Text>
          </View>
          <View style={styles.controlItem}>
            <View style={styles.controlIconBox}>
              <Video size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.controlLabel}>영상통화</Text>
          </View>
          <View style={styles.controlItem}>
            <View style={styles.controlIconBox}>
              <Bluetooth size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.controlLabel}>블루투스</Text>
          </View>
          <View style={styles.controlItem}>
            <View style={styles.controlIconBox}>
              <Volume2 size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.controlLabel}>스피커</Text>
          </View>
          <View style={styles.controlItem}>
            <View style={styles.controlIconBox}>
              <MicOff size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.controlLabel}>음소거</Text>
          </View>
          <View style={styles.controlItem}>
            <View style={styles.controlIconBox}>
              <Grid3x3 size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.controlLabel}>키패드</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.endCallButton} onPress={handleEnd}>
          <PhoneOff size={26} color="#FFFFFF" />
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

  // 통화 중 화면
  callActiveScreen: {
    flex: 1,
    backgroundColor: '#0F1230',
    paddingTop: 30,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  callActiveHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  callTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  callTimerText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
    fontVariant: ['tabular-nums'],
  },
  callTimerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#6B7280',
    marginHorizontal: 8,
  },
  callTimerLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
  callActiveName: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  callActivePhone: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 4,
  },
  gaugeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeWrapper: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeCenterText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScore: {
    color: '#FFFFFF',
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  gaugeUnit: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: -4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  miniGraphArea: {
    marginTop: 20,
    alignItems: 'center',
  },
  miniGraphLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  dangerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  dangerBannerTitle: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 2,
  },
  dangerBannerDesc: {
    color: 'rgba(252,165,165,0.8)',
    fontSize: 12,
  },
  controlPanel: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    padding: 20,
    paddingTop: 24,
  },
  controlGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  controlItem: {
    width: '33.33%',
    alignItems: 'center',
    marginBottom: 18,
  },
  controlIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  controlLabel: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
  },
  endCallButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});