// 声音提醒工具 - 使用 Web Audio API 生成提示音
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioContext;
}

// 播放新任务提示音（两声短促提示）
export function playNewTaskSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const playTone = (frequency: number, startTime: number, duration: number) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startTime);

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(880, now, 0.15);
    playTone(1100, now + 0.2, 0.2);
  } catch (error) {
    console.warn('播放提示音失败', error);
  }
}

// 播放审核提醒音（一声长提示）
export function playReviewSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(660, ctx.currentTime);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch (error) {
    console.warn('播放提示音失败', error);
  }
}
