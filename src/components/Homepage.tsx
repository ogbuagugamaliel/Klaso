import React from 'react';
import { 
  ClipboardCheck, 
  BookOpen, 
  Users, 
  CheckCircle, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  TrendingUp,
  FileSpreadsheet,
  Award,
  Zap,
  Lock,
  Mail,
  HelpCircle,
  Database,
  Contact,
  History
} from 'lucide-react';
import { motion } from 'motion/react';

interface HomepageProps {
  onOpenPortal: (mode: 'login' | 'register', defaultTier?: 'free' | 'premium') => void;
  onOpenDemo: (role: 'admin' | 'teacher') => void;
  isLoggedIn?: boolean;
}

export const Homepage: React.FC<HomepageProps> = ({ onOpenPortal, onOpenDemo, isLoggedIn }) => {
  const [scrollY, setScrollY] = React.useState(0);
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Typing effect for the main display header
  const [typedText1, setTypedText1] = React.useState('');
  const [typedText2, setTypedText2] = React.useState('');
  const [currentPhase, setCurrentPhase] = React.useState('typing1');

  React.useEffect(() => {
    const text1 = "Run Your Entire School";
    const text2 = "From One Platform.";
    let phase = 'typing1'; // 'typing1', 'typing2', 'pause', 'deleting2', 'deleting1', 'pause_before_start'
    let index1 = 0;
    let index2 = 0;
    let pauseCounter = 0;

    const timer = setInterval(() => {
      if (phase === 'typing1') {
        if (index1 < text1.length) {
          index1++;
          setTypedText1(text1.substring(0, index1));
        } else {
          phase = 'typing2';
          setCurrentPhase('typing2');
        }
      } else if (phase === 'typing2') {
        if (index2 < text2.length) {
          index2++;
          setTypedText2(text2.substring(0, index2));
        } else {
          phase = 'pause';
          setCurrentPhase('pause');
          pauseCounter = 0;
        }
      } else if (phase === 'pause') {
        // Wait for about 3 seconds (60 ticks * 50ms = 3000ms)
        pauseCounter++;
        if (pauseCounter > 60) {
          phase = 'deleting2';
          setCurrentPhase('deleting2');
        }
      } else if (phase === 'deleting2') {
        if (index2 > 0) {
          index2--;
          setTypedText2(text2.substring(0, index2));
        } else {
          phase = 'deleting1';
          setCurrentPhase('deleting1');
        }
      } else if (phase === 'deleting1') {
        if (index1 > 0) {
          index1--;
          setTypedText1(text1.substring(0, index1));
        } else {
          phase = 'pause_before_start';
          setCurrentPhase('pause_before_start');
          pauseCounter = 0;
        }
      } else if (phase === 'pause_before_start') {
        // Wait for 1 second (20 ticks) before restarting
        pauseCounter++;
        if (pauseCounter > 20) {
          phase = 'typing1';
          setCurrentPhase('typing1');
        }
      }
    }, 50);

    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePosition({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
  };

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-stone-900 selection:bg-[#1B4332] selection:text-white font-sans antialiased overflow-x-hidden relative">
      
      {/* 1. BRAND NAVIGATION HEADER */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#FAF7F0]/85 border-b border-stone-200/50 px-4 sm:px-6 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-[#1B4332] rounded-lg text-white shadow-2xs">
            <ClipboardCheck className="h-4 w-4 text-[#D4A017] stroke-[2]" />
          </div>
          <div>
            <span className="font-display font-extrabold text-base tracking-tight text-[#1B4332]">Klaso</span>
            <span className="text-[8px] block font-mono font-bold text-[#D4A017] leading-none uppercase tracking-widest mt-0.5">School OS</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center space-x-5 text-xs font-semibold text-stone-600">
          <a href="#about" className="hover:text-[#1B4332] transition-colors">What is it?</a>
          <a href="#how-it-works" className="hover:text-[#1B4332] transition-colors">How it Works</a>
          <a href="#pricing" className="hover:text-[#1B4332] transition-colors">Pricing Plans</a>
          <span className="h-3.5 w-px bg-stone-300"></span>
          <button 
            onClick={() => onOpenDemo('admin')}
            className="text-stone-500 hover:text-[#1B4332] text-[10px] font-mono font-bold uppercase transition-colors"
          >
            Instant Demo
          </button>
        </nav>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onOpenPortal('login')}
            className="px-2.5 py-1.5 text-xs font-bold text-stone-700 hover:text-[#1B4332] transition-all cursor-pointer"
          >
            Sign In
          </button>
          
          <button
            onClick={() => onOpenPortal('register', 'premium')}
            className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#143225] text-white text-xs font-bold rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            Register School
          </button>
        </div>
      </header>

      {/* 2. HERO INTRO SECTION */}
      <section className="relative py-12 sm:py-16 px-4 sm:px-6 max-w-4xl mx-auto flex flex-col items-center gap-10 text-center">
        <div className="space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 bg-emerald-50 border border-emerald-100 rounded-full text-[#1B4332] text-[11px] font-semibold">
            <Sparkles className="h-3 w-3 text-[#D4A017]" />
            <span>Smart Digital School Operating System (SOS)</span>
          </div>
          
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold text-[#1B4332] tracking-tight leading-none min-h-[5.5rem] sm:min-h-[7rem] lg:min-h-[8rem] flex flex-col justify-center items-center">
            <span>
              {typedText1}
              {(currentPhase === 'typing1' || currentPhase === 'deleting1' || currentPhase === 'pause_before_start') && (
                <span className="inline-block w-[3px] h-[1.75rem] sm:h-[2.25rem] lg:h-[2.75rem] bg-[#1B4332] ml-0.5 animate-pulse">|</span>
              )}
            </span>
            {(typedText2.length > 0 || currentPhase === 'typing2' || currentPhase === 'pause' || currentPhase === 'deleting2') && (
              <span className="text-[#1B4332] mt-1 sm:mt-2 block">
                {typedText2}
                {(currentPhase === 'typing2' || currentPhase === 'pause' || currentPhase === 'deleting2') && (
                  <span className="inline-block w-[3px] h-[1.75rem] sm:h-[2.25rem] lg:h-[2.75rem] bg-[#D4A017] ml-0.5 animate-pulse">|</span>
                )}
              </span>
            )}
          </h1>
          
          <p className="text-stone-600 text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto">
            Ditch paper logs. Introduce rapid attendance taking via custom student codes, 
            run instant compliance reporting with PDF/CSV exports, configure evaluation assessment sheets, 
            and monitor school fee payments and installments through our compliance ledger.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-1">
            <button
              onClick={() => onOpenPortal('register', 'premium')}
              className="px-4 py-2 bg-[#557A68] hover:bg-[#466556] text-white font-bold rounded-lg text-xs shadow-xs hover:shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <span>Setup Premium Portal</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onOpenPortal('register', 'free')}
              className="px-4 py-2 bg-white hover:bg-[#FAF7F0] border border-[#d6c4a3] text-[#5C5240] font-bold rounded-lg text-xs transition-all cursor-pointer"
            >
              Start Attendance Free Plan
            </button>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-3 pt-6 border-t border-stone-200 max-w-sm mx-auto">
            <div>
              <div className="text-lg font-extrabold text-[#1B4332]">100%</div>
              <div className="text-[9px] text-stone-500 font-mono font-bold uppercase tracking-wider mt-0.5">Compliant Layout</div>
            </div>
            <div>
              <div className="text-lg font-extrabold text-[#1B4332]">₦20k</div>
              <div className="text-[9px] text-stone-500 font-mono font-bold uppercase tracking-wider mt-0.5">Termly Activation</div>
            </div>
            <div>
              <div className="text-lg font-extrabold text-[#1B4332]">2 Sec</div>
              <div className="text-[9px] text-stone-500 font-mono font-bold uppercase tracking-wider mt-0.5">Code Check-in</div>
            </div>
          </div>
        </div>

        {/* Scroll Parallax Ambient Beacons (Blobs) */}
        <div 
          className="absolute top-[8%] left-[-10%] w-[24rem] sm:w-[32rem] h-[24rem] sm:h-[32rem] rounded-full bg-emerald-200/20 blur-3xl pointer-events-none transition-transform duration-300 ease-out z-0"
          style={{ transform: `translateY(${Math.min(scrollY * 0.12, 120)}px)` }}
        />
        <div 
          className="absolute top-[28%] right-[-10%] w-[20rem] sm:w-[28rem] h-[20rem] sm:h-[28rem] rounded-full bg-amber-100/35 blur-3xl pointer-events-none transition-transform duration-300 ease-out z-0"
          style={{ transform: `translateY(${Math.max(scrollY * -0.08, -100)}px)` }}
        />
        <div 
          className="absolute bottom-[22%] left-[-10%] w-[22rem] sm:w-[30rem] h-[22rem] sm:h-[30rem] rounded-full bg-stone-300/25 blur-3xl pointer-events-none transition-transform duration-300 ease-out z-0"
          style={{ transform: `translateY(${Math.min(scrollY * 0.1, 80)}px)` }}
        />

        {/* Hero Visual Preview - Wrapped in Parallax container & 3D tilt */}
        <div 
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full max-w-xl mx-auto relative cursor-default z-10"
          style={{ perspective: 1200 }}
        >
          {/* Scroll Parallax layer 1: Check-in stats widget */}
          <div 
            className="hidden md:flex flex-col absolute -top-8 -left-16 bg-white p-3.5 rounded-xl shadow-md border border-stone-200/60 w-44 text-left z-20 pointer-events-none transition-transform duration-300 ease-out"
            style={{ transform: `translateY(${scrollY * -0.08}px) translateZ(40px)` }}
          >
            <div className="flex items-center space-x-1.5 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[9px] font-mono font-bold text-stone-400 uppercase tracking-widest">Active Roster</span>
            </div>
            <div className="text-[11px] font-bold text-[#1B4332] flex items-center justify-between">
              <span>98.4% Present</span>
              <span className="text-[8px] bg-emerald-50 text-emerald-700 px-1 rounded font-mono font-bold">+1.2%</span>
            </div>
            <div className="text-[8px] text-stone-400 mt-1.5 font-mono leading-tight">1,420 Cumulative Term Logs</div>
          </div>

          {/* Scroll Parallax layer 2: Ledger stats widget */}
          <div 
            className="hidden md:flex flex-col absolute -bottom-4 -right-16 bg-white p-3 rounded-xl shadow-md border border-stone-200/60 w-48 text-left z-20 pointer-events-none transition-transform duration-300 ease-out"
            style={{ transform: `translateY(${scrollY * 0.08}px) translateZ(50px)` }}
          >
            <div className="flex items-center space-x-1.5 mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-[#D4A017] shrink-0" />
              <span className="text-[9px] font-mono font-bold text-stone-500 uppercase tracking-widest">CBN LEDGER AUDIT</span>
            </div>
            <div className="text-[10px] font-bold text-stone-700 leading-tight">Installment compliance ledger checked daily.</div>
          </div>

          <motion.div
            animate={{
              rotateX: mousePosition.y * 16,
              rotateY: mousePosition.x * -16,
              y: mousePosition.y * -8,
              x: mousePosition.x * -8
            }}
            transition={{ type: "spring", stiffness: 150, damping: 25 }}
            className="w-full relative z-10"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div 
              style={{ transformStyle: 'preserve-3d' }}
              className="bg-white rounded-xl shadow-lg border border-stone-200/80 p-5 relative overflow-hidden transition-all duration-300 group hover:shadow-2xl"
            >
              {/* Window header mockup */}
              <div 
                style={{ transform: 'translateZ(15px)' }}
                className="flex items-center justify-between pb-2 mb-4 border-b border-stone-100 transition-all"
              >
                <div className="flex space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                </div>
                <span className="text-[9px] font-mono font-bold text-stone-400 uppercase tracking-widest">Klaso School OS Live</span>
                <div className="w-10"></div>
              </div>
              
              {/* Inside elements preview card */}
              <div className="space-y-3 font-sans" style={{ transformStyle: 'preserve-3d' }}>
                <div 
                  style={{ transform: 'translateZ(40px)', transformStyle: 'preserve-3d' }}
                  className="flex items-center justify-between p-2.5 bg-[#1B4332]/5 rounded-lg border border-[#1B4332]/10 shadow-3xs transition-transform duration-300 hover:scale-[1.03] hover:bg-[#1B4332]/10"
                >
                  <div className="flex items-center space-x-2">
                    <span 
                      style={{ transform: 'translateZ(10px)' }}
                      className="text-[#1B4332] font-mono text-[10px] font-extrabold bg-[#1B4332]/10 px-1.5 py-0.5 rounded"
                    >
                      JS1A-001
                    </span>
                    <div className="text-left">
                      <div className="text-[11px] font-bold text-stone-800 leading-tight">Obi Nwosu</div>
                      <div className="text-[9px] text-stone-500 leading-tight">First Term 25/26</div>
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 bg-[#1B4332] text-white text-[9px] font-bold rounded uppercase tracking-wider">
                    On Time
                  </span>
                </div>

                <div 
                  style={{ transform: 'translateZ(55px)', transformStyle: 'preserve-3d' }}
                  className="flex items-center justify-between p-2.5 bg-yellow-50/50 rounded-lg border border-yellow-105 shadow-3xs transition-transform duration-300 hover:scale-[1.03] hover:bg-yellow-50/80"
                >
                  <div className="flex items-center space-x-2">
                    <span 
                      style={{ transform: 'translateZ(15px)' }}
                      className="text-yellow-700 font-mono text-[10px] font-extrabold bg-yellow-105 px-1.5 py-0.5 rounded"
                    >
                      JS1A-002
                    </span>
                    <div className="text-left">
                      <div className="text-[11px] font-bold text-stone-800 leading-tight">Amaka Okafor</div>
                      <div className="text-[9px] text-stone-500 leading-tight">First Term 25/26</div>
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold rounded uppercase tracking-wider">
                    Late (9:15 AM)
                  </span>
                </div>

                {/* Progress visual */}
                <div 
                  style={{ transform: 'translateZ(30px)' }}
                  className="p-3 bg-stone-50 rounded-lg border border-stone-200/60"
                >
                  <div className="flex justify-between text-[10px] font-bold text-stone-600 mb-1">
                    <span>Class Attendance Rate</span>
                    <strong className="text-[#1B4332]">94.2% Passed</strong>
                  </div>
                  <div className="w-full bg-stone-200/70 rounded-full h-1.5">
                    <div className="bg-[#1B4332] h-full rounded-full" style={{ width: '94%' }}></div>
                  </div>
                </div>
              </div>

              {/* Float badge */}
              <div 
                style={{ transform: 'translateZ(70px) scale(1.05)', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}
                className="absolute -bottom-1 -left-1 bg-[#D4A017] text-stone-950 text-[9px] font-bold px-2 py-1.5 rounded-lg shadow-2xs border border-[#b58810] flex items-center space-x-1"
              >
                <TrendingUp className="h-3 w-3 text-stone-900" />
                <span>CBN Compliant Gateway</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 3. WHAT IS IT ABOUT SECTION */}
      <section id="about" className="py-20 bg-stone-100/50 border-y border-stone-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 text-center">
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-xs font-mono font-bold text-[#D4A017] uppercase tracking-widest">
              WHAT IS KLASO ABOUT?
            </h2>
            <p className="text-2xl sm:text-3xl font-display font-bold text-stone-800 tracking-tight leading-snug">
              An all-in-one School Operating System built specifically for African academic ecosystems.
            </p>
            <p className="text-[#555] text-sm leading-relaxed max-w-2xl mx-auto">
              Klaso targets the primary pain points of modern schools: paper record storage damage, 
              untracked class teacher attendance discrepancies, unorganized CA/examination sheets, and the tedious tracking 
              of installment-based tuition school fees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12 text-left" style={{ perspective: 1000 }}>
            
            {/* AttendanceOS */}
            <motion.div 
              whileHover={{ 
                y: -8, 
                rotateX: 4, 
                rotateY: -4, 
                scale: 1.02,
                boxShadow: "0 25px 50px -12px rgba(27,67,50,0.12)"
              }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-3xs space-y-3 cursor-pointer select-none"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div 
                style={{ transform: 'translateZ(20px)' }}
                className="p-2 bg-emerald-50 rounded-lg text-[#1B4332] inline-block shadow-3xs"
              >
                <ClipboardCheck className="h-4 w-4" />
              </div>
              <div className="flex items-center space-x-1.5" style={{ transform: 'translateZ(25px)' }}>
                <h3 className="text-[#1B4332] text-sm font-bold">📋 AttendanceOS</h3>
              </div>
              <p style={{ transform: 'translateZ(10px)' }} className="text-stone-600 text-[11px] leading-normal">
                Smart classroom attendance and digital registers. Assign teachers to specific classes, check in students instantly with custom alphanumeric codes, and track on-time trends.
              </p>
            </motion.div>

            {/* AcademicsOS */}
            <motion.div 
              whileHover={{ 
                y: -8, 
                rotateX: 4, 
                rotateY: 0, 
                scale: 1.02,
                boxShadow: "0 25px 50px -12px rgba(212,160,23,0.1)"
              }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-3xs space-y-3 cursor-pointer select-none"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div 
                style={{ transform: 'translateZ(20px)' }}
                className="p-2 bg-amber-50 rounded-lg text-[#1B4332] inline-block shadow-3xs"
              >
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="flex items-center space-x-1.5" style={{ transform: 'translateZ(25px)' }}>
                <h3 className="text-[#1B4332] text-sm font-bold">🎓 AcademicsOS</h3>
              </div>
              <p style={{ transform: 'translateZ(10px)' }} className="text-stone-600 text-[11px] leading-normal">
                Gradebooks, tests, examinations, and term rankings. Set custom maximum marks (such as 30 for tests, 70 for exams) and automate grades without manual calculator errors.
              </p>
            </motion.div>

            {/* FinanceOS */}
            <motion.div 
              whileHover={{ 
                y: -8, 
                rotateX: 4, 
                rotateY: 4, 
                scale: 1.02,
                boxShadow: "0 25px 50px -12px rgba(27,67,50,0.12)"
              }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-3xs space-y-3 cursor-pointer select-none"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div 
                style={{ transform: 'translateZ(20px)' }}
                className="p-2 bg-blue-50 rounded-lg text-[#1B4332] inline-block shadow-3xs"
              >
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div className="flex items-center space-x-1.5" style={{ transform: 'translateZ(25px)' }}>
                <h3 className="text-[#1B4332] text-sm font-bold">💰 FinanceOS</h3>
              </div>
              <p style={{ transform: 'translateZ(10px)' }} className="text-stone-600 text-[11px] leading-normal">
                Tuition billing and installment tracking. Invoice new or returning students dynamically, log custom downpayments, and display professional checkouts with security seals.
              </p>
            </motion.div>

            {/* ReportOS */}
            <motion.div 
              whileHover={{ 
                y: -8, 
                rotateX: 4, 
                rotateY: -4, 
                scale: 1.02,
                boxShadow: "0 25px 50px -12px rgba(212,160,23,0.1)"
              }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-3xs space-y-3 cursor-pointer select-none"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div 
                style={{ transform: 'translateZ(20px)' }}
                className="p-2 bg-red-50 rounded-lg text-[#1B4332] inline-block shadow-3xs"
              >
                <Contact className="h-4 w-4" />
              </div>
              <div className="flex items-center space-x-1.5" style={{ transform: 'translateZ(25px)' }}>
                <h3 className="text-[#1B4332] text-sm font-bold">📄 ReportOS</h3>
                <span className="bg-[#D4A017] text-stone-950 font-mono text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">NEW</span>
              </div>
              <p style={{ transform: 'translateZ(10px)' }} className="text-stone-600 text-[11px] leading-normal">
                Automated report cards, high-fidelity PDF transcript summaries, and smart pupil ID badge generators with alpha barcodes and plastic-lamination formatting.
              </p>
            </motion.div>

            {/* PeopleOS */}
            <motion.div 
              whileHover={{ 
                y: -8, 
                rotateX: 4, 
                rotateY: 0, 
                scale: 1.02,
                boxShadow: "0 25px 50px -12px rgba(27,67,50,0.12)"
              }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-3xs space-y-3 cursor-pointer select-none"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div 
                style={{ transform: 'translateZ(20px)' }}
                className="p-2 bg-purple-50 rounded-lg text-[#1B4332] inline-block shadow-3xs"
              >
                <Users className="h-4 w-4" />
              </div>
              <div className="flex items-center space-x-1.5" style={{ transform: 'translateZ(25px)' }}>
                <h3 className="text-[#1B4332] text-sm font-bold">👥 PeopleOS</h3>
              </div>
              <p style={{ transform: 'translateZ(10px)' }} className="text-stone-600 text-[11px] leading-normal">
                Secure roster directories for students, teachers, parents, and administrative staff. Search, filter, and allocate roles dynamically with dedicated cloud persistence.
              </p>
            </motion.div>

            {/* InsightOS */}
            <motion.div 
              whileHover={{ 
                y: -8, 
                rotateX: 4, 
                rotateY: 4, 
                scale: 1.02,
                boxShadow: "0 25px 50px -12px rgba(212,160,23,0.1)"
              }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-3xs space-y-3 cursor-pointer select-none"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div 
                style={{ transform: 'translateZ(20px)' }}
                className="p-2 bg-orange-50 rounded-lg text-[#1B4332] inline-block shadow-3xs"
              >
                <TrendingUp className="h-4 w-4" />
              </div>
              <div className="flex items-center space-x-1.5" style={{ transform: 'translateZ(25px)' }}>
                <h3 className="text-[#1B4332] text-sm font-bold">📊 InsightOS</h3>
              </div>
              <p style={{ transform: 'translateZ(10px)' }} className="text-stone-600 text-[11px] leading-normal">
                Analytical intelligence panels. Track school-wide attendance rates, outstanding billing summaries, class performance metrics, and data insights from one terminal.
              </p>
            </motion.div>

            {/* AdminOS */}
            <motion.div 
              whileHover={{ 
                y: -8, 
                rotateX: 4, 
                rotateY: -4, 
                scale: 1.02,
                boxShadow: "0 25px 50px -12px rgba(27,67,50,0.12)"
              }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-3xs space-y-3 cursor-pointer select-none md:col-span-1 lg:col-span-3"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div 
                style={{ transform: 'translateZ(20px)' }}
                className="p-2 bg-yellow-50 rounded-lg text-[#1B4332] inline-block shadow-3xs"
              >
                <History className="h-4 w-4" />
              </div>
              <div className="flex items-center space-x-1.5" style={{ transform: 'translateZ(25px)' }}>
                <h3 className="text-[#1B4332] text-sm font-bold">⚙️ AdminOS</h3>
                <span className="bg-[#D4A017] text-stone-950 font-mono text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">NEW</span>
              </div>
              <p style={{ transform: 'translateZ(10px)' }} className="text-stone-600 text-[11px] leading-normal">
                Academic settings, term parameters, calendar definitions, and subscription billing. Includes the bulk term transition utility to relocate rosters to new active fee ledgers instantly.
              </p>
            </motion.div>

          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS SECTION */}
      <section id="how-it-works" className="py-20 max-w-7xl mx-auto px-4 sm:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
          <h2 className="text-xs font-mono font-bold text-[#D4A017] uppercase tracking-widest">
            DIGITAL WORKFLOW
          </h2>
          <p className="text-2xl sm:text-3xl font-display font-bold text-stone-800 tracking-tight leading-snug">
            Streamlined in Four Structured Steps
          </p>
          <p className="text-[#555] text-sm leading-relaxed max-w-2xl mx-auto">
            Setup is incredibly fast. Real-time updates occur instantly across proprietor views, administrative 
            term configuration dashboards, and class teacher registries.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* Step 1 */}
          <div className="relative text-center space-y-3.5">
            <div className="w-12 h-12 bg-[#1B4332] text-[#D4A017] text-base font-mono font-bold rounded-full flex items-center justify-center mx-auto shadow-xs">
              01
            </div>
            <h3 className="text-stone-800 text-sm font-bold uppercase tracking-wider">School Registration</h3>
            <p className="text-stone-500 text-xs leading-relaxed max-w-[220px] mx-auto">
              Proprietor registers the school, initiates the first term calendar parameters, and establishes credentials.
            </p>
          </div>

          {/* Step 2 */}
          <div className="relative text-center space-y-3.5">
            <div className="w-12 h-12 bg-[#1B4332] text-white text-base font-mono font-bold rounded-full flex items-center justify-center mx-auto shadow-xs">
              02
            </div>
            <h3 className="text-stone-800 text-sm font-bold uppercase tracking-wider">Setup classes & teachers</h3>
            <p className="text-stone-500 text-xs leading-relaxed max-w-[220px] mx-auto">
              Admin defines classrooms (e.g. JS 1A), adds class teachers with custom login credentials, and assigns registries.
            </p>
          </div>

          {/* Step 3 */}
          <div className="relative text-center space-y-3.5">
            <div className="w-12 h-12 bg-[#1B4332] text-white text-base font-mono font-bold rounded-full flex items-center justify-center mx-auto shadow-xs">
              03
            </div>
            <h3 className="text-stone-800 text-sm font-bold uppercase tracking-wider">Mark Daily Registries</h3>
            <p className="text-stone-500 text-xs leading-relaxed max-w-[220px] mx-auto">
              Class teachers mark attendance logs daily using dedicated keypads or quick alphabetical tags.
            </p>
          </div>

          {/* Step 4 */}
          <div className="relative text-center space-y-3.5">
            <div className="w-12 h-12 bg-[#1B4332] text-[#D4A017] text-base font-mono font-bold rounded-full flex items-center justify-center mx-auto shadow-xs">
              04
            </div>
            <h3 className="text-stone-800 text-sm font-bold uppercase tracking-wider">Export Ledger & Analytics</h3>
            <p className="text-stone-500 text-xs leading-relaxed max-w-[220px] mx-auto">
              Admin instantly downloads high-fidelity PDF/CSV reports, audits gradebooks, or monitors tuition fee installments.
            </p>
          </div>

        </div>
      </section>

      {/* 5. SUBSCRIPTION PRICING PLANS SECTION */}
      <section id="pricing" className="py-20 bg-stone-100 border-t border-stone-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <h2 className="text-xs font-mono font-bold text-[#D4A017] uppercase tracking-widest">
              TRANSPARENT PRICING
            </h2>
            <p className="text-2xl sm:text-3xl font-display font-bold text-stone-800 tracking-tight leading-snug">
              Compare Our Simple Termly Tiers
            </p>
            <p className="text-[#555] text-sm leading-relaxed max-w-2xl mx-auto">
              Select the best tier for your institution. Start on the Free Plan for basic register marking, 
              or upgrade to the Premium Plan to unlock the full potential of comprehensive school records.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            
            {/* TIER 1: FREE PLAN */}
            <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 overflow-hidden shadow-xs relative flex flex-col justify-between">
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[#1B4332] text-xs font-bold uppercase tracking-widest px-2.5 py-1 bg-stone-100 rounded-md">
                    Basic Register
                  </span>
                  <span className="text-stone-500 text-xs">Standard Enrollment</span>
                </div>
                
                <div className="space-y-1">
                  <span className="text-3xl sm:text-4xl font-extrabold text-stone-800">₦0</span>
                  <span className="text-stone-500 text-xs font-mono">/ term</span>
                </div>

                <p className="text-stone-600 text-xs leading-relaxed pt-1">
                  A modern replacement for standard physical cardboard attendance files. Excellent for isolated classroom registries checking on-time performance.
                </p>
              </div>

              <div className="p-6 bg-stone-50/50 space-y-4 flex-1 flex flex-col justify-between">
                <ul className="space-y-2.5 text-xs text-stone-600">
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Mark Daily Student Attendance Registers</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Quick Code check-in keypad included</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Responsive dashboard overview graphs</span>
                  </li>
                  <li className="flex items-center space-x-2.5 text-stone-400">
                    <Lock className="h-4 w-4 shrink-0" />
                    <span>No PDF / CSV Attendance Spreadsheets</span>
                  </li>
                  <li className="flex items-center space-x-2.5 text-stone-400">
                    <Lock className="h-4 w-4 shrink-0" />
                    <span>No Subject Assessment Continuous Gradebook</span>
                  </li>
                  <li className="flex items-center space-x-2.5 text-stone-400">
                    <Lock className="h-4 w-4 shrink-0" />
                    <span>No Tuitions Billing Installments Ledger</span>
                  </li>
                </ul>

                <button
                  onClick={() => onOpenPortal('register', 'free')}
                  className="mt-6 w-full py-2.5 px-4 rounded-xl text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  Create Free Account
                </button>
              </div>
            </div>

            {/* TIER 2: PREMIUM PLAN */}
            <div className="bg-white rounded-2xl border-2 border-[#1B4332] divide-y divide-stone-100 overflow-hidden shadow-md relative flex flex-col justify-between">
              <div className="absolute top-2.5 right-2.5 px-3 py-1 bg-[#D4A017] rounded-full text-stone-950 text-2xs font-bold uppercase tracking-wider shadow-2xs font-mono">
                Recommended
              </div>

              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-white text-xs font-bold uppercase tracking-widest px-2.5 py-1 bg-[#1B4332] rounded-md">
                    Premium Slate
                  </span>
                  <span className="text-stone-500 text-xs">Full-Access Active Ledger</span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-baseline space-x-1">
                    <span className="text-3xl sm:text-4xl font-extrabold text-[#1B4332]">₦60,000</span>
                    <span className="text-stone-500 text-xs font-mono">/ 3 terms</span>
                  </div>
                  <div className="text-[#D4A017] text-[10px] font-bold font-mono uppercase tracking-wider">
                    Equivalent to only ₦20,000 per single term!
                  </div>
                </div>

                <p className="text-stone-600 text-xs leading-relaxed pt-1">
                  The complete management software for proactive schools. Empowers administrators with interactive gradebooks, installment ledgers, and priority support.
                </p>
              </div>

              <div className="p-6 bg-stone-50/50 space-y-4 flex-1 flex flex-col justify-between">
                <ul className="space-y-2.5 text-xs text-stone-600">
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="h-4 w-4 text-[#1B4332] shrink-0" />
                    <strong>Mark Daily Student Attendance Registers</strong>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="h-4 w-4 text-[#1B4332] shrink-0" />
                    <strong>Attendance PDF & CSV report spreadsheet tools</strong>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="h-4 w-4 text-[#1B4332] shrink-0" />
                    <strong>Subject Assessment Continuous Gradebook (Tests/Exams)</strong>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="h-4 w-4 text-[#1B4332] shrink-0" />
                    <strong>Roster teacher assignment administrative controls</strong>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="h-4 w-4 text-[#1B4332] shrink-0" />
                    <strong>Tuition installment invoicing & fees tracking</strong>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="h-4 w-4 text-[#1B4332] shrink-0" />
                    <strong>CBN mock payment checkout & receipts simulator</strong>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="h-4 w-4 text-[#1B4332] shrink-0" />
                    <strong>Smart Pupil ID Badge printing & photo customization</strong>
                    <span className="bg-[#D4A017] text-stone-950 font-mono text-[7px] font-black px-1 py-0.2 rounded-sm uppercase tracking-wider">NEW</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="h-4 w-4 text-[#1B4332] shrink-0" />
                    <strong>Bulk semester rollover active pupil transition utility</strong>
                    <span className="bg-[#D4A017] text-stone-950 font-mono text-[7px] font-black px-1 py-0.2 rounded-sm uppercase tracking-wider">NEW</span>
                  </li>
                  <li className="flex items-center space-x-2.5">
                    <CheckCircle className="h-4 w-4 text-[#1B4332] shrink-0" />
                    <strong>Guaranteed 24/7 proprietor support</strong>
                  </li>
                </ul>

                <button
                  onClick={() => onOpenPortal('register', 'premium')}
                  className="mt-6 w-full py-2.5 px-4 rounded-xl text-white bg-[#1B4332] hover:bg-[#143225] font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Create Premium Account (₦20,000/term)
                </button>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 6. FAQS ACCORDION SECTION */}
      <section className="py-20 max-w-5xl mx-auto px-4 sm:px-8 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-xs font-mono font-bold text-[#D4A017] uppercase tracking-widest">
            HAVE QUESTIONS?
          </h2>
          <p className="text-2xl font-display font-bold text-stone-800">
            Frequently Asked Inquiries
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          <div className="bg-white p-5 rounded-xl border border-stone-200">
            <h4 className="font-bold text-stone-800 text-sm flex items-center space-x-2 mb-2">
              <Zap className="h-4 w-4 text-[#D4A017]" />
              <span>Can we switch from Free to Premium?</span>
            </h4>
            <p className="text-stone-500 text-xs leading-relaxed">
              Yes, absolutely. If your school starts on the Free Plan, you can pay your termly subscription setup 
              directly from your proprietor billing panel at any point during active operations to unlock all premium features.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-stone-200">
            <h4 className="font-bold text-stone-800 text-sm flex items-center space-x-2 mb-2">
              <ShieldCheck className="h-4 w-4 text-[#1B4332]" />
              <span>How secure are our school files?</span>
            </h4>
            <p className="text-stone-500 text-xs leading-relaxed">
              Your registries and gradebooks are protected by state-of-the-art Firestore Database rules, 
              ensuring that only authorized admins and classroom teachers associated specifically with your school can access the records.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-stone-900 text-stone-400 py-12 px-4 sm:px-8 border-t border-stone-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-[#1B4332] rounded-lg text-white">
              <ClipboardCheck className="h-4 w-4 text-[#D4A017]" />
            </div>
            <div>
              <span className="font-display font-bold text-white text-base tracking-tight">Klaso</span>
              <span className="text-[9px] block font-mono text-stone-500 leading-none uppercase tracking-wider">School Operating System</span>
            </div>
          </div>
          <p className="text-3xs font-mono text-stone-500">
            © 2026 KLASO AFRICA. COMPLIANT WITH INTEGRATED EDUCATION INFRASTRUCTURE REGISTRIES.
          </p>
          <div className="flex space-x-4 text-xs font-semibold">
            <a href="#about" className="hover:text-white transition-colors">About</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
        </div>
      </footer>

    </div>
  );
};
