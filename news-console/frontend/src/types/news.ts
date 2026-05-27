export interface Article {
  id: string | number;
  title: string;
  date?: string;
  time?: string;
  code?: string;
  bodyPreview?: string;
  fullBody?: string;
  clusterLabel?: string;
  scId?: string;
  retrievedAt?: string;
}

export interface NewsResponse {
  news: Article[];
  total: number;
}

export interface FactInfo {
  name: string;
  label?: string;
  unit: string;
  description: string;
  dimensions?: string[]; // Subset of shared OLAP dimensions that apply to this fact only.
}

export interface DimensionFilter {
  dimension_name: string;
  label: string;
  type: 'multi_select' | 'dropdown' | 'search' | 'toggle' | 'slider' | 'date_range';
  possible_values: string[];
  default: string;
  placement: string;
  description: string;
  allow_multiple: boolean;
}

export interface ChartConfig {
  chart_type: string;
  chart_justification?: string;
  title: string;
  description?: string;
  data_model: {
    x_axis_strategy?: 'article_date' | 'temporal_dimension';
    x_source_field?: string;
    granularity?: string;
    fact_aggregation?: {
      method: 'avg' | 'sum' | 'min' | 'max' | 'last' | 'first' | 'count' | 'median';
      explanation: string;
    };
  };
  fact_selector: {
    enabled: boolean;
    ui_component: string;
    label: string;
    default_fact: string;
    available_facts: FactInfo[];
  };
  dimension_filters: DimensionFilter[];
  axes: {
    x: { field: string; label: string; type: string; format?: string };
    y: { field: string; label: string; scale?: string; zero_baseline?: boolean };
  };
  color_encoding: {
    enabled: boolean;
    field: string | null;
    label: string | null;
    palette: string;
  };
  interactivity: {
    click_to_article: { enabled: boolean; action: string; id_field: string; label: string };
    tooltip: { enabled: boolean; fields: Array<{ field: string; label: string }> };
    zoom_pan?: { enabled: boolean };
    export?: { enabled: boolean; formats: string[] };
  };
  visual_options: {
    show_data_labels: boolean;
    show_legend: boolean;
    show_grid: boolean;
    theme: string;
    empty_state_message: string;
  };
}

export interface ChartConfigFile {
  olap_schema: {
    table_description: string;
    facts: FactInfo[];
    dimensions: Array<{ name: string; description: string; type: string; possible_values?: string[] }>;
  };
  chart: ChartConfig;
  metadata: {
    cluster_label: string;
    subcluster_id: string;
    num_articles: number;
    num_records: number;
  };
}

export interface OlapRecord {
  [key: string]: string | number | null;
}

export interface OlapArticle {
  article_id: string;
  title?: string;
  date?: string;
  records: OlapRecord[];
}

export interface ChartDataFile {
  metadata: { num_articles: number; num_records: number };
  articles: OlapArticle[];
}

