import React, { useEffect, useRef } from 'react';

const InteractiveBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      time += 0.003; // Animation speed
      
      // Clear canvas with base background color
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      // Make radius large enough to cover corners
      const radius = Math.sqrt(cx * cx + cy * cy) * 1.2;

      const segments = 12; // 12-sided kaleidoscope
      const angle = (Math.PI * 2) / segments;

      for (let i = 0; i < segments; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(i * angle + (time * 0.2)); // Slow continuous overall rotation
        
        // Mirror alternate segments
        if (i % 2 !== 0) {
          ctx.scale(1, -1);
        }

        // Create clipping mask for the segment slice
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(radius, 0);
        ctx.lineTo(radius * Math.cos(angle), radius * Math.sin(angle));
        ctx.closePath();
        ctx.clip();

        // Draw animated abstract geometry inside the slice
        
        // Purple Glowing Orb
        ctx.fillStyle = 'rgba(139, 92, 246, 0.2)'; 
        ctx.beginPath();
        ctx.arc(
          Math.cos(time * 1.2) * radius * 0.4 + radius * 0.2, 
          Math.sin(time * 0.8) * radius * 0.4 + radius * 0.1, 
          radius * 0.3, 
          0, Math.PI * 2
        );
        ctx.fill();

        // Cyan Glowing Orb
        ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
        ctx.beginPath();
        ctx.arc(
          Math.cos(time * 0.7 + 2) * radius * 0.6 + radius * 0.3, 
          Math.sin(time * 1.1 + 1) * radius * 0.3 + radius * 0.1, 
          radius * 0.4, 
          0, Math.PI * 2
        );
        ctx.fill();
        
        // Floating geometry (Triangles)
        ctx.fillStyle = 'rgba(139, 92, 246, 0.08)';
        ctx.beginPath();
        const triX = Math.cos(time * 1.5) * radius * 0.7;
        const triY = Math.sin(time * 1.5) * radius * 0.7;
        ctx.moveTo(triX, triY);
        ctx.lineTo(triX + radius * 0.15, triY - radius * 0.05);
        ctx.lineTo(triX + radius * 0.05, triY + radius * 0.15);
        ctx.closePath();
        ctx.fill();

        // Connecting lines to center
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.05)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(
          Math.cos(time * 2) * radius * 0.8, 
          Math.sin(time * 2) * radius * 0.8
        );
        ctx.stroke();

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none'
      }}
    />
  );
};

export default InteractiveBackground;
