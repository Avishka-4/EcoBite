/**
 * Community.tsx — EcoBite Community Q&A Hub
 *
 * Three sub-views managed by local state:
 *   list     → scrollable question feed + FAB to ask
 *   detail   → question thread with answers + answer form
 *   ask      → full-screen "Ask a Question" form
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle, Heart, ThumbsUp, Sparkles, Send, X,
  ChevronLeft, Plus, Search, CheckCircle2, AlertTriangle,
  Clock, Tag, Flame, Star, Loader2, ChefHat, Users,
  MessageSquarePlus, Lightbulb, Award,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  communityApi, verifyAnswerWithAI,
  CommunityQuestion, CommunityAnswer,
} from '../../api/community';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

const AVATAR_COLORS = [
  'from-violet-500 to-purple-500',
  'from-rose-500 to-pink-500',
  'from-amber-500 to-orange-500',
  'from-teal-500 to-cyan-500',
  'from-blue-500 to-indigo-500',
  'from-emerald-500 to-lime-500',
];

function avatarColor(name: string): string {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ name, size = 8 }: { name: string; size?: number }) {
  const s = `w-${size} h-${size}`;
  return (
    <div
      className={`${s} rounded-full bg-gradient-to-br ${avatarColor(name)} flex items-center justify-center flex-shrink-0 shadow-sm`}
    >
      <span className={`text-white font-bold ${size <= 8 ? 'text-xs' : 'text-sm'}`}>
        {initials(name)}
      </span>
    </div>
  );
}

function AiBadge({
  verified,
  confidence,
  note,
}: {
  verified: boolean | null;
  confidence: number | null;
  note: string | null;
}) {
  if (verified === null) return null;

  if (verified) {
    const pct = confidence !== null ? Math.round(confidence * 100) : null;
    return (
      <div className="mt-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[11px] font-bold text-emerald-800">AI Verified</span>
            {pct !== null && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">
                {pct}% confident
              </span>
            )}
          </div>
          {note && <p className="text-[11px] text-emerald-700 leading-relaxed">{note}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2.5 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <span className="text-[11px] font-bold text-amber-800 block mb-0.5">
          AI flagged — verify before following
        </span>
        {note && <p className="text-[11px] text-amber-700 leading-relaxed">{note}</p>}
      </div>
    </div>
  );
}

// ── Question Card ─────────────────────────────────────────────────────────────

function QuestionCard({
  q,
  onClick,
  onLike,
}: {
  q: CommunityQuestion;
  onClick: () => void;
  onLike: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md border border-emerald-100 p-4 active:scale-[0.99] transition-all cursor-pointer hover:border-emerald-300 hover:shadow-lg"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={q.authorName} size={7} />
          <div className="min-w-0">
            <span className="text-xs font-semibold text-gray-700 truncate block">{q.authorName}</span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />{timeAgo(q.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {q.answers.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-100">
              <MessageCircle className="w-2.5 h-2.5" />
              {q.answers.length}
            </span>
          )}
          <button
            onClick={onLike}
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full transition-all active:scale-90"
            style={{
              background: q.likedByMe ? '#fce7f3' : '#f9fafb',
              color: q.likedByMe ? '#db2777' : '#9ca3af',
              border: q.likedByMe ? '1px solid #fbcfe8' : '1px solid #e5e7eb',
            }}
          >
            <Heart className={`w-3 h-3 ${q.likedByMe ? 'fill-pink-500' : ''}`} />
            {q.likes}
          </button>
        </div>
      </div>

      {/* Title */}
      <h3 className="font-bold text-gray-800 text-sm leading-snug mb-1.5 line-clamp-2">{q.title}</h3>

      {/* Body preview */}
      {q.body && (
        <p className="text-gray-500 text-xs line-clamp-2 leading-relaxed mb-2">{q.body}</p>
      )}

      {/* Tags */}
      {q.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {q.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-medium"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Best answer preview */}
      {q.answers.length > 0 && (
        <div className="mt-2.5 bg-gradient-to-r from-emerald-50 to-lime-50 rounded-xl p-2 border border-emerald-100">
          <div className="flex items-center gap-1 mb-1">
            <Star className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-700">Top answer</span>
            {q.answers.some((a) => a.aiVerified === true) && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 rounded-full font-bold flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" />AI ✓
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-600 line-clamp-1 leading-relaxed">
            {q.answers.sort((a, b) => b.likes - a.likes)[0].text}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Answer Card ───────────────────────────────────────────────────────────────

function AnswerCard({
  answer,
  onLike,
  verifying,
}: {
  answer: CommunityAnswer;
  onLike: () => void;
  verifying: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 border transition-all ${
        answer.aiVerified === true
          ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'
          : answer.aiVerified === false
          ? 'bg-amber-50/60 border-amber-200'
          : 'bg-white/90 border-gray-100'
      }`}
    >
      {/* Author row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Avatar name={answer.authorName} size={7} />
          <div>
            <span className="text-xs font-semibold text-gray-700">{answer.authorName}</span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
              <Clock className="w-2.5 h-2.5" />{timeAgo(answer.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {verifying && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full animate-pulse font-medium">
              <Sparkles className="w-2.5 h-2.5" />Verifying…
            </span>
          )}
          {answer.aiVerified === true && !verifying && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
              <CheckCircle2 className="w-2.5 h-2.5" />Verified
            </span>
          )}
          <button
            onClick={onLike}
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full transition-all active:scale-90"
            style={{
              background: answer.likedByMe ? '#fce7f3' : '#f9fafb',
              color: answer.likedByMe ? '#db2777' : '#9ca3af',
              border: answer.likedByMe ? '1px solid #fbcfe8' : '1px solid #e5e7eb',
            }}
          >
            <ThumbsUp className={`w-3 h-3 ${answer.likedByMe ? 'fill-pink-500' : ''}`} />
            {answer.likes}
          </button>
        </div>
      </div>

      {/* Answer text */}
      <p className="text-sm text-gray-700 leading-relaxed">{answer.text}</p>

      {/* AI verdict */}
      <AiBadge
        verified={answer.aiVerified}
        confidence={answer.aiConfidence}
        note={answer.aiNote}
      />
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

type View = 'list' | 'detail' | 'ask';

export function Community() {
  const { user } = useAuth();

  const [view, setView] = useState<View>('list');
  const [questions, setQuestions] = useState<CommunityQuestion[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<CommunityQuestion | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);

  // Ask form
  const [askTitle, setAskTitle] = useState('');
  const [askBody, setAskBody] = useState('');
  const [askTags, setAskTags] = useState('');
  const [askSubmitting, setAskSubmitting] = useState(false);

  // Answer form
  const [answerText, setAnswerText] = useState('');
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const answerInputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load questions on mount and when view changes back to list
  const refresh = useCallback(() => {
    setQuestions(communityApi.getQuestions());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Keep active question in sync with questions state
  useEffect(() => {
    if (activeQuestion) {
      const updated = questions.find((q) => q.id === activeQuestion.id);
      if (updated) setActiveQuestion(updated);
    }
  }, [questions]);

  // Derived
  const authorName = user?.name || 'Anonymous Chef';

  const filteredQuestions = questions.filter((q) => {
    const matchSearch =
      !searchQuery ||
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchTag = !filterTag || q.tags.includes(filterTag);
    return matchSearch && matchTag;
  });

  const popularTags = Array.from(
    new Set(questions.flatMap((q) => q.tags)),
  ).slice(0, 8);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleOpenQuestion = (q: CommunityQuestion) => {
    setActiveQuestion(q);
    setView('detail');
    setAnswerText('');
  };

  const handleLikeQuestion = (e: React.MouseEvent, questionId: string) => {
    e.stopPropagation();
    const updated = communityApi.toggleQuestionLike(questionId);
    setQuestions([...updated]);
  };

  const handleAskSubmit = async () => {
    if (!askTitle.trim()) return;
    setAskSubmitting(true);
    try {
      const tags = askTags
        .split(/[,\s]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 5);
      communityApi.postQuestion(askTitle, askBody, tags, authorName, user?.id);
      refresh();
      setAskTitle('');
      setAskBody('');
      setAskTags('');
      setView('list');
    } finally {
      setAskSubmitting(false);
    }
  };

  const handleAnswerSubmit = async () => {
    if (!answerText.trim() || !activeQuestion) return;
    setAnswerSubmitting(true);

    // 1. Post answer immediately
    const newAnswer = communityApi.postAnswer(
      activeQuestion.id,
      answerText,
      authorName,
      user?.id,
    );
    refresh();
    setAnswerText('');
    setAnswerSubmitting(false);

    // 2. Kick off AI verification in background
    setVerifyingId(newAnswer.id);
    try {
      const result = await verifyAnswerWithAI(activeQuestion.title, newAnswer.text);
      communityApi.updateAnswerVerification(
        activeQuestion.id,
        newAnswer.id,
        result.verified,
        result.confidence,
        result.note,
      );
      refresh();
    } catch {
      // silent — verification failed, no badge shown
    } finally {
      setVerifyingId(null);
    }
  };

  const handleLikeAnswer = (questionId: string, answerId: string) => {
    communityApi.toggleAnswerLike(questionId, answerId);
    refresh();
  };

  // ── View: Ask ───────────────────────────────────────────────────────────────

  if (view === 'ask') {
    return (
      <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-3">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setView('list')}
              className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md active:scale-95 text-gray-700"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-gray-800 text-lg">Ask the Community</h1>
              <p className="text-xs text-gray-500">Share your cooking question</p>
            </div>
          </div>

          {/* Tips card */}
          <div className="bg-white/80 rounded-2xl p-3 border border-emerald-100 flex gap-2.5 mb-4">
            <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 leading-relaxed">
              Ask about cooking techniques, ingredient substitutions, recipe tips, or food storage. Clear questions get the best answers!
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
          {/* Title */}
          <div className="bg-white/90 rounded-2xl border-2 border-emerald-100 p-4 shadow-sm">
            <label className="block text-xs font-bold text-emerald-800 mb-2 uppercase tracking-wide flex items-center gap-1">
              <MessageSquarePlus className="w-3.5 h-3.5" />
              Your Question *
            </label>
            <input
              type="text"
              value={askTitle}
              onChange={(e) => setAskTitle(e.target.value)}
              placeholder="e.g. How do I prevent pasta from sticking together?"
              maxLength={120}
              className="w-full px-3 py-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm text-gray-800 placeholder-gray-400"
            />
            <div className="text-right text-[10px] text-gray-400 mt-1">{askTitle.length}/120</div>
          </div>

          {/* Body */}
          <div className="bg-white/90 rounded-2xl border-2 border-emerald-100 p-4 shadow-sm">
            <label className="block text-xs font-bold text-emerald-800 mb-2 uppercase tracking-wide">
              More Details (optional)
            </label>
            <textarea
              value={askBody}
              onChange={(e) => setAskBody(e.target.value)}
              placeholder="Describe your situation, what you've already tried, or add any extra context…"
              rows={4}
              maxLength={500}
              className="w-full px-3 py-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm text-gray-800 placeholder-gray-400 resize-none leading-relaxed"
            />
            <div className="text-right text-[10px] text-gray-400">{askBody.length}/500</div>
          </div>

          {/* Tags */}
          <div className="bg-white/90 rounded-2xl border-2 border-emerald-100 p-4 shadow-sm">
            <label className="block text-xs font-bold text-emerald-800 mb-2 uppercase tracking-wide flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" />
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={askTags}
              onChange={(e) => setAskTags(e.target.value)}
              placeholder="e.g. pasta, italian, tips"
              className="w-full px-3 py-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm text-gray-800 placeholder-gray-400"
            />
            {/* Popular tags as quick-add chips */}
            {popularTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {popularTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setAskTags((prev) =>
                        prev ? `${prev}, ${t}` : t,
                      )
                    }
                    className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full font-medium active:scale-95"
                  >
                    + #{t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={handleAskSubmit}
            disabled={!askTitle.trim() || askSubmitting}
            className="w-full bg-gradient-to-r from-emerald-500 to-lime-500 text-white py-3.5 rounded-2xl font-bold shadow-xl active:scale-95 flex items-center justify-center gap-2 text-sm disabled:opacity-50 transition-all"
          >
            {askSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Post Question
          </button>
        </div>
      </div>
    );
  }

  // ── View: Detail ────────────────────────────────────────────────────────────

  if (view === 'detail' && activeQuestion) {
    const sortedAnswers = [...activeQuestion.answers].sort(
      (a, b) => {
        // AI-verified + most liked first
        if (a.aiVerified && !b.aiVerified) return -1;
        if (!a.aiVerified && b.aiVerified) return 1;
        return b.likes - a.likes;
      },
    );

    return (
      <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white/90 backdrop-blur-sm border-b border-emerald-100 px-5 pt-5 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => { setView('list'); setActiveQuestion(null); }}
              className="w-9 h-9 bg-emerald-50 rounded-full flex items-center justify-center shadow-sm active:scale-95 text-gray-700"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-gray-800 text-sm leading-snug line-clamp-2">
                {activeQuestion.title}
              </h2>
            </div>
          </div>

          {/* Author + meta */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Avatar name={activeQuestion.authorName} size={6} />
            <span className="font-medium text-gray-700">{activeQuestion.authorName}</span>
            <span>·</span>
            <Clock className="w-3 h-3" />
            <span>{timeAgo(activeQuestion.createdAt)}</span>
            <span>·</span>
            <button
              onClick={() => handleLikeQuestion({ stopPropagation: () => {} } as React.MouseEvent, activeQuestion.id)}
              className="flex items-center gap-1 font-bold"
              style={{ color: activeQuestion.likedByMe ? '#db2777' : '#9ca3af' }}
            >
              <Heart className={`w-3 h-3 ${activeQuestion.likedByMe ? 'fill-pink-500' : ''}`} />
              {activeQuestion.likes}
            </button>
          </div>
        </div>

        {/* Scroll body */}
        <div className="flex-1 overflow-y-auto pb-4">
          {/* Question body */}
          {activeQuestion.body && (
            <div className="px-5 py-4 bg-white/70 border-b border-emerald-100">
              <p className="text-sm text-gray-700 leading-relaxed">{activeQuestion.body}</p>
              {activeQuestion.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {activeQuestion.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-medium"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Answers section */}
          <div className="px-5 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-gray-800 text-sm">
                {activeQuestion.answers.length === 0
                  ? 'No answers yet — be the first!'
                  : `${activeQuestion.answers.length} Answer${activeQuestion.answers.length > 1 ? 's' : ''}`}
              </h3>
              {activeQuestion.answers.some((a) => a.aiVerified === true) && (
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />AI Verified
                </span>
              )}
            </div>

            <div className="space-y-3">
              {sortedAnswers.map((answer) => (
                <AnswerCard
                  key={answer.id}
                  answer={answer}
                  onLike={() => handleLikeAnswer(activeQuestion.id, answer.id)}
                  verifying={verifyingId === answer.id}
                />
              ))}
            </div>

            {/* Empty state */}
            {activeQuestion.answers.length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-lime-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <ChefHat className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-gray-500 text-sm font-medium">Know the answer?</p>
                <p className="text-gray-400 text-xs mt-1">Help the community below ↓</p>
              </div>
            )}
          </div>
        </div>

        {/* Answer input bar (sticky bottom) */}
        <div className="flex-shrink-0 bg-white/95 backdrop-blur-xl border-t border-emerald-100 px-4 py-3 shadow-xl">
          <div className="flex items-start gap-2">
            <Avatar name={authorName} size={8} />
            <div className="flex-1 bg-emerald-50 rounded-2xl border-2 border-emerald-200 focus-within:border-emerald-400 transition-colors overflow-hidden">
              <textarea
                ref={answerInputRef}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Share your knowledge… Your answer will be AI-verified ✨"
                rows={2}
                className="w-full px-3 pt-2.5 pb-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none resize-none leading-relaxed"
              />
              <div className="flex items-center justify-between px-3 pb-2">
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  Answers are AI fact-checked
                </span>
                <button
                  onClick={handleAnswerSubmit}
                  disabled={!answerText.trim() || answerSubmitting}
                  className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-lime-500 text-white rounded-full flex items-center justify-center shadow-md active:scale-90 disabled:opacity-40 transition-all"
                >
                  {answerSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── View: List ──────────────────────────────────────────────────────────────

  return (
    <div className="h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-5 pb-3">
        {/* Title row */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
              Community
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Ask questions · Share knowledge</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Stats pill */}
            <div className="bg-white/80 rounded-full px-3 py-1.5 border border-emerald-100 flex items-center gap-1.5 shadow-sm">
              <Users className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-bold text-emerald-700">{questions.length} Q</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/90 border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-300 text-sm text-gray-700 placeholder-gray-400 shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tag filters */}
        {popularTags.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
            <button
              onClick={() => setFilterTag(null)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all active:scale-95 ${
                !filterTag
                  ? 'bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-sm'
                  : 'bg-white/80 text-gray-600 border border-emerald-100'
              }`}
            >
              All
            </button>
            {popularTags.map((t) => (
              <button
                key={t}
                onClick={() => setFilterTag(filterTag === t ? null : t)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all active:scale-95 ${
                  filterTag === t
                    ? 'bg-gradient-to-r from-emerald-500 to-lime-500 text-white shadow-sm'
                    : 'bg-white/80 text-gray-600 border border-emerald-100'
                }`}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Questions list */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-5 pb-24">
        {/* Featured banner — only when no filter active */}
        {!searchQuery && !filterTag && (
          <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-lime-500 rounded-2xl p-4 mb-4 shadow-xl relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/10 rounded-full" />
            <div className="relative">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Award className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-sm">AI-Powered Q&amp;A</h2>
                  <p className="text-white/80 text-xs mt-0.5 leading-relaxed">
                    Every answer gets fact-checked by AI. Ask anything about cooking, ingredients, or recipes!
                  </p>
                </div>
              </div>
              <div className="flex gap-4 mt-3">
                <div className="text-center">
                  <div className="text-white font-bold text-sm">{questions.reduce((s, q) => s + q.answers.length, 0)}</div>
                  <div className="text-white/70 text-[10px]">Answers</div>
                </div>
                <div className="text-center">
                  <div className="text-white font-bold text-sm">
                    {questions.reduce((s, q) => s + q.answers.filter((a) => a.aiVerified === true).length, 0)}
                  </div>
                  <div className="text-white/70 text-[10px]">AI Verified</div>
                </div>
                <div className="text-center">
                  <div className="text-white font-bold text-sm">{questions.reduce((s, q) => s + q.likes, 0)}</div>
                  <div className="text-white/70 text-[10px]">Likes</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hot questions label */}
        {!searchQuery && !filterTag && (
          <div className="flex items-center gap-1.5 mb-3">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-xs font-bold text-gray-600">Latest Questions</span>
          </div>
        )}

        {filteredQuestions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-white/60 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <MessageCircle className="w-10 h-10 text-emerald-300" />
            </div>
            <p className="text-gray-600 font-semibold text-base mb-1">
              {searchQuery ? 'No matching questions' : 'No questions yet'}
            </p>
            <p className="text-gray-400 text-sm">
              {searchQuery ? 'Try a different search term' : 'Be the first to ask!'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuestions.map((q) => (
              <QuestionCard
                key={q.id}
                q={q}
                onClick={() => handleOpenQuestion(q)}
                onLike={(e) => handleLikeQuestion(e, q.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Ask button */}
      <div className="absolute bottom-20 right-5 z-20">
        <button
          onClick={() => setView('ask')}
          className="w-14 h-14 bg-gradient-to-r from-emerald-500 to-lime-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all hover:shadow-violet-300/50"
          style={{ boxShadow: '0 8px 32px rgba(139,92,246,0.45)' }}
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
}
