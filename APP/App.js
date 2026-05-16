import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
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
import { SafeAreaView } from 'react-native-safe-area-context';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const FLOW_STEPS = [
  { title: '홈', detail: '등록된 가족 목소리 관리' },
  { title: '가족 추가', detail: '새 가족 목소리 등록' },
  { title: '통화 분석', detail: '분석할 가족 선택' },
  { title: '통화 화면', detail: '현재 통화 음성 분석 중' },
  { title: '결과 보고서', detail: '판단 근거와 대응 액션' },
];

const RECORD_SECONDS = 5;

// AsyncStorage 키
const STORAGE_KEYS = {
  FAMILY_LIST: '@voicepass/familyList',
  REPORT_HISTORY: '@voicepass/reportHistory',
};


// 음성 파일을 영구 저장 폴더로 복사

async function saveAudioPermanently(tempUri, familyId) {
  try {
    // 음성 저장용 폴더 만들기 (없으면)
    const voicesDir = `${FileSystem.documentDirectory}voices/`;
    const dirInfo = await FileSystem.getInfoAsync(voicesDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(voicesDir, { intermediates: true });
    }

    // 영구 파일 경로 만들기
    const permanentUri = `${voicesDir}voice_${familyId}.m4a`;

    // 임시 파일을 영구 위치로 복사
    await FileSystem.copyAsync({
      from: tempUri,
      to: permanentUri,
    });

    return permanentUri;
  } catch (error) {
    console.warn('음성 파일 영구 저장 실패:', error);
    return tempUri;  // 실패하면 원래 경로 그대로 반환 (fallback)
  }
}

// 가족 삭제 시 음성 파일도 함께 삭제
async function deleteAudioFile(audioUri) {
  try {
    if (audioUri && audioUri.startsWith(FileSystem.documentDirectory)) {
      const info = await FileSystem.getInfoAsync(audioUri);
      if (info.exists) {
        await FileSystem.deleteAsync(audioUri);
      }
    }
  } catch (error) {
    console.warn('음성 파일 삭제 실패:', error);
  }
}


// 데모 음성 파일 (나중에 진짜 파일 넣을 자리)
const DEMO_CALL_AUDIO = require('./assets/temp.m4a');


// 경고 음성 파일 (나중에 본인이 만든 파일 넣을 자리)
const WARNING_VOICE = require('./assets/warning_voice.mp3');
const DANGER_VOICE = require('./assets/danger_voice.mp3');

// 위험 상태 알림 반복 주기 (밀리초)
const DANGER_REPEAT_INTERVAL = 5000;  // 위험 단계에서 5초마다 진동+음성 반복

// 위험도 임계값
const DANGER_THRESHOLD = 70;     // 이 이상이면 위험 경고
const WARNING_THRESHOLD = 40;    // 이 이상이면 주의

// 분석 청크 주기 (밀리초)
const ANALYSIS_INTERVAL = 1500;  // 1.5초마다 위험도 갱신

const MODEL_REPORT_API_URL = '';

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

// 실제 서버 호출 (등록 음성 + 통화 음성 둘 다 보냄)


const SERVER_URL = 'https://jawed-tarmac-hull.ngrok-free.dev';

async function analyzeCallWithServer(target) {
  try {
    // 1. assets/temp.m4a 파일 경로 가져오기
    //    require()로 가져온 건 그대로 못 보내고, 임시 파일로 복사해야 함
    const Asset = require('expo-asset').Asset;
    const callAudioAsset = Asset.fromModule(require('./assets/temp.m4a'));
    await callAudioAsset.downloadAsync();
    const callAudioUri = callAudioAsset.localUri || callAudioAsset.uri;

    const userAudioInfo = await FileSystem.getInfoAsync(target.audioUri);
    console.log('등록 음성 URI:', target.audioUri);
    console.log('등록 음성 존재 여부:', userAudioInfo.exists);
    console.log('등록 음성 크기:', userAudioInfo.size);

    // 2. FormData 만들기
    const formData = new FormData();
    
    // 등록 음성 (target.audioUri는 영구 저장된 경로)
    formData.append('user_voice', {
      uri: target.audioUri,
      type: 'audio/m4a',
      name: 'user_voice.m4a',
    });
    
    // 통화 음성 (assets/temp.m4a)
    formData.append('comparison_voice', {
      uri: callAudioUri,
      type: 'audio/m4a',
      name: 'comparison_voice.m4a',
    });

    // 3. 서버 호출
    console.log('서버로 음성 전송 중...');
    const response = await fetch(`${SERVER_URL}/analyze`, {
      method: 'POST',
      body: formData,
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`서버 오류 ${response.status}: ${errorText}`);
    }

    const graphJson = await response.json();
    console.log('서버 응답 받음:', graphJson);
    
    return graphJson;
    
  } catch (error) {
    console.error('❌ 서버 호출 실패:', error);
    throw error;
  }
}

