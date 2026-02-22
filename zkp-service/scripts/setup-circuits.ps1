# Compiles circom circuits and generates proving/verification keys.
# Run once before starting the service: npm run setup-circuits
#
# Prerequisites:
#   - circom CLI installed (https://docs.circom.io/getting-started/installation/)

$ErrorActionPreference = "Stop"

$CIRCUITS_SRC = "src/circuits"
$COMPILED_DIR = "circuits_compiled"
$KEYS_DIR     = "keys"
$PTAU_0       = "$KEYS_DIR/pot12_0000.ptau"
$PTAU_1       = "$KEYS_DIR/pot12_0001.ptau"
$PTAU_FINAL   = "$KEYS_DIR/powersOfTau.ptau"

# Generate powers of tau locally (power 12 = up to 4096 constraints, more than enough)
if (-not (Test-Path $PTAU_FINAL)) {
    Write-Host "==> Generating powers of tau locally (power 12)..."
    npx snarkjs powersoftau new bn128 12 $PTAU_0 -v
    if ($LASTEXITCODE -ne 0) { throw "powersoftau new failed" }

    npx snarkjs powersoftau contribute $PTAU_0 $PTAU_1 --name="did-wallet-thesis" -e="did wallet thesis entropy" -v
    if ($LASTEXITCODE -ne 0) { throw "powersoftau contribute failed" }

    npx snarkjs powersoftau prepare phase2 $PTAU_1 $PTAU_FINAL -v
    if ($LASTEXITCODE -ne 0) { throw "powersoftau prepare phase2 failed" }

    Remove-Item $PTAU_0, $PTAU_1 -Force
    Write-Host "==> Powers of tau ready."
} else {
    Write-Host "==> Powers of tau already exists, skipping."
}

function Compile-Circuit {
    param([string]$Name)

    Write-Host ""
    Write-Host "==> Compiling $Name..."
    circom "$CIRCUITS_SRC/$Name.circom" --r1cs --wasm --sym --output $COMPILED_DIR
    if ($LASTEXITCODE -ne 0) { throw "circom compile failed for $Name" }

    Write-Host "==> Generating zkey for $Name..."
    npx snarkjs groth16 setup "$COMPILED_DIR/$Name.r1cs" $PTAU_FINAL "$KEYS_DIR/${Name}_0000.zkey"
    if ($LASTEXITCODE -ne 0) { throw "groth16 setup failed for $Name" }

    Write-Host "==> Contributing to ceremony for $Name..."
    npx snarkjs zkey contribute "$KEYS_DIR/${Name}_0000.zkey" "$KEYS_DIR/${Name}_final.zkey" --name="did-wallet-thesis" -e="did wallet thesis entropy" -v
    if ($LASTEXITCODE -ne 0) { throw "zkey contribute failed for $Name" }

    Write-Host "==> Exporting verification key for $Name..."
    npx snarkjs zkey export verificationkey "$KEYS_DIR/${Name}_final.zkey" "$KEYS_DIR/${Name}_verification_key.json"
    if ($LASTEXITCODE -ne 0) { throw "zkey export failed for $Name" }

    # snarkjs outputs wasm inside a subdirectory - move it up
    $wasmSub = "$COMPILED_DIR/${Name}_js/$Name.wasm"
    if (Test-Path $wasmSub) {
        Move-Item $wasmSub "$COMPILED_DIR/$Name.wasm" -Force
        Remove-Item "$COMPILED_DIR/${Name}_js" -Recurse -Force
    }

    # Clean up intermediate zkey
    Remove-Item "$KEYS_DIR/${Name}_0000.zkey" -Force

    Write-Host "==> $Name ready."
}

Compile-Circuit "ageVerification"
Compile-Circuit "graduationYearRange"

Write-Host ""
Write-Host "All circuits compiled and keys generated."
