import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from "react";

export type SignatureHandle = {
  isEmpty: () => boolean;
  toDataURL: () => string;
  clear: () => void;
};

type Point = { x: number; y: number };

function line(points: Point[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  const drawn =
    rest.length === 0
      ? `L ${first.x + 0.4} ${first.y + 0.4}`
      : rest.map((point) => `L ${point.x} ${point.y}`).join(" ");
  return `M ${first.x} ${first.y} ${drawn}`;
}

export const SignaturePad = forwardRef<SignatureHandle>(function SignaturePad(_, ref) {
  const boxRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const [size, setSize] = useState({ w: 320, h: 160 });
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [live, setLive] = useState<Point[] | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    setSize({ w: box.clientWidth || 320, h: box.clientHeight || 160 });
  }, []);

  const rel = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  useImperativeHandle(
    ref,
    () => ({
      isEmpty: () => strokes.length === 0 && !live?.length,
      clear: () => {
        drawing.current = false;
        setLive(null);
        setStrokes([]);
      },
      toDataURL: () => {
        const width = boxRef.current?.clientWidth || size.w;
        const height = boxRef.current?.clientHeight || size.h;
        const canvas = document.createElement("canvas");
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.floor(width * ratio));
        canvas.height = Math.max(1, Math.floor(height * ratio));
        const ctx = canvas.getContext("2d");
        if (!ctx) return "";
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.fillStyle = "#fffcf7";
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = "#1d1915";
        ctx.lineWidth = 2.4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const all = live?.length ? [...strokes, live] : strokes;
        for (const stroke of all) {
          if (stroke.length === 0) continue;
          ctx.beginPath();
          ctx.moveTo(stroke[0].x, stroke[0].y);
          if (stroke.length === 1) ctx.lineTo(stroke[0].x + 0.4, stroke[0].y + 0.4);
          else for (const point of stroke.slice(1)) ctx.lineTo(point.x, point.y);
          ctx.stroke();
        }
        return canvas.toDataURL("image/png");
      },
    }),
    [live, size.h, size.w, strokes],
  );

  return (
    <div
      ref={boxRef}
      className="sign-canvas"
      aria-label="Kotak tanda tangan"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drawing.current = true;
        setLive([rel(event)]);
      }}
      onPointerMove={(event) => {
        if (!drawing.current) return;
        const point = rel(event);
        setLive((prev) => (prev ? [...prev, point] : [point]));
      }}
      onPointerUp={() => {
        if (!drawing.current) return;
        drawing.current = false;
        setLive((current) => {
          if (current && current.length > 0) setStrokes((prev) => [...prev, current]);
          return null;
        });
      }}
      onPointerCancel={() => {
        drawing.current = false;
        setLive(null);
      }}
    >
      <svg viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="none" aria-hidden="true">
        {[...strokes, ...(live ? [live] : [])].map((stroke, index) => (
          <path
            key={index}
            d={line(stroke)}
            fill="none"
            stroke="#1d1915"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  );
});
