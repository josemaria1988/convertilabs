type MarketingSectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function MarketingSectionHeading({
  eyebrow,
  title,
  description,
}: MarketingSectionHeadingProps) {
  return (
    <div className="space-y-4">
      <span className="eyebrow">{eyebrow}</span>
      <div className="space-y-3">
        <h2 className="max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-balance">
          {title}
        </h2>
        <p className="max-w-2xl text-base leading-8 text-[color:var(--color-muted)]">
          {description}
        </p>
      </div>
    </div>
  );
}
