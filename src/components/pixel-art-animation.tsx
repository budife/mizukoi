import { useEffect, useRef } from "react";

interface PixelArtProps {
  width?: number;
  height?: number;
  speed?: number;
  className?: string;
}

export function PixelArtAnimation({ width = 64, height = 64, speed = 2, className = "" }: PixelArtProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    let frame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, width, height);

      const gridSize = 4;
      const cols = Math.floor(width / gridSize);
      const rows = Math.floor(height / gridSize);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * gridSize;
          const y = row * gridSize;

          const pattern = frame + row + col;
          const isOn = pattern % (speed + (row % 3)) !== 0;

          if (isOn) {
            const colorPattern = (row + col) % 4;
            let color = "#09090b";
            if (colorPattern === 0) color = "#1a1a2e";
            else if (colorPattern === 1) color = "#16213e";
            else if (colorPattern === 2) color = "#0f3460";
            else color = "#533373";

            const subPixel = Math.sin(row * 0.5 + col * 0.7 + frame) > 0;
            if (subPixel) {
              ctx.fillRect(x + 1, y + 1, gridSize - 2, gridSize - 2);
            } else {
              ctx.fillRect(x, y, gridSize, gridSize);
            }
          }
        }
      }

      for (let i = 0; i < 8; i++) {
        const px = (Math.sin(i * 2.7 + frame * 0.3) * 30 + 20) % width;
        const py = (i * 12 + Math.sin(i * 1.3) * 10 + frame * 2) % height;
        const size = 2 + (i % 3);

        ctx.fillStyle = `rgba(80, 120, 200, ${0.3 + Math.sin(i + frame * 0.5) * 0.2})`;
        ctx.fillRect(px, py, size, size);
      }

      frame++;
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [width, height, speed]);

  return (
    <canvas
      ref={canvasRef}
      className={`coming-soon__pixel-canvas ${className}`}
      style={{ display: "block", width: "100%", height: "100%", imageRendering: "pixelated" }}
    />
  );
}
