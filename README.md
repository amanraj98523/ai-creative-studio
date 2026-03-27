# Prompt-to-Image Studio (Assignment Prototype)

This project is a submission-ready prototype that implements two required workflows using AI-powered text and image generation APIs, integrated through serverless backend functions and a modern React-based frontend.

## Live & Repository

- **Live URL**: https://ai-creative-studio-chi.vercel.app/
- **Repository URL**: https://github.com/amanraj98523/ai-creative-studio
---

## What this app does

### 1 Text Input Workflow

Flow: **Text Prompt → NLP Analysis/Enhancement → User Approval → Image Generation**

- User enters a raw prompt.
- Backend analyzes tone, intent, and requirements.
- System returns enhanced prompt + rationale.
- User can edit/approve enhanced prompt.
- Approved prompt generates image outputs.

### 2 Image Input Workflow

Flow: **Upload/URL Image → Analysis → Variation/Similar Generation**

- User uploads a local image or pastes an image URL.
- Backend extracts caption, tags, style, and theme.
- User chooses mode: **Variations** or **Similar new images**.
- System generates image outputs and displays metadata.

---

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Serverless Edge Functions (API orchestration & AI integration)
- **AI**: AI-powered text (NLP) and image generation models

---

## Architecture

### Frontend
- `src/pages/Index.tsx`: Main UI for both workflows, state management, validation, run history, and result rendering.

### Edge Functions
- `supabase/functions/enhance-prompt/index.ts`
  - Validates prompt length
  - Performs prompt analysis + enhancement
- `supabase/functions/generate-from-prompt/index.ts`
  - Validates approved prompt
  - Generates N images from enhanced text prompt
- `supabase/functions/analyze-image/index.ts`
  - Validates image input (data URL or HTTP/HTTPS URL)
  - Extracts caption/tags/style/theme
  - Generates variation or similar images

Shared helpers:
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/_shared/ai.ts`

---

## Setup Instructions

### 1. Install dependencies

```bash
npm install
```

### 2. Run frontend locally

```bash
npm run dev
```

### 3. Backend requirements

This project uses serverless edge functions for backend processing and secure API key provisioning via environment variables.

---

## API Usage Notes

- All AI calls are made server-side through edge functions.
- No private keys are exposed in frontend code.
- Input validation is implemented on both client and server.
- Rate-limit and payment errors are surfaced with clear messages.

---

## Screenshots Checklist (fill before submission)

- [ ] Home page with both workflow tabs visible
- [ ] Text prompt entered + enhancement output shown
- [ ] Approval + generated images from text workflow
- [ ] Image upload + analysis metadata (caption/tags/style/theme)
- [ ] Variation/similar generated images
- [ ] Run history panel

---

## Known Limitations

- External image URLs may fail if source blocks remote access.
- Generation speed and quality can vary based on model load.
- Large base64 images can increase response time.

---

## Future Improvements

- Add persistent run history in database
- Add prompt presets/styles
- Add batch generation and style intensity sliders
- Add optional background removal pipeline

---

## Submission Checklist

- [ ] Hosted webpage link added
- [ ] Repository link added
- [ ] README finalized
- [ ] Execution video recorded (≤ 5 min)
- [ ] Both workflows tested end-to-end
