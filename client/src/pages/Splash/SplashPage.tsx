import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * AI快卖 动态开机图
 * - 5秒自动进入首页
 * - 右上角可跳过
 * - 仅APP模式显示，网页版自动跳过
 */
export default function SplashPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  const goHome = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    navigate('/', { replace: true });
  };

  useEffect(() => {
    // 网页版不显示开机图，直接进首页
    if (!(window as any).Capacitor) {
      navigate('/', { replace: true });
      return;
    }

    if (startedRef.current) return;
    startedRef.current = true;

    const duration = 5000;
    const start = Date.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (elapsed >= duration) {
        goHome();
      }
    }, 30);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 生成粒子
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 4,
    duration: 3 + Math.random() * 3,
    size: 2 + Math.random() * 4,
  }));

  return (
    <div className="splash-container">
      <style>{`
        .splash-container {
          position: fixed; inset: 0; z-index: 9999;
          background: linear-gradient(160deg, #1a0a00 0%, #4a1c00 30%, #8B4513 60%, #D4760A 85%, #F5A623 100%);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
        }
        /* 电路纹理背景 */
        .splash-circuit {
          position: absolute; inset: 0; opacity: 0.15;
          background-image:
            linear-gradient(rgba(255,180,80,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,180,80,0.3) 1px, transparent 1px);
          background-size: 40px 40px;
          animation: circuitMove 8s linear infinite;
        }
        @keyframes circuitMove {
          0% { background-position: 0 0; }
          100% { background-position: 40px 40px; }
        }
        /* 流动光带 */
        .splash-lightbeam {
          position: absolute; width: 200%; height: 2px;
          background: linear-gradient(90deg, transparent, rgba(255,200,100,0.6), transparent);
          animation: beamMove 4s ease-in-out infinite;
        }
        .splash-lightbeam:nth-child(2) { top: 25%; animation-delay: 0s; }
        .splash-lightbeam:nth-child(3) { top: 55%; animation-delay: 1.5s; }
        .splash-lightbeam:nth-child(4) { top: 75%; animation-delay: 3s; }
        @keyframes beamMove {
          0% { transform: translateX(-50%) rotate(-5deg); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(50%) rotate(-5deg); opacity: 0; }
        }
        /* 粒子 */
        .splash-particle {
          position: absolute; bottom: -10px; border-radius: 50%;
          background: radial-gradient(circle, #FFD700, #FFA500);
          box-shadow: 0 0 6px #FFD700;
          animation: particleRise linear infinite;
        }
        @keyframes particleRise {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 0.8; }
          100% { transform: translateY(-100vh) scale(0.3); opacity: 0; }
        }
        /* 品牌名 */
        .splash-brand {
          font-size: 72px; font-weight: 900; color: #FFD700;
          text-shadow: 0 0 30px rgba(255,180,50,0.8), 0 0 60px rgba(255,140,0,0.5), 0 4px 8px rgba(0,0,0,0.5);
          letter-spacing: 4px; margin-bottom: 12px;
          animation: brandIn 1s cubic-bezier(0.34,1.56,0.64,1) 0.2s both;
        }
        @keyframes brandIn {
          0% { transform: scale(0.3); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .splash-subtitle {
          font-size: 16px; color: rgba(255,220,150,0.9); letter-spacing: 2px;
          margin-bottom: 40px; animation: fadeIn 0.8s ease 0.8s both;
        }
        .splash-selling {
          font-size: 36px; font-weight: 700; color: #FFF;
          text-shadow: 0 2px 10px rgba(0,0,0,0.5);
          margin: 6px 0; animation: slideUp 0.7s ease both;
        }
        .splash-selling:nth-of-type(4) { animation-delay: 1.2s; }
        .splash-selling:nth-of-type(5) { animation-delay: 1.6s; }
        @keyframes slideUp {
          0% { transform: translateY(30px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .splash-slogan {
          position: absolute; bottom: 80px; text-align: center;
          animation: fadeIn 1s ease 2.2s both;
        }
        .splash-slogan p {
          font-size: 15px; color: rgba(255,230,180,0.85); margin: 4px 0;
          letter-spacing: 1px;
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        /* 跳过按钮 */
        .splash-skip {
          position: absolute; top: 20px; right: 20px; z-index: 10;
          background: rgba(0,0,0,0.35); border: 1px solid rgba(255,200,100,0.4);
          color: #FFD700; font-size: 14px; padding: 8px 18px; border-radius: 20px;
          cursor: pointer; backdrop-filter: blur(4px);
          animation: fadeIn 0.5s ease 0.5s both;
          transition: all 0.2s;
        }
        .splash-skip:active { transform: scale(0.95); background: rgba(0,0,0,0.5); }
        /* 底部进度条 */
        .splash-progress-wrap {
          position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%);
          width: 120px; height: 3px; background: rgba(255,255,255,0.2); border-radius: 2px; overflow: hidden;
        }
        .splash-progress-bar {
          height: 100%; background: linear-gradient(90deg, #FFD700, #FFA500);
          border-radius: 2px; transition: width 0.05s linear;
        }
        .splash-chip {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          width: 280px; height: 280px; border: 1px solid rgba(255,180,80,0.2);
          border-radius: 20px; opacity: 0.3;
          animation: chipPulse 3s ease-in-out infinite;
        }
        .splash-chip::before, .splash-chip::after {
          content: ''; position: absolute; border: 1px solid rgba(255,180,80,0.15); border-radius: 50%;
        }
        .splash-chip::before { inset: 30px; }
        .splash-chip::after { inset: 60px; }
        @keyframes chipPulse {
          0%, 100% { transform: translate(-50%,-50%) scale(1); opacity: 0.2; }
          50% { transform: translate(-50%,-50%) scale(1.08); opacity: 0.35; }
        }
      `}</style>

      {/* 背景层 */}
      <div className="splash-circuit" />
      <div className="splash-chip" />
      <div className="splash-lightbeam" />
      <div className="splash-lightbeam" />
      <div className="splash-lightbeam" />

      {/* 粒子 */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="splash-particle"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}

      {/* 跳过按钮 */}
      <button className="splash-skip" onClick={goHome}>
        跳过 {Math.ceil((100 - progress) / 20)}s
      </button>

      {/* 内容 */}
      <div className="splash-brand">AI快卖</div>
      <div className="splash-subtitle">全球第一个强制性卖货平台</div>
      <div className="splash-selling">确定性卖货</div>
      <div className="splash-selling">确定性赚钱</div>

      {/* 底部 slogan */}
      <div className="splash-slogan">
        <p>让天下再没有不好卖的产品</p>
        <p>让你再没有不会赚钱的理由</p>
      </div>

      {/* 进度条 */}
      <div className="splash-progress-wrap">
        <div className="splash-progress-bar" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
