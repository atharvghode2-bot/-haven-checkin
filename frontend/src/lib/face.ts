// On-device facial expression analysis using MediaPipe FaceLandmarker with FACS blendshapes.
// Images and video streams are strictly analyzed locally in memory and never captured, stored, or transmitted.
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export type EmotionMap = {
  neutral: number;
  happy: number;
  sad: number;
  angry: number;
  fearful: number;
  surprised: number;
  disgusted: number;
};

export type CameraStatus = "off" | "connecting" | "active" | "denied" | "unavailable" | "error";
export type FacePresence = "detected" | "no_face" | "searching";

export type SamplerState = {
  status: CameraStatus;
  statusText: string;
  facePresence: FacePresence;
  sampleCount: number;
  currentEmotions: EmotionMap | null;
  dominantEmotion: string | null;
};

export type FaceSamplerResult = {
  emotions: EmotionMap | null;
  sampleCount: number;
  validFrames: number;
  model: string;
};

export type FaceSamplerHandle = {
  stop: () => FaceSamplerResult;
  getSnapshot: () => SamplerState;
};

const EMOTION_KEYS: (keyof EmotionMap)[] = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "fearful",
  "surprised",
  "disgusted",
];

/**
 * Averages valid emotion probability observations across collected frames.
 */
function averageEmotions(rows: EmotionMap[]): EmotionMap {
  const count = rows.length;
  if (count === 0) {
    return {
      neutral: 1,
      happy: 0,
      sad: 0,
      angry: 0,
      fearful: 0,
      surprised: 0,
      disgusted: 0,
    };
  }
  const sums: Record<string, number> = {};
  for (const key of EMOTION_KEYS) {
    sums[key] = rows.reduce((acc, row) => acc + (row[key] || 0), 0) / count;
  }
  // Renormalize so probabilities sum to 1.0
  const total = Object.values(sums).reduce((a, b) => a + b, 0) || 1.0;
  const out = {} as EmotionMap;
  for (const key of EMOTION_KEYS) {
    out[key] = Math.round((sums[key] / total) * 1000) / 1000;
  }
  return out;
}

/**
 * Maps MediaPipe 52 FACS (Facial Action Coding System) blendshapes to canonical expression categories.
 * Based on empirical facial action unit combinations (Ekman & Friesen FACS standard).
 */
