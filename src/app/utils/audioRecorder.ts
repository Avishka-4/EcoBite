/**
 * audioRecorder.ts — Records crystal-clear 16kHz 16-bit mono WAV audio
 * using the browser / WebView Web Audio API.
 *
 * Direct WAV encoding guarantees full compatibility with Vosk on the backend
 * without relying on external server-side codecs or FFmpeg.
 */

export interface VoiceRecorderSession {
  stop: () => Promise<Blob>;
  cancel: () => void;
}

function writeWavHeader(dataLength: number, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  // "RIFF" chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  return buffer;
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function downsampleBuffer(buffer: Float32Array, inputRate: number, targetRate: number): Float32Array {
  if (inputRate === targetRate) {
    return buffer;
  }
  const ratio = inputRate / targetRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

function floatTo16BitPCM(samples: Float32Array): Int16Array {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm;
}

export async function startWavRecording(): Promise<VoiceRecorderSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextClass();
  const source = audioContext.createMediaStreamSource(stream);

  const bufferSize = 4096;
  const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

  const leftChannelChunks: Float32Array[] = [];

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    leftChannelChunks.push(new Float32Array(input));
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  let isStopped = false;

  const cleanup = () => {
    if (isStopped) return;
    isStopped = true;
    try {
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      audioContext.close().catch(() => {});
    } catch (e) {
      console.warn('Audio cleanup warning:', e);
    }
  };

  return {
    stop: async (): Promise<Blob> => {
      cleanup();

      // Merge Float32 chunks
      let totalLength = 0;
      for (const chunk of leftChannelChunks) {
        totalLength += chunk.length;
      }

      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of leftChannelChunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      // Resample to 16,000 Hz for Vosk
      const targetSampleRate = 16000;
      const resampled = downsampleBuffer(merged, audioContext.sampleRate, targetSampleRate);

      // Convert to 16-bit PCM
      const pcm16 = floatTo16BitPCM(resampled);

      // Create WAV with 44-byte header
      const wavHeader = writeWavHeader(pcm16.byteLength, targetSampleRate);
      return new Blob([wavHeader, pcm16.buffer], { type: 'audio/wav' });
    },
    cancel: () => {
      cleanup();
    },
  };
}
