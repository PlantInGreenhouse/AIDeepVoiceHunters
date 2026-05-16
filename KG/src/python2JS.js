async function loadGraphVariables() {
  const response = await fetch("/data/graph/C001_graph.json");

  if (!response.ok) {
    throw new Error("C001_graph.json 파일을 불러오지 못했습니다.");
  }

  const graph = await response.json();

  const getNodeByType = (type) => {
    return graph.nodes.find((node) => node.type === type);
  };

  const getNodesByType = (type) => {
    return graph.nodes.filter((node) => node.type === type);
  };

  const getEdgeByType = (type) => {
    return graph.edges.find((edge) => edge.type === type);
  };

  const getEdgesByType = (type) => {
    return graph.edges.filter((edge) => edge.type === type);
  };

  // -------------------------
  // Graph
  // -------------------------

  const graphId = graph.graphId;

  // -------------------------
  // Nodes
  // -------------------------

  const callNode = getNodeByType("Call");
  const userVoiceNode = getNodeByType("UserVoice");
  const comparisonVoiceNode = getNodeByType("ComparisonVoice");
  const callSegmentNode = getNodeByType("CallSegment");
  const detectedPeriodNode = getNodeByType("DetectedPeriod");
  const spoofAssessmentNode = getNodeByType("SpoofAssessment");
  const spoofTypeNode = getNodeByType("SpoofType");
  const spoofCandidateNode = getNodeByType("SpoofCandidate");
  const observedIssueNode = getNodeByType("ObservedIssue");
  const userActionNodes = getNodesByType("UserAction");

  // -------------------------
  // Call node fields
  // -------------------------

  const callId = callNode?.properties?.callId;
  const userId = callNode?.properties?.userId;
  const callLevel = callNode?.properties?.level;
  const callConfidence = callNode?.properties?.confidence;

  // -------------------------
  // UserVoice node fields
  // -------------------------

  const userVoiceNodeType = userVoiceNode?.properties?.nodeType;
  const userVoiceId = userVoiceNode?.properties?.voiceId;
  const userVoiceLabel = userVoiceNode?.properties?.label;
  const userVoiceDescription = userVoiceNode?.properties?.description;
  const userVoiceRegisteredAt = userVoiceNode?.properties?.registeredAt;
  const userVoiceAudioRef = userVoiceNode?.properties?.audioRef;

  // -------------------------
  // ComparisonVoice node fields
  // -------------------------

  const comparisonVoiceNodeType = comparisonVoiceNode?.properties?.nodeType;
  const comparisonVoiceCallId = comparisonVoiceNode?.properties?.callId;
  const comparisonVoiceLabel = comparisonVoiceNode?.properties?.label;
  const comparisonVoiceDescription = comparisonVoiceNode?.properties?.description;
  const comparisonVoiceRecordedAt = comparisonVoiceNode?.properties?.recordedAt;
  const comparisonVoiceAudioRef = comparisonVoiceNode?.properties?.audioRef;

  // -------------------------
  // CallSegment node fields
  // -------------------------

  const segmentNodeType = callSegmentNode?.properties?.nodeType;
  const segmentId = callSegmentNode?.properties?.segmentId;
  const segmentLabel = callSegmentNode?.properties?.label;
  const segmentDescription = callSegmentNode?.properties?.description;
  const segmentStart = callSegmentNode?.properties?.start;
  const segmentEnd = callSegmentNode?.properties?.end;
  const segmentUnit = callSegmentNode?.properties?.unit;
  const segmentConfidence = callSegmentNode?.properties?.confidence;

  // -------------------------
  // DetectedPeriod node fields
  // -------------------------

  const detectedStart = detectedPeriodNode?.properties?.start;
  const detectedEnd = detectedPeriodNode?.properties?.end;
  const detectedUnit = detectedPeriodNode?.properties?.unit;

  // -------------------------
  // SpoofAssessment node fields
  // -------------------------

  const assessmentLevel = spoofAssessmentNode?.properties?.level;
  const assessmentConfidence = spoofAssessmentNode?.properties?.confidence;
  const assessmentSummary = spoofAssessmentNode?.properties?.summary;

  // -------------------------
  // SpoofType node fields
  // -------------------------

  const spoofTypeLabel = spoofTypeNode?.properties?.label;
  const spoofTypeDescription = spoofTypeNode?.properties?.description;

  // -------------------------
  // SpoofCandidate node fields
  // -------------------------

  const spoofCandidateType = spoofCandidateNode?.properties?.type;
  const spoofCandidateConfidence = spoofCandidateNode?.properties?.confidence;
  const spoofCandidateDescription = spoofCandidateNode?.properties?.description;

  // -------------------------
  // ObservedIssue node fields
  // -------------------------

  const observedIssue = observedIssueNode?.properties?.issue;
  const observedEvidenceType = observedIssueNode?.properties?.evidenceType;
  const observedScore = observedIssueNode?.properties?.score;
  const observedSeverity = observedIssueNode?.properties?.severity;
  const observedDescription = observedIssueNode?.properties?.description;

  // -------------------------
  // UserAction nodes fields
  // -------------------------

  const userActions = userActionNodes.map((node) => ({
    id: node.id,
    title: node.properties.title,
    detail: node.properties.detail,
    priority: node.properties.priority,
  }));

  const action1 = userActions[0];
  const action1Title = action1?.title;
  const action1Detail = action1?.detail;
  const action1Priority = action1?.priority;

  const action2 = userActions[1];
  const action2Title = action2?.title;
  const action2Detail = action2?.detail;
  const action2Priority = action2?.priority;

  const action3 = userActions[2];
  const action3Title = action3?.title;
  const action3Detail = action3?.detail;
  const action3Priority = action3?.priority;

  // -------------------------
  // Edges
  // -------------------------

  const hasSpoofTypeEdge = getEdgeByType("HAS_SPOOF_TYPE");
  const hasCandidateEdge = getEdgeByType("HAS_CANDIDATE");
  const hasObservedIssueEdge = getEdgeByType("HAS_OBSERVED_ISSUE");
  const supportsAssessmentEdge = getEdgeByType("SUPPORTS_ASSESSMENT");
  const recommendsActionEdges = getEdgesByType("RECOMMENDS_ACTION");
  const hasRegisteredVoiceEdge = getEdgeByType("HAS_REGISTERED_VOICE");
  const hasComparisonVoiceEdge = getEdgeByType("HAS_COMPARISON_VOICE");
  const hasSegmentEdge = getEdgeByType("HAS_SEGMENT");
  const hasDetectedPeriodEdge = getEdgeByType("HAS_DETECTED_PERIOD");
  const indicatesDeepvoiceEdge = getEdgeByType("INDICATES_DEEPVOICE");

  // -------------------------
  // Edge fields
  // -------------------------

  const indicatesDeepvoiceConfidence =
    indicatesDeepvoiceEdge?.properties?.confidence;

  const recommendsActionPriorities = recommendsActionEdges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    priority: edge.properties.priority,
  }));

  return {
    graph,
    graphId,

    callNode,
    callId,
    userId,
    callLevel,
    callConfidence,

    userVoiceNode,
    userVoiceNodeType,
    userVoiceId,
    userVoiceLabel,
    userVoiceDescription,
    userVoiceRegisteredAt,
    userVoiceAudioRef,

    comparisonVoiceNode,
    comparisonVoiceNodeType,
    comparisonVoiceCallId,
    comparisonVoiceLabel,
    comparisonVoiceDescription,
    comparisonVoiceRecordedAt,
    comparisonVoiceAudioRef,

    callSegmentNode,
    segmentNodeType,
    segmentId,
    segmentLabel,
    segmentDescription,
    segmentStart,
    segmentEnd,
    segmentUnit,
    segmentConfidence,

    detectedPeriodNode,
    detectedStart,
    detectedEnd,
    detectedUnit,

    spoofAssessmentNode,
    assessmentLevel,
    assessmentConfidence,
    assessmentSummary,

    spoofTypeNode,
    spoofTypeLabel,
    spoofTypeDescription,

    spoofCandidateNode,
    spoofCandidateType,
    spoofCandidateConfidence,
    spoofCandidateDescription,

    observedIssueNode,
    observedIssue,
    observedEvidenceType,
    observedScore,
    observedSeverity,
    observedDescription,

    userActionNodes,
    userActions,
    action1Title,
    action1Detail,
    action1Priority,
    action2Title,
    action2Detail,
    action2Priority,
    action3Title,
    action3Detail,
    action3Priority,

    hasSpoofTypeEdge,
    hasCandidateEdge,
    hasObservedIssueEdge,
    supportsAssessmentEdge,
    recommendsActionEdges,
    hasRegisteredVoiceEdge,
    hasComparisonVoiceEdge,
    hasSegmentEdge,
    hasDetectedPeriodEdge,
    indicatesDeepvoiceEdge,
    indicatesDeepvoiceConfidence,
    recommendsActionPriorities,
  };
}