function fromBlendshapes(categories: { categoryName: string; score: number }[]): EmotionMap {
  const map = new Map<string, number>();
  for (const c of categories) {
    map.set(c.categoryName, c.score);
  }
  const get = (name: string): number => map.get(name) || 0;

  // 1. Happiness: Bilateral zygomaticus major (AU12: smile) + orbicularis oculi (AU6: cheek squint)
  const smile = (get("mouthSmileLeft") + get("mouthSmileRight")) / 2;
  const cheekSquint = (get("cheekSquintLeft") + get("cheekSquintRight")) / 2;
  const happyRaw = Math.min(1.0, smile * 0.8 + cheekSquint * 0.2);

  // 2. Sadness: Depressor anguli oris (AU15: mouth frown) + Frontalis medialis (AU1: inner brow up) + Corrugator (AU4: brow down)
  const frown = (get("mouthFrownLeft") + get("mouthFrownRight")) / 2;
  const browInnerUp = get("browInnerUp");
  const browDown = (get("browDownLeft") + get("browDownRight")) / 2;
  const sadRaw = Math.min(1.0, frown * 0.5 + browInnerUp * 0.35 + browDown * 0.15);

  // 3. Anger: Corrugator (AU4: brow down) + Orbicularis oris (AU24: lip press) + Mentalis (AU17: mouth shrug)
  const lipPress = (get("mouthPressLeft") + get("mouthPressRight")) / 2;
  const mouthShrug = (get("mouthShrugLower") + get("mouthShrugUpper")) / 2;
  const angryRaw = Math.min(1.0, browDown * 0.7 + lipPress * 0.15 + mouthShrug * 0.15);

  // 4. Fear: Levator palpebrae (AU5: eye wide) + Frontalis medialis (AU1: inner brow up) + Jaw drop (AU26)
  const eyeWide = (get("eyeWideLeft") + get("eyeWideRight")) / 2;
  const jawOpen = get("jawOpen");
  const fearfulRaw = Math.min(1.0, eyeWide * 0.5 + browInnerUp * 0.3 + jawOpen * 0.2);

  // 5. Surprise: Upper lid raise (AU5) + jaw drop (AU26/27) + Frontalis lateralis (AU2: outer brow up)
  const outerBrowUp = (get("browOuterUpLeft") + get("browOuterUpRight")) / 2;
  const surprisedRaw = Math.min(1.0, eyeWide * 0.4 + jawOpen * 0.4 + outerBrowUp * 0.2);

  // 6. Disgust: Levator labii superioris (AU9: nose sneer) + AU10: upper lip raiser
  const noseSneer = (get("noseSneerLeft") + get("noseSneerRight")) / 2;
  const upperLipUp = (get("mouthUpperUpLeft") + get("mouthUpperUpRight")) / 2;
  const disgustedRaw = Math.min(1.0, noseSneer * 0.7 + upperLipUp * 0.3);

  // 7. Neutral: Residual when no active intense emotional muscle activations are detected
  const totalExpressions = happyRaw + sadRaw + angryRaw + fearfulRaw + surprisedRaw + disgustedRaw;
  const neutralRaw = Math.max(0.1, 1.0 - totalExpressions);

  // Normalize so probabilities sum to 1.0
  const total = totalExpressions + neutralRaw || 1.0;

  return {
    neutral: Math.round((neutralRaw / total) * 1000) / 1000,
    happy: Math.round((happyRaw / total) * 1000) / 1000,
    sad: Math.round((sadRaw / total) * 1000) / 1000,
    angry: Math.round((angryRaw / total) * 1000) / 1000,
    fearful: Math.round((fearfulRaw / total) * 1000) / 1000,
    surprised: Math.round((surprisedRaw / total) * 1000) / 1000,
    disgusted: Math.round((disgustedRaw / total) * 1000) / 1000,
  };
}

/**
 * Returns a human-friendly description of the primary expression cue.
 */
function describeDominant(emotions: EmotionMap): string {
  let bestKey = "neutral";
  let bestVal = emotions.neutral;
  for (const key of EMOTION_KEYS) {
    if (emotions[key] > bestVal) {
      bestVal = emotions[key];
      bestKey = key;
    }
  }
  const pct = Math.round(bestVal * 100);
  const capitalized = bestKey.charAt(0).toUpperCase() + bestKey.slice(1);
  return `${capitalized} (${pct}%)`;
}

/**
 * Starts on-device webcam capture and initializes the MediaPipe FaceLandmarker pipeline.
 *
 * Rules:
 * - Green dot is displayed ONLY when stream is active AND model pipeline is ready.
 * - Stops all hardware tracks when stopped.
 * - Samples frames at ~1.2s intervals without overloading CPU.
 * - Rejects frames without a face detected.
 * - Aggregates valid observations across the session.
 */
