import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SplashPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  const goHome = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    navigate('/', { replace: true });
  };

  useEffect(() => {
    if (!(window as any).Capacitor) { navigate('/', { replace: true }); return; }
    if (startedRef.current) return;
    startedRef.current = true;
    const duration = 5000;
    const start = Date.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(100, (elapsed / duration) * 100));
      if (elapsed >= duration) goHome();
    }, 30);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 4,
    duration: 3 + Math.random() * 3, size: 2 + Math.random() * 5,
  }));

  return (
    <div className="splash-container">
      <style>{`
        .splash-container { position: fixed; inset: 0; z-index: 9999; overflow: hidden; background: #1a0a00; }
        .splash-bg { position: absolute; inset: 0; background-image: url('/splash-bg.jpg'); background-size: cover; background-position: center; animation: kenburns 6s ease-out forwards; }
        @keyframes kenburns { 0% { transform: scale(1); } 100% { transform: scale(1.08); } }
        .splash-vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%); }
        .splash-sweep { position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: linear-gradient(115deg, transparent 40%, rgba(255,200,100,0.12) 50%, transparent 60%); animation: sweep 3s ease-in-out infinite; }
        @keyframes sweep { 0% { transform: translateX(-30%); opacity: 0; } 30% { opacity: 1; } 70% { opacity: 1; } 100% { transform: translateX(30%); opacity: 0; } }
        .splash-glow { position: absolute; inset: 0; background: radial-gradient(circle at 50% 45%, rgba(255,160,40,0.15) 0%, transparent 60%); animation: glowPulse 2.5s ease-in-out infinite; }
        @keyframes glowPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        .splash-particle { position: absolute; bottom: -10px; border-radius: 50%; background: radial-gradient(circle, #FFD700, #FFA500); box-shadow: 0 0 8px #FFD700, 0 0 16px rgba(255,180,50,0.5); animation: particleRise linear infinite; }
        @keyframes particleRise { 0% { transform: translateY(0) scale(1); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 0.7; } 100% { transform: translateY(-100vh) scale(0.2); opacity: 0; } }
        .splash-chip-glow { position: absolute; top: 42%; left: 50%; transform: translate(-50%,-50%); width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle, rgba(255,180,50,0.25) 0%, transparent 70%); animation: chipGlow 2s ease-in-out infinite; }
        @keyframes chipGlow { 0%, 100% { opacity: 0.4; transform: translate(-50%,-50%) scale(1); } 50% { opacity: 0.9; transform: translate(-50%,-50%) scale(1.2); } }
        .splash-skip { position: absolute; top: 24px; right: 20px; z-index: 10; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,200,100,0.5); color: #FFD700; font-size: 14px; padding: 8px 18px; border-radius: 20px; cursor: pointer; backdrop-filter: blur(6px); animation: fadeIn 0.5s ease 0.5s both; }
        .splash-skip:active { transform: scale(0.95); background: rgba(0,0,0,0.6); }
        @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
        .splash-progress-wrap { position: absolute; bottom: 36px; left: 50%; transform: translateX(-50%); width: 140px; height: 3px; background: rgba(255,255,255,0.2); border-radius: 2px; overflow: hidden; z-index: 10; }
        .splash-progress-bar { height: 100%; background: linear-gradient(90deg, #FFD700, #FFA500); border-radius: 2px; box-shadow: 0 0 8px rgba(255,180,50,0.8); }
      `}</style>
      <div className="splash-bg" />
      <div className="splash-vignette" />
      <div className="splash-glow" />
      <div className="splash-sweep" />
      <div className="splash-chip-glow" />
      {particles.map((p) => (
        <div key={p.id} className="splash-particle" style={{ left: `${p.left}%`, width: `${p.size}px`, height: `${p.size}px`, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }} />
      ))}
      <button className="splash-skip" onClick={goHome}>跳过 {Math.ceil((100 - progress) / 20)}s</button>
      <div className="splash-progress-wrap"><div className="splash-progress-bar" style={{ width: `${progress}%` }} /></div>
    </div>
  );
}