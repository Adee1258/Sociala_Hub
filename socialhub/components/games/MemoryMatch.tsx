import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Pressable, ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSpring, withSequence, withDelay,
  interpolate, Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { CARD_SYMBOL_SETS, GAME_REWARDS, getLevelConfig, LevelConfig } from './constants';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Grid calculator ──────────────────────────────────────────────────────────
// Modal ~88% screen height, header 56, topBar 44, timer 26, padding 24 → available H
const AVAIL_H = SH * 0.88 - 56 - 44 - 26 - 24;
const AVAIL_W = SW - 24; // board padding 12 each side

function calcGrid(totalCards: number): { cols: number; cardSize: number } {
  const GAP = 6;
  let best = { cols: 4, cardSize: 0 };
  for (let c = 2; c <= 6; c++) {
    const rows = Math.ceil(totalCards / c);
    const cardW = Math.floor((AVAIL_W - GAP * (c + 1)) / c);
    const cardH = Math.floor((AVAIL_H - GAP * (rows + 1)) / rows);
    const size = Math.min(cardW, cardH);
    if (size > best.cardSize) best = { cols: c, cardSize: size };
  }
  best.cardSize = Math.max(40, Math.min(72, best.cardSize));
  return best;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemoryMatchProps {
  onReward: (name: string, coins: number, xp: number, score?: number) => void;
}
interface CardData { id: number; symbol: string; isFlipped: boolean; isMatched: boolean; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStars(moves: number, pairs: number) {
  if (moves <= pairs) return 3;
  if (moves <= pairs + Math.floor(pairs * 0.5)) return 2;
  return 1;
}

function buildDeck(pairs: number): CardData[] {
  const all = Object.values(CARD_SYMBOL_SETS).flat()
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort(() => Math.random() - 0.5)
    .slice(0, pairs);
  return [...all, ...all]
    .sort(() => Math.random() - 0.5)
    .map((symbol, i) => ({ id: i, symbol, isFlipped: false, isMatched: false }));
}

// ─── Level Select ─────────────────────────────────────────────────────────────

function LevelSelect({ maxUnlocked, onSelect }: { maxUnlocked: number; onSelect: (l: number) => void }) {
  const visible = Math.min(maxUnlocked + 3, 30);
  const CARD_W = Math.floor((SW - 64) / 3);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ls.scroll}>
      <Text style={ls.heading}>🧠 Memory Match</Text>
      <Text style={ls.sub}>Complete levels to unlock harder boards!</Text>
      <View style={ls.badge}><Text style={ls.badgeTxt}>🏆 Level {maxUnlocked} reached</Text></View>
      <View style={ls.grid}>
        {Array.from({ length: visible }, (_, i) => i + 1).map(lvl => {
          const cfg = getLevelConfig(lvl);
          const locked = lvl > maxUnlocked;
          const isCur = lvl === maxUnlocked;
          return (
            <TouchableOpacity
              key={lvl} activeOpacity={locked ? 0.6 : 0.82}
              style={[ls.card, { width: CARD_W, height: CARD_W }, isCur && ls.cardCur]}
              onPress={() => {
                if (locked) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); return; }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onSelect(lvl);
              }}
            >
              <LinearGradient
                colors={locked ? ['#94A3B8', '#64748B'] : [cfg.accentColor, cfg.bgGradient[0]]}
                style={ls.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                {locked ? (
                  <Text style={ls.lock}>🔒</Text>
                ) : (
                  <>
                    {isCur && <View style={ls.nowWrap}><Text style={ls.nowTxt}>NOW</Text></View>}
                    <Text style={ls.num}>{lvl}</Text>
                    <Text style={ls.info}>{cfg.pairs}p · {cfg.timeLimit}s</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── Flip Card ────────────────────────────────────────────────────────────────

interface CardProps {
  card: CardData; size: number;
  cardBack: string; accent: string;
  onPress: () => void; disabled: boolean; index: number;
}

function FlipCard({ card, size, cardBack, accent, onPress, disabled, index }: CardProps) {
  const rot = useSharedValue(0);
  const msc = useSharedValue(1); // match scale
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withDelay(index * 22, withSpring(1, { damping: 14 }));
  }, []);

  useEffect(() => {
    rot.value = withTiming(card.isFlipped || card.isMatched ? 180 : 0, {
      duration: 250, easing: Easing.out(Easing.cubic),
    });
    if (card.isMatched) {
      msc.value = withSequence(
        withSpring(1.1, { damping: 5, stiffness: 380 }),
        withSpring(1.0, { damping: 18 }),
      );
    }
  }, [card.isFlipped, card.isMatched]);

  const backS = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateY: `${interpolate(rot.value, [0, 180], [0, 180])}deg` }, { scale: msc.value }],
    opacity: interpolate(rot.value, [0, 88], [1, 0]),
    backfaceVisibility: 'hidden',
  }));
  const frontS = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateY: `${interpolate(rot.value, [0, 180], [180, 360])}deg` }, { scale: msc.value }],
    opacity: interpolate(rot.value, [92, 180], [0, 1]),
    backfaceVisibility: 'hidden',
  }));
  const wrapS = useAnimatedStyle(() => ({ transform: [{ scale: enter.value }] }));

  const R = Math.max(8, size * 0.17);
  const FS = size * 0.42;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || card.isFlipped || card.isMatched}
      style={{ width: size, height: size, margin: 3 }}
    >
      <Animated.View style={[{ width: size, height: size }, wrapS]}>

        {/* Back face */}
        <Animated.View style={[
          crd.face,
          { width: size, height: size, borderRadius: R, backgroundColor: cardBack, borderColor: 'rgba(255,255,255,0.18)' },
          backS,
        ]}>
          <View style={crd.backPattern}>
            {[0, 1, 2].map(r => (
              <View key={r} style={{ flex: 1, flexDirection: 'row' }}>
                {[0, 1, 2].map(c2 => <View key={c2} style={{ flex: 1, borderWidth: 0.4, borderColor: 'rgba(255,255,255,0.12)' }} />)}
              </View>
            ))}
          </View>
          <Text style={{ fontSize: FS * 0.5, opacity: 0.55 }}>🃏</Text>
        </Animated.View>

        {/* Front face */}
        <Animated.View style={[
          crd.face,
          {
            width: size, height: size, borderRadius: R,
            backgroundColor: card.isMatched ? '#064E3B' : '#1E293B',
            borderColor: card.isMatched ? accent : accent + '50'
          },
          frontS,
        ]}>
          {card.isMatched && <View style={[crd.glow, { borderRadius: R, borderColor: accent + '55' }]} />}
          <Text style={{ fontSize: FS }}>{card.symbol}</Text>
        </Animated.View>

      </Animated.View>
    </Pressable>
  );
}

