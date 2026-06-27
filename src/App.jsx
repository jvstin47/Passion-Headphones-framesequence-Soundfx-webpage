import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sliders, AudioLines, Settings, Menu, X, ArrowRight, Play, Eye, Cpu, Compass, Activity, Volume2, Shield } from 'lucide-react';
import { auraFrameLoader } from './utils/frameLoader';
import { audioSynth } from './utils/audioSynthesizer';
import ScrollCanvas from './components/ScrollCanvas';
import FadeIn from './components/FadeIn';
import AnimatedNumber from './components/AnimatedNumber';

// Chapter accent cursor colors (solid RGB for radial glow)
const chapterCursorColors = {
  overview:    'rgba(197, 203, 211, 0.06)',
  materials:   'rgba(99, 102, 241, 0.07)',
  engineering: 'rgba(20, 184, 166, 0.07)',
  comfort:     'rgba(139, 92, 246, 0.07)',
  showcase:    'rgba(6, 182, 212, 0.07)',
};

// Helper function to calculate precise opacity transitions
const getScrollOpacity = (progress, start, peakStart, peakEnd, end) => {
  if (progress < start || progress > end) return 0;
  if (progress >= peakStart && progress <= peakEnd) return 1;
  if (progress < peakStart) {
    return (progress - start) / (peakStart - start);
  } else {
    return (end - progress) / (end - peakEnd);
  }
};

const chapters = [
  {
    id: 'overview',
    label: 'Overview',
    startFrame: 1,
    endFrame: 360,
    title: 'Designed with absolute restraint.',
    desc: 'Every detail has been meticulously crafted by Passion Audio Laboratories, from the tension mesh canopy to the acoustic cushions, creating a quiet atmosphere of pure, unfiltered sound.',
    telemetryStage: '01 / SYSTEM OVERVIEW',
    telemetryTitle: 'PASSION AURA',
    accentColor: 'rgba(197, 203, 211, 0.08)', // Silver glow
    hotspots: []
  },
  {
    id: 'materials',
    label: 'Materials',
    startFrame: 361,
    endFrame: 720,
    title: 'Tension mesh & steel core.',
    desc: 'The headband suspension is wrapped in custom tension mesh, distributing weight to eliminate pressure. The anodized aluminium earcups pivot on precision stainless joints.',
    telemetryStage: '02 / ARCHITECTURE',
    telemetryTitle: 'SUSPENSION MESH',
    accentColor: 'rgba(99, 102, 241, 0.15)', // Indigo glow
    hotspots: [
      { xPct: 50, yPct: 18, startFrame: 420, endFrame: 560, label: 'Tension Mesh Canopy', desc: 'Breathable composite weave distributes weight to eliminate pressure.' },
      { xPct: 32, yPct: 48, startFrame: 580, endFrame: 710, label: 'Stainless Steel Arms', desc: 'Precision dampening mechanism ensures continuous adjustment.' }
    ]
  },
  {
    id: 'engineering',
    label: 'Engineering',
    startFrame: 721,
    endFrame: 1080,
    title: 'Pure, acoustic resolution.',
    desc: 'A proprietary 40mm dynamic driver reproduces wide frequency spectrums. Double Aura Core S1 coprocessors calculate ambient adjustments 200 times per second.',
    telemetryStage: '03 / TRANSDUCERS',
    telemetryTitle: 'ACOUSTIC REFINEMENT',
    accentColor: 'rgba(20, 184, 166, 0.15)', // Teal glow
    hotspots: [
      { xPct: 48, yPct: 55, startFrame: 780, endFrame: 920, label: 'Aura Core S1 Chip', desc: 'Custom digital sound processor runs 10 independent audio cores.' },
      { xPct: 38, yPct: 60, startFrame: 930, endFrame: 1060, label: '40mm Dynamic Driver', desc: 'Passion-engineered voice coils create linear diaphragm stroke for low distortion.' }
    ]
  },
  {
    id: 'comfort',
    label: 'Interface',
    startFrame: 1081,
    endFrame: 1440,
    title: 'The crown of interaction.',
    desc: 'A mechanical crown lets you adjust volume with fluid precision. Anodized aluminium cups pivot independently on a revolutionary mechanism, securing a balanced acoustic seal.',
    telemetryStage: '04 / INTERACTION',
    telemetryTitle: 'MECHANICS & SEALS',
    accentColor: 'rgba(139, 92, 246, 0.15)', // Violet glow
    hotspots: [
      { xPct: 64, yPct: 72, startFrame: 1120, endFrame: 1260, label: 'Mechanical Crown', desc: 'Milled aluminium dials volume adjustment and mode switching.' },
      { xPct: 54, yPct: 66, startFrame: 1280, endFrame: 1420, label: 'Memory Foam Cushions', desc: 'Acoustically isolation wraps memory foam sealing out environment hum.' }
    ]
  },
  {
    id: 'showcase',
    label: 'Showcase',
    startFrame: 1441,
    endFrame: 1800,
    title: 'Precision in every surface.',
    desc: 'Built from carefully selected metals. Calibrated for high-fidelity audio. Designed by Passion in Geneva.',
    telemetryStage: '05 / FINAL COMPOSITION',
    telemetryTitle: 'EXHIBIT COMPLETE',
    accentColor: 'rgba(6, 182, 212, 0.15)', // Cyan glow
    hotspots: []
  }
];

