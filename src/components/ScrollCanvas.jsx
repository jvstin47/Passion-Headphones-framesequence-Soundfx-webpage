import React, { useRef, useEffect, useState } from 'react';

export default function ScrollCanvas({ 
  loader,
  currentFrame = 1,
  hotspots = [],
  selectedMaterial = 'silver',
  className = ''
}) {
  const canvasRef = useRef(null);
  const [loadedPercent, setLoadedPercent] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [activeHotspotIndex, setActiveHotspotIndex] = useState(null);
  
  const drawFrameRef = useRef(null);

  // Keep a ref of selectedMaterial to prevent closure issues in event listeners
  const materialRef = useRef(selectedMaterial);
  useEffect(() => {
    materialRef.current = selectedMaterial;
  }, [selectedMaterial]);

  // Start preloading frames in background
  useEffect(() => {
    loader.start(
      (pct) => setLoadedPercent(pct),
      () => setIsComplete(true)
    );
  }, [loader]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const parent = canvas.parentNode;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      
      const imgRatio = 1920 / 1080;
      const canvasWidth = rect.width;
      const canvasHeight = rect.height;
      const canvasRatio = canvasWidth / canvasHeight;

      let drawWidth, drawHeight, x, y;
      const isPortrait = canvasWidth < canvasHeight;
      let scaleFactor = 0.90; // Premium padding
      
      if (isPortrait) {
        scaleFactor = 1.20;
      }

      if (imgRatio > canvasRatio) {
        drawWidth = canvasWidth * scaleFactor;
        drawHeight = drawWidth / imgRatio;
      } else {
        drawHeight = canvasHeight * scaleFactor;
        drawWidth = drawHeight * imgRatio;
      }

      x = (canvasWidth - drawWidth) / 2;
      
      if (isPortrait) {
        y = (canvasHeight * 0.40) - (drawHeight / 2);
      } else {
        y = (canvasHeight - drawHeight) / 2;
      }

      // Expose drawn boundaries for coordinate translation
      parent.style.setProperty('--img-left', `${x}px`);
      parent.style.setProperty('--img-top', `${y}px`);
      parent.style.setProperty('--img-width', `${drawWidth}px`);
      parent.style.setProperty('--img-height', `${drawHeight}px`);

      if (drawFrameRef.current) {
        drawFrameRef.current(currentFrame);
      }
    };

    const drawFrame = (frameIdx) => {
      const img = loader.getFrame(frameIdx);
      if (!img) return;

      const rect = canvas.parentNode.getBoundingClientRect();
      const canvasWidth = rect.width;
      const canvasHeight = rect.height;

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      const imgRatio = img.width / img.height;
      const canvasRatio = canvasWidth / canvasHeight;

      let drawWidth, drawHeight, x, y;
      const isPortrait = canvasWidth < canvasHeight;
      let scaleFactor = 0.90;
      
      if (isPortrait) {
        scaleFactor = 1.20;
      }

      if (imgRatio > canvasRatio) {
        drawWidth = canvasWidth * scaleFactor;
        drawHeight = drawWidth / imgRatio;
      } else {
        drawHeight = canvasHeight * scaleFactor;
        drawWidth = drawHeight * imgRatio;
      }

      x = (canvasWidth - drawWidth) / 2;
      
      if (isPortrait) {
        y = (canvasHeight * 0.40) - (drawHeight / 2);
      } else {
        y = (canvasHeight - drawHeight) / 2;
      }

      ctx.save();

      // Apply dynamic canvas filter depending on chosen metallurgy material
      const material = materialRef.current;
      let filterString = 'none';
      if (material === 'silver') {
        // Desaturate and brighten to make it silver/cool-grey
        filterString = 'grayscale(100%) brightness(1.05) contrast(1.05)';
      } else if (material === 'graphite') {
        // Desaturate and darken to create metallic graphite/space-grey finish
        filterString = 'grayscale(100%) brightness(0.48) contrast(1.22)';
      } else if (material === 'indigo') {
        // Enhance the default blue color to match the vibrant indigo swatch
        filterString = 'hue-rotate(-5deg) saturate(1.15) brightness(0.95)';
      }
      ctx.filter = filterString;

      ctx.drawImage(img, x, y, drawWidth, drawHeight);
      ctx.restore();
    };

    drawFrameRef.current = drawFrame;

    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(canvas.parentNode);

    resizeCanvas();

    return () => {
      resizeObserver.disconnect();
    };
  }, [loader]);

  // Redraw when the frame changes, loading updates, or selected material updates
  useEffect(() => {
    if (drawFrameRef.current) {
      drawFrameRef.current(currentFrame);
    }
  }, [currentFrame, loadedPercent, selectedMaterial]);

  const handleHotspotClick = (index, e) => {
    e.stopPropagation();
    if (activeHotspotIndex === index) {
      setActiveHotspotIndex(null);
    } else {
      setActiveHotspotIndex(index);
    }
  };

  return (
    <div 
      className={`canvas-container ${className}`} 
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
      onClick={() => setActiveHotspotIndex(null)}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', zIndex: 1 }} />
      
      {/* Centralized Hotspots Overlay */}
      {hotspots && hotspots.map((spot, index) => {
        const isVisible = currentFrame >= spot.startFrame && currentFrame <= spot.endFrame;
        return (
          <div 
            key={index} 
            className={`hotspot-marker ${isVisible ? 'is-visible' : ''} ${activeHotspotIndex === index ? 'is-active' : ''}`} 
            style={{
              '--hotspot-x-pct': spot.xPct,
              '--hotspot-y-pct': spot.yPct
            }}
          >
            <button 
              type="button"
              className="hotspot-trigger"
              onClick={(e) => handleHotspotClick(index, e)}
              aria-label={`Inspect ${spot.label}`}
            />
            <div className="hotspot-tooltip">
              <span className="hotspot-tooltip__label">{spot.label}</span>
              <p className="hotspot-tooltip__desc">{spot.desc}</p>
            </div>
          </div>
        );
      })}
      
      {/* Progressive loading HUD bar */}
      {!isComplete && loadedPercent < 100 && (
        <div className="canvas-loader-indicator">
          <span className="canvas-loader-indicator__pulse" />
          <span className="canvas-loader-indicator__text">DOWNLOADING TELEMETRY... {loadedPercent}%</span>
        </div>
      )}
    </div>
  );
}