export async function startFaceSampler(
  video: HTMLVideoElement,
  onStateChange: (state: SamplerState) => void,
): Promise<FaceSamplerHandle> {
  let currentState: SamplerState = {
    status: "connecting",
    statusText: "Connecting...",
    facePresence: "searching",
    sampleCount: 0,
    currentEmotions: null,
    dominantEmotion: null,
  };

  const notify = (patch: Partial<SamplerState>) => {
    currentState = { ...currentState, ...patch };
    onStateChange(currentState);
  };

  // 1. Verify browser media support
  if (!navigator.mediaDevices?.getUserMedia) {
    notify({
      status: "unavailable",
      statusText: "Camera not supported in this browser",
      facePresence: "no_face",
    });
    return {
      stop: () => ({ emotions: null, sampleCount: 0, validFrames: 0, model: "none" }),
      getSnapshot: () => currentState,
    };
  }

  notify({ status: "connecting", statusText: "Connecting..." });

  // 2. Request user media stream
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });
  } catch (err: unknown) {
    const errorName = err instanceof Error ? err.name : "";
    if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
      notify({
        status: "denied",
        statusText: "Camera permission was not granted",
        facePresence: "no_face",
      });
    } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
      notify({
        status: "unavailable",
        statusText: "No camera device detected",
        facePresence: "no_face",
      });
    } else {
      notify({
        status: "error",
        statusText: "Camera could not be started",
        facePresence: "no_face",
      });
    }
    return {
      stop: () => ({ emotions: null, sampleCount: 0, validFrames: 0, model: "none" }),
      getSnapshot: () => currentState,
    };
  }

  // 3. Attach stream to hidden video element
  video.srcObject = stream;
  try {
    await video.play();
  } catch {
    // Autoplay policy or video play issue
  }

  // 4. Initialize MediaPipe FaceLandmarker model in WebAssembly
  let landmarker: FaceLandmarker | null = null;
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
    );
    landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      },
      runningMode: "VIDEO",
      outputFaceBlendshapes: true,
      numFaces: 1,
    });
  } catch (err) {
    console.warn("MediaPipe model loading warning:", err);
    // Stop stream since pipeline cannot run
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    notify({
      status: "error",
      statusText: "Expression model could not load. Continuing with keyboard check-in.",
      facePresence: "no_face",
    });
    return {
      stop: () => ({ emotions: null, sampleCount: 0, validFrames: 0, model: "none" }),
      getSnapshot: () => currentState,
    };
  }

  // Camera is active AND model pipeline is ready — now show green dot!
  notify({
    status: "active",
    statusText: "Camera active",
    facePresence: "searching",
  });

  const samples: EmotionMap[] = [];
  let timerId: number | null = null;
  let active = true;

  // 5. Periodic inference tick (approx once every 1.2 seconds)
  const processFrame = () => {
    if (!active || !landmarker) return;

    if (video.readyState >= 2 && !video.paused && video.videoWidth > 0) {
      try {
        const timestamp = performance.now();
        const results = landmarker.detectForVideo(video, timestamp);

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const blendshapes = results.faceBlendshapes?.[0]?.categories;
          if (blendshapes && blendshapes.length > 0) {
            const current = fromBlendshapes(blendshapes);
            samples.push(current);

            notify({
              facePresence: "detected",
              statusText: "Camera active • Face detected",
              sampleCount: samples.length,
              currentEmotions: current,
              dominantEmotion: describeDominant(current),
            });
          }
        } else {
          notify({
            facePresence: "no_face",
            statusText: "Camera active • Looking for face",
          });
        }
      } catch (e) {
        console.debug("Frame evaluation frame drop:", e);
      }
    }

    if (active) {
      timerId = window.setTimeout(processFrame, 1200);
    }
  };

  // Start processing loop
  processFrame();

  return {
    stop(): FaceSamplerResult {
      active = false;
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
      try {
        landmarker?.close();
      } catch {
        // Safe close
      }
      landmarker = null;

      if (stream) {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // Ignore
          }
        });
        stream = null;
      }
      video.srcObject = null;

      notify({
        status: "off",
        statusText: "Camera off",
        facePresence: "no_face",
        currentEmotions: null,
        dominantEmotion: null,
      });

      // Require at least 3 valid frame observations to consider the camera signal valid
      // Otherwise mark camera signal as unavailable rather than inventing a zero score.
      const hasSufficientData = samples.length >= 3;
      return {
        emotions: hasSufficientData ? averageEmotions(samples) : null,
        sampleCount: samples.length,
        validFrames: samples.length,
        model: "MediaPipe-FaceLandmarker-FACS-v1",
      };
    },
    getSnapshot(): SamplerState {
      return currentState;
    },
  };
}