// Flatten all hotspots for global canvas handling
const allHotspots = chapters.flatMap(ch => ch.hotspots);

export default function App() {
  const [audioStarted, setAudioStarted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ancMode, setAncMode] = useState('ON'); 
  const [selectedMaterial, setSelectedMaterial] = useState('silver'); 
  const [activeComponent, setActiveComponent] = useState('transducer'); 
  const [currentFrame, setCurrentFrame] = useState(1);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);

  // Refs for scroll and coordinates
  const masterContainerRef = useRef(null);
  const lastActiveIndexRef = useRef(0);
  const lastTickStepRef = useRef(0);
  const navActiveTextRef = useRef(null);
  const telemetryFrameRef = useRef(null);
  const telemetryStageRef = useRef(null);
  const telemetryTitleRef = useRef(null);
  const telemetryDashboardRef = useRef(null);
  const timelineBarFillRef = useRef(null);
  const floatingSidebarRef = useRef(null);
  const waveformRef = useRef(null);
  const mouseLightRef = useRef(null);

  // Initialize and update cursor light gradients + magnetic pull
  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = e.clientX;
      const y = e.clientY;
      document.documentElement.style.setProperty('--mouse-x', `${x}px`);
      document.documentElement.style.setProperty('--mouse-y', `${y}px`);

      // Magnetic pull effect on interactive elements
      const magneticEls = document.querySelectorAll('.magnetic-hover');
      magneticEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const elCenterX = rect.left + rect.width / 2;
        const elCenterY = rect.top + rect.height / 2;
        const distX = x - elCenterX;
        const distY = y - elCenterY;
        const dist = Math.sqrt(distX * distX + distY * distY);
        const threshold = 120;

        if (dist < threshold) {
          const pull = (1 - dist / threshold) * 6;
          el.style.transform = `translate(${distX * pull / threshold}px, ${distY * pull / threshold}px)`;
        } else {
          el.style.transform = '';
        }
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Update cursor ambient glow color based on active chapter
  useEffect(() => {
    const activeChapter = chapters[activeChapterIndex];
    if (activeChapter && mouseLightRef.current) {
      const color = chapterCursorColors[activeChapter.id] || chapterCursorColors.overview;
      mouseLightRef.current.style.background = 
        `radial-gradient(circle 350px at var(--mouse-x, 0px) var(--mouse-y, 0px), ${color}, transparent 80%)`;
    }
  }, [activeChapterIndex]);

  // Update synthesized ANC ambient filters
  useEffect(() => {
    if (audioStarted) {
      audioSynth.setANCMode(ancMode);
    }
  }, [ancMode, audioStarted]);

  // Frame preloader start
  useEffect(() => {
    auraFrameLoader.start();
  }, []);

  // Real-time oscilloscope / waveform visualizer loop
  useEffect(() => {
    if (!audioStarted || !waveformRef.current) return;

    const canvas = waveformRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId;
    const bufferLength = audioSynth.analyser ? audioSynth.analyser.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (audioSynth.analyser) {
        audioSynth.analyser.getByteTimeDomainData(dataArray);
      } else {
        dataArray.fill(128);
      }

      // Draw horizontal mid grid line
      ctx.strokeStyle = 'rgba(197, 203, 211, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Draw subtle grid subdivisions
      ctx.beginPath();
      for (let x = 20; x < width; x += 20) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      ctx.stroke();

      // Setup dynamic wave stroke color to match the active chapter accent color
      let strokeColor = '#14b8a6'; // Default Teal
      const activeChapter = chapters[activeChapterIndex];
      if (activeChapter) {
        if (activeChapter.id === 'materials') strokeColor = '#6366f1';
        else if (activeChapter.id === 'engineering') strokeColor = '#14b8a6';
        else if (activeChapter.id === 'comfort') strokeColor = '#8b5cf6';
        else if (activeChapter.id === 'showcase') strokeColor = '#06b6d4';
        else strokeColor = '#c5cbd3';
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [audioStarted, activeChapterIndex]);

  // Performance-optimized direct scroll manipulation
  useEffect(() => {
    const handleScroll = () => {
      if (!masterContainerRef.current) return;

      const windowHeight = window.innerHeight;
      const masterRect = masterContainerRef.current.getBoundingClientRect();
      
      const scrolled = -masterRect.top;
      const totalTimelineHeight = (windowHeight * 1.8 * chapters.length) - windowHeight;
      const globalProgress = Math.min(1, Math.max(0, scrolled / totalTimelineHeight));

      // Calculate global frame count (1 to 1800)
      const globalFrame = Math.floor(globalProgress * 1799) + 1;
      setCurrentFrame(globalFrame);

      const padFrame = String(globalFrame).padStart(5, '0');

      // Update active chapter configurations based on scroll progress splits
      let activeIndex = Math.min(
        chapters.length - 1,
        Math.floor(globalProgress * chapters.length)
      );

      setActiveChapterIndex(activeIndex);
      const activeChapter = chapters[activeIndex];

      // Play section transition whoosh
      if (activeIndex !== lastActiveIndexRef.current) {
        lastActiveIndexRef.current = activeIndex;
        if (audioStarted) {
          audioSynth.playWhoosh();
        }
      }

      // Play tactical micro sound milestone effects
      if (audioStarted) {
        audioSynth.updateAmbienceScroll(globalProgress);
        audioSynth.triggerMilestoneScroll(globalProgress);
      }

      // Update floating indicators directly (bypassing React re-render lag)
      if (navActiveTextRef.current) {
        navActiveTextRef.current.innerText = activeChapter.label.toUpperCase();
      }

      if (telemetryFrameRef.current) {
        telemetryFrameRef.current.innerText = padFrame;
      }

      if (telemetryStageRef.current) {
        telemetryStageRef.current.innerText = activeChapter.telemetryStage;
      }

      if (telemetryTitleRef.current) {
        telemetryTitleRef.current.innerText = activeChapter.telemetryTitle;
      }

      // Update visual indicator theme accents dynamically
      if (telemetryDashboardRef.current) {
        telemetryDashboardRef.current.style.borderColor = activeChapter.id === 'overview' ? 'var(--color-silver)' : `var(--color-accent-${activeChapter.id === 'materials' ? 'indigo' : activeChapter.id === 'engineering' ? 'teal' : activeChapter.id === 'comfort' ? 'violet' : 'cyan'})`;
      }

      // Update vertical sidebar timeline dots & active lines
      if (timelineBarFillRef.current) {
        timelineBarFillRef.current.style.height = `${globalProgress * 100}%`;
      }

      const dots = document.querySelectorAll('.timeline-dot');
      dots.forEach((dot, idx) => {
        if (idx <= activeIndex) {
          dot.classList.add('is-active');
        } else {
          dot.classList.remove('is-active');
        }
      });

      // Animate Chapter Text Overlays based on their local scroll heights
      const chapterSections = document.querySelectorAll('.chapter-section');
      chapterSections.forEach((section, index) => {
        const rect = section.getBoundingClientRect();
        const localScrolled = -rect.top;
        const localTotalHeight = rect.height - windowHeight;
        const localProgress = localTotalHeight > 0 
          ? Math.min(1, Math.max(0, localScrolled / localTotalHeight)) 
          : 0;

        const overlay = section.querySelector('.chapter-overlay');
        if (overlay) {
          const opacity = getScrollOpacity(localProgress, 0.0, 0.20, 0.70, 0.95);
          // Parallax depth: text moves at a slower rate than scroll, creating depth
          const parallaxOffset = (localProgress - 0.5) * -40; // subtle vertical shift
          const horizontalDrift = (localProgress - 0.5) * 8; // very subtle horizontal parallax
          overlay.style.opacity = opacity;
          overlay.style.transform = `translate(${horizontalDrift}px, ${25 * (1 - opacity) + parallaxOffset}px)`;
          overlay.style.pointerEvents = opacity > 0.15 ? 'auto' : 'none';
        }

        // Parallax on the chapter number tag (moves faster for layered depth)
        const chapterNum = section.querySelector('.chapter-overlay__num');
        if (chapterNum) {
          const numParallax = (localProgress - 0.5) * -20;
          chapterNum.style.transform = `translateY(${numParallax}px)`;
        }

        // Trigger mechanical crown dial ticking sound as user rotates the crown in Chapter 4
        const ch = chapters[index];
        if (ch.id === 'comfort' && activeChapter.id === 'comfort') {
          const tickStep = Math.floor(localProgress * 70);
          if (tickStep !== lastTickStepRef.current) {
            lastTickStepRef.current = tickStep;
            if (audioStarted) {
              audioSynth.playCrownTick();
            }
          }
        }
      });

      // Hide telemetry dashboard, floating sidebar, and timeline dock when scrolling into static specs
      if (telemetryDashboardRef.current) {
        if (globalProgress >= 0.99 || masterRect.bottom <= windowHeight + 100) {
          telemetryDashboardRef.current.style.opacity = 0;
          telemetryDashboardRef.current.style.pointerEvents = 'none';
        } else {
          telemetryDashboardRef.current.style.opacity = 1;
          telemetryDashboardRef.current.style.pointerEvents = 'auto';
        }
      }

      if (floatingSidebarRef.current) {
        if (globalProgress >= 0.99 || masterRect.bottom <= windowHeight + 100) {
          floatingSidebarRef.current.style.opacity = 0;
          floatingSidebarRef.current.style.pointerEvents = 'none';
        } else {
          floatingSidebarRef.current.style.opacity = 1;
          floatingSidebarRef.current.style.pointerEvents = 'auto';
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [audioStarted]);

  // Commence exhibition overlay handler
  const handleCommenceClick = () => {
    audioSynth.init();
    audioSynth.playMetalClick();
    audioSynth.setANCMode(ancMode);
    setAudioStarted(true);
  };

  const handleLinkClick = (id) => {
    if (audioStarted) audioSynth.playClick(0.02);
    setMenuOpen(false);
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleMaterialChange = (material) => {
    if (audioStarted) audioSynth.playFabric();
    setSelectedMaterial(material);
  };

  const handleComponentSelect = (comp) => {
    if (audioStarted) {
      if (comp === 'mesh') audioSynth.playFabric();
      else if (comp === 'dsp') audioSynth.playServo();
      else audioSynth.playMetalClick();
    }
    setActiveComponent(comp);
  };

  const handleModeChange = (mode) => {
    if (audioStarted) audioSynth.playClick(0.04);
    setAncMode(mode);
  };

  const activeChapter = chapters[activeChapterIndex];

  return (
    <div className="app-root">
      {/* Immersive cursor-following glow highlight */}
      <div ref={mouseLightRef} className="cursor-ambient-light" />

      {/* Dynamic Background color glow that responds to chapters */}
      <div 
        className="global-color-glow" 
        style={{ '--active-glow': activeChapter ? activeChapter.accentColor : 'rgba(197, 203, 211, 0.08)' }} 
      />

      {/* SINGLE FIXED BACKGROUND CANVAS CONTAINER */}
      <div className="global-canvas-background">
        <ScrollCanvas 
          loader={auraFrameLoader}
          currentFrame={currentFrame}
          hotspots={allHotspots}
          selectedMaterial={selectedMaterial}
        />
      </div>

      {/* ENTRANCE SCREEN (Autoplay audio blocker) */}
      {!audioStarted && (
        <div className="audio-commence-overlay">
          <div className="commence-blueprint-lines">
            <div className="blueprint-col" />
            <div className="blueprint-col" />
          </div>
          <div className="commence-content">
            <span className="commence-brand">PASSION AUDIO LABS</span>
            <h1 className="commence-title">AURA</h1>
            <p className="commence-subtitle">
              An interactive exhibition of spatial sound, metal architecture, and acoustic calibration.
            </p>
            <button 
              type="button" 
              className="btn btn--ghost btn--large commence-btn"
              onClick={handleCommenceClick}
            >
              COMMENCE EXHIBITION
            </button>
            <div className="commence-footer-note">
              <span className="footer-pulse-dot" />
              <span>HEADPHONES RECOMMENDED FOR FULL SPATIAL IMMERSION</span>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING NAVIGATION PILL DOCK */}
      <header className="nav-pill-dock">
        <div className="dock-logo magnetic-hover">
          <span className="dock-brand-name">PASSION</span>
        </div>
        <div className="dock-separator" />
        <div className="dock-active-section">
          <span ref={navActiveTextRef} className="dock-active-text">OVERVIEW</span>
        </div>
        <div className="dock-separator" />
        <button 
          type="button"
          className="dock-menu-trigger" 
          onClick={() => {
            if (audioStarted) audioSynth.playClick(0.02);
            setMenuOpen(!menuOpen);
          }}
          aria-label="Toggle Navigation Menu"
        >
          {menuOpen ? <X size={15} /> : <Menu size={15} />}
        </button>
      </header>

      {/* SLIDE-OUT DRAWER HAMBURGER MENU */}
      <div className={`slideout-menu-wrapper ${menuOpen ? 'is-open' : ''}`} onClick={() => setMenuOpen(false)}>
        <div className="slideout-menu-drawer" onClick={(e) => e.stopPropagation()}>
          <div className="menu-header">
            <span className="menu-title-tag">EXHIBIT INDEX</span>
            <button 
              type="button" 
              className="menu-close-btn" 
              onClick={() => {
                if (audioStarted) audioSynth.playClick(0.02);
                setMenuOpen(false);
              }}
            >
              <X size={18} />
            </button>
          </div>
          
          <nav className="menu-links-list">
            {chapters.map((ch, index) => (
              <button 
                key={ch.id}
                type="button"
                className="menu-link-item"
                style={{ '--stagger-index': index }}
                onClick={() => handleLinkClick(`chapter-${ch.id}`)}
              >
                <span className="link-num">0{index + 1}</span>
                <span className="link-text">{ch.label}</span>
                <ArrowRight className="link-arrow" size={20} />
              </button>
            ))}
            <button 
              type="button"
              className="menu-link-item" 
              style={{ '--stagger-index': chapters.length }}
              onClick={() => handleLinkClick('materials-grid')}
            >
              <span className="link-num">06</span>
              <span className="link-text">Specifications</span>
              <ArrowRight className="link-arrow" size={20} />
            </button>
          </nav>
          
          <div className="menu-footer">
            <p className="menu-footer-copy">© 2026 PASSION AUDIO LABS. GENEVA.</p>
            <div className="menu-footer-system">
              <span>CORE_S1: ACTIVE</span>
              <span>•</span>
              <span>ANC_LATENCY: 1.1ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING SIDELINE PROGRESS DOCK */}
      <aside ref={floatingSidebarRef} className="floating-timeline-sidebar">
        <div className="timeline-tracker-line">
          <div ref={timelineBarFillRef} className="timeline-tracker-fill" />
        </div>
        <div className="timeline-dots-wrapper">
          {chapters.map((ch, idx) => (
            <button 
              key={ch.id}
              type="button"
              className="timeline-dot-btn"
              onClick={() => handleLinkClick(`chapter-${ch.id}`)}
              aria-label={`Scroll to ${ch.label}`}
            >
              <div className="timeline-dot" />
              <span className="timeline-dot-label">{ch.label.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* WATERMARK-HIDING TELEMETRY DOCK */}
      <section ref={telemetryDashboardRef} className="telemetry-dashboard">
        <div className="telemetry-dashboard__top">
          <div className="telemetry-dashboard__status">
            <span className="status-pulse-dot" />
            <span ref={telemetryStageRef} className="status-stage-label">01 / SYSTEM OVERVIEW</span>
          </div>
          <div className="telemetry-dashboard__frame">
            <span className="frame-num-label">FRAME:</span>
            <span ref={telemetryFrameRef} className="frame-num-value">00001</span>
          </div>
        </div>
        
        <div className="telemetry-dashboard__divider" />
        
        <div className="telemetry-dashboard__body">
          <div className="telemetry-sound-card">
            <span className="sound-card-title">ANC COPROCESSOR SIGNATURE</span>
            <div className="sound-card-visualizer">
              <canvas ref={waveformRef} width="140" height="24" className="sound-card-canvas" />
            </div>
          </div>
          
          <div className="telemetry-system-card">
            <span className="sound-card-title">SYSTEM REVELATION</span>
            <span ref={telemetryTitleRef} className="system-identity-value">PASSION AURA</span>
          </div>
        </div>

        <div className="telemetry-dashboard__divider" />

        <div className="telemetry-dashboard__controls">
          <span className="controls-title">ACOUSTIC STATE CONTROLLER</span>
          <div className="anc-mode-buttons">
            <button 
              type="button" 
              className={`anc-mode-btn ${ancMode === 'ON' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('ON')}
            >
              ANC ON
            </button>
            <button 
              type="button" 
              className={`anc-mode-btn ${ancMode === 'TRANSPARENCY' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('TRANSPARENCY')}
            >
              AMBIENT
            </button>
            <button 
              type="button" 
              className={`anc-mode-btn ${ancMode === 'OFF' ? 'is-active' : ''}`}
              onClick={() => handleModeChange('OFF')}
            >
              OFF
            </button>
          </div>
        </div>
      </section>

      {/* STICKY TEXT OVERLAYS */}
      <main ref={masterContainerRef} className="scroll-chapters-wrapper">
        {chapters.map((ch) => (
          <section 
            key={ch.id} 
            id={`chapter-${ch.id}`} 
            className="chapter-section"
          >
            <div className="sticky-viewport">
              <div className="vignette-overlay" />
              <div className="left-gradient-overlay" />
              
              <div className="chapter-overlay" style={{ opacity: 0, transform: 'translateY(25px)', pointerEvents: 'none' }}>
                <span className="chapter-overlay__num">CHAPTER 0{chapters.indexOf(ch) + 1}</span>
                <h2 className="chapter-overlay__title">{ch.title}</h2>
                <p className="chapter-overlay__desc">{ch.desc}</p>
                {ch.id === 'overview' && (
                  <div className="scroll-indicator-cue">
                    <span className="scroll-cue-text">SCROLL DOWN TO INITIATE SEQUENCE</span>
                    <div className="scroll-cue-indicator-bar" />
                  </div>
                )}
              </div>
            </div>
          </section>
        ))}
      </main>

      {/* INTERACTIVE MATERIAL EXPLORER */}
      <section className="interactive-material-explorer">
        <div className="container">
          <div className="explorer-header">
            <span className="tech-section-tag">TACTILE EXPLORER</span>
            <h2 className="explorer-title">Material Metallurgy</h2>
            <p className="explorer-desc">
              Interact with custom swatches to review the structural integrity and aesthetic properties of Aura's chassis elements.
            </p>
          </div>

          <div className="explorer-grid">
            <div className="material-details-card">
              <div className="swatches-row">
                <button 
                  type="button" 
                  className={`swatch-btn ${selectedMaterial === 'silver' ? 'is-active' : ''}`}
                  onClick={() => handleMaterialChange('silver')}
                  style={{ '--swatch-color': '#c5cbd3' }}
                >
                  Silver
                </button>
                <button 
                  type="button" 
                  className={`swatch-btn ${selectedMaterial === 'indigo' ? 'is-active' : ''}`}
                  onClick={() => handleMaterialChange('indigo')}
                  style={{ '--swatch-color': '#425873' }}
                >
                  Indigo
                </button>
                <button 
                  type="button" 
                  className={`swatch-btn ${selectedMaterial === 'graphite' ? 'is-active' : ''}`}
                  onClick={() => handleMaterialChange('graphite')}
                  style={{ '--swatch-color': '#2a2f38' }}
                >
                  Graphite
                </button>
              </div>

              <div className="material-metadata-box">
                {selectedMaterial === 'silver' && (
                  <div className="material-data-info">
                    <h4 className="material-info-title">ANODIZED ALUM-SILVER</h4>
                    <p className="material-info-body">
                      Precision-milled aerospace grade aluminium. Surface bead-blasted to achieve a micro-matte reflection that rejects skin oil marks.
                    </p>
                  </div>
                )}
                {selectedMaterial === 'indigo' && (
                  <div className="material-data-info">
                    <h4 className="material-info-title">DEEP AURA INDIGO</h4>
                    <p className="material-info-body">
                      Anodized color infusion utilizing magnetic oxidation. Provides deep chemical bonds with zero pigment peeling.
                    </p>
                  </div>
                )}
                {selectedMaterial === 'graphite' && (
                  <div className="material-data-info">
                    <h4 className="material-info-title">VAPOR GRAPHITE COAT</h4>
                    <p className="material-info-body">
                      Carbon-vapor deposition creates a diamond-like hardness threshold, shielding the earcups against abrasive contact.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className={`explorer-preview-panel ${selectedMaterial}`}>
              <div className="preview-metal-surface">
                <div className="surface-light-flare" />
                <span className="surface-logo">AURA METALLURGY</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE EXPLODED ENGINEERING EXPLORER */}
      <section id="engineering-explorer" className="technical-grid-section">
        <div className="container">
          <div className="tech-section-header">
            <span className="tech-section-tag">ENGINEERING INTERACTION</span>
            <h2 className="tech-section-title">Explore the Internal Architecture.</h2>
            <p className="tech-section-sub">Click individual component systems to isolate assembly metrics.</p>
          </div>

          <div className="exploded-explorer-layout">
            <div className="explorer-controls-list">
              <button 
                type="button"
                className={`explorer-control-row ${activeComponent === 'transducer' ? 'is-active' : ''}`}
                onClick={() => handleComponentSelect('transducer')}
              >
                <div className="control-row-num">01</div>
                <div className="control-row-main">
                  <span className="control-row-label">PROPRIETARY TRANSDUCER MOTOR</span>
                  <span className="control-row-sub">40mm Dynamic Driver System</span>
                </div>
              </button>

              <button 
                type="button"
                className={`explorer-control-row ${activeComponent === 'dsp' ? 'is-active' : ''}`}
                onClick={() => handleComponentSelect('dsp')}
              >
                <div className="control-row-num">02</div>
                <div className="control-row-main">
                  <span className="control-row-label">AURA CORE S1 COPROCESSOR</span>
                  <span className="control-row-sub">Dual-DSP Computational Engine</span>
                </div>
              </button>

              <button 
                type="button"
                className={`explorer-control-row ${activeComponent === 'mesh' ? 'is-active' : ''}`}
                onClick={() => handleComponentSelect('mesh')}
              >
                <div className="control-row-num">03</div>
                <div className="control-row-main">
                  <span className="control-row-label">TENSION SUSPENSION MESH</span>
                  <span className="control-row-sub">Comfort pressure dispersal canopy</span>
                </div>
              </button>
            </div>

            <div className="explorer-visuals-panel">
              <div className="blueprint-overlay-box">
                <div className="blueprint-axis-line" />
                {activeComponent === 'transducer' && (
                  <div className="blueprint-component-card">
                    <Eye className="component-icon" size={24} />
                    <h3 className="component-name">TRANSDUCER ASSEMBLY</h3>
                    <p className="component-details">
                      Passion-engineered voice coils create linear diaphragm stroke for low distortion. Dual-neodymium ring magnets produce continuous motor force.
                    </p>
                    <div className="component-stat-pill">THD &lt; <AnimatedNumber value={0.08} decimals={2} duration={1200} />% / 1mW</div>
                  </div>
                )}
                {activeComponent === 'dsp' && (
                  <div className="blueprint-component-card">
                    <Cpu className="component-icon" size={24} />
                    <h3 className="component-name">AURA CORE S1 CHIP</h3>
                    <p className="component-details">
                      Features 10 independent audio cores per cup. Processes 9 billion operations per second to run dynamic spatial mapping and active noise cancellation.
                    </p>
                    <div className="component-stat-pill">CALIBRATION RATE: <AnimatedNumber value={200} duration={1500} />Hz</div>
                  </div>
                )}
                {activeComponent === 'mesh' && (
                  <div className="blueprint-component-card">
                    <Shield className="component-icon" size={24} />
                    <h3 className="component-name">TENSION CANOPY</h3>
                    <p className="component-details">
                      Breathable composite mesh woven with high-strength filament. Disperses vertical force vectors outward, preventing centered skull pressure.
                    </p>
                    <div className="component-stat-pill">FORCE DISPERSAL: <AnimatedNumber value={98} duration={1400} />%</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPREHENSIVE DATA GRID */}
      <section id="specs" className="technical-specs-section">
        <div className="container">
          <div className="specs-layout-grid">
            
            <div className="specs-column-text">
              <span className="specs-subtitle-tag">SPECIFICATION HUD</span>
              <h2 className="specs-main-title">Engineering Parameters.</h2>
              <p className="specs-description">
                A technical overview of the computational DSPs, dynamic transducers, sensor networks, and materials architecture integrated into Passion Aura.
              </p>
              
              <div className="specs-visual-panel">
                <div className="telemetry-bar-code" />
                <div className="telemetry-status-grid">
                  <div className="status-indicator">
                    <span className="indicator-dot" />
                    <span className="indicator-text">COPROCESSORS: OPTIMAL</span>
                  </div>
                  <div className="status-indicator">
                    <span className="indicator-dot" />
                    <span className="indicator-text">THD: &lt;0.08% / 1mW</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="specs-column-cards">
              <FadeIn className="specs-detail-card">
                <div className="spec-row">
                  <span className="spec-label">Transducer Motor</span>
                  <span className="spec-value">Custom <AnimatedNumber value={40} suffix="mm" duration={1400} /> dynamic driver with dual-neodymium ring magnets for minimal distortion</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Processors</span>
                  <span className="spec-value">Aura Core S1 headphone chips (one in each ear cup) supporting <AnimatedNumber value={10} duration={1200} /> audio cores per chip</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Acoustic Microphone Array</span>
                  <span className="spec-value"><AnimatedNumber value={9} duration={1000} /> microphones total: <AnimatedNumber value={8} duration={1100} /> microphones for Active Noise Cancellation, <AnimatedNumber value={3} duration={900} /> microphones for voice capture</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Sensor Architecture</span>
                  <span className="spec-value">Optical sensors • Position sensors • Case-detect sensors • Dual accelerometers • Gyroscopes</span>
                </div>
                <div className="spec-row">
                  <span className="spec-label">Battery Autonomy</span>
                  <span className="spec-value">Up to <AnimatedNumber value={20} duration={1600} /> hours of listening time on a single charge with ANC or Transparency mode active</span>
                </div>
              </FadeIn>
            </div>

          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-top">
            <h4 className="footer-logo">PASSION AUDIO LABS</h4>
            <div className="footer-links-grid">
              <a href="#" className="footer-link" onClick={() => handleLinkClick('chapter-overview')}>Design Intent</a>
              <a href="#" className="footer-link" onClick={() => handleLinkClick('chapter-engineering')}>Acoustics</a>
              <a href="#" className="footer-link" onClick={() => handleLinkClick('chapter-comfort')}>Core S1 Processor</a>
              <a href="mailto:inquire@passion-audio.com?subject=Aura Exhibition Inquiry" className="footer-link">Inquire</a>
            </div>
          </div>
          <div className="footer-bottom">
            <p className="footer-disclaimer">
              Designed by Passion in Geneva. Developed as an interactive digital exhibition.
            </p>
            <p className="footer-copyright">
              © 2026 Passion Audio Labs. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
