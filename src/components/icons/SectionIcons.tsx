/**
 * The two section glyphs the design draws itself.
 *
 * Both were approximated with whatever a library happened to export, and
 * the approximation differed per screen - Products & Order Items was a
 * box here, a grid there and a package elsewhere; Order Summary was a
 * clipboard, a bookmark, a clipboard-list and a document. Drawn here, in
 * currentColor, there is one of each and it is the shape in the design.
 *
 * They size from the font like any icon component, and take a className,
 * so they drop into the places the library icons came out of.
 */

type IconProps = {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
};

const box = (size: IconProps["size"]) => ({
  width: size ?? "1em",
  height: size ?? "1em",
});

/**
 * A receipt: straight across the top, torn along the bottom, two lines
 * of figures inside. This is the shape in the design - the rounded panel
 * that stood here before read as a plain box at 17px.
 */
export function OrderSummaryIcon({ size, className, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={{ ...box(size), ...style }}
    >
      <path d="M5 21V3h14v18l-2.8-1.4-2.8 1.4-2.8-1.4-2.8 1.4L5 21Z" />
      <path d="M8.75 9h6.5" />
      <path d="M8.75 13h5" />
    </svg>
  );
}

/** A parcel, for the goods on the document. */
export function ProductItemsIcon({ size, className, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={{ ...box(size), ...style }}
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}
