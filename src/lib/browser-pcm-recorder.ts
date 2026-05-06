"use client";

export type BrowserPcmRecorder = {
  stop(): Promise<void>;
};

export async function startBrowserPcmRecorder({
  onChunk,
}: {
  onChunk: (audioBase64: string) => void;
}): Promise<BrowserPcmRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    const pcm16 = downsampleToPcm16(input, audioContext.sampleRate, 16_000);
    if (!pcm16.byteLength) return;
    onChunk(arrayBufferToBase64(pcm16.buffer));
  };

  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioContext.destination);

  return {
    async stop() {
      processor.disconnect();
      silentGain.disconnect();
      source.disconnect();
      for (const track of stream.getTracks()) {
        track.stop();
      }
      await audioContext.close().catch(() => {});
    },
  };
}

function downsampleToPcm16(input: Float32Array, inputSampleRate: number, outputSampleRate: number) {
  if (inputSampleRate === outputSampleRate) {
    return floatTo16BitPcm(input);
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.max(0, Math.round(input.length / sampleRateRatio));
  const output = new Int16Array(newLength);
  let outputIndex = 0;
  let inputIndex = 0;

  while (outputIndex < output.length) {
    const nextInputIndex = Math.round((outputIndex + 1) * sampleRateRatio);
    let total = 0;
    let count = 0;
    for (let index = inputIndex; index < nextInputIndex && index < input.length; index += 1) {
      total += input[index] ?? 0;
      count += 1;
    }
    const sample = count ? total / count : 0;
    output[outputIndex] = clampPcmSample(sample);
    outputIndex += 1;
    inputIndex = nextInputIndex;
  }

  return output;
}

function floatTo16BitPcm(input: Float32Array) {
  const output = new Int16Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    output[index] = clampPcmSample(input[index] ?? 0);
  }
  return output;
}

function clampPcmSample(sample: number) {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary);
}
