import { motion, useInView } from 'motion/react';
import { type ElementType, useMemo, useRef, useState } from 'react';

type SplitType = 'chars' | 'words' | 'lines';

type TransformValues = {
  opacity?: number;
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
};

type SplitTextProps = {
  text: string;
  className?: string;
  itemClassName?: string;
  delay?: number;
  duration?: number;
  ease?: string;
  splitType?: SplitType;
  from?: TransformValues;
  to?: TransformValues;
  threshold?: number;
  rootMargin?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  tag?: ElementType;
  onLetterAnimationComplete?: () => void;
  showCallback?: boolean;
};

const SplitText = ({
  text,
  className = '',
  delay = 50,
  duration = 1.25,
  ease = 'easeOut',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = '-100px',
  textAlign = 'center',
  tag = 'p',
  itemClassName = '',
  onLetterAnimationComplete,
  showCallback = false
}: SplitTextProps) => {
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, amount: threshold, margin: rootMargin as never });
  const [callbackFired, setCallbackFired] = useState(false);
  const Tag = tag;

  const tokens = useMemo(() => {
    if (!text) return [];
    if (splitType === 'words') return text.split(' ');
    if (splitType === 'lines') return text.split('\n');
    return Array.from(text);
  }, [text, splitType]);

  return (
    <Tag
      ref={ref as never}
      className={className}
      style={{ textAlign, whiteSpace: splitType === 'lines' ? 'pre-line' : 'normal' }}
      aria-label={text}
    >
      {tokens.map((token, index) => {
        const displayToken =
          splitType === 'chars' && token === ' '
            ? '\u00A0'
            : splitType === 'words'
              ? `${token}${index < tokens.length - 1 ? '\u00A0' : ''}`
              : token;

        const isLast = index === tokens.length - 1;

        return (
          <motion.span
            key={`${token}-${index}`}
            className={`inline-block will-change-transform ${itemClassName}`}
            initial={from}
            animate={inView ? to : from}
            transition={{
              duration,
              ease: ease as never,
              delay: (delay / 1000) * index
            }}
            onAnimationComplete={() => {
              if (isLast && showCallback && !callbackFired) {
                setCallbackFired(true);
                onLetterAnimationComplete?.();
              }
            }}
          >
            {displayToken}
          </motion.span>
        );
      })}
    </Tag>
  );
};

export default SplitText;
