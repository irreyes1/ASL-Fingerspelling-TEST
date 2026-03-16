import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Hands, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { HAND_CONNECTIONS } from '@mediapipe/hands';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera as CameraIcon, 
  Hand, 
  CheckCircle2, 
  Circle, 
  Trophy, 
  RefreshCw, 
  ChevronRight,
  Info,
  AlertCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TARGET_WORD = "LAURA";

export default function App() {
  const [view, setView] = useState<'game' | 'test'>('game');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentLetterIndex, setCurrentLetterIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [top3, setTop3] = useState<{ letter: string; confidence: number }[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isHandDetected, setIsHandDetected] = useState(false);
  const [successEffect, setSuccessEffect] = useState(false);
  const [lastMatchedTime, setLastMatchedTime] = useState(0);

  const currentTarget = TARGET_WORD[currentLetterIndex];

  // Initialize MediaPipe Hands
  const onResults = useCallback((results: Results) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvasCtx = canvasRef.current.getContext('2d');
    if (!canvasCtx) return;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      setIsHandDetected(true);
      for (const landmarks of results.multiHandLandmarks) {
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
        drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 2 });
      }

      // Send landmarks to backend for prediction
      // We throttle this to avoid overwhelming the server
      const now = Date.now();
      if (now - lastMatchedTime > 500) { // Check every 500ms
        sendLandmarks(results.multiHandLandmarks[0]);
      }
    } else {
      setIsHandDetected(false);
    }
    canvasCtx.restore();
  }, [lastMatchedTime]);

  const sendLandmarks = async (landmarks: any) => {
    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landmarks }),
      });
      const data = await response.json();
      
      setPrediction(data.prediction);
      setConfidence(data.confidence);
      setTop3(data.top_3 || []);

      // Check if matched current target
      if (data.prediction === currentTarget && data.confidence > 0.7) {
        handleMatch();
      }
    } catch (error) {
      console.error("Prediction error:", error);
    }
  };

  const handleMatch = () => {
    setSuccessEffect(true);
    setLastMatchedTime(Date.now());
    
    // Trigger success confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#4ADE80', '#22C55E', '#16A34A']
    });

    setTimeout(() => {
      setSuccessEffect(false);
      if (currentLetterIndex < TARGET_WORD.length - 1) {
        setCurrentLetterIndex(prev => prev + 1);
      } else {
        setIsCompleted(true);
        triggerFinalCelebration();
      }
    }, 1500);
  };

  const triggerFinalCelebration = () => {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  const resetGame = () => {
    setCurrentLetterIndex(0);
    setIsCompleted(false);
    setPrediction(null);
    setConfidence(0);
    setTop3([]);
  };

  useEffect(() => {
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults(onResults);

    if (videoRef.current) {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) {
            await hands.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480,
      });
      camera.start().then(() => setIsCameraActive(true));
    }

    return () => {
      hands.close();
    };
  }, [onResults]);

  return (
    <div className="min-h-screen bg-[#0F172A] text-white font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Hand className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">ASL Master <span className="text-emerald-400">Fingerspelling</span></h1>
          </div>
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
              <button 
                onClick={() => setView('game')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                  view === 'game' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-white/60 hover:text-white"
                )}
              >
                Game Mode
              </button>
              <button 
                onClick={() => setView('test')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                  view === 'test' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-white/60 hover:text-white"
                )}
              >
                Offline Test
              </button>
            </nav>
            <div className={cn(
              "px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 transition-colors",
              isCameraActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
            )}>
              <div className={cn("w-2 h-2 rounded-full", isCameraActive ? "bg-emerald-400 animate-pulse" : "bg-red-400")} />
              {isCameraActive ? "Camera Active" : "Camera Offline"}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {view === 'game' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Game Area */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Target Word Display */}
            <div className="bg-white/5 rounded-3xl p-8 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
                <motion.div 
                  className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentLetterIndex + (isCompleted ? 1 : 0)) / TARGET_WORD.length) * 100}%` }}
                />
              </div>
              
              <div className="flex flex-col items-center gap-8">
                <div className="flex gap-4">
                  {TARGET_WORD.split('').map((letter, idx) => (
                    <motion.div
                      key={idx}
                      initial={false}
                      animate={{
                        scale: idx === currentLetterIndex && !isCompleted ? 1.1 : 1,
                        backgroundColor: idx < currentLetterIndex || isCompleted ? 'rgba(16, 185, 129, 0.2)' : idx === currentLetterIndex ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                        borderColor: idx < currentLetterIndex || isCompleted ? 'rgba(16, 185, 129, 0.5)' : idx === currentLetterIndex ? 'rgba(16, 185, 129, 1)' : 'rgba(255, 255, 255, 0.1)',
                      }}
                      className={cn(
                        "w-16 h-20 rounded-2xl border-2 flex items-center justify-center text-3xl font-black transition-all",
                        idx < currentLetterIndex || isCompleted ? "text-emerald-400" : idx === currentLetterIndex ? "text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "text-white/20"
                      )}
                    >
                      {letter}
                      {idx < currentLetterIndex || isCompleted ? (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-2 -right-2 bg-emerald-500 rounded-full p-1"
                        >
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </motion.div>
                      ) : null}
                    </motion.div>
                  ))}
                </div>

                <div className="text-center">
                  <p className="text-white/40 text-sm font-medium uppercase tracking-widest mb-1">Current Target</p>
                  <h2 className="text-5xl font-black text-white">{isCompleted ? "WELL DONE!" : `Spell "${currentTarget}"`}</h2>
                </div>
              </div>
            </div>

            {/* Webcam Feed */}
            <div className="relative aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl group">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover opacity-0"
                autoPlay
                playsInline
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover"
                width={640}
                height={480}
              />
              
              {/* Overlay UI */}
              <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className={cn(
                    "px-4 py-2 rounded-2xl backdrop-blur-md border flex items-center gap-3 transition-all",
                    isHandDetected ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-white/10 border-white/10 text-white/60"
                  )}>
                    <Hand className={cn("w-5 h-5", isHandDetected && "animate-bounce")} />
                    <span className="font-bold text-sm">{isHandDetected ? "Hand Detected" : "Waiting for Hand..."}</span>
                  </div>

                  <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-white/80 font-mono text-xs tracking-tighter uppercase">Live Feed</span>
                  </div>
                </div>

                {/* Prediction Bubble */}
                <AnimatePresence>
                  {prediction && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="self-center mb-4"
                    >
                      <div className={cn(
                        "px-8 py-4 rounded-3xl backdrop-blur-xl border-2 shadow-2xl flex flex-col items-center gap-1",
                        prediction === currentTarget ? "bg-emerald-500/30 border-emerald-500 shadow-emerald-500/20" : "bg-white/10 border-white/20 shadow-black/40"
                      )}>
                        <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Detected</span>
                        <span className="text-6xl font-black leading-none">{prediction}</span>
                        <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                          <motion.div 
                            className="h-full bg-white"
                            initial={{ width: 0 }}
                            animate={{ width: `${confidence * 100}%` }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Success Flash */}
              <AnimatePresence>
                {successEffect && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-emerald-500/20 pointer-events-none flex items-center justify-center"
                  >
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1.5, opacity: 1 }}
                      className="bg-white text-emerald-600 w-32 h-32 rounded-full flex items-center justify-center shadow-2xl"
                    >
                      <CheckCircle2 className="w-20 h-20" />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Column: Reference & Stats */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Reference Card */}
            <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                  <Info className="text-indigo-400 w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg">How to spell "{currentTarget}"</h3>
              </div>
              
              <div className="aspect-square bg-white rounded-2xl p-4 flex items-center justify-center mb-6 shadow-inner">
                {/* Reference Image Placeholder */}
                <div className="relative group">
                  <img 
                    src={`https://www.handspeak.com/word/alphabet/abc-${currentTarget.toLowerCase()}.jpg`}
                    alt={`ASL Letter ${currentTarget}`}
                    className="max-h-48 object-contain"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // Fallback if image fails
                      (e.target as HTMLImageElement).src = `https://picsum.photos/seed/asl-${currentTarget}/300/300`;
                    }}
                  />
                  <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-sm text-white/60 leading-relaxed">
                    Position your hand clearly in the frame. Make sure your fingers are visible and well-lit.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                  <AlertCircle className="w-4 h-4" />
                  <span>Tip: Keep your hand steady for better detection</span>
                </div>
              </div>
            </div>

            {/* Stats / Candidates */}
            <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Stats & Candidates
              </h3>
              <div className="mb-6 p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center">
                <span className="text-sm text-white/60">Letters Solved</span>
                <span className="text-xl font-black text-emerald-400">{currentLetterIndex + (isCompleted ? 1 : 0)}</span>
              </div>
              <div className="space-y-3">
                {top3.length > 0 ? top3.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold">{item.letter}</span>
                      <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-emerald-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${item.confidence * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-mono text-white/40">{Math.round(item.confidence * 100)}%</span>
                  </div>
                )) : (
                  <div className="text-center py-8 text-white/20 italic text-sm">
                    No hand detected yet...
                  </div>
                )}
              </div>
            </div>

            {/* Progress Summary */}
            <div className="bg-emerald-500/10 rounded-3xl p-6 border border-emerald-500/20">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="text-emerald-400/60 text-xs font-bold uppercase tracking-widest">Progress</p>
                  <h4 className="text-2xl font-black text-white">{currentLetterIndex + (isCompleted ? 1 : 0)} / {TARGET_WORD.length}</h4>
                </div>
                <div className="text-right">
                  <p className="text-emerald-400/60 text-xs font-bold uppercase tracking-widest">Accuracy</p>
                  <h4 className="text-2xl font-black text-white">{Math.round(confidence * 100)}%</h4>
                </div>
              </div>
              <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentLetterIndex + (isCompleted ? 1 : 0)) / TARGET_WORD.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        ) : (
          <div className="bg-white/5 rounded-[40px] p-12 border border-white/10 text-center max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-indigo-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8">
              <AlertCircle className="w-10 h-10 text-indigo-400" />
            </div>
            <h2 className="text-3xl font-black mb-4">Offline Checkpoint Test</h2>
            <p className="text-white/60 mb-8 leading-relaxed">
              This area is reserved for testing the model with pre-recorded landmark sequences or static images. 
              In the full version, you can upload files here to verify the model's performance without a live camera.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 bg-white/5 rounded-2xl border border-white/5 text-left">
                <h4 className="font-bold mb-2">Upload Landmarks</h4>
                <p className="text-xs text-white/40 mb-4">JSON format expected</p>
                <button className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all">Choose File</button>
              </div>
              <div className="p-6 bg-white/5 rounded-2xl border border-white/5 text-left">
                <h4 className="font-bold mb-2">Run Benchmark</h4>
                <p className="text-xs text-white/40 mb-4">Test against 100 samples</p>
                <button className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-sm font-bold transition-all">Start Test</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Completion Overlay */}
      <AnimatePresence>
        {isCompleted && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[40px] p-12 max-w-lg w-full text-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 via-indigo-500 to-emerald-400 animate-gradient-x" />
              
              <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-8">
                <Trophy className="w-12 h-12 text-emerald-600" />
              </div>
              
              <h2 className="text-4xl font-black text-slate-900 mb-4">Word Completed!</h2>
              <p className="text-slate-500 mb-8 text-lg">
                You've successfully spelled <span className="font-bold text-emerald-600">"{TARGET_WORD}"</span> using ASL fingerspelling. Great job!
              </p>
              
              <div className="flex flex-col gap-4">
                <button 
                  onClick={resetGame}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3"
                >
                  <RefreshCw className="w-5 h-5" />
                  Try Again
                </button>
                <button 
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3"
                >
                  Next Challenge
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes gradient-x {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s linear infinite;
        }
      `}</style>
    </div>
  );
}
