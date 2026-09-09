/* eslint-disable @next/next/no-img-element */

type AutoBattleLogoProps = {
  className?: string;
  decorative?: boolean;
  eager?: boolean;
};

export function AutoBattleLogo({
  className,
  decorative = false,
  eager = false,
}: AutoBattleLogoProps) {
  return (
    <img
      className={className}
      src="/autobattle-logo.png"
      alt={decorative ? "" : "AutoBattle"}
      aria-hidden={decorative || undefined}
      width="1280"
      height="293"
      decoding="async"
      loading={eager ? "eager" : "lazy"}
    />
  );
}
