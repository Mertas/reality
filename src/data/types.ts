/** Типы контента сайта «Это вода». Схема — docs/CONTRACTS.md раздел 3. */

export type DemoId =
  | 'troxler'
  | 'blindspot'
  | 'gorilla'
  | 'netineti'
  | 'looking'
  | 'contrast'
  | 'cut';

export interface Quote {
  text: string;
  src: string;
  /** «дословно» | «парафраз» */
  status: string;
}

export interface Term {
  term: string;
  def: string;
}

export interface Layer {
  id: string;
  n: number;
  title: string;
  lead?: string;
  body: string[];
  demo?: DemoId;
  demoNote?: string;
  quotes?: Quote[];
  terms?: Term[];
}

export interface Candidate {
  id: string;
  name: string;
  subtitle?: string;
  claim: string;
  why: string;
  caveat: string;
  tag?: string;
}

export interface Route {
  id: string;
  n: number;
  title: string;
  lead?: string;
  body: string[];
  demo?: DemoId;
  demoNote?: string;
  quotes?: Quote[];
}

export interface Skeptic {
  id: string;
  title: string;
  body: string;
  verdict?: string;
  source?: string;
}

export interface PracticeDef {
  id: string;
  title: string;
  why: string;
  how: string;
  minutes?: number;
  demoId?: DemoId;
}

export interface SourceRow {
  what: string;
  where: string;
  status: string;
}

export interface AgentReport {
  n: number;
  title: string;
  file: string;
  note?: string;
}

export interface SiteContent {
  meta: { title: string; subtitle: string; version: string; built: string };
  water: string[];
  intro: {
    kicker?: string;
    lead: string[];
    fish?: { text: string };
    wallace?: Quote;
    howto?: string[];
  };
  layers: Layer[];
  candidates: Candidate[];
  routes: Route[];
  skeptics: Skeptic[];
  practice: PracticeDef[];
  sources: {
    intro?: string;
    table: SourceRow[];
    honesty?: string[];
    agents?: AgentReport[];
  };
  closing: { paragraphs: string[]; wheeler?: Quote };
}
