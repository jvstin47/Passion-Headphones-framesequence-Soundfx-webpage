export class SequenceFrameLoader {
  constructor(folderPath, totalFrames = 1800, step = 4) {
    this.folderPath = folderPath;
    this.totalFrames = totalFrames;
    this.step = step;
    this.frames = [];
    this.loadedCount = 0;
    this.started = false;
    this.onProgressCallbacks = new Set();
    this.onCompleteCallbacks = new Set();
    
    // Determine the list of indices we actually want to load (every 'step' frames)
    this.targetIndices = [];
    for (let i = 1; i <= this.totalFrames; i += this.step) {
      this.targetIndices.push(i);
    }
    // Make sure the very last frame is included
    if (this.targetIndices[this.targetIndices.length - 1] !== this.totalFrames) {
      this.targetIndices.push(this.totalFrames);
    }
    
    this.totalTargetCount = this.targetIndices.length;
  }

  start(onProgress, onComplete) {
    if (onProgress) this.onProgressCallbacks.add(onProgress);
    if (onComplete) this.onCompleteCallbacks.add(onComplete);

    if (this.started) {
      if (this.loadedCount === this.totalTargetCount) {
        if (onComplete) onComplete();
      } else {
        if (onProgress) onProgress(Math.round((this.loadedCount / this.totalTargetCount) * 100));
      }
      return;
    }
    this.started = true;

    // Define 3 phases of loading for the target indices to allow progressive refinement
    // Phase 1: skeleton frames (every 12th target index)
    const phase1 = [];
    for (let i = 0; i < this.totalTargetCount; i += 12) {
      phase1.push(this.targetIndices[i]);
    }

    // Phase 2: mid-density frames (every 4th target index)
    const phase2 = [];
    for (let i = 0; i < this.totalTargetCount; i += 4) {
      const idx = this.targetIndices[i];
      if (!phase1.includes(idx)) phase2.push(idx);
    }

    // Phase 3: all remaining target frames
    const phase3 = [];
    for (let i = 0; i < this.totalTargetCount; i++) {
      const idx = this.targetIndices[i];
      if (!phase1.includes(idx) && !phase2.includes(idx)) {
        phase3.push(idx);
      }
    }

    const loadQueue = [...phase1, ...phase2, ...phase3];

    const loadNext = () => {
      if (loadQueue.length === 0) return;
      const frameIndex = loadQueue.shift();
      const img = new Image();
      // Pad to 5 digits, as files are named: aura demo_00001.png
      const padIndex = String(frameIndex).padStart(5, '0');
      img.src = `${this.folderPath}/airpods demo_${padIndex}.png`;
      
      img.onload = () => {
        const finalizeLoad = () => {
          this.frames[frameIndex] = img;
          this.loadedCount++;
          
          const pct = Math.round((this.loadedCount / this.totalTargetCount) * 100);
          this.onProgressCallbacks.forEach(cb => cb(pct));

          if (this.loadedCount === this.totalTargetCount) {
            this.onCompleteCallbacks.forEach(cb => cb());
          }
          loadNext();
        };

        if (typeof img.decode === 'function') {
          img.decode()
            .then(finalizeLoad)
            .catch(finalizeLoad);
        } else {
          finalizeLoad();
        }
      };
      
      img.onerror = () => {
        console.warn(`Failed to load frame ${frameIndex} from ${this.folderPath}`);
        this.loadedCount++;
        // Trigger progress callback even for failed frames so loading state resolves
        const pct = Math.round((this.loadedCount / this.totalTargetCount) * 100);
        this.onProgressCallbacks.forEach(cb => cb(pct));
        if (this.loadedCount === this.totalTargetCount) {
          this.onCompleteCallbacks.forEach(cb => cb());
        }
        loadNext();
      };
    };

    // Parallel load workers (6 concurrent requests to load quickly)
    const workers = 6;
    for (let w = 0; w < workers; w++) {
      loadNext();
    }
  }

  getFrame(index) {
    index = Math.min(this.totalFrames, Math.max(1, index));
    if (this.frames[index]) return this.frames[index];
    
    // Nearest neighbor interpolation fallback
    let left = index;
    let right = index;
    while (left > 1 || right < this.totalFrames) {
      if (left > 1) {
        left--;
        if (this.frames[left]) return this.frames[left];
      }
      if (right < this.totalFrames) {
        right++;
        if (this.frames[right]) return this.frames[right];
      }
    }
    return null;
  }
}

// Single singleton loader for the shared frame sequence in /images
export const auraFrameLoader = new SequenceFrameLoader('/images', 1800, 2);