function normalizeRiskScoreFromApi(apiResult, fallback = 0) {
  const raw =
    apiResult?.riskScore ??
    apiResult?.risk_score ??
    apiResult?.risk ??
    apiResult?.spoofProbability ??
    apiResult?.spoof_probability ??
    fallback;

  const num = Number(raw);

  if (!Number.isFinite(num)) {
    return Math.max(0, Math.min(100, Math.round(fallback)));
  }

  // 서버가 0.99처럼 확률값으로 보내면 99로 변환
  // 서버가 99처럼 퍼센트로 보내면 그대로 99 사용
  const percent = num >= 0 && num <= 1 ? num * 100 : num;

  return Math.max(0, Math.min(100, Math.round(percent)));
}

function getLevelFromRisk(riskScore) {
  if (riskScore >= DANGER_THRESHOLD) {
    return {
      level: 'danger',
      label: '위험',
      color: '#EF4444',
      backgroundColor: '#FEF2F2',
    };
  }

  if (riskScore >= WARNING_THRESHOLD) {
    return {
      level: 'warning',
      label: '주의',
      color: '#F59E0B',
      backgroundColor: '#FFFBEB',
    };
  }

  return {
    level: 'safe',
    label: '일치',
    color: '#10B981',
    backgroundColor: '#ECFDF5',
  };
}

function sanitizePhoneNumber(phone) {
  return String(phone || '').replace(/[^0-9+]/g, '');
}

function getGuardianMember(familyList) {
  const guardianWithPhone = familyList.find(
    (member) => member.isGuardian && member.phone
  );

  if (guardianWithPhone) return guardianWithPhone;

  const guardian = familyList.find((member) => member.isGuardian);

  return guardian || null;
}

function buildFallbackReport(callResult) {
  const riskScore = Math.round(callResult?.finalRisk || 0);
  const levelInfo = getLevelFromRisk(riskScore);

  return {
    level: levelInfo.level,
    label: levelInfo.label,
    color: levelInfo.color,
    backgroundColor: levelInfo.backgroundColor,
    riskScore,
    summary:
      riskScore >= DANGER_THRESHOLD
        ? '등록된 가족 음성과 현재 통화 음성의 차이가 크게 관찰되어 딥보이스 의심 상태로 분류되었습니다.'
        : riskScore >= WARNING_THRESHOLD
        ? '등록된 음성과 일부 차이가 관찰되어 주의가 필요합니다.'
        : '등록된 가족 음성과 현재 통화 음성이 대체로 일치합니다.',
    reasons:
      riskScore >= DANGER_THRESHOLD
        ? ['딥보이스 의심 신호가 감지되었습니다.']
        : riskScore >= WARNING_THRESHOLD
        ? ['일부 음성 구간에서 주의가 필요한 차이가 관찰되었습니다.']
        : ['뚜렷한 딥보이스 의심 신호가 발견되지 않았습니다.'],
  };
}

function formatSpoofPoint(point) {
  if (point === null || point === undefined) return null;

  const num = Number(point);

  // "소수점 둘째 자리에서 반올림" = 소수 첫째 자리까지 표시
  if (Number.isFinite(num)) {
    return String(Math.round(num * 10) / 10);
  }

  return String(point);
}

function normalizeModelReport(apiResult, fallback) {
  if (!apiResult) return fallback;

  const rawRisk =
    apiResult.riskScore ??
    apiResult.risk_score ??
    apiResult.risk ??
    fallback.riskScore;

  const riskScore = Math.round(
    rawRisk <= 1 ? rawRisk * 100 : rawRisk
  );

  const levelInfo = getLevelFromRisk(riskScore);

  const spoofPointRaw = apiResult.spoofPoint ?? apiResult.spoof_point;

  const reasons = Array.isArray(spoofPointRaw)
    ? spoofPointRaw.map((point) => `의심 지점: ${formatSpoofPoint(point)}`)
    : spoofPointRaw !== undefined && spoofPointRaw !== null
    ? [`의심 지점: ${formatSpoofPoint(spoofPointRaw)}`]
    : fallback.reasons;

  return {
    ...fallback,
    level: levelInfo.level,
    label: levelInfo.label,
    color: levelInfo.color,
    backgroundColor: levelInfo.backgroundColor,
    riskScore,
    summary: apiResult.summary || fallback.summary,
    reasons,
  };
}

