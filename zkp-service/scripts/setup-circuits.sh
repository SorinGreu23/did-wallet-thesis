#!/bin/bash
# Compiles circom circuits and generates proving/verification keys.
# Run once before starting the service: npm run setup-circuits
#
# Prerequisites:
#   - circom CLI installed (https://docs.circom.io/getting-started/installation/)
#   - snarkjs installed (npm install -g snarkjs)

set -e

CIRCUITS_SRC="src/circuits"
COMPILED_DIR="circuits_compiled"
KEYS_DIR="keys"
PTAU="keys/powersOfTau.ptau"

echo "==> Downloading powers of tau (hermez, 12)..."
if [ ! -f "$PTAU" ]; then
  curl -L https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau \
    -o "$PTAU"
fi

compile_circuit() {
  local NAME=$1
  echo ""
  echo "==> Compiling $NAME..."

  circom "$CIRCUITS_SRC/$NAME.circom" \
    --r1cs --wasm --sym \
    --output "$COMPILED_DIR"

  echo "==> Generating zkey for $NAME..."
  snarkjs groth16 setup \
    "$COMPILED_DIR/$NAME.r1cs" \
    "$PTAU" \
    "$KEYS_DIR/${NAME}_0000.zkey"

  echo "==> Contributing to ceremony for $NAME..."
  snarkjs zkey contribute \
    "$KEYS_DIR/${NAME}_0000.zkey" \
    "$KEYS_DIR/${NAME}_final.zkey" \
    --name="did-wallet-thesis" -v

  echo "==> Exporting verification key for $NAME..."
  snarkjs zkey export verificationkey \
    "$KEYS_DIR/${NAME}_final.zkey" \
    "$KEYS_DIR/${NAME}_verification_key.json"

  # snarkjs outputs the wasm inside a subdirectory - move it up
  if [ -f "$COMPILED_DIR/${NAME}_js/$NAME.wasm" ]; then
    mv "$COMPILED_DIR/${NAME}_js/$NAME.wasm" "$COMPILED_DIR/$NAME.wasm"
    rm -rf "$COMPILED_DIR/${NAME}_js"
  fi

  echo "==> $NAME ready."
}

compile_circuit "ageVerification"
compile_circuit "graduationYearRange"

echo ""
echo "All circuits compiled and keys generated."
