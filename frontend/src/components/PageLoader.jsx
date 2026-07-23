import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { FileText } from 'lucide-react';

const PageLoader = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const containerRef = useRef();

  useEffect(() => {
    let currentProgress = 0;
    
    // Simulate resource loading for the first 85%
    const interval = setInterval(() => {
      currentProgress += Math.random() * 15;
      if (currentProgress > 85) currentProgress = 85;
      setProgress(Math.min(currentProgress, 85));
    }, 200);

    const completeLoading = () => {
      clearInterval(interval);
      setProgress(100);
      
      // Animate out after hitting 100%
      setTimeout(() => {
        gsap.to(containerRef.current, {
          y: '-100vh',
          opacity: 0,
          duration: 1,
          ease: 'power3.inOut',
          onComplete: () => onComplete()
        });
      }, 600);
    };

    // Tie the final 15% to actual window load event
    if (document.readyState === 'complete') {
      completeLoading();
    } else {
      window.addEventListener('load', completeLoading);
      // Fallback timeout just in case it hangs
      setTimeout(completeLoading, 3000); 
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('load', completeLoading);
    };
  }, [onComplete]);

  // GSAP animations for the loader elements
  useGSAP(() => {
    gsap.from('.loader-logo-icon', {
      scale: 0.8,
      opacity: 0,
      duration: 1,
      ease: 'back.out(1.5)'
    });
    
    gsap.from('.loader-text-wrapper', {
      y: 20,
      opacity: 0,
      duration: 0.8,
      delay: 0.3,
      ease: 'power2.out'
    });
  }, { scope: containerRef });

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#0B0F19', // Matches app background
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#F3F4F6',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      <div className="loader-text-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Animated Logo */}
        <div style={{ marginBottom: '2rem' }}>
          <FileText className="loader-logo-icon" size={64} color="#06B6D4" />
        </div>
        
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0, letterSpacing: '1px' }}>
          AeroScan<span style={{ color: '#06B6D4' }}>AI</span>
        </h1>
        <p style={{ color: '#9CA3AF', marginTop: '0.5rem', fontSize: '1rem', letterSpacing: '2px', textTransform: 'uppercase' }}>
          Initializing Neural Engine
        </p>

        {/* Progress bar container */}
        <div style={{ width: '300px', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '2.5rem', overflow: 'hidden' }}>
          {/* Progress bar fill */}
          <div 
            style={{ 
              width: `${progress}%`, 
              height: '100%', 
              backgroundColor: '#06B6D4',
              boxShadow: '0 0 10px #06B6D4',
              transition: 'width 0.2s ease-out'
            }}
          ></div>
        </div>
        
        <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#6B7280', fontFamily: 'monospace' }}>
          {Math.floor(progress)}% loaded
        </div>
      </div>
    </div>
  );
};

export default PageLoader;
