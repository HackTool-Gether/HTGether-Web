import Image from 'next/image';

interface HtgLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function HtgLogo({ size = 24, className, style }: HtgLogoProps) {
  return (
    <Image
      src="/htg-white.png"
      alt="HTG"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', ...style }}
      draggable={false}
    />
  );
}
