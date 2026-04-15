import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';

export interface SignaturePadRef {
  clear: () => void;
}

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  width?: number;
  height?: number;
}

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ onSave, width = 400, height = 200 }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [drawing, setDrawing] = useState(false);
    const hasContentRef = useRef(false);

    const getPos = useCallback((e: React.TouchEvent | React.MouseEvent) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if ('touches' in e) {
        return {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top) * scaleY,
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000000';
    }, []);

    const clear = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasContentRef.current = false;
    }, []);

    useImperativeHandle(ref, () => ({ clear }));

    const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      setDrawing(true);
      const ctx = canvasRef.current!.getContext('2d')!;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e: React.TouchEvent | React.MouseEvent) => {
      if (!drawing) return;
      e.preventDefault();
      const ctx = canvasRef.current!.getContext('2d')!;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      hasContentRef.current = true;
    };

    const stopDraw = () => {
      setDrawing(false);
      if (hasContentRef.current && canvasRef.current) {
        onSave(canvasRef.current.toDataURL('image/png'));
      }
    };

    return (
      <div className="rounded-lg border border-border bg-background/50 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="rounded-md cursor-crosshair touch-none w-full"
          style={{ maxWidth: width }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>
    );
  }
);

SignaturePad.displayName = 'SignaturePad';
