import React, { useEffect, useRef } from 'react';

const InteractiveBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // ─── Floating Documents Particle System ───
    const numDocs = 60; // Number of floating papers
    const docs = [];
    
    // Initialize documents in 3D space
    for (let i = 0; i < numDocs; i++) {
      docs.push({
        x: (Math.random() - 0.5) * 4000,
        y: (Math.random() - 0.5) * 4000,
        z: Math.random() * 2500 + 500, // Depth
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
        spinX: (Math.random() - 0.5) * 0.015,
        spinY: (Math.random() - 0.5) * 0.015,
        spinZ: (Math.random() - 0.5) * 0.005,
        width: 140 + Math.random() * 40, // Document width
        height: 200 + Math.random() * 60, // Document height (standard paper ratio)
        speedY: -1 - Math.random() * 3, // Floating upward
      });
    }

    const draw = () => {
      const focalLength = Math.max(canvas.width, canvas.height) * 0.9;
      
      // Clear background
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Sort documents by depth (z) so closer ones draw on top (Painter's algorithm)
      docs.sort((a, b) => b.z - a.z);

      for (let i = 0; i < docs.length; i++) {
        const d = docs[i];
        
        // Move document upward (slow anti-gravity float)
        d.y += d.speedY;
        
        // Tumble/Rotate document continuously
        d.rotX += d.spinX;
        d.rotY += d.spinY;
        d.rotZ += d.spinZ;
        
        // Infinite Loop: if it floats too high, reset to the bottom
        if (d.y < -2500) {
          d.y = 2500;
          d.x = (Math.random() - 0.5) * 4000;
        }

        // 3D rotation matrix function
        const rotate3D = (px, py, pz, rx, ry, rz) => {
          // Rotate X
          let y1 = py * Math.cos(rx) - pz * Math.sin(rx);
          let z1 = py * Math.sin(rx) + pz * Math.cos(rx);
          // Rotate Y
          let x2 = px * Math.cos(ry) + z1 * Math.sin(ry);
          let z2 = -px * Math.sin(ry) + z1 * Math.cos(ry);
          // Rotate Z
          let x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz);
          let y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);
          return { x: x3, y: y3, z: z2 };
        };

        // Define the 4 corners of the paper centered at (0,0)
        const hw = d.width / 2;
        const hh = d.height / 2;
        const corners = [
          { x: -hw, y: -hh, z: 0 },
          { x: hw, y: -hh, z: 0 },
          { x: hw, y: hh, z: 0 },
          { x: -hw, y: hh, z: 0 }
        ];

        // Apply 3D rotation, translation, and projection
        const projectedCorners = [];
        let outOfBounds = true;

        for (let c of corners) {
          const rotated = rotate3D(c.x, c.y, c.z, d.rotX, d.rotY, d.rotZ);
          const finalZ = d.z + rotated.z;
          
          if (finalZ <= 0) continue; // Behind camera

          const scale = focalLength / finalZ;
          const x2d = cx + (d.x + rotated.x) * scale;
          const y2d = cy + (d.y + rotated.y) * scale;

          if (x2d > -500 && x2d < canvas.width + 500 && y2d > -500 && y2d < canvas.height + 500) {
            outOfBounds = false; // At least one corner is on screen
          }
          projectedCorners.push({ x: x2d, y: y2d });
        }

        // Draw the document if all 4 corners were successfully projected and it's visible
        if (projectedCorners.length === 4 && !outOfBounds) {
          // Fade based on depth
          let opacity = (3000 - d.z) / 2500;
          if (opacity < 0) opacity = 0;
          if (opacity > 1) opacity = 1;

          ctx.beginPath();
          ctx.moveTo(projectedCorners[0].x, projectedCorners[0].y);
          ctx.lineTo(projectedCorners[1].x, projectedCorners[1].y);
          ctx.lineTo(projectedCorners[2].x, projectedCorners[2].y);
          ctx.lineTo(projectedCorners[3].x, projectedCorners[3].y);
          ctx.closePath();

          // Document Body: Subtle glass-morphism white to look like floating paper
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.04})`; 
          ctx.fill();

          // Document Border: Glowing cyan/purple edge
          ctx.lineWidth = 1;
          ctx.strokeStyle = `rgba(139, 92, 246, ${opacity * 0.35})`;
          ctx.stroke();

          // Draw inner "text lines" so it looks like an analyzed document
          ctx.lineWidth = 0.5;
          ctx.strokeStyle = `rgba(6, 182, 212, ${opacity * 0.25})`;
          
          for (let l = 0.2; l <= 0.8; l += 0.15) {
            const p1 = {
              x: projectedCorners[0].x + (projectedCorners[3].x - projectedCorners[0].x) * l,
              y: projectedCorners[0].y + (projectedCorners[3].y - projectedCorners[0].y) * l
            };
            const p2 = {
              x: projectedCorners[1].x + (projectedCorners[2].x - projectedCorners[1].x) * l,
              y: projectedCorners[1].y + (projectedCorners[2].y - projectedCorners[1].y) * l
            };
            
            // Randomize line length slightly so it looks like actual paragraphs
            const textWidthScale = 0.6 + (Math.sin(d.rotX * 5 + l * 10) * 0.2);
            
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            // Draw line partway across to simulate uneven text
            ctx.lineTo(p1.x + (p2.x - p1.x) * textWidthScale, p1.y + (p2.y - p1.y) * textWidthScale);
            ctx.stroke();
          }
        }
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
        pointerEvents: 'none',
        background: '#0B0F19'
      }}
    />
  );
};

export default InteractiveBackground;
