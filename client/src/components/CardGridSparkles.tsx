// @ts-nocheck
/**
 * CardGridSparkles
 * Isolated React Three Fiber component - @ts-nocheck prevents R3F's JSX
 * namespace from polluting the rest of the project's type checking.
 * pointer-events: none so it never blocks card interactions.
 */
import { Canvas } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { useAppSettings } from "@/contexts/AppSettingsContext";

function SparkleScene() {
  const { settings } = useAppSettings();

  // Subtle color per theme
  const themeColors: Record<string, string> = {
    "norfolk-ai": "#4ade80",  // soft green
    "noir-dark":  "#a78bfa",  // soft violet
    default:      "#fbbf24",  // warm gold
  };
  const color = themeColors[settings?.theme] ?? themeColors.default;

  return (
    <Sparkles
      count={70}
      size={1.3}
      speed={0.16}
      opacity={0.50}
      color={color}
      scale={[30, 12, 6]}
      noise={0.5}
    />
  );
}

export default function CardGridSparkles() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 5,
        overflow: "hidden",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 9], fov: 55 }}
        gl={{ alpha: true, antialias: false }}
        style={{ width: "100%", height: "100%", pointerEvents: "none" }}
        dpr={[1, 1.5]}
      >
        <SparkleScene />
      </Canvas>
    </div>
  );
}
