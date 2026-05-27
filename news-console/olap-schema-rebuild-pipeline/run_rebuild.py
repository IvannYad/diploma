
from __future__ import annotations

import sys

from pipeline.rebuild import parse_args, run_rebuild_pipeline, setup_logging


def main() -> int:
    """Parse arguments, configure logging, and run the three-stage rebuild pipeline.

    Returns:
        Process exit code (0 success, 1 failure).
    """
    args = parse_args()
    setup_logging(args.log_file)
    return run_rebuild_pipeline(args)


if __name__ == "__main__":
    sys.exit(main())