// ─── Timer Bar ────────────────────────────────────────────────────────────────

function TimerBar({ timeLeft, total, accent }: { timeLeft: number; total: number; accent: string }) {
  const pct = timeLeft / total;
  const color = pct > 0.5 ? accent : pct > 0.25 ? '#F59E0B' : '#EF4444';
  const w = useSharedValue(1);

  useEffect(() => {
    w.value = withTiming(pct, { duration: 850, easing: Easing.linear });
  }, [pct]);

  const barS = useAnimatedStyle(() => ({ width: `${w.value * 100}%`, backgroundColor: color }));
  const urg = timeLeft <= 10;

  return (
    <View style={tmr.wrap}>
      <View style={tmr.row}>
        <Text style={[tmr.lbl, urg && { color: '#EF4444' }]}>{urg ? '⚠️ ' : ''}{timeLeft}s</Text>
      </View>
      <View style={tmr.track}><Animated.View style={[tmr.fill, barS]} /></View>
    </View>
  );
}

// ─── Combo Flash ─────────────────────────────────────────────────────────────

function ComboFlash({ combo }: { combo: number }) {
  const op = useSharedValue(0);
  const sc = useSharedValue(0.7);

  useEffect(() => {
    if (combo >= 2) {
      op.value = 1; sc.value = 0.7;
      sc.value = withSpring(1.08, { damping: 7 });
      setTimeout(() => { op.value = withTiming(0, { duration: 450 }); }, 850);
    }
  }, [combo]);

  const s = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ scale: sc.value }] }));
  if (combo < 2) return null;
  return (
    <Animated.View style={[cmb.badge, s]}>
      <Text style={cmb.txt}>🔥 {combo}× COMBO!</Text>
    </Animated.View>
  );
}

