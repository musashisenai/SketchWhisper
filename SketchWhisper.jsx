import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, onSnapshot, updateDoc, collection, 
  query, where, deleteDoc, getDoc, arrayUnion 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { 
  Pencil, Eraser, Trash2, Send, Users, Play, 
  Type, Image as ImageIcon, CheckCircle, Palette, ArrowRight 
} from 'lucide-react';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'sketch-whisper-v1';

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
    
    // Ajuste de DPI para telas de alta densidade
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    contextRef.current = ctx;

    if (initialData) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = initialData;
    }
  }, []);

  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current.strokeStyle = tool === 'eraser' ? '#1e293b' : color;
    contextRef.current.lineTo(offsetX, offsetY);
    contextRef.current.stroke();
  };

  const stopDrawing = () => {
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    contextRef.current.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-slate-700 shadow-lg">
        <div className="flex gap-2">
          <button onClick={() => setTool('pencil')} className={`p-2 rounded-lg transition ${tool === 'pencil' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:bg-slate-700'}`}><Pencil size={20}/></button>
          <button onClick={() => setTool('eraser')} className={`p-2 rounded-lg transition ${tool === 'eraser' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:bg-slate-700'}`}><Eraser size={20}/></button>
          <button onClick={clear} className="p-2 rounded-lg text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition"><Trash2 size={20}/></button>
        </div>
        <div className="flex items-center gap-3">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none" />
          <input type="range" min="1" max="20" value={lineWidth} onChange={(e) => setLineWidth(e.target.value)} className="w-24 accent-sky-500" />
        </div>
      </div>
      
      <div className="relative aspect-video w-full bg-[#1e293b] rounded-2xl border-2 border-slate-700 overflow-hidden shadow-2xl cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            const rect = canvasRef.current.getBoundingClientRect();
            startDrawing({ nativeEvent: { offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top } });
          }}
          onTouchMove={(e) => {
            const touch = e.touches[0];
            const rect = canvasRef.current.getBoundingClientRect();
            draw({ nativeEvent: { offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top } });
          }}
          onTouchEnd={stopDrawing}
          className="w-full h-full"
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
  const [gameState, setGameState] = useState('lobby'); // lobby, write, draw, describe, results
  const [currentInput, setCurrentInput] = useState('');
  const [targetData, setTargetData] = useState(null);
  const [round, setRound] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);

  // Auth e Inicialização (Seguindo a REGRA 3)
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
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync Room Data (Seguindo a REGRA 1 e REGRA 3)
  useEffect(() => {
    if (!user || !roomId) return;

    // Caminho correto: collection(db, 'artifacts', appId, 'public', 'data', collectionName)
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setRoom(data);
        setPlayers(data.players || []);
        setGameState(data.status);
        setRound(data.currentRound);
        
        if (data.status !== 'lobby' && data.status !== 'results') {
          determineTarget(data);
        }
      }
    }, (err) => console.error("Erro no Firestore:", err));

    return () => unsubscribe();
  }, [user, roomId]);

  const determineTarget = (roomData) => {
    const playerIndex = roomData.players.findIndex(p => p.id === user.uid);
    const totalPlayers = roomData.players.length;
    
    // Lógica de "Whisper": cada rodada você recebe do jogador anterior
    const shift = (roomData.currentRound + 1) % totalPlayers;
    const fromIndex = (playerIndex - shift + totalPlayers) % totalPlayers;
    const fromPlayerId = roomData.players[fromIndex].id;
    
    const history = roomData.history?.[fromPlayerId] || [];
    const lastContent = history[history.length - 1];
    setTargetData(lastContent);
    
    const myHistory = roomData.history?.[user.uid] || [];
    if (myHistory.length > roomData.currentRound) {
      setIsReady(true);
    } else {
      setIsReady(false);
    }
  };

  const createRoom = async () => {
    if (!user) return;
    const newId = Math.random().toString(36).substring(2, 7).toUpperCase();
    // Corrigido para caminho par (6 segmentos): artifacts/{appId}/public/data/rooms/{newId}
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', newId);
    const initialPlayer = { id: user.uid, name: `Jogador ${user.uid.slice(0, 4)}`, isHost: true };
    
    await setDoc(roomRef, {
      id: newId,
      status: 'lobby',
      players: [initialPlayer],
      currentRound: 0,
      history: {},
      createdAt: Date.now()
    });
    setRoomId(newId);
  };

  const joinRoom = async () => {
    if (!roomId || !user) return;
    const cleanId = roomId.trim().toUpperCase();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', cleanId);
    const snap = await getDoc(roomRef);
    
    if (snap.exists()) {
      const newPlayer = { id: user.uid, name: `Jogador ${user.uid.slice(0, 4)}`, isHost: false };
      await updateDoc(roomRef, {
        players: arrayUnion(newPlayer)
      });
      setRoomId(cleanId);
    }
  };

  const startGame = async () => {
    if (!user || !roomId) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    await updateDoc(roomRef, { 
      status: 'write',
      currentRound: 0 
    });
  };

  const submitTurn = async (content) => {
    if (!user || !roomId) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    const historyPath = `history.${user.uid}`;
    
    await updateDoc(roomRef, {
      [historyPath]: arrayUnion(content)
    });
    setIsReady(true);

    const snap = await getDoc(roomRef);
    const data = snap.data();
    const allReady = data.players.every(p => (data.history[p.id]?.length || 0) > data.currentRound);

    if (allReady) {
      const nextRound = data.currentRound + 1;
      let nextStatus = '';
      
      if (nextRound >= data.players.length) {
        nextStatus = 'results';
      } else {
        nextStatus = data.status === 'write' || data.status === 'describe' ? 'draw' : 'describe';
      }

      await updateDoc(roomRef, {
        status: nextStatus,
        currentRound: nextRound
      });
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-sky-500"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-sky-500/30">
      <main className="max-w-4xl mx-auto px-4 py-8">
        
        {/* HEADER */}
        <header className="flex flex-col items-center mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-sky-500 rounded-2xl shadow-[0_0_20px_rgba(14,165,233,0.4)]">
              <Palette className="text-white" size={32} />
            </div>
            <h1 className="text-4xl font-black tracking-tighter italic">
              SKETCH<span className="text-sky-500 underline decoration-2 underline-offset-4">WHISPER</span>
            </h1>
          </div>
          <p className="text-slate-400 font-medium tracking-wide">O TELEFONE SEM FIO VISUAL</p>
        </header>

        {/* LOBBY / ENTRADA */}
        {!room && (
          <div className="max-w-md mx-auto space-y-8 bg-slate-900/50 p-8 rounded-3xl border border-slate-800 backdrop-blur-sm shadow-xl">
            <div className="space-y-4">
              <button 
                onClick={createRoom}
                className="w-full py-5 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-2xl shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-3 text-lg"
              >
                <Play fill="currentColor" size={20}/> CRIAR NOVA SALA
              </button>
              
              <div className="flex items-center gap-4 py-2">
                <div className="h-px flex-1 bg-slate-800"></div>
                <span className="text-slate-600 text-sm font-bold">OU ENTRE EM UMA</span>
                <div className="h-px flex-1 bg-slate-800"></div>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="CÓDIGO" 
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  className="flex-1 bg-slate-800 border-2 border-slate-700 rounded-2xl px-5 py-4 focus:outline-none focus:border-sky-500 transition-colors uppercase font-mono tracking-widest"
                />
                <button 
                  onClick={joinRoom}
                  className="px-6 bg-slate-700 hover:bg-slate-600 font-bold rounded-2xl transition-all"
                >
                  ENTRAR
                </button>
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-800/50 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Desenvolvido por Gemini Studio</p>
            </div>
          </div>
        )}

        {/* SALA DE ESPERA */}
        {room && gameState === 'lobby' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <span className="text-slate-500 text-sm font-bold uppercase tracking-widest">SALA</span>
                <span className="text-3xl font-mono font-black text-sky-400 tracking-tighter">{room.id}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-full border border-slate-700">
                <Users size={16} className="text-sky-400" />
                <span className="font-bold">{players.length} Jogadores</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {players.map((p) => (
                <div key={p.id} className={`p-4 rounded-2xl border ${p.id === user?.uid ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800 bg-slate-900'} flex flex-col items-center gap-2 transition-transform hover:scale-105`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${p.id === user?.uid ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                    {p.name.charAt(7)}
                  </div>
                  <span className="text-sm font-bold truncate w-full text-center">{p.id === user?.uid ? 'Você' : p.name}</span>
                  {p.isHost && <span className="text-[10px] bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full font-bold">HOST</span>}
                </div>
              ))}
            </div>

            {room.players.find(p => p.id === user?.uid)?.isHost ? (
              <button 
                onClick={startGame}
                disabled={players.length < 2}
                className="w-full py-5 bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:hover:bg-green-500 text-white font-bold rounded-2xl shadow-lg shadow-green-500/20 transition-all text-xl"
              >
                {players.length < 2 ? 'AGUARDANDO JOGADORES...' : 'INICIAR JOGO'}
              </button>
            ) : (
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center italic text-slate-400">
                Aguardando o anfitrião iniciar a partida...
              </div>
            )}
          </div>
        )}

        {/* FASE: ESCREVER FRASE INICIAL */}
        {room && gameState === 'write' && (
          <div className="space-y-8 text-center animate-in zoom-in-95 duration-300">
            <div className="space-y-4">
              <Type className="mx-auto text-sky-500" size={48} />
              <h2 className="text-3xl font-bold">Como sua história começa?</h2>
              <p className="text-slate-400">Escreva algo criativo, absurdo ou engraçado!</p>
            </div>

            {!isReady ? (
              <div className="max-w-lg mx-auto flex gap-2">
                <input 
                  type="text" 
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  placeholder="Ex: Um pinguim surfista no Saara..."
                  className="flex-1 bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-5 focus:outline-none focus:border-sky-500 transition-all text-lg"
                />
                <button 
                  onClick={() => {
                    if(currentInput.trim()) {
                      submitTurn(currentInput);
                      setCurrentInput('');
                    }
                  }}
                  className="bg-sky-500 hover:bg-sky-400 p-5 rounded-2xl text-white shadow-lg transition-all"
                >
                  <Send size={24} />
                </button>
              </div>
            ) : (
              <div className="p-12 bg-slate-900/50 rounded-3xl border border-dashed border-slate-700">
                <div className="animate-pulse flex flex-col items-center gap-4">
                  <CheckCircle size={48} className="text-green-500" />
                  <p className="font-bold text-xl text-slate-300">PRONTO!</p>
                  <p className="text-slate-500">Aguardando os outros terminarem de pensar...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FASE: DESENHAR */}
        {room && gameState === 'draw' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {!isReady ? (
              <>
                <div className="text-center space-y-2">
                  <span className="text-sky-500 font-bold uppercase tracking-widest text-sm">SUA TAREFA</span>
                  <h2 className="text-3xl font-black italic">DESENHE ISSO:</h2>
                  <div className="inline-block px-6 py-3 bg-slate-800 rounded-2xl border border-slate-700 text-xl font-medium text-white shadow-xl mt-2">
                    "{targetData}"
                  </div>
                </div>
                <DrawingCanvas onSave={(data) => submitTurn(data)} />
              </>
            ) : (
              <div className="p-20 text-center space-y-4">
                <ImageIcon size={64} className="mx-auto text-slate-700 animate-bounce" />
                <h3 className="text-2xl font-bold text-slate-400">Obra de arte enviada!</h3>
                <p className="text-slate-600">Alguém vai tentar adivinhar o que você fez...</p>
              </div>
            )}
          </div>
        )}

        {/* FASE: DESCREVER DESENHO */}
        {room && gameState === 'describe' && (
          <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
            {!isReady ? (
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="text-center">
                  <span className="text-sky-500 font-bold uppercase tracking-widest text-sm">O QUE É ISSO?</span>
                  <h2 className="text-3xl font-black mt-2">ADIVINHE O DESENHO</h2>
                </div>
                
                <div className="aspect-video w-full bg-white rounded-3xl overflow-hidden shadow-2xl p-2">
                  <img src={targetData} alt="Adivinhe" className="w-full h-full object-contain" />
                </div>

                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    placeholder="O que você está vendo?"
                    className="flex-1 bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-5 focus:outline-none focus:border-sky-500 transition-all text-lg"
                  />
                  <button 
                    onClick={() => {
                      if(currentInput.trim()) {
                        submitTurn(currentInput);
                        setCurrentInput('');
                      }
                    }}
                    className="bg-sky-500 hover:bg-sky-400 p-5 rounded-2xl text-white shadow-lg transition-all"
                  >
                    <Send size={24} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-20 text-center space-y-4">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                   <CheckCircle className="text-green-500" size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-400">Palpite enviado!</h3>
                <p className="text-slate-600">Aguardando a rodada acabar...</p>
              </div>
            )}
          </div>
        )}

        {/* RESULTADOS FINAIS */}
        {room && gameState === 'results' && (
          <div className="space-y-12 animate-in fade-in duration-1000">
            <div className="text-center">
              <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-600">O ÁLBUM ESTÁ PRONTO!</h2>
              <p className="text-slate-500 mt-2 font-bold tracking-widest">VEJA COMO A HISTÓRIA EVOLUIU</p>
            </div>

            <div className="space-y-24">
              {room.players.map((originPlayer, pIdx) => (
                <section key={originPlayer.id} className="relative p-8 bg-slate-900/30 rounded-[3rem] border border-slate-800/50">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 px-6 py-2 rounded-full border border-slate-700 font-bold text-sky-400 shadow-xl">
                    SÉRIE DE {originPlayer.name.toUpperCase()}
                  </div>
                  
                  <div className="space-y-12 pt-4">
                    {room.players.map((_, stepIdx) => {
                      const total = room.players.length;
                      const playerWhoDidThisIdx = (pIdx + stepIdx) % total;
                      const author = room.players[playerWhoDidThisIdx];
                      const content = room.history[author.id][stepIdx];
                      const isImage = content && content.startsWith('data:image');

                      return (
                        <div key={stepIdx} className="flex flex-col items-center gap-4 group">
                          <div className="flex items-center gap-3 self-start mb-2 opacity-50 group-hover:opacity-100 transition-opacity">
                             <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold">{author.name.charAt(7)}</div>
                             <span className="text-xs font-bold uppercase tracking-wider">{author.name} fez:</span>
                          </div>
                          
                          {isImage ? (
                            <div className="w-full max-w-xl p-3 bg-white rounded-3xl shadow-2xl transform group-hover:rotate-1 transition-transform">
                              <img src={content} alt="Passo" className="w-full h-auto rounded-2xl" />
                            </div>
                          ) : (
                            <div className="w-full max-w-xl p-8 bg-slate-800 rounded-[2rem] border-2 border-slate-700 shadow-xl text-center transform group-hover:-rotate-1 transition-transform">
                              <p className="text-2xl font-black italic tracking-tight">"{content}"</p>
                            </div>
                          )}
                          
                          {stepIdx < room.players.length - 1 && (
                            <ArrowRight size={32} className="text-slate-800 mt-4" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="w-full py-6 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl border border-slate-700 transition-all text-xl"
            >
              JOGAR NOVAMENTE
            </button>
          </div>
        )}

      </main>

      {/* FOOTER STATUS */}
      {room && (
        <footer className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/80 backdrop-blur-md border-t border-slate-800 z-50">
          <div className="max-w-4xl mx-auto flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest">
            <div className="flex items-center gap-4">
              <span>SALA: <span className="text-sky-400">{room.id}</span></span>
              <span>RODADA: <span className="text-sky-400">{round + 1}/{players.length}</span></span>
            </div>
            <div className="flex gap-2">
              {players.map(p => {
                const ready = (room.history[p.id]?.length || 0) > round;
                return (
                  <div key={p.id} title={p.name} className={`w-2.5 h-2.5 rounded-full ${ready ? 'bg-green-500' : 'bg-slate-800 border border-slate-700'}`}></div>
                );
              })}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}