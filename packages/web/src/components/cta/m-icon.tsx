import { cn } from '@/lib/utils';

interface MIconProps {
  name: string;
  size?: number;
  fill?: number;
  weight?: number;
  grade?: number;
  opticalSize?: number;
  className?: string;
}

/** Material Symbols Outlined icon with variable-font axes. */
export function MIcon({ name, size = 20, fill = 0, weight = 400, grade = 0, opticalSize = 24, className }: MIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('material-symbols-outlined', className)}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${fill}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${opticalSize}`,
      }}
    >
      {name}
    </span>
  );
}
