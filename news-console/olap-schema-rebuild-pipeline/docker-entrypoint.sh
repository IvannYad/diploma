#!/bin/sh
set -eu

: "${MONGO_URI:?MONGO_URI is required}"
: "${OPENAI_API_KEY:?OPENAI_API_KEY is required}"
: "${PROCESS_ID:?PROCESS_ID is required}"
: "${OLAP_REBUILD_CLUSTER:?OLAP_REBUILD_CLUSTER is required}"
: "${OLAP_REBUILD_SUBCLUSTER:?OLAP_REBUILD_SUBCLUSTER is required}"
: "${OLAP_REBUILD_SCHEMA_JSON:?OLAP_REBUILD_SCHEMA_JSON is required}"

CALLBACK_ENDPOINT="${BACKEND_CALLBACK_ENDPOINT:-}"
MODEL_NAME="${MODEL_NAME:-gpt-5.4-mini}"

exec python run_rebuild.py \
  --mongo-uri "${MONGO_URI}" \
  --openai-token "${OPENAI_API_KEY}" \
  --process-id "${PROCESS_ID}" \
  --cluster "${OLAP_REBUILD_CLUSTER}" \
  --subcluster "${OLAP_REBUILD_SUBCLUSTER}" \
  --schema "${OLAP_REBUILD_SCHEMA_JSON}" \
  ${CALLBACK_ENDPOINT:+--callback-endpoint "${CALLBACK_ENDPOINT}"} \
  --model "${MODEL_NAME}"
