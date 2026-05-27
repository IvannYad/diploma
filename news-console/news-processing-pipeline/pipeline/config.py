"""Configuration types for the news processing pipeline."""

from dataclasses import dataclass


@dataclass(slots=True)
class PipelineConfig:
    """Holds connection settings, collection names, and LLM parameters for all pipeline stages.

    Passed into every stage runner so MongoDB targets and model options stay consistent
    across prepare, cluster, extract, and chart generation.
    """

    mongo_uri: str
    openai_token: str
    db_name: str = "diploma"
    source_collection: str = "news_with_tables"
    prepared_collection: str = "prepared_news"
    clustered_collection: str = "clustered_articles"
    clustering_meta_collection: str = "clustering_metadata"
    extracted_collection: str = "extracted_news"
    extracted_index_collection: str = "extracted_news_index"
    schemas_collection: str = "olap_schemas"
    chart_configs_collection: str = "chart_configs"
    charts_meta_collection: str = "charts_metadata"
    metrics_collection: str = "clustering_metrics"
    subcluster_articles_collection: str = "subcluster_articles"
    pipeline_timing_collection: str = "pipeline_timing"
    batch_size: int = 50
    model_name: str = "gpt-5.4-mini"
