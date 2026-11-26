import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Shuffle,
  Check,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api, formatError } from "@/lib/api";
import { EmptyState } from "@/components/common";
import {
  GenerateButton,
  SourcePicker,
  Thinking,
  ToolLayout,
  useSource,
} from "@/components/ai/shared";

const Card = ({ card, flipped, onFlip }) => (
  <button
    data-testid="flashcard"
    onClick={onFlip}
    className={`flip-card w-full h-72 sm:h-80 ${flipped ? "flipped" : ""}`}
  >
    <div className="flip-inner relative w-full h-full">
      <div className="flip-face absolute inset-0 surface p-8 flex flex-col items-center justify-center text-center shadow-[6px_6px_0_rgba(30,58,138,0.15)]">
        <span className="eyebrow mb-4">Recto</span>
        <span
          data-testid="flashcard-front"
          className="font-display text-2xl font-bold text-slate-900"
        >
          {card.front}
        </span>
        <span className="text-xs text-slate-400 mt-6">
          Clique pour retourner
        </span>
      </div>
      <div className="flip-face flip-back absolute inset-0 rounded-2xl bg-primary text-white p-8 flex flex-col items-center justify-center text-center shadow-[6px_6px_0_#d97706]">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300 mb-4">
          Verso
        </span>
        <span data-testid="flashcard-back" className="text-lg leading-relaxed">
          {card.back}
        </span>
      </div>
    </div>
  </button>
);

export const FlashcardsTool = ({ initialDocId }) => {
  const source = useSource(initialDocId);
  const [deck, setDeck] = useState(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState({});
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setDeck(null);
    try {
      const { data } = await api.post("/ai/flashcards", {
        ...source.payload,
        count: 12,
      });
      setDeck(data);
      setIdx(0);
      setFlipped(false);
      setKnown({});
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  const go = (d) => {
    setFlipped(false);
    setIdx((i) => (i + d + deck.cards.length) % deck.cards.length);
  };
  const mark = (v) => {
    setKnown({ ...known, [idx]: v });
    go(1);
  };
  const shuffle = () => {
    setDeck({
      ...deck,
      cards: [...deck.cards].sort(() => Math.random() - 0.5),
    });
    setIdx(0);
    setKnown({});
    setFlipped(false);
  };
  const knownCount = Object.values(known).filter(Boolean).length;

  return (
    <ToolLayout
      title="Flashcards recto/verso"
      description="Des cartes de mémorisation générées depuis ton cours, avec auto-évaluation."
      controls={
        <>
          <SourcePicker source={source} />
          <GenerateButton
            loading={loading}
            disabled={!source.ready}
            onClick={run}
          >
            Générer les cartes
          </GenerateButton>
        </>
      }
    >
      {loading && <Thinking label="Création des cartes…" />}
      {!loading && !deck && (
        <EmptyState
          testid="flashcards-empty"
          icon={Layers}
          title="Ton paquet apparaîtra ici"
          text="Idéal pour réviser définitions, dates et formules."
        />
      )}
      {deck && deck.cards.length > 0 && (
        <div data-testid="ai-result-content" className="space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-xl font-bold text-slate-900">{deck.title}</h3>
            <span
              data-testid="flashcards-counter"
              className="text-sm text-slate-500 font-mono"
            >
              {idx + 1} / {deck.cards.length} · {knownCount} maîtrisée(s)
            </span>
          </div>
          <Progress value={(knownCount / deck.cards.length) * 100} />
          <Card
            card={deck.cards[idx]}
            flipped={flipped}
            onFlip={() => setFlipped(!flipped)}
          />
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="icon"
              data-testid="flashcard-prev-button"
              onClick={() => go(-1)}
              className="rounded-full"
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="outline"
              data-testid="flashcard-review-button"
              onClick={() => mark(false)}
              className="rounded-full border-rose-200 text-rose-700 hover:bg-rose-50"
            >
              <RotateCw size={14} className="mr-1" /> À revoir
            </Button>
            <Button
              data-testid="flashcard-known-button"
              onClick={() => mark(true)}
              className="rounded-full bg-emerald-600 hover:bg-emerald-700"
            >
              <Check size={14} className="mr-1" /> Je savais
            </Button>
            <Button
              variant="outline"
              size="icon"
              data-testid="flashcard-next-button"
              onClick={() => go(1)}
              className="rounded-full"
            >
              <ChevronRight size={16} />
            </Button>
            <Button
              variant="ghost"
              data-testid="flashcard-shuffle-button"
              onClick={shuffle}
              className="rounded-full"
            >
              <Shuffle size={14} className="mr-1" /> Mélanger
            </Button>
          </div>
        </div>
      )}
    </ToolLayout>
  );
};
