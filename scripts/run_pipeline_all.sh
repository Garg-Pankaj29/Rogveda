#!/bin/bash
set -e

echo "Starting ML pipeline for all endpoints..."

cd "$(dirname "$0")/.."
VENV="backend/.venv/bin/python3"

# Endpoints and their thresholds (in nM)
declare -A ENDPOINTS=(
    # ["antiinflammatory"]=170
    # ["antioxidant"]=12000
    ["antimicrobial"]=8
    ["anticancer"]=1500
)

for endpoint in "${!ENDPOINTS[@]}"; do
    threshold=${ENDPOINTS[$endpoint]}
    
    echo "=========================================================="
    echo "Processing endpoint: $endpoint (threshold: $threshold nM)"
    echo "=========================================================="
    
    echo "1. Building dataset..."
    $VENV scripts/build_dataset.py --endpoint $endpoint --threshold $threshold
    
    echo "2. Training model..."
    $VENV scripts/train_model.py --endpoint $endpoint
    
    echo "Finished $endpoint."
    echo ""
done

echo "All models trained successfully!"
