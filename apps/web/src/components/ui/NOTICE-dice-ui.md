# Dice UI FileUpload

Source: https://github.com/sadmann7/diceui/tree/d4168ae54186ab1512389ac9b52d1b25fdfd802f
Imported using shadcn CLI from https://diceui.com/r/styles/radix-vega/file-upload.json on 2026-09-30.
Files: file-upload.tsx and hooks/use-as-ref.ts, use-lazy-ref.ts, use-isomorphic-layout-effect.ts.
Adaptations: hutian cn helper and file-directory selection; only Root, Dropzone and Trigger retained; unused list/item/preview/progress renderers removed. File-local immutability lint exception and Root/Dropzone React Compiler opt-out for the upstream mutable external store/native FileList; region ARIA attributes corrected.

MIT License

Copyright (c) 2024 Sadman Sakib

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.