export interface HelpNode {
  tag?: string;
  text?: string;
  attrs?: Record<string, string>;
  children?: HelpNode[];
}

export type HelpLocale = 'cs' | 'en';

export interface HelpPage {
  key: string;
  fileName: string;
  route: string;
  locale: HelpLocale;
  title: string;
  body: HelpNode[];
}
