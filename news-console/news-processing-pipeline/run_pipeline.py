"""CLI entrypoint for the news processing pipeline."""

from pipeline.orchestration.runner import main

if __name__ == "__main__":
    raise SystemExit(main())
