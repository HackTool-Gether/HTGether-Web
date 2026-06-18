import Image from 'next/image';

interface HtgLogoProps {
  size?: number;
  variant?: 'white' | 'dark' | 'auto';
  className?: string;
  style?: React.CSSProperties;
}

export function HtgLogo({ size = 24, variant = 'auto', className, style }: HtgLogoProps) {
  const imgStyle = { objectFit: 'contain' as const, ...style };

  if (variant === 'white') {
    return (
      <Image src="/htg-logo-white.png" alt="HTG" width={size} height={size}
        className={className} style={imgStyle} draggable={false} />
    );
  }
  if (variant === 'dark') {
    return (
      <Image src="/htg-logo.png" alt="HTG" width={size} height={size}
        className={className} style={imgStyle} draggable={false} />
    );
  }

  return (
    <>
      <Image src="/htg-logo-white.png" alt="HTG" width={size} height={size}
        className={`htg-logo-white ${className ?? ''}`} style={imgStyle} draggable={false} />
      <Image src="/htg-logo.png" alt="HTG" width={size} height={size}
        className={`htg-logo-dark ${className ?? ''}`} style={imgStyle} draggable={false} />
    </>
  );
}
