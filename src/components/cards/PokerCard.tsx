import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cardArt } from "../../assets/card-art/cardArt.generated";

/**
 * Poker-size cards (63 x 88 mm), drawn the way they are printed. A card is a
 * size container: its layers lay out in card units (--u), where the trimmed
 * card is 1488 units wide and 2078 tall, the print file's pixels at 600 dpi
 * less the bleed. So a position measured on the print file carries over by
 * subtracting the 71-unit bleed.
 */
export type PokerCardKind = "quest" | "target";

const backs = { quest: cardArt.questBack, target: cardArt.targetBack };
const fronts = { quest: cardArt.questFront, target: cardArt.targetFront };

function Art({ art, sizes }: { art: { src: string; srcSet: string }; sizes: string }) {
  return <img className="poker-card-art" src={art.src} srcSet={art.srcSet} sizes={sizes} alt="" aria-hidden="true" draggable={false} decoding="async" />;
}

/** The face-down card: gold for Quest Cards, silver for Target Cards. */
export function CardBack({ kind, className = "", sizes = "240px", label }: { kind: PokerCardKind; className?: string; sizes?: string; label?: string }) {
  return <div className={`poker-card poker-card-back is-${kind} ${className}`.trim()} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <Art art={backs[kind]} sizes={sizes} />
  </div>;
}

/** A card face: the printed front background with the words set over it. */
export function CardFace({ kind, className = "", sizes = "320px", label, children, as = "div" }: { kind: PokerCardKind; className?: string; sizes?: string; label?: string; children: ReactNode; as?: "div" | "article" }) {
  const Tag = as;
  return <Tag className={`poker-card poker-card-face is-${kind} ${className}`.trim()} aria-label={label}>
    <Art art={fronts[kind]} sizes={sizes} />
    <div className="poker-card-layer">{children}</div>
  </Tag>;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Shows the back, then turns the card over: the moment a card is drawn.
 * `revealKey` replays the turn when the drawn card changes. Reduced motion
 * shows the face at once.
 */
export function FlipCard({ kind, revealKey, children, className = "", sizes, delay = 220 }: { kind: PokerCardKind; revealKey: string | number; children: ReactNode; className?: string; sizes?: string; delay?: number }) {
  const [shown, setShown] = useState(() => prefersReducedMotion());
  useEffect(() => {
    if (prefersReducedMotion()) { setShown(true); return undefined; }
    setShown(false);
    const timer = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(timer);
  }, [revealKey, delay]);
  return <div className={`poker-flip${shown ? " is-shown" : ""} ${className}`.trim()}>
    <div className="poker-flip-inner">
      <div className="poker-flip-front">{children}</div>
      <CardBack kind={kind} className="poker-flip-back" sizes={sizes} />
    </div>
  </div>;
}

/**
 * Shrinks a block of card text that would overflow its space, as the print
 * renderer does (never below 70%). Measured after layout, so it follows the
 * card's real size and fonts.
 */
export function useFitScale<T extends HTMLElement>(deps: unknown[]) {
  const ref = useRef<T>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const element = ref.current;
    const room = element?.parentElement;
    if (!element || !room) return undefined;
    const measure = () => {
      const available = room.clientHeight - (element.offsetTop - room.offsetTop);
      const needed = element.scrollHeight;
      setScale(available > 0 && needed > available ? Math.max(0.7, available / needed) : 1);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(room);
    return () => observer?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ref, style: scale < 1 ? { transform: `scale(${scale})` } : undefined };
}