// ─── Win Screen ───────────────────────────────────────────────────────────────

function WinScreen({ level, moves, combo, coins, xp, stars, onNext, onReplay, onMenu }:
  {
    level: number; moves: number; combo: number; coins: number; xp: number; stars: number;
    onNext: () => void; onReplay: () => void; onMenu: () => void
  }) {

  const sc = useSharedValue(0.8); const op = useSharedValue(0);
  useEffect(() => {
    op.value = withTiming(1, { duration: 250 });
    sc.value = withSpring(1, { damping: 12 });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);
  const a = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ scale: sc.value }] }));

  return (
    <Animated.View style={[ovl.wrap, a]}>
      <LinearGradient colors={['#0F172A', '#1E1B4B']} style={ovl.inner}>
        <Text style={{ fontSize: 48 }}>🏆</Text>
        <Text style={ovl.head}>Level {level} Done!</Text>

        <View style={ovl.stars}>
          {[1, 2, 3].map(s => <Text key={s} style={[ovl.star, s <= stars && ovl.starOn]}>★</Text>)}
        </View>

        <View style={ovl.statsRow}>
          <View style={ovl.stat}><Text style={ovl.sv}>{moves}</Text><Text style={ovl.sl}>moves</Text></View>
          <View style={ovl.sep} />
          <View style={ovl.stat}><Text style={ovl.sv}>{combo}×</Text><Text style={ovl.sl}>combo</Text></View>
          <View style={ovl.sep} />
          <View style={ovl.stat}><Text style={ovl.sv}>+{coins}🪙</Text><Text style={ovl.sl}>coins</Text></View>
        </View>

        <View style={ovl.xpRow}>
          <Text style={ovl.xpTxt}>⚡ +{xp} XP earned</Text>
        </View>

        <TouchableOpacity style={ovl.mainBtn} onPress={onNext}>
          <Text style={ovl.mainBtnTxt}>Level {level + 1} →</Text>
        </TouchableOpacity>
        <View style={ovl.row2}>
          <TouchableOpacity style={ovl.sm} onPress={onReplay}><Text style={ovl.smT}>↺ Again</Text></TouchableOpacity>
          <TouchableOpacity style={ovl.sm} onPress={onMenu}><Text style={ovl.smT}>☰ Levels</Text></TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Lose Screen ─────────────────────────────────────────────────────────────

function LoseScreen({ level, onRetry, onMenu }: { level: number; onRetry: () => void; onMenu: () => void }) {
  useEffect(() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }, []);
  return (
    <View style={ovl.wrap}>
      <LinearGradient colors={['#1C0A00', '#3D0000']} style={ovl.inner}>
        <Text style={{ fontSize: 48 }}>⏰</Text>
        <Text style={[ovl.head, { color: '#FEF2F2' }]}>Time's Up!</Text>
        <Text style={{ color: '#FCA5A5', fontSize: 13 }}>Level {level} — so close!</Text>
        <TouchableOpacity style={ovl.mainBtn} onPress={onRetry}>
          <Text style={ovl.mainBtnTxt}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[ovl.sm, { width: '100%' }]} onPress={onMenu}>
          <Text style={ovl.smT}>☰ Level Select</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const MemoryMatch: React.FC<MemoryMatchProps> = ({ onReward }) => {
  const [screen, setScreen] = useState<'levelSelect' | 'game'>('levelSelect');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [maxUnlocked, setMaxUnlocked] = useState(1);
  const [cards, setCards] = useState<CardData[]>([]);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [isProcessing, setIsProcessing] = useState(false);
  const [levelCfg, setLevelCfg] = useState<LevelConfig>(getLevelConfig(1));
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);
  const [earnedStars, setEarnedStars] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rewardGiven = useRef(false);

  const startLevel = useCallback((lvl: number) => {
    const cfg = getLevelConfig(lvl);
    setLevelCfg(cfg);
    setCurrentLevel(lvl);
    setCards(buildDeck(cfg.pairs));
    setFlippedIds([]); setMoves(0); setMatchedCount(0);
    setCombo(0); setBestCombo(0);
    setTimeLeft(cfg.timeLimit);
    setGameState('playing'); setIsProcessing(false);
    rewardGiven.current = false;
    setScreen('game');
  }, []);

  // Timer
  useEffect(() => {
    if (screen !== 'game' || gameState !== 'playing') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current!); setGameState('lost'); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [screen, gameState]);

  // Card press
  const handlePress = useCallback((cardId: number) => {
    if (isProcessing || flippedIds.length >= 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setCards(prev => prev.map(c => c.id === cardId ? { ...c, isFlipped: true } : c));

    setFlippedIds(prev => {
      const next = [...prev, cardId];
      if (next.length === 2) {
        setIsProcessing(true);
        setMoves(m => m + 1);
        setTimeout(() => {
          setCards(cur => {
            const [a, b] = next;
            const ca = cur.find(c => c.id === a)!;
            const cb = cur.find(c => c.id === b)!;
            if (ca.symbol === cb.symbol) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              const upd = cur.map(c => c.id === a || c.id === b ? { ...c, isMatched: true, isFlipped: true } : c);
              setMatchedCount(upd.filter(c => c.isMatched).length / 2);
              setCombo(co => { const nc = co + 1; setBestCombo(bc => Math.max(bc, nc)); return nc; });
              if (upd.every(c => c.isMatched)) setGameState('won');
              setFlippedIds([]); setIsProcessing(false);
              return upd;
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              setCombo(0);
              setTimeout(() => {
                setCards(c2 => c2.map(c => c.id === a || c.id === b ? { ...c, isFlipped: false } : c));
                setFlippedIds([]); setIsProcessing(false);
              }, 520);
              return cur;
            }
          });
        }, 200);
      }
      return next;
    });
  }, [isProcessing, flippedIds]);

  // Win reward
  useEffect(() => {
    if (gameState === 'won' && !rewardGiven.current) {
      rewardGiven.current = true;
      const stars = getStars(moves, levelCfg.pairs);
      const coins = Math.round(levelCfg.coinReward * (stars / 3) * (1 + bestCombo * 0.05));
      const xp = Math.round(levelCfg.xpReward * (stars / 3) * (1 + bestCombo * 0.05));
      setEarnedCoins(coins); setEarnedXp(xp); setEarnedStars(stars);
      onReward('Memory Match', coins, xp, moves);
      if (currentLevel >= maxUnlocked) setMaxUnlocked(currentLevel + 1);
    }
  }, [gameState]);

  if (screen === 'levelSelect') {
    return <LevelSelect maxUnlocked={maxUnlocked} onSelect={startLevel} />;
  }

  const totalCards = levelCfg.pairs * 2;
  const { cardSize } = calcGrid(totalCards);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={levelCfg.bgGradient} style={brd.container}>

        {/* Header */}
        <View style={brd.topBar}>
          <View style={[brd.lvlBadge, { backgroundColor: levelCfg.accentColor + '30', borderColor: levelCfg.accentColor + '60' }]}>
            <Text style={[brd.lvlTxt, { color: levelCfg.accentColor }]}>LVL {currentLevel}</Text>
          </View>
          <View style={brd.stats}>
            <View style={brd.stat}><Text style={brd.sv}>{moves}</Text><Text style={brd.sl}>moves</Text></View>
            <View style={brd.sep} />
            <View style={brd.stat}><Text style={brd.sv}>{matchedCount}/{levelCfg.pairs}</Text><Text style={brd.sl}>pairs</Text></View>
          </View>
          <TouchableOpacity style={brd.qBtn} onPress={() => setScreen('levelSelect')}>
            <Text style={brd.qTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Timer */}
        <TimerBar timeLeft={timeLeft} total={levelCfg.timeLimit} accent={levelCfg.accentColor} />

        {/* Combo */}
        <ComboFlash combo={combo} />

        {/* Grid */}
        <View style={brd.grid}>
          {cards.map((card, idx) => (
            <FlipCard
              key={card.id} card={card} size={cardSize}
              cardBack={levelCfg.cardBack} accent={levelCfg.accentColor}
              onPress={() => handlePress(card.id)}
              disabled={isProcessing || gameState !== 'playing'}
              index={idx}
            />
          ))}
        </View>

        {gameState === 'won' && (
          <WinScreen
            level={currentLevel} moves={moves} combo={bestCombo}
            coins={earnedCoins} xp={earnedXp} stars={earnedStars}
            onNext={() => startLevel(currentLevel + 1)}
            onReplay={() => startLevel(currentLevel)}
            onMenu={() => setScreen('levelSelect')}
          />
        )}
        {gameState === 'lost' && (
          <LoseScreen level={currentLevel}
            onRetry={() => startLevel(currentLevel)}
            onMenu={() => setScreen('levelSelect')}
          />
        )}
      </LinearGradient>
    </View>
  );
};

