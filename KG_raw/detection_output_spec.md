# DeepVoice Detection Output Specification

## Purpose

This file defines the output format of the DeepVoice detection model.
The KG module receives this file as input and converts it into a graph JSON.

## File Path

```text
data/raw/detection_output.json
```
```
{
  "callId": "C001",
  "userId": "U001",
  "detectedSegments": [
    {
      "segmentId": "SEG_C001_001",
      "start": 8.2,
      "end": 12.6,
      "confidence": 0.88,
      "spoofProbability": 0.84
    }
  ]
}
```