# Neural Mix ONNX Model

Place your stem-separation ONNX model here:

- Path: `/public/models/neuralmix.onnx`
- Preferred runtime: WebGPU (`onnx-webgpu`)
- Fallback runtime: WASM (`onnx-wasm`)
- Optional config: `/public/models/neuralmix.config.json`
  - You can start from `/public/models/neuralmix.config.example.json`
  - Useful when your model uses non-default input/output tensor names or requires a custom frame size

## Expected I/O contract

Input:
- name: first input tensor name
- shape: `[1, 1, T]`
- type: `float32`

Output (either format is accepted):
1. Named outputs: `drums`, `instruments`, `vocals` (each 1D/2D/3D tensor with timeline axis)
2. Single output containing 3 stems along one axis (`[1,3,T]`, `[3,T]`, or `[T,3]`)

When no compatible ONNX model exists, WebDJ automatically falls back to hybrid separation mode.
