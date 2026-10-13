export interface Comparison {
  text: string;
  color?: string;
  pill?: boolean;
  pillBg?: string;
  pillColor?: string;
}

export interface Kpi {
  id: string;
  label: string;
  value: number;
  formatStr: string;
  comparisons: Comparison[];
  stacked: boolean;
  description?: string;
  /** Set in Auto Segment mode; makes the card clickable. */
  segmentValue?: string;
  /** Values written to control variables on click, keyed by control number (1, 2). */
  clickValues?: Record<number, string>;
}

export interface Theme {
  bgColor: string;
  valueColor: string;
  labelColor: string;
  compColor: string;
  valueFontSize: string;
  compFontSize: string;
  labelFontSize: string;
  borderWidth: string;
  borderColor: string;
  borderRadius: string;
}

export interface Layout {
  minCardWidth: number;
  cardGap: number;
  /** Padding inside each card in px; null = responsive auto (scales 10–24px with card width). */
  cardPadding: number | null;
  /** Padding around the whole grid of cards, in px. */
  containerPadding: number;
  /** Vertical spacing between label, value, and comparisons inside a card, in px. */
  contentGap: number;
  cardLayout: 'stack' | 'grid';
  animEnabled: boolean;
  /** Show an info icon + hover tooltip next to labels that have a description. */
  showInfoIcon: boolean;
  animDuration: number;
  animStagger: number;
}
