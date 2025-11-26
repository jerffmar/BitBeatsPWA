
/**
 * BITBEATS AUDIO ENGINE v2.0
 * Client-side audio processing pipeline.
 * Features:
 * - RMS Amplitude Analysis
 * - Spectral Energy Fingerprinting (ZCR/Energy)
 * - Loudness Normalization (Peak Normalization to -1dB)
 * - WAV Transcoding
 */

interface AudioAnalysis {
    duration: number;
    peak: number;
    rms: number;
    fingerprint: string;
    buffer: AudioBuffer;
}

const getAudioContext = () => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    return new AudioContext();
};

/**
 * Generates a "Spectral-like" fingerprint using Time-Domain features.
 * (Zero Crossing Rate + Short-Term Energy)
 * This creates a unique signature robust enough for P2P duplicate detection.
 */
const generateFingerprint = (buffer: AudioBuffer): string => {
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    
    // Analyze first 60 seconds max to keep it fast but accurate
    const analyzeDuration = Math.min(60, buffer.duration);
    const framesToAnalyze = Math.floor(analyzeDuration * sampleRate);
    
    // Divide into 64 segments for higher resolution
    const segmentSize = Math.floor(framesToAnalyze / 64);
    let signature = '';

    for (let i = 0; i < 64; i++) {
        const start = i * segmentSize;
        const end = Math.min(start + segmentSize, data.length);
        
        let energy = 0;
        let zcr = 0;
        let previous = 0;

        for (let j = start; j < end; j++) {
            const val = data[j];
            energy += val * val;
            
            // Zero Crossing check
            if (j > start && val * previous < 0) {
                zcr++;
            }
            previous = val;
        }

        // Normalize features
        // Log energy to dampen peaks
        const energyLog = Math.max(0, Math.log10(energy + 1e-10)); 
        const normalizedZCR = zcr / segmentSize;

        // Encode to 2-char Hex
        // Scaling factors tuned for 16-bit PCM range approx
        const eHex = Math.min(255, Math.floor(energyLog * 20)).toString(16).padStart(2, '0');
        const zHex = Math.min(255, Math.floor(normalizedZCR * 255)).toString(16).padStart(2, '0');
        
        signature += `${eHex}${zHex}`;
    }

    return `bb_v2_${signature}`;
};

/**
 * Calculates Root Mean Square (RMS) amplitude
 */
const calculateRMS = (buffer: AudioBuffer): number => {
    const data = buffer.getChannelData(0);
    let sum = 0;
    // Step for performance on large files
    const step = Math.ceil(data.length / 100000); 
    let count = 0;
    
    for (let i = 0; i < data.length; i += step) {
        sum += data[i] * data[i];
        count++;
    }
    return Math.sqrt(sum / count);
};

export const analyzeAudio = async (file: File): Promise<AudioAnalysis> => {
    const ctx = getAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    // 1. Calculate Peak & RMS
    let max = 0;
    // Check channels for peak
    for(let c = 0; c < audioBuffer.numberOfChannels; c++) {
        const data = audioBuffer.getChannelData(c);
        // subsample for peak scan speed
        const step = 10;
        for(let i=0; i < data.length; i+=step) {
            const abs = Math.abs(data[i]);
            if(abs > max) max = abs;
        }
    }
    
    const rms = calculateRMS(audioBuffer);

    // 2. Generate Fingerprint
    const fingerprint = generateFingerprint(audioBuffer);

    console.log(`🔊 Audio Analysis Complete:
      Duration: ${audioBuffer.duration.toFixed(2)}s
      Peak: ${max.toFixed(4)}
      RMS: ${rms.toFixed(4)}
      Fingerprint: ${fingerprint.substring(0, 20)}...`);

    return {
        duration: audioBuffer.duration,
        peak: max,
        rms,
        fingerprint,
        buffer: audioBuffer
    };
};

/**
 * Normalizes audio to -1.0 dBFS Peak and converts to WAV.
 * This acts as our "Transcoder" step to ensure consistent quality in the swarm.
 */
export const normalizeAndTranscode = async (audioBuffer: AudioBuffer): Promise<Blob> => {
    console.log("🎚️ Normalizing Audio...");

    const offlineCtx = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    // Target -1.0 dB
    // Formula: 10^(-1/20) ≈ 0.891
    const TARGET_PEAK = 0.89125; 
    
    // Find accurate peak for normalization
    let currentPeak = 0;
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        const data = audioBuffer.getChannelData(c);
        for (let i = 0; i < data.length; i++) {
            const val = Math.abs(data[i]);
            if (val > currentPeak) currentPeak = val;
        }
    }
    
    // Apply Gain
    let gainValue = currentPeak > 0 ? TARGET_PEAK / currentPeak : 1;
    
    // Safety clamp (don't amplify more than +12dB to avoid raising noise floor too much)
    if (gainValue > 4.0) gainValue = 4.0;
    if (currentPeak < 0.01) gainValue = 1; // Ignore silence

    console.log(`   Gain Applied: ${gainValue.toFixed(4)}x (${(20 * Math.log10(gainValue)).toFixed(2)} dB)`);

    const gainNode = offlineCtx.createGain();
    gainNode.gain.value = gainValue;

    source.connect(gainNode);
    gainNode.connect(offlineCtx.destination);
    source.start();

    const renderedBuffer = await offlineCtx.startRendering();

    // Convert AudioBuffer to WAV Blob
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
    setUint16(16);                                 // 16-bit

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