async function requestModelReport({ callResult, target, guardian }) {
  const fallback = buildFallbackReport(callResult);

  if (callResult?.graphResult) {
    return normalizeModelReport(callResult.graphResult, fallback);
  }

  if (!MODEL_REPORT_API_URL) {
    return fallback;
  }

  try {
    const response = await fetch(MODEL_REPORT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetName: target?.name,
        targetRelation: target?.relation,
        registeredPhone: target?.phone,
        callerPhone: target?.phone,
        guardianName: guardian?.name,
        guardianPhone: guardian?.phone,
        duration: callResult?.duration,
        finalRisk: callResult?.finalRisk,
        riskHistory: callResult?.riskHistory || [],
        registeredAudioUri: target?.audioUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Model API error: ${response.status}`);
    }

    const apiResult = await response.json();
    return normalizeModelReport(apiResult, fallback);
  } catch (error) {
    console.warn('FastAPI report request failed. fallback report used.', error);
    return fallback;
  }
}

function buildGuardianSmsMessage({ target, report, callbackPhone }) {
  return `[Voice Pass 경고]
${target?.name || '가족'}님으로 표시된 통화에서 의심 신호가 감지되었습니다.

재확인 번호: ${callbackPhone || '등록된 번호 없음'}
판정 결과: ${report?.label || '확인 필요'}
위험도: ${report?.riskScore ?? '-'}%

저장된 가족 번호로 직접 재확인해주세요.`;
}

function formatReportTime(dateString) {
  if (!dateString) return '시간 정보 없음';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return '시간 정보 없음';
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${month}/${day} ${hour}:${minute}`;
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
  const [reportHistory, setReportHistory] = useState([]);
  const [selectedReportRecord, setSelectedReportRecord] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);  // ← 추가: 초기 로드 완료 여부

  // 앱 시작 시 저장된 데이터 로드
  useEffect(() => {
    (async () => {
      try {
        const savedFamily = await AsyncStorage.getItem(STORAGE_KEYS.FAMILY_LIST);
        const savedReports = await AsyncStorage.getItem(STORAGE_KEYS.REPORT_HISTORY);

        if (savedFamily) {
          setFamilyList(JSON.parse(savedFamily));
        }
        if (savedReports) {
          setReportHistory(JSON.parse(savedReports));
        }
      } catch (error) {
        console.warn('저장된 데이터 로드 실패:', error);
      } finally {
        setIsLoaded(true);  // 로드 완료 표시
      }
    })();
  }, []);

  // familyList 변경 시 자동 저장
  useEffect(() => {
    if (!isLoaded) return;  // 초기 로드 전엔 저장 안 함 (빈 배열로 덮어쓰는 거 방지)
    AsyncStorage.setItem(STORAGE_KEYS.FAMILY_LIST, JSON.stringify(familyList))
      .catch((error) => console.warn('가족 목록 저장 실패:', error));
  }, [familyList, isLoaded]);

  // reportHistory 변경 시 자동 저장
  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.REPORT_HISTORY, JSON.stringify(reportHistory))
      .catch((error) => console.warn('보고서 저장 실패:', error));
  }, [reportHistory, isLoaded]);

  const currentStep = FLOW_STEPS[screenIndex];


  const progress = `${screenIndex + 1} / ${FLOW_STEPS.length}`;

  // 가족 추가
  const handleAddFamily = (data) => {
    // data에 이미 id가 포함되어 있음 (RegisterScreen에서 미리 생성)
    setFamilyList((prev) => [...prev, data]);
    setScreenIndex(0);
  };

  // 모든 데이터 초기화 (개발/테스트용)
  const handleResetAllData = () => {
    Alert.alert(
      '데이터 초기화',
      '모든 가족과 보고서를 삭제할까요? (되돌릴 수 없음)',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove([
              STORAGE_KEYS.FAMILY_LIST,
              STORAGE_KEYS.REPORT_HISTORY,
            ]);
            setFamilyList([]);
            setReportHistory([]);
            Alert.alert('완료', '모든 데이터가 삭제되었습니다.');
          },
        },
      ]
    );
  };

  // 통화 시뮬레이션 시작 (가족 선택 후)
  const handleStartCall = async (target) => {
    const info = await FileSystem.getInfoAsync(target.audioUri);
  
    console.log('===== 선택된 가족 음성 확인 =====');
    console.log('선택된 가족 ID:', target.id);
    console.log('선택된 가족 이름:', target.name);
    console.log('선택된 가족 관계:', target.relation);
    console.log('선택된 가족 등록일:', target.registeredAt);
    console.log('선택된 가족 audioUri:', target.audioUri);
    console.log('선택된 가족 음성 존재:', info.exists);
    console.log('선택된 가족 음성 크기:', info.size);
    console.log('================================');
  
    setCallTarget(target);
    setScreenIndex(3);  // 통화 화면으로
  };

  // 통화 종료 후 결과 처리
  const handleCallEnd = (result) => {
    const nextResult = {
      ...result,
      reportId: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
  
    setSelectedReportRecord(null);
    setCallResult(nextResult);
    setScreenIndex(4);
  };
  

  const handleSaveReport = (record) => {
    setReportHistory((prev) => {
      const alreadyExists = prev.some((item) => item.id === record.id);
  
      if (alreadyExists) {
        return prev.map((item) => (item.id === record.id ? record : item));
      }
  
      return [record, ...prev];
    });
  };
  
  const handleOpenReport = (record) => {
    setSelectedReportRecord(record);
    setCallResult(record.callResult);
    setScreenIndex(4);
  };
  
  const handleDeleteReport = (id) => {
    setReportHistory((prev) => prev.filter((item) => item.id !== id));
  };

  // 가족 삭제
  const handleDeleteFamily = (id) => {
    
    const memberToDelete = familyList.find((m) => m.id === id);
    if (memberToDelete?.audioUri) {
      deleteAudioFile(memberToDelete.audioUri);
    }
    setFamilyList((prev) => prev.filter((m) => m.id !== id));
  };

  // 통화 화면일 때는 전체화면
  const isFullScreen = screenIndex === 3;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isFullScreen ? 'light-content' : 'dark-content'} />
      
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
              reportHistory={reportHistory}
              onAddFamily={() => setScreenIndex(1)}
              onStartAnalysis={() => setScreenIndex(2)}
              onDeleteFamily={handleDeleteFamily}
              onOpenReport={handleOpenReport}
              onDeleteReport={handleDeleteReport}
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
          {screenIndex === 4 && callResult && (
            <ResultReportScreen
              callResult={callResult}
              familyList={familyList}
              savedRecord={selectedReportRecord}
              onSaveReport={handleSaveReport}
              onHome={() => {
                setCallTarget(null);
                setCallResult(null);
                setSelectedReportRecord(null);
                setScreenIndex(0);
              }}
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function HomeScreen({
  familyList,
  reportHistory,
  onAddFamily,
  onStartAnalysis,
  onDeleteFamily,
  onOpenReport,
  onDeleteReport,
}) {
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
        <Image 
            source={require('./assets/logo.png')} 
            style={styles.heroLogo}
            resizeMode="contain"/>
        {/* <Text style={styles.heroTitle}>Voice Pass</Text> */}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  {member.isGuardian && (
                    <View style={styles.guardianBadge}>
                      <Shield size={11} color="#FFFFFF" />
                      <Text style={styles.guardianBadgeText}>  보호자</Text>
                    </View>
                  )}
                </View>
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

      <View style={styles.reportHistorySection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>최근 분석 보고서</Text>
          <Text style={styles.sectionBadge}>{reportHistory.length}건</Text>
        </View>

        {reportHistory.length === 0 ? (
          <View style={styles.emptyReportCard}>
            <Text style={styles.emptyTitle}>저장된 보고서가 없습니다</Text>
            <Text style={styles.emptyDesc}>
              통화 분석을 완료하면 결과 보고서가 여기에 저장됩니다.
            </Text>
          </View>
        ) : (
          reportHistory.map((record) => (
            <View key={record.id} style={styles.reportHistoryCard}>
              <TouchableOpacity
                style={styles.reportHistoryMain}
                onPress={() => onOpenReport(record)}
              >
                <View
                  style={[
                    styles.reportHistoryBadge,
                    { backgroundColor: record.report?.color || '#243B80' },
                  ]}
                >
                  <Text style={styles.reportHistoryBadgeText}>
                    {record.report?.label || '보고서'}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.reportHistoryTitle}>
                    {record.target?.name || '알 수 없음'} · {record.target?.relation || '관계 없음'}
                  </Text>
                  <Text style={styles.reportHistoryDesc}>
                    재확인 번호 {record.callbackPhone || '등록된 번호 없음'} · 위험도 {record.report?.riskScore ?? '-'}%
                  </Text>
                  <Text style={styles.reportHistoryDate}>
                    {formatReportTime(record.createdAt)}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.reportHistoryDelete}
                onPress={() => onDeleteReport(record.id)}
              >
                <Text style={styles.reportHistoryDeleteText}>삭제</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
  
function RegisterScreen({ onBack, onComplete }) {
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [phone, setPhone] = useState('');
  const [isGuardian, setIsGuardian] = useState(false);   // ← 추가
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

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('확인', '이름·관계·5초 녹음을 모두 완료해주세요.');
      return;
    }

    // 가족 ID 미리 생성
    const familyId = Date.now().toString();

    // 음성 파일을 영구 저장소로 복사
    const permanentUri = await saveAudioPermanently(recordedUri, familyId);

    onComplete({
      id: familyId,                              
      name: name.trim(),
      relation: relation.trim(),
      phone: phone.trim(),
      isGuardian,                                  
      audioUri: permanentUri,                   
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

      {/* 보호자 체크박스 */}
      <TouchableOpacity 
        style={styles.checkboxRow}
        onPress={() => setIsGuardian(!isGuardian)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, isGuardian && styles.checkboxActive]}>
          {isGuardian && <Text style={styles.checkboxCheck}>✓</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.checkboxLabel}>보호자로 지정</Text>
          <Text style={styles.checkboxDesc}>
            보이스피싱 의심 시 이 분에게 알림 문자가 발송됩니다
          </Text>
        </View>
      </TouchableOpacity>

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
  const [warningTriggered, setWarningTriggered] = useState(false); 
  const [dangerTriggered, setDangerTriggered] = useState(false); 

  const [dangerOverlayVisible, setDangerOverlayVisible] = useState(false);
  const [dangerOverlayShown, setDangerOverlayShown] = useState(false);

  const [serverResult, setServerResult] = useState(null);
  const [serverAnalyzing, setServerAnalyzing] = useState(false);
  const riskAnimationTimerRef = useRef(null);

  const player = DEMO_CALL_AUDIO ? useAudioPlayer(DEMO_CALL_AUDIO) : null;
  const warningPlayer = WARNING_VOICE ? useAudioPlayer(WARNING_VOICE) : null;  
  const dangerPlayer = DANGER_VOICE ? useAudioPlayer(DANGER_VOICE) : null;    

  // 통화 시간 카운트업
  useEffect(() => {
    if (phase !== 'active') return;
    const timer = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);


  // 위험 임계값 도달 시 경고
  useEffect(() => {
    if (riskScore >= DANGER_THRESHOLD && !warningShown) {
      setWarningShown(true);
    }
  }, [riskScore, warningShown]);

  // 주의 단계 진입 시 1회 알림 (진동 + 음성)
  useEffect(() => {
    if (
      phase === 'active' &&
      riskScore >= WARNING_THRESHOLD &&
      riskScore < DANGER_THRESHOLD &&
      !warningTriggered
    ) {
      setWarningTriggered(true);
      // 진동: 짧고 또렷한 더블 패턴 [대기, 진동, 대기, 진동]
      Vibration.vibrate([0, 400, 200, 400]);
      // 음성 안내 (1회)
      if (warningPlayer) {
        try {
          warningPlayer.seekTo(0);
          warningPlayer.play();
        } catch (e) {
          console.warn('주의 음성 재생 실패', e);
        }
      }
    }
  }, [phase, riskScore, warningTriggered]);

  // 위험 단계 진입 시 1회 알림 (강한 진동 + 음성)
  useEffect(() => {
    if (phase === 'active' && riskScore >= DANGER_THRESHOLD && !dangerTriggered) {
      setDangerTriggered(true);
      // 진동: 강하고 긴 패턴 [대기, 진동, 대기, 진동, 대기, 진동]
      Vibration.vibrate([0, 800, 300, 800, 300, 800]);
      // 음성 안내 (1회)
      if (dangerPlayer) {
        try {
          dangerPlayer.seekTo(0);
          dangerPlayer.play();
        } catch (e) {
          console.warn('위험 음성 재생 실패', e);
        }
      }
    }
  }, [phase, riskScore, dangerTriggered]);



  const animateRiskTo = (targetRisk) => {
    return new Promise((resolve) => {
      const steps = 5;
      const intervalMs = 350;
  
      if (riskAnimationTimerRef.current) {
        clearInterval(riskAnimationTimerRef.current);
      }
  
      let step = 0;
      const startRisk = 0;
  
      setRiskScore(startRisk);
      setRiskHistory([startRisk]);
  
      riskAnimationTimerRef.current = setInterval(() => {
        step += 1;
  
        const nextRisk =
          step >= steps
            ? targetRisk
            : Math.round(startRisk + ((targetRisk - startRisk) * step) / steps);
  
        setRiskScore(nextRisk);
        setRiskHistory((prev) => [...prev, nextRisk].slice(-30));
  
        if (step >= steps) {
          clearInterval(riskAnimationTimerRef.current);
          riskAnimationTimerRef.current = null;
          resolve();
        }
      }, intervalMs);
    });
  };
  
  useEffect(() => {
    return () => {
      if (riskAnimationTimerRef.current) {
        clearInterval(riskAnimationTimerRef.current);
      }
    };
  }, []);

  const handleAccept = async () => {
    setPhase('active');
  
    if (player) {
      try {
        player.play();
      } catch (e) {
        console.warn('음성 재생 실패', e);
      }
    }
  
    setServerAnalyzing(true);
  
    try {
      const graphJson = await analyzeCallWithServer(target);
  
      console.log('서버 raw riskScore:', graphJson?.riskScore, typeof graphJson?.riskScore);
  
      const serverRisk = normalizeRiskScoreFromApi(graphJson, 0);
  
      console.log('앱 변환 riskScore:', serverRisk);
  
      setServerResult(graphJson);
      setServerAnalyzing(false);
  
      await animateRiskTo(serverRisk);

      if (serverRisk >= DANGER_THRESHOLD) {
        setWarningShown(true);
        setDangerOverlayShown(true);
        setDangerOverlayVisible(true);
      }
    } catch (error) {
      setServerAnalyzing(false);
  
      Alert.alert(
        '서버 분석 실패',
        '통화 음성 분석 결과를 받아오지 못했습니다.\n\n' + error.message
      );
    }
  };

  const handleReject = () => {
    if (player) player.pause();
    if (warningPlayer) warningPlayer.pause();
    if (dangerPlayer) dangerPlayer.pause();
    Vibration.cancel();                            
    onEnd({ rejected: true, target });
  };

  const handleEnd = () => {
    if (player) player.pause();
    if (warningPlayer) warningPlayer.pause();
    if (dangerPlayer) dangerPlayer.pause();
    Vibration.cancel();
  
    const normalizedFinalRisk = normalizeRiskScoreFromApi(serverResult, riskScore);
  
    onEnd({
      rejected: false,
      target,
      duration: elapsedSec,
      finalRisk: normalizedFinalRisk,
      riskHistory,
      graphResult: serverResult,
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

  // 수신 화면
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
          <Text style={styles.callTimerLabel}>
            {serverAnalyzing ? '서버 분석 중' : '실시간 분석 중'}
          </Text>
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
            <Text style={styles.dangerBannerTitle}>딥보이스 위험</Text>
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

      {dangerOverlayVisible && (
        <View style={styles.deepVoiceOverlay}>
          <View style={styles.deepVoiceDim} />

          <View style={styles.deepVoiceModal}>
            <View style={styles.deepVoiceIconCircle}>
              <AlertTriangle size={34} color="#FFFFFF" />
            </View>

            <Text style={styles.deepVoiceTitle}>딥보이스 위험 감지</Text>

            <Text style={styles.deepVoiceDesc}>
              {target?.name || '가족'}님으로 표시된 통화에서 의심 신호가 감지되었습니다.
              {'\n'}저장된 가족 번호로 직접 재확인하세요.
            </Text>

            <View style={styles.deepVoiceScoreBox}>
              <Text style={styles.deepVoiceScoreLabel}>위험도</Text>
              <Text style={styles.deepVoiceScoreValue}>{riskScore}%</Text>
            </View>

            <View style={styles.deepVoiceButtonRow}>
              <TouchableOpacity
                style={styles.deepVoiceGhostButton}
                onPress={() => setDangerOverlayVisible(false)}
              >
                <Text style={styles.deepVoiceGhostText}>통화 계속</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deepVoicePrimaryButton}
                onPress={handleEnd}
              >
                <Text style={styles.deepVoicePrimaryText}>결과 보기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function ResultReportScreen({
  callResult,
  familyList,
  savedRecord,
  onSaveReport,
  onHome,
}) {
  const target = callResult?.target;
  const guardian = getGuardianMember(familyList);
  const callbackPhone = target?.phone || '';
  const [report, setReport] = useState(savedRecord?.report || null);
  const [isLoading, setIsLoading] = useState(!savedRecord?.report);

  useEffect(() => {
    let alive = true;

    async function loadReport() {
      if (savedRecord?.report) {
        setReport(savedRecord.report);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const nextReport = await requestModelReport({
        callResult,
        target,
        guardian,
      });

      if (alive) {
        setReport(nextReport);
        setIsLoading(false);

        onSaveReport?.({
          id: callResult?.reportId || Date.now().toString(),
          createdAt: callResult?.createdAt || new Date().toISOString(),
          target,
          guardian,
          callbackPhone,
          report: nextReport,
          callResult,
        });
      }
    }

    loadReport();

    return () => {
      alive = false;
    };
  }, [callResult?.reportId, savedRecord?.id]);

  const handleCallRegisteredNumber = () => {
    const phone = sanitizePhoneNumber(callbackPhone);

    if (!phone) {
      Alert.alert('번호 없음', '재확인 전화를 걸 등록 번호가 없습니다.');
      return;
    }

    Linking.openURL(`tel:${phone}`);
  };

  const handleSendGuardianSms = () => {
    if (!guardian?.phone) {
      Alert.alert(
        '보호자 번호 없음',
        '보호자로 지정된 사람의 전화번호가 등록되어 있지 않습니다.'
      );
      return;
    }

    const phone = sanitizePhoneNumber(guardian.phone);
    const message = buildGuardianSmsMessage({
      target,
      report,
      callbackPhone,
    });

    Linking.openURL(`sms:${phone}?body=${encodeURIComponent(message)}`);
  };

  if (isLoading || !report) {
    return (
      <View style={styles.screen}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#243B80" />
          <Text style={styles.loadingTitle}>모델 결과 보고서 생성 중</Text>
          <Text style={styles.loadingDesc}>
            FastAPI 모델 출력과 통화 분석 정보를 정리하고 있습니다.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.reportHeroCard, { backgroundColor: report.backgroundColor }]}>
        <View style={[styles.reportBadge, { backgroundColor: report.color }]}>
          <Text style={styles.reportBadgeText}>{report.label}</Text>
        </View>

        <Text style={styles.reportTitle}>통화 분석 결과 보고서</Text>
        <Text style={styles.reportMetaText}>
          {savedRecord ? '저장된 보고서 다시 보기' : '새 분석 보고서'}
        </Text>
        <Text style={styles.reportSummary}>{report.summary}</Text>

        <View style={styles.reportScoreRow}>
          <View style={styles.reportScoreBox}>
            <Text style={[styles.reportScoreValue, { color: report.color }]}>
              {report.riskScore}%
            </Text>
            <Text style={styles.reportScoreLabel}>딥보이스 위험도</Text>
          </View>

        </View>
      </View>

      <View style={styles.reportSection}>
        <Text style={styles.reportSectionTitle}>통화 정보</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>표시된 상대</Text>
          <Text style={styles.infoValue}>
            {target?.name || '알 수 없음'} · {target?.relation || '관계 없음'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>재확인 번호</Text>
          <Text style={styles.infoValue}>{callbackPhone || '등록된 번호 없음'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>보호자</Text>
          <Text style={styles.infoValue}>
            {guardian ? `${guardian.name} · ${guardian.phone || '번호 없음'}` : '등록된 보호자 없음'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>통화 시간</Text>
          <Text style={styles.infoValue}>{callResult?.duration || 0}초</Text>
        </View>
      </View>

      <View style={styles.reportSection}>
        <Text style={styles.reportSectionTitle}>판단 근거</Text>

        {report.reasons.map((reason, index) => (
          <View key={`${reason}-${index}`} style={styles.reasonCard}>
            <Text style={styles.reasonIndex}>{index + 1}</Text>
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        ))}
      </View>

      <View style={styles.reportSection}>
        <Text style={styles.reportSectionTitle}>대응 액션</Text>

        <TouchableOpacity style={styles.actionButtonDanger} onPress={handleCallRegisteredNumber}>
          <Text style={styles.actionButtonTitle}>저장된 번호로 재확인 전화</Text>
          <Text style={styles.actionButtonDesc}>
            {target?.name || '가족'} · {callbackPhone || '등록된 번호 없음'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButtonPrimary,
            !guardian?.phone && styles.actionButtonDisabled,
          ]}
          onPress={handleSendGuardianSms}
          disabled={!guardian?.phone}
        >
          <Text style={styles.actionButtonTitle}>보호자에게 문자 보내기</Text>
          <Text style={styles.actionButtonDesc}>
            {guardian?.name || '등록된 보호자 없음'} {guardian?.phone ? `· ${guardian.phone}` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.reportSection}>
        <Text style={styles.reportSectionTitle}>지식그래프 요약</Text>

        <View style={styles.kgRow}>
          <Text style={styles.kgNode}>UserVoice</Text>
          <Text style={styles.kgArrow}>→</Text>
          <Text style={styles.kgNode}>ComparisonVoice</Text>
        </View>

        <View style={styles.kgRow}>
          <Text style={styles.kgNode}>ObservedIssue</Text>
          <Text style={styles.kgArrow}>→</Text>
          <Text style={[styles.kgNode, { borderColor: report.color, color: report.color }]}>
            Spoof
          </Text>
        </View>

        <View style={styles.kgRow}>
          <Text style={styles.kgNode}>RiskScore</Text>
          <Text style={styles.kgArrow}>→</Text>
          <Text style={styles.kgNode}>UserAction</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={onHome}>
        <Text style={styles.primaryButtonText}>홈으로 돌아가기</Text>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 24,
    // 그림자
    shadowColor: '#FF3A4A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    // 테두리
    borderWidth: 1,
    borderColor: 'rgba(255, 58, 74, 0.08)',
  },
  heroDivider: {
    width: 40,
    height: 3,
    backgroundColor: '#FF3A4A',
    borderRadius: 2,
    marginTop: 16,
    marginBottom: 16,
    opacity: 0.6,
  },
  heroFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  heroFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroFeatureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF3A4A',
    marginRight: 6,
  },
  heroFeatureText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  heroLogo: {               
    width: '90%',         
    height: 140,          
    marginBottom: 25,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#243B80',
    marginBottom: 8,
  },
  heroSubtitle: {
    color: '#6B7280',
    lineHeight: 22,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
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

  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    marginTop: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxActive: {
    backgroundColor: '#243B80',
    borderColor: '#243B80',
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  checkboxDesc: {
    fontSize: 11,
    color: '#6B7280',
  },
  guardianBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#243B80',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  guardianBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  loadingCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  loadingTitle: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '900',
    color: '#243B80',
  },
  loadingDesc: {
    marginTop: 6,
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
  },
  reportHeroCard: {
    borderRadius: 22,
    padding: 22,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reportBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 12,
  },
  reportBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  reportTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 4,
  },
  reportMetaText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
    marginBottom: 8,
  },
  reportSummary: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
  },
  reportScoreRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  reportScoreBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reportScoreValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },
  reportScoreLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '700',
  },
  reportSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reportSectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#243B80',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
  },
  infoValue: {
    flex: 1,
    fontSize: 12,
    color: '#111827',
    fontWeight: '800',
    textAlign: 'right',
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  reasonIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#243B80',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 11,
    fontWeight: '900',
    marginRight: 10,
    overflow: 'hidden',
  },
  reasonText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
  },
  actionButtonDanger: {
    backgroundColor: '#EF4444',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  actionButtonPrimary: {
    backgroundColor: '#243B80',
    borderRadius: 14,
    padding: 16,
  },
  actionButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  actionButtonTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  actionButtonDesc: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '600',
  },
  kgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  kgNode: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#334155',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: '#F8FAFC',
  },
  kgArrow: {
    marginHorizontal: 8,
    color: '#94A3B8',
    fontWeight: '900',
  },
  reportHistorySection: {
    marginTop: 26,
  },
  emptyReportCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  reportHistoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reportHistoryMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportHistoryBadge: {
    minWidth: 48,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: 'center',
    marginRight: 12,
  },
  reportHistoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  reportHistoryTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
  },
  reportHistoryDesc: {
    marginTop: 3,
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  reportHistoryDate: {
    marginTop: 3,
    fontSize: 11,
    color: '#9CA3AF',
  },
  reportHistoryDelete: {
    alignSelf: 'flex-end',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  reportHistoryDeleteText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '800',
  },
  deepVoiceOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  
  deepVoiceDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 18, 48, 0.58)',
  },
  
  deepVoiceModal: {
    width: '100%',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 16,
  },
  
  deepVoiceIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  
  deepVoiceTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  
  deepVoiceDesc: {
    fontSize: 14,
    lineHeight: 21,
    color: '#4B5563',
    textAlign: 'center',
    fontWeight: '600',
  },
  
  deepVoiceScoreBox: {
    marginTop: 20,
    marginBottom: 20,
    minWidth: 130,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  
  deepVoiceScoreLabel: {
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '800',
    marginBottom: 4,
  },
  
  deepVoiceScoreValue: {
    fontSize: 36,
    color: '#EF4444',
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  
  deepVoiceButtonRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  
  deepVoiceGhostButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  
  deepVoiceGhostText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '900',
  },
  
  deepVoicePrimaryButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  
  deepVoicePrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
});