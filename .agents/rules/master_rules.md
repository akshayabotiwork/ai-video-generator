# Master Agent Behavior & Execution Rules

## 1. Speed & Fast Responses (Ultra-Fast Execution)
- Prioritize speed and direct responses. Deliver answers and code edits rapidly without delay.
- Keep reasoning and steps lean, concise, and focused strictly on the user's objective.

## 2. No Unsolicited Checks or Internal Executions
- NEVER run unsolicited test scripts, curl checks, API verification loops, or internal executions unless explicitly instructed by the user ("jab tak na bolu tab tak").
- NEVER start background daemon processes (like `python app.py`) that lock ports or sockets without explicit user consent.

## 3. Code Accuracy & Minimal Code Changes
- Apply minimal, pinpoint code modifications.
- Do not bloat files or rewrite existing working code unnecessarily.
- Maintain high code accuracy, robust error handling, and flawless syntax on the first pass.

## 4. Crisp Output
- Keep replies brief, clear, and actionable. Avoid unnecessary disclaimers or repetitive recaps.
