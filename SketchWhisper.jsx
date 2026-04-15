import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, onSnapshot, updateDoc, collection, 
  getDoc, arrayUnion, runTransaction 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { 
  Pencil, Eraser, Trash2, Send, Users, Play, 
  Type, Image as ImageIcon, CheckCircle, Palette, ArrowRight, Copy, LogOut, User as UserIcon, Save, Camera, Upload
} from 'lucide-react';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'sketch-whisper-v2';

// --- AVATARES DISPONÍVEIS (FALLBACK) ---
const AVATARS = ["🐱", "🐶", "🦊", "🐸", "🤖", "🦄", "🐼", "🐯", "🐵", "🦁", "🐧", "🐷"];

// --- COMPONENTE AUXILIAR PARA RENDERIZAR AVATAR ---
const AvatarDisplay = ({ avatar, className = "w-12 h-12" }) => {
  const isImage = avatar && avatar.startsWith('data:image');
  
  return (
    <div className={`${className} rounded-xl border-2 border-slate-700 flex items-center justify-center overflow-hidden bg-slate-800 shadow-inner`}>
      {isImage ? (
        <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
      ) : (
        <span className="text-2xl">{avatar || "❓"}</span>
      )}
    </div>
  );
};

// --- COMPONENTE CANVAS ---
const DrawingCanvas = ({ onSave, initialData }) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#38bdf8');
  const [lineWidth, setLineWidth] = useState(5);
  const [tool, setTool] = useState('pencil');

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    contextRef.current = ctx;

    if (initialData) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = initialData;
    }
  }, []);

  const getCoordinates = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.nativeEvent.offsetX,
      y: e.nativeEvent.offsetY
    };
  };

  const startDrawing = (e) => {
    const { x, y } = getCoordinates(e);
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    setIsDrawing(true);
    if (e.cancelable) e.preventDefault();
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    contextRef.current.strokeStyle = tool === 'eraser' ? '#1e293b' : color;
    contextRef.current.lineWidth = lineWidth;
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
    if (e.cancelable) e.preventDefault();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      contextRef.current.closePath();
      setIsDrawing(false);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    contextRef.current.clearRect(0, 0, rect.width, rect.height);
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-slate-700 shadow-lg">
        <div className="flex gap-2">
          <button onClick={() => setTool('pencil')} className={`p-2 rounded-lg transition ${tool === 'pencil' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:bg-slate-700'}`} title="Lápis"><Pencil size={20}/></button>
          <button onClick={() => setTool('eraser')} className={`p-2 rounded-lg transition ${tool === 'eraser' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:bg-slate-700'}`} title="Borracha"><Eraser size={20}/></button>
          <button onClick={clear} className="p-2 rounded-lg text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition" title="Limpar Tudo"><Trash2 size={20}/></button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 rounded-lg px-2 py-1">
             <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none" />
          </div>
          <input type="range" min="1" max="30" value={lineWidth} onChange={(e) => setLineWidth(e.target.value)} className="w-24 accent-sky-500" />
        </div>
      </div>
      
      <div className="relative aspect-video w-full bg-[#1e293b] rounded-2xl border-2 border-slate-700 overflow-hidden shadow-2xl cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full touch-none"
        />
      </div>

      <button 
        onClick={() => onSave(canvasRef.current.toDataURL())}
        className="w-full py-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95"
      >
        <CheckCircle size={20}/> ENVIAR DESENHO
      </button>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState('lobby'); 
  const [currentInput, setCurrentInput] = useState('');
  const [targetData, setTargetData] = useState(null);
  const [round, setRound] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  // Perfil
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState(AVATARS[0]);
  const [profileConfirmed, setProfileConfirmed] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Erro na autenticação", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        const profileRef = doc(db, 'artifacts', appId, 'users', u.uid, 'settings', 'profile');
        getDoc(profileRef).then(docSnap => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserName(data.name);
            setUserAvatar(data.avatar);
            setProfileConfirmed(true);
          }
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !roomId || !profileConfirmed) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setRoom(data);
        setPlayers(data.players || []);
        setGameState(data.status);
        setRound(data.currentRound);
        if (data.status !== 'lobby' && data.status !== 'results') determineTarget(data);
      } else {
        setRoom(null);
        setRoomId('');
      }
    });
    return () => unsubscribe();
  }, [user, roomId, profileConfirmed]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500000) { // Limite de 500kb para performance no Firestore
        // Em um app real, aqui teríamos um alerta customizado
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setUserAvatar(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveProfile = async () => {
    if (!user || !userName.trim()) return;
    setSavingProfile(true);
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
    await setDoc(profileRef, {
      name: userName,
      avatar: userAvatar,
      updatedAt: Date.now()
    });
    setProfileConfirmed(true);
    setSavingProfile(false);
  };

  const determineTarget = (roomData) => {
    const playerIndex = roomData.players.findIndex(p => p.id === user.uid);
    const totalPlayers = roomData.players.length;
    if (roomData.currentRound > 0) {
      const prevPlayerIndex = (playerIndex - 1 + totalPlayers) % totalPlayers;
      const prevPlayerId = roomData.players[prevPlayerIndex].id;
      const prevHistory = roomData.history?.[prevPlayerId] || [];
      const content = prevHistory[roomData.currentRound - 1];
      setTargetData(content);
    }
    const myHistory = roomData.history?.[user.uid] || [];
    setIsReady(myHistory.length > roomData.currentRound);
  };

  const createRoom = async () => {
    if (!user || !profileConfirmed) return;
    const newId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', newId);
    await setDoc(roomRef, {
      id: newId,
      status: 'lobby',
      players: [{ id: user.uid, name: userName, isHost: true, avatar: userAvatar }],
      currentRound: 0,
      history: {},
      createdAt: Date.now()
    });
    setRoomId(newId);
  };

  const joinRoom = async () => {
    if (!roomId || !user || !profileConfirmed) return;
    const cleanId = roomId.trim().toUpperCase();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', cleanId);
    try {
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.status !== 'lobby') return;
        if (data.players.some(p => p.id === user.uid)) {
          setRoomId(cleanId);
          return;
        }
        await updateDoc(roomRef, {
          players: arrayUnion({ id: user.uid, name: userName, isHost: false, avatar: userAvatar })
        });
        setRoomId(cleanId);
      }
    } catch (e) { console.error(e); }
  };

  const startGame = async () => {
    if (!user || !roomId) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    await updateDoc(roomRef, { status: 'write', currentRound: 0 });
  };

  const submitTurn = async (content) => {
    if (!user || !roomId || isReady) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    try {
      await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(roomRef);
        if (!sfDoc.exists()) return;
        const data = sfDoc.data();
        const currentHistory = data.history[user.uid] || [];
        if (currentHistory.length > data.currentRound) return;
        const newHistory = [...currentHistory, content];
        const updatedHistory = { ...data.history, [user.uid]: newHistory };
        transaction.update(roomRef, { history: updatedHistory });
        const allPlayersReady = data.players.every(p => {
          const h = p.id === user.uid ? newHistory : (data.history[p.id] || []);
          return h.length > data.currentRound;
        });
        if (allPlayersReady) {
          const nextRound = data.currentRound + 1;
          let nextStatus = nextRound >= data.players.length ? 'results' : 
            (data.status === 'write' || data.status === 'describe' ? 'draw' : 'describe');
          transaction.update(roomRef, { status: nextStatus, currentRound: nextRound });
        }
      });
      setIsReady(true);
      setCurrentInput('');
    } catch (e) { console.error(e); }
  };

  const copyCode = () => {
    const textArea = document.createElement("textarea");
    textArea.value = roomId;
    textArea.style.position = "fixed"; textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (err) { console.error(err); }
    document.body.removeChild(textArea);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sky-500 font-bold animate-pulse text-xs tracking-widest">SINCROZINANDO...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-sky-500/30">
      <main className="max-w-4xl mx-auto px-4 py-8 pb-24">
        
        <header className="flex flex-col items-center mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-sky-500 rounded-2xl shadow-[0_0_30px_rgba(14,165,233,0.3)]">
              <Palette className="text-white" size={32} />
            </div>
            <h1 className="text-4xl font-black tracking-tighter italic">
              SKETCH<span className="text-sky-500 underline decoration-4 underline-offset-4">WHISPER</span>
            </h1>
          </div>
          <p className="text-slate-500 font-bold tracking-[0.2em] text-xs uppercase">O Telefone Sem Fio Visual</p>
        </header>

        {/* CONFIGURAÇÃO DE PERFIL COM UPLOAD */}
        {!profileConfirmed && (
          <div className="max-w-md mx-auto animate-in fade-in slide-in-from-top-4 duration-500">
             <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 backdrop-blur-sm shadow-2xl space-y-8">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-black italic tracking-tight uppercase">Seu Perfil</h2>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Personalize como os outros te veem</p>
                </div>

                <div className="flex flex-col items-center gap-6">
                  <div className="relative group cursor-pointer" onClick={() => fileInputRef.current.click()}>
                    <AvatarDisplay avatar={userAvatar} className="w-28 h-28 border-4 border-slate-700 hover:border-sky-500 transition-colors" />
                    <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="text-white" size={24} />
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                  </div>

                  <div className="flex flex-wrap justify-center gap-2">
                    {AVATARS.map(av => (
                      <button key={av} onClick={() => setUserAvatar(av)} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${userAvatar === av ? 'bg-sky-500 scale-110 shadow-lg' : 'bg-slate-800 hover:bg-slate-700'}`}>
                        {av}
                      </button>
                    ))}
                    <button onClick={() => fileInputRef.current.click()} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-700 hover:bg-sky-500 text-white transition-all">
                      <Upload size={18} />
                    </button>
                  </div>

                  <div className="w-full space-y-2">
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                      <input type="text" maxLength={12} placeholder="Seu Apelido" value={userName} onChange={(e) => setUserName(e.target.value)}
                        className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl pl-12 pr-6 py-4 focus:outline-none focus:border-sky-500 transition-all font-bold text-lg"
                      />
                    </div>
                  </div>

                  <button onClick={saveProfile} disabled={savingProfile || !userName.trim()}
                    className="w-full py-4 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3"
                  >
                    {savingProfile ? 'SALVANDO...' : 'CONFIRMAR PERFIL'} <Save size={20}/>
                  </button>
                </div>
             </div>
          </div>
        )}

        {profileConfirmed && !room && (
          <div className="max-w-md mx-auto space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="bg-slate-900/80 p-4 rounded-3xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AvatarDisplay avatar={userAvatar} className="w-12 h-12" />
                <div>
                  <p className="text-slate-500 text-[8px] font-black tracking-widest uppercase">JOGANDO COMO</p>
                  <p className="font-black text-sky-400">{userName.toUpperCase()}</p>
                </div>
              </div>
              <button onClick={() => setProfileConfirmed(false)} className="p-2 text-slate-600 hover:text-sky-500 transition-colors">
                <Palette size={18} />
              </button>
            </div>

            <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 backdrop-blur-sm shadow-2xl space-y-6">
              <button onClick={createRoom} className="w-full py-5 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3 text-lg group">
                <Play className="group-hover:translate-x-1 transition-transform" fill="currentColor" size={20}/> CRIAR NOVA SALA
              </button>
              <div className="flex items-center gap-4 py-2">
                <div className="h-px flex-1 bg-slate-800"></div>
                <span className="text-slate-600 text-xs font-black uppercase tracking-widest">OU</span>
                <div className="h-px flex-1 bg-slate-800"></div>
              </div>
              <div className="space-y-3">
                <input type="text" placeholder="CÓDIGO DA SALA" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-5 focus:outline-none focus:border-sky-500 transition-colors uppercase font-mono tracking-widest text-center text-xl"
                />
                <button onClick={joinRoom} disabled={!roomId} className="w-full py-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 font-bold rounded-2xl transition-all uppercase text-sm tracking-widest">
                  Entrar na Sala
                </button>
              </div>
            </div>
          </div>
        )}

        {room && gameState === 'lobby' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-slate-500 text-[10px] font-black uppercase block mb-1">CÓDIGO</span>
                  <div className="flex items-center gap-2 group cursor-pointer" onClick={copyCode}>
                    <span className="text-3xl font-mono font-black text-sky-400">{room.id}</span>
                    <div className="p-1.5 bg-slate-800 rounded-lg group-hover:bg-sky-500 transition-colors">
                      {copyFeedback ? <CheckCircle size={14}/> : <Copy size={14} />}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-3 bg-slate-800 rounded-2xl border border-slate-700">
                <Users size={20} className="text-sky-400" />
                <span className="font-black text-lg">{players.length} <span className="text-slate-500 text-sm tracking-tighter">JOGADORES</span></span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {players.map((p) => (
                <div key={p.id} className={`relative p-5 rounded-3xl border-2 transition-all ${p.id === user?.uid ? 'border-sky-500 bg-sky-500/10 scale-105 shadow-2xl z-10' : 'border-slate-800 bg-slate-900'} flex flex-col items-center gap-3 group`}>
                  <AvatarDisplay avatar={p.avatar} className="w-20 h-20 shadow-xl" />
                  <span className="text-sm font-black truncate w-full text-center tracking-tight uppercase">
                    {p.id === user?.uid ? 'VOCÊ' : p.name}
                  </span>
                  {p.isHost && (
                    <div className="absolute top-2 right-2 p-1.5 bg-amber-500 rounded-lg shadow-lg">
                      <Palette size={10} className="text-slate-900" fill="currentColor" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {room.players.find(p => p.id === user?.uid)?.isHost ? (
              <button onClick={startGame} disabled={players.length < 2}
                className="w-full py-6 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-black rounded-3xl shadow-xl transition-all text-2xl tracking-tighter italic uppercase"
              >
                {players.length < 2 ? 'Esperando amigos...' : 'Iniciar Partida'}
              </button>
            ) : (
              <div className="p-8 bg-slate-900/80 border-2 border-dashed border-slate-800 rounded-3xl text-center">
                <p className="font-bold text-slate-500 italic uppercase text-xs tracking-widest">Aguardando o anfitrião...</p>
              </div>
            )}
          </div>
        )}

        {gameState === 'write' && (
          <div className="space-y-8 text-center animate-in zoom-in-95 duration-300 py-10">
            <div className="space-y-4">
              <Type className="text-sky-500 mx-auto" size={48} />
              <h2 className="text-4xl font-black italic tracking-tighter uppercase">Como tudo começa?</h2>
              <p className="text-slate-400 font-medium">Escreva uma frase criativa para alguém desenhar.</p>
            </div>
            {!isReady ? (
              <div className="max-w-lg mx-auto flex flex-col gap-4">
                <input type="text" value={currentInput} autoFocus onKeyPress={(e) => e.key === 'Enter' && currentInput.trim() && submitTurn(currentInput)}
                  onChange={(e) => setCurrentInput(e.target.value)} placeholder="Ex: Um robô fazendo crochê..."
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-3xl px-8 py-6 focus:border-sky-500 transition-all text-xl font-medium shadow-2xl"
                />
                <button onClick={() => currentInput.trim() && submitTurn(currentInput)}
                  className="bg-sky-500 hover:bg-sky-400 py-5 rounded-3xl text-white font-black text-xl shadow-lg transition-all"
                >
                  PRONTO!
                </button>
              </div>
            ) : (
              <div className="p-16 bg-slate-900/50 rounded-[3rem] border-4 border-dashed border-slate-800 animate-pulse">
                <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                <p className="font-black text-2xl uppercase">História Enviada!</p>
              </div>
            )}
          </div>
        )}

        {gameState === 'draw' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {!isReady ? (
              <>
                <div className="text-center space-y-3">
                  <h2 className="text-4xl font-black italic uppercase">Desenhe isso:</h2>
                  <div className="inline-block px-10 py-5 bg-slate-800 rounded-3xl border-2 border-slate-700 text-2xl font-black shadow-2xl mt-4">
                    "{targetData}"
                  </div>
                </div>
                <DrawingCanvas onSave={(data) => submitTurn(data)} />
              </>
            ) : (
              <div className="p-24 text-center space-y-6">
                <ImageIcon size={64} className="text-slate-700 mx-auto animate-bounce" />
                <h3 className="text-3xl font-black uppercase">Obra enviada!</h3>
              </div>
            )}
          </div>
        )}

        {gameState === 'describe' && (
          <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
            {!isReady ? (
              <div className="max-w-2xl mx-auto space-y-8">
                <h2 className="text-4xl font-black text-center uppercase italic">Adivinhe o desenho</h2>
                <div className="aspect-video w-full bg-white rounded-[2.5rem] overflow-hidden shadow-2xl p-4">
                  <img src={targetData} alt="Adivinhe" className="w-full h-full object-contain pointer-events-none" />
                </div>
                <div className="flex flex-col gap-4">
                  <input type="text" value={currentInput} autoFocus onKeyPress={(e) => e.key === 'Enter' && currentInput.trim() && submitTurn(currentInput)}
                    onChange={(e) => setCurrentInput(e.target.value)} placeholder="O que você está vendo?"
                    className="w-full bg-slate-800 border-2 border-slate-700 rounded-3xl px-8 py-6 focus:border-sky-500 transition-all text-xl font-medium shadow-2xl text-center"
                  />
                  <button onClick={() => currentInput.trim() && submitTurn(currentInput)}
                    className="bg-sky-500 hover:bg-sky-400 py-5 rounded-3xl text-white font-black text-xl shadow-lg transition-all"
                  >
                    ENVIAR PALPITE
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-24 text-center space-y-6">
                <CheckCircle className="text-green-500 mx-auto" size={64} />
                <h3 className="text-3xl font-black uppercase tracking-widest italic">Palpite enviado!</h3>
              </div>
            )}
          </div>
        )}

        {gameState === 'results' && (
          <div className="space-y-16 animate-in fade-in duration-1000 pb-20">
            <h2 className="text-6xl font-black text-center text-transparent bg-clip-text bg-gradient-to-br from-sky-400 to-blue-600 uppercase italic">Álbum Completo!</h2>
            <div className="space-y-32">
              {room.players.map((originPlayer, pIdx) => (
                <section key={originPlayer.id} className="relative p-10 bg-slate-900/30 rounded-[4rem] border border-slate-800/50 backdrop-blur-sm">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 px-8 py-3 rounded-full border-2 border-slate-700 font-black text-sky-400 shadow-2xl uppercase flex items-center gap-3">
                    <AvatarDisplay avatar={originPlayer.avatar} className="w-8 h-8" /> 
                    <span>Corrente de {originPlayer.name}</span>
                  </div>
                  <div className="space-y-16 pt-8">
                    {room.players.map((_, stepIdx) => {
                      const total = room.players.length;
                      const author = room.players[(pIdx + stepIdx) % total];
                      const content = room.history[author.id]?.[stepIdx];
                      if (!content) return null;
                      const isImage = content.startsWith('data:image');
                      return (
                        <div key={stepIdx} className="flex flex-col items-center gap-6 group">
                          <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700 opacity-80 group-hover:opacity-100 transition-opacity">
                             <AvatarDisplay avatar={author.avatar} className="w-8 h-8" />
                             <span className="text-[10px] font-black uppercase text-slate-400">{author.name} {stepIdx === 0 ? 'começou:' : isImage ? 'desenhou:' : 'adivinhou:'}</span>
                          </div>
                          {isImage ? (
                            <div className="w-full max-w-xl p-4 bg-white rounded-[2.5rem] shadow-2xl transition-all hover:scale-105">
                              <img src={content} alt="Arte" className="w-full h-auto rounded-3xl" />
                            </div>
                          ) : (
                            <div className="w-full max-w-xl p-10 bg-slate-800 rounded-[3rem] border-2 border-slate-700 text-center transition-all hover:scale-105">
                              <p className="text-3xl font-black italic leading-tight">"{content}"</p>
                            </div>
                          )}
                          {stepIdx < room.players.length - 1 && <ArrowRight size={40} className="text-slate-800 py-4 animate-bounce" />}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            <div className="flex flex-col gap-4 max-w-md mx-auto">
              <button onClick={() => window.location.reload()} className="w-full py-6 bg-sky-500 hover:bg-sky-400 text-white font-black rounded-[2rem] shadow-2xl transition-all text-2xl uppercase italic">Jogar Novamente</button>
              <button onClick={() => setRoomId('')} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-2xl transition-all uppercase text-xs">Voltar ao Menu</button>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER STATUS */}
      {room && (
        <footer className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur-lg border-t border-slate-800 z-50">
          <div className="max-w-4xl mx-auto flex justify-between items-center text-[10px] font-black text-slate-500 uppercase">
            <div className="flex items-center gap-6">
              <div className="flex flex-col"><span className="text-slate-600">SALA</span><span className="text-sky-400 font-mono text-sm">{room.id}</span></div>
              <div className="flex flex-col"><span className="text-slate-600">RODADA</span><span className="text-sky-400 text-sm">{gameState === 'results' ? 'FIM' : `${round + 1}/${players.length}`}</span></div>
            </div>
            <div className="flex items-center gap-4">
               <div className="flex -space-x-3">
                 {players.map(p => (
                    <AvatarDisplay key={p.id} avatar={p.avatar} className={`w-10 h-10 border-slate-950 shadow-lg transition-all ${(room.history[p.id]?.length || 0) > round ? 'grayscale-0 scale-110 border-green-500' : 'grayscale opacity-50 border-slate-700'}`} />
                 ))}
               </div>
               {room.players.find(p => p.id === user?.uid)?.isHost && <button onClick={() => setRoom(null)} className="p-2 hover:text-red-400 transition-colors"><LogOut size={16} /></button>}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}