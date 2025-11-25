
/**
 * BITBEATS AUDIO ENGINE
 * Handles client-side fingerprinting, normalization, and transcoding.
 */

interface AudioAnalysis {
    duration: number;
    peak: number;
    fingerprint: string; // Simplified hash for PoC
    buffer: AudioBuffer;
}

const getAudioContext = () => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    return new AudioContext();
};

/**
 * Calculates a simple fingerprint based on audio data peaks.
 * In a full production app, this would use Chromaprint (fpcalc) via WASM.
 */
const generateFingerprint = (buffer: AudioBuffer): string => {
    const data = buffer.getChannelData(0);
    const step = Math.floor(data.length / 100); // Sample 100 points
    let hash = "";
    
    for(let i = 0; i < 100; i++) {
        const val = data[i * step];
        // Create a simple signature based on amplitude direction and magnitude
        hash += Math.abs(val).toFixed(2).replace('.','');
    }
    
    // Simple hash of the string
    let signature = 0;
    for (let i = 0; i < hash.length; i++) {
        const char = hash.charCodeAt(i);
        signature = ((signature << 5) - signature) + char;
        signature = signature & signature;
    }
    
    return `fp_v1_${Math.abs(signature).toString(16)}`;
};

/**
 * Analyzes an audio file using Web Audio API.
 */
export const analyzeAudio = async (file: File): Promise<AudioAnalysis> => {
    const ctx = getAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    // 1. Calculate Peak (for normalization check)
    let max = 0;
    const data = audioBuffer.getChannelData(0);
    for(let i=0; i < data.length; i++) {
        if(Math.abs(data[i]) > max) max = Math.abs(data[i]);
    }

    // 2. Generate Fingerprint
    const fingerprint = generateFingerprint(audioBuffer);

    return {
        duration: audioBuffer.duration,
        peak: max,
        fingerprint,
        buffer: audioBuffer
    };
};

/**
 * Normalizes audio volume to -1dB and converts to WebM (browser native).
 * This acts as our "Transcoder" step to ensure consistent quality in the swarm.
 */
export const normalizeAndTranscode = async (audioBuffer: AudioBuffer): Promise<Blob> => {
    // We use OfflineAudioContext to render the normalized audio fast
    const offlineCtx = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    // Calculate gain needed to reach -1.0 dB target (approx 0.89 amplitude)
    const TARGET_PEAK = 0.89;
    let currentPeak = 0;
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i++) {
        if (Math.abs(channelData[i]) > currentPeak) currentPeak = Math.abs(channelData[i]);
    }
    
    const gainValue = currentPeak > 0 ? TARGET_PEAK / currentPeak : 1;
    
    const gainNode = offlineCtx.createGain();
    gainNode.gain.value = gainValue;

    source.connect(gainNode);
    gainNode.connect(offlineCtx.destination);
    source.start();

    const renderedBuffer = await offlineCtx.startRendering();

    // Convert AudioBuffer to WAV Blob (Simplest for browser without ffmpeg.wasm)
    return bufferToWave(renderedBuffer, renderedBuffer.length);
};

// Helper: Convert AudioBuffer to WAV Blob
// Source credit: https://www.russellgood.com/how-to-convert-audiobuffer-to-audio-file/
function bufferToWave(abuffer: AudioBuffer, len: number) {
    let numOfChan = abuffer.numberOfChannels,
        length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    // write WAVE header
    setUint32(0x46464952);                         // "RIFF"
    setUint32(length - 8);                         // file length - 8
    setUint32(0x45564157);                         // "WAVE"

    setUint32(0x20746d66);                         // "fmt " chunk
    setUint32(16);                                 // length = 16
    setUint16(1);                                  // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2);                      // block-align
    setUint16(16);                                 // 16-bit (hardcoded in this example)

    setUint32(0x61746164);                         // "data" - chunk
    setUint32(length - pos - 4);                   // chunk length

    // write interleaved data
    for(i = 0; i < abuffer.numberOfChannels; i++)
        channels.push(abuffer.getChannelData(i));

    while(pos < length) {
        for(i = 0; i < numOfChan; i++) {             // interleave channels
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
            view.setInt16(pos, sample, true);          // write 16-bit sample
            pos += 2;
        }
        offset++                                     // next source sample
    }

    // create Blob
    return new Blob([buffer], {type: "audio/wav"});

    function setUint16(data: any) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data: any) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}
