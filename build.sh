#!/bin/bash

# Check if GEMINI_API_KEY is set
if [ -z "$GEMINI_API_KEY" ]; then
  echo "Warning: GEMINI_API_KEY is not set in the environment."
else
  echo "Injecting Gemini API Key..."
  # Replace the placeholder with the actual key
  # We use | as delimiter to avoid issues with slashes in keys
  sed -i "s|const apiKey = \"\";|const apiKey = \"$GEMINI_API_KEY\";|g" index.html
fi

echo "Build complete."
