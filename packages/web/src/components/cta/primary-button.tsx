import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Slides the current label up and reveals a duplicate from below on hover. */
function AnimatedText({ children }: { children: ReactNode }) {
  return (
    <span className="relative block overflow-hidden">
      <span className="block transition-transform duration-300 ease-out group-hover:-translate-y-full">{children}</span>
      <span className="absolute inset-0 block translate-y-full transition-transform duration-300 ease-out group-hover:translate-y-0">
        {children}
      </span>
    </span>
  );
}

type Size = 'sm' | 'md' | 'lg';
const sizes: Record<Size, string> = {
  sm: 'h-9 px-5 text-xs',
  md: 'h-11 px-7 text-sm',
  lg: 'h-12 px-9 text-sm font-medium',
};

interface PrimaryButtonProps {
  children: ReactNode;
  as?: 'a' | 'button';
  href?: string;
  size?: Size;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
}

export function PrimaryButton({ children, as = 'a', href, size = 'lg', className, onClick, type }: PrimaryButtonProps) {
  const cls = cn(
    'group inline-flex items-center justify-center rounded-full bg-white/80 hover:bg-white text-black leading-none transition-colors',
    sizes[size],
    className,
  );
  const inner = <AnimatedText>{children}</AnimatedText>;
  if (as === 'button') {
    return (
      <button type={type ?? 'button'} className={cls} onClick={onClick}>
        {inner}
      </button>
    );
  }
  return (
    <a href={href ?? '#'} className={cls} onClick={onClick}>
      {inner}
    </a>
  );
}
