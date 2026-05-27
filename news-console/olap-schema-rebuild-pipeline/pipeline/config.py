from dataclasses import dataclass


@dataclass(slots=True)
class RebuildConfig:
    mongo_uri: str
    openai_token: str
    db_name: str = "diploma"
    schemas_collection: str = "olap_schemas"
    chart_configs_collection: str = "chart_configs"
    clustered_collection: str = "clustered_articles"
    extracted_collection: str = "extracted_news"
    subcluster_articles_collection: str = "subcluster_articles"
    clustering_meta_collection: str = "clustering_metadata"
    charts_meta_collection: str = "charts_metadata"
    pipeline_timing_collection: str = "pipeline_timing"
    model_name: str = "gpt-5.4-mini"
    sample_size: int = 3
    batch_size: int = 50