export default MemoryMatch;

// ─── Styles ───────────────────────────────────────────────────────────────────

const ls = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  heading: { fontSize: 24, fontWeight: '900', color: '#0F172A', textAlign: 'center', marginBottom: 4 },
  sub: { fontSize: 12, color: '#64748B', textAlign: 'center', marginBottom: 12 },
  badge: { alignSelf: 'center', backgroundColor: '#EDE9FE', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 16 },
  badgeTxt: { fontSize: 13, fontWeight: '700', color: '#7C3AED' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  cardCur: { borderColor: '#7C3AED', borderWidth: 2.5 },
  grad: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 2, padding: 4 },
  lock: { fontSize: 20 },
  num: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  info: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  nowWrap: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  nowTxt: { fontSize: 8, color: '#FFF', fontWeight: '900', letterSpacing: 0.5 },
});

const crd = StyleSheet.create({
  face: {
    position: 'absolute', borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  backPattern: { position: 'absolute', width: '100%', height: '100%' },
  glow: { position: 'absolute', width: '100%', height: '100%', borderWidth: 2 },
});

const tmr = StyleSheet.create({
  wrap: { marginBottom: 6, paddingHorizontal: 2 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 },
  lbl: { fontSize: 11, fontWeight: '700', color: '#CBD5E1' },
  track: { height: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});

const cmb = StyleSheet.create({
  badge: {
    position: 'absolute', top: 44, alignSelf: 'center', zIndex: 99,
    backgroundColor: '#7C3AED', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 6,
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55, shadowRadius: 8, elevation: 8,
  },
  txt: { color: '#FFF', fontWeight: '900', fontSize: 14 },
});

const brd = StyleSheet.create({
  container: { flex: 1, padding: 12, paddingTop: 8 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  lvlBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9, borderWidth: 1 },
  lvlTxt: { fontSize: 12, fontWeight: '900' },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stat: { alignItems: 'center' },
  sv: { fontSize: 15, fontWeight: '800', color: '#F1F5F9' },
  sl: { fontSize: 9, color: '#94A3B8', fontWeight: '600' },
  sep: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.15)' },
  qBtn: { width: 28, height: 28, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  qTxt: { color: '#94A3B8', fontSize: 13, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', flex: 1 },
});

const ovl = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 20 },
  head: { fontSize: 22, fontWeight: '900', color: '#F1F5F9' },
  stars: { flexDirection: 'row', gap: 6 },
  star: { fontSize: 30, color: '#334155' },
  starOn: { color: '#F59E0B' },
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, gap: 14 },
  stat: { alignItems: 'center', minWidth: 50 },
  sv: { fontSize: 16, fontWeight: '800', color: '#F1F5F9' },
  sl: { fontSize: 9, color: '#94A3B8', fontWeight: '600' },
  sep: { width: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  xpRow: { backgroundColor: 'rgba(124,58,237,0.22)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#7C3AED44' },
  xpTxt: { color: '#C4B5FD', fontWeight: '700', fontSize: 13 },
  mainBtn: { width: '100%', backgroundColor: '#7C3AED', borderRadius: 13, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  mainBtnTxt: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  row2: { flexDirection: 'row', gap: 10, width: '100%' },
  sm: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 11, paddingVertical: 10, alignItems: 'center' },
  smT: { color: '#CBD5E1', fontSize: 13, fontWeight: '700' },
});
