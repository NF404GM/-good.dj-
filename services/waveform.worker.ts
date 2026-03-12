/**
 * Waveform Analysis Worker
 * Offloads peak extraction and spectral scaling from the main thread.
 */

self.onmessage = (e: MessageEvent) => {
    const { lowData, midData, highData, points, sampleRate } = e.data;
    
    const result: any[] = [];
    const bufferLength = lowData.length;
    const step = Math.floor(bufferLength / points);

    for (let i = 0; i < points; i++) {
        let maxL = 0, maxM = 0, maxH = 0;
        const start = i * step;
        const end = Math.min(start + step, bufferLength);
        
        for (let j = start; j < end; j++) {
            const valL = Math.abs(lowData[j] || 0);
            const valM = Math.abs(midData[j] || 0);
            const valH = Math.abs(highData[j] || 0);
            
            if (valL > maxL) maxL = valL;
            if (valM > maxM) maxM = valM;
            if (valH > maxH) maxH = valH;
        }

        result.push({
            l: Math.min(maxL * 1.5, 1),
            m: Math.min(maxM * 2.0, 1),
            h: Math.min(maxH * 3.0, 1)
        });
    }

    self.postMessage({ result });
};
